import uuid
from enum import Enum
from datetime import datetime
from typing import Any

from pydantic import BaseModel, ConfigDict, Field, model_validator

class AsteroidIngestRequest(BaseModel):
    value: Any
    metadata: dict[str, Any] = Field(default_factory=dict)
    galaxy_id: uuid.UUID | None = None
    branch_id: uuid.UUID | None = None


class AsteroidMutateRequest(BaseModel):
    value: Any | None = None
    metadata: dict[str, Any] = Field(default_factory=dict)
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


class BondCreateRequest(BaseModel):
    source_id: uuid.UUID
    target_id: uuid.UUID
    type: str
    galaxy_id: uuid.UUID | None = None
    branch_id: uuid.UUID | None = None


class BondResponse(BaseModel):
    model_config = ConfigDict(extra="forbid")

    id: uuid.UUID
    source_id: uuid.UUID
    target_id: uuid.UUID
    type: str
    is_deleted: bool
    created_at: datetime
    deleted_at: datetime | None


class ParseCommandRequest(BaseModel):
    text: str | None = None
    query: str | None = None
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


class ParseCommandResponse(BaseModel):
    model_config = ConfigDict(extra="forbid")

    tasks: list[TaskSchema]
    asteroids: list[AsteroidResponse] = Field(default_factory=list)
    bonds: list[BondResponse] = Field(default_factory=list)
    selected_asteroids: list[AsteroidResponse] = Field(default_factory=list)
    extinguished_asteroid_ids: list[uuid.UUID] = Field(default_factory=list)
    extinguished_bond_ids: list[uuid.UUID] = Field(default_factory=list)


class UniverseAsteroidSnapshot(BaseModel):
    id: uuid.UUID
    value: Any
    table_id: uuid.UUID
    table_name: str
    constellation_name: str
    planet_name: str
    metadata: dict[str, Any] = Field(default_factory=dict)
    calculated_values: dict[str, Any] = Field(default_factory=dict)
    active_alerts: list[str] = Field(default_factory=list)
    created_at: datetime


class UniverseBondSnapshot(BaseModel):
    id: uuid.UUID
    source_id: uuid.UUID
    target_id: uuid.UUID
    type: str
    source_table_id: uuid.UUID
    source_table_name: str
    source_constellation_name: str
    source_planet_name: str
    target_table_id: uuid.UUID
    target_table_name: str
    target_constellation_name: str
    target_planet_name: str


class UniverseSnapshotResponse(BaseModel):
    model_config = ConfigDict(extra="forbid")

    asteroids: list[UniverseAsteroidSnapshot] = Field(default_factory=list)
    bonds: list[UniverseBondSnapshot] = Field(default_factory=list)


class UniverseTableMemberSnapshot(BaseModel):
    id: uuid.UUID
    value: Any
    created_at: datetime | None


class UniverseTableBondSnapshot(BaseModel):
    id: uuid.UUID
    source_id: uuid.UUID
    target_id: uuid.UUID
    type: str
    peer_table_id: uuid.UUID | None = None
    peer_table_name: str | None = None


class UniverseTableSectorSnapshot(BaseModel):
    center: list[float] = Field(default_factory=list)
    size: float
    mode: str
    grid_plate: bool = True


class UniverseTableSnapshot(BaseModel):
    table_id: uuid.UUID
    galaxy_id: uuid.UUID
    name: str
    constellation_name: str
    planet_name: str
    schema_fields: list[str] = Field(default_factory=list)
    formula_fields: list[str] = Field(default_factory=list)
    members: list[UniverseTableMemberSnapshot] = Field(default_factory=list)
    internal_bonds: list[UniverseTableBondSnapshot] = Field(default_factory=list)
    external_bonds: list[UniverseTableBondSnapshot] = Field(default_factory=list)
    sector: UniverseTableSectorSnapshot


class UniverseTablesResponse(BaseModel):
    model_config = ConfigDict(extra="forbid")

    tables: list[UniverseTableSnapshot] = Field(default_factory=list)


class UserPublic(BaseModel):
    id: uuid.UUID
    email: str
    created_at: datetime
    is_active: bool
    deleted_at: datetime | None


class GalaxyPublic(BaseModel):
    id: uuid.UUID
    name: str
    owner_id: uuid.UUID
    created_at: datetime
    deleted_at: datetime | None


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
    source_id: uuid.UUID
    target_id: uuid.UUID
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


class RegisterRequest(BaseModel):
    email: str
    password: str = Field(min_length=8, max_length=256)
    galaxy_name: str | None = None


class LoginRequest(BaseModel):
    email: str
    password: str = Field(min_length=1, max_length=256)


class AuthResponse(BaseModel):
    access_token: str
    token_type: str = "bearer"
    user: UserPublic
    default_galaxy: GalaxyPublic


class GalaxyCreateRequest(BaseModel):
    name: str = Field(min_length=1, max_length=120)


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


class TableContractUpsertRequest(BaseModel):
    galaxy_id: uuid.UUID
    required_fields: list[str] = Field(default_factory=list)
    field_types: dict[str, str] = Field(default_factory=dict)
    unique_rules: list[dict[str, Any]] = Field(default_factory=list)
    validators: list[dict[str, Any]] = Field(default_factory=list)


class TableContractPublic(BaseModel):
    id: uuid.UUID
    galaxy_id: uuid.UUID
    table_id: uuid.UUID
    version: int
    required_fields: list[str] = Field(default_factory=list)
    field_types: dict[str, str] = Field(default_factory=dict)
    unique_rules: list[dict[str, Any]] = Field(default_factory=list)
    validators: list[dict[str, Any]] = Field(default_factory=list)
    created_by: uuid.UUID
    created_at: datetime
    updated_at: datetime
    deleted_at: datetime | None


class ImportModeSchema(str, Enum):
    preview = "preview"
    commit = "commit"


class ImportStatusSchema(str, Enum):
    RUNNING = "RUNNING"
    COMPLETED = "COMPLETED"
    COMPLETED_WITH_ERRORS = "COMPLETED_WITH_ERRORS"
    FAILED = "FAILED"


class ImportJobPublic(BaseModel):
    id: uuid.UUID
    user_id: uuid.UUID
    galaxy_id: uuid.UUID
    filename: str
    file_hash: str
    mode: str
    status: ImportStatusSchema
    total_rows: int
    processed_rows: int
    errors_count: int
    summary: dict[str, Any] = Field(default_factory=dict)
    created_at: datetime
    finished_at: datetime | None


class ImportErrorPublic(BaseModel):
    id: uuid.UUID
    job_id: uuid.UUID
    row_number: int
    column_name: str | None
    code: str
    message: str
    raw_value: str | None
    created_at: datetime


class ImportRunResponse(BaseModel):
    job: ImportJobPublic


class ImportErrorsResponse(BaseModel):
    errors: list[ImportErrorPublic] = Field(default_factory=list)
