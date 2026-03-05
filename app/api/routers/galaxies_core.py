from __future__ import annotations

from uuid import UUID

from fastapi import APIRouter, Depends, status
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.mappers.public import galaxy_to_public
from app.api.runtime import commit_if_active, get_service_container, transactional_context
from app.app_factory import ServiceContainer
from app.db import get_session
from app.models import User
from app.modules.auth.dependencies import get_current_user
from app.schemas import GalaxyCreateRequest, GalaxyPublic

router = APIRouter(tags=["galaxies"])


@router.get("/galaxies", response_model=list[GalaxyPublic], status_code=status.HTTP_200_OK)
async def list_galaxies(
    session: AsyncSession = Depends(get_session),
    current_user: User = Depends(get_current_user),
    services: ServiceContainer = Depends(get_service_container),
) -> list[GalaxyPublic]:
    galaxies = await services.auth_service.list_galaxies(session=session, user_id=current_user.id)
    return [galaxy_to_public(galaxy) for galaxy in galaxies]


@router.post("/galaxies", response_model=GalaxyPublic, status_code=status.HTTP_201_CREATED)
async def create_galaxy(
    payload: GalaxyCreateRequest,
    session: AsyncSession = Depends(get_session),
    current_user: User = Depends(get_current_user),
    services: ServiceContainer = Depends(get_service_container),
) -> GalaxyPublic:
    async with transactional_context(session):
        galaxy = await services.auth_service.create_galaxy(
            session=session,
            user_id=current_user.id,
            name=payload.name,
        )
        await services.onboarding_service.ensure_progress(
            session=session,
            user_id=current_user.id,
            galaxy_id=galaxy.id,
        )
    await commit_if_active(session)
    return galaxy_to_public(galaxy)


@router.patch("/galaxies/{galaxy_id}/extinguish", response_model=GalaxyPublic, status_code=status.HTTP_200_OK)
async def extinguish_galaxy(
    galaxy_id: UUID,
    session: AsyncSession = Depends(get_session),
    current_user: User = Depends(get_current_user),
    services: ServiceContainer = Depends(get_service_container),
) -> GalaxyPublic:
    async with transactional_context(session):
        galaxy = await services.auth_service.soft_delete_galaxy(
            session=session,
            user_id=current_user.id,
            galaxy_id=galaxy_id,
        )
    await commit_if_active(session)
    return galaxy_to_public(galaxy)
