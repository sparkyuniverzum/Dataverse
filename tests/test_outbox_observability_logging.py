from __future__ import annotations

import asyncio
import logging
from dataclasses import dataclass
from datetime import UTC, datetime
from uuid import uuid4

from app.infrastructure.runtime.observability.trace_context import bind_trace_context, reset_trace_context
from app.infrastructure.runtime.outbox.operator import OutboxOperatorService
from app.infrastructure.runtime.outbox.relay import OutboxRelayResult, OutboxRelayService
from app.infrastructure.runtime.outbox.runner import OutboxRelayRunnerService


@dataclass
class _OutboxEventStub:
    id: object
    event_type: str = "user.created"
    status: str = "pending"
    attempt_count: int = 0
    published_at: object = None
    last_error: str | None = None
    available_at: datetime = datetime.now(UTC)


class _EventStoreStub:
    def __init__(self, *, pending: list[_OutboxEventStub] | None = None, failed: list[_OutboxEventStub] | None = None):
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


@dataclass
class _RelayStub:
    summary: OutboxRelayResult = OutboxRelayResult(scanned=0, published=0, failed=0, dead_lettered=0)

    async def requeue_failed(self, session, *, limit=128, as_of=None, trace_id=None, correlation_id=None):
        _ = (session, limit, as_of, trace_id, correlation_id)
        return 1

    async def relay_pending(self, session, *, batch_size=64, as_of=None, trace_id=None, correlation_id=None):
        _ = (session, batch_size, as_of, trace_id, correlation_id)
        return self.summary


def test_relay_emits_structured_completion_log(caplog) -> None:
    caplog.set_level(logging.INFO)
    service = OutboxRelayService(
        event_store=_EventStoreStub(pending=[_OutboxEventStub(id=uuid4())]),  # type: ignore[arg-type]
        publisher=_PublisherOk(),
    )

    asyncio.run(service.relay_pending(session=object(), trace_id="trace-relay", correlation_id="corr-relay"))

    record = next((r for r in caplog.records if getattr(r, "event_name", "") == "outbox.relay_pending.completed"), None)
    assert record is not None
    assert getattr(record, "trace_id", "") == "trace-relay"
    assert getattr(record, "correlation_id", "") == "corr-relay"
    assert getattr(record, "module_name", "") == "outbox.relay"
    assert getattr(record, "scanned", -1) == 1


def test_runner_and_operator_emit_structured_logs(caplog) -> None:
    caplog.set_level(logging.INFO)
    runner = OutboxRelayRunnerService(relay_service=_RelayStub())  # type: ignore[arg-type]
    operator = OutboxOperatorService(runner=runner)

    asyncio.run(
        operator.trigger_run_once(
            session=object(),
            requeue_limit=9,
            relay_batch_size=7,
            trace_id="trace-operator",
            correlation_id="corr-operator",
        )
    )

    requested = next(
        (r for r in caplog.records if getattr(r, "event_name", "") == "outbox.operator.run_once.requested"),
        None,
    )
    completed = next(
        (r for r in caplog.records if getattr(r, "event_name", "") == "outbox.operator.run_once.completed"),
        None,
    )
    runner_completed = next(
        (r for r in caplog.records if getattr(r, "event_name", "") == "outbox.run_once.completed"), None
    )

    assert requested is not None
    assert completed is not None
    assert runner_completed is not None
    assert getattr(completed, "trace_id", "") == "trace-operator"
    assert getattr(completed, "correlation_id", "") == "corr-operator"
    assert getattr(completed, "module_name", "") == "outbox.operator"
    assert getattr(runner_completed, "module_name", "") == "outbox.runner"


def test_runner_and_operator_inherit_trace_from_active_context_when_ids_not_passed(caplog) -> None:
    caplog.set_level(logging.INFO)
    runner = OutboxRelayRunnerService(relay_service=_RelayStub())  # type: ignore[arg-type]
    operator = OutboxOperatorService(runner=runner)
    tokens = bind_trace_context(trace_id="ctx-trace-operator", correlation_id="ctx-corr-operator")
    try:
        asyncio.run(operator.trigger_run_once(session=object()))
    finally:
        reset_trace_context(tokens)

    completed = next(
        (r for r in caplog.records if getattr(r, "event_name", "") == "outbox.operator.run_once.completed"),
        None,
    )
    runner_completed = next(
        (r for r in caplog.records if getattr(r, "event_name", "") == "outbox.run_once.completed"), None
    )

    assert completed is not None
    assert runner_completed is not None
    assert getattr(completed, "trace_id", "") == "ctx-trace-operator"
    assert getattr(completed, "correlation_id", "") == "ctx-corr-operator"
    assert getattr(runner_completed, "trace_id", "") == "ctx-trace-operator"
    assert getattr(runner_completed, "correlation_id", "") == "ctx-corr-operator"
