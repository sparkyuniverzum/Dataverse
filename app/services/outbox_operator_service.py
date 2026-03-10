from __future__ import annotations

from dataclasses import dataclass

from sqlalchemy.ext.asyncio import AsyncSession

from app.services.outbox_relay_runner_service import OutboxRelayRunnerService, OutboxRunOnceSummary


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
    ) -> OutboxRunOnceSummary:
        summary = await self.runner.run_once(
            session=session,
            requeue_limit=requeue_limit,
            relay_batch_size=relay_batch_size,
        )
        self._latest = summary
        self._run_count += 1
        return summary

    def snapshot(self) -> OutboxOperatorStatusSnapshot:
        return OutboxOperatorStatusSnapshot(
            run_count=self._run_count,
            latest=self._latest,
        )
