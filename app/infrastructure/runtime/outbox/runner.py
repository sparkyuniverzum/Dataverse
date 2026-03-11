from __future__ import annotations

import logging
from dataclasses import asdict, dataclass
from datetime import UTC, datetime

from sqlalchemy.ext.asyncio import AsyncSession

from app.infrastructure.runtime.outbox.relay import OutboxRelayResult, OutboxRelayService
from app.services.logging_helpers import structured_log_extra
from app.services.telemetry_spans import start_span

logger = logging.getLogger(__name__)


@dataclass(frozen=True)
class OutboxRunOnceSummary:
    requeued: int
    scanned: int
    published: int
    failed: int
    dead_lettered: int
    completed_at: str

    def as_dict(self) -> dict[str, int | str]:
        return asdict(self)


class OutboxRelayRunnerService:
    def __init__(self, *, relay_service: OutboxRelayService | None = None) -> None:
        self.relay_service = relay_service or OutboxRelayService()

    async def run_once(
        self,
        session: AsyncSession,
        *,
        requeue_limit: int = 128,
        relay_batch_size: int = 64,
        as_of: datetime | None = None,
        trace_id: str | None = None,
        correlation_id: str | None = None,
    ) -> OutboxRunOnceSummary:
        with start_span(
            "outbox.runner.run_once",
            attributes={
                "outbox.requeue_limit": int(requeue_limit),
                "outbox.relay_batch_size": int(relay_batch_size),
            },
        ):
            now = as_of or datetime.now(UTC)
            requeued = await self.relay_service.requeue_failed(
                session=session,
                limit=requeue_limit,
                as_of=now,
                trace_id=trace_id,
                correlation_id=correlation_id,
            )
            relay_result: OutboxRelayResult = await self.relay_service.relay_pending(
                session=session,
                batch_size=relay_batch_size,
                as_of=now,
                trace_id=trace_id,
                correlation_id=correlation_id,
            )
        summary = OutboxRunOnceSummary(
            requeued=int(requeued or 0),
            scanned=relay_result.scanned,
            published=relay_result.published,
            failed=relay_result.failed,
            dead_lettered=relay_result.dead_lettered,
            completed_at=now.isoformat(),
        )
        logger.info(
            "outbox.run_once.completed",
            extra=structured_log_extra(
                event_name="outbox.run_once.completed",
                module="outbox.runner",
                trace_id=trace_id,
                correlation_id=correlation_id,
                **summary.as_dict(),
            ),
        )
        return summary
