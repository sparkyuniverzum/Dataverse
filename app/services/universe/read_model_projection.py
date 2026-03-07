from __future__ import annotations

from typing import TYPE_CHECKING, Any
from uuid import UUID

from sqlalchemy import and_, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models import Bond, CalcStateRM, CivilizationRM, PhysicsStateRM
from app.services.bond_semantics import normalize_bond_type
from app.services.calc_service import evaluate_universe
from app.services.guardian_service import evaluate_guardians
from app.services.universe.types import (
    ProjectedAsteroid,
    ProjectedBond,
    derive_table_id,
    derive_table_name,
    split_constellation_and_planet_name,
)

if TYPE_CHECKING:
    from app.services.universe_service import UniverseService


async def project_state_from_read_model(
    service: UniverseService,
    session: AsyncSession,
    *,
    user_id: UUID,
    galaxy_id: UUID,
) -> tuple[list[ProjectedAsteroid], list[ProjectedBond]]:
    asteroid_rows = list(
        (
            await session.execute(
                select(CivilizationRM)
                .where(
                    and_(
                        CivilizationRM.user_id == user_id,
                        CivilizationRM.galaxy_id == galaxy_id,
                        CivilizationRM.is_deleted.is_(False),
                    )
                )
                .order_by(CivilizationRM.created_at.asc(), CivilizationRM.id.asc())
            )
        )
        .scalars()
        .all()
    )
    active_asteroids = [
        ProjectedAsteroid(
            id=civilization.id,
            value=civilization.value,
            metadata=civilization.metadata_ if isinstance(civilization.metadata_, dict) else {},
            is_deleted=civilization.is_deleted,
            created_at=civilization.created_at,
            deleted_at=civilization.deleted_at,
        )
        for civilization in asteroid_rows
    ]
    active_ids = {civilization.id for civilization in active_asteroids}
    asteroid_seq_map = await service._entity_event_seq_map(
        session=session,
        user_id=user_id,
        galaxy_id=galaxy_id,
        branch_id=None,
        entity_ids=[item.id for item in active_asteroids],
    )
    for civilization in active_asteroids:
        civilization.current_event_seq = asteroid_seq_map.get(civilization.id, 0)

    bond_rows = list(
        (
            await session.execute(
                select(Bond)
                .where(
                    and_(
                        Bond.user_id == user_id,
                        Bond.galaxy_id == galaxy_id,
                        Bond.is_deleted.is_(False),
                    )
                )
                .order_by(Bond.created_at.asc(), Bond.id.asc())
            )
        )
        .scalars()
        .all()
    )
    active_bonds = [
        ProjectedBond(
            id=bond.id,
            source_civilization_id=bond.source_civilization_id,
            target_civilization_id=bond.target_civilization_id,
            type=normalize_bond_type(bond.type),
            is_deleted=bond.is_deleted,
            created_at=bond.created_at,
            deleted_at=bond.deleted_at,
        )
        for bond in bond_rows
        if bond.source_civilization_id in active_ids and bond.target_civilization_id in active_ids
    ]
    bond_seq_map = await service._entity_event_seq_map(
        session=session,
        user_id=user_id,
        galaxy_id=galaxy_id,
        branch_id=None,
        entity_ids=[item.id for item in active_bonds],
    )
    for bond in active_bonds:
        bond.current_event_seq = bond_seq_map.get(bond.id, 0)
    return active_asteroids, active_bonds


async def _load_calc_state_by_civilization_id(
    session: AsyncSession,
    *,
    user_id: UUID,
    galaxy_id: UUID,
    civilization_ids: set[UUID],
) -> dict[UUID, dict[str, Any]]:
    if not civilization_ids:
        return {}
    rows = list(
        (
            await session.execute(
                select(CalcStateRM).where(
                    and_(
                        CalcStateRM.user_id == user_id,
                        CalcStateRM.galaxy_id == galaxy_id,
                        CalcStateRM.deleted_at.is_(None),
                        CalcStateRM.civilization_id.in_(civilization_ids),
                    )
                )
            )
        )
        .scalars()
        .all()
    )
    return {
        row.civilization_id: {
            "calculated_values": row.calculated_values if isinstance(row.calculated_values, dict) else {},
            "calc_errors": row.calc_errors if isinstance(row.calc_errors, list) else [],
            "error_count": int(row.error_count or 0),
            "circular_fields_count": int(row.circular_fields_count or 0),
            "source_event_seq": int(row.source_event_seq or 0),
            "engine_version": str(row.engine_version or ""),
        }
        for row in rows
        if isinstance(row.civilization_id, UUID)
    }


