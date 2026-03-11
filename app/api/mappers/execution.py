from __future__ import annotations

from collections.abc import Mapping
from typing import Any
from uuid import UUID

from app.core.task_executor.models import TaskExecutionResult
from app.schemas import (
    BondResponse,
    CivilizationResponse,
    ParseCommandResponse,
    TaskSchema,
    UniverseAsteroidSnapshot,
    UniverseBondSnapshot,
    build_moon_facts,
)
from app.services.bond_semantics import bond_semantics
from app.services.parser_types import AtomicTask
from app.services.universe_service import (
    DEFAULT_GALAXY_ID,
    ProjectedBond,
    ProjectedCivilization,
    derive_table_id,
    derive_table_name,
    split_constellation_and_planet_name,
)


def civilization_to_response(civilization: ProjectedCivilization | Mapping[str, Any]) -> CivilizationResponse:
    if isinstance(civilization, Mapping):
        return CivilizationResponse(
            id=civilization["id"],
            value=civilization.get("value"),
            metadata=civilization.get("metadata", {}),
            is_deleted=bool(civilization.get("is_deleted", False)),
            created_at=civilization["created_at"],
            deleted_at=civilization.get("deleted_at"),
            current_event_seq=int(civilization.get("current_event_seq", 0) or 0),
        )
    return CivilizationResponse(
        id=civilization.id,
        value=civilization.value,
        metadata=civilization.metadata,
        is_deleted=civilization.is_deleted,
        created_at=civilization.created_at,
        deleted_at=civilization.deleted_at,
        current_event_seq=int(getattr(civilization, "current_event_seq", 0) or 0),
    )


def bond_to_response(bond: ProjectedBond | Mapping[str, Any]) -> BondResponse:
    if isinstance(bond, Mapping):
        semantics = bond_semantics(bond.get("type", "RELATION"))
        return BondResponse(
            id=bond["id"],
            source_civilization_id=bond["source_civilization_id"],
            target_civilization_id=bond["target_civilization_id"],
            type=semantics.bond_type,
            directional=semantics.directional,
            flow_direction=semantics.flow_direction,
            is_deleted=bool(bond.get("is_deleted", False)),
            created_at=bond["created_at"],
            deleted_at=bond.get("deleted_at"),
            current_event_seq=int(bond.get("current_event_seq", 0) or 0),
        )
    semantics = bond_semantics(bond.type)
    return BondResponse(
        id=bond.id,
        source_civilization_id=bond.source_civilization_id,
        target_civilization_id=bond.target_civilization_id,
        type=semantics.bond_type,
        directional=semantics.directional,
        flow_direction=semantics.flow_direction,
        is_deleted=bond.is_deleted,
        created_at=bond.created_at,
        deleted_at=bond.deleted_at,
        current_event_seq=int(getattr(bond, "current_event_seq", 0) or 0),
    )


def task_to_response(task: AtomicTask) -> TaskSchema:
    return TaskSchema(action=task.action, params=task.params)


def execution_to_response(tasks: list[AtomicTask], execution: TaskExecutionResult) -> ParseCommandResponse:
    return ParseCommandResponse(
        tasks=[task_to_response(task) for task in tasks],
        civilizations=[civilization_to_response(civilization) for civilization in execution.civilizations],
        bonds=[bond_to_response(bond) for bond in execution.bonds],
        selected_asteroids=[civilization_to_response(civilization) for civilization in execution.selected_asteroids],
        extinguished_civilization_ids=execution.extinguished_civilization_ids,
        extinguished_bond_ids=execution.extinguished_bond_ids,
        semantic_effects=execution.semantic_effects,
    )


