from __future__ import annotations

import asyncio
from dataclasses import dataclass
from datetime import UTC, datetime
from uuid import uuid4

from app.infrastructure.runtime.event_envelope import build_domain_event_envelope
from app.infrastructure.runtime.event_store_service import EventStoreService


class _FakeSession:
    def __init__(self) -> None:
        self.added = []
        self.refreshed = []
        self.executed = []

    def add(self, obj) -> None:
        self.added.append(obj)

    async def flush(self) -> None:
        return None

    async def refresh(self, obj) -> None:
        self.refreshed.append(obj)

    async def execute(self, stmt):
        self.executed.append(stmt)
        return _FakeExecuteResult(items=[])


@dataclass
class _FakeScalars:
    items: list

    def all(self):
        return self.items


@dataclass
class _FakeExecuteResult:
    items: list

    def scalars(self):
        return _FakeScalars(items=self.items)


def test_append_outbox_event_persists_pending_record() -> None:
    service = EventStoreService()
    session = _FakeSession()
    aggregate_id = uuid4()
    envelope = build_domain_event_envelope(
        event_type="user.created",
        aggregate_id=aggregate_id,
        payload={"k": "v"},
        trace_id="trace-a",
        correlation_id="corr-a",
    )

    outbox_event = asyncio.run(
        service.append_outbox_event(
            session,  # type: ignore[arg-type]
            envelope=envelope,
        )
    )

    assert len(session.added) == 1
    assert outbox_event in session.added
    assert outbox_event.domain_event_id == envelope.event_id
    assert outbox_event.event_type == "user.created"
    assert outbox_event.aggregate_id == aggregate_id
    assert outbox_event.status == "pending"
    assert outbox_event.trace_id == "trace-a"
    assert outbox_event.correlation_id == "corr-a"
    assert outbox_event.payload_json == {"k": "v"}
    assert session.refreshed and session.refreshed[0] is outbox_event


def test_list_outbox_events_applies_status_and_type_filters() -> None:
    service = EventStoreService()
    session = _FakeSession()

    asyncio.run(
        service.list_outbox_events(
            session,  # type: ignore[arg-type]
            status="pending",
            event_type="user.created",
            as_of=datetime.now(UTC),
            limit=25,
        )
    )

    assert len(session.executed) == 1
    rendered = str(session.executed[0])
    assert "event_outbox.status" in rendered
    assert "event_outbox.event_type" in rendered
    assert "event_outbox.available_at" in rendered
