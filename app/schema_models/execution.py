from __future__ import annotations

import uuid
from datetime import datetime
from typing import Any, Literal

from pydantic import BaseModel, ConfigDict, Field, model_validator

from app.services.parser2.intents import Intent


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


class CivilizationResponse(BaseModel):
    model_config = ConfigDict(extra="forbid")

    id: uuid.UUID
    value: Any
    metadata: dict[str, Any] = Field(default_factory=dict)
    is_deleted: bool
    created_at: datetime
    deleted_at: datetime | None
    current_event_seq: int = 0


class TaskSchema(BaseModel):
    action: str
    target: str | None = None
    params: dict[str, Any] = Field(default_factory=dict)
    source_text: str = ""


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
    context: dict[str, Any] = Field(default_factory=dict)


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


class ParseCommandRequest(BaseModel):
    text: str | None = None
    query: str | None = None
    parser_version: str = "v2"
    idempotency_key: str | None = None
    galaxy_id: uuid.UUID | None = None
    branch_id: uuid.UUID | None = None

    @model_validator(mode="after")
    def validate_text_or_query(self) -> ParseCommandRequest:
        text = self.text.strip() if isinstance(self.text, str) else None
        query = self.query.strip() if isinstance(self.query, str) else None
        version = (self.parser_version or "v2").strip().lower()

        if text:
            self.text = text
        if query:
            self.query = query

        if not text and not query:
            raise ValueError("Provide either 'text' or 'query'")

        if text and query and text != query:
            raise ValueError("'text' and 'query' must match when both are provided")

        if version not in {"v1", "v2"}:
            raise ValueError("`parser_version` must be either 'v1' or 'v2'")

        if self.parser_version != version:
            self.parser_version = version

        return self

    @property
    def command(self) -> str:
        if self.query:
            return self.query
        if self.text:
            return self.text
        return ""


class SemanticEffect(BaseModel):
    model_config = ConfigDict(extra="forbid")

    id: str
    timestamp: datetime
    code: str
    severity: str = "info"
    confidence: str = "certain"
    because: str | None = None
    rule_id: str | None = None
    reason: str
    task_action: str
    inputs: dict[str, Any] = Field(default_factory=dict)
    outputs: dict[str, Any] = Field(default_factory=dict)


class ParseCommandResponse(BaseModel):
    model_config = ConfigDict(extra="forbid")

    tasks: list[TaskSchema]
    civilizations: list[CivilizationResponse] = Field(default_factory=list)
    bonds: list[BondResponse] = Field(default_factory=list)
    selected_asteroids: list[CivilizationResponse] = Field(default_factory=list)
    extinguished_civilization_ids: list[uuid.UUID] = Field(default_factory=list)
    extinguished_bond_ids: list[uuid.UUID] = Field(default_factory=list)
    semantic_effects: list[SemanticEffect] = Field(default_factory=list)


class TaskBatchExecuteRequest(BaseModel):
    tasks: list[TaskSchema | Intent]
    mode: str = "commit"
    idempotency_key: str | None = None
    galaxy_id: uuid.UUID | None = None
    branch_id: uuid.UUID | None = None

    @model_validator(mode="after")
    def validate_payload(self) -> TaskBatchExecuteRequest:
        if not self.tasks:
            raise ValueError("Provide non-empty 'tasks'")
        mode = str(self.mode or "commit").strip().lower()
        if mode not in {"preview", "commit"}:
            raise ValueError("`mode` must be either 'preview' or 'commit'")
        self.mode = mode
        return self


class TaskBatchExecuteResponse(BaseModel):
    mode: str
    task_count: int
    result: ParseCommandResponse
