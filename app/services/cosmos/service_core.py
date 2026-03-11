from __future__ import annotations

from hashlib import blake2b
from typing import Any
from uuid import UUID

from fastapi import HTTPException, status
from sqlalchemy import and_, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.infrastructure.runtime.event_store_service import EventStoreService
from app.models import Galaxy, MoonCapability, TableContract
from app.services.galaxy_scope_service import resolve_user_galaxy_for_user
from app.services.projection.read_model_projector import ReadModelProjector


class CosmosServiceCore:
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
    def _normalize_capability_key(raw: str) -> str:
        value = str(raw or "").strip()
        if not value:
            raise HTTPException(
                status_code=status.HTTP_422_UNPROCESSABLE_CONTENT,
                detail="Capability key must be a non-empty string.",
            )
        return value

    @staticmethod
    def _normalize_capability_class(raw: str) -> str:
        value = str(raw or "").strip().lower()
        if value not in {"dictionary", "validation", "formula", "bridge"}:
            raise HTTPException(
                status_code=status.HTTP_422_UNPROCESSABLE_CONTENT,
                detail="Unsupported capability class. Use 'dictionary', 'validation', 'formula' or 'bridge'.",
            )
        return value

    @staticmethod
    def _normalize_capability_status(raw: str) -> str:
        value = str(raw or "").strip().lower()
        if value not in {"active", "deprecated"}:
            raise HTTPException(
                status_code=status.HTTP_422_UNPROCESSABLE_CONTENT,
                detail="Unsupported capability status. Use 'active' or 'deprecated'.",
            )
        return value

    async def _ensure_planet_contract_exists(
        self,
        session: AsyncSession,
        *,
        galaxy_id: UUID,
        table_id: UUID,
    ) -> None:
        contract_id = (
            await session.execute(
                select(TableContract.id)
                .where(
                    and_(
                        TableContract.galaxy_id == galaxy_id,
                        TableContract.table_id == table_id,
                        TableContract.deleted_at.is_(None),
                    )
                )
                .order_by(TableContract.version.desc(), TableContract.id.desc())
                .limit(1)
            )
        ).scalar_one_or_none()
        if contract_id is None:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Planet contract not found")

    async def _load_active_moon_capabilities(
        self,
        session: AsyncSession,
        *,
        galaxy_id: UUID,
        table_id: UUID,
    ) -> list[MoonCapability]:
        rows = (
            await session.execute(
                select(MoonCapability)
                .where(
                    and_(
                        MoonCapability.galaxy_id == galaxy_id,
                        MoonCapability.table_id == table_id,
                        MoonCapability.deleted_at.is_(None),
                    )
                )
                .order_by(
                    MoonCapability.order_index.asc(),
                    MoonCapability.capability_key.asc(),
                    MoonCapability.version.desc(),
                    MoonCapability.created_at.desc(),
                )
            )
        ).scalars()
        return list(rows.all())

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
