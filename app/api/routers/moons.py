from __future__ import annotations

from typing import Any
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.mappers.execution import civilization_to_response, universe_asteroid_to_snapshot
from app.api.runtime import (
    get_service_container,
    resolve_scope_for_user,
    run_scoped_idempotent,
)
from app.app_factory import ServiceContainer
from app.db import get_read_session, get_session
from app.models import User
from app.modules.auth.dependencies import get_current_user
from app.schemas import (
    FACT_RESERVED_METADATA_KEYS,
    CivilizationMineralMutateRequest,
    CivilizationResponse,
    MoonCreateRequest,
    MoonExtinguishResponse,
    MoonListResponse,
    MoonMutateRequest,
    MoonRowContract,
    civilization_snapshot_to_moon_row,
)
from app.services.parser_types import AtomicTask

router = APIRouter(tags=["moons"])


def _moon_row_from_source(source: Any, *, galaxy_id: UUID) -> MoonRowContract:
    snapshot = universe_asteroid_to_snapshot(source, galaxy_id=galaxy_id)
    return civilization_snapshot_to_moon_row(snapshot)


def _moon_row_from_asteroid_response(response: CivilizationResponse, *, galaxy_id: UUID) -> MoonRowContract:
    return _moon_row_from_source(
        {
            "id": response.id,
            "value": response.value,
            "metadata": response.metadata,
            "created_at": response.created_at,
            "current_event_seq": response.current_event_seq,
        },
        galaxy_id=galaxy_id,
    )


async def _resolve_planet_table_name(
    *,
    session: AsyncSession,
    current_user: User,
    services: ServiceContainer,
    galaxy_id: UUID,
    branch_id: UUID | None,
    planet_id: UUID,
) -> str:
    tables = await services.universe_service.tables_snapshot(
        session=session,
        user_id=current_user.id,
        galaxy_id=galaxy_id,
        branch_id=branch_id,
    )
    row = next((item for item in tables if str(item.get("table_id") or "") == str(planet_id)), None)
    if row is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Planet not found")
    table_name = str(row.get("name") or "").strip()
    if not table_name:
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail="Planet table name is not resolved")
    return table_name


async def _load_active_moon_row(
    *,
    session: AsyncSession,
    current_user: User,
    services: ServiceContainer,
    galaxy_id: UUID,
    branch_id: UUID | None,
    moon_id: UUID,
) -> MoonRowContract:
    civilizations, _ = await services.universe_service.snapshot(
        session=session,
        user_id=current_user.id,
        galaxy_id=galaxy_id,
        branch_id=branch_id,
    )
    for civilization in civilizations:
        civilization_id = (
            civilization.get("id") if isinstance(civilization, dict) else getattr(civilization, "id", None)
        )
        if str(civilization_id or "") != str(moon_id):
            continue
        return _moon_row_from_source(civilization, galaxy_id=galaxy_id)
    raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Moon not found")


def _normalize_mineral_key(raw_key: str) -> str:
    key = str(raw_key or "").strip()
    if not key:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_CONTENT,
            detail="`mineral_key` must be non-empty",
        )
    if key.lower() in FACT_RESERVED_METADATA_KEYS:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_CONTENT,
            detail=f"`{key}` is reserved and cannot be mutated as mineral key",
        )
    return key


@router.get("/moons", response_model=MoonListResponse, status_code=status.HTTP_200_OK)
async def list_moons(
    galaxy_id: UUID | None = Query(default=None),
    branch_id: UUID | None = Query(default=None),
    planet_id: UUID | None = Query(default=None),
    session: AsyncSession = Depends(get_read_session),
    current_user: User = Depends(get_current_user),
    services: ServiceContainer = Depends(get_service_container),
) -> MoonListResponse:
    target_galaxy_id, target_branch_id = await resolve_scope_for_user(
        session=session,
        user=current_user,
        galaxy_id=galaxy_id,
        branch_id=branch_id,
        services=services,
    )
    civilizations, _ = await services.universe_service.snapshot(
        session=session,
        user_id=current_user.id,
        galaxy_id=target_galaxy_id,
        branch_id=target_branch_id,
    )
    items: list[MoonRowContract] = []
    for civilization in civilizations:
        moon_row = _moon_row_from_source(civilization, galaxy_id=target_galaxy_id)
        if planet_id is not None and moon_row.planet_id != planet_id:
            continue
        items.append(moon_row)
    items.sort(key=lambda row: (str(row.constellation_name).lower(), str(row.planet_name).lower(), row.label.lower()))
    return MoonListResponse(items=items)


