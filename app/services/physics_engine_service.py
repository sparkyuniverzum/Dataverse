from __future__ import annotations

import math
from datetime import UTC, datetime
from typing import Any
from uuid import UUID

from sqlalchemy import and_, select, tuple_, update
from sqlalchemy.dialects.postgresql import insert
from sqlalchemy.ext.asyncio import AsyncSession

from app.domains.bonds.semantics import normalize_bond_type
from app.models import Bond, CalcStateRM, PhysicsStateRM


def _clamp(value: float, min_value: float, max_value: float) -> float:
    return max(min_value, min(max_value, float(value)))


def _saturate_count(count: int | float, softness: float) -> float:
    safe_count = max(0.0, float(count))
    safe_softness = max(0.001, float(softness))
    return 1.0 - math.exp(-safe_count / safe_softness)


class PhysicsEngineService:
    """Visual-only projection computed from calc state and graph topology.

    This service does not mutate domain/business values. It only projects
    render-centric factors for the 3D UI.
    """

    def __init__(self, *, engine_version: str = "physics-v1") -> None:
        self.engine_version = str(engine_version).strip() or "physics-v1"

    def _derive_civilization_state(
        self, *, error_count: int, circular_fields_count: int, bond_degree: int
    ) -> dict[str, float]:
        error_pressure = _saturate_count(error_count, 2.1)
        circular_pressure = _saturate_count(circular_fields_count, 1.8)
        bond_pressure = _saturate_count(bond_degree, 2.6)

        stress = _clamp(circular_pressure * 0.5 + error_pressure * 0.35 + bond_pressure * 0.15, 0.0, 1.0)
        mass_factor = _clamp(0.92 + bond_pressure * 0.38 + stress * 0.24, 0.84, 1.95)
        radius_factor = _clamp(0.9 + stress * 0.34 + bond_pressure * 0.16, 0.88, 1.34)
        emissive_boost = _clamp(stress * 0.62 + error_pressure * 0.2, 0.0, 1.0)
        pulse_factor = _clamp(0.92 + stress * 1.05 + bond_pressure * 0.24, 0.9, 2.4)
        opacity_factor = _clamp(1.0 - stress * 0.36, 0.42, 1.0)
        attraction_factor = _clamp(0.94 + bond_pressure * 0.44 + mass_factor * 0.12, 0.9, 2.5)

        return {
            "stress_score": stress,
            "mass_factor": mass_factor,
            "radius_factor": radius_factor,
            "emissive_boost": emissive_boost,
            "pulse_factor": pulse_factor,
            "opacity_factor": opacity_factor,
            "attraction_factor": attraction_factor,
        }

    def _derive_bond_state(
        self,
        *,
        bond_type: str,
        source_stress: float,
        target_stress: float,
        source_degree: int,
        target_degree: int,
    ) -> dict[str, float]:
        type_key = normalize_bond_type(bond_type)
        flow_bias = 0.2 if type_key == "FLOW" else (0.08 if type_key == "GUARDIAN" else 0.04)
        stress = _clamp((source_stress + target_stress) * 0.5 + flow_bias, 0.0, 1.0)
        degree_pressure = _saturate_count(source_degree + target_degree, 4.0)

        mass_factor = _clamp(0.9 + degree_pressure * 0.3 + stress * 0.2, 0.84, 1.9)
        radius_factor = _clamp(0.9 + stress * 0.28 + degree_pressure * 0.1, 0.88, 1.3)
        emissive_boost = _clamp(stress * 0.55 + flow_bias * 0.4, 0.0, 1.0)
        pulse_factor = _clamp(0.92 + stress * 0.9 + flow_bias * 1.2, 0.9, 2.3)
        opacity_factor = _clamp(1.0 - stress * 0.28, 0.45, 1.0)
        attraction_factor = _clamp(0.94 + degree_pressure * 0.32 + flow_bias * 0.5, 0.9, 2.2)

        return {
            "stress_score": stress,
            "mass_factor": mass_factor,
            "radius_factor": radius_factor,
            "emissive_boost": emissive_boost,
            "pulse_factor": pulse_factor,
            "opacity_factor": opacity_factor,
            "attraction_factor": attraction_factor,
        }

    async def project_galaxy(
        self,
        *,
        session: AsyncSession,
        user_id: UUID,
        galaxy_id: UUID,
        source_event_seq: int,
    ) -> None:
        now = datetime.now(UTC)
        normalized_source_seq = max(0, int(source_event_seq))

        calc_rows = list(
            (
                await session.execute(
                    select(
                        CalcStateRM.civilization_id,
                        CalcStateRM.error_count,
                        CalcStateRM.circular_fields_count,
                        CalcStateRM.calculated_values,
                    ).where(
                        and_(
                            CalcStateRM.user_id == user_id,
                            CalcStateRM.galaxy_id == galaxy_id,
                            CalcStateRM.deleted_at.is_(None),
                        )
                    )
                )
            ).all()
        )

        civilization_ids = {row.civilization_id for row in calc_rows if isinstance(row.civilization_id, UUID)}

        bonds = list(
            (
                await session.execute(
                    select(Bond.id, Bond.source_civilization_id, Bond.target_civilization_id, Bond.type).where(
                        and_(
                            Bond.user_id == user_id,
                            Bond.galaxy_id == galaxy_id,
                            Bond.is_deleted.is_(False),
                        )
                    )
                )
            ).all()
        )

        degree_by_civilization: dict[UUID, int] = {civilization_id: 0 for civilization_id in civilization_ids}
        for bond in bonds:
            source_civilization_id = (
                bond.source_civilization_id if isinstance(bond.source_civilization_id, UUID) else None
            )
            target_civilization_id = (
                bond.target_civilization_id if isinstance(bond.target_civilization_id, UUID) else None
            )
            if source_civilization_id in degree_by_civilization:
                degree_by_civilization[source_civilization_id] += 1
            if target_civilization_id in degree_by_civilization:
                degree_by_civilization[target_civilization_id] += 1

        civilization_state_by_id: dict[UUID, dict[str, float]] = {}
        active_entity_keys: set[tuple[str, UUID]] = set()

        for row in calc_rows:
            civilization_id = row.civilization_id if isinstance(row.civilization_id, UUID) else None
            if civilization_id is None:
                continue
            state = self._derive_civilization_state(
                error_count=int(row.error_count or 0),
                circular_fields_count=int(row.circular_fields_count or 0),
                bond_degree=int(degree_by_civilization.get(civilization_id, 0) or 0),
            )
            civilization_state_by_id[civilization_id] = state
            active_entity_keys.add(("civilization", civilization_id))

            payload = {
                "entity_kind": "civilization",
                "error_count": int(row.error_count or 0),
                "circular_fields_count": int(row.circular_fields_count or 0),
                "bond_degree": int(degree_by_civilization.get(civilization_id, 0) or 0),
                "calculated_values_keys": sorted(list((row.calculated_values or {}).keys()))
                if isinstance(row.calculated_values, dict)
                else [],
            }
            await self._upsert_state(
                session=session,
                user_id=user_id,
                galaxy_id=galaxy_id,
                entity_kind="civilization",
                entity_id=civilization_id,
                source_event_seq=normalized_source_seq,
                factors=state,
                payload=payload,
                now=now,
            )

        for bond in bonds:
            bond_id = bond.id if isinstance(bond.id, UUID) else None
            source_civilization_id = (
                bond.source_civilization_id if isinstance(bond.source_civilization_id, UUID) else None
            )
            target_civilization_id = (
                bond.target_civilization_id if isinstance(bond.target_civilization_id, UUID) else None
            )
            if bond_id is None or source_civilization_id is None or target_civilization_id is None:
                continue
            if (
                source_civilization_id not in civilization_state_by_id
                or target_civilization_id not in civilization_state_by_id
            ):
                continue

            source_state = civilization_state_by_id[source_civilization_id]
            target_state = civilization_state_by_id[target_civilization_id]
            state = self._derive_bond_state(
                bond_type=str(bond.type or "RELATION"),
                source_stress=float(source_state.get("stress_score", 0.0)),
                target_stress=float(target_state.get("stress_score", 0.0)),
                source_degree=int(degree_by_civilization.get(source_civilization_id, 0) or 0),
                target_degree=int(degree_by_civilization.get(target_civilization_id, 0) or 0),
            )
            active_entity_keys.add(("bond", bond_id))
            payload = {
                "entity_kind": "bond",
                "type": normalize_bond_type(str(bond.type or "RELATION")),
                "source_civilization_id": str(source_civilization_id),
                "target_civilization_id": str(target_civilization_id),
            }
            await self._upsert_state(
                session=session,
                user_id=user_id,
                galaxy_id=galaxy_id,
                entity_kind="bond",
                entity_id=bond_id,
                source_event_seq=normalized_source_seq,
                factors=state,
                payload=payload,
                now=now,
            )

        await self._mark_stale_deleted(
            session=session,
            user_id=user_id,
            galaxy_id=galaxy_id,
            source_event_seq=normalized_source_seq,
            active_entity_keys=active_entity_keys,
            now=now,
        )

    async def _upsert_state(
        self,
        *,
        session: AsyncSession,
        user_id: UUID,
        galaxy_id: UUID,
        entity_kind: str,
        entity_id: UUID,
        source_event_seq: int,
        factors: dict[str, float],
        payload: dict[str, Any],
        now: datetime,
    ) -> None:
        stmt = insert(PhysicsStateRM).values(
            user_id=user_id,
            galaxy_id=galaxy_id,
            entity_kind=entity_kind,
            entity_id=entity_id,
            source_event_seq=source_event_seq,
            engine_version=self.engine_version,
            stress_score=float(factors["stress_score"]),
            mass_factor=float(factors["mass_factor"]),
            radius_factor=float(factors["radius_factor"]),
            emissive_boost=float(factors["emissive_boost"]),
            pulse_factor=float(factors["pulse_factor"]),
            opacity_factor=float(factors["opacity_factor"]),
            attraction_factor=float(factors["attraction_factor"]),
            payload=payload,
            updated_at=now,
            deleted_at=None,
        )
        stmt = stmt.on_conflict_do_update(
            index_elements=[
                PhysicsStateRM.user_id,
                PhysicsStateRM.galaxy_id,
                PhysicsStateRM.entity_kind,
                PhysicsStateRM.entity_id,
            ],
            set_={
                "source_event_seq": source_event_seq,
                "engine_version": self.engine_version,
                "stress_score": float(factors["stress_score"]),
                "mass_factor": float(factors["mass_factor"]),
                "radius_factor": float(factors["radius_factor"]),
                "emissive_boost": float(factors["emissive_boost"]),
                "pulse_factor": float(factors["pulse_factor"]),
                "opacity_factor": float(factors["opacity_factor"]),
                "attraction_factor": float(factors["attraction_factor"]),
                "payload": payload,
                "updated_at": now,
                "deleted_at": None,
            },
        )
        await session.execute(stmt)

    async def _mark_stale_deleted(
        self,
        *,
        session: AsyncSession,
        user_id: UUID,
        galaxy_id: UUID,
        source_event_seq: int,
        active_entity_keys: set[tuple[str, UUID]],
        now: datetime,
    ) -> None:
        rows = list(
            (
                await session.execute(
                    select(PhysicsStateRM.entity_kind, PhysicsStateRM.entity_id).where(
                        and_(
                            PhysicsStateRM.user_id == user_id,
                            PhysicsStateRM.galaxy_id == galaxy_id,
                            PhysicsStateRM.deleted_at.is_(None),
                        )
                    )
                )
            ).all()
        )

        stale_keys = {
            (str(row.entity_kind or ""), row.entity_id) for row in rows if isinstance(row.entity_id, UUID)
        } - active_entity_keys
        if not stale_keys:
            return

        stale_pairs = list(stale_keys)
        await session.execute(
            update(PhysicsStateRM)
            .where(
                and_(
                    PhysicsStateRM.user_id == user_id,
                    PhysicsStateRM.galaxy_id == galaxy_id,
                    PhysicsStateRM.deleted_at.is_(None),
                    tuple_(PhysicsStateRM.entity_kind, PhysicsStateRM.entity_id).in_(stale_pairs),
                )
            )
            .values(
                source_event_seq=source_event_seq,
                engine_version=self.engine_version,
                updated_at=now,
                deleted_at=now,
            )
        )
