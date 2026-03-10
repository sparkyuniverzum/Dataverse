from __future__ import annotations

import asyncio
from dataclasses import dataclass
from datetime import UTC, datetime

from app.services.outbox_relay_runner_service import OutboxRelayRunnerService
from app.services.outbox_relay_service import OutboxRelayResult


@dataclass
class _RelayStub:
    requeued: int = 0
    result: OutboxRelayResult = OutboxRelayResult(scanned=0, published=0, failed=0, dead_lettered=0)
    requeue_calls: int = 0
    relay_calls: int = 0
    last_requeue_kwargs: dict | None = None
    last_relay_kwargs: dict | None = None

    async def requeue_failed(self, session, *, limit=128, as_of=None):
        _ = session
        self.requeue_calls += 1
        self.last_requeue_kwargs = {"limit": limit, "as_of": as_of}
        return self.requeued

    async def relay_pending(self, session, *, batch_size=64, as_of=None):
        _ = session
        self.relay_calls += 1
        self.last_relay_kwargs = {"batch_size": batch_size, "as_of": as_of}
        return self.result


def test_run_once_orchestrates_requeue_and_relay_with_same_clock() -> None:
    now = datetime.now(UTC)
    relay = _RelayStub(
        requeued=2,
        result=OutboxRelayResult(scanned=5, published=4, failed=1, dead_lettered=0),
    )
    service = OutboxRelayRunnerService(relay_service=relay)  # type: ignore[arg-type]

    summary = asyncio.run(
        service.run_once(
            session=object(),
            requeue_limit=33,
            relay_batch_size=22,
            as_of=now,
        )
    )

    assert relay.requeue_calls == 1
    assert relay.relay_calls == 1
    assert relay.last_requeue_kwargs == {"limit": 33, "as_of": now}
    assert relay.last_relay_kwargs == {"batch_size": 22, "as_of": now}
    assert summary.requeued == 2
    assert summary.scanned == 5
    assert summary.published == 4
    assert summary.failed == 1
    assert summary.dead_lettered == 0
    assert summary.completed_at == now.isoformat()


def test_run_once_summary_dict_is_operator_friendly() -> None:
    now = datetime.now(UTC)
    relay = _RelayStub(
        requeued=1,
        result=OutboxRelayResult(scanned=3, published=1, failed=1, dead_lettered=1),
    )
    service = OutboxRelayRunnerService(relay_service=relay)  # type: ignore[arg-type]

    summary = asyncio.run(service.run_once(session=object(), as_of=now))
    payload = summary.as_dict()

    assert payload == {
        "requeued": 1,
        "scanned": 3,
        "published": 1,
        "failed": 1,
        "dead_lettered": 1,
        "completed_at": now.isoformat(),
    }