def universe_asteroid_to_snapshot(
    civilization: ProjectedCivilization | Mapping[str, Any],
    *,
    galaxy_id: UUID = DEFAULT_GALAXY_ID,
) -> UniverseAsteroidSnapshot:
    if isinstance(civilization, Mapping):
        metadata = civilization.get("metadata", {})
        if not isinstance(metadata, dict):
            metadata = {}
        calculated_values = civilization.get("calculated_values", {})
        if not isinstance(calculated_values, dict):
            calculated_values = {}
        calc_errors = civilization.get("calc_errors", [])
        if not isinstance(calc_errors, list):
            calc_errors = []
        physics = civilization.get("physics", {})
        if not isinstance(physics, dict):
            physics = {}
        active_alerts = civilization.get("active_alerts", [])
        if not isinstance(active_alerts, list):
            active_alerts = []
        error_count = int(
            civilization.get("error_count", len([item for item in calc_errors if isinstance(item, dict)])) or 0
        )
        circular_fields_count = int(civilization.get("circular_fields_count", 0) or 0)
        table_name_raw = civilization.get("table_name")
        table_name = (
            table_name_raw.strip()
            if isinstance(table_name_raw, str) and table_name_raw.strip()
            else derive_table_name(value=civilization.get("value"), metadata=metadata)
        )
        constellation_name_raw = civilization.get("constellation_name")
        planet_name_raw = civilization.get("planet_name")
        if (
            isinstance(constellation_name_raw, str)
            and constellation_name_raw.strip()
            and isinstance(planet_name_raw, str)
            and planet_name_raw.strip()
        ):
            constellation_name = constellation_name_raw.strip()
            planet_name = planet_name_raw.strip()
        else:
            constellation_name, planet_name = split_constellation_and_planet_name(table_name)
        table_id = civilization.get("table_id")
        table_uuid = (
            table_id if isinstance(table_id, UUID) else derive_table_id(galaxy_id=galaxy_id, table_name=table_name)
        )
        return UniverseAsteroidSnapshot(
            id=civilization["id"],
            value=civilization.get("value"),
            table_id=table_uuid,
            table_name=table_name,
            constellation_name=constellation_name,
            planet_name=planet_name,
            metadata=metadata,
            calculated_values=calculated_values,
            calc_errors=[item for item in calc_errors if isinstance(item, dict)],
            error_count=error_count,
            circular_fields_count=circular_fields_count,
            active_alerts=[str(alert) for alert in active_alerts],
            physics=physics,
            facts=build_moon_facts(
                value=civilization.get("value"),
                metadata=metadata,
                calculated_values=calculated_values,
                calc_errors=calc_errors,
            ),
            created_at=civilization["created_at"],
            current_event_seq=int(civilization.get("current_event_seq", 0) or 0),
        )

    table_name = derive_table_name(value=civilization.value, metadata=civilization.metadata)
    constellation_name, planet_name = split_constellation_and_planet_name(table_name)
    return UniverseAsteroidSnapshot(
        id=civilization.id,
        value=civilization.value,
        table_id=derive_table_id(galaxy_id=galaxy_id, table_name=table_name),
        table_name=table_name,
        constellation_name=constellation_name,
        planet_name=planet_name,
        metadata=civilization.metadata,
        calculated_values={},
        calc_errors=[],
        error_count=0,
        circular_fields_count=0,
        active_alerts=[],
        physics={},
        facts=build_moon_facts(
            value=civilization.value, metadata=civilization.metadata, calculated_values={}, calc_errors=[]
        ),
        created_at=civilization.created_at,
        current_event_seq=int(getattr(civilization, "current_event_seq", 0) or 0),
    )


def universe_bond_to_snapshot(
    bond: ProjectedBond | Mapping[str, Any],
    *,
    asteroid_table_index: Mapping[UUID, tuple[UUID, str, str, str]] | None = None,
) -> UniverseBondSnapshot:
    table_index = asteroid_table_index or {}
    if isinstance(bond, Mapping):
        semantics = bond_semantics(bond.get("type", "RELATION"))
        source_civilization_id = bond["source_civilization_id"]
        target_civilization_id = bond["target_civilization_id"]
        physics = bond.get("physics", {})
        if not isinstance(physics, dict):
            physics = {}
        source_table_id, source_table_name, source_constellation_name, source_planet_name = table_index.get(
            source_civilization_id,
            (DEFAULT_GALAXY_ID, "Unknown", "Unknown", "Unknown"),
        )
        target_table_id, target_table_name, target_constellation_name, target_planet_name = table_index.get(
            target_civilization_id,
            (DEFAULT_GALAXY_ID, "Unknown", "Unknown", "Unknown"),
        )
        return UniverseBondSnapshot(
            id=bond["id"],
            source_civilization_id=source_civilization_id,
            target_civilization_id=target_civilization_id,
            type=semantics.bond_type,
            physics=physics,
            directional=semantics.directional,
            flow_direction=semantics.flow_direction,
            source_table_id=source_table_id,
            source_table_name=source_table_name,
            source_constellation_name=source_constellation_name,
            source_planet_name=source_planet_name,
            target_table_id=target_table_id,
            target_table_name=target_table_name,
            target_constellation_name=target_constellation_name,
            target_planet_name=target_planet_name,
            current_event_seq=int(bond.get("current_event_seq", 0) or 0),
        )
    semantics = bond_semantics(bond.type)
    source_table_id, source_table_name, source_constellation_name, source_planet_name = table_index.get(
        bond.source_civilization_id,
        (DEFAULT_GALAXY_ID, "Unknown", "Unknown", "Unknown"),
    )
    target_table_id, target_table_name, target_constellation_name, target_planet_name = table_index.get(
        bond.target_civilization_id,
        (DEFAULT_GALAXY_ID, "Unknown", "Unknown", "Unknown"),
    )
    return UniverseBondSnapshot(
        id=bond.id,
        source_civilization_id=bond.source_civilization_id,
        target_civilization_id=bond.target_civilization_id,
        type=semantics.bond_type,
        physics={},
        directional=semantics.directional,
        flow_direction=semantics.flow_direction,
        source_table_id=source_table_id,
        source_table_name=source_table_name,
        source_constellation_name=source_constellation_name,
        source_planet_name=source_planet_name,
        target_table_id=target_table_id,
        target_table_name=target_table_name,
        target_constellation_name=target_constellation_name,
        target_planet_name=target_planet_name,
        current_event_seq=int(getattr(bond, "current_event_seq", 0) or 0),
    )
