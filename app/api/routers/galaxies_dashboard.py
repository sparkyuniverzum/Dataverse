from __future__ import annotations

from datetime import datetime
from uuid import UUID

from fastapi import APIRouter, Depends, Query, status
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.mappers.public import (
    bond_summary_to_public,
    constellation_summary_to_public,
    galaxy_activity_to_public,
    galaxy_health_to_public,
    galaxy_summary_to_public,
    moon_summary_to_public,
    planet_summary_to_public,
)
from app.api.runtime import get_service_container
from app.app_factory import ServiceContainer
from app.db import get_session
from app.models import User
from app.modules.auth.dependencies import get_current_user
from app.schemas import (
    BondSummaryResponse,
    ConstellationSummaryResponse,
    GalaxyActivityResponse,
    GalaxyHealthPublic,
    GalaxySummaryPublic,
    MoonSummaryResponse,
    PlanetSummaryResponse,
)

router = APIRouter(tags=["galaxies"])


async def _resolve_scope(
    *,
    session: AsyncSession,
    current_user: User,
    services: ServiceContainer,
    galaxy_id: UUID,
    branch_id: UUID | None = None,
) -> tuple[UUID, UUID | None]:
    target_galaxy = await services.auth_service.resolve_user_galaxy(
        session=session,
        user_id=current_user.id,
        galaxy_id=galaxy_id,
    )
    target_branch_id = await services.cosmos_service.resolve_branch_id(
        session=session,
        user_id=current_user.id,
        galaxy_id=target_galaxy.id,
        branch_id=branch_id,
    )
    return target_galaxy.id, target_branch_id


@router.get("/galaxies/{galaxy_id}/summary", response_model=GalaxySummaryPublic, status_code=status.HTTP_200_OK)
async def galaxy_summary(
    galaxy_id: UUID,
    session: AsyncSession = Depends(get_session),
    current_user: User = Depends(get_current_user),
    services: ServiceContainer = Depends(get_service_container),
) -> GalaxySummaryPublic:
    target_galaxy_id, _ = await _resolve_scope(
        session=session,
        current_user=current_user,
        services=services,
        galaxy_id=galaxy_id,
    )
    summary = await services.galaxy_dashboard_service.get_summary(
        session=session,
        user_id=current_user.id,
        galaxy_id=target_galaxy_id,
    )
    return galaxy_summary_to_public(summary)


@router.get("/galaxies/{galaxy_id}/health", response_model=GalaxyHealthPublic, status_code=status.HTTP_200_OK)
async def galaxy_health(
    galaxy_id: UUID,
    session: AsyncSession = Depends(get_session),
    current_user: User = Depends(get_current_user),
    services: ServiceContainer = Depends(get_service_container),
) -> GalaxyHealthPublic:
    target_galaxy_id, _ = await _resolve_scope(
        session=session,
        current_user=current_user,
        services=services,
        galaxy_id=galaxy_id,
    )
    health = await services.galaxy_dashboard_service.get_health(
        session=session,
        user_id=current_user.id,
        galaxy_id=target_galaxy_id,
    )
    return galaxy_health_to_public(health)


@router.get("/galaxies/{galaxy_id}/activity", response_model=GalaxyActivityResponse, status_code=status.HTTP_200_OK)
async def galaxy_activity(
    galaxy_id: UUID,
    limit: int = Query(default=40, ge=1, le=200),
    session: AsyncSession = Depends(get_session),
    current_user: User = Depends(get_current_user),
    services: ServiceContainer = Depends(get_service_container),
) -> GalaxyActivityResponse:
    target_galaxy_id, _ = await _resolve_scope(
        session=session,
        current_user=current_user,
        services=services,
        galaxy_id=galaxy_id,
    )
    items = await services.galaxy_dashboard_service.list_activity(
        session=session,
        user_id=current_user.id,
        galaxy_id=target_galaxy_id,
        limit=limit,
    )
    return GalaxyActivityResponse(items=[galaxy_activity_to_public(item) for item in items])


