from __future__ import annotations

from typing import Any
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.mappers.execution import civilization_to_response
from app.api.runtime import get_service_container, run_scoped_atomic_idempotent
from app.app_factory import ServiceContainer
from app.db import get_session
from app.domains.civilizations.policy import CivilizationPolicyError, normalize_civilization_metadata_patch
from app.models import User
from app.modules.auth.dependencies import get_current_user
from app.schemas import (
    FACT_RESERVED_METADATA_KEYS,
    CivilizationIngestRequest,
    CivilizationMutateRequest,
    CivilizationResponse,
)
from app.services.parser_types import AtomicTask

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
        metadata_patch = normalize_civilization_metadata_patch(
            payload.metadata,
            reserved_keys=FACT_RESERVED_METADATA_KEYS,
        )
    except CivilizationPolicyError as exc:
        raise _policy_to_http_exception(exc) from exc
    params: dict[str, Any] = {"civilization_id": str(civilization_id)}
    if payload.value is not None:
        params["value"] = payload.value
    if metadata_patch:
        params["metadata"] = metadata_patch
    if payload.expected_event_seq is not None:
        params["expected_event_seq"] = payload.expected_event_seq

    tasks = [AtomicTask(action="UPDATE_ASTEROID", params=params)]

    def map_execution(execution) -> CivilizationResponse:
        if not execution.civilizations:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Civilization not found")
        mutated = next((c for c in execution.civilizations if c.id == civilization_id), execution.civilizations[0])
        return civilization_to_response(mutated)

    return await run_scoped_atomic_idempotent(
        session=session,
        current_user=current_user,
        services=services,
        tasks=tasks,
        galaxy_id=payload.galaxy_id,
        branch_id=payload.branch_id,
        endpoint_key=endpoint_key,
        idempotency_key=payload.idempotency_key,
        request_payload={
            "civilization_id": str(civilization_id),
            "value": payload.value,
            "metadata": metadata_patch,
            "expected_event_seq": payload.expected_event_seq,
        },
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
    params: dict[str, Any] = {"civilization_id": str(civilization_id)}
    if expected_event_seq is not None:
        params["expected_event_seq"] = expected_event_seq
    tasks = [AtomicTask(action="EXTINGUISH", params=params)]

    def map_execution(execution) -> CivilizationResponse:
        if civilization_id not in execution.extinguished_civilization_ids:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Civilization not found")
        deleted_civilization = next(
            (civilization for civilization in execution.extinguished_asteroids if civilization.id == civilization_id),
            None,
        )
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
        tasks=tasks,
        galaxy_id=galaxy_id,
        branch_id=branch_id,
        endpoint_key=endpoint_key,
        idempotency_key=idempotency_key,
        request_payload={"civilization_id": str(civilization_id), "expected_event_seq": expected_event_seq},
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
    tasks = [AtomicTask(action="INGEST", params={"value": payload.value, "metadata": payload.metadata})]

    def map_execution(execution) -> CivilizationResponse:
        if not execution.civilizations:
            raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail="Civilization ingest failed")
        return civilization_to_response(execution.civilizations[0])

    return await run_scoped_atomic_idempotent(
        session=session,
        current_user=current_user,
        services=services,
        tasks=tasks,
        galaxy_id=payload.galaxy_id,
        branch_id=payload.branch_id,
        endpoint_key="POST:/civilizations/ingest",
        idempotency_key=payload.idempotency_key,
        request_payload={"value": payload.value, "metadata": payload.metadata},
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
