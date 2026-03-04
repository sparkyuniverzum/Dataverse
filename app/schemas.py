import uuid
from enum import Enum
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


class UniverseAsteroidSnapshot(BaseModel):
    id: uuid.UUID
    value: Any
    table_id: uuid.UUID
    table_name: str
    constellation_name: str
    planet_name: str
    metadata: dict[str, Any] = Field(default_factory=dict)
    calculated_values: dict[str, Any] = Field(default_factory=dict)
    calc_errors: list[Any] = Field(default_factory=list)
    error_count: int = 0
    circular_fields_count: int = 0
    active_alerts: list[str] = Field(default_factory=list)
    physics: dict[str, Any] = Field(default_factory=dict)
    facts: list["MineralFact"] = Field(default_factory=list)
    created_at: datetime
    current_event_seq: int = 0


class FactValueType(str, Enum):
    STRING = "string"
    NUMBER = "number"
    BOOLEAN = "boolean"
    DATETIME = "datetime"
    JSON = "json"
    NULL = "null"


class FactSource(str, Enum):
    VALUE = "value"
    METADATA = "metadata"
    CALCULATED = "calculated"


class FactStatus(str, Enum):
    VALID = "valid"
    HOLOGRAM = "hologram"
    INVALID = "invalid"


class MineralFact(BaseModel):
    key: str
    typed_value: Any = None
    value_type: FactValueType = FactValueType.STRING
    source: FactSource = FactSource.METADATA
    status: FactStatus = FactStatus.VALID
    unit: str | None = None
    readonly: bool = False
    errors: list[str] = Field(default_factory=list)


class MoonRowContract(BaseModel):
    moon_id: uuid.UUID
    label: str
    planet_id: uuid.UUID
    constellation_name: str
    planet_name: str
    created_at: datetime
    current_event_seq: int = 0
    active_alerts: list[str] = Field(default_factory=list)
    facts: list[MineralFact] = Field(default_factory=list)


FACT_RESERVED_METADATA_KEYS = {
    "table",
    "table_id",
    "table_name",
    "constellation_name",
    "planet_name",
}


def infer_fact_value_type(value: Any) -> FactValueType:
    if value is None:
        return FactValueType.NULL
    if isinstance(value, bool):
        return FactValueType.BOOLEAN
    if isinstance(value, int | float):
        return FactValueType.NUMBER
    if isinstance(value, datetime):
        return FactValueType.DATETIME
    if isinstance(value, str):
        candidate = value.strip()
        if candidate:
            try:
                datetime.fromisoformat(candidate.replace("Z", "+00:00"))
                return FactValueType.DATETIME
            except ValueError:
                return FactValueType.STRING
        return FactValueType.STRING
    if isinstance(value, list | dict):
        return FactValueType.JSON
    return FactValueType.JSON


def build_moon_facts(
    *,
    value: Any,
    metadata: dict[str, Any] | None = None,
    calculated_values: dict[str, Any] | None = None,
    calc_errors: list[Any] | None = None,
) -> list[MineralFact]:
    metadata_dict = metadata if isinstance(metadata, dict) else {}
    calculated_dict = calculated_values if isinstance(calculated_values, dict) else {}
    calc_errors_list = calc_errors if isinstance(calc_errors, list) else []
    errors_by_field: dict[str, list[str]] = {}
    for item in calc_errors_list:
        if not isinstance(item, dict):
            continue
        field = str(item.get("field") or "").strip()
        code = str(item.get("code") or "").strip()
        message = str(item.get("message") or "").strip()
        if not field:
            continue
        line = message or code or "Calculation error"
        errors_by_field.setdefault(field, [])
        if line not in errors_by_field[field]:
            errors_by_field[field].append(line)
    facts: list[MineralFact] = [
        MineralFact(
            key="value",
            typed_value=value,
            value_type=infer_fact_value_type(value),
            source=FactSource.VALUE,
            status=FactStatus.VALID,
        )
    ]

    for key in sorted(metadata_dict.keys()):
        if key in FACT_RESERVED_METADATA_KEYS:
            continue
        typed_value = metadata_dict.get(key)
        facts.append(
            MineralFact(
                key=str(key),
                typed_value=typed_value,
                value_type=infer_fact_value_type(typed_value),
                source=FactSource.METADATA,
                status=FactStatus.VALID,
            )
        )

    for key in sorted(calculated_dict.keys()):
        typed_value = calculated_dict.get(key)
        field_errors = list(errors_by_field.get(str(key), []))
        is_circular = typed_value == "#CIRC!"
        status = FactStatus.INVALID if is_circular or bool(field_errors) else FactStatus.VALID
        errors = field_errors
        if is_circular and "Circular formula dependency" not in errors:
            errors.append("Circular formula dependency")
        facts.append(
            MineralFact(
                key=str(key),
                typed_value=typed_value,
                value_type=infer_fact_value_type(typed_value),
                source=FactSource.CALCULATED,
                status=status,
                readonly=True,
                errors=errors,
            )
        )
    for key in sorted(errors_by_field.keys()):
        if key in calculated_dict:
            continue
        facts.append(
            MineralFact(
                key=key,
                typed_value=None,
                value_type=FactValueType.NULL,
                source=FactSource.CALCULATED,
                status=FactStatus.INVALID,
                readonly=True,
                errors=list(errors_by_field.get(key, [])),
            )
        )

    return facts


def asteroid_snapshot_to_moon_row(snapshot: UniverseAsteroidSnapshot) -> MoonRowContract:
    label = str(snapshot.value) if snapshot.value is not None else str(snapshot.id)
    return MoonRowContract(
        moon_id=snapshot.id,
        label=label,
        planet_id=snapshot.table_id,
        constellation_name=snapshot.constellation_name,
        planet_name=snapshot.planet_name,
        created_at=snapshot.created_at,
        current_event_seq=snapshot.current_event_seq,
        active_alerts=[str(item) for item in snapshot.active_alerts],
        facts=build_moon_facts(
            value=snapshot.value,
            metadata=snapshot.metadata,
            calculated_values=snapshot.calculated_values,
            calc_errors=snapshot.calc_errors,
        ),
    )


class UniverseBondSnapshot(BaseModel):
    id: uuid.UUID
    source_id: uuid.UUID
    target_id: uuid.UUID
    type: str
    physics: dict[str, Any] = Field(default_factory=dict)
    directional: bool = False
    flow_direction: str = "bidirectional"
    source_table_id: uuid.UUID
    source_table_name: str
    source_constellation_name: str
    source_planet_name: str
    target_table_id: uuid.UUID
    target_table_name: str
    target_constellation_name: str
    target_planet_name: str
    current_event_seq: int = 0


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
    directional: bool = False
    flow_direction: str = "bidirectional"
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
