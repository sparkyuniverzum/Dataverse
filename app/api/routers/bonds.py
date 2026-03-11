from __future__ import annotations

from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.mappers.execution import bond_to_response
from app.api.runtime import (
    get_service_container,
    resolve_scope_for_user,
    run_scoped_atomic_idempotent,
)
from app.app_factory import ServiceContainer
from app.db import get_session
from app.domains.bonds.commands import (
    pick_extinguished_bond,
    pick_linked_bond,
    pick_mutated_bond,
    plan_extinguish_bond,
    plan_link_bond,
    plan_mutate_bond,
)
from app.domains.bonds.queries import validate_bond_request
from app.models import User
from app.modules.auth.dependencies import get_current_user
from app.schemas import (
    BondCreateRequest,
    BondMutateRequest,
    BondResponse,
    BondValidateRequest,
    BondValidateResponse,
)

router = APIRouter(tags=["bonds"])


@router.post("/bonds/validate", response_model=BondValidateResponse, status_code=status.HTTP_200_OK)
async def validate_bond(
    payload: BondValidateRequest,
    session: AsyncSession = Depends(get_session),
    current_user: User = Depends(get_current_user),
    services: ServiceContainer = Depends(get_service_container),
) -> BondValidateResponse:
    resolved_galaxy_id, resolved_branch_id = await resolve_scope_for_user(
        session=session,
        user=current_user,
        galaxy_id=payload.galaxy_id,
        branch_id=payload.branch_id,
        services=services,
    )
    return await validate_bond_request(
        session=session,
        services=services,
        user_id=current_user.id,
        galaxy_id=resolved_galaxy_id,
        branch_id=resolved_branch_id,
        payload=payload,
    )


@router.post("/bonds/link", response_model=BondResponse, status_code=status.HTTP_200_OK)
async def link_bond(
    payload: BondCreateRequest,
    session: AsyncSession = Depends(get_session),
    current_user: User = Depends(get_current_user),
    services: ServiceContainer = Depends(get_service_container),
) -> BondResponse:
    plan = plan_link_bond(
        source_civilization_id=payload.source_civilization_id,
        target_civilization_id=payload.target_civilization_id,
        bond_type=payload.type,
        expected_source_event_seq=payload.expected_source_event_seq,
        expected_target_event_seq=payload.expected_target_event_seq,
    )

    def map_execution(execution) -> BondResponse:
        linked = pick_linked_bond(execution=execution)
        if linked is None:
            raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail="Bond link failed")
        return bond_to_response(linked)

    return await run_scoped_atomic_idempotent(
        session=session,
        current_user=current_user,
        services=services,
        tasks=plan.tasks,
        galaxy_id=payload.galaxy_id,
        branch_id=payload.branch_id,
        endpoint_key="POST:/bonds/link",
        idempotency_key=payload.idempotency_key,
        request_payload=plan.request_payload,
        map_execution=map_execution,
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
    plan = plan_mutate_bond(
        bond_id=bond_id,
        bond_type=payload.type,
        expected_event_seq=payload.expected_event_seq,
    )

    def map_execution(execution) -> BondResponse:
        mutated = pick_mutated_bond(execution=execution)
        if mutated is None:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Bond not found")
        return bond_to_response(mutated)

    return await run_scoped_atomic_idempotent(
        session=session,
        current_user=current_user,
        services=services,
        tasks=plan.tasks,
        galaxy_id=payload.galaxy_id,
        branch_id=payload.branch_id,
        endpoint_key="PATCH:/bonds/{bond_id}/mutate",
        idempotency_key=payload.idempotency_key,
        request_payload=plan.request_payload,
        map_execution=map_execution,
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
    plan = plan_extinguish_bond(
        bond_id=bond_id,
        expected_event_seq=expected_event_seq,
    )

    def map_execution(execution) -> BondResponse:
        extinguished = pick_extinguished_bond(execution=execution)
        if extinguished is None:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Bond not found")
        return bond_to_response(extinguished)

    return await run_scoped_atomic_idempotent(
        session=session,
        current_user=current_user,
        services=services,
        tasks=plan.tasks,
        galaxy_id=galaxy_id,
        branch_id=branch_id,
        endpoint_key="PATCH:/bonds/{bond_id}/extinguish",
        idempotency_key=idempotency_key,
        request_payload=plan.request_payload,
        map_execution=map_execution,
        replay_loader=BondResponse.model_validate,
        response_dumper=lambda response: response.model_dump(mode="json"),
        empty_response_detail="Bond not found",
        empty_response_status=status.HTTP_404_NOT_FOUND,
    )
