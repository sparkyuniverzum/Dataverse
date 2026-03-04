from __future__ import annotations

import math
from datetime import datetime
from typing import Any
from uuid import UUID

from fastapi import HTTPException, status
from sqlalchemy import and_, func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models import Event, Galaxy
from app.services.event_store_service import EventStoreService
from app.services.universe.event_projection import (
    apply_event as apply_projection_event,
    project_state_from_branch,
    project_state_from_events,
)
from app.services.universe.read_model_projection import (
    _load_calc_state_by_asteroid_id as rm_load_calc_state_by_asteroid_id,
    _load_physics_state_by_asteroid_id as rm_load_physics_state_by_asteroid_id,
    _load_physics_state_by_bond_id as rm_load_physics_state_by_bond_id,
    enrich_bonds_from_read_models,
    enrich_main_timeline_from_read_models,
    evaluate_fallback_universe,
    project_state_from_read_model,
)
from app.services.universe.tables_snapshot import build_tables_snapshot
from app.services.universe.types import (
    DEFAULT_GALAXY_ID,
    ProjectedAsteroid,
    ProjectedBond,
    ProjectionPayloadError,
    derive_table_id,
    derive_table_name,
    normalize_table_name,
    split_constellation_and_planet_name,
)


class UniverseService:
    def __init__(self, event_store: EventStoreService | None = None) -> None:
        self.event_store = event_store or EventStoreService()

    async def _ensure_galaxy_access(self, session: AsyncSession, *, user_id: UUID, galaxy_id: UUID) -> None:
        galaxy = (await session.execute(select(Galaxy).where(Galaxy.id == galaxy_id))).scalar_one_or_none()
        if galaxy is None or galaxy.deleted_at is not None:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Galaxy not found")
        if galaxy.owner_id != user_id:
            raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Forbidden galaxy access")

    def _apply_event(
        self,
        event: Event,
        asteroids_by_id: dict[UUID, ProjectedAsteroid],
        bonds_by_id: dict[UUID, ProjectedBond],
    ) -> None:
        apply_projection_event(
            event=event,
            asteroids_by_id=asteroids_by_id,
            bonds_by_id=bonds_by_id,
        )

    async def _entity_event_seq_map(
        self,
        session: AsyncSession,
        *,
        user_id: UUID,
        galaxy_id: UUID,
        branch_id: UUID | None,
        entity_ids: list[UUID],
    ) -> dict[UUID, int]:
        if not entity_ids:
            return {}
        stmt = (
            select(Event.entity_id, func.max(Event.event_seq))
            .where(
                and_(
                    Event.user_id == user_id,
                    Event.galaxy_id == galaxy_id,
                    Event.entity_id.in_(entity_ids),
                )
            )
            .group_by(Event.entity_id)
        )
        if branch_id is None:
            stmt = stmt.where(Event.branch_id.is_(None))
        else:
            stmt = stmt.where(Event.branch_id == branch_id)
        rows = (await session.execute(stmt)).all()
        return {entity_id: int(max_seq or 0) for entity_id, max_seq in rows}

    @staticmethod
    def _sector_center(index: int, total: int, spacing: int = 500) -> tuple[float, float, float]:
        cols = max(1, math.ceil(math.sqrt(max(total, 1))))
        rows = max(1, math.ceil(total / cols))
        col = index % cols
        row = index // cols
        offset_x = ((cols - 1) * spacing) / 2
        offset_z = ((rows - 1) * spacing) / 2
        return (col * spacing - offset_x, 0.0, row * spacing - offset_z)

    async def _project_state_from_read_model(
        self,
        session: AsyncSession,
        *,
        user_id: UUID,
        galaxy_id: UUID,
    ) -> tuple[list[ProjectedAsteroid], list[ProjectedBond]]:
        return await project_state_from_read_model(
            self,
            session,
            user_id=user_id,
            galaxy_id=galaxy_id,
        )

    async def _load_calc_state_by_asteroid_id(
        self,
        session: AsyncSession,
        *,
        user_id: UUID,
        galaxy_id: UUID,
        asteroid_ids: set[UUID],
    ) -> dict[UUID, dict[str, Any]]:
        return await rm_load_calc_state_by_asteroid_id(
            session,
            user_id=user_id,
            galaxy_id=galaxy_id,
            asteroid_ids=asteroid_ids,
        )

    async def _load_physics_state_by_asteroid_id(
        self,
        session: AsyncSession,
        *,
        user_id: UUID,
        galaxy_id: UUID,
        asteroid_ids: set[UUID],
    ) -> dict[UUID, dict[str, Any]]:
        return await rm_load_physics_state_by_asteroid_id(
            session,
            user_id=user_id,
            galaxy_id=galaxy_id,
            asteroid_ids=asteroid_ids,
        )

    async def _load_physics_state_by_bond_id(
        self,
        session: AsyncSession,
        *,
        user_id: UUID,
        galaxy_id: UUID,
        bond_ids: set[UUID],
    ) -> dict[UUID, dict[str, Any]]:
        return await rm_load_physics_state_by_bond_id(
            session,
            user_id=user_id,
            galaxy_id=galaxy_id,
            bond_ids=bond_ids,
        )

    async def _enrich_bonds_from_read_models(
        self,
        session: AsyncSession,
        *,
        user_id: UUID,
        galaxy_id: UUID,
        active_bonds: list[ProjectedBond],
    ) -> list[ProjectedBond | dict[str, Any]]:
        return await enrich_bonds_from_read_models(
            session,
            user_id=user_id,
            galaxy_id=galaxy_id,
            active_bonds=active_bonds,
        )

    async def _enrich_main_timeline_from_read_models(
        self,
        session: AsyncSession,
        *,
        user_id: UUID,
        galaxy_id: UUID,
        active_asteroids: list[ProjectedAsteroid],
        active_bonds: list[ProjectedBond],
    ) -> list[dict[str, Any]] | None:
        return await enrich_main_timeline_from_read_models(
            session,
            user_id=user_id,
            galaxy_id=galaxy_id,
            active_asteroids=active_asteroids,
            active_bonds=active_bonds,
        )

    async def _project_state_from_events(
        self,
        session: AsyncSession,
        *,
        user_id: UUID,
        galaxy_id: UUID,
        branch_id: UUID | None,
        as_of: datetime | None,
    ) -> tuple[list[ProjectedAsteroid], list[ProjectedBond]]:
        return await project_state_from_events(
            self,
            session,
            user_id=user_id,
            galaxy_id=galaxy_id,
            branch_id=branch_id,
            as_of=as_of,
        )

    async def _project_state_from_branch(
        self,
        session: AsyncSession,
        *,
        user_id: UUID,
        galaxy_id: UUID,
        branch_id: UUID,
        as_of: datetime | None,
    ) -> tuple[list[ProjectedAsteroid], list[ProjectedBond]]:
        return await project_state_from_branch(
            self,
            session,
            user_id=user_id,
            galaxy_id=galaxy_id,
            branch_id=branch_id,
            as_of=as_of,
        )

    async def project_state(
        self,
        session: AsyncSession,
        *,
        user_id: UUID,
        galaxy_id: UUID = DEFAULT_GALAXY_ID,
        branch_id: UUID | None = None,
        as_of: datetime | None = None,
        apply_calculations: bool = True,
    ) -> tuple[list[ProjectedAsteroid | dict[str, Any]], list[ProjectedBond | dict[str, Any]]]:
        await self._ensure_galaxy_access(session, user_id=user_id, galaxy_id=galaxy_id)
        projection_source = "events"
        if branch_id is not None:
            active_asteroids, active_bonds = await self._project_state_from_branch(
                session=session,
                user_id=user_id,
                galaxy_id=galaxy_id,
                branch_id=branch_id,
                as_of=as_of,
            )
            projection_source = "branch"
        elif as_of is None:
            active_asteroids, active_bonds = await self._project_state_from_read_model(
                session=session,
                user_id=user_id,
                galaxy_id=galaxy_id,
            )
            projection_source = "read_model"
            # Fallback for galaxies not yet backfilled into read model.
            if not active_asteroids and not active_bonds:
                active_asteroids, active_bonds = await self._project_state_from_events(
                    session=session,
                    user_id=user_id,
                    galaxy_id=galaxy_id,
                    branch_id=None,
                    as_of=as_of,
                )
                projection_source = "events"
        else:
            active_asteroids, active_bonds = await self._project_state_from_events(
                session=session,
                user_id=user_id,
                galaxy_id=galaxy_id,
                branch_id=None,
                as_of=as_of,
            )
            projection_source = "events"

        if not apply_calculations:
            return active_asteroids, active_bonds

        if projection_source == "read_model":
            main_enriched = await self._enrich_main_timeline_from_read_models(
                session,
                user_id=user_id,
                galaxy_id=galaxy_id,
                active_asteroids=active_asteroids,
                active_bonds=active_bonds,
            )
            if main_enriched is not None:
                bond_enriched = await self._enrich_bonds_from_read_models(
                    session,
                    user_id=user_id,
                    galaxy_id=galaxy_id,
                    active_bonds=active_bonds,
                )
                return main_enriched, bond_enriched

        return evaluate_fallback_universe(
            galaxy_id=galaxy_id,
            active_asteroids=active_asteroids,
            active_bonds=active_bonds,
        )

    async def snapshot(
        self,
        session: AsyncSession,
        *,
        user_id: UUID,
        galaxy_id: UUID = DEFAULT_GALAXY_ID,
        branch_id: UUID | None = None,
        as_of: datetime | None = None,
    ) -> tuple[list[ProjectedAsteroid | dict[str, Any]], list[ProjectedBond | dict[str, Any]]]:
        return await self.project_state(
            session=session,
            user_id=user_id,
            galaxy_id=galaxy_id,
            branch_id=branch_id,
            as_of=as_of,
            apply_calculations=True,
        )

    async def tables_snapshot(
        self,
        session: AsyncSession,
        *,
        user_id: UUID,
        galaxy_id: UUID = DEFAULT_GALAXY_ID,
        branch_id: UUID | None = None,
        as_of: datetime | None = None,
    ) -> list[dict[str, Any]]:
        asteroids, bonds = await self.snapshot(
            session=session,
            user_id=user_id,
            galaxy_id=galaxy_id,
            branch_id=branch_id,
            as_of=as_of,
        )
        return build_tables_snapshot(
            self,
            galaxy_id=galaxy_id,
            asteroids=asteroids,
            bonds=bonds,
        )
