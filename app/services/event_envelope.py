from __future__ import annotations

from datetime import UTC, datetime
from enum import StrEnum
from typing import Any
from uuid import UUID, uuid4

from pydantic import BaseModel, ConfigDict, Field


class OutboxStatus(StrEnum):
    PENDING = "pending"
    PUBLISHED = "published"
    FAILED = "failed"
    DEAD_LETTER = "dead_letter"


class DomainEventEnvelope(BaseModel):
    model_config = ConfigDict(extra="forbid")

    event_id: UUID
    event_type: str = Field(min_length=1)
    occurred_at: datetime
    aggregate_id: UUID
    payload: dict[str, Any] = Field(default_factory=dict)
    trace_id: str = Field(min_length=1)
    correlation_id: str = Field(min_length=1)


def build_domain_event_envelope(
    *,
    event_type: str,
    aggregate_id: UUID,
    payload: dict[str, Any] | None = None,
    trace_id: str,
    correlation_id: str,
    occurred_at: datetime | None = None,
    event_id: UUID | None = None,
) -> DomainEventEnvelope:
    return DomainEventEnvelope(
        event_id=event_id or uuid4(),
        event_type=str(event_type or "").strip(),
        occurred_at=occurred_at or datetime.now(UTC),
        aggregate_id=aggregate_id,
        payload=payload if isinstance(payload, dict) else {},
        trace_id=str(trace_id or "").strip(),
        correlation_id=str(correlation_id or "").strip(),
    )