@router.get("/civilizations", response_model=MoonListResponse, status_code=status.HTTP_200_OK)
async def list_civilizations(
    galaxy_id: UUID | None = Query(default=None),
    branch_id: UUID | None = Query(default=None),
    planet_id: UUID | None = Query(default=None),
    session: AsyncSession = Depends(get_read_session),
    current_user: User = Depends(get_current_user),
    services: ServiceContainer = Depends(get_service_container),
) -> MoonListResponse:
    return await list_moons(
        galaxy_id=galaxy_id,
        branch_id=branch_id,
        planet_id=planet_id,
        session=session,
        current_user=current_user,
        services=services,
    )


@router.get("/moons/{moon_id}", response_model=MoonRowContract, status_code=status.HTTP_200_OK)
async def get_moon(
    moon_id: UUID,
    galaxy_id: UUID | None = Query(default=None),
    branch_id: UUID | None = Query(default=None),
    session: AsyncSession = Depends(get_read_session),
    current_user: User = Depends(get_current_user),
    services: ServiceContainer = Depends(get_service_container),
) -> MoonRowContract:
    target_galaxy_id, target_branch_id = await resolve_scope_for_user(
        session=session,
        user=current_user,
        galaxy_id=galaxy_id,
        branch_id=branch_id,
        services=services,
    )
    return await _load_active_moon_row(
        session=session,
        current_user=current_user,
        services=services,
        galaxy_id=target_galaxy_id,
        branch_id=target_branch_id,
        moon_id=moon_id,
    )


@router.get("/civilizations/{civilization_id}", response_model=MoonRowContract, status_code=status.HTTP_200_OK)
async def get_civilization(
    civilization_id: UUID,
    galaxy_id: UUID | None = Query(default=None),
    branch_id: UUID | None = Query(default=None),
    session: AsyncSession = Depends(get_read_session),
    current_user: User = Depends(get_current_user),
    services: ServiceContainer = Depends(get_service_container),
) -> MoonRowContract:
    return await get_moon(
        moon_id=civilization_id,
        galaxy_id=galaxy_id,
        branch_id=branch_id,
        session=session,
        current_user=current_user,
        services=services,
    )


@router.post("/moons", response_model=MoonRowContract, status_code=status.HTTP_201_CREATED)
async def create_moon(
    payload: MoonCreateRequest,
    session: AsyncSession = Depends(get_session),
    current_user: User = Depends(get_current_user),
    services: ServiceContainer = Depends(get_service_container),
) -> MoonRowContract:
    target_galaxy_id, target_branch_id = await resolve_scope_for_user(
        session=session,
        user=current_user,
        galaxy_id=payload.galaxy_id,
        branch_id=payload.branch_id,
        services=services,
    )
    target_table_name = await _resolve_planet_table_name(
        session=session,
        current_user=current_user,
        services=services,
        galaxy_id=target_galaxy_id,
        branch_id=target_branch_id,
        planet_id=payload.planet_id,
    )
    metadata = dict(payload.minerals or {})
    metadata["table"] = target_table_name
    metadata["table_id"] = str(payload.planet_id)
    tasks = [AtomicTask(action="INGEST", params={"value": payload.label, "metadata": metadata})]

    async def execute_scoped(_: UUID, __: UUID | None):
        execution = await services.task_executor_service.execute_tasks(
            session=session,
            tasks=tasks,
            user_id=current_user.id,
            galaxy_id=target_galaxy_id,
            branch_id=target_branch_id,
            manage_transaction=False,
        )
        if not execution.civilizations:
            raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail="Moon ingest failed")
        return civilization_to_response(execution.civilizations[0])

    created = await run_scoped_idempotent(
        session=session,
        current_user=current_user,
        services=services,
        galaxy_id=target_galaxy_id,
        branch_id=target_branch_id,
        endpoint_key="POST:/moons",
        idempotency_key=payload.idempotency_key,
        request_payload={
            "planet_id": str(payload.planet_id),
            "label": payload.label,
            "minerals": payload.minerals,
        },
        execute=execute_scoped,
        replay_loader=CivilizationResponse.model_validate,
        response_dumper=lambda response: response.model_dump(mode="json"),
        empty_response_detail="Moon ingest failed",
        resolved_scope=(target_galaxy_id, target_branch_id),
    )
    return _moon_row_from_asteroid_response(created, galaxy_id=target_galaxy_id)


