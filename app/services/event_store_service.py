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
        entity_id: UUID,
        event_type: str,
        payload: dict,
    ) -> Event:
        event = Event(
            user_id=user_id,
            galaxy_id=galaxy_id,
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
        as_of: datetime | None = None,
    ) -> list[Event]:
        stmt = select(Event).where(
            Event.user_id == user_id,
            Event.galaxy_id == galaxy_id,
        )
        if as_of is not None:
            stmt = stmt.where(Event.timestamp <= as_of)
        stmt = stmt.order_by(Event.timestamp.asc(), Event.id.asc())
        return list((await session.execute(stmt)).scalars().all())
