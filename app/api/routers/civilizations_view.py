from __future__ import annotations

from typing import Any
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.mappers.execution import civilization_to_response, universe_civilization_to_snapshot
from app.api.runtime import (
    get_service_container,
    resolve_scope_for_user,
    run_scoped_idempotent,
)
from app.app_factory import ServiceContainer
from app.db import get_read_session, get_session
from app.domains.civilizations.commands import (
    CivilizationPolicyError,
    compose_planet_scoped_metadata,
    pick_ingested_civilization,
    pick_mutated_civilization,
    plan_ingest_civilization,
    plan_mineral_mutation,
)
from app.domains.civilizations.queries import (
    CivilizationQueryConflictError,
    CivilizationQueryNotFoundError,
    get_active_civilization,
    list_active_civilizations,
    resolve_planet_table_name,
)
from app.models import User
from app.modules.auth.dependencies import get_current_user
from app.schemas import (
    CivilizationCreateRequest,
    CivilizationListResponse,
    CivilizationMineralMutateRequest,
    CivilizationResponse,
    CivilizationRowContract,
    civilization_snapshot_to_civilization_row,
)

router = APIRouter(tags=["civilizations"])


def _civilization_row_from_source(source: Any, *, galaxy_id: UUID) -> CivilizationRowContract:
    snapshot = universe_civilization_to_snapshot(source, galaxy_id=galaxy_id)
    return civilization_snapshot_to_civilization_row(snapshot)


def _civilization_row_from_asteroid_response(
    response: CivilizationResponse, *, galaxy_id: UUID
) -> CivilizationRowContract:
    return _civilization_row_from_source(
        {
            "id": response.id,
            "value": response.value,
            "metadata": response.metadata,
            "created_at": response.created_at,
            "current_event_seq": response.current_event_seq,
        },
        galaxy_id=galaxy_id,
    )


def _policy_to_http_exception(exc: CivilizationPolicyError) -> HTTPException:
    return HTTPException(
        status_code=status.HTTP_422_UNPROCESSABLE_CONTENT,
        detail=exc.to_detail(),
    )


def _query_to_http_exception(
    exc: CivilizationQueryNotFoundError | CivilizationQueryConflictError,
) -> HTTPException:
    if isinstance(exc, CivilizationQueryNotFoundError):
        return HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=str(exc))
    return HTTPException(status_code=status.HTTP_409_CONFLICT, detail=str(exc))


@router.get("/civilizations", response_model=CivilizationListResponse, status_code=status.HTTP_200_OK)
async def list_civilizations(
    galaxy_id: UUID | None = Query(default=None),
    branch_id: UUID | None = Query(default=None),
    planet_id: UUID | None = Query(default=None),
    session: AsyncSession = Depends(get_read_session),
    current_user: User = Depends(get_current_user),
    services: ServiceContainer = Depends(get_service_container),
) -> CivilizationListResponse:
    target_galaxy_id, target_branch_id = await resolve_scope_for_user(
        session=session,
        user=current_user,
        galaxy_id=galaxy_id,
        branch_id=branch_id,
        services=services,
    )
    civilizations = await list_active_civilizations(
        session=session,
        services=services,
        user_id=current_user.id,
        galaxy_id=target_galaxy_id,
        branch_id=target_branch_id,
    )
    items: list[CivilizationRowContract] = []
    for civilization in civilizations:
        civilization_row = _civilization_row_from_source(civilization, galaxy_id=target_galaxy_id)
        if planet_id is not None and civilization_row.planet_id != planet_id:
            continue
        items.append(civilization_row)
    items.sort(key=lambda row: (str(row.constellation_name).lower(), str(row.planet_name).lower(), row.label.lower()))
    return CivilizationListResponse(items=items)


@router.get(
    "/civilizations/{civilization_id}",
    response_model=CivilizationRowContract,
    status_code=status.HTTP_200_OK,
)
async def get_civilization(
    civilization_id: UUID,
    galaxy_id: UUID | None = Query(default=None),
    branch_id: UUID | None = Query(default=None),
    session: AsyncSession = Depends(get_read_session),
    current_user: User = Depends(get_current_user),
    services: ServiceContainer = Depends(get_service_container),
) -> CivilizationRowContract:
    target_galaxy_id, target_branch_id = await resolve_scope_for_user(
        session=session,
        user=current_user,
        galaxy_id=galaxy_id,
        branch_id=branch_id,
        services=services,
    )
    try:
        civilization = await get_active_civilization(
            session=session,
            services=services,
            user_id=current_user.id,
            galaxy_id=target_galaxy_id,
            branch_id=target_branch_id,
            civilization_id=civilization_id,
        )
    except (CivilizationQueryNotFoundError, CivilizationQueryConflictError) as exc:
        raise _query_to_http_exception(exc) from exc
    return _civilization_row_from_source(civilization, galaxy_id=target_galaxy_id)


