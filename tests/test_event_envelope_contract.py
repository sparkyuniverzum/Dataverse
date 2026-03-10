from __future__ import annotations

from datetime import UTC, datetime
from uuid import uuid4

import pytest
from pydantic import ValidationError

from app.services.event_envelope import DomainEventEnvelope, OutboxStatus, build_domain_event_envelope


def test_build_domain_event_envelope_populates_required_fields() -> None:
    aggregate_id = uuid4()
    envelope = build_domain_event_envelope(
        event_type="user.created",
        aggregate_id=aggregate_id,
        payload={"email": "user@dataverse.local"},
        trace_id="trace-123",
        correlation_id="corr-456",
    )

    assert envelope.event_type == "user.created"
    assert envelope.aggregate_id == aggregate_id
    assert envelope.payload["email"] == "user@dataverse.local"
    assert envelope.trace_id == "trace-123"
    assert envelope.correlation_id == "corr-456"
    assert envelope.occurred_at.tzinfo is not None


def test_domain_event_envelope_rejects_missing_required_fields() -> None:
    with pytest.raises(ValidationError):
        DomainEventEnvelope(
            event_id=uuid4(),
            event_type="",
            occurred_at=datetime.now(UTC),
            aggregate_id=uuid4(),
            payload={},
            trace_id="",
            correlation_id="",
        )


def test_outbox_status_enum_values_are_stable() -> None:
    assert OutboxStatus.PENDING.value == "pending"
    assert OutboxStatus.PUBLISHED.value == "published"
    assert OutboxStatus.FAILED.value == "failed"
    assert OutboxStatus.DEAD_LETTER.value == "dead_letter"
