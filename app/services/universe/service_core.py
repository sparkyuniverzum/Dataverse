from __future__ import annotations

import math
from datetime import datetime
from typing import Any
from uuid import UUID

from fastapi import HTTPException, status
from sqlalchemy import and_, func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.infrastructure.runtime.event_store_service import EventStoreService
from app.models import Event, Galaxy
from app.services.universe.event_projection import (
    apply_event as apply_projection_event,
    project_state_from_branch,
    project_state_from_events,
)
from app.services.universe.runtime_projection_from_read_models import (
    _load_calc_state_by_civilization_id as rm_load_calc_state_by_civilization_id,
    _load_physics_state_by_bond_id as rm_load_physics_state_by_bond_id,
    _load_physics_state_by_civilization_id as rm_load_physics_state_by_civilization_id,
    enrich_bonds_from_read_models,
    enrich_main_timeline_from_read_models,
    project_state_from_read_model,
)
from app.services.universe.types import ProjectedBond, ProjectedCivilization


class UniverseServiceCore:
    def __init__(self, event_store: EventStoreService | None = None) -> None:
        self.event_store = event_store or EventStoreService()

    async def _ensure_galaxy_access(self, session: AsyncSession, *, user_id: UUID, galaxy_id: UUID) -> None:
        stmt = select(Galaxy).where(
            and_(
                Galaxy.id == galaxy_id,
                Galaxy.deleted_at.is_(None),
            )
        )
        galaxy = (await session.execute(stmt)).scalar_one_or_none()
        if galaxy is None:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Galaxy not found")
        if galaxy.owner_id != user_id:
            raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Forbidden galaxy access")

    def _apply_event(
        self,
        event: Event,
        civilizations_by_id: dict[UUID, ProjectedCivilization],
        bonds_by_id: dict[UUID, ProjectedBond],
    ) -> None:
        apply_projection_event(
            event=event,
            civilizations_by_id=civilizations_by_id,
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
    ) -> tuple[list[ProjectedCivilization], list[ProjectedBond]]:
        return await project_state_from_read_model(
            self,
            session,
            user_id=user_id,
            galaxy_id=galaxy_id,
        )

    async def _load_calc_state_by_civilization_id(
        self,
        session: AsyncSession,
        *,
        user_id: UUID,
        galaxy_id: UUID,
        civilization_ids: set[UUID],
    ) -> dict[UUID, dict[str, Any]]:
        return await rm_load_calc_state_by_civilization_id(
            session,
            user_id=user_id,
            galaxy_id=galaxy_id,
            civilization_ids=civilization_ids,
        )

    async def _load_physics_state_by_civilization_id(
        self,
        session: AsyncSession,
        *,
        user_id: UUID,
        galaxy_id: UUID,
        civilization_ids: set[UUID],
    ) -> dict[UUID, dict[str, Any]]:
        return await rm_load_physics_state_by_civilization_id(
            session,
            user_id=user_id,
            galaxy_id=galaxy_id,
            civilization_ids=civilization_ids,
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
        active_asteroids: list[ProjectedCivilization],
        active_bonds: list[ProjectedBond],
    ) -> list[dict[str, Any]]:
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
    ) -> tuple[list[ProjectedCivilization], list[ProjectedBond]]:
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
    ) -> tuple[list[ProjectedCivilization], list[ProjectedBond]]:
        return await project_state_from_branch(
            self,
            session,
            user_id=user_id,
            galaxy_id=galaxy_id,
            branch_id=branch_id,
            as_of=as_of,
        )
