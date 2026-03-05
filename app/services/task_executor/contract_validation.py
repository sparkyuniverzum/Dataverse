from __future__ import annotations

from datetime import datetime
from typing import Any
from uuid import UUID

from fastapi import HTTPException, status
from sqlalchemy import and_, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models import TableContract
from app.services.universe_service import ProjectedAsteroid, derive_table_id, derive_table_name


class TableContractValidator:
    @staticmethod
    def _extract_contract_field(*, value: Any, metadata: dict[str, Any], field: str) -> Any:
        key = str(field).strip()
        if not key:
            return None
        if key == "value":
            return value
        return metadata.get(key)

    @staticmethod
    def _coerce_number(value: Any) -> float | None:
        if isinstance(value, bool):
            return None
        if isinstance(value, (int, float)):
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
        if isinstance(value, (int, float, bool)) or value is None:
            return value
        if isinstance(value, (dict, list)):
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
        cache: dict[UUID, TableContract | None],
    ) -> TableContract | None:
        if table_id in cache:
            return cache[table_id]

        contract = (
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
        cache[table_id] = contract
        return contract

    async def validate_write(
        self,
        *,
        session: AsyncSession,
        galaxy_id: UUID,
        asteroid_id: UUID | None,
        value: Any,
        metadata: dict[str, Any],
        asteroids_by_id: dict[UUID, ProjectedAsteroid],
        cache: dict[UUID, TableContract | None],
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
            if field_value is None:
                raise HTTPException(
                    status_code=status.HTTP_422_UNPROCESSABLE_CONTENT,
                    detail=f"Table contract violation [{table_name}]: required field '{field_name}' is missing",
                )
            if isinstance(field_value, str) and not field_value.strip():
                raise HTTPException(
                    status_code=status.HTTP_422_UNPROCESSABLE_CONTENT,
                    detail=f"Table contract violation [{table_name}]: required field '{field_name}' is empty",
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
                raise HTTPException(
                    status_code=status.HTTP_422_UNPROCESSABLE_CONTENT,
                    detail=f"Table contract violation [{table_name}]: field '{field_name}' must be '{str(raw_type).strip().lower()}'",
                )

        validators = contract.validators if isinstance(contract.validators, list) else []
        for rule in validators:
            if not isinstance(rule, dict):
                continue
            field_name = str(rule.get("field", "")).strip()
            operator = str(rule.get("operator", "")).strip()
            if not field_name or not operator:
                continue
            expected_value = rule["value"] if "value" in rule else rule.get("threshold")
            field_value = self._extract_contract_field(value=value, metadata=metadata_dict, field=field_name)
            if field_value is None:
                continue
            if not self._passes_validator(operator=operator, field_value=field_value, expected_value=expected_value):
                raise HTTPException(
                    status_code=status.HTTP_422_UNPROCESSABLE_CONTENT,
                    detail=f"Table contract violation [{table_name}]: validator failed for field '{field_name}'",
                )

        unique_rules = contract.unique_rules if isinstance(contract.unique_rules, list) else []
        for rule in unique_rules:
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

            candidate_signature = tuple(
                self._normalize_unique_value(
                    self._extract_contract_field(value=value, metadata=metadata_dict, field=field_name)
                )
                for field_name in fields
            )

            for other in asteroids_by_id.values():
                if asteroid_id is not None and other.id == asteroid_id:
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
                    raise HTTPException(
                        status_code=status.HTTP_422_UNPROCESSABLE_CONTENT,
                        detail=f"Table contract violation [{table_name}]: unique rule {fields} already exists",
                    )
