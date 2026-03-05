from __future__ import annotations

from collections.abc import Mapping
from typing import Any
from uuid import UUID

from app.schemas import (
    AsteroidResponse,
    BondResponse,
    ParseCommandResponse,
    TaskSchema,
    UniverseAsteroidSnapshot,
    UniverseBondSnapshot,
    build_moon_facts,
)
from app.services.bond_semantics import bond_semantics
from app.services.parser_service import AtomicTask
from app.services.task_executor_service import TaskExecutionResult
from app.services.universe_service import (
    DEFAULT_GALAXY_ID,
    ProjectedAsteroid,
    ProjectedBond,
    derive_table_id,
    derive_table_name,
    split_constellation_and_planet_name,
)


def asteroid_to_response(asteroid: ProjectedAsteroid | Mapping[str, Any]) -> AsteroidResponse:
    if isinstance(asteroid, Mapping):
        return AsteroidResponse(
            id=asteroid["id"],
            value=asteroid.get("value"),
            metadata=asteroid.get("metadata", {}),
            is_deleted=bool(asteroid.get("is_deleted", False)),
            created_at=asteroid["created_at"],
            deleted_at=asteroid.get("deleted_at"),
            current_event_seq=int(asteroid.get("current_event_seq", 0) or 0),
        )
    return AsteroidResponse(
        id=asteroid.id,
        value=asteroid.value,
        metadata=asteroid.metadata,
        is_deleted=asteroid.is_deleted,
        created_at=asteroid.created_at,
        deleted_at=asteroid.deleted_at,
        current_event_seq=int(getattr(asteroid, "current_event_seq", 0) or 0),
    )


def bond_to_response(bond: ProjectedBond | Mapping[str, Any]) -> BondResponse:
    if isinstance(bond, Mapping):
        semantics = bond_semantics(bond.get("type", "RELATION"))
        return BondResponse(
            id=bond["id"],
            source_id=bond["source_id"],
            target_id=bond["target_id"],
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
        source_id=bond.source_id,
        target_id=bond.target_id,
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
        asteroids=[asteroid_to_response(asteroid) for asteroid in execution.asteroids],
        bonds=[bond_to_response(bond) for bond in execution.bonds],
        selected_asteroids=[asteroid_to_response(asteroid) for asteroid in execution.selected_asteroids],
        extinguished_asteroid_ids=execution.extinguished_asteroid_ids,
        extinguished_bond_ids=execution.extinguished_bond_ids,
        semantic_effects=execution.semantic_effects,
    )


def universe_asteroid_to_snapshot(
    asteroid: ProjectedAsteroid | Mapping[str, Any],
    *,
    galaxy_id: UUID = DEFAULT_GALAXY_ID,
) -> UniverseAsteroidSnapshot:
    if isinstance(asteroid, Mapping):
        metadata = asteroid.get("metadata", {})
        if not isinstance(metadata, dict):
            metadata = {}
        calculated_values = asteroid.get("calculated_values", {})
        if not isinstance(calculated_values, dict):
            calculated_values = {}
        calc_errors = asteroid.get("calc_errors", [])
        if not isinstance(calc_errors, list):
            calc_errors = []
        physics = asteroid.get("physics", {})
        if not isinstance(physics, dict):
            physics = {}
        active_alerts = asteroid.get("active_alerts", [])
        if not isinstance(active_alerts, list):
            active_alerts = []
        error_count = int(
            asteroid.get("error_count", len([item for item in calc_errors if isinstance(item, dict)])) or 0
        )
        circular_fields_count = int(asteroid.get("circular_fields_count", 0) or 0)
        table_name_raw = asteroid.get("table_name")
        table_name = (
            table_name_raw.strip()
            if isinstance(table_name_raw, str) and table_name_raw.strip()
            else derive_table_name(value=asteroid.get("value"), metadata=metadata)
        )
        constellation_name_raw = asteroid.get("constellation_name")
        planet_name_raw = asteroid.get("planet_name")
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
        table_id = asteroid.get("table_id")
        table_uuid = (
            table_id if isinstance(table_id, UUID) else derive_table_id(galaxy_id=galaxy_id, table_name=table_name)
        )
        return UniverseAsteroidSnapshot(
            id=asteroid["id"],
            value=asteroid.get("value"),
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
                value=asteroid.get("value"),
                metadata=metadata,
                calculated_values=calculated_values,
                calc_errors=calc_errors,
            ),
            created_at=asteroid["created_at"],
            current_event_seq=int(asteroid.get("current_event_seq", 0) or 0),
        )

    table_name = derive_table_name(value=asteroid.value, metadata=asteroid.metadata)
    constellation_name, planet_name = split_constellation_and_planet_name(table_name)
    return UniverseAsteroidSnapshot(
        id=asteroid.id,
        value=asteroid.value,
        table_id=derive_table_id(galaxy_id=galaxy_id, table_name=table_name),
        table_name=table_name,
        constellation_name=constellation_name,
        planet_name=planet_name,
        metadata=asteroid.metadata,
        calculated_values={},
        calc_errors=[],
        error_count=0,
        circular_fields_count=0,
        active_alerts=[],
        physics={},
        facts=build_moon_facts(value=asteroid.value, metadata=asteroid.metadata, calculated_values={}, calc_errors=[]),
        created_at=asteroid.created_at,
        current_event_seq=int(getattr(asteroid, "current_event_seq", 0) or 0),
    )


def universe_bond_to_snapshot(
    bond: ProjectedBond | Mapping[str, Any],
    *,
    asteroid_table_index: Mapping[UUID, tuple[UUID, str, str, str]] | None = None,
) -> UniverseBondSnapshot:
    table_index = asteroid_table_index or {}
    if isinstance(bond, Mapping):
        semantics = bond_semantics(bond.get("type", "RELATION"))
        source_id = bond["source_id"]
        target_id = bond["target_id"]
        physics = bond.get("physics", {})
        if not isinstance(physics, dict):
            physics = {}
        source_table_id, source_table_name, source_constellation_name, source_planet_name = table_index.get(
            source_id,
            (DEFAULT_GALAXY_ID, "Unknown", "Unknown", "Unknown"),
        )
        target_table_id, target_table_name, target_constellation_name, target_planet_name = table_index.get(
            target_id,
            (DEFAULT_GALAXY_ID, "Unknown", "Unknown", "Unknown"),
        )
        return UniverseBondSnapshot(
            id=bond["id"],
            source_id=source_id,
            target_id=target_id,
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
        bond.source_id,
        (DEFAULT_GALAXY_ID, "Unknown", "Unknown", "Unknown"),
    )
    target_table_id, target_table_name, target_constellation_name, target_planet_name = table_index.get(
        bond.target_id,
        (DEFAULT_GALAXY_ID, "Unknown", "Unknown", "Unknown"),
    )
    return UniverseBondSnapshot(
        id=bond.id,
        source_id=bond.source_id,
        target_id=bond.target_id,
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
