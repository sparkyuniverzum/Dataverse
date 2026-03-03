from __future__ import annotations

from collections.abc import Awaitable, Callable
from contextlib import asynccontextmanager
from dataclasses import dataclass, field
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
from app.services.task_executor.contract_validation import TableContractValidator
from app.services.task_executor.occ_guards import OccGuards
from app.services.task_executor.target_resolution import TargetResolver
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


@dataclass
class _TaskExecutionContext:
    session: AsyncSession
    user_id: UUID
    galaxy_id: UUID
    branch_id: UUID | None
    result: TaskExecutionResult
    context_asteroid_ids: list[UUID]
    asteroids_by_id: dict[UUID, ProjectedAsteroid]
    bonds_by_id: dict[UUID, ProjectedBond]
    contract_cache: dict[UUID, TableContract | None]
    appended_events: list[Event]
    append_and_project_event: Callable[..., Awaitable[Event]]


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
        self.target_resolver = TargetResolver()
        self.occ_guards = OccGuards()
        self.contract_validator = TableContractValidator()

    @staticmethod
    def _bond_lock_key(
        *,
        user_id: UUID,
        galaxy_id: UUID,
        source_id: UUID,
        target_id: UUID,
        bond_type: str,
    ) -> int:
        return OccGuards.bond_lock_key(
            user_id=user_id,
            galaxy_id=galaxy_id,
            source_id=source_id,
            target_id=target_id,
            bond_type=bond_type,
        )

    @staticmethod
    def _occ_scope_lock_key(
        *,
        user_id: UUID,
        galaxy_id: UUID,
        branch_id: UUID | None,
    ) -> int:
        return OccGuards.occ_scope_lock_key(
            user_id=user_id,
            galaxy_id=galaxy_id,
            branch_id=branch_id,
        )

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
        return TargetResolver.value_to_text(value)

    @staticmethod
    def _find_asteroid_by_target(
        asteroids: list[ProjectedAsteroid],
        target: str,
    ) -> ProjectedAsteroid | None:
        return TargetResolver.find_asteroid_by_target(asteroids, target)

    @staticmethod
    def _resolve_single_asteroid_by_target(
        asteroids: list[ProjectedAsteroid],
        target: str,
    ) -> ProjectedAsteroid | None:
        return TargetResolver.resolve_single_asteroid_by_target(asteroids, target)

    @staticmethod
    def _parse_uuid(value: object) -> UUID | None:
        return TargetResolver.parse_uuid(value)

    @staticmethod
    def _parse_expected_event_seq(value: object, *, field_name: str) -> int | None:
        return OccGuards.parse_expected_event_seq(value, field_name=field_name)

    @staticmethod
    def _find_asteroids_by_target(
        asteroids: list[ProjectedAsteroid],
        target: str,
        condition: str | None,
    ) -> list[ProjectedAsteroid]:
        return TargetResolver.find_asteroids_by_target(
            asteroids=asteroids,
            target=target,
            condition=condition,
        )

    async def _current_entity_event_seq(
        self,
        *,
        session: AsyncSession,
        user_id: UUID,
        galaxy_id: UUID,
        branch_id: UUID | None,
        entity_id: UUID,
    ) -> int:
        return await self.occ_guards.current_entity_event_seq(
            session=session,
            user_id=user_id,
            galaxy_id=galaxy_id,
            branch_id=branch_id,
            entity_id=entity_id,
        )

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
        await self.occ_guards.enforce_expected_entity_event_seq(
            session=session,
            user_id=user_id,
            galaxy_id=galaxy_id,
            branch_id=branch_id,
            entity_id=entity_id,
            expected_event_seq=expected_event_seq,
            context=context,
        )

    @staticmethod
    def _canonical_relation_pair(source_id: UUID, target_id: UUID) -> tuple[UUID, UUID]:
        return OccGuards.canonical_relation_pair(source_id, target_id)

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
        return TableContractValidator._coerce_number(value)

    @staticmethod
    def _matches_expected_type(expected: str, value: Any) -> bool:
        return TableContractValidator._matches_expected_type(expected, value)

    @staticmethod
    def _normalize_unique_value(value: Any) -> Any:
        return TableContractValidator._normalize_unique_value(value)

    @staticmethod
    def _passes_validator(*, operator: str, field_value: Any, expected_value: Any) -> bool:
        return TableContractValidator._passes_validator(
            operator=operator,
            field_value=field_value,
            expected_value=expected_value,
        )

    async def _load_latest_table_contract(
        self,
        *,
        session: AsyncSession,
        galaxy_id: UUID,
        table_id: UUID,
        cache: dict[UUID, TableContract | None],
    ) -> TableContract | None:
        return await self.contract_validator.load_latest(
            session=session,
            galaxy_id=galaxy_id,
            table_id=table_id,
            cache=cache,
        )

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
        await self.contract_validator.validate_write(
            session=session,
            galaxy_id=galaxy_id,
            asteroid_id=asteroid_id,
            value=value,
            metadata=metadata,
            asteroids_by_id=asteroids_by_id,
            cache=contract_cache,
        )

    async def _handle_ingest_update_family(self, *, task: AtomicTask, ctx: _TaskExecutionContext) -> bool:
        action = task.action.upper()
        if action == "INGEST":
            if "value" not in task.params:
                raise HTTPException(
                    status_code=status.HTTP_422_UNPROCESSABLE_CONTENT,
                    detail="INGEST task requires value",
                )
            value = task.params["value"]
            raw_metadata = task.params.get("metadata")
            metadata = raw_metadata if isinstance(raw_metadata, dict) else {}

            existing = next(
                (
                    asteroid
                    for asteroid in ctx.asteroids_by_id.values()
                    if asteroid.value == value and not asteroid.is_deleted
                ),
                None,
            )

            if existing is None:
                await self._validate_table_contract_write(
                    session=ctx.session,
                    galaxy_id=ctx.galaxy_id,
                    asteroid_id=None,
                    value=value,
                    metadata=dict(metadata),
                    asteroids_by_id=ctx.asteroids_by_id,
                    contract_cache=ctx.contract_cache,
                )
                asteroid_id = uuid4()
                created_event = await ctx.append_and_project_event(
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
                ctx.asteroids_by_id[asteroid.id] = asteroid
            else:
                asteroid = existing
                metadata_update = {k: v for k, v in metadata.items() if asteroid.metadata.get(k) != v}
                if metadata_update:
                    next_metadata = {**asteroid.metadata, **metadata_update}
                    await self._validate_table_contract_write(
                        session=ctx.session,
                        galaxy_id=ctx.galaxy_id,
                        asteroid_id=asteroid.id,
                        value=asteroid.value,
                        metadata=next_metadata,
                        asteroids_by_id=ctx.asteroids_by_id,
                        contract_cache=ctx.contract_cache,
                    )
                    metadata_event = await ctx.append_and_project_event(
                        entity_id=asteroid.id,
                        event_type="METADATA_UPDATED",
                        payload={"metadata": metadata_update},
                    )
                    asteroid.current_event_seq = int(metadata_event.event_seq)
                    asteroid.metadata = next_metadata

            ctx.context_asteroid_ids.append(asteroid.id)
            ctx.result.asteroids.append(asteroid)
            return True

        if action == "UPDATE_ASTEROID":
            asteroid_uuid = self._parse_uuid(task.params.get("asteroid_id"))
            if asteroid_uuid is None:
                raise HTTPException(
                    status_code=status.HTTP_422_UNPROCESSABLE_CONTENT,
                    detail="UPDATE_ASTEROID requires valid asteroid_id",
                )

            asteroid = ctx.asteroids_by_id.get(asteroid_uuid)
            if asteroid is None:
                raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Target asteroid not found")
            expected_event_seq = self._parse_expected_event_seq(
                task.params.get("expected_event_seq"),
                field_name="expected_event_seq",
            )
            await self._enforce_expected_entity_event_seq(
                session=ctx.session,
                user_id=ctx.user_id,
                galaxy_id=ctx.galaxy_id,
                branch_id=ctx.branch_id,
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
                    status_code=status.HTTP_422_UNPROCESSABLE_CONTENT,
                    detail="No effective update for asteroid",
                )

            await self._validate_table_contract_write(
                session=ctx.session,
                galaxy_id=ctx.galaxy_id,
                asteroid_id=asteroid.id,
                value=next_value,
                metadata=next_metadata,
                asteroids_by_id=ctx.asteroids_by_id,
                contract_cache=ctx.contract_cache,
            )

            if asteroid.value != next_value:
                value_event = await ctx.append_and_project_event(
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
                    metadata_event = await ctx.append_and_project_event(
                        entity_id=asteroid.id,
                        event_type="METADATA_UPDATED",
                        payload={"metadata": metadata_update},
                    )
                    asteroid.current_event_seq = int(metadata_event.event_seq)
                    asteroid.metadata = next_metadata

            ctx.result.asteroids.append(asteroid)
            return True

        return False

    async def _handle_link_and_bond_mutation_family(self, *, task: AtomicTask, ctx: _TaskExecutionContext) -> bool:
        action = task.action.upper()
        if action == "LINK":
            source_id = task.params.get("source_id")
            target_id = task.params.get("target_id")
            if source_id is None or target_id is None:
                if len(ctx.context_asteroid_ids) < 2:
                    raise HTTPException(
                        status_code=status.HTTP_422_UNPROCESSABLE_CONTENT,
                        detail="LINK task requires source_id/target_id or two previous INGEST tasks",
                    )
                source_id = ctx.context_asteroid_ids[-2]
                target_id = ctx.context_asteroid_ids[-1]

            source_uuid = UUID(str(source_id))
            target_uuid = UUID(str(target_id))
            if source_uuid == target_uuid:
                raise HTTPException(
                    status_code=status.HTTP_422_UNPROCESSABLE_CONTENT,
                    detail="source_id and target_id must be different",
                )
            if source_uuid not in ctx.asteroids_by_id:
                raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Source asteroid not found")
            if target_uuid not in ctx.asteroids_by_id:
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
                session=ctx.session,
                user_id=ctx.user_id,
                galaxy_id=ctx.galaxy_id,
                branch_id=ctx.branch_id,
                entity_id=source_uuid,
                expected_event_seq=expected_source_event_seq,
                context=f"LINK source {source_uuid}",
            )
            await self._enforce_expected_entity_event_seq(
                session=ctx.session,
                user_id=ctx.user_id,
                galaxy_id=ctx.galaxy_id,
                branch_id=ctx.branch_id,
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
                    for bond in ctx.bonds_by_id.values()
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
                ctx.result.bonds.append(existing_bond)
                return True

            lock_key = self._bond_lock_key(
                user_id=ctx.user_id,
                galaxy_id=ctx.galaxy_id,
                source_id=source_uuid,
                target_id=target_uuid,
                bond_type=bond_type,
            )
            await ctx.session.execute(sql_text("SELECT pg_advisory_xact_lock(:key)"), {"key": lock_key})

            bond_match_predicate = and_(
                Bond.user_id == ctx.user_id,
                Bond.galaxy_id == ctx.galaxy_id,
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
                await ctx.session.execute(
                    select(Bond).where(
                        bond_match_predicate
                    )
                )
            ).scalar_one_or_none()
            if persisted_bond is not None:
                persisted_seq = await self._current_entity_event_seq(
                    session=ctx.session,
                    user_id=ctx.user_id,
                    galaxy_id=ctx.galaxy_id,
                    branch_id=ctx.branch_id,
                    entity_id=persisted_bond.id,
                )
                projected = self._to_projected_bond(persisted_bond, current_event_seq=persisted_seq)
                ctx.bonds_by_id[projected.id] = projected
                ctx.result.bonds.append(projected)
                return True

            bond_id = uuid4()
            bond_payload = {
                "source_id": str(source_uuid),
                "target_id": str(target_uuid),
                "type": bond_type,
            }
            raw_bond_metadata = task.params.get("metadata")
            if isinstance(raw_bond_metadata, dict) and raw_bond_metadata:
                bond_payload["metadata"] = raw_bond_metadata

            bond_event = await ctx.append_and_project_event(
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
            ctx.bonds_by_id[bond.id] = bond
            ctx.result.bonds.append(bond)
            return True

        if action == "UPDATE_BOND":
            bond_uuid = self._parse_uuid(task.params.get("bond_id"))
            if bond_uuid is None:
                raise HTTPException(
                    status_code=status.HTTP_422_UNPROCESSABLE_CONTENT,
                    detail="UPDATE_BOND requires valid bond_id",
                )
            bond = ctx.bonds_by_id.get(bond_uuid)
            if bond is None:
                raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Bond not found")

            raw_type = str(task.params.get("type", "")).strip()
            if not raw_type:
                raise HTTPException(
                    status_code=status.HTTP_422_UNPROCESSABLE_CONTENT,
                    detail="UPDATE_BOND requires non-empty type",
                )
            next_type = normalize_bond_type(raw_type)
            expected_event_seq = self._parse_expected_event_seq(
                task.params.get("expected_event_seq"),
                field_name="expected_event_seq",
            )
            await self._enforce_expected_entity_event_seq(
                session=ctx.session,
                user_id=ctx.user_id,
                galaxy_id=ctx.galaxy_id,
                branch_id=ctx.branch_id,
                entity_id=bond.id,
                expected_event_seq=expected_event_seq,
                context=f"UPDATE_BOND {bond.id}",
            )

            current_type = normalize_bond_type(bond.type)
            if next_type == current_type:
                ctx.result.bonds.append(bond)
                return True

            source_uuid = bond.source_id
            target_uuid = bond.target_id
            next_is_relation = next_type == "RELATION"
            if next_is_relation:
                source_uuid, target_uuid = self._canonical_relation_pair(source_uuid, target_uuid)

            duplicate = next(
                (
                    candidate
                    for candidate in ctx.bonds_by_id.values()
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

            replaced_event = await ctx.append_and_project_event(
                entity_id=bond.id,
                event_type="BOND_SOFT_DELETED",
                payload={"replaced_by_type": next_type},
            )
            bond.is_deleted = True
            bond.deleted_at = replaced_event.timestamp
            bond.current_event_seq = int(replaced_event.event_seq)
            if bond.id not in ctx.result.extinguished_bond_ids:
                ctx.result.extinguished_bond_ids.append(bond.id)
            ctx.bonds_by_id.pop(bond.id, None)

            new_bond_id = uuid4()
            formed_event = await ctx.append_and_project_event(
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
            ctx.bonds_by_id[new_bond.id] = new_bond
            ctx.result.bonds.append(new_bond)
            return True

        return False

    async def _handle_extinguish_family(self, *, task: AtomicTask, ctx: _TaskExecutionContext) -> bool:
        action = task.action.upper()
        if action == "EXTINGUISH_BOND":
            bond_uuid = self._parse_uuid(task.params.get("bond_id"))
            if bond_uuid is None:
                raise HTTPException(
                    status_code=status.HTTP_422_UNPROCESSABLE_CONTENT,
                    detail="EXTINGUISH_BOND requires valid bond_id",
                )
            bond = ctx.bonds_by_id.get(bond_uuid)
            if bond is None:
                raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Bond not found")

            expected_event_seq = self._parse_expected_event_seq(
                task.params.get("expected_event_seq"),
                field_name="expected_event_seq",
            )
            await self._enforce_expected_entity_event_seq(
                session=ctx.session,
                user_id=ctx.user_id,
                galaxy_id=ctx.galaxy_id,
                branch_id=ctx.branch_id,
                entity_id=bond.id,
                expected_event_seq=expected_event_seq,
                context=f"EXTINGUISH_BOND {bond.id}",
            )
            deleted_event = await ctx.append_and_project_event(
                entity_id=bond.id,
                event_type="BOND_SOFT_DELETED",
                payload={},
            )
            bond.is_deleted = True
            bond.deleted_at = deleted_event.timestamp
            bond.current_event_seq = int(deleted_event.event_seq)
            ctx.bonds_by_id.pop(bond.id, None)
            ctx.result.bonds.append(bond)
            if bond.id not in ctx.result.extinguished_bond_ids:
                ctx.result.extinguished_bond_ids.append(bond.id)
            return True

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
                        status_code=status.HTTP_422_UNPROCESSABLE_CONTENT,
                        detail="Invalid asteroid_id format",
                    )
                asteroid = ctx.asteroids_by_id.get(asteroid_uuid)
                if asteroid:
                    targets = [asteroid]
            elif target:
                targets = self._find_asteroids_by_target(
                    asteroids=list(ctx.asteroids_by_id.values()),
                    target=str(target),
                    condition=(str(condition) if condition else None),
                )
            elif delete_target:
                asteroid = self._find_asteroid_by_target(list(ctx.asteroids_by_id.values()), str(delete_target))
                if asteroid:
                    targets = [asteroid]
            else:
                raise HTTPException(
                    status_code=status.HTTP_422_UNPROCESSABLE_CONTENT,
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
                    status_code=status.HTTP_422_UNPROCESSABLE_CONTENT,
                    detail="expected_event_seq can be used only with a single delete target",
                )

            processed_bond_ids: set[UUID] = set()
            for asteroid in targets:
                await self._enforce_expected_entity_event_seq(
                    session=ctx.session,
                    user_id=ctx.user_id,
                    galaxy_id=ctx.galaxy_id,
                    branch_id=ctx.branch_id,
                    entity_id=asteroid.id,
                    expected_event_seq=expected_event_seq,
                    context=f"DELETE/EXTINGUISH {asteroid.id}",
                )
                deleted_event = await ctx.append_and_project_event(
                    entity_id=asteroid.id,
                    event_type="ASTEROID_SOFT_DELETED",
                    payload={},
                )
                asteroid.is_deleted = True
                asteroid.deleted_at = deleted_event.timestamp
                asteroid.current_event_seq = int(deleted_event.event_seq)
                ctx.result.extinguished_asteroids.append(asteroid)
                if asteroid.id not in ctx.result.extinguished_asteroid_ids:
                    ctx.result.extinguished_asteroid_ids.append(asteroid.id)

                connected_bonds = [
                    bond
                    for bond in ctx.bonds_by_id.values()
                    if bond.id not in processed_bond_ids
                    and (bond.source_id == asteroid.id or bond.target_id == asteroid.id)
                ]
                for bond in connected_bonds:
                    bond_deleted_event = await ctx.append_and_project_event(
                        entity_id=bond.id,
                        event_type="BOND_SOFT_DELETED",
                        payload={"asteroid_id": str(asteroid.id)},
                    )
                    bond.is_deleted = True
                    bond.deleted_at = bond_deleted_event.timestamp
                    bond.current_event_seq = int(bond_deleted_event.event_seq)
                    processed_bond_ids.add(bond.id)
                    if bond.id not in ctx.result.extinguished_bond_ids:
                        ctx.result.extinguished_bond_ids.append(bond.id)
                    ctx.bonds_by_id.pop(bond.id, None)

                ctx.asteroids_by_id.pop(asteroid.id, None)

            ctx.bonds_by_id = {
                bond_id: bond
                for bond_id, bond in ctx.bonds_by_id.items()
                if bond.source_id in ctx.asteroids_by_id and bond.target_id in ctx.asteroids_by_id
            }
            return True

        return False

    async def _handle_formula_guardian_select_family(
        self,
        *,
        task: AtomicTask,
        ctx: _TaskExecutionContext,
    ) -> bool:
        action = task.action.upper()
        if action == "SELECT":
            target = (
                task.params.get("target_asteroid")
                or task.params.get("target_planet")
                or task.params.get("target")
            )
            if not target:
                raise HTTPException(
                    status_code=status.HTTP_422_UNPROCESSABLE_CONTENT,
                    detail="SELECT task requires target_asteroid",
                )
            selected = self._find_asteroids_by_target(
                asteroids=list(ctx.asteroids_by_id.values()),
                target=str(target),
                condition=(str(task.params["condition"]) if task.params.get("condition") else None),
            )
            ctx.result.selected_asteroids.extend(selected)
            return True

        if action == "SET_FORMULA":
            target = task.params.get("target")
            field = task.params.get("field")
            formula = task.params.get("formula")
            if not target or not field or not formula:
                raise HTTPException(
                    status_code=status.HTTP_422_UNPROCESSABLE_CONTENT,
                    detail="SET_FORMULA task requires target, field, and formula",
                )

            target_asteroid = self._resolve_single_asteroid_by_target(list(ctx.asteroids_by_id.values()), str(target))
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
                session=ctx.session,
                user_id=ctx.user_id,
                galaxy_id=ctx.galaxy_id,
                branch_id=ctx.branch_id,
                entity_id=target_asteroid.id,
                expected_event_seq=expected_event_seq,
                context=f"SET_FORMULA {target_asteroid.id}",
            )

            field_name = str(field).strip()
            formula_value = str(formula).strip()
            if target_asteroid.metadata.get(field_name) != formula_value:
                next_metadata = {**target_asteroid.metadata, field_name: formula_value}
                await self._validate_table_contract_write(
                    session=ctx.session,
                    galaxy_id=ctx.galaxy_id,
                    asteroid_id=target_asteroid.id,
                    value=target_asteroid.value,
                    metadata=next_metadata,
                    asteroids_by_id=ctx.asteroids_by_id,
                    contract_cache=ctx.contract_cache,
                )
                formula_event = await ctx.append_and_project_event(
                    entity_id=target_asteroid.id,
                    event_type="METADATA_UPDATED",
                    payload={"metadata": {field_name: formula_value}},
                )
                target_asteroid.current_event_seq = int(formula_event.event_seq)
                target_asteroid.metadata = next_metadata
            ctx.result.asteroids.append(target_asteroid)
            return True

        if action == "ADD_GUARDIAN":
            target = task.params.get("target")
            field = task.params.get("field")
            operator = task.params.get("operator")
            threshold = task.params.get("threshold")
            action_name = task.params.get("action")
            if not target or not field or not operator or action_name is None:
                raise HTTPException(
                    status_code=status.HTTP_422_UNPROCESSABLE_CONTENT,
                    detail="ADD_GUARDIAN task requires target, field, operator, threshold, and action",
                )

            operator_value = str(operator).strip()
            if operator_value not in {">", "<", "==", ">=", "<="}:
                raise HTTPException(
                    status_code=status.HTTP_422_UNPROCESSABLE_CONTENT,
                    detail="ADD_GUARDIAN uses unsupported operator",
                )

            target_asteroid = self._resolve_single_asteroid_by_target(list(ctx.asteroids_by_id.values()), str(target))
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
                session=ctx.session,
                user_id=ctx.user_id,
                galaxy_id=ctx.galaxy_id,
                branch_id=ctx.branch_id,
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
                    session=ctx.session,
                    galaxy_id=ctx.galaxy_id,
                    asteroid_id=target_asteroid.id,
                    value=target_asteroid.value,
                    metadata=next_metadata,
                    asteroids_by_id=ctx.asteroids_by_id,
                    contract_cache=ctx.contract_cache,
                )
                guardian_rules.append(new_rule)
                guardian_event = await ctx.append_and_project_event(
                    entity_id=target_asteroid.id,
                    event_type="METADATA_UPDATED",
                    payload={"metadata": {"_guardians": guardian_rules}},
                )
                target_asteroid.current_event_seq = int(guardian_event.event_seq)
                target_asteroid.metadata = {
                    **target_asteroid.metadata,
                    "_guardians": guardian_rules,
                }
            ctx.result.asteroids.append(target_asteroid)
            return True

        return False

    async def _dispatch_task_family(self, *, task: AtomicTask, ctx: _TaskExecutionContext) -> bool:
        if await self._handle_ingest_update_family(task=task, ctx=ctx):
            return True
        if await self._handle_link_and_bond_mutation_family(task=task, ctx=ctx):
            return True
        if await self._handle_extinguish_family(task=task, ctx=ctx):
            return True
        if await self._handle_formula_guardian_select_family(task=task, ctx=ctx):
            return True
        return False

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
        active_asteroids, active_bonds = await self.universe_service.project_state(
            session=session,
            user_id=user_id,
            galaxy_id=galaxy_id,
            branch_id=branch_id,
            apply_calculations=False,
        )
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
        ) -> Event:
            event = await self.event_store.append_event(
                session=session,
                user_id=user_id,
                galaxy_id=galaxy_id,
                branch_id=branch_id,
                entity_id=entity_id,
                event_type=event_type,
                payload=payload,
            )
            return event

        result = TaskExecutionResult()
        transaction_ctx = (
            session.begin_nested() if session.in_transaction() else session.begin()
        ) if manage_transaction else _no_transaction()
        async with transaction_ctx:
            context = _TaskExecutionContext(
                session=session,
                user_id=user_id,
                galaxy_id=galaxy_id,
                branch_id=branch_id,
                result=result,
                context_asteroid_ids=[],
                asteroids_by_id={a.id: a for a in active_asteroids},
                bonds_by_id={b.id: b for b in active_bonds},
                contract_cache={},
                appended_events=[],
                append_and_project_event=append_and_project_event,
            )

            async def append_with_tracking(*, entity_id: UUID, event_type: str, payload: dict) -> Event:
                event = await append_and_project_event(
                    entity_id=entity_id,
                    event_type=event_type,
                    payload=payload,
                )
                context.appended_events.append(event)
                return event

            context.append_and_project_event = append_with_tracking
            for task in tasks:
                if not await self._dispatch_task_family(task=task, ctx=context):
                    raise HTTPException(
                        status_code=status.HTTP_422_UNPROCESSABLE_CONTENT,
                        detail=f"Unsupported task action: {task.action}",
                    )

            # Branch timelines are projected on read by event replay.
            # Main timeline keeps strong read-model consistency within the same transaction.
            if branch_id is None and context.appended_events:
                await self.read_model_projector.apply_events(session=session, events=context.appended_events)

        return result
