from __future__ import annotations

from datetime import datetime
from typing import Any
from uuid import UUID

from sqlalchemy import and_, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models import Event, TableContract
from app.services.universe.tables_snapshot import build_tables_snapshot
from app.services.universe.types import DEFAULT_GALAXY_ID, ProjectedBond, ProjectedCivilization


class UniverseServiceSnapshots:
    async def project_state(
        self,
        session: AsyncSession,
        *,
        user_id: UUID,
        galaxy_id: UUID = DEFAULT_GALAXY_ID,
        branch_id: UUID | None = None,
        as_of: datetime | None = None,
        apply_calculations: bool = True,
    ) -> tuple[list[ProjectedCivilization | dict[str, Any]], list[ProjectedBond | dict[str, Any]]]:
        await self._ensure_galaxy_access(session, user_id=user_id, galaxy_id=galaxy_id)
        if branch_id is not None:
            active_asteroids, active_bonds = await self._project_state_from_branch(
                session=session,
                user_id=user_id,
                galaxy_id=galaxy_id,
                branch_id=branch_id,
                as_of=as_of,
            )
        elif as_of is None:
            active_asteroids, active_bonds = await self._project_state_from_read_model(
                session=session,
                user_id=user_id,
                galaxy_id=galaxy_id,
            )
            if not active_asteroids and not active_bonds:
                has_any_events_stmt = (
                    select(Event.id)
                    .where(
                        and_(
                            Event.user_id == user_id,
                            Event.galaxy_id == galaxy_id,
                            Event.branch_id.is_(None),
                        )
                    )
                    .limit(1)
                )
                has_any_events = (await session.execute(has_any_events_stmt)).scalar_one_or_none() is not None

                if has_any_events:
                    active_asteroids, active_bonds = await self._project_state_from_events(
                        session=session,
                        user_id=user_id,
                        galaxy_id=galaxy_id,
                        branch_id=None,
                        as_of=as_of,
                    )
        else:
            active_asteroids, active_bonds = await self._project_state_from_events(
                session=session,
                user_id=user_id,
                galaxy_id=galaxy_id,
                branch_id=None,
                as_of=as_of,
            )

        if not apply_calculations:
            return active_asteroids, active_bonds

        main_enriched = await self._enrich_main_timeline_from_read_models(
            session,
            user_id=user_id,
            galaxy_id=galaxy_id,
            active_asteroids=active_asteroids,
            active_bonds=active_bonds,
        )
        bond_enriched = await self._enrich_bonds_from_read_models(
            session,
            user_id=user_id,
            galaxy_id=galaxy_id,
            active_bonds=active_bonds,
        )
        return main_enriched, bond_enriched

    async def snapshot(
        self,
        session: AsyncSession,
        *,
        user_id: UUID,
        galaxy_id: UUID = DEFAULT_GALAXY_ID,
        branch_id: UUID | None = None,
        as_of: datetime | None = None,
    ) -> tuple[list[ProjectedCivilization | dict[str, Any]], list[ProjectedBond | dict[str, Any]]]:
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
        civilizations, bonds = await self.snapshot(
            session=session,
            user_id=user_id,
            galaxy_id=galaxy_id,
            branch_id=branch_id,
            as_of=as_of,
        )
        contract_hints = await self._load_latest_contract_hints(
            session=session,
            galaxy_id=galaxy_id,
        )
        return build_tables_snapshot(
            self,
            galaxy_id=galaxy_id,
            civilizations=civilizations,
            bonds=bonds,
            contract_hints=contract_hints,
        )

    async def _load_latest_contract_hints(
        self,
        *,
        session: AsyncSession,
        galaxy_id: UUID,
    ) -> dict[UUID, dict[str, Any]]:
        stmt = (
            select(TableContract)
            .where(
                and_(
                    TableContract.galaxy_id == galaxy_id,
                    TableContract.deleted_at.is_(None),
                )
            )
            .order_by(
                TableContract.table_id.asc(),
                TableContract.version.desc(),
                TableContract.created_at.desc(),
                TableContract.id.desc(),
            )
        )
        contracts = list((await session.execute(stmt)).scalars().all())
        hints: dict[UUID, dict[str, Any]] = {}
        for contract in contracts:
            table_id = contract.table_id
            if table_id in hints:
                continue
            field_types = contract.field_types if isinstance(contract.field_types, dict) else {}
            formula_registry = contract.formula_registry if isinstance(contract.formula_registry, list) else []
            physics_rulebook = contract.physics_rulebook if isinstance(contract.physics_rulebook, dict) else {}
            defaults = physics_rulebook.get("defaults") if isinstance(physics_rulebook.get("defaults"), dict) else {}
            table_name = str(defaults.get("table_name") or "").strip()
            if not table_name:
                continue
            raw_visual_position = defaults.get("planet_visual_position")
            visual_position: dict[str, float] | None = None
            if isinstance(raw_visual_position, dict):
                try:
                    x = float(raw_visual_position.get("x", 0.0))
                    y = float(raw_visual_position.get("y", 0.0))
                    z = float(raw_visual_position.get("z", 0.0))
                    visual_position = {"x": x, "y": y, "z": z}
                except (TypeError, ValueError):
                    visual_position = None
            formula_fields: list[str] = []
            for formula in formula_registry:
                if not isinstance(formula, dict):
                    continue
                target = str(formula.get("target") or "").strip()
                if target and target not in formula_fields:
                    formula_fields.append(target)
            hints[table_id] = {
                "table_name": table_name,
                "schema_fields": [str(key) for key in field_types.keys() if str(key).strip()],
                "formula_fields": formula_fields,
                "planet_archetype": str(defaults.get("planet_archetype") or "").strip() or None,
                "contract_version": int(contract.version or 1),
                "planet_visual_position": visual_position,
            }
        return hints
