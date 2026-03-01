from __future__ import annotations

from datetime import datetime
from typing import Any
from uuid import UUID

from pydantic import BaseModel, Field
from sqlalchemy import and_, select, update
from sqlalchemy.dialects.postgresql import insert
from sqlalchemy.ext.asyncio import AsyncSession

from app.models import Atom, Bond, Event


class AsteroidCreatedPayload(BaseModel):
    value: Any
    metadata: dict[str, Any] = Field(default_factory=dict)


class MetadataUpdatedPayload(BaseModel):
    metadata: dict[str, Any] = Field(default_factory=dict)


class AsteroidValueUpdatedPayload(BaseModel):
    value: Any


class BondFormedPayload(BaseModel):
    source_id: UUID
    target_id: UUID
    type: str = "RELATION"


class ReadModelProjector:
    """Projects immutable events into mutable read-model tables.

    Concurrency:
    - UPSERT (`INSERT ... ON CONFLICT`) is used for create/form events so replays are idempotent.
    - `SELECT ... FOR UPDATE` is used for metadata patches to serialize concurrent updates on one asteroid row
      and avoid lost updates while still keeping one DB transaction boundary.
    """

    async def apply_events(self, session: AsyncSession, events: list[Event]) -> None:
        for event in events:
            await self.apply_event(session=session, event=event)

    async def apply_event(self, session: AsyncSession, event: Event) -> None:
        event_type = event.event_type.upper()
        payload = event.payload if isinstance(event.payload, dict) else {}

        if event_type == "ASTEROID_CREATED":
            await self._project_asteroid_created(
                session=session,
                user_id=event.user_id,
                galaxy_id=event.galaxy_id,
                asteroid_id=event.entity_id,
                payload=AsteroidCreatedPayload.model_validate(payload),
                happened_at=event.timestamp,
            )
            return

        if event_type == "METADATA_UPDATED":
            await self._project_metadata_updated(
                session=session,
                user_id=event.user_id,
                galaxy_id=event.galaxy_id,
                asteroid_id=event.entity_id,
                payload=MetadataUpdatedPayload.model_validate(payload),
            )
            return

        if event_type == "ASTEROID_VALUE_UPDATED":
            await self._project_asteroid_value_updated(
                session=session,
                user_id=event.user_id,
                galaxy_id=event.galaxy_id,
                asteroid_id=event.entity_id,
                payload=AsteroidValueUpdatedPayload.model_validate(payload),
            )
            return

        if event_type == "ASTEROID_SOFT_DELETED":
            await self._project_asteroid_soft_deleted(
                session=session,
                user_id=event.user_id,
                galaxy_id=event.galaxy_id,
                asteroid_id=event.entity_id,
                happened_at=event.timestamp,
            )
            return

        if event_type == "BOND_FORMED":
            await self._project_bond_formed(
                session=session,
                user_id=event.user_id,
                galaxy_id=event.galaxy_id,
                bond_id=event.entity_id,
                payload=BondFormedPayload.model_validate(payload),
                happened_at=event.timestamp,
            )
            return

        if event_type == "BOND_SOFT_DELETED":
            await self._project_bond_soft_deleted(
                session=session,
                user_id=event.user_id,
                galaxy_id=event.galaxy_id,
                bond_id=event.entity_id,
                happened_at=event.timestamp,
            )

    async def _project_asteroid_created(
        self,
        *,
        session: AsyncSession,
        user_id: UUID,
        galaxy_id: UUID,
        asteroid_id: UUID,
        payload: AsteroidCreatedPayload,
        happened_at: datetime,
    ) -> None:
        stmt = insert(Atom).values(
            id=asteroid_id,
            user_id=user_id,
            galaxy_id=galaxy_id,
            value=payload.value,
            metadata_=payload.metadata,
            is_deleted=False,
            created_at=happened_at,
            deleted_at=None,
        )
        stmt = stmt.on_conflict_do_update(
            index_elements=[Atom.id],
            set_={
                "user_id": user_id,
                "galaxy_id": galaxy_id,
                "value": payload.value,
                "metadata": payload.metadata,
                "is_deleted": False,
                "deleted_at": None,
            },
        )
        await session.execute(stmt)

    async def _project_metadata_updated(
        self,
        *,
        session: AsyncSession,
        user_id: UUID,
        galaxy_id: UUID,
        asteroid_id: UUID,
        payload: MetadataUpdatedPayload,
    ) -> None:
        if not payload.metadata:
            return

        locked_atom = (
            await session.execute(
                select(Atom)
                .where(
                    and_(
                        Atom.id == asteroid_id,
                        Atom.user_id == user_id,
                        Atom.galaxy_id == galaxy_id,
                    )
                )
                .with_for_update()
            )
        ).scalar_one_or_none()
        if locked_atom is None:
            return

        current_metadata = locked_atom.metadata_ if isinstance(locked_atom.metadata_, dict) else {}
        locked_atom.metadata_ = {**current_metadata, **payload.metadata}

    async def _project_asteroid_soft_deleted(
        self,
        *,
        session: AsyncSession,
        user_id: UUID,
        galaxy_id: UUID,
        asteroid_id: UUID,
        happened_at: datetime,
    ) -> None:
        await session.execute(
            update(Atom)
            .where(
                and_(
                    Atom.id == asteroid_id,
                    Atom.user_id == user_id,
                    Atom.galaxy_id == galaxy_id,
                    Atom.is_deleted.is_(False),
                )
            )
            .values(is_deleted=True, deleted_at=happened_at)
        )

        await session.execute(
            update(Bond)
            .where(
                and_(
                    Bond.user_id == user_id,
                    Bond.galaxy_id == galaxy_id,
                    Bond.is_deleted.is_(False),
                    (Bond.source_id == asteroid_id) | (Bond.target_id == asteroid_id),
                )
            )
            .values(is_deleted=True, deleted_at=happened_at)
        )

    async def _project_asteroid_value_updated(
        self,
        *,
        session: AsyncSession,
        user_id: UUID,
        galaxy_id: UUID,
        asteroid_id: UUID,
        payload: AsteroidValueUpdatedPayload,
    ) -> None:
        await session.execute(
            update(Atom)
            .where(
                and_(
                    Atom.id == asteroid_id,
                    Atom.user_id == user_id,
                    Atom.galaxy_id == galaxy_id,
                    Atom.is_deleted.is_(False),
                )
            )
            .values(value=payload.value)
        )

    async def _project_bond_formed(
        self,
        *,
        session: AsyncSession,
        user_id: UUID,
        galaxy_id: UUID,
        bond_id: UUID,
        payload: BondFormedPayload,
        happened_at: datetime,
    ) -> None:
        stmt = insert(Bond).values(
            id=bond_id,
            user_id=user_id,
            galaxy_id=galaxy_id,
            source_id=payload.source_id,
            target_id=payload.target_id,
            type=payload.type,
            is_deleted=False,
            created_at=happened_at,
            deleted_at=None,
        )
        stmt = stmt.on_conflict_do_update(
            index_elements=[Bond.id],
            set_={
                "user_id": user_id,
                "galaxy_id": galaxy_id,
                "source_id": payload.source_id,
                "target_id": payload.target_id,
                "type": payload.type,
                "is_deleted": False,
                "deleted_at": None,
            },
        )
        await session.execute(stmt)

    async def _project_bond_soft_deleted(
        self,
        *,
        session: AsyncSession,
        user_id: UUID,
        galaxy_id: UUID,
        bond_id: UUID,
        happened_at: datetime,
    ) -> None:
        await session.execute(
            update(Bond)
            .where(
                and_(
                    Bond.id == bond_id,
                    Bond.user_id == user_id,
                    Bond.galaxy_id == galaxy_id,
                    Bond.is_deleted.is_(False),
                )
            )
            .values(is_deleted=True, deleted_at=happened_at)
        )
