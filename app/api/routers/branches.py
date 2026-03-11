from __future__ import annotations

from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.mappers.public import branch_to_public
from app.api.runtime import get_service_container, run_scoped_idempotent
from app.app_factory import ServiceContainer
from app.db import get_read_session, get_session
from app.domains.branches.commands import (
    BranchCommandError,
    close_branch as close_branch_command,
    create_branch as create_branch_command,
    plan_close_branch,
    plan_create_branch,
    plan_promote_branch,
    promote_branch as promote_branch_command,
)
from app.domains.branches.queries import (
    BranchQueryError,
    list_branches as list_branches_query,
)
from app.models import User
from app.modules.auth.dependencies import get_current_user
from app.schemas import BranchCloseResponse, BranchCreateRequest, BranchPromoteResponse, BranchPublic

router = APIRouter(tags=["branches"])


def _query_to_http_exception(exc: BranchQueryError) -> HTTPException:
    return HTTPException(status_code=exc.status_code, detail=exc.detail)


def _command_to_http_exception(exc: BranchCommandError) -> HTTPException:
    return HTTPException(status_code=exc.status_code, detail=exc.detail)


def _planned_galaxy_id(raw: str | None) -> UUID | None:
    if raw is None:
        return None
    return UUID(str(raw))


@router.get("/branches", response_model=list[BranchPublic], status_code=status.HTTP_200_OK)
async def list_branches(
    galaxy_id: UUID | None = Query(default=None),
    session: AsyncSession = Depends(get_read_session),
    current_user: User = Depends(get_current_user),
    services: ServiceContainer = Depends(get_service_container),
) -> list[BranchPublic]:
    try:
        branches = await list_branches_query(
            session=session,
            services=services,
            user_id=current_user.id,
            galaxy_id=galaxy_id,
        )
    except BranchQueryError as exc:
        raise _query_to_http_exception(exc) from exc
    return [branch_to_public(branch) for branch in branches]


@router.post("/branches", response_model=BranchPublic, status_code=status.HTTP_201_CREATED)
async def create_branch(
    payload: BranchCreateRequest,
    session: AsyncSession = Depends(get_session),
    current_user: User = Depends(get_current_user),
    services: ServiceContainer = Depends(get_service_container),
) -> BranchPublic:
    plan = plan_create_branch(
        galaxy_id=payload.galaxy_id,
        name=payload.name,
        as_of=payload.as_of,
    )

    async def execute_scoped(target_galaxy_id: UUID, _: UUID | None) -> BranchPublic:
        try:
            branch = await create_branch_command(
                session=session,
                services=services,
                user_id=current_user.id,
                galaxy_id=target_galaxy_id,
                name=str(plan.request_payload["name"]),
                as_of=plan.request_payload["as_of"],
            )
        except BranchCommandError as exc:
            raise _command_to_http_exception(exc) from exc
        return branch_to_public(branch)

    planned_galaxy_id = _planned_galaxy_id(plan.request_payload.get("galaxy_id"))
    return await run_scoped_idempotent(
        session=session,
        current_user=current_user,
        services=services,
        galaxy_id=planned_galaxy_id,
        branch_id=None,
        endpoint_key="POST:/branches",
        idempotency_key=payload.idempotency_key,
        request_payload=plan.request_payload,
        execute=execute_scoped,
        replay_loader=BranchPublic.model_validate,
        response_dumper=lambda response: response.model_dump(mode="json"),
        empty_response_detail="Branch create returned empty response",
    )


@router.post("/branches/{branch_id}/promote", response_model=BranchPromoteResponse, status_code=status.HTTP_200_OK)
async def promote_branch(
    branch_id: UUID,
    galaxy_id: UUID | None = Query(default=None),
    idempotency_key: str | None = Query(default=None),
    session: AsyncSession = Depends(get_session),
    current_user: User = Depends(get_current_user),
    services: ServiceContainer = Depends(get_service_container),
) -> BranchPromoteResponse:
    plan = plan_promote_branch(branch_id=branch_id, galaxy_id=galaxy_id)

    async def execute_scoped(target_galaxy_id: UUID, _: UUID | None) -> BranchPromoteResponse:
        try:
            branch, promoted_events_count = await promote_branch_command(
                session=session,
                services=services,
                user_id=current_user.id,
                galaxy_id=target_galaxy_id,
                branch_id=branch_id,
            )
        except BranchCommandError as exc:
            raise _command_to_http_exception(exc) from exc
        return BranchPromoteResponse(branch=branch_to_public(branch), promoted_events_count=promoted_events_count)

    planned_galaxy_id = _planned_galaxy_id(plan.request_payload.get("galaxy_id"))
    return await run_scoped_idempotent(
        session=session,
        current_user=current_user,
        services=services,
        galaxy_id=planned_galaxy_id,
        branch_id=None,
        endpoint_key="POST:/branches/{branch_id}/promote",
        idempotency_key=idempotency_key,
        request_payload=plan.request_payload,
        execute=execute_scoped,
        replay_loader=BranchPromoteResponse.model_validate,
        response_dumper=lambda response: response.model_dump(mode="json"),
        empty_response_detail="Branch promote returned empty response",
    )


@router.post("/branches/{branch_id}/close", response_model=BranchCloseResponse, status_code=status.HTTP_200_OK)
async def close_branch(
    branch_id: UUID,
    galaxy_id: UUID | None = Query(default=None),
    idempotency_key: str | None = Query(default=None),
    session: AsyncSession = Depends(get_session),
    current_user: User = Depends(get_current_user),
    services: ServiceContainer = Depends(get_service_container),
) -> BranchCloseResponse:
    plan = plan_close_branch(branch_id=branch_id, galaxy_id=galaxy_id)

    async def execute_scoped(target_galaxy_id: UUID, _: UUID | None) -> BranchCloseResponse:
        try:
            branch = await close_branch_command(
                session=session,
                services=services,
                user_id=current_user.id,
                galaxy_id=target_galaxy_id,
                branch_id=branch_id,
            )
        except BranchCommandError as exc:
            raise _command_to_http_exception(exc) from exc
        return BranchCloseResponse(branch=branch_to_public(branch))

    planned_galaxy_id = _planned_galaxy_id(plan.request_payload.get("galaxy_id"))
    return await run_scoped_idempotent(
        session=session,
        current_user=current_user,
        services=services,
        galaxy_id=planned_galaxy_id,
        branch_id=None,
        endpoint_key="POST:/branches/{branch_id}/close",
        idempotency_key=idempotency_key,
        request_payload=plan.request_payload,
        execute=execute_scoped,
        replay_loader=BranchCloseResponse.model_validate,
        response_dumper=lambda response: response.model_dump(mode="json"),
        empty_response_detail="Branch close returned empty response",
    )
