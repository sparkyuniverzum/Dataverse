from __future__ import annotations

from typing import Any
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.mappers.execution import civilization_to_response
from app.api.runtime import get_service_container, run_scoped_atomic_idempotent
from app.app_factory import ServiceContainer
from app.db import get_session
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


def _normalize_metadata_patch(
    metadata: dict[str, Any],
    *,
    allow_reserved: bool,
) -> dict[str, Any]:
    patch = dict(metadata or {})
    if allow_reserved:
        return patch
    reserved = sorted(
        {str(key) for key in patch.keys() if str(key or "").strip().lower() in FACT_RESERVED_METADATA_KEYS}
    )
    if reserved:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_CONTENT,
            detail={
                "code": "RESERVED_METADATA_KEYS_NOT_ALLOWED",
                "message": "Use mineral endpoint for mineral writes; reserved metadata keys are blocked on /mutate.",
                "keys": reserved,
                "repair_hint": "Use PATCH /civilizations/{civilization_id}/minerals/{mineral_key} for minerals.",
            },
        )
    return patch


async def _mutate_civilization_impl(
    *,
    civilization_id: UUID,
    payload: CivilizationMutateRequest,
    session: AsyncSession,
    current_user: User,
    services: ServiceContainer,
    endpoint_key: str,
    allow_reserved_metadata: bool,
) -> CivilizationResponse:
    metadata_patch = _normalize_metadata_patch(payload.metadata, allow_reserved=allow_reserved_metadata)
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
        deleted_asteroid = next(
            (civilization for civilization in execution.extinguished_asteroids if civilization.id == civilization_id),
            None,
        )
        if deleted_asteroid is None:
            raise HTTPException(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                detail="Extinguish result is inconsistent",
            )
        return civilization_to_response(deleted_asteroid)

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
async def ingest_asteroid(
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


@router.post("/asteroids/ingest", response_model=CivilizationResponse, status_code=status.HTTP_200_OK)
async def ingest_asteroid_alias(
    payload: CivilizationIngestRequest,
    session: AsyncSession = Depends(get_session),
    current_user: User = Depends(get_current_user),
    services: ServiceContainer = Depends(get_service_container),
) -> CivilizationResponse:
    return await ingest_asteroid(
        payload=payload,
        session=session,
        current_user=current_user,
        services=services,
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
    "/civilizations/{civilization_id}/raw-extinguish",
    response_model=CivilizationResponse,
    status_code=status.HTTP_200_OK,
)
async def raw_extinguish_civilization(
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
        endpoint_key="PATCH:/civilizations/{civilization_id}/raw-extinguish",
    )


@router.patch(
    "/asteroids/{asteroid_id}/extinguish",
    response_model=CivilizationResponse,
    status_code=status.HTTP_200_OK,
)
async def extinguish_asteroid_alias(
    asteroid_id: UUID,
    galaxy_id: UUID | None = Query(default=None),
    branch_id: UUID | None = Query(default=None),
    expected_event_seq: int | None = Query(default=None, ge=0),
    idempotency_key: str | None = Query(default=None),
    session: AsyncSession = Depends(get_session),
    current_user: User = Depends(get_current_user),
    services: ServiceContainer = Depends(get_service_container),
) -> CivilizationResponse:
    return await _extinguish_civilization_impl(
        civilization_id=asteroid_id,
        galaxy_id=galaxy_id,
        branch_id=branch_id,
        expected_event_seq=expected_event_seq,
        idempotency_key=idempotency_key,
        session=session,
        current_user=current_user,
        services=services,
        endpoint_key="PATCH:/asteroids/{asteroid_id}/extinguish",
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
        allow_reserved_metadata=False,
    )


@router.patch(
    "/civilizations/{civilization_id}/raw-mutate",
    response_model=CivilizationResponse,
    status_code=status.HTTP_200_OK,
)
async def raw_mutate_civilization(
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
        endpoint_key="PATCH:/civilizations/{civilization_id}/raw-mutate",
        allow_reserved_metadata=True,
    )


@router.patch(
    "/asteroids/{asteroid_id}/mutate",
    response_model=CivilizationResponse,
    status_code=status.HTTP_200_OK,
)
async def mutate_asteroid_alias(
    asteroid_id: UUID,
    payload: CivilizationMutateRequest,
    session: AsyncSession = Depends(get_session),
    current_user: User = Depends(get_current_user),
    services: ServiceContainer = Depends(get_service_container),
) -> CivilizationResponse:
    return await _mutate_civilization_impl(
        civilization_id=asteroid_id,
        payload=payload,
        session=session,
        current_user=current_user,
        services=services,
        endpoint_key="PATCH:/asteroids/{asteroid_id}/mutate",
        allow_reserved_metadata=True,
    )
