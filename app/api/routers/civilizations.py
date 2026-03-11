from __future__ import annotations

from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.mappers.execution import civilization_to_response
from app.api.runtime import get_service_container, run_scoped_atomic_idempotent
from app.app_factory import ServiceContainer
from app.db import get_session
from app.domains.civilizations.commands import (
    CivilizationPolicyError,
    pick_extinguished_civilization,
    pick_ingested_civilization,
    pick_mutated_civilization,
    plan_extinguish_civilization,
    plan_ingest_civilization,
    plan_mutate_civilization,
)
from app.models import User
from app.modules.auth.dependencies import get_current_user
from app.schemas import (
    CivilizationIngestRequest,
    CivilizationMutateRequest,
    CivilizationResponse,
)

router = APIRouter(tags=["civilizations"])


def _policy_to_http_exception(exc: CivilizationPolicyError) -> HTTPException:
    return HTTPException(
        status_code=status.HTTP_422_UNPROCESSABLE_CONTENT,
        detail=exc.to_detail(),
    )


async def _mutate_civilization_impl(
    *,
    civilization_id: UUID,
    payload: CivilizationMutateRequest,
    session: AsyncSession,
    current_user: User,
    services: ServiceContainer,
    endpoint_key: str,
) -> CivilizationResponse:
    try:
        plan = plan_mutate_civilization(
            civilization_id=civilization_id,
            value=payload.value,
            metadata=payload.metadata,
            expected_event_seq=payload.expected_event_seq,
        )
    except CivilizationPolicyError as exc:
        raise _policy_to_http_exception(exc) from exc

    def map_execution(execution) -> CivilizationResponse:
        mutated = pick_mutated_civilization(execution=execution, civilization_id=civilization_id)
        if mutated is None:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Civilization not found")
        return civilization_to_response(mutated)

    return await run_scoped_atomic_idempotent(
        session=session,
        current_user=current_user,
        services=services,
        tasks=plan.tasks,
        galaxy_id=payload.galaxy_id,
        branch_id=payload.branch_id,
        endpoint_key=endpoint_key,
        idempotency_key=payload.idempotency_key,
        request_payload=plan.request_payload,
        map_execution=map_execution,
        replay_loader=CivilizationResponse.model_validate,
        response_dumper=lambda response: response.model_dump(mode="json"),
        empty_response_detail="Civilization not found",
        empty_response_status=status.HTTP_404_NOT_FOUND,
    )


async def _extinguish_civilization_impl(
    *,
    civilization_id: UUID,
    galaxy_id: UUID | None,
    branch_id: UUID | None,
    expected_event_seq: int | None,
    idempotency_key: str | None,
    session: AsyncSession,
    current_user: User,
    services: ServiceContainer,
    endpoint_key: str,
) -> CivilizationResponse:
    plan = plan_extinguish_civilization(
        civilization_id=civilization_id,
        expected_event_seq=expected_event_seq,
    )

    def map_execution(execution) -> CivilizationResponse:
        extinguished, deleted_civilization = pick_extinguished_civilization(
            execution=execution,
            civilization_id=civilization_id,
        )
        if not extinguished:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Civilization not found")
        if deleted_civilization is None:
            raise HTTPException(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                detail="Extinguish result is inconsistent",
            )
        return civilization_to_response(deleted_civilization)

    return await run_scoped_atomic_idempotent(
        session=session,
        current_user=current_user,
        services=services,
        tasks=plan.tasks,
        galaxy_id=galaxy_id,
        branch_id=branch_id,
        endpoint_key=endpoint_key,
        idempotency_key=idempotency_key,
        request_payload=plan.request_payload,
        map_execution=map_execution,
        replay_loader=CivilizationResponse.model_validate,
        response_dumper=lambda response: response.model_dump(mode="json"),
        empty_response_detail="Civilization not found",
        empty_response_status=status.HTTP_404_NOT_FOUND,
    )


@router.post("/civilizations/ingest", response_model=CivilizationResponse, status_code=status.HTTP_200_OK)
async def ingest_civilization(
    payload: CivilizationIngestRequest,
    session: AsyncSession = Depends(get_session),
    current_user: User = Depends(get_current_user),
    services: ServiceContainer = Depends(get_service_container),
) -> CivilizationResponse:
    plan = plan_ingest_civilization(
        value=payload.value,
        metadata=payload.metadata,
    )

    def map_execution(execution) -> CivilizationResponse:
        created = pick_ingested_civilization(execution=execution)
        if created is None:
            raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail="Civilization ingest failed")
        return civilization_to_response(created)

    return await run_scoped_atomic_idempotent(
        session=session,
        current_user=current_user,
        services=services,
        tasks=plan.tasks,
        galaxy_id=payload.galaxy_id,
        branch_id=payload.branch_id,
        endpoint_key="POST:/civilizations/ingest",
        idempotency_key=payload.idempotency_key,
        request_payload=plan.request_payload,
        map_execution=map_execution,
        replay_loader=CivilizationResponse.model_validate,
        response_dumper=lambda response: response.model_dump(mode="json"),
        empty_response_detail="Civilization ingest failed",
    )


@router.patch(
    "/civilizations/{civilization_id}/extinguish",
    response_model=CivilizationResponse,
    status_code=status.HTTP_200_OK,
)
async def extinguish_civilization(
    civilization_id: UUID,
    galaxy_id: UUID | None = Query(default=None),
    branch_id: UUID | None = Query(default=None),
    expected_event_seq: int | None = Query(default=None, ge=0),
    idempotency_key: str | None = Query(default=None),
    session: AsyncSession = Depends(get_session),
    current_user: User = Depends(get_current_user),
    services: ServiceContainer = Depends(get_service_container),
) -> CivilizationResponse:
    return await _extinguish_civilization_impl(
        civilization_id=civilization_id,
        galaxy_id=galaxy_id,
        branch_id=branch_id,
        expected_event_seq=expected_event_seq,
        idempotency_key=idempotency_key,
        session=session,
        current_user=current_user,
        services=services,
        endpoint_key="PATCH:/civilizations/{civilization_id}/extinguish",
    )


@router.patch(
    "/civilizations/{civilization_id}/mutate",
    response_model=CivilizationResponse,
    status_code=status.HTTP_200_OK,
)
async def mutate_civilization(
    civilization_id: UUID,
    payload: CivilizationMutateRequest,
    session: AsyncSession = Depends(get_session),
    current_user: User = Depends(get_current_user),
    services: ServiceContainer = Depends(get_service_container),
) -> CivilizationResponse:
    return await _mutate_civilization_impl(
        civilization_id=civilization_id,
        payload=payload,
        session=session,
        current_user=current_user,
        services=services,
        endpoint_key="PATCH:/civilizations/{civilization_id}/mutate",
    )
