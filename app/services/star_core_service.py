from __future__ import annotations

from collections import Counter, defaultdict
from datetime import UTC, datetime
from typing import Any
from uuid import UUID

from fastapi import HTTPException, status
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models import StarCorePolicyRM
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
    def _serialize_policy_row(
        cls,
        *,
        row: StarCorePolicyRM | None,
        user_id: UUID,
        galaxy_id: UUID,
    ) -> dict[str, Any]:
        if row is None:
            profile_key = "ORIGIN"
            law_preset = cls._law_preset_for_profile(profile_key)
            return {
                "user_id": user_id,
                "galaxy_id": galaxy_id,
                "profile_key": profile_key,
                "law_preset": law_preset,
                "profile_mode": "auto",
                "topology_mode": "single_star_per_galaxy",
                "no_hard_delete": True,
                "deletion_mode": "soft_delete",
                "soft_delete_flag_field": "is_deleted",
                "soft_delete_timestamp_field": "deleted_at",
                "event_sourcing_enabled": True,
                "occ_enforced": True,
                "idempotency_supported": True,
                "branch_scope_supported": True,
                "lock_status": "draft",
                "policy_version": 1,
                "locked_at": None,
                "locked_by": None,
                "can_edit_core_laws": True,
                "generated_at": datetime.now(UTC),
            }

        lock_status = str(row.lock_status or "draft").strip().lower() or "draft"
        profile_key = cls._normalize_profile_key(row.profile_key)
        law_preset = str(row.law_preset or cls._law_preset_for_profile(profile_key)).strip() or cls._law_preset_for_profile(
            profile_key
        )
        generated_at = row.updated_at if row.updated_at is not None else datetime.now(UTC)
        return {
            "user_id": row.user_id,
            "galaxy_id": row.galaxy_id,
            "profile_key": profile_key,
            "law_preset": law_preset,
            "profile_mode": "locked" if lock_status == "locked" else "auto",
            "topology_mode": "single_star_per_galaxy",
            "no_hard_delete": bool(row.no_hard_delete),
            "deletion_mode": str(row.deletion_mode or "soft_delete"),
            "soft_delete_flag_field": str(row.soft_delete_flag_field or "is_deleted"),
            "soft_delete_timestamp_field": str(row.soft_delete_timestamp_field or "deleted_at"),
            "event_sourcing_enabled": bool(row.event_sourcing_enabled),
            "occ_enforced": bool(row.occ_enforced),
            "idempotency_supported": bool(row.idempotency_supported),
            "branch_scope_supported": bool(row.branch_scope_supported),
            "lock_status": lock_status,
            "policy_version": max(1, int(row.policy_version or 1)),
            "locked_at": row.locked_at,
            "locked_by": row.locked_by,
            "can_edit_core_laws": lock_status != "locked",
            "generated_at": generated_at,
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
        return self._serialize_policy_row(row=row, user_id=user_id, galaxy_id=galaxy_id)

    async def apply_profile_and_lock(
        self,
        session: AsyncSession,
        *,
        user_id: UUID,
        galaxy_id: UUID,
        profile_key: str,
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
        now = datetime.now(UTC)
        profile_changed = str(row.profile_key or "").upper() != normalized_profile_key
        lock_changed = lock_after_apply and current_lock_status != "locked"

        row.profile_key = normalized_profile_key
        row.law_preset = self._law_preset_for_profile(normalized_profile_key)
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
        elif profile_changed or lock_changed:
            row.policy_version = max(1, int(row.policy_version or 1)) + 1
        elif not row.policy_version:
            row.policy_version = 1

        await session.flush()
        return self._serialize_policy_row(row=row, user_id=user_id, galaxy_id=galaxy_id)

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
                "user_id": user_id,
                "galaxy_id": galaxy_id,
                "branch_id": branch_id,
                "as_of_event_seq": 0,
                "sampled_window_size": safe_window,
                "sampled_since": None,
                "sampled_until": None,
                "events_count": 0,
                "writes_per_minute": 0.0,
                "hot_event_types": [],
                "hot_entities_count": 0,
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
        event_counter = Counter(str(item.event_type or "") for item in events if item.event_type)
        hot_event_types = [
            event_type
            for event_type, _count in sorted(event_counter.items(), key=lambda pair: (-pair[1], pair[0]))[:5]
        ]
        unique_entities = {item.entity_id for item in events if item.entity_id is not None}
        writes_per_minute = self._compute_writes_per_minute(events=events)

        return {
            "user_id": user_id,
            "galaxy_id": galaxy_id,
            "branch_id": branch_id,
            "as_of_event_seq": int(latest_event_seq),
            "sampled_window_size": safe_window,
            "sampled_since": sampled_since,
            "sampled_until": sampled_until,
            "events_count": len(events),
            "writes_per_minute": writes_per_minute,
            "hot_event_types": hot_event_types,
            "hot_entities_count": len(unique_entities),
            "updated_at": datetime.now(UTC),
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
            visual_hint, intensity = self._derive_visual_hint(event_type=str(item.event_type or ""), payload=item.payload)
            serialized.append(
                {
                    "event_seq": int(item.event_seq),
                    "event_type": str(item.event_type or ""),
                    "entity_id": item.entity_id,
                    "timestamp": item.timestamp,
                    "visual_hint": visual_hint,
                    "intensity": intensity,
                    "payload": item.payload if isinstance(item.payload, dict) else {},
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
                        "planets_count": int(item.get("planets_count") or 0),
                        "moons_count": int(item.get("moons_count") or 0),
                        "internal_bonds_count": int(item.get("internal_bonds_count") or 0),
                        "external_bonds_count": int(item.get("external_bonds_count") or 0),
                        "guardian_rules_count": int(item.get("guardian_rules_count") or 0),
                        "alerted_moons_count": int(item.get("alerted_moons_count") or 0),
                        "circular_fields_count": int(item.get("circular_fields_count") or 0),
                        "quality_score": int(item.get("quality_score") or 100),
                        "status": str(item.get("status") or "GREEN"),
                        "events_count": 0,
                        "writes_per_minute": 0.0,
                        "hot_event_types": [],
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
        domain_event_types: dict[str, Counter[str]] = defaultdict(Counter)
        for event in events:
            domains = self._resolve_event_domains(
                entity_id=event.entity_id,
                payload=event.payload,
                table_to_domain=table_to_domain,
                asteroid_to_domain=asteroid_to_domain,
                bond_to_domains=bond_to_domains,
            )
            event_type = str(event.event_type or "")
            for domain in domains:
                domain_event_counts[domain] += 1
                if event_type:
                    domain_event_types[domain][event_type] += 1

        max_event_count = max(domain_event_counts.values(), default=0)
        writes_by_minute = self._compute_domain_writes_per_minute(events=events, domain_event_counts=domain_event_counts)

        baseline_by_domain: dict[str, dict[str, Any]] = {}
        for item in constellations:
            if not isinstance(item, dict):
                continue
            name = str(item.get("name") or "Uncategorized")
            baseline_by_domain[name] = {
                "domain_name": name,
                "planets_count": int(item.get("planets_count") or 0),
                "moons_count": int(item.get("moons_count") or 0),
                "internal_bonds_count": int(item.get("internal_bonds_count") or 0),
                "external_bonds_count": int(item.get("external_bonds_count") or 0),
                "guardian_rules_count": int(item.get("guardian_rules_count") or 0),
                "alerted_moons_count": int(item.get("alerted_moons_count") or 0),
                "circular_fields_count": int(item.get("circular_fields_count") or 0),
                "quality_score": int(item.get("quality_score") or 100),
                "status": str(item.get("status") or "GREEN"),
            }

        domains = sorted(set(baseline_by_domain.keys()) | set(domain_event_counts.keys()), key=lambda value: value.lower())
        rows: list[dict[str, Any]] = []
        for domain_name in domains:
            baseline = baseline_by_domain.get(
                domain_name,
                {
                    "domain_name": domain_name,
                    "planets_count": 0,
                    "moons_count": 0,
                    "internal_bonds_count": 0,
                    "external_bonds_count": 0,
                    "guardian_rules_count": 0,
                    "alerted_moons_count": 0,
                    "circular_fields_count": 0,
                    "quality_score": 100,
                    "status": "GREEN",
                },
            )
            event_count = int(domain_event_counts.get(domain_name, 0))
            event_type_counter = domain_event_types.get(domain_name, Counter())
            hot_event_types = [
                key
                for key, _count in sorted(event_type_counter.items(), key=lambda pair: (-pair[1], pair[0]))[:3]
            ]
            activity_intensity = round((event_count / max_event_count), 3) if max_event_count > 0 else 0.0
            rows.append(
                {
                    **baseline,
                    "events_count": event_count,
                    "writes_per_minute": float(writes_by_minute.get(domain_name, 0.0)),
                    "hot_event_types": hot_event_types,
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
    def _compute_domain_writes_per_minute(*, events: list[Any], domain_event_counts: dict[str, int]) -> dict[str, float]:
        if not events:
            return {name: 0.0 for name in domain_event_counts.keys()}
        first = events[0].timestamp
        last = events[-1].timestamp
        span_minutes = max(1.0, (last - first).total_seconds() / 60.0)
        return {name: round(count / span_minutes, 3) for name, count in domain_event_counts.items()}

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

        for key in ("asteroid_id", "source_id", "target_id", "source_asteroid_id", "target_asteroid_id"):
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