@router.post("/civilizations", response_model=MoonRowContract, status_code=status.HTTP_201_CREATED)
async def create_civilization(
    payload: MoonCreateRequest,
    session: AsyncSession = Depends(get_session),
    current_user: User = Depends(get_current_user),
    services: ServiceContainer = Depends(get_service_container),
) -> MoonRowContract:
    return await create_moon(
        payload=payload,
        session=session,
        current_user=current_user,
        services=services,
    )


@router.patch("/moons/{moon_id}/mutate", response_model=MoonRowContract, status_code=status.HTTP_200_OK)
async def mutate_moon(
    moon_id: UUID,
    payload: MoonMutateRequest,
    session: AsyncSession = Depends(get_session),
    current_user: User = Depends(get_current_user),
    services: ServiceContainer = Depends(get_service_container),
) -> MoonRowContract:
    target_galaxy_id, target_branch_id = await resolve_scope_for_user(
        session=session,
        user=current_user,
        galaxy_id=payload.galaxy_id,
        branch_id=payload.branch_id,
        services=services,
    )
    metadata_patch = dict(payload.minerals or {})
    if payload.planet_id is not None:
        target_table_name = await _resolve_planet_table_name(
            session=session,
            current_user=current_user,
            services=services,
            galaxy_id=target_galaxy_id,
            branch_id=target_branch_id,
            planet_id=payload.planet_id,
        )
        metadata_patch["table"] = target_table_name
        metadata_patch["table_id"] = str(payload.planet_id)

    params: dict[str, Any] = {"civilization_id": str(moon_id)}
    if payload.label is not None:
        params["value"] = payload.label
    if metadata_patch:
        params["metadata"] = metadata_patch
    params["expected_event_seq"] = payload.expected_event_seq
    tasks = [AtomicTask(action="UPDATE_ASTEROID", params=params)]

    async def execute_scoped(_: UUID, __: UUID | None):
        execution = await services.task_executor_service.execute_tasks(
            session=session,
            tasks=tasks,
            user_id=current_user.id,
            galaxy_id=target_galaxy_id,
            branch_id=target_branch_id,
            manage_transaction=False,
        )
        if not execution.civilizations:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Moon not found")
        mutated = next((c for c in execution.civilizations if c.id == moon_id), execution.civilizations[0])
        return civilization_to_response(mutated)

    mutated = await run_scoped_idempotent(
        session=session,
        current_user=current_user,
        services=services,
        galaxy_id=target_galaxy_id,
        branch_id=target_branch_id,
        endpoint_key="PATCH:/moons/{moon_id}/mutate",
        idempotency_key=payload.idempotency_key,
        request_payload={
            "moon_id": str(moon_id),
            "label": payload.label,
            "minerals": payload.minerals,
            "planet_id": str(payload.planet_id) if payload.planet_id is not None else None,
            "expected_event_seq": payload.expected_event_seq,
        },
        execute=execute_scoped,
        replay_loader=CivilizationResponse.model_validate,
        response_dumper=lambda response: response.model_dump(mode="json"),
        empty_response_detail="Moon not found",
        empty_response_status=status.HTTP_404_NOT_FOUND,
        resolved_scope=(target_galaxy_id, target_branch_id),
    )
    return _moon_row_from_asteroid_response(mutated, galaxy_id=target_galaxy_id)


