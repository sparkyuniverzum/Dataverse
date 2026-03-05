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
    physical_profile_key: str = Field(default="BALANCE", min_length=3, max_length=32)
    physical_profile_version: int = Field(default=1, ge=1)


class StarCorePhysicsProfileMigrateRequest(BaseModel):
    from_version: int = Field(ge=1)
    to_version: int = Field(ge=1)
    reason: str = Field(min_length=1, max_length=240)
    dry_run: bool = True


class StarCorePhysicsProfileMigrateResponse(BaseModel):
    galaxy_id: uuid.UUID
    profile_key: str
    from_version: int
    to_version: int
    reason: str
    dry_run: bool = True
    applied: bool = False
    lock_status: str = "locked"
    impacted_planets: int = 0
    estimated_runtime_items: int = 0


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


class StarCorePhysicsProfilePublic(BaseModel):
    galaxy_id: uuid.UUID
    profile_key: str = "BALANCE"
    profile_version: int = 1
    lock_status: str = "draft"
    locked_at: datetime | None = None
    coefficients: dict[str, float] = Field(default_factory=dict)


class StarCorePlanetPhysicsMetricsPublic(BaseModel):
    activity: float = 0.0
    stress: float = 0.0
    health: float = 1.0
    inactivity: float = 0.0
    corrosion: float = 0.0
    rows: int = 0


class StarCorePlanetPhysicsVisualPublic(BaseModel):
    size_factor: float = 1.0
    luminosity: float = 0.0
    pulse_rate: float = 0.0
    hue: float = 0.0
    saturation: float = 0.0
    corrosion_level: float = 0.0
    crack_intensity: float = 0.0


class StarCorePlanetPhysicsItemPublic(BaseModel):
    table_id: uuid.UUID
    phase: str = "CALM"
    metrics: StarCorePlanetPhysicsMetricsPublic
    visual: StarCorePlanetPhysicsVisualPublic
    source_event_seq: int = 0
    engine_version: str = "star-physics-v2-preview"


class StarCorePlanetPhysicsResponse(BaseModel):
    as_of_event_seq: int
    items: list[StarCorePlanetPhysicsItemPublic] = Field(default_factory=list)
