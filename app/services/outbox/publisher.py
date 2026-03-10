from __future__ import annotations

from sqlalchemy.ext.asyncio import AsyncSession

from app.models import OutboxEvent
from app.services.event_consumers.registry import OutboxConsumerRegistry


class InProcessOutboxPublisher:
    def __init__(self, *, registry: OutboxConsumerRegistry) -> None:
        self.registry = registry

    async def publish(self, session: AsyncSession, event: OutboxEvent) -> None:
        consumed = await self.registry.consume(session=session, event=event)
        if not consumed:
            return None
        return None
