from __future__ import annotations

import uuid
from datetime import datetime
from typing import Any

from pydantic import BaseModel, Field


class StarCorePolicyPublic(BaseModel):
    user_id: uuid.UUID
    galaxy_id: uuid.UUID
    profile_key: str = "ORIGIN"
    law_preset: str = "balanced"
    profile_mode: str = "auto"
    topology_mode: str = "single_star_per_galaxy"
    no_hard_delete: bool = True
    deletion_mode: str = "soft_delete"
    soft_delete_flag_field: str = "is_deleted"
    soft_delete_timestamp_field: str = "deleted_at"
    event_sourcing_enabled: bool = True
    occ_enforced: bool = True
    idempotency_supported: bool = True
    branch_scope_supported: bool = True
    lock_status: str = "draft"
    policy_version: int = 1
    locked_at: datetime | None = None
    locked_by: uuid.UUID | None = None
    can_edit_core_laws: bool = True
    generated_at: datetime


class StarCoreProfileApplyRequest(BaseModel):
    profile_key: str = Field(default="ORIGIN", min_length=2, max_length=32)
    lock_after_apply: bool = True


class StarCoreRuntimePublic(BaseModel):
    user_id: uuid.UUID
    galaxy_id: uuid.UUID
    branch_id: uuid.UUID | None = None
    as_of_event_seq: int
    sampled_window_size: int
    sampled_since: datetime | None = None
    sampled_until: datetime | None = None
    events_count: int
    writes_per_minute: float
    hot_event_types: list[str] = Field(default_factory=list)
    hot_entities_count: int
    updated_at: datetime


class StarCorePulseEventPublic(BaseModel):
    event_seq: int
    event_type: str
    entity_id: uuid.UUID
    timestamp: datetime
    visual_hint: str
    intensity: float
    payload: dict[str, Any] = Field(default_factory=dict)


class StarCorePulseResponse(BaseModel):
    galaxy_id: uuid.UUID
    branch_id: uuid.UUID | None = None
    last_event_seq: int
    sampled_count: int
    event_types: list[str] = Field(default_factory=list)
    events: list[StarCorePulseEventPublic] = Field(default_factory=list)


class StarCoreDomainMetricPublic(BaseModel):
    domain_name: str
    planets_count: int
    moons_count: int
    internal_bonds_count: int
    external_bonds_count: int
    guardian_rules_count: int
    alerted_moons_count: int
    circular_fields_count: int
    quality_score: int
    status: str
    events_count: int
    writes_per_minute: float
    hot_event_types: list[str] = Field(default_factory=list)
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
