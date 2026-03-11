from __future__ import annotations

from typing import Any
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.mappers.execution import civilization_to_response, universe_asteroid_to_snapshot
from app.api.runtime import (
    get_service_container,
    resolve_scope_for_user,
    run_scoped_idempotent,
)
from app.app_factory import ServiceContainer
from app.db import get_read_session, get_session
from app.domains.civilizations.policy import CivilizationPolicyError, normalize_mineral_key
from app.models import User
from app.modules.auth.dependencies import get_current_user
from app.schemas import (
    FACT_RESERVED_METADATA_KEYS,
    CivilizationMineralMutateRequest,
    CivilizationResponse,
    MoonCreateRequest,
    MoonListResponse,
    MoonRowContract,
    civilization_snapshot_to_moon_row,
)
from app.services.parser_types import AtomicTask

router = APIRouter(tags=["civilizations"])


def _moon_row_from_source(source: Any, *, galaxy_id: UUID) -> MoonRowContract:
    snapshot = universe_asteroid_to_snapshot(source, galaxy_id=galaxy_id)
    return civilization_snapshot_to_moon_row(snapshot)


def _moon_row_from_asteroid_response(response: CivilizationResponse, *, galaxy_id: UUID) -> MoonRowContract:
    return _moon_row_from_source(
        {
            "id": response.id,
            "value": response.value,
            "metadata": response.metadata,
            "created_at": response.created_at,
            "current_event_seq": response.current_event_seq,
        },
        galaxy_id=galaxy_id,
    )


async def _resolve_planet_table_name(
    *,
    session: AsyncSession,
    current_user: User,
    services: ServiceContainer,
    galaxy_id: UUID,
    branch_id: UUID | None,
    planet_id: UUID,
) -> str:
    tables = await services.universe_service.tables_snapshot(
        session=session,
        user_id=current_user.id,
        galaxy_id=galaxy_id,
        branch_id=branch_id,
    )
    row = next((item for item in tables if str(item.get("table_id") or "") == str(planet_id)), None)
    if row is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Planet not found")
    table_name = str(row.get("name") or "").strip()
    if not table_name:
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail="Planet table name is not resolved")
    return table_name


async def _load_active_civilization_row(
    *,
    session: AsyncSession,
    current_user: User,
    services: ServiceContainer,
    galaxy_id: UUID,
    branch_id: UUID | None,
    civilization_id: UUID,
) -> MoonRowContract:
    civilizations, _ = await services.universe_service.snapshot(
        session=session,
        user_id=current_user.id,
        galaxy_id=galaxy_id,
        branch_id=branch_id,
    )
    for civilization in civilizations:
        source_id = civilization.get("id") if isinstance(civilization, dict) else getattr(civilization, "id", None)
        if str(source_id or "") != str(civilization_id):
            continue
        return _moon_row_from_source(civilization, galaxy_id=galaxy_id)
    raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Civilization not found")


def _policy_to_http_exception(exc: CivilizationPolicyError) -> HTTPException:
    return HTTPException(
        status_code=status.HTTP_422_UNPROCESSABLE_CONTENT,
        detail=exc.to_detail(),
    )


@router.get("/civilizations", response_model=MoonListResponse, status_code=status.HTTP_200_OK)
async def list_civilizations(
    galaxy_id: UUID | None = Query(default=None),
    branch_id: UUID | None = Query(default=None),
    planet_id: UUID | None = Query(default=None),
    session: AsyncSession = Depends(get_read_session),
    current_user: User = Depends(get_current_user),
    services: ServiceContainer = Depends(get_service_container),
) -> MoonListResponse:
    target_galaxy_id, target_branch_id = await resolve_scope_for_user(
        session=session,
        user=current_user,
        galaxy_id=galaxy_id,
        branch_id=branch_id,
        services=services,
    )
    civilizations, _ = await services.universe_service.snapshot(
        session=session,
        user_id=current_user.id,
        galaxy_id=target_galaxy_id,
        branch_id=target_branch_id,
    )
    items: list[MoonRowContract] = []
    for civilization in civilizations:
        moon_row = _moon_row_from_source(civilization, galaxy_id=target_galaxy_id)
        if planet_id is not None and moon_row.planet_id != planet_id:
            continue
        items.append(moon_row)
    items.sort(key=lambda row: (str(row.constellation_name).lower(), str(row.planet_name).lower(), row.label.lower()))
    return MoonListResponse(items=items)


@router.get("/civilizations/{civilization_id}", response_model=MoonRowContract, status_code=status.HTTP_200_OK)
async def get_civilization(
    civilization_id: UUID,
    galaxy_id: UUID | None = Query(default=None),
    branch_id: UUID | None = Query(default=None),
    session: AsyncSession = Depends(get_read_session),
    current_user: User = Depends(get_current_user),
    services: ServiceContainer = Depends(get_service_container),
) -> MoonRowContract:
    target_galaxy_id, target_branch_id = await resolve_scope_for_user(
        session=session,
        user=current_user,
        galaxy_id=galaxy_id,
        branch_id=branch_id,
        services=services,
    )
    return await _load_active_civilization_row(
        session=session,
        current_user=current_user,
        services=services,
        galaxy_id=target_galaxy_id,
        branch_id=target_branch_id,
        civilization_id=civilization_id,
    )


