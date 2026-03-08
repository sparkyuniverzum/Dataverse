from __future__ import annotations

import re
from datetime import UTC, datetime
from typing import Any
from uuid import UUID

from pydantic import BaseModel, Field, ValidationError
from sqlalchemy import and_, func, select, update
from sqlalchemy.dialects.postgresql import insert
from sqlalchemy.ext.asyncio import AsyncSession

from app.models import Bond, CivilizationRM, Event, GalaxyActivityRM, GalaxyHealthRM, GalaxySummaryRM
from app.services.calc_engine_service import CalcEngineService
from app.services.guardian_service import evaluate_guardians
from app.services.physics_engine_service import PhysicsEngineService


class AsteroidCreatedPayload(BaseModel):
    value: Any
    metadata: dict[str, Any] = Field(default_factory=dict)


class MetadataUpdatedPayload(BaseModel):
    metadata: dict[str, Any] = Field(default_factory=dict)
    metadata_remove: list[str] = Field(default_factory=list)


class AsteroidValueUpdatedPayload(BaseModel):
    value: Any


class BondFormedPayload(BaseModel):
    source_civilization_id: UUID
    target_civilization_id: UUID
    type: str = "RELATION"


TABLE_PREFIX_RE = re.compile(r"^\s*([A-Za-zÀ-ž0-9 _-]{2,64})\s*:")


