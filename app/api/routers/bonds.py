from __future__ import annotations

from typing import Any
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.mappers.execution import bond_to_response
from app.api.runtime import get_service_container, run_scoped_idempotent
from app.app_factory import ServiceContainer
from app.db import get_session
from app.models import User
from app.modules.auth.dependencies import get_current_user
from app.schemas import BondCreateRequest, BondMutateRequest, BondResponse
from app.services.parser_service import AtomicTask

router = APIRouter(tags=["bonds"])


@router.post("/bonds/link", response_model=BondResponse, status_code=status.HTTP_200_OK)
async def link_bond(
    payload: BondCreateRequest,
    session: AsyncSession = Depends(get_session),
    current_user: User = Depends(get_current_user),
    services: ServiceContainer = Depends(get_service_container),
) -> BondResponse:
    tasks = [
        AtomicTask(
            action="LINK",
            params={
                "source_id": str(payload.source_id),
                "target_id": str(payload.target_id),
                "type": payload.type,
                **(
                    {"expected_source_event_seq": payload.expected_source_event_seq}
                    if payload.expected_source_event_seq is not None
                    else {}
                ),
                **(
                    {"expected_target_event_seq": payload.expected_target_event_seq}
                    if payload.expected_target_event_seq is not None
                    else {}
                ),
            },
        )
    ]

    async def execute_scoped(target_galaxy_id: UUID, target_branch_id: UUID | None) -> BondResponse:
        execution = await services.task_executor_service.execute_tasks(
            session=session,
            tasks=tasks,
            user_id=current_user.id,
            galaxy_id=target_galaxy_id,
            branch_id=target_branch_id,
            manage_transaction=False,
        )
        if not execution.bonds:
            raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail="Bond link failed")
        return bond_to_response(execution.bonds[0])

    return await run_scoped_idempotent(
        session=session,
        current_user=current_user,
        services=services,
        galaxy_id=payload.galaxy_id,
        branch_id=payload.branch_id,
        endpoint_key="POST:/bonds/link",
        idempotency_key=payload.idempotency_key,
        request_payload={
            "source_id": str(payload.source_id),
            "target_id": str(payload.target_id),
            "type": payload.type,
            "expected_source_event_seq": payload.expected_source_event_seq,
            "expected_target_event_seq": payload.expected_target_event_seq,
        },
        execute=execute_scoped,
        replay_loader=BondResponse.model_validate,
        response_dumper=lambda response: response.model_dump(mode="json"),
        empty_response_detail="Bond link failed",
    )


@router.patch("/bonds/{bond_id}/mutate", response_model=BondResponse, status_code=status.HTTP_200_OK)
async def mutate_bond(
    bond_id: UUID,
    payload: BondMutateRequest,
    session: AsyncSession = Depends(get_session),
    current_user: User = Depends(get_current_user),
    services: ServiceContainer = Depends(get_service_container),
) -> BondResponse:
    tasks = [
        AtomicTask(
            action="UPDATE_BOND",
            params={
                "bond_id": str(bond_id),
                "type": payload.type,
                **(
                    {"expected_event_seq": payload.expected_event_seq} if payload.expected_event_seq is not None else {}
                ),
            },
        )
    ]

    async def execute_scoped(target_galaxy_id: UUID, target_branch_id: UUID | None) -> BondResponse:
        execution = await services.task_executor_service.execute_tasks(
            session=session,
            tasks=tasks,
            user_id=current_user.id,
            galaxy_id=target_galaxy_id,
            branch_id=target_branch_id,
            manage_transaction=False,
        )
        if not execution.bonds:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Bond not found")
        return bond_to_response(execution.bonds[-1])

    return await run_scoped_idempotent(
        session=session,
        current_user=current_user,
        services=services,
        galaxy_id=payload.galaxy_id,
        branch_id=payload.branch_id,
        endpoint_key="PATCH:/bonds/{bond_id}/mutate",
        idempotency_key=payload.idempotency_key,
        request_payload={
            "bond_id": str(bond_id),
            "type": payload.type,
            "expected_event_seq": payload.expected_event_seq,
        },
        execute=execute_scoped,
        replay_loader=BondResponse.model_validate,
        response_dumper=lambda response: response.model_dump(mode="json"),
        empty_response_detail="Bond not found",
        empty_response_status=status.HTTP_404_NOT_FOUND,
    )


@router.patch("/bonds/{bond_id}/extinguish", response_model=BondResponse, status_code=status.HTTP_200_OK)
async def extinguish_bond(
    bond_id: UUID,
    galaxy_id: UUID | None = Query(default=None),
    branch_id: UUID | None = Query(default=None),
    expected_event_seq: int | None = Query(default=None, ge=0),
    idempotency_key: str | None = Query(default=None),
    session: AsyncSession = Depends(get_session),
    current_user: User = Depends(get_current_user),
    services: ServiceContainer = Depends(get_service_container),
) -> BondResponse:
    params: dict[str, Any] = {"bond_id": str(bond_id)}
    if expected_event_seq is not None:
        params["expected_event_seq"] = expected_event_seq
    tasks = [AtomicTask(action="EXTINGUISH_BOND", params=params)]

    async def execute_scoped(target_galaxy_id: UUID, target_branch_id: UUID | None) -> BondResponse:
        execution = await services.task_executor_service.execute_tasks(
            session=session,
            tasks=tasks,
            user_id=current_user.id,
            galaxy_id=target_galaxy_id,
            branch_id=target_branch_id,
            manage_transaction=False,
        )
        if not execution.bonds:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Bond not found")
        return bond_to_response(execution.bonds[0])

    return await run_scoped_idempotent(
        session=session,
        current_user=current_user,
        services=services,
        galaxy_id=galaxy_id,
        branch_id=branch_id,
        endpoint_key="PATCH:/bonds/{bond_id}/extinguish",
        idempotency_key=idempotency_key,
        request_payload={"bond_id": str(bond_id), "expected_event_seq": expected_event_seq},
        execute=execute_scoped,
        replay_loader=BondResponse.model_validate,
        response_dumper=lambda response: response.model_dump(mode="json"),
        empty_response_detail="Bond not found",
        empty_response_status=status.HTTP_404_NOT_FOUND,
    )
