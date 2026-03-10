from __future__ import annotations

from uuid import UUID

from fastapi import APIRouter, Depends, Query, status
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.mappers.public import table_contract_to_public
from app.api.runtime import (
    commit_if_active,
    get_service_container,
    resolve_galaxy_id_for_user,
    transactional_context,
)
from app.app_factory import ServiceContainer
from app.db import get_read_session, get_session
from app.models import User
from app.modules.auth.dependencies import get_current_user
from app.schemas import TableContractPublic, TableContractUpsertRequest

router = APIRouter(tags=["contracts"])


@router.get("/contracts/{table_id}", response_model=TableContractPublic, status_code=status.HTTP_200_OK)
async def get_table_contract(
    table_id: UUID,
    galaxy_id: UUID | None = Query(default=None),
    session: AsyncSession = Depends(get_read_session),
    current_user: User = Depends(get_current_user),
    services: ServiceContainer = Depends(get_service_container),
) -> TableContractPublic:
    target_galaxy_id = await resolve_galaxy_id_for_user(
        session=session,
        user=current_user,
        galaxy_id=galaxy_id,
        services=services,
    )
    contract = await services.cosmos_service.get_effective_table_contract(
        session=session,
        user_id=current_user.id,
        galaxy_id=target_galaxy_id,
        table_id=table_id,
    )
    return table_contract_to_public(contract)


@router.post("/contracts/{table_id}", response_model=TableContractPublic, status_code=status.HTTP_201_CREATED)
async def upsert_table_contract(
    table_id: UUID,
    payload: TableContractUpsertRequest,
    session: AsyncSession = Depends(get_session),
    current_user: User = Depends(get_current_user),
    services: ServiceContainer = Depends(get_service_container),
) -> TableContractPublic:
    async with transactional_context(session):
        await services.cosmos_service.upsert_table_contract(
            session=session,
            user_id=current_user.id,
            galaxy_id=payload.galaxy_id,
            table_id=table_id,
            schema_registry=payload.schema_registry,
            required_fields=payload.required_fields,
            field_types=payload.field_types,
            unique_rules=payload.unique_rules,
            validators=payload.validators,
            auto_semantics=payload.auto_semantics,
            formula_registry=payload.formula_registry,
            physics_rulebook=payload.physics_rulebook,
        )
        contract = await services.cosmos_service.get_effective_table_contract(
            session=session,
            user_id=current_user.id,
            galaxy_id=payload.galaxy_id,
            table_id=table_id,
        )
    await commit_if_active(session)
    return table_contract_to_public(contract)
