from __future__ import annotations

import asyncio
import logging
from dataclasses import dataclass

import pytest

from app.services.runtime_shutdown_service import RuntimeShutdownService


@dataclass
class _TaskExecutorStub:
    should_drain: bool = True
    calls: int = 0
    last_timeout_seconds: float = 0.0

    async def wait_for_idle(self, *, timeout_seconds: float = 10.0) -> bool:
        self.calls += 1
        self.last_timeout_seconds = timeout_seconds
        return self.should_drain


@dataclass
class _RunnerStub:
    calls: int = 0
    last_kwargs: dict | None = None

    async def run_once(
        self,
        session,
        *,
        requeue_limit: int = 128,
        relay_batch_size: int = 64,
        as_of=None,
        trace_id=None,
        correlation_id=None,
    ):
        self.calls += 1
        self.last_kwargs = {
            "session": session,
            "requeue_limit": requeue_limit,
            "relay_batch_size": relay_batch_size,
            "as_of": as_of,
            "trace_id": trace_id,
            "correlation_id": correlation_id,
        }
        return None


class _SessionStub:
    closed: bool

    def __init__(self) -> None:
        self.closed = False

    async def __aenter__(self):
        return self

    async def __aexit__(self, exc_type, exc, tb):
        self.closed = True
        return False


def test_shutdown_drains_tasks_flushes_outbox_and_disposes_db() -> None:
    task_executor = _TaskExecutorStub(should_drain=True)
    runner = _RunnerStub()
    dispose_calls = {"count": 0}

    async def dispose_db():
        dispose_calls["count"] += 1

    service = RuntimeShutdownService(
        task_executor_service=task_executor,  # type: ignore[arg-type]
        outbox_relay_runner_service=runner,  # type: ignore[arg-type]
        session_factory=_SessionStub,
        dispose_db_engines=dispose_db,
        timeout_seconds=5.0,
        outbox_requeue_limit=77,
        outbox_relay_batch_size=33,
    )
    summary = asyncio.run(service.shutdown(trace_id="trace-shutdown", correlation_id="corr-shutdown"))

    assert summary.intake_stopped is True
    assert summary.drained_inflight_tasks is True
    assert summary.outbox_flush_completed is True
    assert summary.db_pools_disposed is True
    assert task_executor.calls == 1
    assert runner.calls == 1
    assert runner.last_kwargs is not None
    assert runner.last_kwargs["requeue_limit"] == 77
    assert runner.last_kwargs["relay_batch_size"] == 33
    assert runner.last_kwargs["trace_id"] == "trace-shutdown"
    assert runner.last_kwargs["correlation_id"] == "corr-shutdown"
    assert dispose_calls["count"] == 1


def test_shutdown_marks_outbox_flush_incomplete_when_runner_fails(
    caplog: pytest.LogCaptureFixture,
) -> None:
    task_executor = _TaskExecutorStub(should_drain=False)

    class _FailingRunner(_RunnerStub):
        async def run_once(self, session, **kwargs):
            _ = (session, kwargs)
            raise RuntimeError("relay failed")

    runner = _FailingRunner()
    dispose_calls = {"count": 0}
    caplog.set_level(logging.WARNING, logger="app.services.runtime_shutdown_service")

    async def dispose_db():
        dispose_calls["count"] += 1

    service = RuntimeShutdownService(
        task_executor_service=task_executor,  # type: ignore[arg-type]
        outbox_relay_runner_service=runner,  # type: ignore[arg-type]
        session_factory=_SessionStub,
        dispose_db_engines=dispose_db,
        timeout_seconds=1.0,
    )
    summary = asyncio.run(service.shutdown())

    assert summary.drained_inflight_tasks is False
    assert summary.outbox_flush_completed is False
    assert summary.db_pools_disposed is True
    assert dispose_calls["count"] == 1
    assert any(record.message == "runtime.shutdown.drain_timeout" for record in caplog.records)
    assert any(record.message == "runtime.shutdown.outbox_flush_failed" for record in caplog.records)


def test_shutdown_logs_db_dispose_failure(caplog: pytest.LogCaptureFixture) -> None:
    task_executor = _TaskExecutorStub(should_drain=True)
    runner = _RunnerStub()
    caplog.set_level(logging.WARNING, logger="app.services.runtime_shutdown_service")

    async def dispose_db():
        raise RuntimeError("dispose failed")

    service = RuntimeShutdownService(
        task_executor_service=task_executor,  # type: ignore[arg-type]
        outbox_relay_runner_service=runner,  # type: ignore[arg-type]
        session_factory=_SessionStub,
        dispose_db_engines=dispose_db,
        timeout_seconds=1.0,
    )
    summary = asyncio.run(service.shutdown())

    assert summary.db_pools_disposed is False
    assert any(record.message == "runtime.shutdown.db_dispose_failed" for record in caplog.records)
