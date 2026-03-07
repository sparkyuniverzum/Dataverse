from __future__ import annotations

import re
from collections import defaultdict
from collections.abc import Iterable, Mapping
from dataclasses import dataclass
from datetime import UTC, datetime
from decimal import Decimal, InvalidOperation
from typing import Any
from uuid import UUID

from sqlalchemy import and_, select, update
from sqlalchemy.dialects.postgresql import insert
from sqlalchemy.ext.asyncio import AsyncSession

from app.models import CalcStateRM, TableContract
from app.services.bond_semantics import normalize_bond_type
from app.services.universe_service import derive_table_id, derive_table_name

_FORMULA_RE = re.compile(r"^\s*=?\s*(SUM|AVG|MIN|MAX|COUNT)\s*\(\s*([^)]+)\s*\)\s*$", re.IGNORECASE)


@dataclass(frozen=True)
class FormulaSpec:
    op: str
    source_attr: str


@dataclass(frozen=True)
class FormulaError:
    field: str
    code: str
    message: str


class CalcEngineService:
    """Deterministic calc projection using flow semantics and typed math.

    Stage 2 rules:
    - cross-node aggregation uses FLOW edges only
    - numeric math uses Decimal internally
    - formula_registry is primary formula source (metadata formulas are fallback)
    - invalid formulas emit deterministic error codes
    """

    def __init__(self, *, engine_version: str = "calc-v2") -> None:
        self.engine_version = str(engine_version).strip() or "calc-v2"

    @staticmethod
    def _to_uuid(value: Any) -> UUID | None:
        if isinstance(value, UUID):
            return value
        try:
            return UUID(str(value))
        except (TypeError, ValueError):
            return None

    @staticmethod
    def _to_decimal(value: Any) -> Decimal | None:
        if isinstance(value, bool) or value is None:
            return None
        if isinstance(value, Decimal):
            return value
        if isinstance(value, int):
            return Decimal(value)
        if isinstance(value, float):
            return Decimal(str(value))
        if isinstance(value, str):
            normalized = value.strip().replace("\u00a0", "").replace(" ", "").replace(",", ".")
            if not normalized:
                return None
            try:
                return Decimal(normalized)
            except InvalidOperation:
                return None
        return None

    @staticmethod
    def _finalize_decimal(value: Decimal) -> int | float:
        normalized = value.normalize()
        if normalized == normalized.to_integral():
            return int(normalized)
        return float(normalized)

    @staticmethod
    def _count_circular_fields(calculated_values: Mapping[str, Any]) -> int:
        return sum(1 for value in calculated_values.values() if value == "#CIRC!")

    @staticmethod
    def _error_marker(code: str) -> str:
        return f"#ERR:{code}"

    @classmethod
    def _parse_formula_expression(cls, expression: str) -> tuple[FormulaSpec | None, FormulaError | None]:
        normalized = str(expression or "").strip()
        if not normalized:
            return None, FormulaError(field="", code="FORMULA_EMPTY", message="Formula expression is empty")

        match = _FORMULA_RE.match(normalized)
        if not match:
            return None, FormulaError(
                field="",
                code="FORMULA_PARSE_ERROR",
                message="Formula must use FUNC(attr) with supported ops SUM/AVG/MIN/MAX/COUNT",
            )

        op = str(match.group(1) or "").strip().upper()
        source_attr = str(match.group(2) or "").strip()
        if not source_attr:
            return None, FormulaError(
                field="", code="FORMULA_SOURCE_ATTR_MISSING", message="Formula source attribute is empty"
            )

        if op not in {"SUM", "AVG", "MIN", "MAX", "COUNT"}:
            return None, FormulaError(
                field="", code="FORMULA_UNSUPPORTED_OP", message=f"Unsupported formula operation '{op}'"
            )

        return FormulaSpec(op=op, source_attr=source_attr), None

    @staticmethod
    def _extract_registry_target_field(target: Any) -> str:
        text = str(target or "").strip()
        if not text:
            return ""
        if "." in text:
            return text.split(".")[-1].strip()
        return text

    def _registry_formulas_for_table(
        self, contract: Mapping[str, Any] | None
    ) -> tuple[dict[str, FormulaSpec], list[FormulaError]]:
        formulas: dict[str, FormulaSpec] = {}
        errors: list[FormulaError] = []
        if not isinstance(contract, Mapping):
            return formulas, errors

        raw_registry = contract.get("formula_registry")
        registry = raw_registry if isinstance(raw_registry, list) else []
        for raw in registry:
            if not isinstance(raw, Mapping):
                continue
            if raw.get("enabled", True) is False:
                continue

            field = self._extract_registry_target_field(raw.get("target"))
            expression = str(raw.get("expression") or "").strip()
            if not field:
                errors.append(
                    FormulaError(
                        field="",
                        code="FORMULA_TARGET_MISSING",
                        message="Formula registry entry has empty target field",
                    )
                )
                continue

            parsed, parse_error = self._parse_formula_expression(expression)
            if parse_error is not None:
                errors.append(FormulaError(field=field, code=parse_error.code, message=parse_error.message))
                continue

            formulas[field] = parsed

        return formulas, errors

    async def _load_latest_contracts(
        self,
        *,
        session: AsyncSession,
        galaxy_id: UUID,
        table_ids: set[UUID],
    ) -> dict[UUID, dict[str, Any]]:
        if not table_ids:
            return {}

        rows = list(
            (
                await session.execute(
                    select(TableContract)
                    .where(
                        and_(
                            TableContract.galaxy_id == galaxy_id,
                            TableContract.table_id.in_(table_ids),
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
            )
            .scalars()
            .all()
        )

        latest_by_table: dict[UUID, dict[str, Any]] = {}
        for row in rows:
            if row.table_id in latest_by_table:
                continue
            latest_by_table[row.table_id] = {
                "formula_registry": row.formula_registry if isinstance(row.formula_registry, list) else [],
            }
        return latest_by_table

    def evaluate_atoms(
        self,
        *,
        galaxy_id: UUID,
        atoms: Iterable[Any],
        bonds: Iterable[Any],
        contracts_by_table_id: Mapping[UUID, Mapping[str, Any]] | None,
    ) -> list[dict[str, Any]]:
        contracts = contracts_by_table_id if isinstance(contracts_by_table_id, Mapping) else {}

        nodes: dict[UUID, dict[str, Any]] = {}
        flow_incoming: dict[UUID, set[UUID]] = defaultdict(set)

        for atom in atoms:
            asteroid_id = self._to_uuid(getattr(atom, "id", None))
            if asteroid_id is None:
                continue
            metadata = getattr(atom, "metadata_", {})
            metadata_dict = metadata if isinstance(metadata, dict) else {}
            value = getattr(atom, "value", None)
            table_name = derive_table_name(value=value, metadata=metadata_dict)
            table_id = derive_table_id(galaxy_id=galaxy_id, table_name=table_name)

            registry_formulas, registry_errors = self._registry_formulas_for_table(contracts.get(table_id))
            nodes[asteroid_id] = {
                "id": asteroid_id,
                "value": value,
                "metadata": dict(metadata_dict),
                "created_at": getattr(atom, "created_at", None),
                "table_id": table_id,
                "registry_formulas": registry_formulas,
                "registry_errors": registry_errors,
            }

        active_ids = set(nodes.keys())
        for bond in bonds:
            source_civilization_id = self._to_uuid(getattr(bond, "source_civilization_id", None))
            target_civilization_id = self._to_uuid(getattr(bond, "target_civilization_id", None))
            if source_civilization_id is None or target_civilization_id is None:
                continue
            if source_civilization_id not in active_ids or target_civilization_id not in active_ids:
                continue
            bond_type = normalize_bond_type(getattr(bond, "type", "RELATION"))
            if bond_type != "FLOW":
                continue
            flow_incoming[target_civilization_id].add(source_civilization_id)

        cache: dict[tuple[UUID, str], Any] = {}
        error_map: dict[UUID, list[FormulaError]] = {
            node_id: list(node["registry_errors"]) for node_id, node in nodes.items()
        }
        error_signatures: dict[UUID, set[tuple[str, str, str]]] = {
            node_id: {(error.field, error.code, error.message) for error in errors}
            for node_id, errors in error_map.items()
        }

        def add_error(node_id: UUID, *, field: str, code: str, message: str) -> None:
            signature = (field, code, message)
            signatures = error_signatures.setdefault(node_id, set())
            if signature in signatures:
                return
            signatures.add(signature)
            error_map.setdefault(node_id, []).append(FormulaError(field=field, code=code, message=message))

        def formula_for(node_id: UUID, field: str) -> FormulaSpec | None:
            node = nodes[node_id]
            registry_formulas = node["registry_formulas"]
            if field in registry_formulas:
                return registry_formulas[field]

            raw = node["metadata"].get(field)
            if not (isinstance(raw, str) and raw.strip().startswith("=")):
                return None
            parsed, parse_error = self._parse_formula_expression(raw)
            if parse_error is not None:
                add_error(node_id, field=field, code=parse_error.code, message=parse_error.message)
                return FormulaSpec(op="SUM", source_attr="")
            return parsed

        def aggregate(spec: FormulaSpec, numbers: list[Decimal]) -> int | float:
            if spec.op == "SUM":
                return self._finalize_decimal(sum(numbers, Decimal(0)))
            if spec.op == "AVG":
                if not numbers:
                    return 0
                return self._finalize_decimal(sum(numbers, Decimal(0)) / Decimal(len(numbers)))
            if spec.op == "MIN":
                return self._finalize_decimal(min(numbers)) if numbers else 0
            if spec.op == "MAX":
                return self._finalize_decimal(max(numbers)) if numbers else 0
            if spec.op == "COUNT":
                return len(numbers)
            return 0

        def resolve_field(node_id: UUID, field: str, stack: set[tuple[UUID, str]]) -> Any:
            key = (node_id, field)
            if key in cache:
                return cache[key]
            if key in stack:
                cache[key] = "#CIRC!"
                return "#CIRC!"

            node = nodes[node_id]
            next_stack = set(stack)
            next_stack.add(key)

            spec = formula_for(node_id, field)
            if spec is None:
                raw = node["metadata"].get(field)
                dec = self._to_decimal(raw)
                value = self._finalize_decimal(dec) if dec is not None else raw
                cache[key] = value
                return value

            if not spec.source_attr:
                marker = self._error_marker("FORMULA_SOURCE_ATTR_MISSING")
                add_error(
                    node_id,
                    field=field,
                    code="FORMULA_SOURCE_ATTR_MISSING",
                    message="Formula source attribute is empty",
                )
                cache[key] = marker
                return marker

            numbers: list[Decimal] = []
            has_circular = False
            for source_civilization_id in sorted(flow_incoming.get(node_id, set()), key=lambda item: str(item)):
                source_value = resolve_field(source_civilization_id, spec.source_attr, next_stack)
                if source_value == "#CIRC!":
                    has_circular = True
                    continue
                if isinstance(source_value, str) and source_value.startswith("#ERR:"):
                    continue
                dec = self._to_decimal(source_value)
                if dec is not None:
                    numbers.append(dec)

            result = "#CIRC!" if has_circular else aggregate(spec, numbers)
            cache[key] = result
            return result

        evaluated: list[dict[str, Any]] = []
        for node_id, node in nodes.items():
            fields = set(node["metadata"].keys()) | set(node["registry_formulas"].keys())
            calculated_values: dict[str, Any] = {}
            for field in sorted(fields):
                calculated_values[field] = resolve_field(node_id, field, set())

            errors = error_map.get(node_id, [])
            evaluated.append(
                {
                    "id": node_id,
                    "value": node["value"],
                    "metadata": dict(node["metadata"]),
                    "calculated_values": calculated_values,
                    "created_at": node["created_at"],
                    "calc_errors": [
                        {
                            "field": error.field,
                            "code": error.code,
                            "message": error.message,
                        }
                        for error in errors
                    ],
                }
            )

        return evaluated

    @classmethod
    def build_calc_rows(cls, evaluated_atoms: Iterable[Mapping[str, Any]]) -> list[dict[str, Any]]:
        rows: list[dict[str, Any]] = []
        for asteroid in evaluated_atoms:
            asteroid_id = cls._to_uuid(asteroid.get("id"))
            if asteroid_id is None:
                continue

            calculated_values = asteroid.get("calculated_values")
            if not isinstance(calculated_values, dict):
                calculated_values = {}
            calc_errors = asteroid.get("calc_errors")
            if not isinstance(calc_errors, list):
                calc_errors = []

            rows.append(
                {
                    "asteroid_id": asteroid_id,
                    "calculated_values": dict(calculated_values),
                    "calc_errors": [item for item in calc_errors if isinstance(item, dict)],
                    "error_count": len([item for item in calc_errors if isinstance(item, dict)]),
                    "circular_fields_count": cls._count_circular_fields(calculated_values),
                }
            )
        return rows

    async def apply_projection(
        self,
        *,
        session: AsyncSession,
        user_id: UUID,
        galaxy_id: UUID,
        source_event_seq: int,
        evaluated_atoms: Iterable[Mapping[str, Any]],
        active_asteroid_ids: set[UUID],
    ) -> None:
        now = datetime.now(UTC)
        normalized_source_seq = max(0, int(source_event_seq))

        rows = self.build_calc_rows(evaluated_atoms)
        for row in rows:
            stmt = insert(CalcStateRM).values(
                user_id=user_id,
                galaxy_id=galaxy_id,
                asteroid_id=row["asteroid_id"],
                source_event_seq=normalized_source_seq,
                engine_version=self.engine_version,
                calculated_values=row["calculated_values"],
                calc_errors=row["calc_errors"],
                error_count=row["error_count"],
                circular_fields_count=row["circular_fields_count"],
                updated_at=now,
                deleted_at=None,
            )
            stmt = stmt.on_conflict_do_update(
                index_elements=[CalcStateRM.user_id, CalcStateRM.galaxy_id, CalcStateRM.asteroid_id],
                set_={
                    "source_event_seq": normalized_source_seq,
                    "engine_version": self.engine_version,
                    "calculated_values": row["calculated_values"],
                    "calc_errors": row["calc_errors"],
                    "error_count": row["error_count"],
                    "circular_fields_count": row["circular_fields_count"],
                    "updated_at": now,
                    "deleted_at": None,
                },
            )
            await session.execute(stmt)

        if active_asteroid_ids:
            stale_where = and_(
                CalcStateRM.user_id == user_id,
                CalcStateRM.galaxy_id == galaxy_id,
                CalcStateRM.deleted_at.is_(None),
                CalcStateRM.asteroid_id.notin_(active_asteroid_ids),
            )
        else:
            stale_where = and_(
                CalcStateRM.user_id == user_id,
                CalcStateRM.galaxy_id == galaxy_id,
                CalcStateRM.deleted_at.is_(None),
            )

        await session.execute(
            update(CalcStateRM)
            .where(stale_where)
            .values(
                source_event_seq=normalized_source_seq,
                engine_version=self.engine_version,
                updated_at=now,
                deleted_at=now,
            )
        )

    async def evaluate_and_project(
        self,
        *,
        session: AsyncSession,
        user_id: UUID,
        galaxy_id: UUID,
        source_event_seq: int,
        atoms: Iterable[Any],
        bonds: Iterable[Any],
    ) -> list[dict[str, Any]]:
        atom_list = list(atoms)
        bond_list = list(bonds)
        active_asteroid_ids = {
            asteroid_id
            for asteroid_id in (self._to_uuid(getattr(atom, "id", None)) for atom in atom_list)
            if asteroid_id is not None
        }

        table_ids: set[UUID] = set()
        for atom in atom_list:
            metadata = getattr(atom, "metadata_", {})
            metadata_dict = metadata if isinstance(metadata, dict) else {}
            value = getattr(atom, "value", None)
            table_name = derive_table_name(value=value, metadata=metadata_dict)
            table_ids.add(derive_table_id(galaxy_id=galaxy_id, table_name=table_name))

        contracts_by_table_id = await self._load_latest_contracts(
            session=session,
            galaxy_id=galaxy_id,
            table_ids=table_ids,
        )

        evaluated = self.evaluate_atoms(
            galaxy_id=galaxy_id,
            atoms=atom_list,
            bonds=bond_list,
            contracts_by_table_id=contracts_by_table_id,
        )

        await self.apply_projection(
            session=session,
            user_id=user_id,
            galaxy_id=galaxy_id,
            source_event_seq=source_event_seq,
            evaluated_atoms=evaluated,
            active_asteroid_ids=active_asteroid_ids,
        )

        return evaluated
