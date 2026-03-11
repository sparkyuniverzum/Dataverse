from __future__ import annotations

from collections.abc import Mapping, Sequence
from typing import Protocol

from sqlalchemy.ext.asyncio import AsyncSession

from app.models import OutboxEvent


class OutboxEventConsumer(Protocol):
    async def consume(self, session: AsyncSession, *, event: OutboxEvent) -> bool: ...


class OutboxConsumerRegistry:
    def __init__(self, *, bindings: Mapping[str, Sequence[OutboxEventConsumer]] | None = None) -> None:
        self._bindings: dict[str, tuple[OutboxEventConsumer, ...]] = {}
        if bindings:
            for event_type, consumers in bindings.items():
                normalized_type = str(event_type or "").strip().lower()
                if not normalized_type:
                    continue
                self._bindings[normalized_type] = tuple(consumers)

    async def consume(self, session: AsyncSession, *, event: OutboxEvent) -> bool:
        event_type = str(getattr(event, "event_type", "") or "").strip().lower()
        if not event_type:
            return False
        consumers = self._bindings.get(event_type, ())
        if not consumers:
            return False

        consumed = False
        for consumer in consumers:
            consumed = bool(await consumer.consume(session=session, event=event)) or consumed
        return consumed
