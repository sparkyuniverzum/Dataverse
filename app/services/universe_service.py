from __future__ import annotations

import math
import re
from collections.abc import Mapping
from dataclasses import dataclass
from datetime import datetime
from typing import Any
from uuid import NAMESPACE_URL, UUID, uuid5

from fastapi import HTTPException, status
from sqlalchemy import and_, func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models import Atom, Bond, Branch, CalcStateRM, Event, Galaxy, PhysicsStateRM
from app.services.bond_semantics import bond_semantics, normalize_bond_type
from app.services.calc_service import evaluate_universe
from app.services.event_store_service import EventStoreService
from app.services.guardian_service import evaluate_guardians


DEFAULT_GALAXY_ID = UUID("00000000-0000-0000-0000-000000000001")
TABLE_PREFIX_RE = re.compile(r"^\s*([A-Za-zÀ-ž0-9 _-]{2,64})\s*:")


def normalize_table_name(name: str | None) -> str:
    text = str(name or "").strip()
    return text if text else "Uncategorized"


def derive_table_name(*, value: Any, metadata: Mapping[str, Any] | None) -> str:
    data = metadata if isinstance(metadata, Mapping) else {}

    for key in ("kategorie", "category", "typ", "type", "table", "table_name"):
        direct = data.get(key)
        if isinstance(direct, str) and direct.strip():
            return normalize_table_name(direct)

    if isinstance(value, str):
        match = TABLE_PREFIX_RE.match(value)
        if match:
            return normalize_table_name(match.group(1))

    return "Uncategorized"


def derive_table_id(*, galaxy_id: UUID, table_name: str) -> UUID:
    normalized = normalize_table_name(table_name).lower()
    return uuid5(NAMESPACE_URL, f"dataverse:{galaxy_id}:{normalized}")


def split_constellation_and_planet_name(table_name: str | None) -> tuple[str, str]:
    normalized = normalize_table_name(table_name)
    separators = (">", "/", "::", "|")
    for separator in separators:
        if separator not in normalized:
            continue
        parts = [part.strip() for part in normalized.split(separator) if part.strip()]
        if len(parts) >= 2:
            constellation = parts[0]
            planet = " / ".join(parts[1:])
            return constellation, planet
    return normalized, normalized


@dataclass
class ProjectedAsteroid:
    id: UUID
    value: Any
    metadata: dict[str, Any]
    is_deleted: bool
    created_at: datetime
    deleted_at: datetime | None
    current_event_seq: int = 0


@dataclass
class ProjectedBond:
    id: UUID
    source_id: UUID
    target_id: UUID
    type: str
    is_deleted: bool
    created_at: datetime
    deleted_at: datetime | None
    current_event_seq: int = 0


class ProjectionPayloadError(ValueError):
    def __init__(self, *, event: Event, reason: str) -> None:
        self.event = event
        self.reason = reason
        super().__init__(reason)


