from __future__ import annotations

import uuid
from datetime import datetime
from enum import StrEnum
from typing import Any

from pydantic import BaseModel, ConfigDict, Field

from app.domains.civilizations.minerals.facts import (
    build_civilization_mineral_facts,
    infer_mineral_value_type,
)
from app.domains.civilizations.minerals.policy import RESERVED_MINERAL_METADATA_KEYS


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


FACT_RESERVED_METADATA_KEYS = set(RESERVED_MINERAL_METADATA_KEYS)


def infer_fact_value_type(value: Any) -> FactValueType:
    return FactValueType(infer_mineral_value_type(value))


def build_moon_facts(
    *,
    value: Any,
    metadata: dict[str, Any] | None = None,
    calculated_values: dict[str, Any] | None = None,
    calc_errors: list[Any] | None = None,
) -> list[MineralFact]:
    payloads = build_civilization_mineral_facts(
        value=value,
        metadata=metadata,
        calculated_values=calculated_values,
        calc_errors=calc_errors,
    )
    facts: list[MineralFact] = []
    for item in payloads:
        facts.append(
            MineralFact(
                key=str(item.get("key") or ""),
                typed_value=item.get("typed_value"),
                value_type=FactValueType(str(item.get("value_type") or FactValueType.STRING.value)),
                source=FactSource(str(item.get("source") or FactSource.METADATA.value)),
                status=FactStatus(str(item.get("status") or FactStatus.VALID.value)),
                readonly=bool(item.get("readonly", False)),
                errors=[str(message) for message in (item.get("errors") or [])],
            )
        )
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


def civilization_snapshot_to_moon_row(snapshot: UniverseAsteroidSnapshot) -> MoonRowContract:
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

    civilizations: list[UniverseAsteroidSnapshot] = Field(default_factory=list)
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
