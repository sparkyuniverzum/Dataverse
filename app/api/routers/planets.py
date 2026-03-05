from __future__ import annotations

from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.mappers.public import table_contract_to_public
from app.api.runtime import get_service_container, resolve_scope_for_user, run_scoped_idempotent
from app.app_factory import ServiceContainer
from app.db import get_session
from app.models import Event, TableContract, User
from app.modules.auth.dependencies import get_current_user
from app.schemas import (
    PlanetArchetype,
    PlanetCreateRequest,
    PlanetCreateResponse,
    PlanetExtinguishResponse,
    PlanetListResponse,
    PlanetPublic,
    UniverseTableSnapshot,
)
from app.services.universe_service import split_constellation_and_planet_name

router = APIRouter(tags=["planets"])


def _coerce_archetype(raw: object) -> PlanetArchetype | None:
    value = str(raw or "").strip().lower()
    if not value:
        return None
    try:
        return PlanetArchetype(value)
    except ValueError:
        return None


def _planet_from_table(*, table_payload: dict, contract: TableContract | None) -> PlanetPublic:
    table_name = str(table_payload.get("name") or "Uncategorized")
    constellation_name, planet_name = split_constellation_and_planet_name(table_name)
    members = table_payload.get("members") if isinstance(table_payload.get("members"), list) else []
    internal_bonds = table_payload.get("internal_bonds") if isinstance(table_payload.get("internal_bonds"), list) else []
    external_bonds = table_payload.get("external_bonds") if isinstance(table_payload.get("external_bonds"), list) else []
    archetype = _coerce_archetype(table_payload.get("archetype"))
    contract_version_raw = table_payload.get("contract_version")
    contract_version = int(contract_version_raw) if isinstance(contract_version_raw, int) else None
    if contract is not None and contract_version is None:
        contract_version = int(contract.version)
    return PlanetPublic(
        table_id=table_payload["table_id"],
        table_name=table_name,
        constellation_name=constellation_name,
        planet_name=planet_name,
        archetype=archetype,
        contract_version=contract_version,
        moons_count=len(members),
        schema_fields=[str(item) for item in (table_payload.get("schema_fields") or [])],
        formula_fields=[str(item) for item in (table_payload.get("formula_fields") or [])],
        internal_bonds_count=len(internal_bonds),
        external_bonds_count=len(external_bonds),
        sector=table_payload.get("sector") or {"center": [0.0, 0.0, 0.0], "size": 260.0, "mode": "belt", "grid_plate": True},
        is_empty=len(members) == 0,
        contract=table_contract_to_public(contract) if contract is not None else None,
    )


async def _append_planet_event(
    *,
    services: ServiceContainer,
    session: AsyncSession,
    current_user: User,
    galaxy_id: UUID,
    branch_id: UUID | None,
    table_id: UUID,
    event_type: str,
    payload: dict,
) -> Event:
    event = await services.event_store.append_event(
        session=session,
        user_id=current_user.id,
        galaxy_id=galaxy_id,
        branch_id=branch_id,
        entity_id=table_id,
        event_type=event_type,
        payload=payload,
    )
    if branch_id is None:
        await services.cosmos_service.read_model_projector.apply_events(session=session, events=[event])
    return event


@router.get("/planets", response_model=PlanetListResponse, status_code=status.HTTP_200_OK)
async def list_planets(
    galaxy_id: UUID | None = Query(default=None),
    branch_id: UUID | None = Query(default=None),
    session: AsyncSession = Depends(get_session),
    current_user: User = Depends(get_current_user),
    services: ServiceContainer = Depends(get_service_container),
) -> PlanetListResponse:
    resolved_galaxy_id, resolved_branch_id = await resolve_scope_for_user(
        session=session,
        user=current_user,
        galaxy_id=galaxy_id,
        branch_id=branch_id,
        services=services,
    )
    tables = await services.universe_service.tables_snapshot(
        session=session,
        user_id=current_user.id,
        galaxy_id=resolved_galaxy_id,
        branch_id=resolved_branch_id,
        as_of=None,
    )
    table_ids = [item["table_id"] for item in tables if isinstance(item.get("table_id"), UUID)]
    contracts_by_table = await services.cosmos_service.list_latest_table_contracts(
        session=session,
        user_id=current_user.id,
        galaxy_id=resolved_galaxy_id,
        table_ids=table_ids,
    )
    items = [
        _planet_from_table(table_payload=table, contract=contracts_by_table.get(table["table_id"]))
        for table in tables
        if isinstance(table.get("table_id"), UUID)
    ]
    items.sort(key=lambda item: (item.constellation_name.lower(), item.planet_name.lower(), str(item.table_id)))
    return PlanetListResponse(items=items)


