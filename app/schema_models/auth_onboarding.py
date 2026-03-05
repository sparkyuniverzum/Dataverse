from __future__ import annotations

import uuid
from datetime import datetime
from enum import StrEnum

from pydantic import BaseModel, Field, model_validator


class UserPublic(BaseModel):
    id: uuid.UUID
    email: str
    created_at: datetime
    is_active: bool
    deleted_at: datetime | None


class GalaxyPublic(BaseModel):
    id: uuid.UUID
    name: str
    owner_id: uuid.UUID
    created_at: datetime
    deleted_at: datetime | None


class OnboardingMode(StrEnum):
    guided = "guided"
    template = "template"
    hardcore = "hardcore"


class OnboardingAction(StrEnum):
    advance = "advance"
    set_mode = "set_mode"
    reset = "reset"
    sync_machine = "sync_machine"


class OnboardingMetricsPublic(BaseModel):
    planets_count: int = 0
    moons_count: int = 0
    bonds_count: int = 0
    formula_fields_count: int = 0
    guardian_rules_count: int = 0


class OnboardingStagePublic(BaseModel):
    key: str
    title: str
    description: str
    order: int
    target_days: int
    requirements: dict[str, int] = Field(default_factory=dict)
    missing_requirements: dict[str, int] = Field(default_factory=dict)
    unlocked_features: list[str] = Field(default_factory=list)
    status: str


class OnboardingMachinePublic(BaseModel):
    step: str = "intro"
    intro_ack: bool = False
    planet_dropped: bool = False
    schema_confirmed: bool = False
    dependencies_confirmed: bool = False
    calculations_confirmed: bool = False
    simulation_confirmed: bool = False
    completed: bool = False


class OnboardingMachineUpdate(BaseModel):
    step: str | None = None
    intro_ack: bool | None = None
    planet_dropped: bool | None = None
    schema_confirmed: bool | None = None
    dependencies_confirmed: bool | None = None
    calculations_confirmed: bool | None = None
    simulation_confirmed: bool | None = None
    completed: bool | None = None


class OnboardingPublic(BaseModel):
    user_id: uuid.UUID
    galaxy_id: uuid.UUID
    mode: OnboardingMode
    current_stage_key: str
    current_stage_order: int
    started_at: datetime
    stage_started_at: datetime
    completed_at: datetime | None
    updated_at: datetime
    can_advance: bool
    advance_blockers: list[str] = Field(default_factory=list)
    capabilities: list[str] = Field(default_factory=list)
    machine: OnboardingMachinePublic
    metrics: OnboardingMetricsPublic
    stages: list[OnboardingStagePublic] = Field(default_factory=list)


class OnboardingUpdateRequest(BaseModel):
    action: OnboardingAction = OnboardingAction.advance
    mode: OnboardingMode | None = None
    machine: OnboardingMachineUpdate | None = None

    @model_validator(mode="after")
    def validate_action(self) -> OnboardingUpdateRequest:
        if self.action == OnboardingAction.set_mode and self.mode is None:
            raise ValueError("`mode` is required when action='set_mode'")
        if self.action == OnboardingAction.sync_machine and self.machine is None:
            raise ValueError("`machine` is required when action='sync_machine'")
        return self


class GalaxyCreateRequest(BaseModel):
    name: str = Field(min_length=1, max_length=120)
