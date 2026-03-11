from __future__ import annotations

from sqlalchemy.ext.asyncio import AsyncSession

from app.infrastructure.runtime.outbox.consumers.registry import OutboxConsumerRegistry
from app.models import OutboxEvent


class InProcessOutboxPublisher:
    def __init__(self, *, registry: OutboxConsumerRegistry) -> None:
        self.registry = registry

    async def publish(self, session: AsyncSession, event: OutboxEvent) -> None:
        consumed = await self.registry.consume(session=session, event=event)
        if not consumed:
            return None
        return None