@router.post("/civilizations", response_model=MoonRowContract, status_code=status.HTTP_201_CREATED)
async def create_civilization(
    payload: MoonCreateRequest,
    session: AsyncSession = Depends(get_session),
    current_user: User = Depends(get_current_user),
    services: ServiceContainer = Depends(get_service_container),
) -> MoonRowContract:
    target_galaxy_id, target_branch_id = await resolve_scope_for_user(
        session=session,
        user=current_user,
        galaxy_id=payload.galaxy_id,
        branch_id=payload.branch_id,
        services=services,
    )
    target_table_name = await _resolve_planet_table_name(
        session=session,
        current_user=current_user,
        services=services,
        galaxy_id=target_galaxy_id,
        branch_id=target_branch_id,
        planet_id=payload.planet_id,
    )
    metadata = dict(payload.minerals or {})
    metadata["table"] = target_table_name
    metadata["table_id"] = str(payload.planet_id)
    tasks = [AtomicTask(action="INGEST", params={"value": payload.label, "metadata": metadata})]

    async def execute_scoped(_: UUID, __: UUID | None):
        execution = await services.task_executor_service.execute_tasks(
            session=session,
            tasks=tasks,
            user_id=current_user.id,
            galaxy_id=target_galaxy_id,
            branch_id=target_branch_id,
            manage_transaction=False,
        )
        if not execution.civilizations:
            raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail="Civilization ingest failed")
        return civilization_to_response(execution.civilizations[0])

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
    return _moon_row_from_asteroid_response(created, galaxy_id=target_galaxy_id)


@router.patch(
    "/civilizations/{civilization_id}/minerals/{mineral_key}",
    response_model=MoonRowContract,
    status_code=status.HTTP_200_OK,
)
async def mutate_civilization_mineral(
    civilization_id: UUID,
    mineral_key: str,
    payload: CivilizationMineralMutateRequest,
    session: AsyncSession = Depends(get_session),
    current_user: User = Depends(get_current_user),
    services: ServiceContainer = Depends(get_service_container),
) -> MoonRowContract:
    target_galaxy_id, target_branch_id = await resolve_scope_for_user(
        session=session,
        user=current_user,
        galaxy_id=payload.galaxy_id,
        branch_id=payload.branch_id,
        services=services,
    )
    try:
        normalized_key = normalize_mineral_key(mineral_key, reserved_keys=FACT_RESERVED_METADATA_KEYS)
    except CivilizationPolicyError as exc:
        raise _policy_to_http_exception(exc) from exc
    params: dict[str, Any] = {"civilization_id": str(civilization_id)}
    if payload.remove:
        params["metadata_remove"] = [normalized_key]
    else:
        params["metadata"] = {normalized_key: payload.typed_value}
    params["expected_event_seq"] = payload.expected_event_seq
    tasks = [AtomicTask(action="UPDATE_ASTEROID", params=params)]

    async def execute_scoped(_: UUID, __: UUID | None):
        execution = await services.task_executor_service.execute_tasks(
            session=session,
            tasks=tasks,
            user_id=current_user.id,
            galaxy_id=target_galaxy_id,
            branch_id=target_branch_id,
            manage_transaction=False,
        )
        if not execution.civilizations:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Civilization not found")
        mutated = next(
            (civilization for civilization in execution.civilizations if civilization.id == civilization_id),
            execution.civilizations[0],
        )
        return civilization_to_response(mutated)

    mutated = await run_scoped_idempotent(
        session=session,
        current_user=current_user,
        services=services,
        galaxy_id=target_galaxy_id,
        branch_id=target_branch_id,
        endpoint_key="PATCH:/civilizations/{civilization_id}/minerals/{mineral_key}",
        idempotency_key=payload.idempotency_key,
        request_payload={
            "civilization_id": str(civilization_id),
            "mineral_key": normalized_key,
            "remove": payload.remove,
            "typed_value": payload.typed_value if not payload.remove else None,
            "expected_event_seq": payload.expected_event_seq,
        },
        execute=execute_scoped,
        replay_loader=CivilizationResponse.model_validate,
        response_dumper=lambda response: response.model_dump(mode="json"),
        empty_response_detail="Civilization not found",
        empty_response_status=status.HTTP_404_NOT_FOUND,
        resolved_scope=(target_galaxy_id, target_branch_id),
    )
    return _moon_row_from_asteroid_response(mutated, galaxy_id=target_galaxy_id)
