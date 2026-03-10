from __future__ import annotations

import asyncio
from datetime import UTC, datetime
from uuid import uuid4

from app.models import OnboardingProgress
from app.services.event_consumers.onboarding_bootstrap_consumer import OnboardingBootstrapConsumer


class _SessionStub:
    def __init__(self) -> None:
        self.flush_calls = 0

    async def flush(self) -> None:
        self.flush_calls += 1


class _OnboardingServiceStub:
    def __init__(self, progress: OnboardingProgress) -> None:
        self.progress = progress
        self.calls = 0

    async def ensure_progress(self, *, session, user_id, galaxy_id):  # type: ignore[override]
        _ = (session, user_id, galaxy_id)
        self.calls += 1
        return self.progress


def _progress(*, user_id, galaxy_id) -> OnboardingProgress:
    now = datetime.now(UTC)
    return OnboardingProgress(
        user_id=user_id,
        galaxy_id=galaxy_id,
        mode="guided",
        stage_key="galaxy_bootstrap",
        started_at=now,
        stage_started_at=now,
        completed_at=None,
        notes={},
        updated_at=now,
    )


def test_consumer_ignores_non_user_created_event() -> None:
    user_id = uuid4()
    galaxy_id = uuid4()
    progress = _progress(user_id=user_id, galaxy_id=galaxy_id)
    onboarding_service = _OnboardingServiceStub(progress)
    consumer = OnboardingBootstrapConsumer(onboarding_service=onboarding_service)  # type: ignore[arg-type]
    session = _SessionStub()
    event = type(
        "OutboxEventStub",
        (),
        {
            "event_type": "bond.created",
            "payload_json": {},
            "domain_event_id": uuid4(),
        },
    )()

    consumed = asyncio.run(consumer.consume(session=session, event=event))  # type: ignore[arg-type]

    assert consumed is False
    assert onboarding_service.calls == 0
    assert session.flush_calls == 0


def test_consumer_provisions_onboarding_and_sets_bootstrap_status() -> None:
    user_id = uuid4()
    galaxy_id = uuid4()
    progress = _progress(user_id=user_id, galaxy_id=galaxy_id)
    onboarding_service = _OnboardingServiceStub(progress)
    consumer = OnboardingBootstrapConsumer(onboarding_service=onboarding_service)  # type: ignore[arg-type]
    session = _SessionStub()
    event_id = uuid4()
    event = type(
        "OutboxEventStub",
        (),
        {
            "event_type": "user.created",
            "payload_json": {
                "user_id": str(user_id),
                "default_galaxy_id": str(galaxy_id),
            },
            "domain_event_id": event_id,
        },
    )()

    consumed = asyncio.run(consumer.consume(session=session, event=event))  # type: ignore[arg-type]

    assert consumed is True
    assert onboarding_service.calls == 1
    assert session.flush_calls == 1
    bootstrap = progress.notes.get("bootstrap")
    assert isinstance(bootstrap, dict)
    assert bootstrap.get("status") == "provisioned"
    assert bootstrap.get("source_event_id") == str(event_id)


def test_consumer_duplicate_delivery_is_idempotent_for_status_shape() -> None:
    user_id = uuid4()
    galaxy_id = uuid4()
    progress = _progress(user_id=user_id, galaxy_id=galaxy_id)
    onboarding_service = _OnboardingServiceStub(progress)
    consumer = OnboardingBootstrapConsumer(onboarding_service=onboarding_service)  # type: ignore[arg-type]
    session = _SessionStub()
    event_id = uuid4()
    event = type(
        "OutboxEventStub",
        (),
        {
            "event_type": "user.created",
            "payload_json": {
                "user_id": str(user_id),
                "default_galaxy_id": str(galaxy_id),
            },
            "domain_event_id": event_id,
        },
    )()

    first = asyncio.run(consumer.consume(session=session, event=event))  # type: ignore[arg-type]
    second = asyncio.run(consumer.consume(session=session, event=event))  # type: ignore[arg-type]

    assert first is True
    assert second is True
    bootstrap = progress.notes.get("bootstrap")
    assert isinstance(bootstrap, dict)
    assert bootstrap.get("status") == "provisioned"
    assert bootstrap.get("source_event_id") == str(event_id)
    assert session.flush_calls == 1