@router.get("/planets/{table_id}", response_model=PlanetPublic, status_code=status.HTTP_200_OK)
async def get_planet(
    table_id: UUID,
    galaxy_id: UUID | None = Query(default=None),
    branch_id: UUID | None = Query(default=None),
    session: AsyncSession = Depends(get_session),
    current_user: User = Depends(get_current_user),
    services: ServiceContainer = Depends(get_service_container),
) -> PlanetPublic:
    resolved_galaxy_id, resolved_branch_id = await resolve_scope_for_user(
        session=session,
        user=current_user,
        galaxy_id=galaxy_id,
        branch_id=branch_id,
        services=services,
    )
    tables = await services.universe_service.tables_snapshot(
        session=session,
        user_id=current_user.id,
        galaxy_id=resolved_galaxy_id,
        branch_id=resolved_branch_id,
        as_of=None,
    )
    table_payload = next((item for item in tables if item.get("table_id") == table_id), None)
    if table_payload is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Planet not found")
    contracts_by_table = await services.cosmos_service.list_latest_table_contracts(
        session=session,
        user_id=current_user.id,
        galaxy_id=resolved_galaxy_id,
        table_ids=[table_id],
    )
    return _planet_from_table(table_payload=table_payload, contract=contracts_by_table.get(table_id))


@router.post("/planets", response_model=PlanetCreateResponse, status_code=status.HTTP_201_CREATED)
async def create_planet(
    payload: PlanetCreateRequest,
    session: AsyncSession = Depends(get_session),
    current_user: User = Depends(get_current_user),
    services: ServiceContainer = Depends(get_service_container),
) -> PlanetCreateResponse:
    resolved_scope = await resolve_scope_for_user(
        session=session,
        user=current_user,
        galaxy_id=payload.galaxy_id,
        branch_id=payload.branch_id,
        services=services,
    )

    async def execute_scoped(target_galaxy_id: UUID, target_branch_id: UUID | None) -> PlanetCreateResponse:
        if target_branch_id is not None:
            raise HTTPException(
                status_code=status.HTTP_409_CONFLICT,
                detail="Planet lifecycle operations are allowed only on main timeline.",
            )

        contract, table_id, table_name = await services.cosmos_service.create_planet_contract(
            session=session,
            user_id=current_user.id,
            galaxy_id=target_galaxy_id,
            table_name=payload.name,
            archetype=payload.archetype.value,
            visual_position=payload.visual_position.model_dump() if payload.visual_position is not None else None,
        )

        if payload.initial_schema_mode.value == "preset":
            preset_key = str(payload.schema_preset_key or "").strip()
            plan = await services.schema_preset_service.build_apply_plan(
                session=session,
                user_id=current_user.id,
                galaxy_id=target_galaxy_id,
                branch_id=target_branch_id,
                table_id=table_id,
                preset_key=preset_key,
                conflict_strategy="skip",
                target_table_name=table_name,
                seed_rows=bool(payload.seed_rows),
            )
            contract, _ = await services.schema_preset_service.apply_plan_commit(
                session=session,
                user_id=current_user.id,
                galaxy_id=target_galaxy_id,
                branch_id=target_branch_id,
                plan=plan,
            )

        await _append_planet_event(
            services=services,
            session=session,
            current_user=current_user,
            galaxy_id=target_galaxy_id,
            branch_id=target_branch_id,
            table_id=table_id,
            event_type="PLANET_CREATED",
            payload={
                "table_id": str(table_id),
                "table_name": table_name,
                "archetype": payload.archetype.value,
                "initial_schema_mode": payload.initial_schema_mode.value,
            },
        )

        tables = await services.universe_service.tables_snapshot(
            session=session,
            user_id=current_user.id,
            galaxy_id=target_galaxy_id,
            branch_id=target_branch_id,
            as_of=None,
        )
        table_payload = next((item for item in tables if item.get("table_id") == table_id), None)
        if table_payload is None:
            raise HTTPException(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                detail="Planet created but cannot be resolved in universe tables snapshot.",
            )

        constellation_name, planet_name = split_constellation_and_planet_name(str(table_payload.get("name") or table_name))
        table_public = UniverseTableSnapshot.model_validate(table_payload)
        return PlanetCreateResponse(
            table_id=table_id,
            table_name=str(table_payload.get("name") or table_name),
            constellation_name=constellation_name,
            planet_name=planet_name,
            archetype=payload.archetype,
            contract=table_contract_to_public(contract),
            table=table_public,
        )

    return await run_scoped_idempotent(
        session=session,
        current_user=current_user,
        services=services,
        galaxy_id=payload.galaxy_id,
        branch_id=payload.branch_id,
        endpoint_key="POST:/planets",
        idempotency_key=payload.idempotency_key,
        request_payload=payload.model_dump(mode="json"),
        execute=execute_scoped,
        replay_loader=PlanetCreateResponse.model_validate,
        response_dumper=lambda response: response.model_dump(mode="json"),
        empty_response_detail="Planet creation failed",
        resolved_scope=resolved_scope,
    )


