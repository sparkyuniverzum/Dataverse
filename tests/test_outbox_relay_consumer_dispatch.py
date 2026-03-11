from __future__ import annotations

import asyncio
from dataclasses import dataclass
from datetime import UTC, datetime
from uuid import uuid4

from app.infrastructure.runtime.outbox.publisher import InProcessOutboxPublisher
from app.infrastructure.runtime.outbox.relay import OutboxRelayService
from app.services.event_consumers.registry import OutboxConsumerRegistry


@dataclass
class _OutboxEventStub:
    id: object
    event_type: str
    status: str = "pending"
    attempt_count: int = 0
    published_at: object = None
    last_error: str | None = None
    available_at: datetime = datetime.now(UTC)


class _EventStoreStub:
    def __init__(self, *, pending: list[_OutboxEventStub]) -> None:
        self.pending = pending

    async def list_outbox_events(self, session, *, status="pending", as_of=None, limit=64, event_type=None):
        _ = (session, as_of, limit, event_type)
        if status == "pending":
            return list(self.pending)
        return []


class _ConsumerStub:
    def __init__(self, *, fail: bool = False) -> None:
        self.fail = fail
        self.calls = 0

    async def consume(self, session, *, event) -> bool:
        _ = (session, event)
        self.calls += 1
        if self.fail:
            raise RuntimeError("consumer_failed")
        return True


def test_relay_dispatches_pending_event_to_bound_consumer() -> None:
    event = _OutboxEventStub(id=uuid4(), event_type="user.created")
    consumer = _ConsumerStub()
    registry = OutboxConsumerRegistry(bindings={"user.created": (consumer,)})
    service = OutboxRelayService(
        event_store=_EventStoreStub(pending=[event]),  # type: ignore[arg-type]
        publisher=InProcessOutboxPublisher(registry=registry),
    )

    result = asyncio.run(service.relay_pending(session=object()))

    assert result.scanned == 1
    assert result.published == 1
    assert result.failed == 0
    assert result.dead_lettered == 0
    assert consumer.calls == 1
    assert event.status == "published"


def test_relay_marks_failed_when_consumer_raises() -> None:
    event = _OutboxEventStub(id=uuid4(), event_type="user.created")
    consumer = _ConsumerStub(fail=True)
    registry = OutboxConsumerRegistry(bindings={"user.created": (consumer,)})
    service = OutboxRelayService(
        event_store=_EventStoreStub(pending=[event]),  # type: ignore[arg-type]
        publisher=InProcessOutboxPublisher(registry=registry),
        retry_delay_seconds=10,
    )

    result = asyncio.run(service.relay_pending(session=object()))

    assert result.scanned == 1
    assert result.published == 0
    assert result.failed == 1
    assert result.dead_lettered == 0
    assert consumer.calls == 1
    assert event.status == "failed"
    assert event.attempt_count == 1
