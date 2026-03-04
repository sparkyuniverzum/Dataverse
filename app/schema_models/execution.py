from __future__ import annotations

import uuid
from datetime import datetime
from typing import Any

from pydantic import BaseModel, ConfigDict, Field, model_validator


class AsteroidIngestRequest(BaseModel):
    value: Any
    metadata: dict[str, Any] = Field(default_factory=dict)
    idempotency_key: str | None = None
    galaxy_id: uuid.UUID | None = None
    branch_id: uuid.UUID | None = None


class AsteroidMutateRequest(BaseModel):
    value: Any | None = None
    metadata: dict[str, Any] = Field(default_factory=dict)
    expected_event_seq: int | None = Field(default=None, ge=0)
    idempotency_key: str | None = None
    galaxy_id: uuid.UUID | None = None
    branch_id: uuid.UUID | None = None

    @model_validator(mode="after")
    def validate_has_patch(self) -> "AsteroidMutateRequest":
        if self.value is None and not self.metadata:
            raise ValueError("Provide either 'value' or non-empty 'metadata'")
        return self


class AsteroidResponse(BaseModel):
    model_config = ConfigDict(extra="forbid")

    id: uuid.UUID
    value: Any
    metadata: dict[str, Any] = Field(default_factory=dict)
    is_deleted: bool
    created_at: datetime
    deleted_at: datetime | None
    current_event_seq: int = 0


class BondCreateRequest(BaseModel):
    source_id: uuid.UUID
    target_id: uuid.UUID
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
    def validate_type(self) -> "BondMutateRequest":
        if not str(self.type or "").strip():
            raise ValueError("Provide non-empty 'type'")
        self.type = str(self.type).strip()
        return self


class BondResponse(BaseModel):
    model_config = ConfigDict(extra="forbid")

    id: uuid.UUID
    source_id: uuid.UUID
    target_id: uuid.UUID
    type: str
    directional: bool = False
    flow_direction: str = "bidirectional"
    is_deleted: bool
    created_at: datetime
    deleted_at: datetime | None
    current_event_seq: int = 0


class ParseCommandRequest(BaseModel):
    text: str | None = None
    query: str | None = None
    parser_version: str = "v2"
    idempotency_key: str | None = None
    galaxy_id: uuid.UUID | None = None
    branch_id: uuid.UUID | None = None

    @model_validator(mode="after")
    def validate_text_or_query(self) -> "ParseCommandRequest":
        text = self.text.strip() if isinstance(self.text, str) else None
        query = self.query.strip() if isinstance(self.query, str) else None

        if text:
            self.text = text
        if query:
            self.query = query

        if not text and not query:
            raise ValueError("Provide either 'text' or 'query'")

        if text and query and text != query:
            raise ValueError("'text' and 'query' must match when both are provided")

        version = (self.parser_version or "v2").strip().lower()
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


class TaskSchema(BaseModel):
    action: str
    params: dict[str, Any]


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
    asteroids: list[AsteroidResponse] = Field(default_factory=list)
    bonds: list[BondResponse] = Field(default_factory=list)
    selected_asteroids: list[AsteroidResponse] = Field(default_factory=list)
    extinguished_asteroid_ids: list[uuid.UUID] = Field(default_factory=list)
    extinguished_bond_ids: list[uuid.UUID] = Field(default_factory=list)
    semantic_effects: list[SemanticEffect] = Field(default_factory=list)


class TaskBatchExecuteRequest(BaseModel):
    tasks: list[TaskSchema]
    mode: str = "commit"
    idempotency_key: str | None = None
    galaxy_id: uuid.UUID | None = None
    branch_id: uuid.UUID | None = None

    @model_validator(mode="after")
    def validate_payload(self) -> "TaskBatchExecuteRequest":
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
