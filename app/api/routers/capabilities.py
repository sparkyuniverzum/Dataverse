from __future__ import annotations

from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.mappers.public import moon_capability_to_public
from app.api.runtime import get_service_container, resolve_scope_for_user, run_scoped_idempotent
from app.app_factory import ServiceContainer
from app.db import get_read_session, get_session
from app.domains.moons.commands import (
    MoonCapabilityPolicyError,
    ensure_main_timeline,
    plan_deprecate_moon_capability,
    plan_update_moon_capability,
    plan_upsert_moon_capability,
)
from app.domains.moons.queries import (
    MoonCapabilityQueryConflictError,
    MoonCapabilityQueryForbiddenError,
    MoonCapabilityQueryNotFoundError,
    list_planet_capabilities as list_planet_capability_rows,
)
from app.models import User
from app.modules.auth.dependencies import get_current_user
from app.schemas import (
    MoonCapabilityCreateRequest,
    MoonCapabilityDeprecateRequest,
    MoonCapabilityListResponse,
    MoonCapabilityPublic,
    MoonCapabilityUpdateRequest,
)

router = APIRouter(tags=["capabilities"])


def _policy_to_http_exception(exc: MoonCapabilityPolicyError) -> HTTPException:
    return HTTPException(status_code=status.HTTP_409_CONFLICT, detail=str(exc))


def _query_to_http_exception(
    exc: MoonCapabilityQueryNotFoundError | MoonCapabilityQueryConflictError | MoonCapabilityQueryForbiddenError,
) -> HTTPException:
    if isinstance(exc, MoonCapabilityQueryNotFoundError):
        return HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=str(exc))
    if isinstance(exc, MoonCapabilityQueryForbiddenError):
        return HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail=str(exc))
    return HTTPException(status_code=status.HTTP_409_CONFLICT, detail=str(exc))


@router.get(
    "/planets/{planet_id}/capabilities",
    response_model=MoonCapabilityListResponse,
    status_code=status.HTTP_200_OK,
)
async def list_planet_capabilities(
    planet_id: UUID,
    galaxy_id: UUID | None = Query(default=None),
    branch_id: UUID | None = Query(default=None),
    include_inactive: bool = Query(default=False),
    include_history: bool = Query(default=False),
    session: AsyncSession = Depends(get_read_session),
    current_user: User = Depends(get_current_user),
    services: ServiceContainer = Depends(get_service_container),
) -> MoonCapabilityListResponse:
    target_galaxy_id, target_branch_id = await resolve_scope_for_user(
        session=session,
        user=current_user,
        galaxy_id=galaxy_id,
        branch_id=branch_id,
        services=services,
    )
    try:
        ensure_main_timeline(branch_id=target_branch_id)
        rows = await list_planet_capability_rows(
            session=session,
            services=services,
            user_id=current_user.id,
            galaxy_id=target_galaxy_id,
            planet_id=planet_id,
            include_inactive=include_inactive,
            include_history=include_history,
        )
    except MoonCapabilityPolicyError as exc:
        raise _policy_to_http_exception(exc) from exc
    except (
        MoonCapabilityQueryNotFoundError,
        MoonCapabilityQueryConflictError,
        MoonCapabilityQueryForbiddenError,
    ) as exc:
        raise _query_to_http_exception(exc) from exc
    return MoonCapabilityListResponse(items=[moon_capability_to_public(item) for item in rows])


@router.post(
    "/planets/{planet_id}/capabilities",
    response_model=MoonCapabilityPublic,
    status_code=status.HTTP_201_CREATED,
)
async def upsert_planet_capability(
    planet_id: UUID,
    payload: MoonCapabilityCreateRequest,
    session: AsyncSession = Depends(get_session),
    current_user: User = Depends(get_current_user),
    services: ServiceContainer = Depends(get_service_container),
) -> MoonCapabilityPublic:
    plan = plan_upsert_moon_capability(
        planet_id=planet_id,
        capability_key=payload.capability_key,
        capability_class=payload.capability_class,
        config=payload.config,
        order_index=payload.order_index,
        status=payload.status,
    )
    resolved_scope = await resolve_scope_for_user(
        session=session,
        user=current_user,
        galaxy_id=payload.galaxy_id,
        branch_id=payload.branch_id,
        services=services,
    )

    async def execute_scoped(target_galaxy_id: UUID, target_branch_id: UUID | None) -> MoonCapabilityPublic:
        try:
            ensure_main_timeline(branch_id=target_branch_id)
        except MoonCapabilityPolicyError as exc:
            raise _policy_to_http_exception(exc) from exc
        row = await services.cosmos_service.upsert_moon_capability(
            session=session,
            user_id=current_user.id,
            galaxy_id=target_galaxy_id,
            table_id=planet_id,
            capability_key=payload.capability_key,
            capability_class=payload.capability_class,
            config=payload.config,
            order_index=payload.order_index,
            status_value=payload.status,
        )
        return moon_capability_to_public(row)

    return await run_scoped_idempotent(
        session=session,
        current_user=current_user,
        services=services,
        galaxy_id=payload.galaxy_id,
        branch_id=payload.branch_id,
        endpoint_key="POST:/planets/{planet_id}/capabilities",
        idempotency_key=payload.idempotency_key,
        request_payload=plan.request_payload,
        execute=execute_scoped,
        replay_loader=MoonCapabilityPublic.model_validate,
        response_dumper=lambda response: response.model_dump(mode="json"),
        empty_response_detail="Moon capability upsert failed",
        resolved_scope=resolved_scope,
    )


