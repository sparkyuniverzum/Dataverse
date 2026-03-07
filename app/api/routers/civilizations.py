from __future__ import annotations

from typing import Any
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.mappers.execution import civilization_to_response
from app.api.runtime import get_service_container, run_scoped_idempotent
from app.app_factory import ServiceContainer
from app.db import get_session
from app.models import User
from app.modules.auth.dependencies import get_current_user
from app.schemas import CivilizationIngestRequest, CivilizationMutateRequest, CivilizationResponse
from app.services.parser_service import AtomicTask

router = APIRouter(tags=["civilizations"])


@router.post("/civilizations/ingest", response_model=CivilizationResponse, status_code=status.HTTP_200_OK)
async def ingest_asteroid(
    payload: CivilizationIngestRequest,
    session: AsyncSession = Depends(get_session),
    current_user: User = Depends(get_current_user),
    services: ServiceContainer = Depends(get_service_container),
) -> CivilizationResponse:
    tasks = [AtomicTask(action="INGEST", params={"value": payload.value, "metadata": payload.metadata})]

    async def execute_scoped(target_galaxy_id: UUID, target_branch_id: UUID | None) -> CivilizationResponse:
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

    return await run_scoped_idempotent(
        session=session,
        current_user=current_user,
        services=services,
        galaxy_id=payload.galaxy_id,
        branch_id=payload.branch_id,
        endpoint_key="POST:/civilizations/ingest",
        idempotency_key=payload.idempotency_key,
        request_payload={"value": payload.value, "metadata": payload.metadata},
        execute=execute_scoped,
        replay_loader=CivilizationResponse.model_validate,
        response_dumper=lambda response: response.model_dump(mode="json"),
        empty_response_detail="Civilization ingest failed",
    )


@router.patch(
    "/civilizations/{civilization_id}/extinguish",
    response_model=CivilizationResponse,
    status_code=status.HTTP_200_OK,
)
async def extinguish_asteroid(
    civilization_id: UUID,
    galaxy_id: UUID | None = Query(default=None),
    branch_id: UUID | None = Query(default=None),
    expected_event_seq: int | None = Query(default=None, ge=0),
    idempotency_key: str | None = Query(default=None),
    session: AsyncSession = Depends(get_session),
    current_user: User = Depends(get_current_user),
    services: ServiceContainer = Depends(get_service_container),
) -> CivilizationResponse:
    params: dict[str, Any] = {"civilization_id": str(civilization_id)}
    if expected_event_seq is not None:
        params["expected_event_seq"] = expected_event_seq
    tasks = [AtomicTask(action="EXTINGUISH", params=params)]

    async def execute_scoped(target_galaxy_id: UUID, target_branch_id: UUID | None) -> CivilizationResponse:
        execution = await services.task_executor_service.execute_tasks(
            session=session,
            tasks=tasks,
            user_id=current_user.id,
            galaxy_id=target_galaxy_id,
            branch_id=target_branch_id,
            manage_transaction=False,
        )
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

    return await run_scoped_idempotent(
        session=session,
        current_user=current_user,
        services=services,
        galaxy_id=galaxy_id,
        branch_id=branch_id,
        endpoint_key="PATCH:/civilizations/{civilization_id}/extinguish",
        idempotency_key=idempotency_key,
        request_payload={"civilization_id": str(civilization_id), "expected_event_seq": expected_event_seq},
        execute=execute_scoped,
        replay_loader=CivilizationResponse.model_validate,
        response_dumper=lambda response: response.model_dump(mode="json"),
        empty_response_detail="Civilization not found",
        empty_response_status=status.HTTP_404_NOT_FOUND,
    )


@router.patch(
    "/civilizations/{civilization_id}/mutate",
    response_model=CivilizationResponse,
    status_code=status.HTTP_200_OK,
)
async def mutate_asteroid(
    civilization_id: UUID,
    payload: CivilizationMutateRequest,
    session: AsyncSession = Depends(get_session),
    current_user: User = Depends(get_current_user),
    services: ServiceContainer = Depends(get_service_container),
) -> CivilizationResponse:
    params: dict[str, Any] = {"civilization_id": str(civilization_id)}
    if payload.value is not None:
        params["value"] = payload.value
    if payload.metadata:
        params["metadata"] = payload.metadata
    if payload.expected_event_seq is not None:
        params["expected_event_seq"] = payload.expected_event_seq

    tasks = [AtomicTask(action="UPDATE_ASTEROID", params=params)]

    async def execute_scoped(target_galaxy_id: UUID, target_branch_id: UUID | None) -> CivilizationResponse:
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
        mutated = next((c for c in execution.civilizations if c.id == civilization_id), execution.civilizations[0])
        return civilization_to_response(mutated)

    return await run_scoped_idempotent(
        session=session,
        current_user=current_user,
        services=services,
        galaxy_id=payload.galaxy_id,
        branch_id=payload.branch_id,
        endpoint_key="PATCH:/civilizations/{civilization_id}/mutate",
        idempotency_key=payload.idempotency_key,
        request_payload={
            "civilization_id": str(civilization_id),
            "value": payload.value,
            "metadata": payload.metadata,
            "expected_event_seq": payload.expected_event_seq,
        },
        execute=execute_scoped,
        replay_loader=CivilizationResponse.model_validate,
        response_dumper=lambda response: response.model_dump(mode="json"),
        empty_response_detail="Civilization not found",
        empty_response_status=status.HTTP_404_NOT_FOUND,
    )