@router.patch("/civilizations/{civilization_id}/mutate", response_model=MoonRowContract, status_code=status.HTTP_200_OK)
async def mutate_civilization(
    civilization_id: UUID,
    payload: MoonMutateRequest,
    session: AsyncSession = Depends(get_session),
    current_user: User = Depends(get_current_user),
    services: ServiceContainer = Depends(get_service_container),
) -> MoonRowContract:
    return await mutate_moon(
        moon_id=civilization_id,
        payload=payload,
        session=session,
        current_user=current_user,
        services=services,
    )


@router.patch(
    "/moons/{moon_id}/minerals/{mineral_key}",
    response_model=MoonRowContract,
    status_code=status.HTTP_200_OK,
)
async def mutate_moon_mineral(
    moon_id: UUID,
    mineral_key: str,
    payload: CivilizationMineralMutateRequest,
    session: AsyncSession = Depends(get_session),
    current_user: User = Depends(get_current_user),
    services: ServiceContainer = Depends(get_service_container),
) -> MoonRowContract:
    target_galaxy_id, target_branch_id = await resolve_scope_for_user(
        session=session,
        user=current_user,
        galaxy_id=payload.galaxy_id,
        branch_id=payload.branch_id,
        services=services,
    )
    normalized_key = _normalize_mineral_key(mineral_key)
    params: dict[str, Any] = {"civilization_id": str(moon_id)}
    if payload.remove:
        params["metadata_remove"] = [normalized_key]
    else:
        params["metadata"] = {normalized_key: payload.typed_value}
    params["expected_event_seq"] = payload.expected_event_seq
    tasks = [AtomicTask(action="UPDATE_ASTEROID", params=params)]

    async def execute_scoped(_: UUID, __: UUID | None):
        execution = await services.task_executor_service.execute_tasks(
            session=session,
            tasks=tasks,
            user_id=current_user.id,
            galaxy_id=target_galaxy_id,
            branch_id=target_branch_id,
            manage_transaction=False,
        )
        if not execution.civilizations:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Moon not found")
        mutated = next((c for c in execution.civilizations if c.id == moon_id), execution.civilizations[0])
        return civilization_to_response(mutated)

    mutated = await run_scoped_idempotent(
        session=session,
        current_user=current_user,
        services=services,
        galaxy_id=target_galaxy_id,
        branch_id=target_branch_id,
        endpoint_key="PATCH:/moons/{moon_id}/minerals/{mineral_key}",
        idempotency_key=payload.idempotency_key,
        request_payload={
            "moon_id": str(moon_id),
            "mineral_key": normalized_key,
            "remove": payload.remove,
            "typed_value": payload.typed_value if not payload.remove else None,
            "expected_event_seq": payload.expected_event_seq,
        },
        execute=execute_scoped,
        replay_loader=CivilizationResponse.model_validate,
        response_dumper=lambda response: response.model_dump(mode="json"),
        empty_response_detail="Moon not found",
        empty_response_status=status.HTTP_404_NOT_FOUND,
        resolved_scope=(target_galaxy_id, target_branch_id),
    )
    return _moon_row_from_asteroid_response(mutated, galaxy_id=target_galaxy_id)


@router.patch(
    "/civilizations/{civilization_id}/minerals/{mineral_key}",
    response_model=MoonRowContract,
    status_code=status.HTTP_200_OK,
)
async def mutate_civilization_mineral(
    civilization_id: UUID,
    mineral_key: str,
    payload: CivilizationMineralMutateRequest,
    session: AsyncSession = Depends(get_session),
    current_user: User = Depends(get_current_user),
    services: ServiceContainer = Depends(get_service_container),
) -> MoonRowContract:
    return await mutate_moon_mineral(
        moon_id=civilization_id,
        mineral_key=mineral_key,
        payload=payload,
        session=session,
        current_user=current_user,
        services=services,
    )


