from __future__ import annotations

import uuid
from datetime import datetime
from typing import Any

from pydantic import BaseModel, ConfigDict, Field, model_validator


class CivilizationIngestRequest(BaseModel):
    value: Any
    metadata: dict[str, Any] = Field(default_factory=dict)
    idempotency_key: str | None = None
    galaxy_id: uuid.UUID | None = None
    branch_id: uuid.UUID | None = None


class CivilizationMutateRequest(BaseModel):
    value: Any | None = None
    metadata: dict[str, Any] = Field(default_factory=dict)
    expected_event_seq: int | None = Field(default=None, ge=0)
    idempotency_key: str | None = None
    galaxy_id: uuid.UUID | None = None
    branch_id: uuid.UUID | None = None

    @model_validator(mode="after")
    def validate_has_patch(self) -> CivilizationMutateRequest:
        if self.value is None and not self.metadata:
            raise ValueError("Provide either 'value' or non-empty 'metadata'")
        return self


class CivilizationMineralMutateRequest(BaseModel):
    typed_value: Any | None = None
    remove: bool = False
    expected_event_seq: int = Field(ge=0)
    idempotency_key: str | None = None
    galaxy_id: uuid.UUID | None = None
    branch_id: uuid.UUID | None = None

    @model_validator(mode="after")
    def validate_patch(self) -> CivilizationMineralMutateRequest:
        typed_value_explicit = "typed_value" in self.model_fields_set
        if self.remove and typed_value_explicit:
            raise ValueError("Provide either `remove=true` or `typed_value`, not both")
        if not self.remove and not typed_value_explicit:
            raise ValueError("Provide `typed_value` or set `remove=true`")
        return self


class CivilizationResponse(BaseModel):
    model_config = ConfigDict(extra="forbid")

    id: uuid.UUID
    value: Any
    metadata: dict[str, Any] = Field(default_factory=dict)
    is_deleted: bool
    created_at: datetime
    deleted_at: datetime | None
    current_event_seq: int = 0


__all__ = [
    "CivilizationIngestRequest",
    "CivilizationMineralMutateRequest",
    "CivilizationMutateRequest",
    "CivilizationResponse",
]
