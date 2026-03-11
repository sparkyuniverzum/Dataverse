from __future__ import annotations

import asyncio
from dataclasses import dataclass
from uuid import uuid4

from app.infrastructure.runtime.outbox.consumers.registry import OutboxConsumerRegistry


@dataclass
class _OutboxEventStub:
    event_type: str
    domain_event_id: object
    payload_json: dict


class _ConsumerStub:
    def __init__(self, *, return_value: bool = True) -> None:
        self.return_value = return_value
        self.calls = 0

    async def consume(self, session, *, event) -> bool:
        _ = (session, event)
        self.calls += 1
        return self.return_value


def test_registry_dispatches_only_matching_event_type() -> None:
    matching_consumer = _ConsumerStub(return_value=True)
    ignored_consumer = _ConsumerStub(return_value=True)
    registry = OutboxConsumerRegistry(
        bindings={
            "user.created": (matching_consumer,),
            "bond.created": (ignored_consumer,),
        }
    )
    event = _OutboxEventStub(event_type="user.created", domain_event_id=uuid4(), payload_json={})

    consumed = asyncio.run(registry.consume(session=object(), event=event))  # type: ignore[arg-type]

    assert consumed is True
    assert matching_consumer.calls == 1
    assert ignored_consumer.calls == 0


def test_registry_returns_false_when_no_consumer_bound() -> None:
    registry = OutboxConsumerRegistry(bindings={})
    event = _OutboxEventStub(event_type="planet.created", domain_event_id=uuid4(), payload_json={})

    consumed = asyncio.run(registry.consume(session=object(), event=event))  # type: ignore[arg-type]

    assert consumed is False
