from __future__ import annotations

from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.runtime import commit_if_active, get_service_container, transactional_context
from app.app_factory import ServiceContainer
from app.db import get_read_session, get_session
from app.domains.galaxies.commands import (
    GalaxyCommandError,
    plan_update_onboarding,
    update_onboarding as update_onboarding_command,
)
from app.domains.galaxies.queries import (
    GalaxyQueryError,
    resolve_user_galaxy as resolve_user_galaxy_query,
)
from app.models import User
from app.modules.auth.dependencies import get_current_user
from app.schemas import OnboardingPublic, OnboardingUpdateRequest

router = APIRouter(tags=["galaxies"])


def _query_to_http_exception(exc: GalaxyQueryError) -> HTTPException:
    return HTTPException(status_code=exc.status_code, detail=exc.detail)


def _command_to_http_exception(exc: GalaxyCommandError) -> HTTPException:
    return HTTPException(status_code=exc.status_code, detail=exc.detail)


@router.get("/galaxies/{galaxy_id}/onboarding", response_model=OnboardingPublic, status_code=status.HTTP_200_OK)
async def get_galaxy_onboarding(
    galaxy_id: UUID,
    session: AsyncSession = Depends(get_read_session),
    current_user: User = Depends(get_current_user),
    services: ServiceContainer = Depends(get_service_container),
) -> OnboardingPublic:
    try:
        target_galaxy = await resolve_user_galaxy_query(
            session=session,
            services=services,
            user_id=current_user.id,
            galaxy_id=galaxy_id,
        )
    except GalaxyQueryError as exc:
        raise _query_to_http_exception(exc) from exc
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
    try:
        target_galaxy = await resolve_user_galaxy_query(
            session=session,
            services=services,
            user_id=current_user.id,
            galaxy_id=galaxy_id,
        )
    except GalaxyQueryError as exc:
        raise _query_to_http_exception(exc) from exc
    plan = plan_update_onboarding(
        action=payload.action.value,
        mode=payload.mode.value if payload.mode is not None else None,
        machine=payload.machine.model_dump(exclude_none=True) if payload.machine is not None else None,
    )
    normalized_payload = OnboardingUpdateRequest.model_validate(plan.request_payload)
    async with transactional_context(session):
        try:
            response = await update_onboarding_command(
                session=session,
                services=services,
                user_id=current_user.id,
                galaxy_id=target_galaxy.id,
                payload=normalized_payload,
            )
        except GalaxyCommandError as exc:
            raise _command_to_http_exception(exc) from exc
    await commit_if_active(session)
    return response
