from __future__ import annotations

import uuid
from enum import StrEnum

from pydantic import BaseModel, Field, model_validator

from app.schema_models.branch_contracts import TableContractPublic
from app.schema_models.universe import UniverseTableSectorSnapshot, UniverseTableSnapshot


class PlanetArchetype(StrEnum):
    catalog = "catalog"
    stream = "stream"
    junction = "junction"


class PlanetSchemaMode(StrEnum):
    empty = "empty"
    preset = "preset"


class PlanetVisualPosition(BaseModel):
    x: float
    y: float
    z: float


class PlanetCreateRequest(BaseModel):
    name: str = Field(min_length=2, max_length=120)
    archetype: PlanetArchetype = PlanetArchetype.catalog
    visual_position: PlanetVisualPosition | None = None
    initial_schema_mode: PlanetSchemaMode = PlanetSchemaMode.empty
    schema_preset_key: str | None = None
    seed_rows: bool = True
    idempotency_key: str | None = None
    galaxy_id: uuid.UUID | None = None
    branch_id: uuid.UUID | None = None

    @model_validator(mode="after")
    def normalize_payload(self) -> PlanetCreateRequest:
        self.name = str(self.name or "").strip()
        schema_preset_key = str(self.schema_preset_key or "").strip()
        self.schema_preset_key = schema_preset_key or None
        if self.initial_schema_mode == PlanetSchemaMode.preset and not self.schema_preset_key:
            raise ValueError("`schema_preset_key` is required when initial_schema_mode='preset'")
        return self


class PlanetCreateResponse(BaseModel):
    table_id: uuid.UUID
    table_name: str
    constellation_name: str
    planet_name: str
    archetype: PlanetArchetype
    contract: TableContractPublic
    table: UniverseTableSnapshot


class PlanetPublic(BaseModel):
    table_id: uuid.UUID
    table_name: str
    constellation_name: str
    planet_name: str
    archetype: PlanetArchetype | None = None
    contract_version: int | None = None
    moons_count: int = 0
    schema_fields: list[str] = Field(default_factory=list)
    formula_fields: list[str] = Field(default_factory=list)
    internal_bonds_count: int = 0
    external_bonds_count: int = 0
    sector: UniverseTableSectorSnapshot
    is_empty: bool = True
    contract: TableContractPublic | None = None


class PlanetListResponse(BaseModel):
    items: list[PlanetPublic] = Field(default_factory=list)


class PlanetExtinguishResponse(BaseModel):
    table_id: uuid.UUID
    extinguished: bool
    deleted_contract_versions: int = 0
