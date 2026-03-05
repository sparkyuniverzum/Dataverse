from __future__ import annotations

import uuid
from datetime import datetime
from enum import Enum
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
