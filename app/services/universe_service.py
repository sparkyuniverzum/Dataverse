from __future__ import annotations

from dataclasses import dataclass
from datetime import datetime
from typing import Any
from uuid import UUID

from fastapi import HTTPException, status
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models import Event, Galaxy
from app.services.calc_service import evaluate_universe
from app.services.event_store_service import EventStoreService
from app.services.guardian_service import evaluate_guardians


DEFAULT_GALAXY_ID = UUID("00000000-0000-0000-0000-000000000001")


@dataclass
class ProjectedAsteroid:
    id: UUID
    value: Any
    metadata: dict[str, Any]
    is_deleted: bool
    created_at: datetime
    deleted_at: datetime | None


@dataclass
class ProjectedBond:
    id: UUID
    source_id: UUID
    target_id: UUID
    type: str
    is_deleted: bool
    created_at: datetime
    deleted_at: datetime | None


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
        payload = event.payload if isinstance(event.payload, dict) else {}

        if event.event_type == "ASTEROID_CREATED":
            metadata = payload.get("metadata", {})
            asteroids_by_id[event.entity_id] = ProjectedAsteroid(
                id=event.entity_id,
                value=payload.get("value"),
                metadata=metadata if isinstance(metadata, dict) else {},
                is_deleted=False,
                created_at=event.timestamp,
                deleted_at=None,
            )
            return

        if event.event_type == "METADATA_UPDATED":
            asteroid = asteroids_by_id.get(event.entity_id)
            if asteroid is None:
                return
            metadata_patch = payload.get("metadata", {})
            if isinstance(metadata_patch, dict):
                asteroid.metadata = {**asteroid.metadata, **metadata_patch}
            return

        if event.event_type == "ASTEROID_SOFT_DELETED":
            asteroid = asteroids_by_id.get(event.entity_id)
            if asteroid is None:
                return
            asteroid.is_deleted = True
            asteroid.deleted_at = event.timestamp
            return

        if event.event_type == "BOND_FORMED":
            try:
                source_id = UUID(str(payload["source_id"]))
                target_id = UUID(str(payload["target_id"]))
            except Exception:
                return
            bonds_by_id[event.entity_id] = ProjectedBond(
                id=event.entity_id,
                source_id=source_id,
                target_id=target_id,
                type=str(payload.get("type", "RELATION")),
                is_deleted=False,
                created_at=event.timestamp,
                deleted_at=None,
            )
            return

        if event.event_type == "BOND_SOFT_DELETED":
            bond = bonds_by_id.get(event.entity_id)
            if bond is None:
                return
            bond.is_deleted = True
            bond.deleted_at = event.timestamp

    async def project_state(
        self,
        session: AsyncSession,
        *,
        user_id: UUID,
        galaxy_id: UUID = DEFAULT_GALAXY_ID,
        as_of: datetime | None = None,
        apply_calculations: bool = True,
    ) -> tuple[list[ProjectedAsteroid | dict[str, Any]], list[ProjectedBond]]:
        await self._ensure_galaxy_access(session, user_id=user_id, galaxy_id=galaxy_id)
        events = await self.event_store.list_events(
            session=session,
            user_id=user_id,
            galaxy_id=galaxy_id,
            as_of=as_of,
        )

        asteroids_by_id: dict[UUID, ProjectedAsteroid] = {}
        bonds_by_id: dict[UUID, ProjectedBond] = {}
        for event in events:
            self._apply_event(event, asteroids_by_id, bonds_by_id)

        active_asteroids = [a for a in asteroids_by_id.values() if not a.is_deleted]
        active_asteroids.sort(key=lambda item: (item.created_at, str(item.id)))
        active_ids = {item.id for item in active_asteroids}

        active_bonds = [
            bond
            for bond in bonds_by_id.values()
            if not bond.is_deleted and bond.source_id in active_ids and bond.target_id in active_ids
        ]
        active_bonds.sort(key=lambda item: (item.created_at, str(item.id)))

        if not apply_calculations:
            return active_asteroids, active_bonds

        evaluated = evaluate_universe(
            [
                {
                    "id": asteroid.id,
                    "value": asteroid.value,
                    "metadata": asteroid.metadata,
                    "created_at": asteroid.created_at,
                }
                for asteroid in active_asteroids
            ],
            active_bonds,
        )
        guarded = evaluate_guardians(evaluated)
        return guarded, active_bonds

    async def snapshot(
        self,
        session: AsyncSession,
        *,
        user_id: UUID,
        galaxy_id: UUID = DEFAULT_GALAXY_ID,
        as_of: datetime | None = None,
    ) -> tuple[list[ProjectedAsteroid | dict[str, Any]], list[ProjectedBond]]:
        return await self.project_state(
            session=session,
            user_id=user_id,
            galaxy_id=galaxy_id,
            as_of=as_of,
            apply_calculations=True,
        )