@router.get(
    "/galaxies/{galaxy_id}/constellations", response_model=ConstellationSummaryResponse, status_code=status.HTTP_200_OK
)
async def galaxy_constellations(
    galaxy_id: UUID,
    as_of: datetime | None = Query(default=None),
    branch_id: UUID | None = Query(default=None),
    session: AsyncSession = Depends(get_session),
    current_user: User = Depends(get_current_user),
    services: ServiceContainer = Depends(get_service_container),
) -> ConstellationSummaryResponse:
    target_galaxy_id, target_branch_id = await _resolve_scope(
        session=session,
        current_user=current_user,
        services=services,
        galaxy_id=galaxy_id,
        branch_id=branch_id,
    )
    rows = await services.constellation_dashboard_service.list_constellations(
        session=session,
        user_id=current_user.id,
        galaxy_id=target_galaxy_id,
        branch_id=target_branch_id,
        as_of=as_of,
    )
    return ConstellationSummaryResponse(items=[constellation_summary_to_public(item) for item in rows])


@router.get("/galaxies/{galaxy_id}/planets", response_model=PlanetSummaryResponse, status_code=status.HTTP_200_OK)
async def galaxy_planets(
    galaxy_id: UUID,
    as_of: datetime | None = Query(default=None),
    branch_id: UUID | None = Query(default=None),
    session: AsyncSession = Depends(get_session),
    current_user: User = Depends(get_current_user),
    services: ServiceContainer = Depends(get_service_container),
) -> PlanetSummaryResponse:
    target_galaxy_id, target_branch_id = await _resolve_scope(
        session=session,
        current_user=current_user,
        services=services,
        galaxy_id=galaxy_id,
        branch_id=branch_id,
    )
    rows = await services.planet_dashboard_service.list_planets(
        session=session,
        user_id=current_user.id,
        galaxy_id=target_galaxy_id,
        branch_id=target_branch_id,
        as_of=as_of,
    )
    return PlanetSummaryResponse(items=[planet_summary_to_public(item) for item in rows])


@router.get("/galaxies/{galaxy_id}/moons", response_model=MoonSummaryResponse, status_code=status.HTTP_200_OK)
async def galaxy_moons(
    galaxy_id: UUID,
    as_of: datetime | None = Query(default=None),
    branch_id: UUID | None = Query(default=None),
    session: AsyncSession = Depends(get_session),
    current_user: User = Depends(get_current_user),
    services: ServiceContainer = Depends(get_service_container),
) -> MoonSummaryResponse:
    target_galaxy_id, target_branch_id = await _resolve_scope(
        session=session,
        current_user=current_user,
        services=services,
        galaxy_id=galaxy_id,
        branch_id=branch_id,
    )
    rows = await services.moon_dashboard_service.list_moons(
        session=session,
        user_id=current_user.id,
        galaxy_id=target_galaxy_id,
        branch_id=target_branch_id,
        as_of=as_of,
    )
    return MoonSummaryResponse(items=[moon_summary_to_public(item) for item in rows])


@router.get("/galaxies/{galaxy_id}/bonds", response_model=BondSummaryResponse, status_code=status.HTTP_200_OK)
async def galaxy_bonds(
    galaxy_id: UUID,
    as_of: datetime | None = Query(default=None),
    branch_id: UUID | None = Query(default=None),
    session: AsyncSession = Depends(get_session),
    current_user: User = Depends(get_current_user),
    services: ServiceContainer = Depends(get_service_container),
) -> BondSummaryResponse:
    target_galaxy_id, target_branch_id = await _resolve_scope(
        session=session,
        current_user=current_user,
        services=services,
        galaxy_id=galaxy_id,
        branch_id=branch_id,
    )
    rows = await services.bond_dashboard_service.list_bonds(
        session=session,
        user_id=current_user.id,
        galaxy_id=target_galaxy_id,
        branch_id=target_branch_id,
        as_of=as_of,
    )
    return BondSummaryResponse(items=[bond_summary_to_public(item) for item in rows])
