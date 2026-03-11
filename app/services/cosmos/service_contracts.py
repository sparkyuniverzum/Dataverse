from __future__ import annotations

from datetime import UTC, datetime
from typing import Any
from uuid import UUID

from fastapi import HTTPException, status
from sqlalchemy import and_, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models import TableContract
from app.services.table_contract_effective import EffectiveTableContract, compile_effective_table_contract
from app.services.universe.types import derive_table_id, normalize_table_name


class CosmosServiceContracts:
    async def get_table_contract(
        self,
        session: AsyncSession,
        *,
        user_id: UUID,
        galaxy_id: UUID,
        table_id: UUID,
    ) -> TableContract:
        galaxy = await self._resolve_user_galaxy(session=session, user_id=user_id, galaxy_id=galaxy_id)
        contract = (
            await session.execute(
                select(TableContract)
                .where(
                    and_(
                        TableContract.galaxy_id == galaxy.id,
                        TableContract.table_id == table_id,
                        TableContract.deleted_at.is_(None),
                    )
                )
                .order_by(TableContract.version.desc(), TableContract.created_at.desc(), TableContract.id.desc())
                .limit(1)
            )
        ).scalar_one_or_none()
        if contract is None:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Table contract not found")
        return contract

    async def get_effective_table_contract(
        self,
        session: AsyncSession,
        *,
        user_id: UUID,
        galaxy_id: UUID,
        table_id: UUID,
    ) -> EffectiveTableContract:
        base_contract = await self.get_table_contract(
            session=session,
            user_id=user_id,
            galaxy_id=galaxy_id,
            table_id=table_id,
        )
        capabilities = await self._load_active_moon_capabilities(
            session=session,
            galaxy_id=base_contract.galaxy_id,
            table_id=base_contract.table_id,
        )
        return compile_effective_table_contract(
            base_contract=base_contract,
            capabilities=capabilities,
        )

    async def upsert_table_contract(
        self,
        session: AsyncSession,
        *,
        user_id: UUID,
        galaxy_id: UUID,
        table_id: UUID,
        schema_registry: dict[str, Any],
        required_fields: list[str],
        field_types: dict[str, str],
        unique_rules: list[dict[str, Any]],
        validators: list[dict[str, Any]],
        auto_semantics: list[dict[str, Any]],
        formula_registry: list[dict[str, Any]],
        physics_rulebook: dict[str, Any],
    ) -> TableContract:
        galaxy = await self._resolve_user_galaxy(session=session, user_id=user_id, galaxy_id=galaxy_id)

        latest = (
            await session.execute(
                select(TableContract)
                .where(
                    and_(
                        TableContract.galaxy_id == galaxy.id,
                        TableContract.table_id == table_id,
                    )
                )
                .order_by(TableContract.version.desc(), TableContract.id.desc())
                .limit(1)
            )
        ).scalar_one_or_none()
        next_version = (latest.version + 1) if latest is not None else 1

        (
            normalized_required,
            normalized_field_types,
            normalized_unique_rules,
            normalized_validators,
            normalized_auto_semantics,
        ) = self._normalize_schema_registry(
            schema_registry=schema_registry,
            required_fields=required_fields,
            field_types=field_types,
            unique_rules=unique_rules,
            validators=validators,
            auto_semantics=auto_semantics,
        )
        normalized_formula_registry = self._normalize_formula_registry(formula_registry)
        normalized_physics_rulebook = self._normalize_physics_rulebook(physics_rulebook)
        defaults = normalized_physics_rulebook.get("defaults")
        defaults_dict = dict(defaults) if isinstance(defaults, dict) else {}
        if not normalized_auto_semantics:
            from_physics = defaults_dict.get("auto_semantics")
            if isinstance(from_physics, list):
                normalized_auto_semantics = self._normalize_dict_list(from_physics)
        defaults_dict["auto_semantics"] = normalized_auto_semantics
        normalized_physics_rulebook["defaults"] = defaults_dict

        contract = TableContract(
            galaxy_id=galaxy.id,
            table_id=table_id,
            version=next_version,
            required_fields=normalized_required,
            field_types=normalized_field_types,
            unique_rules=normalized_unique_rules,
            validators=normalized_validators,
            formula_registry=normalized_formula_registry,
            physics_rulebook=normalized_physics_rulebook,
            created_by=user_id,
        )
        session.add(contract)
        await session.flush()
        await session.refresh(contract)
        return contract

    async def create_planet_contract(
        self,
        session: AsyncSession,
        *,
        user_id: UUID,
        galaxy_id: UUID,
        table_name: str,
        archetype: str,
        visual_position: dict[str, float] | None = None,
    ) -> tuple[TableContract, UUID, str]:
        galaxy = await self._resolve_user_galaxy(session=session, user_id=user_id, galaxy_id=galaxy_id)
        normalized_table_name = normalize_table_name(table_name)
        normalized_archetype = self._normalize_planet_archetype(archetype)
        table_id = derive_table_id(galaxy_id=galaxy.id, table_name=normalized_table_name)

        active_contract = (
            await session.execute(
                select(TableContract)
                .where(
                    and_(
                        TableContract.galaxy_id == galaxy.id,
                        TableContract.table_id == table_id,
                        TableContract.deleted_at.is_(None),
                    )
                )
                .order_by(TableContract.version.desc(), TableContract.id.desc())
                .limit(1)
            )
        ).scalar_one_or_none()
        if active_contract is not None:
            raise HTTPException(
                status_code=status.HTTP_409_CONFLICT,
                detail="Planet with this name already exists in this galaxy.",
            )

        required_fields, field_types, unique_rules, validators = self._archetype_schema_template(normalized_archetype)
        physics_defaults: dict[str, Any] = {
            "table_name": normalized_table_name,
            "planet_archetype": normalized_archetype,
            "planet_created_via": "POST:/planets",
        }
        if isinstance(visual_position, dict):
            x = float(visual_position.get("x", 0.0))
            y = float(visual_position.get("y", 0.0))
            z = float(visual_position.get("z", 0.0))
            physics_defaults["planet_visual_position"] = {"x": x, "y": y, "z": z}

        contract = await self.upsert_table_contract(
            session=session,
            user_id=user_id,
            galaxy_id=galaxy.id,
            table_id=table_id,
            schema_registry={
                "required_fields": required_fields,
                "field_types": field_types,
                "unique_rules": unique_rules,
                "validators": validators,
                "auto_semantics": [],
            },
            required_fields=required_fields,
            field_types=field_types,
            unique_rules=unique_rules,
            validators=validators,
            auto_semantics=[],
            formula_registry=[],
            physics_rulebook={"rules": [], "defaults": physics_defaults},
        )
        return contract, table_id, normalized_table_name

    async def list_latest_table_contracts(
        self,
        session: AsyncSession,
        *,
        user_id: UUID,
        galaxy_id: UUID,
        table_ids: list[UUID] | None = None,
    ) -> dict[UUID, TableContract]:
        galaxy = await self._resolve_user_galaxy(session=session, user_id=user_id, galaxy_id=galaxy_id)
        stmt = (
            select(TableContract)
            .where(
                and_(
                    TableContract.galaxy_id == galaxy.id,
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
        if table_ids is not None:
            stmt = stmt.where(TableContract.table_id.in_(table_ids))
        contracts = list((await session.execute(stmt)).scalars().all())
        by_table: dict[UUID, TableContract] = {}
        for contract in contracts:
            if contract.table_id in by_table:
                continue
            by_table[contract.table_id] = contract
        return by_table

    async def soft_delete_planet_contracts(
        self,
        session: AsyncSession,
        *,
        user_id: UUID,
        galaxy_id: UUID,
        table_id: UUID,
    ) -> int:
        galaxy = await self._resolve_user_galaxy(session=session, user_id=user_id, galaxy_id=galaxy_id)
        active_contracts = list(
            (
                await session.execute(
                    select(TableContract).where(
                        and_(
                            TableContract.galaxy_id == galaxy.id,
                            TableContract.table_id == table_id,
                            TableContract.deleted_at.is_(None),
                        )
                    )
                )
            )
            .scalars()
            .all()
        )
        if not active_contracts:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Planet contract not found")
        now = datetime.now(UTC)
        for contract in active_contracts:
            contract.deleted_at = now
            contract.updated_at = now
        await session.flush()
        return len(active_contracts)
