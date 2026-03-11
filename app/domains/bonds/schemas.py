from __future__ import annotations

import uuid
from datetime import datetime
from typing import Literal

from pydantic import BaseModel, ConfigDict, Field, model_validator


class BondCreateRequest(BaseModel):
    source_civilization_id: uuid.UUID
    target_civilization_id: uuid.UUID
    type: str
    expected_source_event_seq: int | None = Field(default=None, ge=0)
    expected_target_event_seq: int | None = Field(default=None, ge=0)
    idempotency_key: str | None = None
    galaxy_id: uuid.UUID | None = None
    branch_id: uuid.UUID | None = None


class BondMutateRequest(BaseModel):
    type: str
    expected_event_seq: int | None = Field(default=None, ge=0)
    idempotency_key: str | None = None
    galaxy_id: uuid.UUID | None = None
    branch_id: uuid.UUID | None = None

    @model_validator(mode="after")
    def validate_type(self) -> BondMutateRequest:
        if not str(self.type or "").strip():
            raise ValueError("Provide non-empty 'type'")
        self.type = str(self.type).strip()
        return self


class BondResponse(BaseModel):
    model_config = ConfigDict(extra="forbid")

    id: uuid.UUID
    source_civilization_id: uuid.UUID
    target_civilization_id: uuid.UUID
    type: str
    directional: bool = False
    flow_direction: str = "bidirectional"
    is_deleted: bool
    created_at: datetime
    deleted_at: datetime | None
    current_event_seq: int = 0


class BondValidateRequest(BaseModel):
    operation: Literal["create", "mutate", "extinguish"] = "create"
    source_civilization_id: uuid.UUID | None = None
    target_civilization_id: uuid.UUID | None = None
    bond_id: uuid.UUID | None = None
    type: str = "RELATION"
    expected_source_event_seq: int | None = Field(default=None, ge=0)
    expected_target_event_seq: int | None = Field(default=None, ge=0)
    expected_bond_event_seq: int | None = Field(default=None, ge=0)
    galaxy_id: uuid.UUID | None = None
    branch_id: uuid.UUID | None = None

    @model_validator(mode="after")
    def validate_shape(self) -> BondValidateRequest:
        operation = str(self.operation or "create").strip().lower()
        self.operation = operation  # type: ignore[assignment]
        bond_type = str(self.type or "RELATION").strip()
        self.type = bond_type or "RELATION"

        if operation == "create":
            if self.source_civilization_id is None or self.target_civilization_id is None:
                raise ValueError("`create` requires source_civilization_id and target_civilization_id")
            return self
        if operation == "mutate":
            if self.bond_id is None:
                raise ValueError("`mutate` requires bond_id")
            if not self.type.strip():
                raise ValueError("`mutate` requires non-empty type")
            if self.expected_bond_event_seq is None:
                raise ValueError("`mutate` requires expected_bond_event_seq")
            return self
        if operation == "extinguish":
            if self.bond_id is None:
                raise ValueError("`extinguish` requires bond_id")
            if self.expected_bond_event_seq is None:
                raise ValueError("`extinguish` requires expected_bond_event_seq")
            return self
        raise ValueError("Unsupported operation")


class BondValidateReason(BaseModel):
    code: str
    severity: Literal["info", "warning", "error"] = "error"
    blocking: bool = True
    message: str
    rule_id: str | None = None
    capability_id: str | None = None
    context: dict[str, object] = Field(default_factory=dict)


class BondValidateNormalized(BaseModel):
    source_civilization_id: uuid.UUID | None = None
    target_civilization_id: uuid.UUID | None = None
    type: str = "RELATION"
    directional: bool = False
    flow_direction: str = "bidirectional"
    canonical_pair: str | None = None


class BondValidatePreview(BaseModel):
    cross_planet: bool = False
    source_planet_id: uuid.UUID | None = None
    target_planet_id: uuid.UUID | None = None
    existing_bond_id: uuid.UUID | None = None
    would_create: bool = False
    would_replace: bool = False
    would_extinguish: bool = False


class BondValidateResponse(BaseModel):
    decision: Literal["ALLOW", "REJECT", "WARN"] = "ALLOW"
    accepted: bool = True
    blocking: bool = False
    normalized: BondValidateNormalized
    preview: BondValidatePreview
    reasons: list[BondValidateReason] = Field(default_factory=list)


__all__ = [
    "BondCreateRequest",
    "BondMutateRequest",
    "BondResponse",
    "BondValidateNormalized",
    "BondValidatePreview",
    "BondValidateReason",
    "BondValidateRequest",
    "BondValidateResponse",
]
