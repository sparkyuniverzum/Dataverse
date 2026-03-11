from __future__ import annotations

import asyncio
from dataclasses import dataclass

import pytest

from app.infrastructure.runtime.outbox.operator import OutboxOperatorService
from app.infrastructure.runtime.outbox.runner import OutboxRunOnceSummary


@dataclass
class _RunnerStub:
    summary: OutboxRunOnceSummary
    calls: int = 0
    last_kwargs: dict | None = None

    async def run_once(
        self,
        session,
        *,
        requeue_limit=128,
        relay_batch_size=64,
        as_of=None,
        trace_id=None,
        correlation_id=None,
    ):
        _ = session
        self.calls += 1
        self.last_kwargs = {
            "requeue_limit": requeue_limit,
            "relay_batch_size": relay_batch_size,
            "as_of": as_of,
            "trace_id": trace_id,
            "correlation_id": correlation_id,
        }
        return self.summary


class _BreakerOpenStub:
    async def call(self, operation):
        _ = operation
        from app.services.circuit_breaker import CircuitBreakerOpenError

        raise CircuitBreakerOpenError("Circuit breaker is open.")


def test_snapshot_is_idle_before_any_run() -> None:
    runner = _RunnerStub(
        summary=OutboxRunOnceSummary(
            requeued=0,
            scanned=0,
            published=0,
            failed=0,
            dead_lettered=0,
            completed_at="2026-03-10T00:00:00+00:00",
        )
    )
    service = OutboxOperatorService(runner=runner)  # type: ignore[arg-type]

    snapshot = service.snapshot()

    assert snapshot.state == "idle"
    assert snapshot.run_count == 0
    assert snapshot.latest is None


def test_trigger_run_once_updates_latest_summary_and_run_count() -> None:
    summary = OutboxRunOnceSummary(
        requeued=2,
        scanned=5,
        published=3,
        failed=1,
        dead_lettered=1,
        completed_at="2026-03-10T01:23:45+00:00",
    )
    runner = _RunnerStub(summary=summary)
    service = OutboxOperatorService(runner=runner)  # type: ignore[arg-type]

    returned = asyncio.run(
        service.trigger_run_once(
            session=object(),
            requeue_limit=77,
            relay_batch_size=33,
        )
    )
    snapshot = service.snapshot()

    assert runner.calls == 1
    assert runner.last_kwargs == {
        "requeue_limit": 77,
        "relay_batch_size": 33,
        "as_of": None,
        "trace_id": None,
        "correlation_id": None,
    }
    assert returned == summary
    assert snapshot.state == "ready"
    assert snapshot.run_count == 1
    assert snapshot.latest == summary


def test_trigger_run_once_propagates_circuit_open_without_mutating_state() -> None:
    summary = OutboxRunOnceSummary(
        requeued=0,
        scanned=0,
        published=0,
        failed=0,
        dead_lettered=0,
        completed_at="2026-03-10T01:23:45+00:00",
    )
    runner = _RunnerStub(summary=summary)
    service = OutboxOperatorService(
        runner=runner,  # type: ignore[arg-type]
        circuit_breaker=_BreakerOpenStub(),  # type: ignore[arg-type]
    )

    from app.services.circuit_breaker import CircuitBreakerOpenError

    with pytest.raises(CircuitBreakerOpenError):
        asyncio.run(service.trigger_run_once(session=object()))

    snapshot = service.snapshot()
    assert runner.calls == 0
    assert snapshot.run_count == 0
    assert snapshot.latest is None
