from __future__ import annotations

import uuid
from datetime import datetime

from pydantic import BaseModel, Field


class StarCorePolicyPublic(BaseModel):
    profile_key: str = "ORIGIN"
    law_preset: str = "balanced"
    profile_mode: str = "auto"
    no_hard_delete: bool = True
    deletion_mode: str = "soft_delete"
    occ_enforced: bool = True
    idempotency_supported: bool = True
    branch_scope_supported: bool = True
    lock_status: str = "draft"
    policy_version: int = 1
    locked_at: datetime | None = None
    can_edit_core_laws: bool = True


class StarCoreProfileApplyRequest(BaseModel):
    profile_key: str = Field(default="ORIGIN", min_length=2, max_length=32)
    lock_after_apply: bool = True


class StarCoreRuntimePublic(BaseModel):
    as_of_event_seq: int
    events_count: int
    writes_per_minute: float


class StarCorePulseEventPublic(BaseModel):
    event_seq: int
    event_type: str
    entity_id: uuid.UUID
    visual_hint: str
    intensity: float


class StarCorePulseResponse(BaseModel):
    galaxy_id: uuid.UUID
    branch_id: uuid.UUID | None = None
    last_event_seq: int
    sampled_count: int
    event_types: list[str] = Field(default_factory=list)
    events: list[StarCorePulseEventPublic] = Field(default_factory=list)


class StarCoreDomainMetricPublic(BaseModel):
    domain_name: str
    status: str
    events_count: int
    activity_intensity: float


class StarCoreDomainMetricsResponse(BaseModel):
    galaxy_id: uuid.UUID
    branch_id: uuid.UUID | None = None
    sampled_window_size: int
    sampled_since: datetime | None = None
    sampled_until: datetime | None = None
    total_events_count: int
    domains: list[StarCoreDomainMetricPublic] = Field(default_factory=list)
    updated_at: datetime
