from __future__ import annotations

from datetime import datetime
from typing import Any
from uuid import UUID

from fastapi import HTTPException, status
from sqlalchemy import and_, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models import MoonCapability, TableContract
from app.services.table_contract_effective import EffectiveTableContract, compile_effective_table_contract
from app.services.universe_service import ProjectedAsteroid, derive_table_id, derive_table_name


class TableContractValidator:
    @staticmethod
    def _build_expected_constraint(
        *,
        reason: str,
        expected_type: str | None,
        operator: str | None,
        expected_value: Any | None,
    ) -> dict[str, Any] | None:
        normalized_reason = str(reason or "").strip().lower()
        normalized_expected_type = str(expected_type or "").strip().lower() or None
        normalized_operator = str(operator or "").strip() or None

        constraint: dict[str, Any] = {}
        if normalized_reason in {"required_missing", "required_empty"}:
            constraint["required"] = True
            if normalized_reason == "required_empty":
                constraint["non_empty"] = True
        if normalized_expected_type:
            constraint["type"] = normalized_expected_type
        if normalized_operator:
            constraint["operator"] = normalized_operator
        if expected_value is not None:
            constraint["value"] = expected_value
        return constraint or None

    @classmethod
    def _build_repair_hint(
        cls,
        *,
        reason: str,
        mineral_key: str | None,
        expected_type: str | None,
        operator: str | None,
        expected_value: Any | None,
    ) -> str | None:
        field = str(mineral_key or "value").strip() or "value"
        normalized_reason = str(reason or "").strip().lower()
        normalized_type = str(expected_type or "").strip().lower()
        normalized_operator = str(operator or "").strip()

        if normalized_reason in {"required_missing", "required_empty"}:
            return f"Provide required value for '{field}'."
        if normalized_reason == "type_mismatch":
            if normalized_type:
                return f"Use value compatible with type '{normalized_type}' for '{field}'."
            return f"Use a valid value type for '{field}'."
        if normalized_reason == "validator_failed":
            if normalized_operator:
                if expected_value is not None:
                    return f"Adjust '{field}' to satisfy '{normalized_operator} {expected_value}'."
                return f"Adjust '{field}' to satisfy operator '{normalized_operator}'."
            return f"Adjust '{field}' to satisfy validation rule."
        if normalized_reason == "unique_conflict":
            return f"Use a unique value for '{field}'."
        return None

    @staticmethod
    def _source_payload(source: dict[str, Any] | None) -> dict[str, Any]:
        source_dict = source if isinstance(source, dict) else {}
        return {
            "source": str(source_dict.get("source") or "base_contract"),
            "capability_key": source_dict.get("capability_key"),
            "capability_id": source_dict.get("capability_id"),
        }

    @classmethod
    def _raise_contract_violation(
        cls,
        *,
        table_name: str,
        reason: str,
        message_suffix: str,
        mineral_key: str | None = None,
        actual_value: Any | None = None,
        expected_type: str | None = None,
        operator: str | None = None,
        expected_value: Any | None = None,
        rule_id: str | None = None,
        source: dict[str, Any] | None = None,
    ) -> None:
        message = f"Table contract violation [{table_name}]: {message_suffix}"
        expected_constraint = cls._build_expected_constraint(
            reason=reason,
            expected_type=expected_type,
            operator=operator,
            expected_value=expected_value,
        )
        repair_hint = cls._build_repair_hint(
            reason=reason,
            mineral_key=mineral_key,
            expected_type=expected_type,
            operator=operator,
            expected_value=expected_value,
        )
        detail: dict[str, Any] = {
            "code": "TABLE_CONTRACT_VIOLATION",
            "message": message,
            "table_name": table_name,
            "reason": reason,
            "mineral_key": mineral_key,
            "actual_value": actual_value,
            "expected_type": expected_type,
            "operator": operator,
            "expected_value": expected_value,
            "expected_constraint": expected_constraint,
            "repair_hint": repair_hint,
            "rule_id": rule_id,
        }
        detail.update(cls._source_payload(source))
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_CONTENT,
            detail=detail,
        )

    @staticmethod
    def _extract_contract_field(*, value: Any, metadata: dict[str, Any], field: str) -> Any:
        key = str(field).strip()
        if not key:
            return None
        if key == "value":
            return value
        if key == "label":
            if "label" in metadata:
                return metadata.get("label")
            return value
        if key == "state":
            if "state" in metadata:
                return metadata.get("state")
            return metadata.get("status")
        if key == "status":
            if "status" in metadata:
                return metadata.get("status")
            return metadata.get("state")
        return metadata.get(key)

    @staticmethod
    def _coerce_number(value: Any) -> float | None:
        if isinstance(value, bool):
            return None
        if isinstance(value, int | float):
            return float(value)
        if isinstance(value, str):
            normalized = value.strip().replace("\u00a0", "").replace(" ", "").replace(",", ".")
            if not normalized:
                return None
            try:
                return float(normalized)
            except ValueError:
                return None
        return None

    @staticmethod
    def _coerce_datetime(value: Any) -> datetime | None:
        if isinstance(value, datetime):
            return value
        if isinstance(value, str):
            candidate = value.strip()
            if not candidate:
                return None
            try:
                return datetime.fromisoformat(candidate.replace("Z", "+00:00"))
            except ValueError:
                return None
        return None

    @classmethod
    def _matches_expected_type(cls, expected: str, value: Any) -> bool:
        expected_type = str(expected).strip().lower()
        if expected_type in {"string", "str", "text"}:
            return isinstance(value, str)
        if expected_type in {"number", "float", "double", "decimal"}:
            return cls._coerce_number(value) is not None
        if expected_type in {"int", "integer"}:
            number = cls._coerce_number(value)
            return number is not None and float(number).is_integer()
        if expected_type in {"bool", "boolean"}:
            if isinstance(value, bool):
                return True
            if isinstance(value, str):
                return value.strip().lower() in {"true", "false", "1", "0", "yes", "no"}
            return False
        if expected_type in {"datetime", "timestamp", "timestamptz", "date"}:
            return cls._coerce_datetime(value) is not None
        if expected_type in {"object", "dict", "map"}:
            return isinstance(value, dict)
        if expected_type in {"array", "list"}:
            return isinstance(value, list)
        if expected_type in {"json", "any"}:
            return True
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_CONTENT,
            detail=f"Table contract uses unsupported field type '{expected_type}'",
        )

    @staticmethod
    def _normalize_unique_value(value: Any) -> Any:
        if isinstance(value, str):
            return value.strip()
        if isinstance(value, int | float | bool) or value is None:
            return value
        if isinstance(value, dict | list):
            return repr(value)
        return str(value)

    @classmethod
    def _passes_validator(cls, *, operator: str, field_value: Any, expected_value: Any) -> bool:
        op = str(operator).strip()
        left_number = cls._coerce_number(field_value)
        right_number = cls._coerce_number(expected_value)

        if op in {">", ">=", "<", "<="}:
            if left_number is None or right_number is None:
                raise HTTPException(
                    status_code=status.HTTP_422_UNPROCESSABLE_CONTENT,
                    detail=f"Table contract validator '{op}' requires numeric values",
                )
            if op == ">":
                return left_number > right_number
            if op == ">=":
                return left_number >= right_number
            if op == "<":
                return left_number < right_number
            return left_number <= right_number

        if op in {"==", "="}:
            return cls._normalize_unique_value(field_value) == cls._normalize_unique_value(expected_value)
        if op == "!=":
            return cls._normalize_unique_value(field_value) != cls._normalize_unique_value(expected_value)
        if op in {"semantic", "ui_semantic"}:
            return True

        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_CONTENT,
            detail=f"Table contract uses unsupported validator operator '{op}'",
        )

    async def load_latest(
        self,
        *,
        session: AsyncSession,
        galaxy_id: UUID,
        table_id: UUID,
        cache: dict[UUID, EffectiveTableContract | None],
    ) -> EffectiveTableContract | None:
        if table_id in cache:
            return cache[table_id]

        base_contract = (
            await session.execute(
                select(TableContract)
                .where(
                    and_(
                        TableContract.galaxy_id == galaxy_id,
                        TableContract.table_id == table_id,
                        TableContract.deleted_at.is_(None),
                    )
                )
                .order_by(TableContract.version.desc(), TableContract.created_at.desc(), TableContract.id.desc())
                .limit(1)
            )
        ).scalar_one_or_none()
        if base_contract is None:
            cache[table_id] = None
            return None

        capabilities = list(
            (
                await session.execute(
                    select(MoonCapability).where(
                        and_(
                            MoonCapability.galaxy_id == galaxy_id,
                            MoonCapability.table_id == table_id,
                            MoonCapability.deleted_at.is_(None),
                        )
                    )
                )
            )
            .scalars()
            .all()
        )
        effective = compile_effective_table_contract(
            base_contract=base_contract,
            capabilities=capabilities,
        )
        cache[table_id] = effective
        return effective

    async def validate_write(
        self,
        *,
        session: AsyncSession,
        galaxy_id: UUID,
        civilization_id: UUID | None,
        value: Any,
        metadata: dict[str, Any],
        asteroids_by_id: dict[UUID, ProjectedAsteroid],
        cache: dict[UUID, EffectiveTableContract | None],
    ) -> None:
        metadata_dict = metadata if isinstance(metadata, dict) else {}
        table_name = derive_table_name(value=value, metadata=metadata_dict)
        table_id = derive_table_id(galaxy_id=galaxy_id, table_name=table_name)
        contract = await self.load_latest(
            session=session,
            galaxy_id=galaxy_id,
            table_id=table_id,
            cache=cache,
        )
        if contract is None:
            return

        required_fields = contract.required_fields if isinstance(contract.required_fields, list) else []
        for required_field in required_fields:
            field_name = str(required_field).strip()
            if not field_name:
                continue
            field_value = self._extract_contract_field(value=value, metadata=metadata_dict, field=field_name)
            source = contract.required_field_sources.get(field_name)
            if field_value is None:
                self._raise_contract_violation(
                    table_name=table_name,
                    reason="required_missing",
                    message_suffix=f"required field '{field_name}' is missing",
                    mineral_key=field_name,
                    source=source,
                )
            if isinstance(field_value, str) and not field_value.strip():
                self._raise_contract_violation(
                    table_name=table_name,
                    reason="required_empty",
                    message_suffix=f"required field '{field_name}' is empty",
                    mineral_key=field_name,
                    actual_value=field_value,
                    source=source,
                )

        field_types = contract.field_types if isinstance(contract.field_types, dict) else {}
        for raw_field, raw_type in field_types.items():
            field_name = str(raw_field).strip()
            if not field_name:
                continue
            field_value = self._extract_contract_field(value=value, metadata=metadata_dict, field=field_name)
            if field_value is None:
                continue
            if not self._matches_expected_type(str(raw_type), field_value):
                expected = str(raw_type).strip().lower()
                self._raise_contract_violation(
                    table_name=table_name,
                    reason="type_mismatch",
                    message_suffix=f"field '{field_name}' must be '{expected}'",
                    mineral_key=field_name,
                    actual_value=field_value,
                    expected_type=expected,
                    source=contract.field_type_sources.get(field_name),
                )

        validators = contract.validators if isinstance(contract.validators, list) else []
        for validator_index, rule in enumerate(validators):
            if not isinstance(rule, dict):
                continue
            field_name = str(rule.get("field", "")).strip()
            operator = str(rule.get("operator", "")).strip()
            if not field_name or not operator:
                continue
            source = (
                contract.validator_sources[validator_index]
                if validator_index < len(contract.validator_sources)
                else None
            )
            rule_id = str(rule.get("id") or "").strip() or None
            expected_value = rule["value"] if "value" in rule else rule.get("threshold")
            field_value = self._extract_contract_field(value=value, metadata=metadata_dict, field=field_name)
            if field_value is None:
                continue
            if not self._passes_validator(operator=operator, field_value=field_value, expected_value=expected_value):
                self._raise_contract_violation(
                    table_name=table_name,
                    reason="validator_failed",
                    message_suffix=f"validator failed for field '{field_name}'",
                    mineral_key=field_name,
                    actual_value=field_value,
                    operator=operator,
                    expected_value=expected_value,
                    rule_id=rule_id,
                    source=source,
                )

        unique_rules = contract.unique_rules if isinstance(contract.unique_rules, list) else []
        for unique_index, rule in enumerate(unique_rules):
            if not isinstance(rule, dict):
                continue
            raw_fields = rule.get("fields")
            if isinstance(raw_fields, str):
                fields = [raw_fields]
            elif isinstance(raw_fields, list):
                fields = [str(item).strip() for item in raw_fields if str(item).strip()]
            else:
                fields = []
            if not fields:
                continue
            source = (
                contract.unique_rule_sources[unique_index] if unique_index < len(contract.unique_rule_sources) else None
            )
            rule_id = str(rule.get("id") or "").strip() or None

            candidate_signature = tuple(
                self._normalize_unique_value(
                    self._extract_contract_field(value=value, metadata=metadata_dict, field=field_name)
                )
                for field_name in fields
            )

            for other in asteroids_by_id.values():
                if civilization_id is not None and other.id == civilization_id:
                    continue

                other_table_name = derive_table_name(value=other.value, metadata=other.metadata)
                other_table_id = derive_table_id(galaxy_id=galaxy_id, table_name=other_table_name)
                if other_table_id != table_id:
                    continue

                other_signature = tuple(
                    self._normalize_unique_value(
                        self._extract_contract_field(value=other.value, metadata=other.metadata, field=field_name)
                    )
                    for field_name in fields
                )
                if other_signature == candidate_signature:
                    self._raise_contract_violation(
                        table_name=table_name,
                        reason="unique_conflict",
                        message_suffix=f"unique rule {fields} already exists",
                        mineral_key=",".join(fields),
                        actual_value=list(candidate_signature),
                        rule_id=rule_id,
                        source=source,
                    )
