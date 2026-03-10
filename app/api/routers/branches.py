from __future__ import annotations

from uuid import UUID

from fastapi import APIRouter, Depends, Query, status
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.mappers.public import branch_to_public
from app.api.runtime import commit_if_active, get_service_container, transactional_context
from app.app_factory import ServiceContainer
from app.db import get_read_session, get_session
from app.models import User
from app.modules.auth.dependencies import get_current_user
from app.schemas import BranchCreateRequest, BranchPromoteResponse, BranchPublic

router = APIRouter(tags=["branches"])


@router.get("/branches", response_model=list[BranchPublic], status_code=status.HTTP_200_OK)
async def list_branches(
    galaxy_id: UUID | None = Query(default=None),
    session: AsyncSession = Depends(get_read_session),
    current_user: User = Depends(get_current_user),
    services: ServiceContainer = Depends(get_service_container),
) -> list[BranchPublic]:
    branches = await services.cosmos_service.list_branches(
        session=session,
        user_id=current_user.id,
        galaxy_id=galaxy_id,
    )
    return [branch_to_public(branch) for branch in branches]


@router.post("/branches", response_model=BranchPublic, status_code=status.HTTP_201_CREATED)
async def create_branch(
    payload: BranchCreateRequest,
    session: AsyncSession = Depends(get_session),
    current_user: User = Depends(get_current_user),
    services: ServiceContainer = Depends(get_service_container),
) -> BranchPublic:
    async with transactional_context(session):
        branch = await services.cosmos_service.create_branch(
            session=session,
            user_id=current_user.id,
            galaxy_id=payload.galaxy_id,
            name=payload.name,
            as_of=payload.as_of,
        )
    await commit_if_active(session)
    return branch_to_public(branch)


@router.post("/branches/{branch_id}/promote", response_model=BranchPromoteResponse, status_code=status.HTTP_200_OK)
async def promote_branch(
    branch_id: UUID,
    galaxy_id: UUID | None = Query(default=None),
    session: AsyncSession = Depends(get_session),
    current_user: User = Depends(get_current_user),
    services: ServiceContainer = Depends(get_service_container),
) -> BranchPromoteResponse:
    async with transactional_context(session):
        branch, promoted_events_count = await services.cosmos_service.promote_branch(
            session=session,
            user_id=current_user.id,
            galaxy_id=galaxy_id,
            branch_id=branch_id,
        )
    await commit_if_active(session)
    return BranchPromoteResponse(branch=branch_to_public(branch), promoted_events_count=promoted_events_count)