@router.post("/civilizations", response_model=CivilizationRowContract, status_code=status.HTTP_201_CREATED)
async def create_civilization(
    payload: CivilizationCreateRequest,
    session: AsyncSession = Depends(get_session),
    current_user: User = Depends(get_current_user),
    services: ServiceContainer = Depends(get_service_container),
) -> CivilizationRowContract:
    target_galaxy_id, target_branch_id = await resolve_scope_for_user(
        session=session,
        user=current_user,
        galaxy_id=payload.galaxy_id,
        branch_id=payload.branch_id,
        services=services,
    )
    try:
        target_table_name = await resolve_planet_table_name(
            session=session,
            services=services,
            user_id=current_user.id,
            galaxy_id=target_galaxy_id,
            branch_id=target_branch_id,
            planet_id=payload.planet_id,
        )
    except (CivilizationQueryNotFoundError, CivilizationQueryConflictError) as exc:
        raise _query_to_http_exception(exc) from exc
    metadata = compose_planet_scoped_metadata(
        planet_id=payload.planet_id,
        table_name=target_table_name,
        minerals=payload.minerals,
    )
    plan = plan_ingest_civilization(
        value=payload.label,
        metadata=metadata,
    )

    async def execute_scoped(_: UUID, __: UUID | None):
        execution = await services.task_executor_service.execute_tasks(
            session=session,
            tasks=plan.tasks,
            user_id=current_user.id,
            galaxy_id=target_galaxy_id,
            branch_id=target_branch_id,
            manage_transaction=False,
        )
        created = pick_ingested_civilization(execution=execution)
        if created is None:
            raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail="Civilization ingest failed")
        return civilization_to_response(created)

    created = await run_scoped_idempotent(
        session=session,
        current_user=current_user,
        services=services,
        galaxy_id=target_galaxy_id,
        branch_id=target_branch_id,
        endpoint_key="POST:/civilizations",
        idempotency_key=payload.idempotency_key,
        request_payload={
            "planet_id": str(payload.planet_id),
            "label": payload.label,
            "minerals": payload.minerals,
        },
        execute=execute_scoped,
        replay_loader=CivilizationResponse.model_validate,
        response_dumper=lambda response: response.model_dump(mode="json"),
        empty_response_detail="Civilization ingest failed",
        resolved_scope=(target_galaxy_id, target_branch_id),
    )
    return _civilization_row_from_asteroid_response(created, galaxy_id=target_galaxy_id)


@router.patch(
    "/civilizations/{civilization_id}/minerals/{mineral_key}",
    response_model=CivilizationRowContract,
    status_code=status.HTTP_200_OK,
)
async def mutate_civilization_mineral(
    civilization_id: UUID,
    mineral_key: str,
    payload: CivilizationMineralMutateRequest,
    session: AsyncSession = Depends(get_session),
    current_user: User = Depends(get_current_user),
    services: ServiceContainer = Depends(get_service_container),
) -> CivilizationRowContract:
    target_galaxy_id, target_branch_id = await resolve_scope_for_user(
        session=session,
        user=current_user,
        galaxy_id=payload.galaxy_id,
        branch_id=payload.branch_id,
        services=services,
    )
    try:
        plan = plan_mineral_mutation(
            civilization_id=civilization_id,
            mineral_key=mineral_key,
            typed_value=payload.typed_value,
            remove=payload.remove,
            expected_event_seq=payload.expected_event_seq,
        )
    except CivilizationPolicyError as exc:
        raise _policy_to_http_exception(exc) from exc

    async def execute_scoped(_: UUID, __: UUID | None):
        execution = await services.task_executor_service.execute_tasks(
            session=session,
            tasks=plan.tasks,
            user_id=current_user.id,
            galaxy_id=target_galaxy_id,
            branch_id=target_branch_id,
            manage_transaction=False,
        )
        mutated = pick_mutated_civilization(execution=execution, civilization_id=civilization_id)
        if mutated is None:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Civilization not found")
        return civilization_to_response(mutated)

    mutated = await run_scoped_idempotent(
        session=session,
        current_user=current_user,
        services=services,
        galaxy_id=target_galaxy_id,
        branch_id=target_branch_id,
        endpoint_key="PATCH:/civilizations/{civilization_id}/minerals/{mineral_key}",
        idempotency_key=payload.idempotency_key,
        request_payload=plan.request_payload,
        execute=execute_scoped,
        replay_loader=CivilizationResponse.model_validate,
        response_dumper=lambda response: response.model_dump(mode="json"),
        empty_response_detail="Civilization not found",
        empty_response_status=status.HTTP_404_NOT_FOUND,
        resolved_scope=(target_galaxy_id, target_branch_id),
    )
    return _civilization_row_from_asteroid_response(mutated, galaxy_id=target_galaxy_id)
