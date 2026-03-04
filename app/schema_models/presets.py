from __future__ import annotations

import uuid
from enum import Enum
from typing import Any

from pydantic import BaseModel, Field, model_validator

from app.schema_models.branch_contracts import TableContractPublic
from app.schema_models.execution import ParseCommandResponse


class SchemaPresetSeedRowPublic(BaseModel):
    value: Any
    metadata: dict[str, Any] = Field(default_factory=dict)


class SchemaPresetSummaryPublic(BaseModel):
    key: str
    version: int
    name: str
    description: str
    tags: list[str] = Field(default_factory=list)
    fields_count: int
    required_fields_count: int
    seed_rows_count: int


class SchemaPresetPublic(SchemaPresetSummaryPublic):
    required_fields: list[str] = Field(default_factory=list)
    field_types: dict[str, str] = Field(default_factory=dict)
    unique_rules: list[dict[str, Any]] = Field(default_factory=list)
    validators: list[dict[str, Any]] = Field(default_factory=list)
    auto_semantics: list[dict[str, Any]] = Field(default_factory=list)
    formula_registry: list[dict[str, Any]] = Field(default_factory=list)
    physics_rulebook: dict[str, Any] = Field(default_factory=dict)
    default_rows: list[SchemaPresetSeedRowPublic] = Field(default_factory=list)


class SchemaPresetListResponse(BaseModel):
    presets: list[SchemaPresetSummaryPublic] = Field(default_factory=list)


class PresetApplyMode(str, Enum):
    preview = "preview"
    commit = "commit"


class PresetConflictStrategy(str, Enum):
    skip = "skip"
    overwrite = "overwrite"


class SchemaPresetApplyRequest(BaseModel):
    preset_key: str
    mode: PresetApplyMode = PresetApplyMode.preview
    conflict_strategy: PresetConflictStrategy = PresetConflictStrategy.skip
    seed_rows: bool = True
    target_table_name: str | None = None
    idempotency_key: str | None = None
    galaxy_id: uuid.UUID | None = None
    branch_id: uuid.UUID | None = None

    @model_validator(mode="after")
    def validate_payload(self) -> "SchemaPresetApplyRequest":
        preset_key = str(self.preset_key or "").strip()
        if not preset_key:
            raise ValueError("`preset_key` is required")
        self.preset_key = preset_key
        table_name = str(self.target_table_name or "").strip()
        self.target_table_name = table_name or None
        return self


class SchemaPresetApplyDiffPublic(BaseModel):
    added_fields: list[str] = Field(default_factory=list)
    added_required_fields: list[str] = Field(default_factory=list)
    conflicts: list[dict[str, Any]] = Field(default_factory=list)


class SchemaPresetSeedPlanPublic(BaseModel):
    requested_rows: int
    skipped_existing_rows: int
    rows_to_create: int
    skipped_values: list[str] = Field(default_factory=list)


class SchemaPresetContractPreviewPublic(BaseModel):
    schema_registry: dict[str, Any] = Field(default_factory=dict)
    required_fields: list[str] = Field(default_factory=list)
    field_types: dict[str, str] = Field(default_factory=dict)
    unique_rules: list[dict[str, Any]] = Field(default_factory=list)
    validators: list[dict[str, Any]] = Field(default_factory=list)
    auto_semantics: list[dict[str, Any]] = Field(default_factory=list)
    formula_registry: list[dict[str, Any]] = Field(default_factory=list)
    physics_rulebook: dict[str, Any] = Field(default_factory=dict)


class SchemaPresetApplyResponse(BaseModel):
    mode: PresetApplyMode
    preset: SchemaPresetSummaryPublic
    table_id: uuid.UUID
    table_name: str
    conflict_strategy: PresetConflictStrategy
    diff: SchemaPresetApplyDiffPublic
    contract_preview: SchemaPresetContractPreviewPublic
    seed_plan: SchemaPresetSeedPlanPublic
    contract: TableContractPublic | None = None
    result: ParseCommandResponse | None = None


class PresetBundleSummaryPublic(BaseModel):
    key: str
    version: int
    name: str
    description: str
    tags: list[str] = Field(default_factory=list)
    planets_count: int = 0
    moons_count: int = 0
    bonds_count: int = 0
    formulas_count: int = 0
    guardians_count: int = 0


class PresetBundlePublic(PresetBundleSummaryPublic):
    manifest: dict[str, Any] = Field(default_factory=dict)


class PresetBundleListResponse(BaseModel):
    bundles: list[PresetBundleSummaryPublic] = Field(default_factory=list)


class PresetBundleApplyRequest(BaseModel):
    bundle_key: str | None = None
    manifest: dict[str, Any] | None = None
    mode: PresetApplyMode = PresetApplyMode.preview
    conflict_strategy: PresetConflictStrategy = PresetConflictStrategy.skip
    seed_rows: bool = True
    idempotency_key: str | None = None
    galaxy_id: uuid.UUID | None = None
    branch_id: uuid.UUID | None = None

    @model_validator(mode="after")
    def validate_payload(self) -> "PresetBundleApplyRequest":
        key = str(self.bundle_key or "").strip()
        has_manifest = isinstance(self.manifest, dict) and bool(self.manifest)
        if not key and not has_manifest:
            raise ValueError("Provide either `bundle_key` or `manifest`")
        if key:
            self.bundle_key = key
        else:
            self.bundle_key = None
        if not has_manifest:
            self.manifest = None
        return self


class PresetBundleApplyPlanetResultPublic(BaseModel):
    planet_key: str
    table_id: uuid.UUID
    table_name: str
    schema_preset_key: str | None = None
    diff: SchemaPresetApplyDiffPublic
    contract_preview: SchemaPresetContractPreviewPublic
    seed_plan: SchemaPresetSeedPlanPublic
    contract: TableContractPublic | None = None


class PresetBundleGraphPlanPublic(BaseModel):
    moons_requested: int = 0
    moons_to_create: int = 0
    bonds_requested: int = 0
    formulas_requested: int = 0
    guardians_requested: int = 0


class PresetBundleExecutionPublic(BaseModel):
    task_count: int = 0
    touched_moons: int = 0
    touched_bonds: int = 0
    semantic_effects_count: int = 0


class PresetBundleApplyResponse(BaseModel):
    mode: PresetApplyMode
    bundle: PresetBundleSummaryPublic
    planets: list[PresetBundleApplyPlanetResultPublic] = Field(default_factory=list)
    graph_plan: PresetBundleGraphPlanPublic
    created_refs: dict[str, uuid.UUID] = Field(default_factory=dict)
    execution: PresetBundleExecutionPublic | None = None
    warnings: list[str] = Field(default_factory=list)