@router.patch("/moons/{moon_id}/extinguish", response_model=MoonExtinguishResponse, status_code=status.HTTP_200_OK)
async def extinguish_moon(
    moon_id: UUID,
    galaxy_id: UUID | None = Query(default=None),
    branch_id: UUID | None = Query(default=None),
    expected_event_seq: int = Query(ge=0),
    idempotency_key: str | None = Query(default=None),
    session: AsyncSession = Depends(get_session),
    current_user: User = Depends(get_current_user),
    services: ServiceContainer = Depends(get_service_container),
) -> MoonExtinguishResponse:
    target_galaxy_id, target_branch_id = await resolve_scope_for_user(
        session=session,
        user=current_user,
        galaxy_id=galaxy_id,
        branch_id=branch_id,
        services=services,
    )
    params: dict[str, Any] = {"civilization_id": str(moon_id), "expected_event_seq": expected_event_seq}
    tasks = [AtomicTask(action="EXTINGUISH", params=params)]

    async def execute_scoped(_: UUID, __: UUID | None) -> MoonExtinguishResponse:
        execution = await services.task_executor_service.execute_tasks(
            session=session,
            tasks=tasks,
            user_id=current_user.id,
            galaxy_id=target_galaxy_id,
            branch_id=target_branch_id,
            manage_transaction=False,
        )
        if moon_id not in execution.extinguished_civilization_ids:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Moon not found")
        deleted_asteroid = next(
            (civilization for civilization in execution.extinguished_asteroids if civilization.id == moon_id),
            None,
        )
        if deleted_asteroid is None:
            raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail="Moon extinguish failed")
        moon_row = _moon_row_from_source(deleted_asteroid, galaxy_id=target_galaxy_id)
        return MoonExtinguishResponse(
            moon_id=moon_row.moon_id,
            label=moon_row.label,
            planet_id=moon_row.planet_id,
            constellation_name=moon_row.constellation_name,
            planet_name=moon_row.planet_name,
            is_deleted=True,
            deleted_at=getattr(deleted_asteroid, "deleted_at", None),
            current_event_seq=int(getattr(deleted_asteroid, "current_event_seq", 0) or 0),
        )

    return await run_scoped_idempotent(
        session=session,
        current_user=current_user,
        services=services,
        galaxy_id=target_galaxy_id,
        branch_id=target_branch_id,
        endpoint_key="PATCH:/moons/{moon_id}/extinguish",
        idempotency_key=idempotency_key,
        request_payload={
            "moon_id": str(moon_id),
            "expected_event_seq": expected_event_seq,
        },
        execute=execute_scoped,
        replay_loader=MoonExtinguishResponse.model_validate,
        response_dumper=lambda response: response.model_dump(mode="json"),
        empty_response_detail="Moon not found",
        empty_response_status=status.HTTP_404_NOT_FOUND,
        resolved_scope=(target_galaxy_id, target_branch_id),
    )


@router.patch(
    "/civilizations/{civilization_id}/extinguish",
    response_model=MoonExtinguishResponse,
    status_code=status.HTTP_200_OK,
)
async def extinguish_civilization(
    civilization_id: UUID,
    galaxy_id: UUID | None = Query(default=None),
    branch_id: UUID | None = Query(default=None),
    expected_event_seq: int = Query(ge=0),
    idempotency_key: str | None = Query(default=None),
    session: AsyncSession = Depends(get_session),
    current_user: User = Depends(get_current_user),
    services: ServiceContainer = Depends(get_service_container),
) -> MoonExtinguishResponse:
    return await extinguish_moon(
        moon_id=civilization_id,
        galaxy_id=galaxy_id,
        branch_id=branch_id,
        expected_event_seq=expected_event_seq,
        idempotency_key=idempotency_key,
        session=session,
        current_user=current_user,
        services=services,
    )
