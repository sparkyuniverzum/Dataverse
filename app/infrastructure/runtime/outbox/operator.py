from __future__ import annotations

import logging
from dataclasses import dataclass

from sqlalchemy.ext.asyncio import AsyncSession

from app.infrastructure.runtime.outbox.runner import OutboxRelayRunnerService, OutboxRunOnceSummary
from app.services.circuit_breaker import AsyncCircuitBreaker, CircuitBreakerOpenError
from app.services.logging_helpers import structured_log_extra

logger = logging.getLogger(__name__)


@dataclass(frozen=True)
class OutboxOperatorStatusSnapshot:
    run_count: int
    latest: OutboxRunOnceSummary | None

    @property
    def state(self) -> str:
        return "idle" if self.latest is None else "ready"


class OutboxOperatorService:
    def __init__(
        self,
        *,
        runner: OutboxRelayRunnerService | None = None,
        circuit_breaker: AsyncCircuitBreaker | None = None,
    ) -> None:
        self.runner = runner or OutboxRelayRunnerService()
        self.circuit_breaker = circuit_breaker or AsyncCircuitBreaker(
            failure_threshold=3,
            recovery_timeout_seconds=20.0,
        )
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
        try:
            summary = await self.circuit_breaker.call(
                lambda: self.runner.run_once(
                    session=session,
                    requeue_limit=requeue_limit,
                    relay_batch_size=relay_batch_size,
                    trace_id=trace_id,
                    correlation_id=correlation_id,
                )
            )
        except CircuitBreakerOpenError:
            logger.warning(
                "outbox.operator.run_once.rejected",
                extra=structured_log_extra(
                    event_name="outbox.operator.run_once.rejected",
                    module="outbox.operator",
                    trace_id=trace_id,
                    correlation_id=correlation_id,
                    reason="circuit_open",
                    run_count_before=self._run_count,
                ),
            )
            raise
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
