from __future__ import annotations

from dataclasses import dataclass
from datetime import UTC, datetime, timedelta
from typing import Protocol

from sqlalchemy.ext.asyncio import AsyncSession

from app.models import OutboxEvent
from app.services.event_envelope import OutboxStatus
from app.services.event_store_service import EventStoreService


class OutboxPublisher(Protocol):
    async def publish(self, session: AsyncSession, event: OutboxEvent) -> None: ...


@dataclass(frozen=True)
class OutboxRelayResult:
    scanned: int
    published: int
    failed: int


class NoopOutboxPublisher:
    async def publish(self, session: AsyncSession, event: OutboxEvent) -> None:  # pragma: no cover - trivial noop
        _ = (session, event)
        return None


class OutboxRelayService:
    def __init__(
        self,
        *,
        event_store: EventStoreService | None = None,
        publisher: OutboxPublisher | None = None,
        retry_delay_seconds: int = 30,
    ) -> None:
        self.event_store = event_store or EventStoreService()
        self.publisher = publisher or NoopOutboxPublisher()
        self.retry_delay_seconds = max(1, int(retry_delay_seconds))

    async def relay_pending(
        self,
        session: AsyncSession,
        *,
        batch_size: int = 64,
        as_of: datetime | None = None,
    ) -> OutboxRelayResult:
        now = as_of or datetime.now(UTC)
        events = await self.event_store.list_outbox_events(
            session=session,
            status=OutboxStatus.PENDING.value,
            as_of=now,
            limit=batch_size,
        )
        published_count = 0
        failed_count = 0
        for event in events:
            try:
                await self.publisher.publish(session, event)
                event.status = OutboxStatus.PUBLISHED.value
                event.published_at = now
                event.last_error = None
                published_count += 1
            except Exception as exc:
                event.status = OutboxStatus.FAILED.value
                event.attempt_count = int(event.attempt_count or 0) + 1
                event.last_error = str(exc)
                event.available_at = now + timedelta(seconds=self.retry_delay_seconds)
                failed_count += 1
        return OutboxRelayResult(scanned=len(events), published=published_count, failed=failed_count)

    async def requeue_failed(
        self,
        session: AsyncSession,
        *,
        limit: int = 128,
        as_of: datetime | None = None,
    ) -> int:
        now = as_of or datetime.now(UTC)
        failed_events = await self.event_store.list_outbox_events(
            session=session,
            status=OutboxStatus.FAILED.value,
            as_of=now,
            limit=limit,
        )
        moved = 0
        for event in failed_events:
            event.status = OutboxStatus.PENDING.value
            moved += 1
        return moved