async def _load_physics_state_by_civilization_id(
    session: AsyncSession,
    *,
    user_id: UUID,
    galaxy_id: UUID,
    civilization_ids: set[UUID],
) -> dict[UUID, dict[str, Any]]:
    if not civilization_ids:
        return {}
    rows = list(
        (
            await session.execute(
                select(PhysicsStateRM).where(
                    and_(
                        PhysicsStateRM.user_id == user_id,
                        PhysicsStateRM.galaxy_id == galaxy_id,
                        PhysicsStateRM.entity_kind == "civilization",
                        PhysicsStateRM.deleted_at.is_(None),
                        PhysicsStateRM.entity_id.in_(civilization_ids),
                    )
                )
            )
        )
        .scalars()
        .all()
    )
    return {
        row.entity_id: {
            "source_event_seq": int(row.source_event_seq or 0),
            "engine_version": str(row.engine_version or ""),
            "stress_score": float(row.stress_score),
            "mass_factor": float(row.mass_factor),
            "radius_factor": float(row.radius_factor),
            "emissive_boost": float(row.emissive_boost),
            "pulse_factor": float(row.pulse_factor),
            "opacity_factor": float(row.opacity_factor),
            "attraction_factor": float(row.attraction_factor),
            "payload": row.payload if isinstance(row.payload, dict) else {},
        }
        for row in rows
        if isinstance(row.entity_id, UUID)
    }


async def _load_physics_state_by_bond_id(
    session: AsyncSession,
    *,
    user_id: UUID,
    galaxy_id: UUID,
    bond_ids: set[UUID],
) -> dict[UUID, dict[str, Any]]:
    if not bond_ids:
        return {}
    rows = list(
        (
            await session.execute(
                select(PhysicsStateRM).where(
                    and_(
                        PhysicsStateRM.user_id == user_id,
                        PhysicsStateRM.galaxy_id == galaxy_id,
                        PhysicsStateRM.entity_kind == "bond",
                        PhysicsStateRM.deleted_at.is_(None),
                        PhysicsStateRM.entity_id.in_(bond_ids),
                    )
                )
            )
        )
        .scalars()
        .all()
    )
    return {
        row.entity_id: {
            "source_event_seq": int(row.source_event_seq or 0),
            "engine_version": str(row.engine_version or ""),
            "stress_score": float(row.stress_score),
            "mass_factor": float(row.mass_factor),
            "radius_factor": float(row.radius_factor),
            "emissive_boost": float(row.emissive_boost),
            "pulse_factor": float(row.pulse_factor),
            "opacity_factor": float(row.opacity_factor),
            "attraction_factor": float(row.attraction_factor),
            "payload": row.payload if isinstance(row.payload, dict) else {},
        }
        for row in rows
        if isinstance(row.entity_id, UUID)
    }


async def enrich_bonds_from_read_models(
    session: AsyncSession,
    *,
    user_id: UUID,
    galaxy_id: UUID,
    active_bonds: list[ProjectedBond],
) -> list[ProjectedBond | dict[str, Any]]:
    if not active_bonds:
        return []
    physics_by_id = await _load_physics_state_by_bond_id(
        session,
        user_id=user_id,
        galaxy_id=galaxy_id,
        bond_ids={bond.id for bond in active_bonds},
    )
    enriched: list[ProjectedBond | dict[str, Any]] = []
    for bond in active_bonds:
        physics = physics_by_id.get(bond.id)
        if not physics:
            enriched.append(bond)
            continue
        enriched.append(
            {
                "id": bond.id,
                "source_civilization_id": bond.source_civilization_id,
                "target_civilization_id": bond.target_civilization_id,
                "type": normalize_bond_type(bond.type),
                "is_deleted": bool(bond.is_deleted),
                "created_at": bond.created_at,
                "deleted_at": bond.deleted_at,
                "current_event_seq": int(getattr(bond, "current_event_seq", 0) or 0),
                "physics": physics,
            }
        )
    return enriched


