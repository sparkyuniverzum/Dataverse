from __future__ import annotations

from datetime import datetime
from uuid import UUID

from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models import Event, OutboxEvent
from app.services.event_envelope import DomainEventEnvelope, OutboxStatus


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

    async def latest_event_seq(
        self,
        session: AsyncSession,
        *,
        user_id: UUID,
        galaxy_id: UUID,
        branch_id: UUID | None = None,
    ) -> int:
        stmt = select(func.max(Event.event_seq)).where(
            Event.user_id == user_id,
            Event.galaxy_id == galaxy_id,
        )
        if branch_id is None:
            stmt = stmt.where(Event.branch_id.is_(None))
        else:
            stmt = stmt.where(Event.branch_id == branch_id)
        latest = (await session.execute(stmt)).scalar_one_or_none()
        return int(latest or 0)

    async def list_events_after(
        self,
        session: AsyncSession,
        *,
        user_id: UUID,
        galaxy_id: UUID,
        after_event_seq: int,
        branch_id: UUID | None = None,
        limit: int = 64,
    ) -> list[Event]:
        stmt = select(Event).where(
            Event.user_id == user_id,
            Event.galaxy_id == galaxy_id,
            Event.event_seq > after_event_seq,
        )
        if branch_id is None:
            stmt = stmt.where(Event.branch_id.is_(None))
        else:
            stmt = stmt.where(Event.branch_id == branch_id)
        stmt = stmt.order_by(Event.event_seq.asc()).limit(max(1, min(int(limit), 256)))
        return list((await session.execute(stmt)).scalars().all())

    async def append_outbox_event(
        self,
        session: AsyncSession,
        *,
        envelope: DomainEventEnvelope,
        available_at: datetime | None = None,
    ) -> OutboxEvent:
        outbox_event = OutboxEvent(
            domain_event_id=envelope.event_id,
            event_type=envelope.event_type,
            aggregate_id=envelope.aggregate_id,
            payload_json=envelope.payload,
            trace_id=envelope.trace_id,
            correlation_id=envelope.correlation_id,
            status=OutboxStatus.PENDING.value,
            available_at=available_at or envelope.occurred_at,
        )
        session.add(outbox_event)
        await session.flush()
        await session.refresh(outbox_event)
        return outbox_event

    async def list_outbox_events(
        self,
        session: AsyncSession,
        *,
        status: str | None = OutboxStatus.PENDING.value,
        event_type: str | None = None,
        as_of: datetime | None = None,
        limit: int = 128,
    ) -> list[OutboxEvent]:
        stmt = select(OutboxEvent)
        normalized_status = str(status or "").strip().lower()
        if normalized_status:
            stmt = stmt.where(OutboxEvent.status == normalized_status)
        normalized_type = str(event_type or "").strip()
        if normalized_type:
            stmt = stmt.where(OutboxEvent.event_type == normalized_type)
        if as_of is not None:
            stmt = stmt.where(OutboxEvent.available_at <= as_of)
        stmt = stmt.order_by(OutboxEvent.created_at.asc()).limit(max(1, min(int(limit), 512)))
        return list((await session.execute(stmt)).scalars().all())
