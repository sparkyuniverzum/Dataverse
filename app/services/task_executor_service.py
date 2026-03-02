from __future__ import annotations

from contextlib import asynccontextmanager
from dataclasses import dataclass, field
from hashlib import blake2b
from typing import Any
from uuid import UUID, uuid4

from fastapi import HTTPException, status
from sqlalchemy import and_, func, or_, select, text as sql_text
from sqlalchemy.ext.asyncio import AsyncSession

from app.models import Bond, Event, TableContract
from app.services.bond_semantics import normalize_bond_type
from app.services.event_store_service import EventStoreService
from app.services.parser_service import AtomicTask
from app.services.read_model_projector import ReadModelProjector
from app.services.universe_service import (
    DEFAULT_GALAXY_ID,
    ProjectedAsteroid,
    ProjectedBond,
    UniverseService,
    derive_table_id,
    derive_table_name,
)


@dataclass
class TaskExecutionResult:
    asteroids: list[ProjectedAsteroid] = field(default_factory=list)
    bonds: list[ProjectedBond] = field(default_factory=list)
    selected_asteroids: list[ProjectedAsteroid] = field(default_factory=list)
    extinguished_asteroids: list[ProjectedAsteroid] = field(default_factory=list)
    extinguished_asteroid_ids: list[UUID] = field(default_factory=list)
    extinguished_bond_ids: list[UUID] = field(default_factory=list)


