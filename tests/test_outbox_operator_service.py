from __future__ import annotations

import asyncio
from dataclasses import dataclass

from app.services.outbox_operator_service import OutboxOperatorService
from app.services.outbox_relay_runner_service import OutboxRunOnceSummary


@dataclass
class _RunnerStub:
    summary: OutboxRunOnceSummary
    calls: int = 0
    last_kwargs: dict | None = None

    async def run_once(self, session, *, requeue_limit=128, relay_batch_size=64, as_of=None):
        _ = session
        self.calls += 1
        self.last_kwargs = {
            "requeue_limit": requeue_limit,
            "relay_batch_size": relay_batch_size,
            "as_of": as_of,
        }
        return self.summary


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
    assert runner.last_kwargs == {"requeue_limit": 77, "relay_batch_size": 33, "as_of": None}
    assert returned == summary
    assert snapshot.state == "ready"
    assert snapshot.run_count == 1
    assert snapshot.latest == summary
