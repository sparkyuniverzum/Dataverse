from __future__ import annotations

from contextlib import asynccontextmanager
from dataclasses import dataclass, field
from uuid import UUID, uuid4

from fastapi import HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession

from app.services.event_store_service import EventStoreService
from app.services.parser_service import AtomicTask
from app.services.universe_service import DEFAULT_GALAXY_ID, ProjectedAsteroid, ProjectedBond, UniverseService


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
    ) -> None:
        self.event_store = event_store or EventStoreService()
        self.universe_service = universe_service or UniverseService(event_store=self.event_store)

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
    def _parse_uuid(value: object) -> UUID | None:
        if value is None:
            return None
        try:
            return UUID(str(value))
        except (TypeError, ValueError):
            return None

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

    async def execute_tasks(
        self,
        session: AsyncSession,
        *,
        tasks: list[AtomicTask],
        user_id: UUID,
        galaxy_id: UUID = DEFAULT_GALAXY_ID,
        manage_transaction: bool = True,
    ) -> TaskExecutionResult:
        result = TaskExecutionResult()
        context_asteroid_ids: list[UUID] = []

        active_asteroids, active_bonds = await self.universe_service.project_state(
            session=session,
            user_id=user_id,
            galaxy_id=galaxy_id,
            apply_calculations=False,
        )
        asteroids_by_id: dict[UUID, ProjectedAsteroid] = {a.id: a for a in active_asteroids}
        bonds_by_id: dict[UUID, ProjectedBond] = {b.id: b for b in active_bonds}

        if not manage_transaction and not session.in_transaction():
            raise HTTPException(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                detail="TaskExecutor requires an active transaction when manage_transaction=False",
            )

        @asynccontextmanager
        async def _no_transaction():
            yield

        transaction_ctx = (
            session.begin_nested() if session.in_transaction() else session.begin()
        ) if manage_transaction else _no_transaction()
        async with transaction_ctx:
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
                        asteroid_id = uuid4()
                        created_event = await self.event_store.append_event(
                            session=session,
                            user_id=user_id,
                            galaxy_id=galaxy_id,
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
                        )
                        asteroids_by_id[asteroid.id] = asteroid
                    else:
                        asteroid = existing
                        metadata_update = {k: v for k, v in metadata.items() if asteroid.metadata.get(k) != v}
                        if metadata_update:
                            await self.event_store.append_event(
                                session=session,
                                user_id=user_id,
                                galaxy_id=galaxy_id,
                                entity_id=asteroid.id,
                                event_type="METADATA_UPDATED",
                                payload={"metadata": metadata_update},
                            )
                            asteroid.metadata = {**asteroid.metadata, **metadata_update}

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

                    bond_type = str(task.params.get("type", "RELATION"))
                    existing_bond = next(
                        (
                            bond
                            for bond in bonds_by_id.values()
                            if bond.source_id == source_uuid and bond.target_id == target_uuid and bond.type == bond_type
                        ),
                        None,
                    )
                    if existing_bond is not None:
                        result.bonds.append(existing_bond)
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

                    bond_event = await self.event_store.append_event(
                        session=session,
                        user_id=user_id,
                        galaxy_id=galaxy_id,
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
                    )
                    bonds_by_id[bond.id] = bond
                    result.bonds.append(bond)
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

                if action == "SET_FORMULA":
                    target = task.params.get("target")
                    field = task.params.get("field")
                    formula = task.params.get("formula")
                    if not target or not field or not formula:
                        raise HTTPException(
                            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
                            detail="SET_FORMULA task requires target, field, and formula",
                        )

                    target_asteroid = self._find_asteroid_by_target(list(asteroids_by_id.values()), str(target))
                    if target_asteroid is None:
                        raise HTTPException(
                            status_code=status.HTTP_404_NOT_FOUND,
                            detail="Target asteroid not found",
                        )

                    field_name = str(field).strip()
                    formula_value = str(formula).strip()
                    if target_asteroid.metadata.get(field_name) != formula_value:
                        await self.event_store.append_event(
                            session=session,
                            user_id=user_id,
                            galaxy_id=galaxy_id,
                            entity_id=target_asteroid.id,
                            event_type="METADATA_UPDATED",
                            payload={"metadata": {field_name: formula_value}},
                        )
                        target_asteroid.metadata = {**target_asteroid.metadata, field_name: formula_value}
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

                    target_asteroid = self._find_asteroid_by_target(list(asteroids_by_id.values()), str(target))
                    if target_asteroid is None:
                        raise HTTPException(
                            status_code=status.HTTP_404_NOT_FOUND,
                            detail="Target asteroid not found",
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
                        guardian_rules.append(new_rule)
                        await self.event_store.append_event(
                            session=session,
                            user_id=user_id,
                            galaxy_id=galaxy_id,
                            entity_id=target_asteroid.id,
                            event_type="METADATA_UPDATED",
                            payload={"metadata": {"_guardians": guardian_rules}},
                        )
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

                    processed_bond_ids: set[UUID] = set()
                    for asteroid in targets:
                        deleted_event = await self.event_store.append_event(
                            session=session,
                            user_id=user_id,
                            galaxy_id=galaxy_id,
                            entity_id=asteroid.id,
                            event_type="ASTEROID_SOFT_DELETED",
                            payload={},
                        )
                        asteroid.is_deleted = True
                        asteroid.deleted_at = deleted_event.timestamp
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
                            bond_deleted_event = await self.event_store.append_event(
                                session=session,
                                user_id=user_id,
                                galaxy_id=galaxy_id,
                                entity_id=bond.id,
                                event_type="BOND_SOFT_DELETED",
                                payload={"asteroid_id": str(asteroid.id)},
                            )
                            bond.is_deleted = True
                            bond.deleted_at = bond_deleted_event.timestamp
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

        return result
