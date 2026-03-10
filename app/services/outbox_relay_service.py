from __future__ import annotations

import logging
from dataclasses import dataclass
from datetime import UTC, datetime, timedelta
from typing import Protocol

from sqlalchemy.ext.asyncio import AsyncSession

from app.models import OutboxEvent
from app.services.event_envelope import OutboxStatus
from app.services.event_store_service import EventStoreService

logger = logging.getLogger(__name__)


class OutboxPublisher(Protocol):
    async def publish(self, session: AsyncSession, event: OutboxEvent) -> None: ...


@dataclass(frozen=True)
class OutboxRelayResult:
    scanned: int
    published: int
    failed: int
    dead_lettered: int


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
        max_attempts: int = 5,
    ) -> None:
        self.event_store = event_store or EventStoreService()
        self.publisher = publisher or NoopOutboxPublisher()
        self.retry_delay_seconds = max(1, int(retry_delay_seconds))
        self.max_attempts = max(1, int(max_attempts))

    async def relay_pending(
        self,
        session: AsyncSession,
        *,
        batch_size: int = 64,
        as_of: datetime | None = None,
        trace_id: str | None = None,
        correlation_id: str | None = None,
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
        dead_letter_count = 0
        for event in events:
            try:
                await self.publisher.publish(session, event)
                event.status = OutboxStatus.PUBLISHED.value
                event.published_at = now
                event.last_error = None
                published_count += 1
            except Exception as exc:
                next_attempt = int(event.attempt_count or 0) + 1
                event.attempt_count = next_attempt
                event.last_error = str(exc)
                if next_attempt >= self.max_attempts:
                    event.status = OutboxStatus.DEAD_LETTER.value
                    dead_letter_count += 1
                else:
                    event.status = OutboxStatus.FAILED.value
                    event.available_at = now + timedelta(seconds=self.retry_delay_seconds)
                    failed_count += 1
        logger.info(
            "outbox.relay_pending.completed",
            extra={
                "event_name": "outbox.relay_pending.completed",
                "trace_id": str(trace_id or "").strip() or "n/a",
                "correlation_id": str(correlation_id or "").strip() or "n/a",
                "as_of": now.isoformat(),
                "requested_batch_size": int(batch_size),
                "scanned": len(events),
                "published": published_count,
                "failed": failed_count,
                "dead_lettered": dead_letter_count,
            },
        )
        return OutboxRelayResult(
            scanned=len(events),
            published=published_count,
            failed=failed_count,
            dead_lettered=dead_letter_count,
        )

    async def requeue_failed(
        self,
        session: AsyncSession,
        *,
        limit: int = 128,
        as_of: datetime | None = None,
        trace_id: str | None = None,
        correlation_id: str | None = None,
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
        logger.info(
            "outbox.requeue_failed.completed",
            extra={
                "event_name": "outbox.requeue_failed.completed",
                "trace_id": str(trace_id or "").strip() or "n/a",
                "correlation_id": str(correlation_id or "").strip() or "n/a",
                "as_of": now.isoformat(),
                "requested_limit": int(limit),
                "requeued": moved,
            },
        )
        return moved