@router.patch("/planets/{table_id}/extinguish", response_model=PlanetExtinguishResponse, status_code=status.HTTP_200_OK)
async def extinguish_planet(
    table_id: UUID,
    galaxy_id: UUID | None = Query(default=None),
    branch_id: UUID | None = Query(default=None),
    idempotency_key: str | None = Query(default=None),
    session: AsyncSession = Depends(get_session),
    current_user: User = Depends(get_current_user),
    services: ServiceContainer = Depends(get_service_container),
) -> PlanetExtinguishResponse:
    resolved_scope = await resolve_scope_for_user(
        session=session,
        user=current_user,
        galaxy_id=galaxy_id,
        branch_id=branch_id,
        services=services,
    )

    async def execute_scoped(target_galaxy_id: UUID, target_branch_id: UUID | None) -> PlanetExtinguishResponse:
        if target_branch_id is not None:
            raise HTTPException(
                status_code=status.HTTP_409_CONFLICT,
                detail="Planet lifecycle operations are allowed only on main timeline.",
            )

        tables = await services.universe_service.tables_snapshot(
            session=session,
            user_id=current_user.id,
            galaxy_id=target_galaxy_id,
            branch_id=target_branch_id,
            as_of=None,
        )
        table_payload = next((item for item in tables if item.get("table_id") == table_id), None)
        table_name = str(table_id)
        if table_payload is not None:
            members = table_payload.get("members") if isinstance(table_payload.get("members"), list) else []
            internal_bonds = table_payload.get("internal_bonds") if isinstance(table_payload.get("internal_bonds"), list) else []
            external_bonds = table_payload.get("external_bonds") if isinstance(table_payload.get("external_bonds"), list) else []
            table_name = str(table_payload.get("name") or table_name)
            if members or internal_bonds or external_bonds:
                raise HTTPException(
                    status_code=status.HTTP_409_CONFLICT,
                    detail="Planet is not empty. Extinguish moons and bonds first.",
                )

        deleted_versions = await services.cosmos_service.soft_delete_planet_contracts(
            session=session,
            user_id=current_user.id,
            galaxy_id=target_galaxy_id,
            table_id=table_id,
        )

        await _append_planet_event(
            services=services,
            session=session,
            current_user=current_user,
            galaxy_id=target_galaxy_id,
            branch_id=target_branch_id,
            table_id=table_id,
            event_type="PLANET_EXTINGUISHED",
            payload={
                "table_id": str(table_id),
                "table_name": table_name,
                "deleted_contract_versions": deleted_versions,
            },
        )
        return PlanetExtinguishResponse(
            table_id=table_id,
            extinguished=True,
            deleted_contract_versions=deleted_versions,
        )

    return await run_scoped_idempotent(
        session=session,
        current_user=current_user,
        services=services,
        galaxy_id=galaxy_id,
        branch_id=branch_id,
        endpoint_key="PATCH:/planets/{table_id}/extinguish",
        idempotency_key=idempotency_key,
        request_payload={"table_id": str(table_id)},
        execute=execute_scoped,
        replay_loader=PlanetExtinguishResponse.model_validate,
        response_dumper=lambda response: response.model_dump(mode="json"),
        empty_response_detail="Planet extinguish failed",
        resolved_scope=resolved_scope,
    )

