from __future__ import annotations

import uuid
from datetime import datetime
from typing import Any

from pydantic import BaseModel, Field


class GalaxySummaryPublic(BaseModel):
    user_id: uuid.UUID
    galaxy_id: uuid.UUID
    constellations_count: int
    planets_count: int
    moons_count: int
    bonds_count: int
    formula_fields_count: int
    updated_at: datetime


class GalaxyHealthPublic(BaseModel):
    user_id: uuid.UUID
    galaxy_id: uuid.UUID
    guardian_rules_count: int
    alerted_asteroids_count: int
    circular_fields_count: int
    quality_score: int
    status: str
    updated_at: datetime


class GalaxyActivityPublic(BaseModel):
    id: uuid.UUID
    user_id: uuid.UUID
    galaxy_id: uuid.UUID
    event_id: uuid.UUID
    event_seq: int
    event_type: str
    entity_id: uuid.UUID
    payload: dict[str, Any] = Field(default_factory=dict)
    happened_at: datetime
    created_at: datetime


class GalaxyActivityResponse(BaseModel):
    items: list[GalaxyActivityPublic] = Field(default_factory=list)


class ConstellationSummaryPublic(BaseModel):
    name: str
    planets_count: int
    planet_names: list[str] = Field(default_factory=list)
    moons_count: int
    formula_fields_count: int
    internal_bonds_count: int
    external_bonds_count: int
    guardian_rules_count: int
    alerted_moons_count: int
    circular_fields_count: int
    quality_score: int
    status: str


class ConstellationSummaryResponse(BaseModel):
    items: list[ConstellationSummaryPublic] = Field(default_factory=list)


class PlanetSummaryPublic(BaseModel):
    table_id: uuid.UUID
    name: str
    constellation_name: str
    archetype: str | None = None
    contract_version: int | None = None
    is_empty: bool = True
    moons_count: int
    schema_fields_count: int
    formula_fields_count: int
    internal_bonds_count: int
    external_bonds_count: int
    guardian_rules_count: int
    alerted_moons_count: int
    circular_fields_count: int
    quality_score: int
    status: str
    sector_mode: str


class PlanetSummaryResponse(BaseModel):
    items: list[PlanetSummaryPublic] = Field(default_factory=list)


class MoonSummaryPublic(BaseModel):
    asteroid_id: uuid.UUID
    label: str
    table_id: uuid.UUID
    table_name: str
    constellation_name: str
    planet_name: str
    metadata_fields_count: int
    calculated_fields_count: int
    guardian_rules_count: int
    active_alerts_count: int
    circular_fields_count: int
    quality_score: int
    status: str
    created_at: datetime | None


class MoonSummaryResponse(BaseModel):
    items: list[MoonSummaryPublic] = Field(default_factory=list)


class BondSummaryPublic(BaseModel):
    bond_id: uuid.UUID
    type: str
    directional: bool
    flow_direction: str
    source_civilization_id: uuid.UUID
    target_civilization_id: uuid.UUID
    source_label: str
    target_label: str
    source_table_id: uuid.UUID
    target_table_id: uuid.UUID
    source_constellation_name: str
    source_planet_name: str
    target_constellation_name: str
    target_planet_name: str
    active_alerts_count: int
    circular_fields_count: int
    quality_score: int
    status: str
    created_at: datetime | None


class BondSummaryResponse(BaseModel):
    items: list[BondSummaryPublic] = Field(default_factory=list)
