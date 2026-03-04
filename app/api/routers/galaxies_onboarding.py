from __future__ import annotations

from uuid import UUID

from fastapi import APIRouter, Depends, status
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.runtime import commit_if_active, get_service_container, transactional_context
from app.app_factory import ServiceContainer
from app.db import get_session
from app.models import User
from app.schemas import OnboardingPublic, OnboardingUpdateRequest
from app.modules.auth.dependencies import get_current_user

router = APIRouter(tags=["galaxies"])


@router.get("/galaxies/{galaxy_id}/onboarding", response_model=OnboardingPublic, status_code=status.HTTP_200_OK)
async def get_galaxy_onboarding(
    galaxy_id: UUID,
    session: AsyncSession = Depends(get_session),
    current_user: User = Depends(get_current_user),
    services: ServiceContainer = Depends(get_service_container),
) -> OnboardingPublic:
    target_galaxy = await services.auth_service.resolve_user_galaxy(
        session=session,
        user_id=current_user.id,
        galaxy_id=galaxy_id,
    )
    return await services.onboarding_service.get_public(
        session=session,
        user_id=current_user.id,
        galaxy_id=target_galaxy.id,
    )


@router.patch("/galaxies/{galaxy_id}/onboarding", response_model=OnboardingPublic, status_code=status.HTTP_200_OK)
async def update_galaxy_onboarding(
    galaxy_id: UUID,
    payload: OnboardingUpdateRequest,
    session: AsyncSession = Depends(get_session),
    current_user: User = Depends(get_current_user),
    services: ServiceContainer = Depends(get_service_container),
) -> OnboardingPublic:
    target_galaxy = await services.auth_service.resolve_user_galaxy(
        session=session,
        user_id=current_user.id,
        galaxy_id=galaxy_id,
    )
    async with transactional_context(session):
        response = await services.onboarding_service.update_public(
            session=session,
            user_id=current_user.id,
            galaxy_id=target_galaxy.id,
            payload=payload,
        )
    await commit_if_active(session)
    return response