class UniverseService:
    def __init__(self, event_store: EventStoreService | None = None) -> None:
        self.event_store = event_store or EventStoreService()

    async def _ensure_galaxy_access(self, session: AsyncSession, *, user_id: UUID, galaxy_id: UUID) -> None:
        galaxy = (await session.execute(select(Galaxy).where(Galaxy.id == galaxy_id))).scalar_one_or_none()
        if galaxy is None or galaxy.deleted_at is not None:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Galaxy not found")
        if galaxy.owner_id != user_id:
            raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Forbidden galaxy access")

    def _apply_event(
        self,
        event: Event,
        asteroids_by_id: dict[UUID, ProjectedAsteroid],
        bonds_by_id: dict[UUID, ProjectedBond],
    ) -> None:
        payload = event.payload if isinstance(event.payload, dict) else {}

        if event.event_type == "ASTEROID_CREATED":
            metadata = payload.get("metadata", {})
            asteroids_by_id[event.entity_id] = ProjectedAsteroid(
                id=event.entity_id,
                value=payload.get("value"),
                metadata=metadata if isinstance(metadata, dict) else {},
                is_deleted=False,
                created_at=event.timestamp,
                deleted_at=None,
                current_event_seq=int(event.event_seq),
            )
            return

        if event.event_type == "METADATA_UPDATED":
            asteroid = asteroids_by_id.get(event.entity_id)
            if asteroid is None:
                return
            metadata_patch = payload.get("metadata", {})
            if isinstance(metadata_patch, dict):
                asteroid.metadata = {**asteroid.metadata, **metadata_patch}
            asteroid.current_event_seq = int(event.event_seq)
            return

        if event.event_type == "ASTEROID_VALUE_UPDATED":
            asteroid = asteroids_by_id.get(event.entity_id)
            if asteroid is None:
                return
            asteroid.value = payload.get("value")
            asteroid.current_event_seq = int(event.event_seq)
            return

        if event.event_type == "ASTEROID_SOFT_DELETED":
            asteroid = asteroids_by_id.get(event.entity_id)
            if asteroid is None:
                return
            asteroid.is_deleted = True
            asteroid.deleted_at = event.timestamp
            asteroid.current_event_seq = int(event.event_seq)
            return

        if event.event_type == "BOND_FORMED":
            try:
                source_id = UUID(str(payload["source_id"]))
                target_id = UUID(str(payload["target_id"]))
            except (KeyError, TypeError, ValueError) as exc:
                raise ProjectionPayloadError(
                    event=event,
                    reason="BOND_FORMED payload must include valid source_id and target_id UUIDs",
                ) from exc
            bonds_by_id[event.entity_id] = ProjectedBond(
                id=event.entity_id,
                source_id=source_id,
                target_id=target_id,
                type=normalize_bond_type(payload.get("type", "RELATION")),
                is_deleted=False,
                created_at=event.timestamp,
                deleted_at=None,
                current_event_seq=int(event.event_seq),
            )
            return

        if event.event_type == "BOND_SOFT_DELETED":
            bond = bonds_by_id.get(event.entity_id)
            if bond is None:
                return
            bond.is_deleted = True
            bond.deleted_at = event.timestamp
            bond.current_event_seq = int(event.event_seq)

    async def _entity_event_seq_map(
        self,
        session: AsyncSession,
        *,
        user_id: UUID,
        galaxy_id: UUID,
        branch_id: UUID | None,
        entity_ids: list[UUID],
    ) -> dict[UUID, int]:
        if not entity_ids:
            return {}
        stmt = (
            select(Event.entity_id, func.max(Event.event_seq))
            .where(
                and_(
                    Event.user_id == user_id,
                    Event.galaxy_id == galaxy_id,
                    Event.entity_id.in_(entity_ids),
                )
            )
            .group_by(Event.entity_id)
        )
        if branch_id is None:
            stmt = stmt.where(Event.branch_id.is_(None))
        else:
            stmt = stmt.where(Event.branch_id == branch_id)
        rows = (await session.execute(stmt)).all()
        return {entity_id: int(max_seq or 0) for entity_id, max_seq in rows}

    @staticmethod
    def _sector_center(index: int, total: int, spacing: int = 500) -> tuple[float, float, float]:
        cols = max(1, math.ceil(math.sqrt(max(total, 1))))
        rows = max(1, math.ceil(total / cols))
        col = index % cols
        row = index // cols
        offset_x = ((cols - 1) * spacing) / 2
        offset_z = ((rows - 1) * spacing) / 2
        return (col * spacing - offset_x, 0.0, row * spacing - offset_z)

    async def _project_state_from_read_model(
        self,
        session: AsyncSession,
        *,
        user_id: UUID,
        galaxy_id: UUID,
    ) -> tuple[list[ProjectedAsteroid], list[ProjectedBond]]:
        asteroid_rows = list(
            (
                await session.execute(
                    select(Atom)
                    .where(
                        and_(
                            Atom.user_id == user_id,
                            Atom.galaxy_id == galaxy_id,
                            Atom.is_deleted.is_(False),
                        )
                    )
                    .order_by(Atom.created_at.asc(), Atom.id.asc())
                )
            )
            .scalars()
            .all()
        )
        active_asteroids = [
            ProjectedAsteroid(
                id=asteroid.id,
                value=asteroid.value,
                metadata=asteroid.metadata_ if isinstance(asteroid.metadata_, dict) else {},
                is_deleted=asteroid.is_deleted,
                created_at=asteroid.created_at,
                deleted_at=asteroid.deleted_at,
            )
            for asteroid in asteroid_rows
        ]
        active_ids = {asteroid.id for asteroid in active_asteroids}
        asteroid_seq_map = await self._entity_event_seq_map(
            session=session,
            user_id=user_id,
            galaxy_id=galaxy_id,
            branch_id=None,
            entity_ids=[item.id for item in active_asteroids],
        )
        for asteroid in active_asteroids:
            asteroid.current_event_seq = asteroid_seq_map.get(asteroid.id, 0)

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
                source_id=bond.source_id,
                target_id=bond.target_id,
                type=normalize_bond_type(bond.type),
                is_deleted=bond.is_deleted,
                created_at=bond.created_at,
                deleted_at=bond.deleted_at,
            )
            for bond in bond_rows
            if bond.source_id in active_ids and bond.target_id in active_ids
        ]
        bond_seq_map = await self._entity_event_seq_map(
            session=session,
            user_id=user_id,
            galaxy_id=galaxy_id,
            branch_id=None,
            entity_ids=[item.id for item in active_bonds],
        )
        for bond in active_bonds:
            bond.current_event_seq = bond_seq_map.get(bond.id, 0)
        return active_asteroids, active_bonds

    async def _load_calc_state_by_asteroid_id(
        self,
        session: AsyncSession,
        *,
        user_id: UUID,
        galaxy_id: UUID,
        asteroid_ids: set[UUID],
    ) -> dict[UUID, dict[str, Any]]:
        if not asteroid_ids:
            return {}
        rows = list(
            (
                await session.execute(
                    select(CalcStateRM).where(
                        and_(
                            CalcStateRM.user_id == user_id,
                            CalcStateRM.galaxy_id == galaxy_id,
                            CalcStateRM.deleted_at.is_(None),
                            CalcStateRM.asteroid_id.in_(asteroid_ids),
                        )
                    )
                )
            )
            .scalars()
            .all()
        )
        return {
            row.asteroid_id: {
                "calculated_values": row.calculated_values if isinstance(row.calculated_values, dict) else {},
                "calc_errors": row.calc_errors if isinstance(row.calc_errors, list) else [],
                "error_count": int(row.error_count or 0),
                "circular_fields_count": int(row.circular_fields_count or 0),
                "source_event_seq": int(row.source_event_seq or 0),
                "engine_version": str(row.engine_version or ""),
            }
            for row in rows
            if isinstance(row.asteroid_id, UUID)
        }

    async def _load_physics_state_by_asteroid_id(
        self,
        session: AsyncSession,
        *,
        user_id: UUID,
        galaxy_id: UUID,
        asteroid_ids: set[UUID],
    ) -> dict[UUID, dict[str, Any]]:
        if not asteroid_ids:
            return {}
        rows = list(
            (
                await session.execute(
                    select(PhysicsStateRM).where(
                        and_(
                            PhysicsStateRM.user_id == user_id,
                            PhysicsStateRM.galaxy_id == galaxy_id,
                            PhysicsStateRM.entity_kind == "asteroid",
                            PhysicsStateRM.deleted_at.is_(None),
                            PhysicsStateRM.entity_id.in_(asteroid_ids),
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

    async def _enrich_main_timeline_from_read_models(
        self,
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
            for asteroid in active_asteroids
            for value in (asteroid.metadata if isinstance(asteroid.metadata, dict) else {}).values()
        )
        has_non_flow_bonds = any(normalize_bond_type(bond.type) != "FLOW" for bond in active_bonds)
        # Keep legacy V1 semantics for relation-driven formulas until calc read model reaches parity.
        if has_formula_metadata and has_non_flow_bonds:
            return None

        asteroid_ids = {asteroid.id for asteroid in active_asteroids}
        calc_by_id = await self._load_calc_state_by_asteroid_id(
            session,
            user_id=user_id,
            galaxy_id=galaxy_id,
            asteroid_ids=asteroid_ids,
        )
        # Require full calc coverage to avoid mixed semantics in one snapshot.
        if len(calc_by_id) < len(asteroid_ids):
            return None
        physics_by_id = await self._load_physics_state_by_asteroid_id(
            session,
            user_id=user_id,
            galaxy_id=galaxy_id,
            asteroid_ids=asteroid_ids,
        )

        enriched: list[dict[str, Any]] = []
        for asteroid in active_asteroids:
            calc_state = calc_by_id.get(asteroid.id)
            if calc_state is None:
                return None
            calculated_values = calc_state.get("calculated_values", {})
            if not isinstance(calculated_values, dict):
                calculated_values = {}
            raw_metadata = asteroid.metadata if isinstance(asteroid.metadata, dict) else {}
            # Keep V1 snapshot behavior: metadata fields are projected to resolved values.
            projected_metadata = dict(raw_metadata)
            for key, value in calculated_values.items():
                if key in projected_metadata:
                    projected_metadata[key] = value
            table_name = derive_table_name(value=asteroid.value, metadata=projected_metadata)
            constellation_name, planet_name = split_constellation_and_planet_name(table_name)
            enriched.append(
                {
                    "id": asteroid.id,
                    "value": asteroid.value,
                    "metadata": projected_metadata,
                    "calculated_values": dict(calculated_values),
                    "calc_errors": calc_state.get("calc_errors", []),
                    "table_name": table_name,
                    "table_id": derive_table_id(galaxy_id=galaxy_id, table_name=table_name),
                    "constellation_name": constellation_name,
                    "planet_name": planet_name,
                    "physics": physics_by_id.get(asteroid.id, {}),
                    "created_at": asteroid.created_at,
                    "current_event_seq": int(getattr(asteroid, "current_event_seq", 0) or 0),
                }
            )

        return evaluate_guardians(enriched)

    async def _project_state_from_events(
        self,
        session: AsyncSession,
        *,
        user_id: UUID,
        galaxy_id: UUID,
        branch_id: UUID | None,
        as_of: datetime | None,
    ) -> tuple[list[ProjectedAsteroid], list[ProjectedBond]]:
        events = await self.event_store.list_events(
            session=session,
            user_id=user_id,
            galaxy_id=galaxy_id,
            branch_id=branch_id,
            as_of=as_of,
        )

        asteroids_by_id: dict[UUID, ProjectedAsteroid] = {}
        bonds_by_id: dict[UUID, ProjectedBond] = {}
        for event in events:
            try:
                self._apply_event(event, asteroids_by_id, bonds_by_id)
            except ProjectionPayloadError as exc:
                raise HTTPException(
                    status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                    detail={
                        "code": "UNIVERSE_EVENT_PAYLOAD_INVALID",
                        "message": "Failed to project universe state due to malformed event payload",
                        "event_id": str(exc.event.id),
                        "event_type": exc.event.event_type,
                        "reason": exc.reason,
                    },
                ) from exc

        active_asteroids = [a for a in asteroids_by_id.values() if not a.is_deleted]
        active_asteroids.sort(key=lambda item: (item.created_at, str(item.id)))
        active_ids = {item.id for item in active_asteroids}

        active_bonds = [
            bond
            for bond in bonds_by_id.values()
            if not bond.is_deleted and bond.source_id in active_ids and bond.target_id in active_ids
        ]
        active_bonds.sort(key=lambda item: (item.created_at, str(item.id)))
        return active_asteroids, active_bonds

    async def _project_state_from_branch(
        self,
        session: AsyncSession,
        *,
        user_id: UUID,
        galaxy_id: UUID,
        branch_id: UUID,
        as_of: datetime | None,
    ) -> tuple[list[ProjectedAsteroid], list[ProjectedBond]]:
        branch = (await session.execute(select(Branch).where(Branch.id == branch_id))).scalar_one_or_none()
        if branch is None or branch.deleted_at is not None:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Branch not found")
        if branch.galaxy_id != galaxy_id:
            raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Forbidden branch access")

        main_events: list[Event] = []
        if branch.base_event_id is not None:
            base_event = (
                await session.execute(
                    select(Event).where(
                        Event.id == branch.base_event_id,
                        Event.user_id == user_id,
                        Event.galaxy_id == galaxy_id,
                        Event.branch_id.is_(None),
                    )
                )
            ).scalar_one_or_none()
            if base_event is not None:
                main_cutoff_time = base_event.timestamp
                if as_of is not None:
                    main_cutoff_time = min(main_cutoff_time, as_of)
                main_events = await self.event_store.list_events(
                    session=session,
                    user_id=user_id,
                    galaxy_id=galaxy_id,
                    branch_id=None,
                    as_of=main_cutoff_time,
                    up_to_event_seq=base_event.event_seq,
                )

        branch_events = await self.event_store.list_events(
            session=session,
            user_id=user_id,
            galaxy_id=galaxy_id,
            branch_id=branch.id,
            as_of=as_of,
        )

        asteroids_by_id: dict[UUID, ProjectedAsteroid] = {}
        bonds_by_id: dict[UUID, ProjectedBond] = {}
        for event in [*main_events, *branch_events]:
            try:
                self._apply_event(event, asteroids_by_id, bonds_by_id)
            except ProjectionPayloadError as exc:
                raise HTTPException(
                    status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                    detail={
                        "code": "UNIVERSE_EVENT_PAYLOAD_INVALID",
                        "message": "Failed to project universe state due to malformed event payload",
                        "event_id": str(exc.event.id),
                        "event_type": exc.event.event_type,
                        "reason": exc.reason,
                    },
                ) from exc

        active_asteroids = [a for a in asteroids_by_id.values() if not a.is_deleted]
        active_asteroids.sort(key=lambda item: (item.created_at, str(item.id)))
        active_ids = {item.id for item in active_asteroids}

        active_bonds = [
            bond
            for bond in bonds_by_id.values()
            if not bond.is_deleted and bond.source_id in active_ids and bond.target_id in active_ids
        ]
        active_bonds.sort(key=lambda item: (item.created_at, str(item.id)))
        return active_asteroids, active_bonds

    async def project_state(
        self,
        session: AsyncSession,
        *,
        user_id: UUID,
        galaxy_id: UUID = DEFAULT_GALAXY_ID,
        branch_id: UUID | None = None,
        as_of: datetime | None = None,
        apply_calculations: bool = True,
    ) -> tuple[list[ProjectedAsteroid | dict[str, Any]], list[ProjectedBond]]:
        await self._ensure_galaxy_access(session, user_id=user_id, galaxy_id=galaxy_id)
        projection_source = "events"
        if branch_id is not None:
            active_asteroids, active_bonds = await self._project_state_from_branch(
                session=session,
                user_id=user_id,
                galaxy_id=galaxy_id,
                branch_id=branch_id,
                as_of=as_of,
            )
            projection_source = "branch"
        elif as_of is None:
            active_asteroids, active_bonds = await self._project_state_from_read_model(
                session=session,
                user_id=user_id,
                galaxy_id=galaxy_id,
            )
            projection_source = "read_model"
            # Fallback for galaxies not yet backfilled into read model.
            if not active_asteroids and not active_bonds:
                active_asteroids, active_bonds = await self._project_state_from_events(
                    session=session,
                    user_id=user_id,
                    galaxy_id=galaxy_id,
                    branch_id=None,
                    as_of=as_of,
                )
                projection_source = "events"
        else:
            active_asteroids, active_bonds = await self._project_state_from_events(
                session=session,
                user_id=user_id,
                galaxy_id=galaxy_id,
                branch_id=None,
                as_of=as_of,
            )
            projection_source = "events"

        if not apply_calculations:
            return active_asteroids, active_bonds

        if projection_source == "read_model":
            main_enriched = await self._enrich_main_timeline_from_read_models(
                session,
                user_id=user_id,
                galaxy_id=galaxy_id,
                active_asteroids=active_asteroids,
                active_bonds=active_bonds,
            )
            if main_enriched is not None:
                return main_enriched, active_bonds

        evaluated = evaluate_universe(
            [
                {
                    "id": asteroid.id,
                    "value": asteroid.value,
                    "metadata": asteroid.metadata,
                    "created_at": asteroid.created_at,
                    "current_event_seq": int(getattr(asteroid, "current_event_seq", 0) or 0),
                }
                for asteroid in active_asteroids
            ],
            active_bonds,
        )
        seq_index = {asteroid.id: int(getattr(asteroid, "current_event_seq", 0) or 0) for asteroid in active_asteroids}
        enriched: list[dict[str, Any]] = []
        for asteroid in evaluated:
            metadata = asteroid.get("metadata", {})
            if not isinstance(metadata, dict):
                metadata = {}
            table_name = derive_table_name(value=asteroid.get("value"), metadata=metadata)
            enriched.append(
                {
                    **asteroid,
                    "metadata": metadata,
                    "table_name": table_name,
                    "table_id": derive_table_id(galaxy_id=galaxy_id, table_name=table_name),
                    "current_event_seq": seq_index.get(asteroid.get("id"), 0),
                }
            )

        guarded = evaluate_guardians(enriched)
        return guarded, active_bonds

    async def snapshot(
        self,
        session: AsyncSession,
        *,
        user_id: UUID,
        galaxy_id: UUID = DEFAULT_GALAXY_ID,
        branch_id: UUID | None = None,
        as_of: datetime | None = None,
    ) -> tuple[list[ProjectedAsteroid | dict[str, Any]], list[ProjectedBond]]:
        return await self.project_state(
            session=session,
            user_id=user_id,
            galaxy_id=galaxy_id,
            branch_id=branch_id,
            as_of=as_of,
            apply_calculations=True,
        )

    async def tables_snapshot(
        self,
        session: AsyncSession,
        *,
        user_id: UUID,
        galaxy_id: UUID = DEFAULT_GALAXY_ID,
        branch_id: UUID | None = None,
        as_of: datetime | None = None,
    ) -> list[dict[str, Any]]:
        asteroids, bonds = await self.snapshot(
            session=session,
            user_id=user_id,
            galaxy_id=galaxy_id,
            branch_id=branch_id,
            as_of=as_of,
        )

        asteroid_rows: list[dict[str, Any]] = []
        for asteroid in asteroids:
            if isinstance(asteroid, Mapping):
                asteroid_id = asteroid.get("id")
                if not isinstance(asteroid_id, UUID):
                    continue
                metadata = asteroid.get("metadata", {})
                metadata_dict = metadata if isinstance(metadata, dict) else {}
                table_name_raw = asteroid.get("table_name")
                table_name = (
                    normalize_table_name(table_name_raw)
                    if isinstance(table_name_raw, str)
                    else derive_table_name(value=asteroid.get("value"), metadata=metadata_dict)
                )
                table_id = asteroid.get("table_id")
                table_uuid = table_id if isinstance(table_id, UUID) else derive_table_id(galaxy_id=galaxy_id, table_name=table_name)
                asteroid_rows.append(
                    {
                        "id": asteroid_id,
                        "value": asteroid.get("value"),
                        "metadata": metadata_dict,
                        "created_at": asteroid.get("created_at"),
                        "table_name": table_name,
                        "table_id": table_uuid,
                    }
                )
            elif isinstance(asteroid, ProjectedAsteroid):
                table_name = derive_table_name(value=asteroid.value, metadata=asteroid.metadata)
                asteroid_rows.append(
                    {
                        "id": asteroid.id,
                        "value": asteroid.value,
                        "metadata": asteroid.metadata,
                        "created_at": asteroid.created_at,
                        "table_name": table_name,
                        "table_id": derive_table_id(galaxy_id=galaxy_id, table_name=table_name),
                    }
                )

        def _created_sort(row: dict[str, Any]) -> tuple[int, float, str]:
            created_at = row.get("created_at")
            if isinstance(created_at, datetime):
                return (0, created_at.timestamp(), str(row["id"]))
            return (1, 0.0, str(row["id"]))

        asteroid_rows.sort(key=_created_sort)
        asteroid_by_id: dict[UUID, dict[str, Any]] = {item["id"]: item for item in asteroid_rows}

        table_buckets: dict[UUID, dict[str, Any]] = {}
        for row in asteroid_rows:
            table_id = row["table_id"]
            table_name = row["table_name"]
            bucket = table_buckets.setdefault(
                table_id,
                {
                    "table_id": table_id,
                    "galaxy_id": galaxy_id,
                    "name": table_name,
                    "schema_fields": set(),
                    "formula_fields": set(),
                    "members": [],
                    "internal_bonds": [],
                    "external_bonds": [],
                },
            )
            metadata = row.get("metadata", {})
            if isinstance(metadata, dict):
                for key, value in metadata.items():
                    if not key.startswith("_"):
                        bucket["schema_fields"].add(key)
                    if isinstance(value, str) and value.strip().startswith("="):
                        bucket["formula_fields"].add(key)

            bucket["members"].append(
                {
                    "id": row["id"],
                    "value": row.get("value"),
                    "created_at": row.get("created_at"),
                }
            )

        for bond in bonds:
            source = asteroid_by_id.get(bond.source_id)
            target = asteroid_by_id.get(bond.target_id)
            if source is None or target is None:
                continue

            source_table = table_buckets.get(source["table_id"])
            target_table = table_buckets.get(target["table_id"])
            if source_table is None or target_table is None:
                continue

            bond_payload = {
                "id": bond.id,
                "source_id": bond.source_id,
                "target_id": bond.target_id,
                "type": normalize_bond_type(bond.type),
            }
            semantics = bond_semantics(bond.type)
            bond_payload["directional"] = semantics.directional
            bond_payload["flow_direction"] = semantics.flow_direction
            if source["table_id"] == target["table_id"]:
                source_table["internal_bonds"].append(bond_payload)
            else:
                source_table["external_bonds"].append(
                    {
                        **bond_payload,
                        "peer_table_id": target["table_id"],
                        "peer_table_name": target["table_name"],
                    }
                )
                target_table["external_bonds"].append(
                    {
                        **bond_payload,
                        "peer_table_id": source["table_id"],
                        "peer_table_name": source["table_name"],
                    }
                )

        ordered_tables = sorted(
            table_buckets.values(),
            key=lambda item: (item["name"].lower(), str(item["table_id"])),
        )
        total = len(ordered_tables)
        table_rows: list[dict[str, Any]] = []
        for index, table in enumerate(ordered_tables):
            members = sorted(table["members"], key=_created_sort)
            schema_fields = sorted(table["schema_fields"])
            formula_fields = sorted(table["formula_fields"])
            mode = "ring" if (len(members) > 5 or len(schema_fields) > 3) else "belt"
            center = self._sector_center(index, total)
            size = max(260.0, min(460.0, 260.0 + math.sqrt(max(len(members), 1)) * 48.0 + (80.0 if mode == "ring" else 20.0)))
            constellation_name, planet_name = split_constellation_and_planet_name(table["name"])

            table_rows.append(
                {
                    "table_id": table["table_id"],
                    "galaxy_id": table["galaxy_id"],
                    "name": table["name"],
                    "constellation_name": constellation_name,
                    "planet_name": planet_name,
                    "schema_fields": schema_fields,
                    "formula_fields": formula_fields,
                    "members": members,
                    "internal_bonds": sorted(table["internal_bonds"], key=lambda item: str(item["id"])),
                    "external_bonds": sorted(table["external_bonds"], key=lambda item: (str(item["peer_table_id"]), str(item["id"]))),
                    "sector": {
                        "center": [center[0], center[1], center[2]],
                        "size": size,
                        "mode": mode,
                        "grid_plate": True,
                    },
                }
            )

        return table_rows
