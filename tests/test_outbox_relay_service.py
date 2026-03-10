from __future__ import annotations

import asyncio
from dataclasses import dataclass
from datetime import UTC, datetime
from uuid import uuid4

from app.services.outbox_relay_service import OutboxRelayService


@dataclass
class _OutboxEventStub:
    id: object
    status: str = "pending"
    attempt_count: int = 0
    published_at: object = None
    last_error: str | None = None
    available_at: datetime = datetime.now(UTC)


class _EventStoreStub:
    def __init__(
        self,
        *,
        pending: list[_OutboxEventStub] | None = None,
        failed: list[_OutboxEventStub] | None = None,
    ) -> None:
        self.pending = pending or []
        self.failed = failed or []

    async def list_outbox_events(self, session, *, status="pending", as_of=None, limit=64, event_type=None):
        _ = (session, as_of, limit, event_type)
        if status == "pending":
            return list(self.pending)
        if status == "failed":
            return list(self.failed)
        return []


class _PublisherOk:
    async def publish(self, session, event) -> None:
        _ = (session, event)
        return None


class _PublisherFail:
    async def publish(self, session, event) -> None:
        _ = (session, event)
        raise RuntimeError("publish_failed")


def test_relay_pending_marks_success_as_published() -> None:
    event = _OutboxEventStub(id=uuid4(), status="pending")
    service = OutboxRelayService(
        event_store=_EventStoreStub(pending=[event]),  # type: ignore[arg-type]
        publisher=_PublisherOk(),
    )

    result = asyncio.run(service.relay_pending(session=object(), batch_size=10))

    assert result.scanned == 1
    assert result.published == 1
    assert result.failed == 0
    assert result.dead_lettered == 0
    assert event.status == "published"
    assert event.published_at is not None
    assert event.last_error is None


def test_relay_pending_marks_failure_with_retry_metadata() -> None:
    event = _OutboxEventStub(id=uuid4(), status="pending", attempt_count=2)
    service = OutboxRelayService(
        event_store=_EventStoreStub(pending=[event]),  # type: ignore[arg-type]
        publisher=_PublisherFail(),
        retry_delay_seconds=15,
    )

    result = asyncio.run(service.relay_pending(session=object(), batch_size=10))

    assert result.scanned == 1
    assert result.published == 0
    assert result.failed == 1
    assert result.dead_lettered == 0
    assert event.status == "failed"
    assert event.attempt_count == 3
    assert event.last_error == "publish_failed"


def test_relay_pending_moves_event_to_dead_letter_after_max_attempts() -> None:
    event = _OutboxEventStub(id=uuid4(), status="pending", attempt_count=2)
    service = OutboxRelayService(
        event_store=_EventStoreStub(pending=[event]),  # type: ignore[arg-type]
        publisher=_PublisherFail(),
        max_attempts=3,
    )

    result = asyncio.run(service.relay_pending(session=object(), batch_size=10))

    assert result.scanned == 1
    assert result.published == 0
    assert result.failed == 0
    assert result.dead_lettered == 1
    assert event.status == "dead_letter"
    assert event.attempt_count == 3


def test_requeue_failed_moves_events_back_to_pending() -> None:
    failed_events = [
        _OutboxEventStub(id=uuid4(), status="failed"),
        _OutboxEventStub(id=uuid4(), status="failed"),
    ]
    service = OutboxRelayService(
        event_store=_EventStoreStub(failed=failed_events),  # type: ignore[arg-type]
        publisher=_PublisherOk(),
    )

    moved = asyncio.run(service.requeue_failed(session=object(), limit=10))

    assert moved == 2
    assert all(event.status == "pending" for event in failed_events)
