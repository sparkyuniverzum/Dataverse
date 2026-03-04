from __future__ import annotations

import uuid
from datetime import datetime
from typing import Any

from pydantic import BaseModel, Field, model_validator


class BranchCreateRequest(BaseModel):
    name: str = Field(min_length=1, max_length=120)
    galaxy_id: uuid.UUID | None = None
    as_of: datetime | None = None


class BranchPublic(BaseModel):
    id: uuid.UUID
    galaxy_id: uuid.UUID
    name: str
    base_event_id: uuid.UUID | None
    created_by: uuid.UUID
    created_at: datetime
    deleted_at: datetime | None


class BranchPromoteResponse(BaseModel):
    branch: BranchPublic
    promoted_events_count: int


def _normalize_contract_string_list(values: list[Any]) -> list[str]:
    normalized: list[str] = []
    seen: set[str] = set()
    for raw in values:
        value = str(raw).strip()
        if not value or value in seen:
            continue
        seen.add(value)
        normalized.append(value)
    return normalized


def _normalize_contract_dict_list(values: list[Any]) -> list[dict[str, Any]]:
    return [item for item in values if isinstance(item, dict)]


class TableContractUpsertRequest(BaseModel):
    galaxy_id: uuid.UUID
    schema_registry: dict[str, Any] = Field(default_factory=dict)
    required_fields: list[str] = Field(default_factory=list)
    field_types: dict[str, str] = Field(default_factory=dict)
    unique_rules: list[dict[str, Any]] = Field(default_factory=list)
    validators: list[dict[str, Any]] = Field(default_factory=list)
    auto_semantics: list[dict[str, Any]] = Field(default_factory=list)
    formula_registry: list[dict[str, Any]] = Field(default_factory=list)
    physics_rulebook: dict[str, Any] = Field(default_factory=dict)

    @model_validator(mode="after")
    def normalize_registries(self) -> "TableContractUpsertRequest":
        schema = self.schema_registry if isinstance(self.schema_registry, dict) else {}

        if not self.required_fields:
            schema_required = schema.get("required_fields")
            if isinstance(schema_required, list):
                self.required_fields = [str(item) for item in schema_required]
        if not self.field_types:
            schema_field_types = schema.get("field_types")
            if isinstance(schema_field_types, dict):
                self.field_types = {
                    str(key): str(value)
                    for key, value in schema_field_types.items()
                    if str(key).strip() and str(value).strip()
                }
        if not self.unique_rules:
            schema_unique_rules = schema.get("unique_rules")
            if isinstance(schema_unique_rules, list):
                self.unique_rules = _normalize_contract_dict_list(schema_unique_rules)
        if not self.validators:
            schema_validators = schema.get("validators")
            if isinstance(schema_validators, list):
                self.validators = _normalize_contract_dict_list(schema_validators)
        if not self.auto_semantics:
            schema_auto_semantics = schema.get("auto_semantics")
            if isinstance(schema_auto_semantics, list):
                self.auto_semantics = _normalize_contract_dict_list(schema_auto_semantics)

        self.required_fields = _normalize_contract_string_list(self.required_fields)
        self.field_types = {
            str(key).strip(): str(value).strip().lower()
            for key, value in (self.field_types or {}).items()
            if str(key).strip() and str(value).strip()
        }
        self.unique_rules = _normalize_contract_dict_list(self.unique_rules)
        self.validators = _normalize_contract_dict_list(self.validators)
        self.auto_semantics = _normalize_contract_dict_list(self.auto_semantics)
        self.formula_registry = _normalize_contract_dict_list(self.formula_registry)

        if not isinstance(self.physics_rulebook, dict):
            self.physics_rulebook = {}
        rules = self.physics_rulebook.get("rules")
        defaults = self.physics_rulebook.get("defaults")
        self.physics_rulebook = {
            "rules": _normalize_contract_dict_list(rules if isinstance(rules, list) else []),
            "defaults": defaults if isinstance(defaults, dict) else {},
        }

        self.schema_registry = {
            "required_fields": self.required_fields,
            "field_types": self.field_types,
            "unique_rules": self.unique_rules,
            "validators": self.validators,
            "auto_semantics": self.auto_semantics,
        }
        return self


class TableContractPublic(BaseModel):
    id: uuid.UUID
    galaxy_id: uuid.UUID
    table_id: uuid.UUID
    version: int
    required_fields: list[str] = Field(default_factory=list)
    field_types: dict[str, str] = Field(default_factory=dict)
    unique_rules: list[dict[str, Any]] = Field(default_factory=list)
    validators: list[dict[str, Any]] = Field(default_factory=list)
    auto_semantics: list[dict[str, Any]] = Field(default_factory=list)
    schema_registry: dict[str, Any] = Field(default_factory=dict)
    formula_registry: list[dict[str, Any]] = Field(default_factory=list)
    physics_rulebook: dict[str, Any] = Field(default_factory=dict)
    created_by: uuid.UUID
    created_at: datetime
    updated_at: datetime
    deleted_at: datetime | None
