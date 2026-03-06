from __future__ import annotations

import uuid
from datetime import datetime
from typing import Any, Literal

from pydantic import BaseModel, Field, model_validator

CapabilityClass = Literal["dictionary", "validation", "formula", "bridge"]
CapabilityStatus = Literal["active", "deprecated"]


class MoonCapabilityCreateRequest(BaseModel):
    galaxy_id: uuid.UUID | None = None
    branch_id: uuid.UUID | None = None
    capability_key: str = Field(min_length=1, max_length=160)
    capability_class: CapabilityClass
    config: dict[str, Any] = Field(default_factory=dict)
    order_index: int = Field(default=100, ge=0, le=100_000)
    status: CapabilityStatus = "active"
    idempotency_key: str | None = None

    @model_validator(mode="after")
    def normalize_fields(self) -> MoonCapabilityCreateRequest:
        self.capability_key = str(self.capability_key).strip()
        if not self.capability_key:
            raise ValueError("`capability_key` cannot be empty")
        if not isinstance(self.config, dict):
            self.config = {}
        if isinstance(self.idempotency_key, str):
            normalized = self.idempotency_key.strip()
            self.idempotency_key = normalized or None
        return self


class MoonCapabilityUpdateRequest(BaseModel):
    galaxy_id: uuid.UUID | None = None
    branch_id: uuid.UUID | None = None
    capability_class: CapabilityClass | None = None
    config: dict[str, Any] | None = None
    order_index: int | None = Field(default=None, ge=0, le=100_000)
    status: CapabilityStatus | None = None
    expected_version: int | None = Field(default=None, ge=1)
    idempotency_key: str | None = None

    @model_validator(mode="after")
    def validate_has_patch(self) -> MoonCapabilityUpdateRequest:
        if self.capability_class is None and self.config is None and self.order_index is None and self.status is None:
            raise ValueError("Provide at least one patch field")
        if self.config is not None and not isinstance(self.config, dict):
            self.config = {}
        if isinstance(self.idempotency_key, str):
            normalized = self.idempotency_key.strip()
            self.idempotency_key = normalized or None
        return self


class MoonCapabilityDeprecateRequest(BaseModel):
    galaxy_id: uuid.UUID | None = None
    branch_id: uuid.UUID | None = None
    expected_version: int | None = Field(default=None, ge=1)
    idempotency_key: str | None = None

    @model_validator(mode="after")
    def normalize_idempotency(self) -> MoonCapabilityDeprecateRequest:
        if isinstance(self.idempotency_key, str):
            normalized = self.idempotency_key.strip()
            self.idempotency_key = normalized or None
        return self


class MoonCapabilityPublic(BaseModel):
    id: uuid.UUID
    galaxy_id: uuid.UUID
    planet_id: uuid.UUID
    capability_key: str
    capability_class: CapabilityClass
    config: dict[str, Any] = Field(default_factory=dict)
    order_index: int
    status: CapabilityStatus
    version: int
    created_by: uuid.UUID
    created_at: datetime
    updated_at: datetime
    deleted_at: datetime | None


class MoonCapabilityListResponse(BaseModel):
    items: list[MoonCapabilityPublic] = Field(default_factory=list)
