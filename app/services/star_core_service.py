from __future__ import annotations

import math
from collections import defaultdict
from datetime import UTC, datetime
from typing import Any
from uuid import UUID

from fastapi import HTTPException, status
from sqlalchemy import and_, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models import PhysicsStateRM, StarCorePolicyRM
from app.services.constellation_dashboard_service import ConstellationDashboardService
from app.services.event_store_service import EventStoreService
from app.services.universe_service import UniverseService


class StarCoreService:
    _PROFILE_PRESETS: dict[str, str] = {
        "ORIGIN": "balanced",
        "FLUX": "high_throughput",
        "SENTINEL": "integrity_first",
        "ARCHIVE": "low_activity",
    }
    _PHYSICAL_PROFILE_COEFFICIENTS: dict[str, dict[str, float]] = {
        "FORGE": {
            "a": 0.10,
            "b": 0.22,
            "c": 0.10,
            "d": 0.55,
            "e": 0.25,
            "f": 0.25,
            "u": 0.05,
            "v": 0.08,
            "g": 0.45,
            "h": 0.28,
            "l0": 0.26,
            "p0": 0.25,
        },
        "BALANCE": {
            "a": 0.08,
            "b": 0.14,
            "c": 0.14,
            "d": 0.40,
            "e": 0.20,
            "f": 0.30,
            "u": 0.07,
            "v": 0.07,
            "g": 0.35,
            "h": 0.22,
            "l0": 0.24,
            "p0": 0.20,
        },
        "ARCHIVE": {
            "a": 0.06,
            "b": 0.08,
            "c": 0.18,
            "d": 0.28,
            "e": 0.15,
            "f": 0.35,
            "u": 0.10,
            "v": 0.05,
            "g": 0.22,
            "h": 0.16,
            "l0": 0.22,
            "p0": 0.16,
        },
    }

    def __init__(
        self,
        *,
        event_store: EventStoreService | None = None,
        universe_service: UniverseService | None = None,
        constellation_dashboard_service: ConstellationDashboardService | None = None,
    ) -> None:
        self.event_store = event_store or EventStoreService()
        self.universe_service = universe_service or UniverseService(event_store=self.event_store)
        self.constellation_dashboard_service = constellation_dashboard_service or ConstellationDashboardService(
            universe_service=self.universe_service
        )

    @classmethod
    def _normalize_profile_key(cls, profile_key: str | None) -> str:
        candidate = str(profile_key or "ORIGIN").strip().upper()
        return candidate if candidate in cls._PROFILE_PRESETS else "ORIGIN"

    @classmethod
    def _law_preset_for_profile(cls, profile_key: str) -> str:
        return cls._PROFILE_PRESETS.get(profile_key, cls._PROFILE_PRESETS["ORIGIN"])

    @classmethod
    def _normalize_physical_profile_key(cls, profile_key: str | None) -> str:
        candidate = str(profile_key or "BALANCE").strip().upper()
        return candidate if candidate in cls._PHYSICAL_PROFILE_COEFFICIENTS else "BALANCE"

    @staticmethod
    def _clamp(value: float, min_value: float, max_value: float) -> float:
        return max(min_value, min(max_value, float(value)))

    @staticmethod
    def _phase_from_metrics(
        *, activity: float, stress: float, health: float, inactivity: float, corrosion: float
    ) -> str:
        if health <= 0.25 or (stress >= 0.85 and corrosion >= 0.65):
            return "CRITICAL"
        if corrosion >= 0.60:
            return "CORRODING"
        if stress >= 0.72:
            return "OVERLOADED"
        if activity >= 0.55:
            return "ACTIVE"
        if activity <= 0.20 and inactivity >= 0.55:
            return "DORMANT"
        return "CALM"

    @classmethod
    def _serialize_policy_row(
        cls,
        *,
        row: StarCorePolicyRM | None,
    ) -> dict[str, Any]:
        if row is None:
            profile_key = "ORIGIN"
            law_preset = cls._law_preset_for_profile(profile_key)
            return {
                "profile_key": profile_key,
                "law_preset": law_preset,
                "physical_profile_key": "BALANCE",
                "physical_profile_version": 1,
                "profile_mode": "auto",
                "no_hard_delete": True,
                "deletion_mode": "soft_delete",
                "occ_enforced": True,
                "idempotency_supported": True,
                "branch_scope_supported": True,
                "lock_status": "draft",
                "policy_version": 1,
                "locked_at": None,
                "can_edit_core_laws": True,
            }

        lock_status = str(row.lock_status or "draft").strip().lower() or "draft"
        profile_key = cls._normalize_profile_key(row.profile_key)
        law_preset = str(
            row.law_preset or cls._law_preset_for_profile(profile_key)
        ).strip() or cls._law_preset_for_profile(profile_key)
        return {
            "profile_key": profile_key,
            "law_preset": law_preset,
            "physical_profile_key": cls._normalize_physical_profile_key(
                getattr(row, "physical_profile_key", "BALANCE")
            ),
            "physical_profile_version": max(1, int(getattr(row, "physical_profile_version", 1) or 1)),
            "profile_mode": "locked" if lock_status == "locked" else "auto",
            "no_hard_delete": bool(row.no_hard_delete),
            "deletion_mode": str(row.deletion_mode or "soft_delete"),
            "occ_enforced": bool(row.occ_enforced),
            "idempotency_supported": bool(row.idempotency_supported),
            "branch_scope_supported": bool(row.branch_scope_supported),
            "lock_status": lock_status,
            "policy_version": max(1, int(row.policy_version or 1)),
            "locked_at": row.locked_at,
            "can_edit_core_laws": lock_status != "locked",
        }

    async def get_policy(
        self,
        session: AsyncSession,
        *,
        user_id: UUID,
        galaxy_id: UUID,
    ) -> dict[str, Any]:
        row = (
            await session.execute(
                select(StarCorePolicyRM).where(
                    StarCorePolicyRM.user_id == user_id,
                    StarCorePolicyRM.galaxy_id == galaxy_id,
                )
            )
        ).scalar_one_or_none()
        return self._serialize_policy_row(row=row)

    async def apply_profile_and_lock(
        self,
        session: AsyncSession,
        *,
        user_id: UUID,
        galaxy_id: UUID,
        profile_key: str,
        physical_profile_key: str | None = None,
        physical_profile_version: int | None = None,
        lock_after_apply: bool = True,
    ) -> dict[str, Any]:
        created_new = False
        row = (
            await session.execute(
                select(StarCorePolicyRM)
                .where(
                    StarCorePolicyRM.user_id == user_id,
                    StarCorePolicyRM.galaxy_id == galaxy_id,
                )
                .with_for_update()
            )
        ).scalar_one_or_none()
        if row is None:
            created_new = True
            row = StarCorePolicyRM(
                user_id=user_id,
                galaxy_id=galaxy_id,
            )
            session.add(row)
            await session.flush()

        current_lock_status = str(row.lock_status or "draft").strip().lower()
        if current_lock_status == "locked":
            raise HTTPException(
                status_code=status.HTTP_409_CONFLICT,
                detail={
                    "code": "STAR_CORE_POLICY_LOCKED",
                    "message": "Star Core policy is locked and cannot be edited directly.",
                    "context": "apply_star_core_profile",
                    "galaxy_id": str(galaxy_id),
                    "lock_status": "locked",
                },
            )

        normalized_profile_key = self._normalize_profile_key(profile_key)
        normalized_physical_profile_key = self._normalize_physical_profile_key(physical_profile_key)
        normalized_physical_profile_version = max(1, int(physical_profile_version or 1))
        now = datetime.now(UTC)
        profile_changed = str(row.profile_key or "").upper() != normalized_profile_key
        physical_changed = (
            str(getattr(row, "physical_profile_key", "BALANCE") or "").upper() != normalized_physical_profile_key
        )
        physical_version_changed = (
            max(1, int(getattr(row, "physical_profile_version", 1) or 1)) != normalized_physical_profile_version
        )
        lock_changed = lock_after_apply and current_lock_status != "locked"

        row.profile_key = normalized_profile_key
        row.law_preset = self._law_preset_for_profile(normalized_profile_key)
        row.physical_profile_key = normalized_physical_profile_key
        row.physical_profile_version = normalized_physical_profile_version
        row.updated_at = now
        if lock_after_apply:
            row.lock_status = "locked"
            row.locked_at = now
            row.locked_by = user_id
        else:
            row.lock_status = "draft"
            row.locked_at = None
            row.locked_by = None

        if created_new:
            row.policy_version = 1
        elif profile_changed or physical_changed or physical_version_changed or lock_changed:
            row.policy_version = max(1, int(row.policy_version or 1)) + 1
        elif not row.policy_version:
            row.policy_version = 1

        await session.flush()
        return self._serialize_policy_row(row=row)

    async def get_physics_profile(
        self,
        session: AsyncSession,
        *,
        user_id: UUID,
        galaxy_id: UUID,
    ) -> dict[str, Any]:
        row = (
            await session.execute(
                select(StarCorePolicyRM).where(
                    StarCorePolicyRM.user_id == user_id,
                    StarCorePolicyRM.galaxy_id == galaxy_id,
                )
            )
        ).scalar_one_or_none()
        lock_status = str(getattr(row, "lock_status", "draft") or "draft").strip().lower() or "draft"
        profile_key = self._normalize_physical_profile_key(getattr(row, "physical_profile_key", "BALANCE"))
        profile_version = max(1, int(getattr(row, "physical_profile_version", 1) or 1))
        coefficients = dict(
            self._PHYSICAL_PROFILE_COEFFICIENTS.get(profile_key, self._PHYSICAL_PROFILE_COEFFICIENTS["BALANCE"])
        )
        return {
            "galaxy_id": galaxy_id,
            "profile_key": profile_key,
            "profile_version": profile_version,
            "lock_status": lock_status,
            "locked_at": getattr(row, "locked_at", None),
            "coefficients": coefficients,
        }

    async def migrate_physics_profile(
        self,
        session: AsyncSession,
        *,
        user_id: UUID,
        galaxy_id: UUID,
        from_version: int,
        to_version: int,
        reason: str,
        dry_run: bool = True,
    ) -> dict[str, Any]:
        row = (
            await session.execute(
                select(StarCorePolicyRM)
                .where(
                    StarCorePolicyRM.user_id == user_id,
                    StarCorePolicyRM.galaxy_id == galaxy_id,
                )
                .with_for_update()
            )
        ).scalar_one_or_none()
        if row is None:
            raise HTTPException(
                status_code=status.HTTP_409_CONFLICT,
                detail={
                    "code": "STAR_CORE_POLICY_NOT_INITIALIZED",
                    "message": "Star Core policy is not initialized for this galaxy.",
                    "context": "migrate_star_physics_profile",
                    "galaxy_id": str(galaxy_id),
                },
            )

        lock_status = str(row.lock_status or "draft").strip().lower() or "draft"
        if lock_status != "locked":
            raise HTTPException(
                status_code=status.HTTP_409_CONFLICT,
                detail={
                    "code": "STAR_CORE_POLICY_NOT_LOCKED",
                    "message": "Star Core policy must be locked before physics migration.",
                    "context": "migrate_star_physics_profile",
                    "galaxy_id": str(galaxy_id),
                    "lock_status": lock_status,
                },
            )

        current_version = max(1, int(getattr(row, "physical_profile_version", 1) or 1))
        expected_from_version = max(1, int(from_version))
        target_to_version = max(1, int(to_version))
        if expected_from_version != current_version:
            raise HTTPException(
                status_code=status.HTTP_409_CONFLICT,
                detail={
                    "code": "STAR_CORE_PROFILE_VERSION_MISMATCH",
                    "message": "Current physical profile version does not match from_version.",
                    "context": "migrate_star_physics_profile",
                    "galaxy_id": str(galaxy_id),
                    "current_version": current_version,
                    "from_version": expected_from_version,
                },
            )
        if target_to_version <= expected_from_version:
            raise HTTPException(
                status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
                detail={
                    "code": "STAR_CORE_INVALID_MIGRATION_TARGET",
                    "message": "to_version must be greater than from_version.",
                    "context": "migrate_star_physics_profile",
                    "galaxy_id": str(galaxy_id),
                    "from_version": expected_from_version,
                    "to_version": target_to_version,
                },
            )

        safe_reason = str(reason or "").strip()
        if not safe_reason:
            raise HTTPException(
                status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
                detail={
                    "code": "STAR_CORE_MIGRATION_REASON_REQUIRED",
                    "message": "Migration reason is required.",
                    "context": "migrate_star_physics_profile",
                    "galaxy_id": str(galaxy_id),
                },
            )

        runtime_preview = await self.get_planet_physics_runtime(
            session=session,
            user_id=user_id,
            galaxy_id=galaxy_id,
            branch_id=None,
            after_event_seq=None,
            limit=1000,
        )
        impacted = len(runtime_preview.get("items") or [])

        if not dry_run:
            now = datetime.now(UTC)
            row.physical_profile_version = target_to_version
            row.updated_at = now
            row.policy_version = max(1, int(row.policy_version or 1)) + 1
            await session.flush()

        return {
            "galaxy_id": galaxy_id,
            "profile_key": self._normalize_physical_profile_key(getattr(row, "physical_profile_key", "BALANCE")),
            "from_version": expected_from_version,
            "to_version": target_to_version,
            "reason": safe_reason,
            "dry_run": bool(dry_run),
            "applied": not bool(dry_run),
            "lock_status": lock_status,
            "impacted_planets": impacted,
            "estimated_runtime_items": impacted,
        }

    async def get_planet_physics_runtime(
        self,
        session: AsyncSession,
        *,
        user_id: UUID,
        galaxy_id: UUID,
        branch_id: UUID | None = None,
        after_event_seq: int | None = None,
        limit: int = 200,
    ) -> dict[str, Any]:
        latest_event_seq = await self.event_store.latest_event_seq(
            session=session,
            user_id=user_id,
            galaxy_id=galaxy_id,
            branch_id=branch_id,
        )
        if latest_event_seq <= 0:
            return {"as_of_event_seq": 0, "items": []}

        safe_limit = max(1, min(int(limit), 1000))
        profile = await self.get_physics_profile(
            session=session,
            user_id=user_id,
            galaxy_id=galaxy_id,
        )
        coefficients = profile.get("coefficients") if isinstance(profile.get("coefficients"), dict) else {}
        a = float(coefficients.get("a", 0.08))
        b = float(coefficients.get("b", 0.14))
        c = float(coefficients.get("c", 0.14))
        d = float(coefficients.get("d", 0.40))
        e = float(coefficients.get("e", 0.20))
        f = float(coefficients.get("f", 0.30))
        g = float(coefficients.get("g", 0.35))
        h = float(coefficients.get("h", 0.22))
        l0 = float(coefficients.get("l0", 0.24))
        p0 = float(coefficients.get("p0", 0.20))

        tables = await self.universe_service.tables_snapshot(
            session=session,
            user_id=user_id,
            galaxy_id=galaxy_id,
            branch_id=branch_id,
            as_of=None,
        )
        if not tables:
            return {"as_of_event_seq": int(latest_event_seq), "items": []}

        asteroid_ids: set[UUID] = set()
        table_member_ids: dict[UUID, list[UUID]] = {}
        for table in tables:
            if not isinstance(table, dict):
                continue
            table_id_raw = table.get("table_id")
            if not isinstance(table_id_raw, UUID):
                continue
            member_ids: list[UUID] = []
            for member in table.get("members") or []:
                if not isinstance(member, dict):
                    continue
                member_id = member.get("id")
                if isinstance(member_id, UUID):
                    member_ids.append(member_id)
                    asteroid_ids.add(member_id)
            table_member_ids[table_id_raw] = member_ids

        if not table_member_ids:
            return {"as_of_event_seq": int(latest_event_seq), "items": []}

        physics_rows = list(
            (
                await session.execute(
                    select(PhysicsStateRM).where(
                        and_(
                            PhysicsStateRM.user_id == user_id,
                            PhysicsStateRM.galaxy_id == galaxy_id,
                            PhysicsStateRM.entity_kind == "asteroid",
                            PhysicsStateRM.deleted_at.is_(None),
                            PhysicsStateRM.entity_id.in_(asteroid_ids if asteroid_ids else {UUID(int=0)}),
                        )
                    )
                )
            )
            .scalars()
            .all()
        )
        physics_by_asteroid_id = {row.entity_id: row for row in physics_rows if isinstance(row.entity_id, UUID)}

        items: list[dict[str, Any]] = []
        for table_id, members in table_member_ids.items():
            rows_count = len(members)
            if rows_count <= 0:
                activity = 0.0
                stress = 0.0
                corrosion = 0.0
                source_event_seq = 0
            else:
                accumulator_activity = 0.0
                accumulator_stress = 0.0
                accumulator_corrosion = 0.0
                source_event_seq = 0
                for asteroid_id in members:
                    state = physics_by_asteroid_id.get(asteroid_id)
                    if state is None:
                        continue
                    pulse_factor = float(getattr(state, "pulse_factor", 1.0) or 1.0)
                    stress_score = float(getattr(state, "stress_score", 0.0) or 0.0)
                    opacity_factor = float(getattr(state, "opacity_factor", 1.0) or 1.0)
                    accumulator_activity += self._clamp((pulse_factor - 0.9) / 1.5, 0.0, 1.0)
                    accumulator_stress += self._clamp(stress_score, 0.0, 1.0)
                    accumulator_corrosion += self._clamp(1.0 - opacity_factor, 0.0, 1.0)
                    source_event_seq = max(source_event_seq, int(getattr(state, "source_event_seq", 0) or 0))
                divisor = max(1, len(members))
                activity = self._clamp(accumulator_activity / divisor, 0.0, 1.0)
                stress = self._clamp(accumulator_stress / divisor, 0.0, 1.0)
                corrosion = self._clamp(accumulator_corrosion / divisor, 0.0, 1.0)

            inactivity = self._clamp(1.0 - activity, 0.0, 1.0)
            health = self._clamp(1.0 - (stress * 0.65 + corrosion * 0.35), 0.0, 1.0)
            size_factor = self._clamp(
                1.0 + a * math.log10(max(1, rows_count) + 1) + b * activity - c * corrosion, 0.85, 2.4
            )
            luminosity = self._clamp(l0 + d * activity + e * stress - f * corrosion, 0.0, 1.0)
            pulse_rate = self._clamp(p0 + g * activity + h * stress, 0.1, 2.5)
            hue = self._clamp(0.01 + health * 0.33 - corrosion * 0.08, 0.0, 1.0)
            saturation = self._clamp(0.45 + (1.0 - health) * 0.35 + corrosion * 0.20, 0.0, 1.0)
            crack_intensity = self._clamp(corrosion * 0.9 + stress * 0.2, 0.0, 1.0)
            phase = self._phase_from_metrics(
                activity=activity,
                stress=stress,
                health=health,
                inactivity=inactivity,
                corrosion=corrosion,
            )
            items.append(
                {
                    "table_id": table_id,
                    "phase": phase,
                    "metrics": {
                        "activity": activity,
                        "stress": stress,
                        "health": health,
                        "inactivity": inactivity,
                        "corrosion": corrosion,
                        "rows": rows_count,
                    },
                    "visual": {
                        "size_factor": size_factor,
                        "luminosity": luminosity,
                        "pulse_rate": pulse_rate,
                        "hue": hue,
                        "saturation": saturation,
                        "corrosion_level": corrosion,
                        "crack_intensity": crack_intensity,
                    },
                    "source_event_seq": source_event_seq,
                    "engine_version": "star-physics-v2-preview",
                }
            )

        filtered = [
            item
            for item in items
            if after_event_seq is None or int(item.get("source_event_seq") or 0) > int(after_event_seq)
        ]
        filtered.sort(key=lambda item: (-int(item.get("source_event_seq") or 0), str(item.get("table_id") or "")))
        return {
            "as_of_event_seq": int(latest_event_seq),
            "items": filtered[:safe_limit],
        }

    async def get_runtime(
        self,
        session: AsyncSession,
        *,
        user_id: UUID,
        galaxy_id: UUID,
        branch_id: UUID | None = None,
        window_events: int = 120,
    ) -> dict[str, Any]:
        safe_window = max(16, min(int(window_events), 256))
        latest_event_seq = await self.event_store.latest_event_seq(
            session=session,
            user_id=user_id,
            galaxy_id=galaxy_id,
            branch_id=branch_id,
        )

        if latest_event_seq <= 0:
            return {
                "as_of_event_seq": 0,
                "events_count": 0,
                "writes_per_minute": 0.0,
            }

        events = await self.event_store.list_events_after(
            session=session,
            user_id=user_id,
            galaxy_id=galaxy_id,
            branch_id=branch_id,
            after_event_seq=max(0, latest_event_seq - safe_window),
            limit=safe_window,
        )

        writes_per_minute = self._compute_writes_per_minute(events=events)

        return {
            "as_of_event_seq": int(latest_event_seq),
            "events_count": len(events),
            "writes_per_minute": writes_per_minute,
        }

    async def list_pulse(
        self,
        session: AsyncSession,
        *,
        user_id: UUID,
        galaxy_id: UUID,
        branch_id: UUID | None = None,
        after_event_seq: int | None = None,
        limit: int = 64,
    ) -> dict[str, Any]:
        safe_limit = max(1, min(int(limit), 256))

        if after_event_seq is None:
            latest_event_seq = await self.event_store.latest_event_seq(
                session=session,
                user_id=user_id,
                galaxy_id=galaxy_id,
                branch_id=branch_id,
            )
            if latest_event_seq <= 0:
                return {
                    "galaxy_id": galaxy_id,
                    "branch_id": branch_id,
                    "last_event_seq": 0,
                    "sampled_count": 0,
                    "event_types": [],
                    "events": [],
                }
            cursor = max(0, latest_event_seq - safe_limit)
        else:
            cursor = max(0, int(after_event_seq))

        events = await self.event_store.list_events_after(
            session=session,
            user_id=user_id,
            galaxy_id=galaxy_id,
            branch_id=branch_id,
            after_event_seq=cursor,
            limit=safe_limit,
        )

        serialized: list[dict[str, Any]] = []
        for item in events:
            visual_hint, intensity = self._derive_visual_hint(
                event_type=str(item.event_type or ""), payload=item.payload
            )
            serialized.append(
                {
                    "event_seq": int(item.event_seq),
                    "event_type": str(item.event_type or ""),
                    "entity_id": item.entity_id,
                    "visual_hint": visual_hint,
                    "intensity": intensity,
                }
            )

        last_event_seq = int(events[-1].event_seq) if events else int(cursor)
        event_types = sorted({row["event_type"] for row in serialized if row["event_type"]})
        return {
            "galaxy_id": galaxy_id,
            "branch_id": branch_id,
            "last_event_seq": last_event_seq,
            "sampled_count": len(serialized),
            "event_types": event_types,
            "events": serialized,
        }

    async def get_domain_metrics(
        self,
        session: AsyncSession,
        *,
        user_id: UUID,
        galaxy_id: UUID,
        branch_id: UUID | None = None,
        window_events: int = 240,
    ) -> dict[str, Any]:
        safe_window = max(32, min(int(window_events), 512))
        constellations = await self.constellation_dashboard_service.list_constellations(
            session=session,
            user_id=user_id,
            galaxy_id=galaxy_id,
            branch_id=branch_id,
            as_of=None,
        )
        tables = await self.universe_service.tables_snapshot(
            session=session,
            user_id=user_id,
            galaxy_id=galaxy_id,
            branch_id=branch_id,
            as_of=None,
        )
        table_to_domain, asteroid_to_domain, bond_to_domains = self._build_entity_domain_maps(tables=tables)

        latest_event_seq = await self.event_store.latest_event_seq(
            session=session,
            user_id=user_id,
            galaxy_id=galaxy_id,
            branch_id=branch_id,
        )
        if latest_event_seq <= 0:
            return {
                "galaxy_id": galaxy_id,
                "branch_id": branch_id,
                "sampled_window_size": safe_window,
                "sampled_since": None,
                "sampled_until": None,
                "total_events_count": 0,
                "domains": [
                    {
                        "domain_name": str(item.get("name") or "Uncategorized"),
                        "status": str(item.get("status") or "GREEN"),
                        "events_count": 0,
                        "activity_intensity": 0.0,
                    }
                    for item in constellations
                    if isinstance(item, dict)
                ],
                "updated_at": datetime.now(UTC),
            }

        events = await self.event_store.list_events_after(
            session=session,
            user_id=user_id,
            galaxy_id=galaxy_id,
            branch_id=branch_id,
            after_event_seq=max(0, latest_event_seq - safe_window),
            limit=safe_window,
        )
        sampled_since: datetime | None = events[0].timestamp if events else None
        sampled_until: datetime | None = events[-1].timestamp if events else None

        domain_event_counts: dict[str, int] = defaultdict(int)
        for event in events:
            domains = self._resolve_event_domains(
                entity_id=event.entity_id,
                payload=event.payload,
                table_to_domain=table_to_domain,
                asteroid_to_domain=asteroid_to_domain,
                bond_to_domains=bond_to_domains,
            )
            for domain in domains:
                domain_event_counts[domain] += 1

        max_event_count = max(domain_event_counts.values(), default=0)

        baseline_by_domain: dict[str, dict[str, Any]] = {}
        for item in constellations:
            if not isinstance(item, dict):
                continue
            name = str(item.get("name") or "Uncategorized")
            baseline_by_domain[name] = {
                "domain_name": name,
                "status": str(item.get("status") or "GREEN"),
            }

        domains = sorted(
            set(baseline_by_domain.keys()) | set(domain_event_counts.keys()), key=lambda value: value.lower()
        )
        rows: list[dict[str, Any]] = []
        for domain_name in domains:
            baseline = baseline_by_domain.get(
                domain_name,
                {
                    "domain_name": domain_name,
                    "status": "GREEN",
                },
            )
            event_count = int(domain_event_counts.get(domain_name, 0))
            activity_intensity = round((event_count / max_event_count), 3) if max_event_count > 0 else 0.0
            rows.append(
                {
                    **baseline,
                    "events_count": event_count,
                    "activity_intensity": activity_intensity,
                }
            )

        rows.sort(key=lambda item: (-int(item.get("events_count") or 0), str(item.get("domain_name") or "").lower()))
        return {
            "galaxy_id": galaxy_id,
            "branch_id": branch_id,
            "sampled_window_size": safe_window,
            "sampled_since": sampled_since,
            "sampled_until": sampled_until,
            "total_events_count": len(events),
            "domains": rows,
            "updated_at": datetime.now(UTC),
        }

    @staticmethod
    def _compute_writes_per_minute(*, events: list[Any]) -> float:
        if not events:
            return 0.0
        first = events[0].timestamp
        last = events[-1].timestamp
        span_minutes = max(1.0, (last - first).total_seconds() / 60.0)
        return round(len(events) / span_minutes, 3)

    @staticmethod
    def _parse_uuid_like(value: Any) -> UUID | None:
        if value is None:
            return None
        try:
            return UUID(str(value))
        except (TypeError, ValueError, AttributeError):
            return None

    @classmethod
    def _build_entity_domain_maps(
        cls,
        *,
        tables: list[dict[str, Any]],
    ) -> tuple[dict[str, str], dict[str, str], dict[str, set[str]]]:
        table_to_domain: dict[str, str] = {}
        asteroid_to_domain: dict[str, str] = {}
        bond_to_domains: dict[str, set[str]] = defaultdict(set)

        for table in tables:
            if not isinstance(table, dict):
                continue
            domain_name = str(table.get("constellation_name") or "Uncategorized")
            table_id_uuid = cls._parse_uuid_like(table.get("table_id"))
            if table_id_uuid is not None:
                table_to_domain[str(table_id_uuid)] = domain_name

            for member in table.get("members") or []:
                if not isinstance(member, dict):
                    continue
                member_id_uuid = cls._parse_uuid_like(member.get("id"))
                if member_id_uuid is not None:
                    asteroid_to_domain[str(member_id_uuid)] = domain_name

            for bond in (table.get("internal_bonds") or []) + (table.get("external_bonds") or []):
                if not isinstance(bond, dict):
                    continue
                bond_id_uuid = cls._parse_uuid_like(bond.get("id"))
                if bond_id_uuid is not None:
                    bond_to_domains[str(bond_id_uuid)].add(domain_name)

        return table_to_domain, asteroid_to_domain, bond_to_domains

    @classmethod
    def _resolve_event_domains(
        cls,
        *,
        entity_id: UUID,
        payload: Any,
        table_to_domain: dict[str, str],
        asteroid_to_domain: dict[str, str],
        bond_to_domains: dict[str, set[str]],
    ) -> set[str]:
        domains: set[str] = set()
        entity_key = str(entity_id)

        table_domain = table_to_domain.get(entity_key)
        if table_domain:
            domains.add(table_domain)

        asteroid_domain = asteroid_to_domain.get(entity_key)
        if asteroid_domain:
            domains.add(asteroid_domain)

        bond_domains = bond_to_domains.get(entity_key)
        if bond_domains:
            domains.update(bond_domains)

        payload_dict = payload if isinstance(payload, dict) else {}
        metadata_dict = payload_dict.get("metadata") if isinstance(payload_dict.get("metadata"), dict) else {}

        for key in ("table_id", "source_table_id", "target_table_id"):
            table_id_uuid = cls._parse_uuid_like(payload_dict.get(key))
            if table_id_uuid is None:
                continue
            domain = table_to_domain.get(str(table_id_uuid))
            if domain:
                domains.add(domain)

        metadata_table_uuid = cls._parse_uuid_like(metadata_dict.get("table_id"))
        if metadata_table_uuid is not None:
            domain = table_to_domain.get(str(metadata_table_uuid))
            if domain:
                domains.add(domain)

        for key in (
            "asteroid_id",
            "source_civilization_id",
            "target_civilization_id",
            "source_asteroid_id",
            "target_asteroid_id",
        ):
            asteroid_uuid = cls._parse_uuid_like(payload_dict.get(key))
            if asteroid_uuid is None:
                continue
            asteroid_key = str(asteroid_uuid)
            domain = asteroid_to_domain.get(asteroid_key)
            if domain:
                domains.add(domain)

        payload_constellation = str(payload_dict.get("constellation_name") or "").strip()
        if payload_constellation:
            domains.add(payload_constellation)

        if not domains:
            domains.add("Uncategorized")
        return domains

    @staticmethod
    def _derive_visual_hint(*, event_type: str, payload: Any) -> tuple[str, float]:
        kind = event_type.strip().lower()
        payload_dict = payload if isinstance(payload, dict) else {}
        if kind in {"ingest", "insert", "create_asteroid", "create_table"}:
            return "source_shockwave", 1.0
        if "extinguish" in kind:
            return "fade_to_singularity", 0.85
        if kind in {"link", "create_bond"}:
            return "bridge_flux", 0.75
        if kind.startswith("update") or kind in {"mutate", "patch"}:
            if payload_dict.get("is_deleted") is True:
                return "fade_to_singularity", 0.9
            return "surface_pulse", 0.65
        return "orbital_pulse", 0.55
