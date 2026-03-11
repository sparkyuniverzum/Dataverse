from __future__ import annotations

import uuid
from datetime import datetime
from typing import Any

from pydantic import BaseModel, ConfigDict, Field, model_validator

from app.core.parser2.intents import Intent
from app.domains.bonds.schemas import (
    BondResponse,
)
from app.domains.civilizations.schemas import (
    CivilizationResponse,
)


class TaskSchema(BaseModel):
    action: str
    target: str | None = None
    params: dict[str, Any] = Field(default_factory=dict)
    source_text: str = ""


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


class ParseCommandPlanResponse(BaseModel):
    model_config = ConfigDict(extra="forbid")

    tasks: list[TaskSchema] = Field(default_factory=list)
    parser_version: str = "v2"


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