async def enrich_main_timeline_from_read_models(
    session: AsyncSession,
    *,
    user_id: UUID,
    galaxy_id: UUID,
    active_asteroids: list[ProjectedAsteroid],
    active_bonds: list[ProjectedBond],
) -> list[dict[str, Any]] | None:
    if not active_asteroids:
        return []

    has_formula_metadata = any(
        isinstance(value, str) and value.strip().startswith("=")
        for civilization in active_asteroids
        for value in (civilization.metadata if isinstance(civilization.metadata, dict) else {}).values()
    )
    has_non_flow_bonds = any(normalize_bond_type(bond.type) != "FLOW" for bond in active_bonds)
    # Keep legacy V1 semantics for relation-driven formulas until calc read model reaches parity.
    if has_formula_metadata and has_non_flow_bonds:
        return None

    civilization_ids = {civilization.id for civilization in active_asteroids}
    calc_by_id = await _load_calc_state_by_civilization_id(
        session,
        user_id=user_id,
        galaxy_id=galaxy_id,
        civilization_ids=civilization_ids,
    )
    # Require full calc coverage to avoid mixed semantics in one snapshot.
    if len(calc_by_id) < len(civilization_ids):
        return None
    physics_by_id = await _load_physics_state_by_civilization_id(
        session,
        user_id=user_id,
        galaxy_id=galaxy_id,
        civilization_ids=civilization_ids,
    )

    enriched: list[dict[str, Any]] = []
    for civilization in active_asteroids:
        calc_state = calc_by_id.get(civilization.id)
        if calc_state is None:
            return None
        # Guard against stale calc projections right after writes.
        # If calc source seq lags behind civilization event seq, fallback universe
        # projection preserves write-after-read consistency for metadata facts.
        calc_source_seq = int(calc_state.get("source_event_seq", 0) or 0)
        asteroid_event_seq = int(getattr(civilization, "current_event_seq", 0) or 0)
        if calc_source_seq < asteroid_event_seq:
            return None
        calculated_values = calc_state.get("calculated_values", {})
        if not isinstance(calculated_values, dict):
            calculated_values = {}
        raw_metadata = civilization.metadata if isinstance(civilization.metadata, dict) else {}
        # Keep V1 snapshot behavior: metadata fields are projected to resolved values.
        projected_metadata = dict(raw_metadata)
        for key, value in calculated_values.items():
            if key in projected_metadata:
                projected_metadata[key] = value
        table_name = derive_table_name(value=civilization.value, metadata=projected_metadata)
        constellation_name, planet_name = split_constellation_and_planet_name(table_name)
        enriched.append(
            {
                "id": civilization.id,
                "value": civilization.value,
                "metadata": projected_metadata,
                "calculated_values": dict(calculated_values),
                "calc_errors": calc_state.get("calc_errors", []),
                "table_name": table_name,
                "table_id": derive_table_id(galaxy_id=galaxy_id, table_name=table_name),
                "constellation_name": constellation_name,
                "planet_name": planet_name,
                "physics": physics_by_id.get(civilization.id, {}),
                "created_at": civilization.created_at,
                "current_event_seq": int(getattr(civilization, "current_event_seq", 0) or 0),
            }
        )

    return evaluate_guardians(enriched)


def evaluate_fallback_universe(
    *,
    galaxy_id: UUID,
    active_asteroids: list[ProjectedAsteroid],
    active_bonds: list[ProjectedBond],
) -> tuple[list[dict[str, Any]], list[ProjectedBond]]:
    evaluated = evaluate_universe(
        [
            {
                "id": civilization.id,
                "value": civilization.value,
                "metadata": civilization.metadata,
                "created_at": civilization.created_at,
                "current_event_seq": int(getattr(civilization, "current_event_seq", 0) or 0),
            }
            for civilization in active_asteroids
        ],
        active_bonds,
    )
    seq_index = {c.id: int(getattr(c, "current_event_seq", 0) or 0) for c in active_asteroids}
    enriched: list[dict[str, Any]] = []
    for civilization in evaluated:
        metadata = civilization.get("metadata", {})
        if not isinstance(metadata, dict):
            metadata = {}
        table_name = derive_table_name(value=civilization.get("value"), metadata=metadata)
        enriched.append(
            {
                **civilization,
                "metadata": metadata,
                "table_name": table_name,
                "table_id": derive_table_id(galaxy_id=galaxy_id, table_name=table_name),
                "current_event_seq": seq_index.get(civilization.get("id"), 0),
            }
        )

    guarded = evaluate_guardians(enriched)
    return guarded, active_bonds