class TaskExecutorService:
    def __init__(
        self,
        *,
        event_store: EventStoreService | None = None,
        universe_service: UniverseService | None = None,
        read_model_projector: ReadModelProjector | None = None,
    ) -> None:
        self.event_store = event_store or EventStoreService()
        self.universe_service = universe_service or UniverseService(event_store=self.event_store)
        self.read_model_projector = read_model_projector or ReadModelProjector()

    @staticmethod
    def _bond_lock_key(
        *,
        user_id: UUID,
        galaxy_id: UUID,
        source_id: UUID,
        target_id: UUID,
        bond_type: str,
    ) -> int:
        digest = blake2b(
            f"{user_id}:{galaxy_id}:{source_id}:{target_id}:{bond_type}".encode("utf-8"),
            digest_size=8,
        ).digest()
        return int.from_bytes(digest, byteorder="big", signed=True)

    @staticmethod
    def _occ_scope_lock_key(
        *,
        user_id: UUID,
        galaxy_id: UUID,
        branch_id: UUID | None,
    ) -> int:
        branch_scope = str(branch_id) if branch_id is not None else "main"
        digest = blake2b(
            f"occ:{user_id}:{galaxy_id}:{branch_scope}".encode("utf-8"),
            digest_size=8,
        ).digest()
        return int.from_bytes(digest, byteorder="big", signed=True)

    @staticmethod
    def _to_projected_bond(bond: Bond, *, current_event_seq: int = 0) -> ProjectedBond:
        return ProjectedBond(
            id=bond.id,
            source_id=bond.source_id,
            target_id=bond.target_id,
            type=normalize_bond_type(bond.type),
            is_deleted=bond.is_deleted,
            created_at=bond.created_at,
            deleted_at=bond.deleted_at,
            current_event_seq=current_event_seq,
        )

    @staticmethod
    def _value_to_text(value: object) -> str:
        if isinstance(value, str):
            return value
        return str(value)

    @staticmethod
    def _find_asteroid_by_target(
        asteroids: list[ProjectedAsteroid],
        target: str,
    ) -> ProjectedAsteroid | None:
        normalized = target.strip().lower()
        if not normalized:
            return None

        try:
            target_id = UUID(target.strip())
        except ValueError:
            target_id = None

        if target_id is not None:
            for asteroid in asteroids:
                if asteroid.id == target_id:
                    return asteroid

        for asteroid in asteroids:
            if TaskExecutorService._value_to_text(asteroid.value).strip().lower() == normalized:
                return asteroid

        for asteroid in asteroids:
            if normalized in TaskExecutorService._value_to_text(asteroid.value).lower():
                return asteroid
        return None

    @staticmethod
    def _resolve_single_asteroid_by_target(
        asteroids: list[ProjectedAsteroid],
        target: str,
    ) -> ProjectedAsteroid | None:
        normalized = str(target or "").strip()
        if not normalized:
            return None

        target_uuid = TaskExecutorService._parse_uuid(normalized)
        if target_uuid is not None:
            for asteroid in asteroids:
                if asteroid.id == target_uuid:
                    return asteroid
            return None

        lowered = normalized.lower()
        exact_matches = [
            asteroid
            for asteroid in asteroids
            if TaskExecutorService._value_to_text(asteroid.value).strip().lower() == lowered
        ]
        if len(exact_matches) == 1:
            return exact_matches[0]
        if len(exact_matches) > 1:
            raise HTTPException(
                status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
                detail=f"Ambiguous target '{target}' (multiple exact matches)",
            )

        contains_matches = [
            asteroid
            for asteroid in asteroids
            if lowered in TaskExecutorService._value_to_text(asteroid.value).lower()
        ]
        if len(contains_matches) == 1:
            return contains_matches[0]
        if len(contains_matches) > 1:
            raise HTTPException(
                status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
                detail=f"Ambiguous target '{target}' (multiple partial matches)",
            )
        return None

    @staticmethod
    def _parse_uuid(value: object) -> UUID | None:
        if value is None:
            return None
        try:
            return UUID(str(value))
        except (TypeError, ValueError):
            return None

    @staticmethod
    def _parse_expected_event_seq(value: object, *, field_name: str) -> int | None:
        if value is None:
            return None
        try:
            parsed = int(str(value).strip())
        except (TypeError, ValueError):
            raise HTTPException(
                status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
                detail=f"{field_name} must be a non-negative integer",
            ) from None
        if parsed < 0:
            raise HTTPException(
                status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
                detail=f"{field_name} must be a non-negative integer",
            )
        return parsed

    @staticmethod
    def _find_asteroids_by_target(
        asteroids: list[ProjectedAsteroid],
        target: str,
        condition: str | None,
    ) -> list[ProjectedAsteroid]:
        target_norm = target.strip().lower()
        condition_norm = condition.strip().lower() if condition else None
        selected: list[ProjectedAsteroid] = []
        for asteroid in asteroids:
            label = TaskExecutorService._value_to_text(asteroid.value).lower()
            if target_norm not in label:
                continue
            if condition_norm and condition_norm not in label:
                continue
            selected.append(asteroid)
        return selected

    async def _current_entity_event_seq(
        self,
        *,
        session: AsyncSession,
        user_id: UUID,
        galaxy_id: UUID,
        branch_id: UUID | None,
        entity_id: UUID,
    ) -> int:
        stmt = select(func.max(Event.event_seq)).where(
            Event.user_id == user_id,
            Event.galaxy_id == galaxy_id,
            Event.entity_id == entity_id,
        )
        if branch_id is None:
            stmt = stmt.where(Event.branch_id.is_(None))
        else:
            stmt = stmt.where(Event.branch_id == branch_id)
        latest = (await session.execute(stmt)).scalar_one_or_none()
        return int(latest or 0)

    async def _enforce_expected_entity_event_seq(
        self,
        *,
        session: AsyncSession,
        user_id: UUID,
        galaxy_id: UUID,
        branch_id: UUID | None,
        entity_id: UUID,
        expected_event_seq: int | None,
        context: str,
    ) -> None:
        if expected_event_seq is None:
            return
        # Serialize OCC checks per user+galaxy+branch scope so check+append behaves atomically under parallel writes.
        lock_key = self._occ_scope_lock_key(
            user_id=user_id,
            galaxy_id=galaxy_id,
            branch_id=branch_id,
        )
        await session.execute(sql_text("SELECT pg_advisory_xact_lock(:key)"), {"key": lock_key})
        current_event_seq = await self._current_entity_event_seq(
            session=session,
            user_id=user_id,
            galaxy_id=galaxy_id,
            branch_id=branch_id,
            entity_id=entity_id,
        )
        if current_event_seq != expected_event_seq:
            raise HTTPException(
                status_code=status.HTTP_409_CONFLICT,
                detail={
                    "code": "OCC_CONFLICT",
                    "message": f"OCC conflict for {context}",
                    "context": context,
                    "entity_id": str(entity_id),
                    "expected_event_seq": expected_event_seq,
                    "current_event_seq": current_event_seq,
                },
            )

    @staticmethod
    def _canonical_relation_pair(source_id: UUID, target_id: UUID) -> tuple[UUID, UUID]:
        if source_id.hex <= target_id.hex:
            return source_id, target_id
        return target_id, source_id

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
            normalized = value.strip().replace("\u00A0", "").replace(" ", "").replace(",", ".")
            if not normalized:
                return None
            try:
                return float(normalized)
            except ValueError:
                return None
        return None

    @staticmethod
    def _matches_expected_type(expected: str, value: Any) -> bool:
        expected_type = str(expected).strip().lower()
        if expected_type in {"string", "str", "text"}:
            return isinstance(value, str)
        if expected_type in {"number", "float", "double", "decimal"}:
            return TaskExecutorService._coerce_number(value) is not None
        if expected_type in {"int", "integer"}:
            number = TaskExecutorService._coerce_number(value)
            return number is not None and float(number).is_integer()
        if expected_type in {"bool", "boolean"}:
            if isinstance(value, bool):
                return True
            if isinstance(value, str):
                return value.strip().lower() in {"true", "false", "1", "0", "yes", "no"}
            return False
        if expected_type in {"object", "dict", "map"}:
            return isinstance(value, dict)
        if expected_type in {"array", "list"}:
            return isinstance(value, list)
        if expected_type in {"json", "any"}:
            return True
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
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

    @staticmethod
    def _passes_validator(*, operator: str, field_value: Any, expected_value: Any) -> bool:
        op = str(operator).strip()
        left_number = TaskExecutorService._coerce_number(field_value)
        right_number = TaskExecutorService._coerce_number(expected_value)

        if op in {">", ">=", "<", "<="}:
            if left_number is None or right_number is None:
                raise HTTPException(
                    status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
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
            return TaskExecutorService._normalize_unique_value(field_value) == TaskExecutorService._normalize_unique_value(expected_value)
        if op == "!=":
            return TaskExecutorService._normalize_unique_value(field_value) != TaskExecutorService._normalize_unique_value(expected_value)

        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail=f"Table contract uses unsupported validator operator '{op}'",
        )

    async def _load_latest_table_contract(
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

    async def _validate_table_contract_write(
        self,
        *,
        session: AsyncSession,
        galaxy_id: UUID,
        asteroid_id: UUID | None,
        value: Any,
        metadata: dict[str, Any],
        asteroids_by_id: dict[UUID, ProjectedAsteroid],
        contract_cache: dict[UUID, TableContract | None],
    ) -> None:
        metadata_dict = metadata if isinstance(metadata, dict) else {}
        table_name = derive_table_name(value=value, metadata=metadata_dict)
        table_id = derive_table_id(galaxy_id=galaxy_id, table_name=table_name)
        contract = await self._load_latest_table_contract(
            session=session,
            galaxy_id=galaxy_id,
            table_id=table_id,
            cache=contract_cache,
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
                    status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
                    detail=f"Table contract violation [{table_name}]: required field '{field_name}' is missing",
                )
            if isinstance(field_value, str) and not field_value.strip():
                raise HTTPException(
                    status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
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
                    status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
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
                    status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
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
                        status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
                        detail=f"Table contract violation [{table_name}]: unique rule {fields} already exists",
                    )

    async def execute_tasks(
        self,
        session: AsyncSession,
        *,
        tasks: list[AtomicTask],
        user_id: UUID,
        galaxy_id: UUID = DEFAULT_GALAXY_ID,
        branch_id: UUID | None = None,
        manage_transaction: bool = True,
    ) -> TaskExecutionResult:
        result = TaskExecutionResult()
        context_asteroid_ids: list[UUID] = []

        active_asteroids, active_bonds = await self.universe_service.project_state(
            session=session,
            user_id=user_id,
            galaxy_id=galaxy_id,
            branch_id=branch_id,
            apply_calculations=False,
        )
        asteroids_by_id: dict[UUID, ProjectedAsteroid] = {a.id: a for a in active_asteroids}
        bonds_by_id: dict[UUID, ProjectedBond] = {b.id: b for b in active_bonds}
        contract_cache: dict[UUID, TableContract | None] = {}

        if not manage_transaction and not session.in_transaction():
            raise HTTPException(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                detail="TaskExecutor requires an active transaction when manage_transaction=False",
            )

        @asynccontextmanager
        async def _no_transaction():
            yield

        async def append_and_project_event(
            *,
            entity_id: UUID,
            event_type: str,
            payload: dict,
        ):
            event = await self.event_store.append_event(
                session=session,
                user_id=user_id,
                galaxy_id=galaxy_id,
                branch_id=branch_id,
                entity_id=entity_id,
                event_type=event_type,
                payload=payload,
            )
            appended_events.append(event)
            return event

        transaction_ctx = (
            session.begin_nested() if session.in_transaction() else session.begin()
        ) if manage_transaction else _no_transaction()
        async with transaction_ctx:
            appended_events = []
            for task in tasks:
                action = task.action.upper()

                if action == "INGEST":
                    if "value" not in task.params:
                        raise HTTPException(
                            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
                            detail="INGEST task requires value",
                        )
                    value = task.params["value"]
                    raw_metadata = task.params.get("metadata")
                    metadata = raw_metadata if isinstance(raw_metadata, dict) else {}

                    existing = next(
                        (
                            asteroid
                            for asteroid in asteroids_by_id.values()
                            if asteroid.value == value and not asteroid.is_deleted
                        ),
                        None,
                    )

                    if existing is None:
                        await self._validate_table_contract_write(
                            session=session,
                            galaxy_id=galaxy_id,
                            asteroid_id=None,
                            value=value,
                            metadata=dict(metadata),
                            asteroids_by_id=asteroids_by_id,
                            contract_cache=contract_cache,
                        )
                        asteroid_id = uuid4()
                        created_event = await append_and_project_event(
                            entity_id=asteroid_id,
                            event_type="ASTEROID_CREATED",
                            payload={"value": value, "metadata": metadata},
                        )
                        asteroid = ProjectedAsteroid(
                            id=asteroid_id,
                            value=value,
                            metadata=dict(metadata),
                            is_deleted=False,
                            created_at=created_event.timestamp,
                            deleted_at=None,
                            current_event_seq=int(created_event.event_seq),
                        )
                        asteroids_by_id[asteroid.id] = asteroid
                    else:
                        asteroid = existing
                        metadata_update = {k: v for k, v in metadata.items() if asteroid.metadata.get(k) != v}
                        if metadata_update:
                            next_metadata = {**asteroid.metadata, **metadata_update}
                            await self._validate_table_contract_write(
                                session=session,
                                galaxy_id=galaxy_id,
                                asteroid_id=asteroid.id,
                                value=asteroid.value,
                                metadata=next_metadata,
                                asteroids_by_id=asteroids_by_id,
                                contract_cache=contract_cache,
                            )
                            metadata_event = await append_and_project_event(
                                entity_id=asteroid.id,
                                event_type="METADATA_UPDATED",
                                payload={"metadata": metadata_update},
                            )
                            asteroid.current_event_seq = int(metadata_event.event_seq)
                            asteroid.metadata = next_metadata

                    context_asteroid_ids.append(asteroid.id)
                    result.asteroids.append(asteroid)
                    continue

                if action == "LINK":
                    source_id = task.params.get("source_id")
                    target_id = task.params.get("target_id")
                    if source_id is None or target_id is None:
                        if len(context_asteroid_ids) < 2:
                            raise HTTPException(
                                status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
                                detail="LINK task requires source_id/target_id or two previous INGEST tasks",
                            )
                        source_id = context_asteroid_ids[-2]
                        target_id = context_asteroid_ids[-1]

                    source_uuid = UUID(str(source_id))
                    target_uuid = UUID(str(target_id))
                    if source_uuid == target_uuid:
                        raise HTTPException(
                            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
                            detail="source_id and target_id must be different",
                        )
                    if source_uuid not in asteroids_by_id:
                        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Source asteroid not found")
                    if target_uuid not in asteroids_by_id:
                        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Target asteroid not found")

                    expected_source_event_seq = self._parse_expected_event_seq(
                        task.params.get("expected_source_event_seq"),
                        field_name="expected_source_event_seq",
                    )
                    expected_target_event_seq = self._parse_expected_event_seq(
                        task.params.get("expected_target_event_seq"),
                        field_name="expected_target_event_seq",
                    )
                    await self._enforce_expected_entity_event_seq(
                        session=session,
                        user_id=user_id,
                        galaxy_id=galaxy_id,
                        branch_id=branch_id,
                        entity_id=source_uuid,
                        expected_event_seq=expected_source_event_seq,
                        context=f"LINK source {source_uuid}",
                    )
                    await self._enforce_expected_entity_event_seq(
                        session=session,
                        user_id=user_id,
                        galaxy_id=galaxy_id,
                        branch_id=branch_id,
                        entity_id=target_uuid,
                        expected_event_seq=expected_target_event_seq,
                        context=f"LINK target {target_uuid}",
                    )

                    bond_type = normalize_bond_type(task.params.get("type", "RELATION"))
                    is_relation = bond_type == "RELATION"
                    if is_relation:
                        source_uuid, target_uuid = self._canonical_relation_pair(source_uuid, target_uuid)
                    existing_bond = next(
                        (
                            bond
                            for bond in bonds_by_id.values()
                            if str(bond.type or "").upper() == bond_type
                            and (
                                (bond.source_id == source_uuid and bond.target_id == target_uuid)
                                or (
                                    is_relation
                                    and bond.source_id == target_uuid
                                    and bond.target_id == source_uuid
                                )
                            )
                        ),
                        None,
                    )
                    if existing_bond is not None:
                        result.bonds.append(existing_bond)
                        continue

                    # Serialize relation creation for this exact edge to avoid concurrent duplicate bonds.
                    lock_key = self._bond_lock_key(
                        user_id=user_id,
                        galaxy_id=galaxy_id,
                        source_id=source_uuid,
                        target_id=target_uuid,
                        bond_type=bond_type,
                    )
                    await session.execute(sql_text("SELECT pg_advisory_xact_lock(:key)"), {"key": lock_key})

                    bond_match_predicate = and_(
                        Bond.user_id == user_id,
                        Bond.galaxy_id == galaxy_id,
                        func.upper(Bond.type) == bond_type,
                        Bond.is_deleted.is_(False),
                    )
                    if is_relation:
                        bond_match_predicate = and_(
                            bond_match_predicate,
                            or_(
                                and_(Bond.source_id == source_uuid, Bond.target_id == target_uuid),
                                and_(Bond.source_id == target_uuid, Bond.target_id == source_uuid),
                            ),
                        )
                    else:
                        bond_match_predicate = and_(
                            bond_match_predicate,
                            Bond.source_id == source_uuid,
                            Bond.target_id == target_uuid,
                        )

                    persisted_bond = (
                        await session.execute(
                            select(Bond).where(
                                bond_match_predicate
                            )
                        )
                    ).scalar_one_or_none()
                    if persisted_bond is not None:
                        persisted_seq = await self._current_entity_event_seq(
                            session=session,
                            user_id=user_id,
                            galaxy_id=galaxy_id,
                            branch_id=branch_id,
                            entity_id=persisted_bond.id,
                        )
                        projected = self._to_projected_bond(persisted_bond, current_event_seq=persisted_seq)
                        bonds_by_id[projected.id] = projected
                        result.bonds.append(projected)
                        continue

                    bond_id = uuid4()
                    bond_payload = {
                        "source_id": str(source_uuid),
                        "target_id": str(target_uuid),
                        "type": bond_type,
                    }
                    raw_bond_metadata = task.params.get("metadata")
                    if isinstance(raw_bond_metadata, dict) and raw_bond_metadata:
                        bond_payload["metadata"] = raw_bond_metadata

                    bond_event = await append_and_project_event(
                        entity_id=bond_id,
                        event_type="BOND_FORMED",
                        payload=bond_payload,
                    )
                    bond = ProjectedBond(
                        id=bond_id,
                        source_id=source_uuid,
                        target_id=target_uuid,
                        type=bond_type,
                        is_deleted=False,
                        created_at=bond_event.timestamp,
                        deleted_at=None,
                        current_event_seq=int(bond_event.event_seq),
                    )
                    bonds_by_id[bond.id] = bond
                    result.bonds.append(bond)
                    continue

                if action == "UPDATE_BOND":
                    bond_uuid = self._parse_uuid(task.params.get("bond_id"))
                    if bond_uuid is None:
                        raise HTTPException(
                            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
                            detail="UPDATE_BOND requires valid bond_id",
                        )
                    bond = bonds_by_id.get(bond_uuid)
                    if bond is None:
                        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Bond not found")

                    raw_type = str(task.params.get("type", "")).strip()
                    if not raw_type:
                        raise HTTPException(
                            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
                            detail="UPDATE_BOND requires non-empty type",
                        )
                    next_type = normalize_bond_type(raw_type)
                    expected_event_seq = self._parse_expected_event_seq(
                        task.params.get("expected_event_seq"),
                        field_name="expected_event_seq",
                    )
                    await self._enforce_expected_entity_event_seq(
                        session=session,
                        user_id=user_id,
                        galaxy_id=galaxy_id,
                        branch_id=branch_id,
                        entity_id=bond.id,
                        expected_event_seq=expected_event_seq,
                        context=f"UPDATE_BOND {bond.id}",
                    )

                    current_type = normalize_bond_type(bond.type)
                    if next_type == current_type:
                        result.bonds.append(bond)
                        continue

                    source_uuid = bond.source_id
                    target_uuid = bond.target_id
                    next_is_relation = next_type == "RELATION"
                    if next_is_relation:
                        source_uuid, target_uuid = self._canonical_relation_pair(source_uuid, target_uuid)

                    duplicate = next(
                        (
                            candidate
                            for candidate in bonds_by_id.values()
                            if candidate.id != bond.id
                            and normalize_bond_type(candidate.type) == next_type
                            and (
                                (candidate.source_id == source_uuid and candidate.target_id == target_uuid)
                                or (
                                    next_is_relation
                                    and candidate.source_id == target_uuid
                                    and candidate.target_id == source_uuid
                                )
                            )
                        ),
                        None,
                    )
                    if duplicate is not None:
                        raise HTTPException(
                            status_code=status.HTTP_409_CONFLICT,
                            detail={
                                "code": "BOND_TYPE_CONFLICT",
                                "message": "Target bond type already exists for this edge",
                                "bond_id": str(duplicate.id),
                            },
                        )

                    replaced_event = await append_and_project_event(
                        entity_id=bond.id,
                        event_type="BOND_SOFT_DELETED",
                        payload={"replaced_by_type": next_type},
                    )
                    bond.is_deleted = True
                    bond.deleted_at = replaced_event.timestamp
                    bond.current_event_seq = int(replaced_event.event_seq)
                    if bond.id not in result.extinguished_bond_ids:
                        result.extinguished_bond_ids.append(bond.id)
                    bonds_by_id.pop(bond.id, None)

                    new_bond_id = uuid4()
                    formed_event = await append_and_project_event(
                        entity_id=new_bond_id,
                        event_type="BOND_FORMED",
                        payload={
                            "source_id": str(source_uuid),
                            "target_id": str(target_uuid),
                            "type": next_type,
                        },
                    )
                    new_bond = ProjectedBond(
                        id=new_bond_id,
                        source_id=source_uuid,
                        target_id=target_uuid,
                        type=next_type,
                        is_deleted=False,
                        created_at=formed_event.timestamp,
                        deleted_at=None,
                        current_event_seq=int(formed_event.event_seq),
                    )
                    bonds_by_id[new_bond.id] = new_bond
                    result.bonds.append(new_bond)
                    continue

                if action == "EXTINGUISH_BOND":
                    bond_uuid = self._parse_uuid(task.params.get("bond_id"))
                    if bond_uuid is None:
                        raise HTTPException(
                            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
                            detail="EXTINGUISH_BOND requires valid bond_id",
                        )
                    bond = bonds_by_id.get(bond_uuid)
                    if bond is None:
                        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Bond not found")

                    expected_event_seq = self._parse_expected_event_seq(
                        task.params.get("expected_event_seq"),
                        field_name="expected_event_seq",
                    )
                    await self._enforce_expected_entity_event_seq(
                        session=session,
                        user_id=user_id,
                        galaxy_id=galaxy_id,
                        branch_id=branch_id,
                        entity_id=bond.id,
                        expected_event_seq=expected_event_seq,
                        context=f"EXTINGUISH_BOND {bond.id}",
                    )
                    deleted_event = await append_and_project_event(
                        entity_id=bond.id,
                        event_type="BOND_SOFT_DELETED",
                        payload={},
                    )
                    bond.is_deleted = True
                    bond.deleted_at = deleted_event.timestamp
                    bond.current_event_seq = int(deleted_event.event_seq)
                    bonds_by_id.pop(bond.id, None)
                    result.bonds.append(bond)
                    if bond.id not in result.extinguished_bond_ids:
                        result.extinguished_bond_ids.append(bond.id)
                    continue

                if action == "SELECT":
                    target = (
                        task.params.get("target_asteroid")
                        or task.params.get("target_planet")
                        or task.params.get("target")
                    )
                    if not target:
                        raise HTTPException(
                            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
                            detail="SELECT task requires target_asteroid",
                        )
                    selected = self._find_asteroids_by_target(
                        asteroids=list(asteroids_by_id.values()),
                        target=str(target),
                        condition=(str(task.params["condition"]) if task.params.get("condition") else None),
                    )
                    result.selected_asteroids.extend(selected)
                    continue

                if action == "UPDATE_ASTEROID":
                    asteroid_uuid = self._parse_uuid(task.params.get("asteroid_id"))
                    if asteroid_uuid is None:
                        raise HTTPException(
                            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
                            detail="UPDATE_ASTEROID requires valid asteroid_id",
                        )

                    asteroid = asteroids_by_id.get(asteroid_uuid)
                    if asteroid is None:
                        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Target asteroid not found")
                    expected_event_seq = self._parse_expected_event_seq(
                        task.params.get("expected_event_seq"),
                        field_name="expected_event_seq",
                    )
                    await self._enforce_expected_entity_event_seq(
                        session=session,
                        user_id=user_id,
                        galaxy_id=galaxy_id,
                        branch_id=branch_id,
                        entity_id=asteroid_uuid,
                        expected_event_seq=expected_event_seq,
                        context=f"UPDATE_ASTEROID {asteroid_uuid}",
                    )

                    has_change = False
                    next_value = asteroid.value
                    next_metadata = dict(asteroid.metadata)
                    if "value" in task.params:
                        next_value = task.params.get("value")
                        if asteroid.value != next_value:
                            has_change = True

                    raw_metadata = task.params.get("metadata")
                    if isinstance(raw_metadata, dict) and raw_metadata:
                        metadata_update = {k: v for k, v in raw_metadata.items() if asteroid.metadata.get(k) != v}
                        if metadata_update:
                            next_metadata = {**next_metadata, **metadata_update}
                            has_change = True

                    if not has_change:
                        raise HTTPException(
                            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
                            detail="No effective update for asteroid",
                        )

                    await self._validate_table_contract_write(
                        session=session,
                        galaxy_id=galaxy_id,
                        asteroid_id=asteroid.id,
                        value=next_value,
                        metadata=next_metadata,
                        asteroids_by_id=asteroids_by_id,
                        contract_cache=contract_cache,
                    )

                    if asteroid.value != next_value:
                        value_event = await append_and_project_event(
                            entity_id=asteroid.id,
                            event_type="ASTEROID_VALUE_UPDATED",
                            payload={"value": next_value},
                        )
                        asteroid.current_event_seq = int(value_event.event_seq)
                        asteroid.value = next_value

                    if asteroid.metadata != next_metadata:
                        metadata_update = {
                            key: value
                            for key, value in next_metadata.items()
                            if asteroid.metadata.get(key) != value
                        }
                        if metadata_update:
                            metadata_event = await append_and_project_event(
                                entity_id=asteroid.id,
                                event_type="METADATA_UPDATED",
                                payload={"metadata": metadata_update},
                            )
                            asteroid.current_event_seq = int(metadata_event.event_seq)
                            asteroid.metadata = next_metadata

                    result.asteroids.append(asteroid)
                    continue

                if action == "SET_FORMULA":
                    target = task.params.get("target")
                    field = task.params.get("field")
                    formula = task.params.get("formula")
                    if not target or not field or not formula:
                        raise HTTPException(
                            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
                            detail="SET_FORMULA task requires target, field, and formula",
                        )

                    target_asteroid = self._resolve_single_asteroid_by_target(list(asteroids_by_id.values()), str(target))
                    if target_asteroid is None:
                        raise HTTPException(
                            status_code=status.HTTP_404_NOT_FOUND,
                            detail="Target asteroid not found",
                        )
                    expected_event_seq = self._parse_expected_event_seq(
                        task.params.get("expected_event_seq"),
                        field_name="expected_event_seq",
                    )
                    await self._enforce_expected_entity_event_seq(
                        session=session,
                        user_id=user_id,
                        galaxy_id=galaxy_id,
                        branch_id=branch_id,
                        entity_id=target_asteroid.id,
                        expected_event_seq=expected_event_seq,
                        context=f"SET_FORMULA {target_asteroid.id}",
                    )

                    field_name = str(field).strip()
                    formula_value = str(formula).strip()
                    if target_asteroid.metadata.get(field_name) != formula_value:
                        next_metadata = {**target_asteroid.metadata, field_name: formula_value}
                        await self._validate_table_contract_write(
                            session=session,
                            galaxy_id=galaxy_id,
                            asteroid_id=target_asteroid.id,
                            value=target_asteroid.value,
                            metadata=next_metadata,
                            asteroids_by_id=asteroids_by_id,
                            contract_cache=contract_cache,
                        )
                        formula_event = await append_and_project_event(
                            entity_id=target_asteroid.id,
                            event_type="METADATA_UPDATED",
                            payload={"metadata": {field_name: formula_value}},
                        )
                        target_asteroid.current_event_seq = int(formula_event.event_seq)
                        target_asteroid.metadata = next_metadata
                    result.asteroids.append(target_asteroid)
                    continue

                if action == "ADD_GUARDIAN":
                    target = task.params.get("target")
                    field = task.params.get("field")
                    operator = task.params.get("operator")
                    threshold = task.params.get("threshold")
                    action_name = task.params.get("action")
                    if not target or not field or not operator or action_name is None:
                        raise HTTPException(
                            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
                            detail="ADD_GUARDIAN task requires target, field, operator, threshold, and action",
                        )

                    operator_value = str(operator).strip()
                    if operator_value not in {">", "<", "==", ">=", "<="}:
                        raise HTTPException(
                            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
                            detail="ADD_GUARDIAN uses unsupported operator",
                        )

                    target_asteroid = self._resolve_single_asteroid_by_target(list(asteroids_by_id.values()), str(target))
                    if target_asteroid is None:
                        raise HTTPException(
                            status_code=status.HTTP_404_NOT_FOUND,
                            detail="Target asteroid not found",
                        )
                    expected_event_seq = self._parse_expected_event_seq(
                        task.params.get("expected_event_seq"),
                        field_name="expected_event_seq",
                    )
                    await self._enforce_expected_entity_event_seq(
                        session=session,
                        user_id=user_id,
                        galaxy_id=galaxy_id,
                        branch_id=branch_id,
                        entity_id=target_asteroid.id,
                        expected_event_seq=expected_event_seq,
                        context=f"ADD_GUARDIAN {target_asteroid.id}",
                    )

                    existing_guardians = target_asteroid.metadata.get("_guardians", [])
                    guardian_rules = [dict(rule) for rule in existing_guardians if isinstance(rule, dict)]
                    new_rule = {
                        "field": str(field).strip(),
                        "operator": operator_value,
                        "threshold": threshold,
                        "action": str(action_name).strip(),
                    }
                    signature = (
                        new_rule["field"],
                        new_rule["operator"],
                        new_rule["threshold"],
                        new_rule["action"],
                    )
                    existing_signatures = {
                        (
                            str(rule.get("field", "")).strip(),
                            str(rule.get("operator", "")).strip(),
                            rule.get("threshold"),
                            str(rule.get("action", "")).strip(),
                        )
                        for rule in guardian_rules
                        if isinstance(rule, dict)
                    }

                    if signature not in existing_signatures:
                        next_metadata = {
                            **target_asteroid.metadata,
                            "_guardians": [*guardian_rules, new_rule],
                        }
                        await self._validate_table_contract_write(
                            session=session,
                            galaxy_id=galaxy_id,
                            asteroid_id=target_asteroid.id,
                            value=target_asteroid.value,
                            metadata=next_metadata,
                            asteroids_by_id=asteroids_by_id,
                            contract_cache=contract_cache,
                        )
                        guardian_rules.append(new_rule)
                        guardian_event = await append_and_project_event(
                            entity_id=target_asteroid.id,
                            event_type="METADATA_UPDATED",
                            payload={"metadata": {"_guardians": guardian_rules}},
                        )
                        target_asteroid.current_event_seq = int(guardian_event.event_seq)
                        target_asteroid.metadata = {
                            **target_asteroid.metadata,
                            "_guardians": guardian_rules,
                        }
                    result.asteroids.append(target_asteroid)
                    continue

                if action in {"DELETE", "EXTINGUISH"}:
                    asteroid_id = task.params.get("asteroid_id") or task.params.get("atom_id")
                    target = task.params.get("target_asteroid") or task.params.get("target_planet")
                    delete_target = task.params.get("target")
                    condition = task.params.get("condition")

                    targets: list[ProjectedAsteroid] = []
                    if asteroid_id:
                        asteroid_uuid = self._parse_uuid(asteroid_id)
                        if asteroid_uuid is None:
                            raise HTTPException(
                                status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
                                detail="Invalid asteroid_id format",
                            )
                        asteroid = asteroids_by_id.get(asteroid_uuid)
                        if asteroid:
                            targets = [asteroid]
                    elif target:
                        targets = self._find_asteroids_by_target(
                            asteroids=list(asteroids_by_id.values()),
                            target=str(target),
                            condition=(str(condition) if condition else None),
                        )
                    elif delete_target:
                        asteroid = self._find_asteroid_by_target(list(asteroids_by_id.values()), str(delete_target))
                        if asteroid:
                            targets = [asteroid]
                    else:
                        raise HTTPException(
                            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
                            detail="DELETE/EXTINGUISH task requires asteroid_id, target_asteroid, or target",
                        )

                    if not targets:
                        raise HTTPException(
                            status_code=status.HTTP_404_NOT_FOUND,
                            detail="Target asteroid not found",
                        )
                    expected_event_seq = self._parse_expected_event_seq(
                        task.params.get("expected_event_seq"),
                        field_name="expected_event_seq",
                    )
                    if expected_event_seq is not None and len(targets) != 1:
                        raise HTTPException(
                            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
                            detail="expected_event_seq can be used only with a single delete target",
                        )

                    processed_bond_ids: set[UUID] = set()
                    for asteroid in targets:
                        await self._enforce_expected_entity_event_seq(
                            session=session,
                            user_id=user_id,
                            galaxy_id=galaxy_id,
                            branch_id=branch_id,
                            entity_id=asteroid.id,
                            expected_event_seq=expected_event_seq,
                            context=f"DELETE/EXTINGUISH {asteroid.id}",
                        )
                        deleted_event = await append_and_project_event(
                            entity_id=asteroid.id,
                            event_type="ASTEROID_SOFT_DELETED",
                            payload={},
                        )
                        asteroid.is_deleted = True
                        asteroid.deleted_at = deleted_event.timestamp
                        asteroid.current_event_seq = int(deleted_event.event_seq)
                        result.extinguished_asteroids.append(asteroid)
                        if asteroid.id not in result.extinguished_asteroid_ids:
                            result.extinguished_asteroid_ids.append(asteroid.id)

                        connected_bonds = [
                            bond
                            for bond in bonds_by_id.values()
                            if bond.id not in processed_bond_ids
                            and (bond.source_id == asteroid.id or bond.target_id == asteroid.id)
                        ]
                        for bond in connected_bonds:
                            bond_deleted_event = await append_and_project_event(
                                entity_id=bond.id,
                                event_type="BOND_SOFT_DELETED",
                                payload={"asteroid_id": str(asteroid.id)},
                            )
                            bond.is_deleted = True
                            bond.deleted_at = bond_deleted_event.timestamp
                            bond.current_event_seq = int(bond_deleted_event.event_seq)
                            processed_bond_ids.add(bond.id)
                            if bond.id not in result.extinguished_bond_ids:
                                result.extinguished_bond_ids.append(bond.id)
                            bonds_by_id.pop(bond.id, None)

                        asteroids_by_id.pop(asteroid.id, None)

                    bonds_by_id = {
                        bond_id: bond
                        for bond_id, bond in bonds_by_id.items()
                        if bond.source_id in asteroids_by_id and bond.target_id in asteroids_by_id
                    }
                    continue

                raise HTTPException(
                    status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
                    detail=f"Unsupported task action: {task.action}",
                )

            # Branch timelines are projected on read by event replay.
            # Main timeline keeps strong read-model consistency within the same transaction.
            if branch_id is None and appended_events:
                await self.read_model_projector.apply_events(session=session, events=appended_events)

        return result
