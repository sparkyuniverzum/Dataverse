from __future__ import annotations

import logging
from dataclasses import dataclass

from sqlalchemy.ext.asyncio import AsyncSession

from app.services.logging_helpers import structured_log_extra
from app.services.outbox_relay_runner_service import OutboxRelayRunnerService, OutboxRunOnceSummary

logger = logging.getLogger(__name__)


@dataclass(frozen=True)
class OutboxOperatorStatusSnapshot:
    run_count: int
    latest: OutboxRunOnceSummary | None

    @property
    def state(self) -> str:
        return "idle" if self.latest is None else "ready"


class OutboxOperatorService:
    def __init__(self, *, runner: OutboxRelayRunnerService | None = None) -> None:
        self.runner = runner or OutboxRelayRunnerService()
        self._run_count = 0
        self._latest: OutboxRunOnceSummary | None = None

    async def trigger_run_once(
        self,
        session: AsyncSession,
        *,
        requeue_limit: int = 128,
        relay_batch_size: int = 64,
        trace_id: str | None = None,
        correlation_id: str | None = None,
    ) -> OutboxRunOnceSummary:
        logger.info(
            "outbox.operator.run_once.requested",
            extra=structured_log_extra(
                event_name="outbox.operator.run_once.requested",
                module="outbox.operator",
                trace_id=trace_id,
                correlation_id=correlation_id,
                requested_requeue_limit=int(requeue_limit),
                requested_relay_batch_size=int(relay_batch_size),
                run_count_before=self._run_count,
            ),
        )
        summary = await self.runner.run_once(
            session=session,
            requeue_limit=requeue_limit,
            relay_batch_size=relay_batch_size,
            trace_id=trace_id,
            correlation_id=correlation_id,
        )
        self._latest = summary
        self._run_count += 1
        logger.info(
            "outbox.operator.run_once.completed",
            extra=structured_log_extra(
                event_name="outbox.operator.run_once.completed",
                module="outbox.operator",
                trace_id=trace_id,
                correlation_id=correlation_id,
                run_count_after=self._run_count,
                **summary.as_dict(),
            ),
        )
        return summary

    def snapshot(self) -> OutboxOperatorStatusSnapshot:
        return OutboxOperatorStatusSnapshot(
            run_count=self._run_count,
            latest=self._latest,
        )
