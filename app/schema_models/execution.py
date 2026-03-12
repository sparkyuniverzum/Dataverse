from __future__ import annotations

import uuid
from datetime import datetime
from typing import Any

from pydantic import BaseModel, ConfigDict, Field, model_validator

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
    selected_civilizations: list[CivilizationResponse] = Field(default_factory=list)
    extinguished_civilization_ids: list[uuid.UUID] = Field(default_factory=list)
    extinguished_bond_ids: list[uuid.UUID] = Field(default_factory=list)
    semantic_effects: list[SemanticEffect] = Field(default_factory=list)


class ParseCommandPlanResponse(BaseModel):
    model_config = ConfigDict(extra="forbid")

    tasks: list[TaskSchema] = Field(default_factory=list)
    parser_version: str = "v2"


class ParserLexiconCommand(BaseModel):
    model_config = ConfigDict(extra="forbid")

    key: str
    syntax: str
    description: str
    intent_kind: str
    atomic_actions: list[str] = Field(default_factory=list)
    aliases: list[str] = Field(default_factory=list)
    examples: list[str] = Field(default_factory=list)


class ParseCommandLexiconResponse(BaseModel):
    model_config = ConfigDict(extra="forbid")

    language: str = "cs-CZ"
    lexicon_version: str = "1.0"
    parser_v2_intents: list[str] = Field(default_factory=list)
    bridge_actions: list[str] = Field(default_factory=list)
    legacy_patterns: list[str] = Field(default_factory=list)
    reserved_terms: list[str] = Field(default_factory=list)
    notes: list[str] = Field(default_factory=list)
    commands: list[ParserLexiconCommand] = Field(default_factory=list)


class ParserAliasRecord(BaseModel):
    model_config = ConfigDict(extra="forbid")

    alias_id: uuid.UUID
    scope_type: str
    galaxy_id: uuid.UUID
    owner_user_id: uuid.UUID | None = None
    alias_phrase: str
    canonical_command: str
    is_active: bool = True
    created_at: datetime
    updated_at: datetime
    version: int = 1


class ParserAliasesResponse(BaseModel):
    model_config = ConfigDict(extra="forbid")

    aliases: list[ParserAliasRecord] = Field(default_factory=list)
    precedence: list[str] = Field(default_factory=lambda: ["personal", "workspace", "canonical"])


class ParserAliasUpsertRequest(BaseModel):
    model_config = ConfigDict(extra="forbid")

    scope_type: str = "personal"
    galaxy_id: uuid.UUID | None = None
    alias_phrase: str
    canonical_command: str

    @model_validator(mode="after")
    def validate_payload(self) -> ParserAliasUpsertRequest:
        normalized_scope = str(self.scope_type or "").strip().lower()
        if normalized_scope not in {"personal", "workspace"}:
            raise ValueError("`scope_type` must be either 'personal' or 'workspace'")
        self.scope_type = normalized_scope
        self.alias_phrase = " ".join(str(self.alias_phrase or "").strip().split())
        self.canonical_command = " ".join(str(self.canonical_command or "").strip().split())
        if not self.alias_phrase:
            raise ValueError("`alias_phrase` must not be empty")
        if not self.canonical_command:
            raise ValueError("`canonical_command` must not be empty")
        return self


class ParserAliasPatchRequest(BaseModel):
    model_config = ConfigDict(extra="forbid")

    alias_phrase: str | None = None
    canonical_command: str | None = None
    is_active: bool | None = None

    @model_validator(mode="after")
    def validate_payload(self) -> ParserAliasPatchRequest:
        self.alias_phrase = (
            " ".join(str(self.alias_phrase or "").strip().split()) if self.alias_phrase is not None else None
        )
        self.canonical_command = (
            " ".join(str(self.canonical_command or "").strip().split()) if self.canonical_command is not None else None
        )
        if self.alias_phrase is None and self.canonical_command is None and self.is_active is None:
            raise ValueError("Provide at least one field to patch.")
        return self


class ParserAliasMutationResponse(BaseModel):
    model_config = ConfigDict(extra="forbid")

    alias: ParserAliasRecord
    event_type: str


class ParseCommandPreviewScope(BaseModel):
    model_config = ConfigDict(extra="forbid")

    galaxy_id: uuid.UUID | None = None
    branch_id: uuid.UUID | None = None


class ParseCommandPreviewRiskFlags(BaseModel):
    model_config = ConfigDict(extra="forbid")

    mutating: bool = False
    destructive: bool = False
    multi_step: bool = False
    scope_sensitive: bool = False
    requires_confirmation: bool = False


class ParseCommandPreviewExpectedEvent(BaseModel):
    model_config = ConfigDict(extra="forbid")

    action: str
    event_types: list[str] = Field(default_factory=list)
    because: str


class ParseCommandPreviewOccSignal(BaseModel):
    model_config = ConfigDict(extra="forbid")

    action: str
    entity_kind: str
    entity_id: uuid.UUID | None = None
    selector: str | None = None
    expected_event_seq: int | None = None
    current_event_seq: int | None = None
    known: bool = False
    because: str


class ParseCommandPreviewResponse(BaseModel):
    model_config = ConfigDict(extra="forbid")

    resolved_command: str
    parser_version_requested: str
    parser_version_effective: str
    parser_path: str
    alias_used: bool = False
    alias_id: uuid.UUID | None = None
    alias_phrase: str | None = None
    alias_scope_type: str | None = None
    alias_version: int | None = None
    fallback_used: bool = False
    fallback_policy_mode: str
    fallback_policy_reason: str
    fallback_detail: str | None = None
    intents: list[str] = Field(default_factory=list)
    tasks: list[TaskSchema] = Field(default_factory=list)
    expected_events: list[ParseCommandPreviewExpectedEvent] = Field(default_factory=list)
    occ_signals: list[ParseCommandPreviewOccSignal] = Field(default_factory=list)
    risk_flags: ParseCommandPreviewRiskFlags
    scope: ParseCommandPreviewScope
    next_step_hint: str


class TaskBatchExecuteRequest(BaseModel):
    tasks: list[TaskSchema]
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
