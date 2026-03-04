from __future__ import annotations

from datetime import datetime
from typing import Any
from uuid import UUID

from fastapi import APIRouter, Depends, Query, status
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.mappers.execution import universe_asteroid_to_snapshot, universe_bond_to_snapshot
from app.api.runtime import get_service_container, resolve_branch_id_for_user, resolve_galaxy_id_for_user
from app.app_factory import ServiceContainer
from app.db import get_session
from app.models import User
from app.schemas import UniverseSnapshotResponse, UniverseTablesResponse
from app.modules.auth.dependencies import get_current_user
from app.services.universe_service import split_constellation_and_planet_name

router = APIRouter(tags=["universe"])


@router.get("/universe/snapshot", response_model=UniverseSnapshotResponse, status_code=status.HTTP_200_OK)
async def universe_snapshot(
    as_of: datetime | None = None,
    galaxy_id: UUID | None = Query(default=None),
    branch_id: UUID | None = Query(default=None),
    session: AsyncSession = Depends(get_session),
    current_user: User = Depends(get_current_user),
    services: ServiceContainer = Depends(get_service_container),
) -> UniverseSnapshotResponse:
    target_galaxy_id = await resolve_galaxy_id_for_user(
        session=session,
        user=current_user,
        galaxy_id=galaxy_id,
        services=services,
    )
    target_branch_id = await resolve_branch_id_for_user(
        session=session,
        user=current_user,
        galaxy_id=target_galaxy_id,
        branch_id=branch_id,
        services=services,
    )
    active_asteroids, active_bonds = await services.universe_service.snapshot(
        session=session,
        user_id=current_user.id,
        galaxy_id=target_galaxy_id,
        branch_id=target_branch_id,
        as_of=as_of,
    )

    asteroid_snapshots = [
        universe_asteroid_to_snapshot(asteroid, galaxy_id=target_galaxy_id)
        for asteroid in active_asteroids
    ]
    table_index: dict[UUID, tuple[UUID, str, str, str]] = {
        asteroid.id: (
            asteroid.table_id,
            asteroid.table_name,
            asteroid.constellation_name,
            asteroid.planet_name,
        )
        for asteroid in asteroid_snapshots
    }

    return UniverseSnapshotResponse(
        asteroids=asteroid_snapshots,
        bonds=[
            universe_bond_to_snapshot(
                bond,
                asteroid_table_index=table_index,
            )
            for bond in active_bonds
        ],
    )


@router.get("/universe/tables", response_model=UniverseTablesResponse, status_code=status.HTTP_200_OK)
async def universe_tables(
    as_of: datetime | None = None,
    galaxy_id: UUID | None = Query(default=None),
    branch_id: UUID | None = Query(default=None),
    session: AsyncSession = Depends(get_session),
    current_user: User = Depends(get_current_user),
    services: ServiceContainer = Depends(get_service_container),
) -> UniverseTablesResponse:
    target_galaxy_id = await resolve_galaxy_id_for_user(
        session=session,
        user=current_user,
        galaxy_id=galaxy_id,
        services=services,
    )
    target_branch_id = await resolve_branch_id_for_user(
        session=session,
        user=current_user,
        galaxy_id=target_galaxy_id,
        branch_id=branch_id,
        services=services,
    )
    tables = await services.universe_service.tables_snapshot(
        session=session,
        user_id=current_user.id,
        galaxy_id=target_galaxy_id,
        branch_id=target_branch_id,
        as_of=as_of,
    )
    normalized_tables: list[dict[str, Any]] = []
    for table in tables:
        item = dict(table)
        constellation_name = item.get("constellation_name")
        planet_name = item.get("planet_name")
        if not (isinstance(constellation_name, str) and constellation_name.strip() and isinstance(planet_name, str) and planet_name.strip()):
            resolved_constellation, resolved_planet = split_constellation_and_planet_name(item.get("name"))
            item["constellation_name"] = resolved_constellation
            item["planet_name"] = resolved_planet
        normalized_tables.append(item)
    return UniverseTablesResponse(tables=normalized_tables)
