from __future__ import annotations

from dataclasses import asdict, dataclass
from datetime import UTC, datetime

from sqlalchemy.ext.asyncio import AsyncSession

from app.services.outbox_relay_service import OutboxRelayResult, OutboxRelayService


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
    ) -> OutboxRunOnceSummary:
        now = as_of or datetime.now(UTC)
        requeued = await self.relay_service.requeue_failed(
            session=session,
            limit=requeue_limit,
            as_of=now,
        )
        relay_result: OutboxRelayResult = await self.relay_service.relay_pending(
            session=session,
            batch_size=relay_batch_size,
            as_of=now,
        )
        return OutboxRunOnceSummary(
            requeued=int(requeued or 0),
            scanned=relay_result.scanned,
            published=relay_result.published,
            failed=relay_result.failed,
            dead_lettered=relay_result.dead_lettered,
            completed_at=now.isoformat(),
        )
