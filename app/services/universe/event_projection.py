from __future__ import annotations

from datetime import datetime
from typing import TYPE_CHECKING
from uuid import UUID

from fastapi import HTTPException, status
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.domains.bonds.semantics import normalize_bond_type
from app.models import Branch, Event
from app.services.universe.types import ProjectedBond, ProjectedCivilization, ProjectionPayloadError

if TYPE_CHECKING:
    from app.services.universe_service import UniverseService


def apply_event(
    event: Event,
    civilizations_by_id: dict[UUID, ProjectedCivilization],
    bonds_by_id: dict[UUID, ProjectedBond],
) -> None:
    payload = event.payload if isinstance(event.payload, dict) else {}

    if event.event_type == "CIVILIZATION_CREATED":
        metadata = payload.get("metadata", {})
        civilizations_by_id[event.entity_id] = ProjectedCivilization(
            id=event.entity_id,
            value=payload.get("value"),
            metadata=metadata if isinstance(metadata, dict) else {},
            is_deleted=False,
            created_at=event.timestamp,
            deleted_at=None,
            current_event_seq=int(event.event_seq),
        )
        return

    if event.event_type == "METADATA_UPDATED":
        civilization = civilizations_by_id.get(event.entity_id)
        if civilization is None:
            return
        metadata_patch = payload.get("metadata", {})
        metadata_remove = payload.get("metadata_remove", [])
        if isinstance(metadata_patch, dict):
            civilization.metadata = {**civilization.metadata, **metadata_patch}
        if isinstance(metadata_remove, list):
            for item in metadata_remove:
                key = str(item or "").strip()
                if not key:
                    continue
                civilization.metadata.pop(key, None)
        civilization.current_event_seq = int(event.event_seq)
        return

    if event.event_type == "CIVILIZATION_VALUE_UPDATED":
        civilization = civilizations_by_id.get(event.entity_id)
        if civilization is None:
            return
        civilization.value = payload.get("value")
        civilization.current_event_seq = int(event.event_seq)
        return

    if event.event_type == "CIVILIZATION_SOFT_DELETED":
        civilization = civilizations_by_id.get(event.entity_id)
        if civilization is None:
            return
        civilization.is_deleted = True
        civilization.deleted_at = event.timestamp
        civilization.current_event_seq = int(event.event_seq)
        return

    if event.event_type == "BOND_FORMED":
        try:
            source_civilization_id = UUID(str(payload["source_civilization_id"]))
            target_civilization_id = UUID(str(payload["target_civilization_id"]))
        except (KeyError, TypeError, ValueError) as exc:
            raise ProjectionPayloadError(
                event=event,
                reason="BOND_FORMED payload must include valid source_civilization_id and target_civilization_id UUIDs",
            ) from exc
        bonds_by_id[event.entity_id] = ProjectedBond(
            id=event.entity_id,
            source_civilization_id=source_civilization_id,
            target_civilization_id=target_civilization_id,
            type=normalize_bond_type(payload.get("type", "RELATION")),
            is_deleted=False,
            created_at=event.timestamp,
            deleted_at=None,
            current_event_seq=int(event.event_seq),
        )
        return

    if event.event_type == "BOND_SOFT_DELETED":
        bond = bonds_by_id.get(event.entity_id)
        if bond is None:
            return
        bond.is_deleted = True
        bond.deleted_at = event.timestamp
        bond.current_event_seq = int(event.event_seq)


def _map_projection_error(exc: ProjectionPayloadError) -> HTTPException:
    return HTTPException(
        status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
        detail={
            "code": "UNIVERSE_EVENT_PAYLOAD_INVALID",
            "message": "Failed to project universe state due to malformed event payload",
            "event_id": str(exc.event.id),
            "event_type": exc.event.event_type,
            "reason": exc.reason,
        },
    )


async def project_state_from_events(
    service: UniverseService,
    session: AsyncSession,
    *,
    user_id: UUID,
    galaxy_id: UUID,
    branch_id: UUID | None,
    as_of: datetime | None,
) -> tuple[list[ProjectedCivilization], list[ProjectedBond]]:
    events = await service.event_store.list_events(
        session=session,
        user_id=user_id,
        galaxy_id=galaxy_id,
        branch_id=branch_id,
        as_of=as_of,
    )

    civilizations_by_id: dict[UUID, ProjectedCivilization] = {}
    bonds_by_id: dict[UUID, ProjectedBond] = {}
    for event in events:
        try:
            service._apply_event(event, civilizations_by_id, bonds_by_id)
        except ProjectionPayloadError as exc:
            raise _map_projection_error(exc) from exc

    active_civilizations = [
        civilization for civilization in civilizations_by_id.values() if not civilization.is_deleted
    ]
    active_civilizations.sort(key=lambda item: (item.created_at, str(item.id)))
    active_ids = {item.id for item in active_civilizations}

    active_bonds = [
        bond
        for bond in bonds_by_id.values()
        if not bond.is_deleted
        and bond.source_civilization_id in active_ids
        and bond.target_civilization_id in active_ids
    ]
    active_bonds.sort(key=lambda item: (item.created_at, str(item.id)))
    return active_civilizations, active_bonds


async def project_state_from_branch(
    service: UniverseService,
    session: AsyncSession,
    *,
    user_id: UUID,
    galaxy_id: UUID,
    branch_id: UUID,
    as_of: datetime | None,
) -> tuple[list[ProjectedCivilization], list[ProjectedBond]]:
    branch = (await session.execute(select(Branch).where(Branch.id == branch_id))).scalar_one_or_none()
    if branch is None or branch.deleted_at is not None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Branch not found")
    if branch.galaxy_id != galaxy_id:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Forbidden branch access")

    main_events: list[Event] = []
    if branch.base_event_id is not None:
        base_event = (
            await session.execute(
                select(Event).where(
                    Event.id == branch.base_event_id,
                    Event.user_id == user_id,
                    Event.galaxy_id == galaxy_id,
                    Event.branch_id.is_(None),
                )
            )
        ).scalar_one_or_none()
        if base_event is not None:
            main_cutoff_time = base_event.timestamp
            if as_of is not None:
                main_cutoff_time = min(main_cutoff_time, as_of)
            main_events = await service.event_store.list_events(
                session=session,
                user_id=user_id,
                galaxy_id=galaxy_id,
                branch_id=None,
                as_of=main_cutoff_time,
                up_to_event_seq=base_event.event_seq,
            )

    branch_events = await service.event_store.list_events(
        session=session,
        user_id=user_id,
        galaxy_id=galaxy_id,
        branch_id=branch.id,
        as_of=as_of,
    )

    civilizations_by_id: dict[UUID, ProjectedCivilization] = {}
    bonds_by_id: dict[UUID, ProjectedBond] = {}
    for event in [*main_events, *branch_events]:
        try:
            service._apply_event(event, civilizations_by_id, bonds_by_id)
        except ProjectionPayloadError as exc:
            raise _map_projection_error(exc) from exc

    active_civilizations = [
        civilization for civilization in civilizations_by_id.values() if not civilization.is_deleted
    ]
    active_civilizations.sort(key=lambda item: (item.created_at, str(item.id)))
    active_ids = {item.id for item in active_civilizations}

    active_bonds = [
        bond
        for bond in bonds_by_id.values()
        if not bond.is_deleted
        and bond.source_civilization_id in active_ids
        and bond.target_civilization_id in active_ids
    ]
    active_bonds.sort(key=lambda item: (item.created_at, str(item.id)))
    return active_civilizations, active_bonds
