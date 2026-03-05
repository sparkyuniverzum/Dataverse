from __future__ import annotations

from datetime import UTC, datetime
from hashlib import blake2b
from typing import Any
from uuid import UUID

from fastapi import HTTPException, status
from sqlalchemy import and_, select, text as sql_text
from sqlalchemy.exc import IntegrityError
from sqlalchemy.ext.asyncio import AsyncSession

from app.models import Branch, Event, Galaxy, TableContract
from app.services.event_store_service import EventStoreService
from app.services.galaxy_scope_service import resolve_user_galaxy_for_user
from app.services.read_model_projector import ReadModelProjector
from app.services.universe.types import derive_table_id, normalize_table_name


class CosmosService:
    def __init__(
        self,
        *,
        event_store: EventStoreService | None = None,
        read_model_projector: ReadModelProjector | None = None,
    ) -> None:
        self.event_store = event_store or EventStoreService()
        self.read_model_projector = read_model_projector or ReadModelProjector()

    async def _resolve_user_galaxy(
        self,
        session: AsyncSession,
        *,
        user_id: UUID,
        galaxy_id: UUID | None,
    ) -> Galaxy:
        return await resolve_user_galaxy_for_user(
            session=session,
            user_id=user_id,
            galaxy_id=galaxy_id,
        )

    @staticmethod
    def _normalize_string_list(values: list[str]) -> list[str]:
        result: list[str] = []
        seen: set[str] = set()
        for raw in values:
            value = str(raw).strip()
            if not value or value in seen:
                continue
            seen.add(value)
            result.append(value)
        return result

    @staticmethod
    def _normalize_dict_list(values: list[Any]) -> list[dict[str, Any]]:
        return [item for item in values if isinstance(item, dict)]

    def _normalize_schema_registry(
        self,
        *,
        schema_registry: dict[str, Any],
        required_fields: list[str],
        field_types: dict[str, str],
        unique_rules: list[dict[str, Any]],
        validators: list[dict[str, Any]],
        auto_semantics: list[dict[str, Any]],
    ) -> tuple[list[str], dict[str, str], list[dict[str, Any]], list[dict[str, Any]], list[dict[str, Any]]]:
        schema = schema_registry if isinstance(schema_registry, dict) else {}

        resolved_required = required_fields
        if not resolved_required and isinstance(schema.get("required_fields"), list):
            resolved_required = [str(item) for item in schema["required_fields"]]

        resolved_field_types = field_types
        if not resolved_field_types and isinstance(schema.get("field_types"), dict):
            resolved_field_types = {str(key): str(value) for key, value in schema["field_types"].items()}

        resolved_unique_rules = unique_rules
        if not resolved_unique_rules and isinstance(schema.get("unique_rules"), list):
            resolved_unique_rules = self._normalize_dict_list(schema["unique_rules"])

        resolved_validators = validators
        if not resolved_validators and isinstance(schema.get("validators"), list):
            resolved_validators = self._normalize_dict_list(schema["validators"])
        resolved_auto_semantics = auto_semantics
        if not resolved_auto_semantics and isinstance(schema.get("auto_semantics"), list):
            resolved_auto_semantics = self._normalize_dict_list(schema["auto_semantics"])

        normalized_required = self._normalize_string_list(resolved_required)
        normalized_field_types: dict[str, str] = {}
        for raw_key, raw_type in resolved_field_types.items():
            key = str(raw_key).strip()
            type_value = str(raw_type).strip().lower()
            if key and type_value:
                normalized_field_types[key] = type_value

        return (
            normalized_required,
            normalized_field_types,
            self._normalize_dict_list(resolved_unique_rules),
            self._normalize_dict_list(resolved_validators),
            self._normalize_dict_list(resolved_auto_semantics),
        )

    def _normalize_formula_registry(self, formula_registry: list[dict[str, Any]]) -> list[dict[str, Any]]:
        normalized: list[dict[str, Any]] = []
        for item in self._normalize_dict_list(formula_registry):
            normalized_item = dict(item)
            normalized_item["id"] = str(normalized_item.get("id") or "").strip()
            normalized_item["target"] = str(normalized_item.get("target") or "").strip()
            normalized_item["expression"] = str(normalized_item.get("expression") or "").strip()
            normalized_item["enabled"] = bool(normalized_item.get("enabled", True))
            normalized_item["trigger"] = str(normalized_item.get("trigger") or "on_commit").strip() or "on_commit"
            normalized_item["on_error"] = (
                str(normalized_item.get("on_error") or "mark_hologram").strip() or "mark_hologram"
            )
            raw_depends_on = normalized_item.get("depends_on")
            normalized_item["depends_on"] = (
                self._normalize_string_list([str(value) for value in raw_depends_on])
                if isinstance(raw_depends_on, list)
                else []
            )
            if not (normalized_item["id"] and normalized_item["target"] and normalized_item["expression"]):
                continue
            normalized.append(normalized_item)
        return normalized

    def _normalize_physics_rulebook(self, physics_rulebook: dict[str, Any]) -> dict[str, Any]:
        source = physics_rulebook if isinstance(physics_rulebook, dict) else {}
        raw_rules = source.get("rules")
        rules = self._normalize_dict_list(raw_rules if isinstance(raw_rules, list) else [])
        defaults = source.get("defaults")
        return {
            "rules": rules,
            "defaults": defaults if isinstance(defaults, dict) else {},
        }

    @staticmethod
    def _normalize_branch_name(name: str) -> str:
        return str(name).strip().casefold()

    @staticmethod
    def _normalize_planet_archetype(raw: str) -> str:
        archetype = str(raw or "").strip().lower()
        if archetype not in {"catalog", "stream", "junction"}:
            raise HTTPException(
                status_code=status.HTTP_422_UNPROCESSABLE_CONTENT,
                detail="Unsupported planet archetype. Use 'catalog', 'stream' or 'junction'.",
            )
        return archetype

    @staticmethod
    def _archetype_schema_template(
        archetype: str,
    ) -> tuple[list[str], dict[str, str], list[dict[str, Any]], list[dict[str, Any]]]:
        if archetype == "catalog":
            return (
                ["entity_id", "label", "state"],
                {
                    "entity_id": "string",
                    "label": "string",
                    "state": "string",
                    "description": "string",
                    "tags": "array",
                },
                [{"fields": ["entity_id"]}],
                [],
            )
        if archetype == "stream":
            return (
                ["event_id", "event_time", "value"],
                {
                    "event_id": "string",
                    "event_time": "datetime",
                    "value": "number",
                    "direction": "string",
                    "note": "string",
                    "source": "string",
                },
                [{"fields": ["event_id"]}],
                [],
            )
        return (
            ["link_id", "source_ref", "target_ref"],
            {
                "link_id": "string",
                "source_ref": "string",
                "target_ref": "string",
                "weight": "number",
                "role": "string",
            },
            [{"fields": ["link_id"]}],
            [],
        )

    @staticmethod
    def _branch_name_lock_key(*, galaxy_id: UUID, normalized_name: str) -> int:
        digest = blake2b(
            f"{galaxy_id}:{normalized_name}".encode(),
            digest_size=8,
        ).digest()
        return int.from_bytes(digest, byteorder="big", signed=True)

    async def list_branches(
        self,
        session: AsyncSession,
        *,
        user_id: UUID,
        galaxy_id: UUID | None,
    ) -> list[Branch]:
        galaxy = await self._resolve_user_galaxy(session=session, user_id=user_id, galaxy_id=galaxy_id)
        return list(
            (
                await session.execute(
                    select(Branch)
                    .where(
                        Branch.galaxy_id == galaxy.id,
                        Branch.deleted_at.is_(None),
                    )
                    .order_by(Branch.created_at.asc(), Branch.id.asc())
                )
            )
            .scalars()
            .all()
        )

    async def resolve_branch_id(
        self,
        session: AsyncSession,
        *,
        user_id: UUID,
        galaxy_id: UUID,
        branch_id: UUID | None,
    ) -> UUID | None:
        if branch_id is None:
            return None

        await self._resolve_user_galaxy(session=session, user_id=user_id, galaxy_id=galaxy_id)
        branch = (await session.execute(select(Branch).where(Branch.id == branch_id))).scalar_one_or_none()
        if branch is None or branch.deleted_at is not None:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Branch not found")
        if branch.galaxy_id != galaxy_id:
            raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Forbidden branch access")
        return branch.id

    async def create_branch(
        self,
        session: AsyncSession,
        *,
        user_id: UUID,
        galaxy_id: UUID | None,
        name: str,
        as_of: datetime | None,
    ) -> Branch:
        galaxy = await self._resolve_user_galaxy(session=session, user_id=user_id, galaxy_id=galaxy_id)
        branch_name = str(name).strip()
        if not branch_name:
            raise HTTPException(status_code=status.HTTP_422_UNPROCESSABLE_CONTENT, detail="Branch name cannot be empty")
        normalized_name = self._normalize_branch_name(branch_name)

        lock_key = self._branch_name_lock_key(galaxy_id=galaxy.id, normalized_name=normalized_name)
        await session.execute(sql_text("SELECT pg_advisory_xact_lock(:key)"), {"key": lock_key})

        existing_active_branches = list(
            (
                await session.execute(
                    select(Branch).where(
                        and_(
                            Branch.galaxy_id == galaxy.id,
                            Branch.deleted_at.is_(None),
                        )
                    )
                )
            )
            .scalars()
            .all()
        )
        for existing in existing_active_branches:
            if self._normalize_branch_name(existing.name) == normalized_name:
                raise HTTPException(
                    status_code=status.HTTP_409_CONFLICT,
                    detail="Branch with the same normalized name already exists in this galaxy",
                )

        latest_event_stmt = (
            select(Event)
            .where(
                Event.user_id == user_id,
                Event.galaxy_id == galaxy.id,
                Event.branch_id.is_(None),
            )
            .order_by(Event.event_seq.desc())
            .limit(1)
        )
        if as_of is not None:
            latest_event_stmt = latest_event_stmt.where(Event.timestamp <= as_of)
        latest_event = (await session.execute(latest_event_stmt)).scalar_one_or_none()

        branch = Branch(
            galaxy_id=galaxy.id,
            name=branch_name,
            base_event_id=latest_event.id if latest_event is not None else None,
            created_by=user_id,
        )
        session.add(branch)
        try:
            await session.flush()
        except IntegrityError as exc:
            if "uq_branches_galaxy_name_norm_active" in str(exc):
                raise HTTPException(
                    status_code=status.HTTP_409_CONFLICT,
                    detail="Branch with the same normalized name already exists in this galaxy",
                ) from exc
            raise
        await session.refresh(branch)
        return branch

    async def promote_branch(
        self,
        session: AsyncSession,
        *,
        user_id: UUID,
        galaxy_id: UUID | None,
        branch_id: UUID,
    ) -> tuple[Branch, int]:
        galaxy = await self._resolve_user_galaxy(session=session, user_id=user_id, galaxy_id=galaxy_id)
        branch = (
            await session.execute(select(Branch).where(Branch.id == branch_id).with_for_update())
        ).scalar_one_or_none()
        if branch is None or branch.deleted_at is not None:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Branch not found")
        if branch.galaxy_id != galaxy.id:
            raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Forbidden branch access")

        branch_events = list(
            (
                await session.execute(
                    select(Event)
                    .where(
                        and_(
                            Event.user_id == user_id,
                            Event.galaxy_id == galaxy.id,
                            Event.branch_id == branch.id,
                        )
                    )
                    .order_by(Event.event_seq.asc())
                )
            )
            .scalars()
            .all()
        )

        promoted_events: list[Event] = []
        for event in branch_events:
            promoted = await self.event_store.append_event(
                session=session,
                user_id=user_id,
                galaxy_id=galaxy.id,
                branch_id=None,
                entity_id=event.entity_id,
                event_type=event.event_type,
                payload=event.payload if isinstance(event.payload, dict) else {},
            )
            promoted_events.append(promoted)

        if promoted_events:
            await self.read_model_projector.apply_events(session=session, events=promoted_events)

        branch.deleted_at = datetime.now(UTC)
        return branch, len(promoted_events)

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
