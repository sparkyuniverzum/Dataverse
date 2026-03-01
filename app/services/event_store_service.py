from __future__ import annotations

from datetime import datetime
from uuid import UUID

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models import Event


class EventStoreService:
    async def append_event(
        self,
        session: AsyncSession,
        *,
        user_id: UUID,
        galaxy_id: UUID,
        branch_id: UUID | None = None,
        entity_id: UUID,
        event_type: str,
        payload: dict,
    ) -> Event:
        event = Event(
            user_id=user_id,
            galaxy_id=galaxy_id,
            branch_id=branch_id,
            entity_id=entity_id,
            event_type=event_type,
            payload=payload,
        )
        session.add(event)
        await session.flush()
        await session.refresh(event)
        return event

    async def list_events(
        self,
        session: AsyncSession,
        *,
        user_id: UUID,
        galaxy_id: UUID,
        branch_id: UUID | None = None,
        as_of: datetime | None = None,
        up_to_event_seq: int | None = None,
    ) -> list[Event]:
        stmt = select(Event).where(
            Event.user_id == user_id,
            Event.galaxy_id == galaxy_id,
        )
        # Main timeline is represented by NULL branch_id.
        if branch_id is None:
            stmt = stmt.where(Event.branch_id.is_(None))
        else:
            stmt = stmt.where(Event.branch_id == branch_id)
        if as_of is not None:
            stmt = stmt.where(Event.timestamp <= as_of)
        if up_to_event_seq is not None:
            stmt = stmt.where(Event.event_seq <= up_to_event_seq)
        stmt = stmt.order_by(Event.event_seq.asc())
        return list((await session.execute(stmt)).scalars().all())
