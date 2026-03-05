from __future__ import annotations

import uuid
from datetime import datetime
from typing import Any

from pydantic import BaseModel, Field, model_validator

from app.schema_models.universe import MoonRowContract


class MoonCreateRequest(BaseModel):
    planet_id: uuid.UUID
    label: Any
    minerals: dict[str, Any] = Field(default_factory=dict)
    idempotency_key: str | None = None
    galaxy_id: uuid.UUID | None = None
    branch_id: uuid.UUID | None = None

    @model_validator(mode="after")
    def validate_label(self) -> MoonCreateRequest:
        if isinstance(self.label, str) and not self.label.strip():
            raise ValueError("`label` cannot be empty")
        return self


class MoonMutateRequest(BaseModel):
    label: Any | None = None
    minerals: dict[str, Any] = Field(default_factory=dict)
    planet_id: uuid.UUID | None = None
    expected_event_seq: int | None = Field(default=None, ge=0)
    idempotency_key: str | None = None
    galaxy_id: uuid.UUID | None = None
    branch_id: uuid.UUID | None = None

    @model_validator(mode="after")
    def validate_has_patch(self) -> MoonMutateRequest:
        if self.label is None and not self.minerals and self.planet_id is None:
            raise ValueError("Provide `label`, non-empty `minerals`, or `planet_id`")
        if isinstance(self.label, str) and not self.label.strip():
            raise ValueError("`label` cannot be empty")
        return self


class MoonListResponse(BaseModel):
    items: list[MoonRowContract] = Field(default_factory=list)


class MoonExtinguishResponse(BaseModel):
    moon_id: uuid.UUID
    label: str
    planet_id: uuid.UUID
    constellation_name: str
    planet_name: str
    is_deleted: bool = True
    deleted_at: datetime | None
    current_event_seq: int = 0