class ReadModelProjector:
    """Projects immutable events into mutable read-model tables.

    Concurrency:
    - UPSERT (`INSERT ... ON CONFLICT`) is used for create/form events so replays are idempotent.
    - `SELECT ... FOR UPDATE` is used for metadata patches to serialize concurrent updates on one civilization row
    and avoid lost updates while still keeping one DB transaction boundary.
    """

    def __init__(
        self,
        *,
        calc_engine: CalcEngineService | None = None,
        physics_engine: PhysicsEngineService | None = None,
    ) -> None:
        self.calc_engine = calc_engine or CalcEngineService()
        self.physics_engine = physics_engine or PhysicsEngineService()

    async def apply_events(self, session: AsyncSession, events: list[Event]) -> None:
        affected_pairs: dict[tuple[UUID, UUID], dict[str, Any]] = {}
        for event in events:
            touched = await self._apply_event_without_rollups(session=session, event=event)
            if touched is not None:
                event_seq = int(getattr(event, "event_seq", 0) or 0)
                state = affected_pairs.setdefault(touched, {"source_event_seq": 0, "needs_rollups": False})
                state["source_event_seq"] = max(int(state["source_event_seq"]), event_seq)
                if not await self._can_skip_rollups_for_event(session=session, event=event):
                    state["needs_rollups"] = True

        for (user_id, galaxy_id), state in affected_pairs.items():
            if not bool(state.get("needs_rollups")):
                continue
            await self._refresh_galaxy_rollups(
                session=session,
                user_id=user_id,
                galaxy_id=galaxy_id,
                source_event_seq=int(state.get("source_event_seq") or 0),
            )

    async def apply_event(self, session: AsyncSession, event: Event) -> None:
        touched = await self._apply_event_without_rollups(session=session, event=event)
        if touched is not None:
            if await self._can_skip_rollups_for_event(session=session, event=event):
                return
            await self._refresh_galaxy_rollups(
                session=session,
                user_id=touched[0],
                galaxy_id=touched[1],
                source_event_seq=int(getattr(event, "event_seq", 0) or 0),
            )

    async def refresh_galaxy(self, session: AsyncSession, *, user_id: UUID, galaxy_id: UUID) -> None:
        await self._refresh_galaxy_rollups(
            session=session,
            user_id=user_id,
            galaxy_id=galaxy_id,
            source_event_seq=None,
        )

    async def _apply_event_without_rollups(
        self,
        *,
        session: AsyncSession,
        event: Event,
    ) -> tuple[UUID, UUID] | None:
        if event.branch_id is not None:
            # Branches are replayed on-read and do not mutate shared read-model projections.
            return None

        event_type = event.event_type.upper()
        payload = event.payload if isinstance(event.payload, dict) else {}
        projected = False

        if event_type == "ASTEROID_CREATED":
            try:
                created_payload = AsteroidCreatedPayload.model_validate(payload)
            except ValidationError:
                created_payload = AsteroidCreatedPayload(value=payload.get("value"), metadata={})
            await self._project_asteroid_created(
                session=session,
                user_id=event.user_id,
                galaxy_id=event.galaxy_id,
                civilization_id=event.entity_id,
                payload=created_payload,
                happened_at=event.timestamp,
            )
            projected = True

        elif event_type == "METADATA_UPDATED":
            try:
                metadata_payload = MetadataUpdatedPayload.model_validate(payload)
            except ValidationError:
                metadata_payload = MetadataUpdatedPayload(metadata={})
            await self._project_metadata_updated(
                session=session,
                user_id=event.user_id,
                galaxy_id=event.galaxy_id,
                civilization_id=event.entity_id,
                payload=metadata_payload,
            )
            projected = True

        elif event_type == "ASTEROID_VALUE_UPDATED":
            try:
                value_payload = AsteroidValueUpdatedPayload.model_validate(payload)
            except ValidationError:
                value_payload = None
            if value_payload is not None:
                await self._project_asteroid_value_updated(
                    session=session,
                    user_id=event.user_id,
                    galaxy_id=event.galaxy_id,
                    civilization_id=event.entity_id,
                    payload=value_payload,
                )
                projected = True

        elif event_type == "ASTEROID_SOFT_DELETED":
            await self._project_asteroid_soft_deleted(
                session=session,
                user_id=event.user_id,
                galaxy_id=event.galaxy_id,
                civilization_id=event.entity_id,
                happened_at=event.timestamp,
            )
            projected = True

        elif event_type == "BOND_FORMED":
            try:
                bond_payload = BondFormedPayload.model_validate(payload)
            except ValidationError:
                bond_payload = None
            if bond_payload is not None:
                await self._project_bond_formed(
                    session=session,
                    user_id=event.user_id,
                    galaxy_id=event.galaxy_id,
                    bond_id=event.entity_id,
                    payload=bond_payload,
                    happened_at=event.timestamp,
                )
                projected = True

        elif event_type == "BOND_SOFT_DELETED":
            await self._project_bond_soft_deleted(
                session=session,
                user_id=event.user_id,
                galaxy_id=event.galaxy_id,
                bond_id=event.entity_id,
                happened_at=event.timestamp,
            )
            projected = True

        await self._project_activity(
            session=session,
            user_id=event.user_id,
            galaxy_id=event.galaxy_id,
            event=event,
        )

        if projected:
            return (event.user_id, event.galaxy_id)
        return None

    @staticmethod
    def _normalize_table_name(name: str | None) -> str:
        text = str(name or "").strip()
        return text if text else "Uncategorized"

    @classmethod
    def _derive_table_name(cls, *, value: Any, metadata: dict[str, Any] | None) -> str:
        data = metadata if isinstance(metadata, dict) else {}
        for key in ("table", "table_name", "category", "kategorie", "type", "typ"):
            candidate = data.get(key)
            if isinstance(candidate, str) and candidate.strip():
                return cls._normalize_table_name(candidate)

        if isinstance(value, str):
            match = TABLE_PREFIX_RE.match(value)
            if match:
                return cls._normalize_table_name(match.group(1))
        return "Uncategorized"

    @classmethod
    def _split_constellation_and_planet_name(cls, table_name: str | None) -> tuple[str, str]:
        normalized = cls._normalize_table_name(table_name)
        for separator in (">", "/", "::", "|"):
            if separator not in normalized:
                continue
            parts = [part.strip() for part in normalized.split(separator) if part.strip()]
            if len(parts) >= 2:
                return parts[0], " / ".join(parts[1:])
        return normalized, normalized

    async def _project_activity(
        self,
        *,
        session: AsyncSession,
        user_id: UUID,
        galaxy_id: UUID,
        event: Event,
    ) -> None:
        stmt = insert(GalaxyActivityRM).values(
            user_id=user_id,
            galaxy_id=galaxy_id,
            event_id=event.id,
            event_seq=event.event_seq,
            event_type=event.event_type,
            entity_id=event.entity_id,
            payload=event.payload if isinstance(event.payload, dict) else {},
            happened_at=event.timestamp,
        )
        stmt = stmt.on_conflict_do_nothing(index_elements=[GalaxyActivityRM.event_id])
        await session.execute(stmt)

    @staticmethod
    def _metadata_update_may_skip_rollups(
        *,
        metadata_patch: dict[str, Any],
        metadata_remove: list[str] | None = None,
        bonds_count: int,
        formula_fields_count: int,
        guardian_rules_count: int,
    ) -> bool:
        metadata_remove = metadata_remove or []
        if not metadata_patch and not metadata_remove:
            return True
        if bonds_count > 0 or formula_fields_count > 0 or guardian_rules_count > 0:
            return False

        structural_keys = {"table", "table_name", "category", "kategorie", "type", "typ", "_guardians"}
        for key, value in metadata_patch.items():
            normalized_key = str(key).strip().lower()
            if normalized_key in structural_keys:
                return False
            if isinstance(value, str) and value.strip().startswith("="):
                return False
        for key in metadata_remove:
            normalized_key = str(key).strip().lower()
            if normalized_key in structural_keys:
                return False
        return True

    async def _can_skip_rollups_for_event(self, *, session: AsyncSession, event: Event) -> bool:
        if event.branch_id is not None:
            return True

        event_type = str(event.event_type or "").upper()
        if event_type != "METADATA_UPDATED":
            return False

        payload = event.payload if isinstance(event.payload, dict) else {}
        metadata_patch = payload.get("metadata")
        if not isinstance(metadata_patch, dict):
            metadata_patch = {}
        metadata_remove_raw = payload.get("metadata_remove")
        metadata_remove: list[str] = []
        if isinstance(metadata_remove_raw, list):
            for item in metadata_remove_raw:
                key = str(item or "").strip()
                if key:
                    metadata_remove.append(key)

        summary = (
            await session.execute(
                select(GalaxySummaryRM).where(
                    and_(
                        GalaxySummaryRM.user_id == event.user_id,
                        GalaxySummaryRM.galaxy_id == event.galaxy_id,
                    )
                )
            )
        ).scalar_one_or_none()
        health = (
            await session.execute(
                select(GalaxyHealthRM).where(
                    and_(
                        GalaxyHealthRM.user_id == event.user_id,
                        GalaxyHealthRM.galaxy_id == event.galaxy_id,
                    )
                )
            )
        ).scalar_one_or_none()
        if summary is None or health is None:
            return False

        return self._metadata_update_may_skip_rollups(
            metadata_patch=metadata_patch,
            metadata_remove=metadata_remove,
            bonds_count=int(summary.bonds_count or 0),
            formula_fields_count=int(summary.formula_fields_count or 0),
            guardian_rules_count=int(health.guardian_rules_count or 0),
        )

    async def _refresh_galaxy_rollups(
        self,
        *,
        session: AsyncSession,
        user_id: UUID,
        galaxy_id: UUID,
        source_event_seq: int | None,
    ) -> None:
        atoms = list(
            (
                await session.execute(
                    select(CivilizationRM).where(
                        and_(
                            CivilizationRM.user_id == user_id,
                            CivilizationRM.galaxy_id == galaxy_id,
                            CivilizationRM.is_deleted.is_(False),
                        )
                    )
                )
            )
            .scalars()
            .all()
        )
        active_ids = {atom.id for atom in atoms}
        bonds = list(
            (
                await session.execute(
                    select(Bond).where(
                        and_(
                            Bond.user_id == user_id,
                            Bond.galaxy_id == galaxy_id,
                            Bond.is_deleted.is_(False),
                        )
                    )
                )
            )
            .scalars()
            .all()
        )
        active_bonds = [
            bond
            for bond in bonds
            if bond.source_civilization_id in active_ids and bond.target_civilization_id in active_ids
        ]

        table_names = [
            self._derive_table_name(
                value=atom.value, metadata=(atom.metadata_ if isinstance(atom.metadata_, dict) else {})
            )
            for atom in atoms
        ]
        planets_count = len(set(table_names))
        constellations_count = len({self._split_constellation_and_planet_name(name)[0] for name in table_names})

        formula_fields_count = 0
        guardian_rules_count = 0
        for atom in atoms:
            metadata = atom.metadata_ if isinstance(atom.metadata_, dict) else {}
            formula_fields_count += sum(
                1 for value in metadata.values() if isinstance(value, str) and value.strip().startswith("=")
            )
            guardians = metadata.get("_guardians")
            if isinstance(guardians, list):
                guardian_rules_count += len([rule for rule in guardians if isinstance(rule, dict)])

        if source_event_seq is None:
            source_event_seq = int(
                (
                    await session.execute(
                        select(func.max(Event.event_seq)).where(
                            and_(
                                Event.user_id == user_id,
                                Event.galaxy_id == galaxy_id,
                                Event.branch_id.is_(None),
                            )
                        )
                    )
                ).scalar_one_or_none()
                or 0
            )
        evaluated = await self.calc_engine.evaluate_and_project(
            session=session,
            user_id=user_id,
            galaxy_id=galaxy_id,
            source_event_seq=source_event_seq,
            atoms=atoms,
            bonds=active_bonds,
        )
        guarded = evaluate_guardians(evaluated)

        circular_fields_count = 0
        alerted_civilizations_count = 0
        for civilization in guarded:
            calculated = civilization.get("calculated_values", {})
            if isinstance(calculated, dict):
                circular_fields_count += sum(1 for value in calculated.values() if value == "#CIRC!")
            alerts = civilization.get("active_alerts", [])
            if isinstance(alerts, list) and alerts:
                alerted_civilizations_count += 1

        quality_penalty = circular_fields_count * 15 + alerted_civilizations_count * 8
        quality_score = max(0, 100 - quality_penalty)
        status = "GREEN"
        if quality_score < 60:
            status = "RED"
        elif quality_score < 85:
            status = "YELLOW"

        now = datetime.now(UTC)

        summary_stmt = insert(GalaxySummaryRM).values(
            user_id=user_id,
            galaxy_id=galaxy_id,
            constellations_count=constellations_count,
            planets_count=planets_count,
            moons_count=len(atoms),
            bonds_count=len(active_bonds),
            formula_fields_count=formula_fields_count,
            updated_at=now,
        )
        summary_stmt = summary_stmt.on_conflict_do_update(
            index_elements=[GalaxySummaryRM.user_id, GalaxySummaryRM.galaxy_id],
            set_={
                "constellations_count": constellations_count,
                "planets_count": planets_count,
                "moons_count": len(atoms),
                "bonds_count": len(active_bonds),
                "formula_fields_count": formula_fields_count,
                "updated_at": now,
            },
        )
        await session.execute(summary_stmt)

        health_stmt = insert(GalaxyHealthRM).values(
            user_id=user_id,
            galaxy_id=galaxy_id,
            guardian_rules_count=guardian_rules_count,
            alerted_civilizations_count=alerted_civilizations_count,
            circular_fields_count=circular_fields_count,
            quality_score=quality_score,
            status=status,
            updated_at=now,
        )
        health_stmt = health_stmt.on_conflict_do_update(
            index_elements=[GalaxyHealthRM.user_id, GalaxyHealthRM.galaxy_id],
            set_={
                "guardian_rules_count": guardian_rules_count,
                "alerted_civilizations_count": alerted_civilizations_count,
                "circular_fields_count": circular_fields_count,
                "quality_score": quality_score,
                "status": status,
                "updated_at": now,
            },
        )
        await session.execute(health_stmt)

        await self.physics_engine.project_galaxy(
            session=session,
            user_id=user_id,
            galaxy_id=galaxy_id,
            source_event_seq=source_event_seq,
        )

        # keep soft-delete behavior for bonds mirrored in read model
        # (already handled via BOND_SOFT_DELETED / ASTEROID_SOFT_DELETED projection paths)
        return

    async def _project_asteroid_created(
        self,
        *,
        session: AsyncSession,
        user_id: UUID,
        galaxy_id: UUID,
        civilization_id: UUID,
        payload: AsteroidCreatedPayload,
        happened_at: datetime,
    ) -> None:
        stmt = insert(CivilizationRM).values(
            id=civilization_id,
            user_id=user_id,
            galaxy_id=galaxy_id,
            value=payload.value,
            metadata_=payload.metadata,
            is_deleted=False,
            created_at=happened_at,
            deleted_at=None,
        )
        stmt = stmt.on_conflict_do_update(
            index_elements=[CivilizationRM.id],
            set_={
                "user_id": user_id,
                "galaxy_id": galaxy_id,
                "value": payload.value,
                "metadata": payload.metadata,
                "is_deleted": False,
                "deleted_at": None,
            },
        )
        await session.execute(stmt)

    async def _project_metadata_updated(
        self,
        *,
        session: AsyncSession,
        user_id: UUID,
        galaxy_id: UUID,
        civilization_id: UUID,
        payload: MetadataUpdatedPayload,
    ) -> None:
        metadata_patch = payload.metadata if isinstance(payload.metadata, dict) else {}
        metadata_remove: list[str] = []
        for item in payload.metadata_remove:
            key = str(item or "").strip()
            if key:
                metadata_remove.append(key)
        if not metadata_patch and not metadata_remove:
            return

        locked_atom = (
            await session.execute(
                select(CivilizationRM)
                .where(
                    and_(
                        CivilizationRM.id == civilization_id,
                        CivilizationRM.user_id == user_id,
                        CivilizationRM.galaxy_id == galaxy_id,
                    )
                )
                .with_for_update()
            )
        ).scalar_one_or_none()
        if locked_atom is None:
            return

        current_metadata = locked_atom.metadata_ if isinstance(locked_atom.metadata_, dict) else {}
        next_metadata = {**current_metadata, **metadata_patch}
        for key in metadata_remove:
            next_metadata.pop(key, None)
        locked_atom.metadata_ = next_metadata

    async def _project_asteroid_soft_deleted(
        self,
        *,
        session: AsyncSession,
        user_id: UUID,
        galaxy_id: UUID,
        civilization_id: UUID,
        happened_at: datetime,
    ) -> None:
        await session.execute(
            update(CivilizationRM)
            .where(
                and_(
                    CivilizationRM.id == civilization_id,
                    CivilizationRM.user_id == user_id,
                    CivilizationRM.galaxy_id == galaxy_id,
                    CivilizationRM.is_deleted.is_(False),
                )
            )
            .values(is_deleted=True, deleted_at=happened_at)
        )

        await session.execute(
            update(Bond)
            .where(
                and_(
                    Bond.user_id == user_id,
                    Bond.galaxy_id == galaxy_id,
                    Bond.is_deleted.is_(False),
                    (Bond.source_civilization_id == civilization_id) | (Bond.target_civilization_id == civilization_id),
                )
            )
            .values(is_deleted=True, deleted_at=happened_at)
        )

    async def _project_asteroid_value_updated(
        self,
        *,
        session: AsyncSession,
        user_id: UUID,
        galaxy_id: UUID,
        civilization_id: UUID,
        payload: AsteroidValueUpdatedPayload,
    ) -> None:
        await session.execute(
            update(CivilizationRM)
            .where(
                and_(
                    CivilizationRM.id == civilization_id,
                    CivilizationRM.user_id == user_id,
                    CivilizationRM.galaxy_id == galaxy_id,
                    CivilizationRM.is_deleted.is_(False),
                )
            )
            .values(value=payload.value)
        )

    async def _project_bond_formed(
        self,
        *,
        session: AsyncSession,
        user_id: UUID,
        galaxy_id: UUID,
        bond_id: UUID,
        payload: BondFormedPayload,
        happened_at: datetime,
    ) -> None:
        stmt = insert(Bond).values(
            id=bond_id,
            user_id=user_id,
            galaxy_id=galaxy_id,
            source_civilization_id=payload.source_civilization_id,
            target_civilization_id=payload.target_civilization_id,
            type=payload.type,
            is_deleted=False,
            created_at=happened_at,
            deleted_at=None,
        )
        # Ignore duplicates on replay/retry; read-model keeps one active edge record.
        stmt = stmt.on_conflict_do_nothing()
        await session.execute(stmt)

    async def _project_bond_soft_deleted(
        self,
        *,
        session: AsyncSession,
        user_id: UUID,
        galaxy_id: UUID,
        bond_id: UUID,
        happened_at: datetime,
    ) -> None:
        await session.execute(
            update(Bond)
            .where(
                and_(
                    Bond.id == bond_id,
                    Bond.user_id == user_id,
                    Bond.galaxy_id == galaxy_id,
                    Bond.is_deleted.is_(False),
                )
            )
            .values(is_deleted=True, deleted_at=happened_at)
        )
