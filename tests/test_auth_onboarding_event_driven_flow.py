from __future__ import annotations

import asyncio
from dataclasses import dataclass
from datetime import UTC, datetime
from types import SimpleNamespace
from uuid import uuid4

from app.infrastructure.runtime.outbox.consumers.onboarding_bootstrap_consumer import OnboardingBootstrapConsumer
from app.infrastructure.runtime.outbox.consumers.registry import OutboxConsumerRegistry
from app.infrastructure.runtime.outbox.publisher import InProcessOutboxPublisher
from app.infrastructure.runtime.outbox.relay import OutboxRelayService
from app.modules.auth.service import AuthService


@dataclass
class _AuthSessionStub:
    id: object
    access_expires_at: object
    refresh_expires_at: object


@dataclass
class _OutboxEventStub:
    id: object
    domain_event_id: object
    event_type: str
    payload_json: dict
    trace_id: str
    correlation_id: str
    status: str = "pending"
    attempt_count: int = 0
    published_at: object = None
    last_error: str | None = None
    available_at: datetime = datetime.now(UTC)


class _SessionStub:
    async def flush(self) -> None:
        return None


class _RepositoryStub:
    async def get_user_by_email(self, *, session, normalized_email, include_deleted=False):
        _ = (session, normalized_email, include_deleted)
        return None

    async def create_user(self, *, session, normalized_email, hashed_password):
        _ = (session, normalized_email, hashed_password)
        return SimpleNamespace(id=uuid4(), is_active=True, hashed_password=hashed_password)

    async def create_galaxy(self, *, session, user_id, name):
        _ = (session, user_id, name)
        return SimpleNamespace(id=uuid4(), name=name, owner_id=user_id)

    async def create_auth_session(
        self,
        *,
        session,
        user_id,
        access_expires_at,
        refresh_expires_at,
        user_agent,
        ip_address,
    ):
        _ = (session, user_id, user_agent, ip_address)
        return _AuthSessionStub(id=uuid4(), access_expires_at=access_expires_at, refresh_expires_at=refresh_expires_at)


class _EventStoreStub:
    def __init__(self) -> None:
        self.pending: list[_OutboxEventStub] = []

    async def append_outbox_event(self, *, session, envelope):
        _ = session
        item = _OutboxEventStub(
            id=uuid4(),
            domain_event_id=envelope.event_id,
            event_type=envelope.event_type,
            payload_json=dict(envelope.payload),
            trace_id=envelope.trace_id,
            correlation_id=envelope.correlation_id,
        )
        self.pending.append(item)
        return item

    async def list_outbox_events(self, session, *, status="pending", as_of=None, limit=64, event_type=None):
        _ = (session, as_of, limit, event_type)
        if status != "pending":
            return []
        return [event for event in self.pending if event.status == "pending"][:limit]


class _OnboardingServiceStub:
    def __init__(self) -> None:
        self.calls = 0
        now = datetime.now(UTC)
        self.progress = SimpleNamespace(notes={}, updated_at=now)

    async def ensure_progress(self, *, session, user_id, galaxy_id):
        _ = (session, user_id, galaxy_id)
        self.calls += 1
        return self.progress


def test_register_emits_outbox_and_provisions_onboarding_only_after_relay() -> None:
    repository = _RepositoryStub()
    event_store = _EventStoreStub()
    onboarding_service = _OnboardingServiceStub()

    auth_service = AuthService(repository=repository, event_store=event_store)
    consumer = OnboardingBootstrapConsumer(onboarding_service=onboarding_service)  # type: ignore[arg-type]
    registry = OutboxConsumerRegistry(bindings={"user.created": (consumer,)})
    relay_service = OutboxRelayService(
        event_store=event_store,  # type: ignore[arg-type]
        publisher=InProcessOutboxPublisher(registry=registry),
    )

    session = _SessionStub()
    result = asyncio.run(
        auth_service.register(
            session=session,  # type: ignore[arg-type]
            email="pilot@dataverse.local",
            password="safe-pass-123",
        )
    )

    assert result.user is not None
    assert len(event_store.pending) == 1
    assert event_store.pending[0].status == "pending"
    assert onboarding_service.calls == 0

    first = asyncio.run(relay_service.relay_pending(session=session))  # type: ignore[arg-type]
    assert first.scanned == 1
    assert first.published == 1
    assert onboarding_service.calls == 1
    assert event_store.pending[0].status == "published"

    second = asyncio.run(relay_service.relay_pending(session=session))  # type: ignore[arg-type]
    assert second.scanned == 0
    assert second.published == 0
    assert onboarding_service.calls == 1