@router.patch(
    "/capabilities/{capability_id}",
    response_model=MoonCapabilityPublic,
    status_code=status.HTTP_200_OK,
)
async def update_capability(
    capability_id: UUID,
    payload: MoonCapabilityUpdateRequest,
    session: AsyncSession = Depends(get_session),
    current_user: User = Depends(get_current_user),
    services: ServiceContainer = Depends(get_service_container),
) -> MoonCapabilityPublic:
    plan = plan_update_moon_capability(
        capability_id=capability_id,
        capability_class=payload.capability_class,
        config=payload.config,
        order_index=payload.order_index,
        status=payload.status,
        expected_version=payload.expected_version,
    )
    resolved_scope = await resolve_scope_for_user(
        session=session,
        user=current_user,
        galaxy_id=payload.galaxy_id,
        branch_id=payload.branch_id,
        services=services,
    )

    async def execute_scoped(target_galaxy_id: UUID, target_branch_id: UUID | None) -> MoonCapabilityPublic:
        try:
            ensure_main_timeline(branch_id=target_branch_id)
        except MoonCapabilityPolicyError as exc:
            raise _policy_to_http_exception(exc) from exc
        row = await services.cosmos_service.update_moon_capability(
            session=session,
            user_id=current_user.id,
            galaxy_id=target_galaxy_id,
            capability_id=capability_id,
            capability_class=payload.capability_class,
            config=payload.config,
            order_index=payload.order_index,
            status_value=payload.status,
            expected_version=payload.expected_version,
        )
        return moon_capability_to_public(row)

    return await run_scoped_idempotent(
        session=session,
        current_user=current_user,
        services=services,
        galaxy_id=payload.galaxy_id,
        branch_id=payload.branch_id,
        endpoint_key="PATCH:/capabilities/{capability_id}",
        idempotency_key=payload.idempotency_key,
        request_payload=plan.request_payload,
        execute=execute_scoped,
        replay_loader=MoonCapabilityPublic.model_validate,
        response_dumper=lambda response: response.model_dump(mode="json"),
        empty_response_detail="Moon capability update failed",
        resolved_scope=resolved_scope,
    )


@router.patch(
    "/capabilities/{capability_id}/deprecate",
    response_model=MoonCapabilityPublic,
    status_code=status.HTTP_200_OK,
)
async def deprecate_capability(
    capability_id: UUID,
    payload: MoonCapabilityDeprecateRequest,
    session: AsyncSession = Depends(get_session),
    current_user: User = Depends(get_current_user),
    services: ServiceContainer = Depends(get_service_container),
) -> MoonCapabilityPublic:
    plan = plan_deprecate_moon_capability(
        capability_id=capability_id,
        expected_version=payload.expected_version,
    )
    resolved_scope = await resolve_scope_for_user(
        session=session,
        user=current_user,
        galaxy_id=payload.galaxy_id,
        branch_id=payload.branch_id,
        services=services,
    )

    async def execute_scoped(target_galaxy_id: UUID, target_branch_id: UUID | None) -> MoonCapabilityPublic:
        try:
            ensure_main_timeline(branch_id=target_branch_id)
        except MoonCapabilityPolicyError as exc:
            raise _policy_to_http_exception(exc) from exc
        row = await services.cosmos_service.deprecate_moon_capability(
            session=session,
            user_id=current_user.id,
            galaxy_id=target_galaxy_id,
            capability_id=capability_id,
            expected_version=payload.expected_version,
        )
        return moon_capability_to_public(row)

    return await run_scoped_idempotent(
        session=session,
        current_user=current_user,
        services=services,
        galaxy_id=payload.galaxy_id,
        branch_id=payload.branch_id,
        endpoint_key="PATCH:/capabilities/{capability_id}/deprecate",
        idempotency_key=payload.idempotency_key,
        request_payload=plan.request_payload,
        execute=execute_scoped,
        replay_loader=MoonCapabilityPublic.model_validate,
        response_dumper=lambda response: response.model_dump(mode="json"),
        empty_response_detail="Moon capability deprecate failed",
        resolved_scope=resolved_scope,
    )
