from __future__ import annotations

import asyncio
import logging
from collections.abc import Awaitable, Callable
from dataclasses import asdict, dataclass
from datetime import UTC, datetime
from typing import Protocol

from sqlalchemy.ext.asyncio import AsyncSession

from app.core.task_executor.service import TaskExecutorService
from app.infrastructure.runtime.outbox.runner import OutboxRelayRunnerService
from app.services.logging_helpers import structured_log_extra

logger = logging.getLogger(__name__)


class _SessionFactory(Protocol):
    def __call__(self) -> AsyncSession: ...


@dataclass(frozen=True)
class RuntimeShutdownSummary:
    intake_stopped: bool
    drained_inflight_tasks: bool
    outbox_flush_completed: bool
    db_pools_disposed: bool
    timeout_seconds: float
    finished_at: str

    def as_dict(self) -> dict[str, object]:
        return asdict(self)


class RuntimeShutdownService:
    def __init__(
        self,
        *,
        task_executor_service: TaskExecutorService,
        outbox_relay_runner_service: OutboxRelayRunnerService,
        session_factory: _SessionFactory,
        dispose_db_engines: Callable[[], Awaitable[None]],
        timeout_seconds: float = 20.0,
        outbox_requeue_limit: int = 512,
        outbox_relay_batch_size: int = 256,
    ) -> None:
        self.task_executor_service = task_executor_service
        self.outbox_relay_runner_service = outbox_relay_runner_service
        self.session_factory = session_factory
        self.dispose_db_engines = dispose_db_engines
        self.timeout_seconds = max(1.0, float(timeout_seconds))
        self.outbox_requeue_limit = max(1, int(outbox_requeue_limit))
        self.outbox_relay_batch_size = max(1, int(outbox_relay_batch_size))

    async def shutdown(
        self,
        *,
        trace_id: str | None = None,
        correlation_id: str | None = None,
    ) -> RuntimeShutdownSummary:
        started_at = datetime.now(UTC)
        deadline = asyncio.get_running_loop().time() + self.timeout_seconds
        intake_stopped = True

        remaining_for_drain = max(0.05, deadline - asyncio.get_running_loop().time())
        drained = await self.task_executor_service.wait_for_idle(timeout_seconds=remaining_for_drain)

        outbox_flushed = False
        remaining_for_outbox = max(0.0, deadline - asyncio.get_running_loop().time())
        if remaining_for_outbox > 0:
            try:
                async with self.session_factory() as session:
                    await asyncio.wait_for(
                        self.outbox_relay_runner_service.run_once(
                            session=session,
                            requeue_limit=self.outbox_requeue_limit,
                            relay_batch_size=self.outbox_relay_batch_size,
                            trace_id=trace_id,
                            correlation_id=correlation_id,
                        ),
                        timeout=remaining_for_outbox,
                    )
                outbox_flushed = True
            except TimeoutError:
                outbox_flushed = False
            except Exception:
                outbox_flushed = False

        db_disposed = False
        try:
            await self.dispose_db_engines()
            db_disposed = True
        except Exception:
            db_disposed = False

        finished_at = datetime.now(UTC)
        summary = RuntimeShutdownSummary(
            intake_stopped=intake_stopped,
            drained_inflight_tasks=drained,
            outbox_flush_completed=outbox_flushed,
            db_pools_disposed=db_disposed,
            timeout_seconds=self.timeout_seconds,
            finished_at=finished_at.isoformat(),
        )
        logger.info(
            "runtime.shutdown.completed",
            extra=structured_log_extra(
                event_name="runtime.shutdown.completed",
                module="runtime.shutdown",
                trace_id=trace_id,
                correlation_id=correlation_id,
                started_at=started_at.isoformat(),
                **summary.as_dict(),
            ),
        )
        return summary
