from __future__ import annotations

from typing import Any
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.mappers.execution import asteroid_to_response
from app.api.runtime import get_service_container, run_scoped_idempotent
from app.app_factory import ServiceContainer
from app.db import get_session
from app.models import User
from app.schemas import AsteroidIngestRequest, AsteroidMutateRequest, AsteroidResponse
from app.modules.auth.dependencies import get_current_user
from app.services.parser_service import AtomicTask

router = APIRouter(tags=["asteroids"])


@router.post("/asteroids/ingest", response_model=AsteroidResponse, status_code=status.HTTP_200_OK)
async def ingest_asteroid(
    payload: AsteroidIngestRequest,
    session: AsyncSession = Depends(get_session),
    current_user: User = Depends(get_current_user),
    services: ServiceContainer = Depends(get_service_container),
) -> AsteroidResponse:
    tasks = [AtomicTask(action="INGEST", params={"value": payload.value, "metadata": payload.metadata})]

    async def execute_scoped(target_galaxy_id: UUID, target_branch_id: UUID | None) -> AsteroidResponse:
        execution = await services.task_executor_service.execute_tasks(
            session=session,
            tasks=tasks,
            user_id=current_user.id,
            galaxy_id=target_galaxy_id,
            branch_id=target_branch_id,
            manage_transaction=False,
        )
        if not execution.asteroids:
            raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail="Asteroid ingest failed")
        return asteroid_to_response(execution.asteroids[0])

    return await run_scoped_idempotent(
        session=session,
        current_user=current_user,
        services=services,
        galaxy_id=payload.galaxy_id,
        branch_id=payload.branch_id,
        endpoint_key="POST:/asteroids/ingest",
        idempotency_key=payload.idempotency_key,
        request_payload={"value": payload.value, "metadata": payload.metadata},
        execute=execute_scoped,
        replay_loader=AsteroidResponse.model_validate,
        response_dumper=lambda response: response.model_dump(mode="json"),
        empty_response_detail="Asteroid ingest failed",
    )


@router.patch("/asteroids/{asteroid_id}/extinguish", response_model=AsteroidResponse, status_code=status.HTTP_200_OK)
async def extinguish_asteroid(
    asteroid_id: UUID,
    galaxy_id: UUID | None = Query(default=None),
    branch_id: UUID | None = Query(default=None),
    expected_event_seq: int | None = Query(default=None, ge=0),
    idempotency_key: str | None = Query(default=None),
    session: AsyncSession = Depends(get_session),
    current_user: User = Depends(get_current_user),
    services: ServiceContainer = Depends(get_service_container),
) -> AsteroidResponse:
    params: dict[str, Any] = {"asteroid_id": str(asteroid_id)}
    if expected_event_seq is not None:
        params["expected_event_seq"] = expected_event_seq
    tasks = [AtomicTask(action="EXTINGUISH", params=params)]

    async def execute_scoped(target_galaxy_id: UUID, target_branch_id: UUID | None) -> AsteroidResponse:
        execution = await services.task_executor_service.execute_tasks(
            session=session,
            tasks=tasks,
            user_id=current_user.id,
            galaxy_id=target_galaxy_id,
            branch_id=target_branch_id,
            manage_transaction=False,
        )
        if asteroid_id not in execution.extinguished_asteroid_ids:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Asteroid not found")
        deleted_asteroid = next(
            (asteroid for asteroid in execution.extinguished_asteroids if asteroid.id == asteroid_id),
            None,
        )
        if deleted_asteroid is None:
            raise HTTPException(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                detail="Extinguish result is inconsistent",
            )
        return asteroid_to_response(deleted_asteroid)

    return await run_scoped_idempotent(
        session=session,
        current_user=current_user,
        services=services,
        galaxy_id=galaxy_id,
        branch_id=branch_id,
        endpoint_key="PATCH:/asteroids/{asteroid_id}/extinguish",
        idempotency_key=idempotency_key,
        request_payload={"asteroid_id": str(asteroid_id), "expected_event_seq": expected_event_seq},
        execute=execute_scoped,
        replay_loader=AsteroidResponse.model_validate,
        response_dumper=lambda response: response.model_dump(mode="json"),
        empty_response_detail="Asteroid not found",
        empty_response_status=status.HTTP_404_NOT_FOUND,
    )


@router.patch("/asteroids/{asteroid_id}/mutate", response_model=AsteroidResponse, status_code=status.HTTP_200_OK)
async def mutate_asteroid(
    asteroid_id: UUID,
    payload: AsteroidMutateRequest,
    session: AsyncSession = Depends(get_session),
    current_user: User = Depends(get_current_user),
    services: ServiceContainer = Depends(get_service_container),
) -> AsteroidResponse:
    params: dict[str, Any] = {"asteroid_id": str(asteroid_id)}
    if payload.value is not None:
        params["value"] = payload.value
    if payload.metadata:
        params["metadata"] = payload.metadata
    if payload.expected_event_seq is not None:
        params["expected_event_seq"] = payload.expected_event_seq

    tasks = [AtomicTask(action="UPDATE_ASTEROID", params=params)]

    async def execute_scoped(target_galaxy_id: UUID, target_branch_id: UUID | None) -> AsteroidResponse:
        execution = await services.task_executor_service.execute_tasks(
            session=session,
            tasks=tasks,
            user_id=current_user.id,
            galaxy_id=target_galaxy_id,
            branch_id=target_branch_id,
            manage_transaction=False,
        )
        if not execution.asteroids:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Asteroid not found")
        mutated = next((asteroid for asteroid in execution.asteroids if asteroid.id == asteroid_id), execution.asteroids[0])
        return asteroid_to_response(mutated)

    return await run_scoped_idempotent(
        session=session,
        current_user=current_user,
        services=services,
        galaxy_id=payload.galaxy_id,
        branch_id=payload.branch_id,
        endpoint_key="PATCH:/asteroids/{asteroid_id}/mutate",
        idempotency_key=payload.idempotency_key,
        request_payload={
            "asteroid_id": str(asteroid_id),
            "value": payload.value,
            "metadata": payload.metadata,
            "expected_event_seq": payload.expected_event_seq,
        },
        execute=execute_scoped,
        replay_loader=AsteroidResponse.model_validate,
        response_dumper=lambda response: response.model_dump(mode="json"),
        empty_response_detail="Asteroid not found",
        empty_response_status=status.HTTP_404_NOT_FOUND,
    )
