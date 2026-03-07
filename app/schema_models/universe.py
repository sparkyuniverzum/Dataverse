from __future__ import annotations

import uuid
from datetime import datetime
from enum import StrEnum
from typing import Any

from pydantic import BaseModel, ConfigDict, Field


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
    facts: list[MineralFact] = Field(default_factory=list)
    created_at: datetime
    current_event_seq: int = 0


class FactValueType(StrEnum):
    STRING = "string"
    NUMBER = "number"
    BOOLEAN = "boolean"
    DATETIME = "datetime"
    JSON = "json"
    NULL = "null"


class FactSource(StrEnum):
    VALUE = "value"
    METADATA = "metadata"
    CALCULATED = "calculated"


class FactStatus(StrEnum):
    VALID = "valid"
    HOLOGRAM = "hologram"
    INVALID = "invalid"


class CivilizationState(StrEnum):
    ACTIVE = "ACTIVE"
    WARNING = "WARNING"
    ANOMALY = "ANOMALY"
    ARCHIVED = "ARCHIVED"


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
    state: CivilizationState = CivilizationState.ACTIVE
    health_score: int = Field(default=100, ge=0, le=100)
    violation_count: int = Field(default=0, ge=0)
    last_violation_at: datetime | None = None
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
    fact_index: dict[str, int] = {"value": 0}

    for key in sorted(metadata_dict.keys()):
        if key in FACT_RESERVED_METADATA_KEYS:
            continue
        typed_value = metadata_dict.get(key)
        normalized_key = str(key)
        if normalized_key in fact_index:
            continue
        facts.append(
            MineralFact(
                key=normalized_key,
                typed_value=typed_value,
                value_type=infer_fact_value_type(typed_value),
                source=FactSource.METADATA,
                status=FactStatus.VALID,
            )
        )
        fact_index[normalized_key] = len(facts) - 1

    for key in sorted(calculated_dict.keys()):
        normalized_key = str(key)
        typed_value = calculated_dict.get(key)
        field_errors = list(errors_by_field.get(normalized_key, []))
        is_circular = typed_value == "#CIRC!"
        status = FactStatus.INVALID if is_circular or bool(field_errors) else FactStatus.VALID
        errors = field_errors
        if is_circular and "Circular formula dependency" not in errors:
            errors.append("Circular formula dependency")
        if normalized_key in fact_index:
            if errors:
                current_fact = facts[fact_index[normalized_key]]
                merged_errors = list(current_fact.errors)
                for message in errors:
                    if message not in merged_errors:
                        merged_errors.append(message)
                current_fact.errors = merged_errors
                current_fact.status = FactStatus.INVALID
            continue
        facts.append(
            MineralFact(
                key=normalized_key,
                typed_value=typed_value,
                value_type=infer_fact_value_type(typed_value),
                source=FactSource.CALCULATED,
                status=status,
                readonly=True,
                errors=errors,
            )
        )
        fact_index[normalized_key] = len(facts) - 1
    for key in sorted(errors_by_field.keys()):
        if key in calculated_dict:
            continue
        if key in fact_index:
            current_fact = facts[fact_index[key]]
            merged_errors = list(current_fact.errors)
            for message in errors_by_field.get(key, []):
                if message not in merged_errors:
                    merged_errors.append(message)
            current_fact.errors = merged_errors
            current_fact.status = FactStatus.INVALID
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
        fact_index[key] = len(facts) - 1

    return facts


def derive_civilization_health(
    *,
    facts: list[MineralFact] | None,
    created_at: datetime | None,
    is_deleted: bool = False,
) -> tuple[CivilizationState, int, int, datetime | None]:
    fact_rows = facts if isinstance(facts, list) else []
    critical_violations = 0
    warning_violations = 0
    for fact in fact_rows:
        status = str(getattr(fact, "status", FactStatus.VALID)).strip().lower()
        has_errors = bool(getattr(fact, "errors", []))
        if status == FactStatus.INVALID.value or has_errors:
            critical_violations += 1
            continue
        if status == FactStatus.HOLOGRAM.value:
            warning_violations += 1

    violation_count = critical_violations + warning_violations
    if is_deleted:
        state = CivilizationState.ARCHIVED
    elif critical_violations > 0:
        state = CivilizationState.ANOMALY
    elif warning_violations > 0:
        state = CivilizationState.WARNING
    else:
        state = CivilizationState.ACTIVE

    if state == CivilizationState.ARCHIVED:
        health_score = 0
    else:
        # Deterministic penalty budget: critical violations are weighted higher than warning/hologram ones.
        penalty = critical_violations * 35 + warning_violations * 15
        health_score = max(0, 100 - penalty)

    last_violation_at = created_at if violation_count > 0 else None
    return state, int(health_score), int(violation_count), last_violation_at


def asteroid_snapshot_to_moon_row(snapshot: UniverseAsteroidSnapshot) -> MoonRowContract:
    label = str(snapshot.value) if snapshot.value is not None else str(snapshot.id)
    facts = build_moon_facts(
        value=snapshot.value,
        metadata=snapshot.metadata,
        calculated_values=snapshot.calculated_values,
        calc_errors=snapshot.calc_errors,
    )
    state, health_score, violation_count, last_violation_at = derive_civilization_health(
        facts=facts,
        created_at=snapshot.created_at,
        is_deleted=False,
    )
    return MoonRowContract(
        moon_id=snapshot.id,
        label=label,
        planet_id=snapshot.table_id,
        constellation_name=snapshot.constellation_name,
        planet_name=snapshot.planet_name,
        created_at=snapshot.created_at,
        current_event_seq=snapshot.current_event_seq,
        state=state,
        health_score=health_score,
        violation_count=violation_count,
        last_violation_at=last_violation_at,
        active_alerts=[str(item) for item in snapshot.active_alerts],
        facts=facts,
    )


class UniverseBondSnapshot(BaseModel):
    id: uuid.UUID
    source_civilization_id: uuid.UUID
    target_civilization_id: uuid.UUID
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
    source_civilization_id: uuid.UUID
    target_civilization_id: uuid.UUID
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
    archetype: str | None = None
    contract_version: int | None = None
    schema_fields: list[str] = Field(default_factory=list)
    formula_fields: list[str] = Field(default_factory=list)
    members: list[UniverseTableMemberSnapshot] = Field(default_factory=list)
    internal_bonds: list[UniverseTableBondSnapshot] = Field(default_factory=list)
    external_bonds: list[UniverseTableBondSnapshot] = Field(default_factory=list)
    sector: UniverseTableSectorSnapshot


class UniverseTablesResponse(BaseModel):
    model_config = ConfigDict(extra="forbid")

    tables: list[UniverseTableSnapshot] = Field(default_factory=list)
