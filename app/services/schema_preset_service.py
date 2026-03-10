from __future__ import annotations

import json
from dataclasses import dataclass
from typing import Any
from uuid import UUID

from fastapi import HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession

from app.models import TableContract
from app.presets.schema_presets import (
    SchemaPresetDefinition,
    SchemaPresetSeedRow,
    get_schema_preset,
    list_schema_presets,
)
from app.services.cosmos_service import CosmosService
from app.services.parser_types import AtomicTask
from app.services.task_executor_service import TaskExecutionResult, TaskExecutorService
from app.services.universe_service import UniverseService


@dataclass
class PresetFieldConflict:
    field: str
    existing_type: str
    preset_type: str
    resolution: str


@dataclass
class PresetApplyPlan:
    preset: SchemaPresetDefinition
    table_id: UUID
    table_name: str
    conflict_strategy: str
    merged_contract: dict[str, Any]
    contract_diff: dict[str, Any]
    seed_rows_to_create: list[SchemaPresetSeedRow]
    skipped_seed_values: list[str]


class SchemaPresetService:
    def __init__(
        self,
        *,
        universe_service: UniverseService,
        cosmos_service: CosmosService,
        task_executor_service: TaskExecutorService,
    ) -> None:
        self.universe_service = universe_service
        self.cosmos_service = cosmos_service
        self.task_executor_service = task_executor_service

    @staticmethod
    def _normalize_text(value: Any) -> str:
        return str(value or "").strip().casefold()

    @staticmethod
    def _dedupe_str_list(values: list[str]) -> list[str]:
        seen: set[str] = set()
        normalized: list[str] = []
        for raw in values:
            item = str(raw).strip()
            if not item or item in seen:
                continue
            seen.add(item)
            normalized.append(item)
        return normalized

    @staticmethod
    def _dedupe_dict_list(values: list[dict[str, Any]]) -> list[dict[str, Any]]:
        seen: set[str] = set()
        output: list[dict[str, Any]] = []
        for item in values:
            if not isinstance(item, dict):
                continue
            token = json.dumps(item, sort_keys=True, ensure_ascii=False, separators=(",", ":"))
            if token in seen:
                continue
            seen.add(token)
            output.append(item)
        return output

    @staticmethod
    def _dedupe_formula_registry(values: list[dict[str, Any]]) -> list[dict[str, Any]]:
        seen: set[tuple[str, str, str]] = set()
        output: list[dict[str, Any]] = []
        for item in values:
            if not isinstance(item, dict):
                continue
            item_id = str(item.get("id") or "").strip()
            target = str(item.get("target") or "").strip()
            expression = str(item.get("expression") or "").strip()
            token = (item_id, target, expression)
            if token in seen:
                continue
            seen.add(token)
            output.append(item)
        return output

    async def _resolve_target_table(
        self,
        *,
        session: AsyncSession,
        user_id: UUID,
        galaxy_id: UUID,
        branch_id: UUID | None,
        table_id: UUID,
        target_table_name: str | None,
    ) -> tuple[str, set[str]]:
        requested_name = str(target_table_name or "").strip()
        tables = await self.universe_service.tables_snapshot(
            session=session,
            user_id=user_id,
            galaxy_id=galaxy_id,
            branch_id=branch_id,
            as_of=None,
        )
        table_row = next((item for item in tables if item.get("table_id") == table_id), None)
        resolved_name = requested_name
        existing_values: set[str] = set()

        if table_row is not None:
            fallback_name = str(table_row.get("name") or "").strip()
            if not resolved_name:
                resolved_name = fallback_name
            members = table_row.get("members") if isinstance(table_row.get("members"), list) else []
            for member in members:
                if not isinstance(member, dict):
                    continue
                value = member.get("value")
                normalized = self._normalize_text(value)
                if normalized:
                    existing_values.add(normalized)

        if not resolved_name:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail=(
                    "Target planet cannot be resolved from current snapshot. "
                    "Provide `target_table_name` for empty planets."
                ),
            )

        return resolved_name, existing_values

    async def _load_existing_contract(
        self,
        *,
        session: AsyncSession,
        user_id: UUID,
        galaxy_id: UUID,
        table_id: UUID,
    ) -> TableContract | None:
        try:
            return await self.cosmos_service.get_table_contract(
                session=session,
                user_id=user_id,
                galaxy_id=galaxy_id,
                table_id=table_id,
            )
        except HTTPException as exc:
            if exc.status_code == status.HTTP_404_NOT_FOUND:
                return None
            raise

    def _merge_contract(
        self,
        *,
        existing_contract: TableContract | None,
        preset: SchemaPresetDefinition,
        conflict_strategy: str,
    ) -> tuple[dict[str, Any], dict[str, Any]]:
        existing_required = (
            [str(item) for item in existing_contract.required_fields]
            if existing_contract is not None and isinstance(existing_contract.required_fields, list)
            else []
        )
        existing_field_types = (
            {str(key): str(value) for key, value in existing_contract.field_types.items()}
            if existing_contract is not None and isinstance(existing_contract.field_types, dict)
            else {}
        )
        existing_unique_rules = (
            [item for item in existing_contract.unique_rules if isinstance(item, dict)]
            if existing_contract is not None and isinstance(existing_contract.unique_rules, list)
            else []
        )
        existing_validators = (
            [item for item in existing_contract.validators if isinstance(item, dict)]
            if existing_contract is not None and isinstance(existing_contract.validators, list)
            else []
        )
        existing_formula_registry = (
            [item for item in existing_contract.formula_registry if isinstance(item, dict)]
            if existing_contract is not None and isinstance(existing_contract.formula_registry, list)
            else []
        )
        existing_rulebook = (
            existing_contract.physics_rulebook
            if existing_contract is not None and isinstance(existing_contract.physics_rulebook, dict)
            else {}
        )
        existing_defaults = (
            existing_rulebook.get("defaults") if isinstance(existing_rulebook.get("defaults"), dict) else {}
        )
        existing_rules = existing_rulebook.get("rules") if isinstance(existing_rulebook.get("rules"), list) else []

        merged_field_types = dict(existing_field_types)
        conflicts: list[PresetFieldConflict] = []
        added_fields: list[str] = []

        for field_name, preset_type in preset.field_types.items():
            normalized_field = str(field_name).strip()
            normalized_type = str(preset_type).strip().lower()
            if not normalized_field or not normalized_type:
                continue
            if normalized_field not in merged_field_types:
                merged_field_types[normalized_field] = normalized_type
                added_fields.append(normalized_field)
                continue
            existing_type = str(merged_field_types[normalized_field]).strip().lower()
            if existing_type == normalized_type:
                continue
            if conflict_strategy == "overwrite":
                merged_field_types[normalized_field] = normalized_type
                resolution = "overwrite"
            else:
                resolution = "keep_existing"
            conflicts.append(
                PresetFieldConflict(
                    field=normalized_field,
                    existing_type=existing_type,
                    preset_type=normalized_type,
                    resolution=resolution,
                )
            )

        merged_required = self._dedupe_str_list(existing_required + [str(item) for item in preset.required_fields])
        added_required = [field for field in preset.required_fields if field not in set(existing_required)]

        preset_unique_rules = [dict(item) for item in preset.unique_rules if isinstance(item, dict)]
        preset_validators = [dict(item) for item in preset.validators if isinstance(item, dict)]
        preset_auto_semantics = [dict(item) for item in preset.auto_semantics if isinstance(item, dict)]
        preset_formula_registry = [dict(item) for item in preset.formula_registry if isinstance(item, dict)]
        preset_rulebook = preset.physics_rulebook if isinstance(preset.physics_rulebook, dict) else {}
        preset_defaults = preset_rulebook.get("defaults") if isinstance(preset_rulebook.get("defaults"), dict) else {}
        preset_rules = preset_rulebook.get("rules") if isinstance(preset_rulebook.get("rules"), list) else []

        merged_unique_rules = self._dedupe_dict_list(existing_unique_rules + preset_unique_rules)
        merged_validators = self._dedupe_dict_list(existing_validators + preset_validators)
        merged_auto_semantics = self._dedupe_dict_list(preset_auto_semantics)
        merged_formula_registry = self._dedupe_formula_registry(existing_formula_registry + preset_formula_registry)
        merged_rules = self._dedupe_dict_list(
            [item for item in existing_rules if isinstance(item, dict)]
            + [item for item in preset_rules if isinstance(item, dict)]
        )

        if conflict_strategy == "overwrite":
            merged_defaults = {**existing_defaults, **preset_defaults}
        else:
            merged_defaults = {**preset_defaults, **existing_defaults}

        merged_contract = {
            "required_fields": merged_required,
            "field_types": merged_field_types,
            "unique_rules": merged_unique_rules,
            "validators": merged_validators,
            "auto_semantics": merged_auto_semantics,
            "formula_registry": merged_formula_registry,
            "physics_rulebook": {
                "rules": merged_rules,
                "defaults": merged_defaults,
            },
            "schema_registry": {
                "required_fields": merged_required,
                "field_types": merged_field_types,
                "unique_rules": merged_unique_rules,
                "validators": merged_validators,
                "auto_semantics": merged_auto_semantics,
            },
        }
        diff = {
            "added_fields": sorted(added_fields),
            "added_required_fields": sorted(set(added_required)),
            "conflicts": [
                {
                    "field": item.field,
                    "existing_type": item.existing_type,
                    "preset_type": item.preset_type,
                    "resolution": item.resolution,
                }
                for item in conflicts
            ],
        }
        return merged_contract, diff

    def _build_seed_plan(
        self,
        *,
        preset: SchemaPresetDefinition,
        table_name: str,
        existing_values: set[str],
        enable_seed_rows: bool,
    ) -> tuple[list[SchemaPresetSeedRow], list[str]]:
        if not enable_seed_rows:
            return [], []
        to_create: list[SchemaPresetSeedRow] = []
        skipped_values: list[str] = []

        for row in preset.default_rows:
            normalized_value = self._normalize_text(row.value)
            if normalized_value and normalized_value in existing_values:
                skipped_values.append(str(row.value))
                continue
            metadata = dict(row.metadata)
            metadata["table"] = table_name
            to_create.append(SchemaPresetSeedRow(value=row.value, metadata=metadata))

        return to_create, skipped_values

    async def build_apply_plan(
        self,
        *,
        session: AsyncSession,
        user_id: UUID,
        galaxy_id: UUID,
        branch_id: UUID | None,
        table_id: UUID,
        preset_key: str,
        conflict_strategy: str,
        target_table_name: str | None,
        seed_rows: bool,
    ) -> PresetApplyPlan:
        preset = get_schema_preset(preset_key)
        if preset is None:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Schema preset not found")

        normalized_strategy = str(conflict_strategy or "skip").strip().lower()
        if normalized_strategy not in {"skip", "overwrite"}:
            raise HTTPException(
                status_code=status.HTTP_422_UNPROCESSABLE_CONTENT,
                detail="Unsupported conflict_strategy. Use 'skip' or 'overwrite'.",
            )

        table_name, existing_values = await self._resolve_target_table(
            session=session,
            user_id=user_id,
            galaxy_id=galaxy_id,
            branch_id=branch_id,
            table_id=table_id,
            target_table_name=target_table_name,
        )
        existing_contract = await self._load_existing_contract(
            session=session,
            user_id=user_id,
            galaxy_id=galaxy_id,
            table_id=table_id,
        )
        merged_contract, diff = self._merge_contract(
            existing_contract=existing_contract,
            preset=preset,
            conflict_strategy=normalized_strategy,
        )
        seed_rows_to_create, skipped_seed_values = self._build_seed_plan(
            preset=preset,
            table_name=table_name,
            existing_values=existing_values,
            enable_seed_rows=seed_rows,
        )

        return PresetApplyPlan(
            preset=preset,
            table_id=table_id,
            table_name=table_name,
            conflict_strategy=normalized_strategy,
            merged_contract=merged_contract,
            contract_diff=diff,
            seed_rows_to_create=seed_rows_to_create,
            skipped_seed_values=skipped_seed_values,
        )

    async def apply_plan_commit(
        self,
        *,
        session: AsyncSession,
        user_id: UUID,
        galaxy_id: UUID,
        branch_id: UUID | None,
        plan: PresetApplyPlan,
    ) -> tuple[TableContract, TaskExecutionResult | None]:
        merged = plan.merged_contract
        contract = await self.cosmos_service.upsert_table_contract(
            session=session,
            user_id=user_id,
            galaxy_id=galaxy_id,
            table_id=plan.table_id,
            schema_registry=merged["schema_registry"],
            required_fields=merged["required_fields"],
            field_types=merged["field_types"],
            unique_rules=merged["unique_rules"],
            validators=merged["validators"],
            auto_semantics=merged["auto_semantics"],
            formula_registry=merged["formula_registry"],
            physics_rulebook=merged["physics_rulebook"],
        )

        if not plan.seed_rows_to_create:
            return contract, None

        tasks = [
            AtomicTask(
                action="INGEST",
                params={
                    "value": row.value,
                    "metadata": dict(row.metadata),
                },
            )
            for row in plan.seed_rows_to_create
        ]
        execution = await self.task_executor_service.execute_tasks(
            session=session,
            tasks=tasks,
            user_id=user_id,
            galaxy_id=galaxy_id,
            branch_id=branch_id,
            manage_transaction=False,
        )
        return contract, execution

    def list_presets(self) -> list[SchemaPresetDefinition]:
        return list_schema_presets()

    def get_preset(self, preset_key: str) -> SchemaPresetDefinition:
        preset = get_schema_preset(preset_key)
        if preset is None:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Schema preset not found")
        return preset
