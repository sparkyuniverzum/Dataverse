from __future__ import annotations

from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.mappers.public import galaxy_to_public
from app.api.runtime import (
    commit_if_active,
    ensure_onboarding_progress_safe,
    get_service_container,
    run_scoped_idempotent,
    transactional_context,
)
from app.app_factory import ServiceContainer
from app.db import get_read_session, get_session
from app.domains.galaxies.commands import (
    GalaxyCommandError,
    create_galaxy as create_galaxy_command,
    extinguish_galaxy as extinguish_galaxy_command,
    plan_create_galaxy,
    plan_extinguish_galaxy,
)
from app.domains.galaxies.queries import (
    GalaxyQueryError,
    list_galaxies as list_galaxies_query,
)
from app.models import User
from app.modules.auth.dependencies import get_current_user
from app.schemas import GalaxyCreateRequest, GalaxyPublic

router = APIRouter(tags=["galaxies"])


def _query_to_http_exception(exc: GalaxyQueryError) -> HTTPException:
    return HTTPException(status_code=exc.status_code, detail=exc.detail)


def _command_to_http_exception(exc: GalaxyCommandError) -> HTTPException:
    return HTTPException(status_code=exc.status_code, detail=exc.detail)


@router.get("/galaxies", response_model=list[GalaxyPublic], status_code=status.HTTP_200_OK)
async def list_galaxies(
    session: AsyncSession = Depends(get_read_session),
    current_user: User = Depends(get_current_user),
    services: ServiceContainer = Depends(get_service_container),
) -> list[GalaxyPublic]:
    try:
        galaxies = await list_galaxies_query(
            session=session,
            services=services,
            user_id=current_user.id,
        )
    except GalaxyQueryError as exc:
        raise _query_to_http_exception(exc) from exc
    return [galaxy_to_public(galaxy) for galaxy in galaxies]


@router.post("/galaxies", response_model=GalaxyPublic, status_code=status.HTTP_201_CREATED)
async def create_galaxy(
    payload: GalaxyCreateRequest,
    session: AsyncSession = Depends(get_session),
    current_user: User = Depends(get_current_user),
    services: ServiceContainer = Depends(get_service_container),
) -> GalaxyPublic:
    plan = plan_create_galaxy(name=payload.name)
    async with transactional_context(session):
        try:
            galaxy = await create_galaxy_command(
                session=session,
                services=services,
                user_id=current_user.id,
                name=str(plan.request_payload["name"]),
            )
        except GalaxyCommandError as exc:
            raise _command_to_http_exception(exc) from exc
        await ensure_onboarding_progress_safe(
            session=session,
            services=services,
            user_id=current_user.id,
            galaxy_id=galaxy.id,
            context="galaxies.create",
        )
    await commit_if_active(session)
    return galaxy_to_public(galaxy)


@router.patch("/galaxies/{galaxy_id}/extinguish", response_model=GalaxyPublic, status_code=status.HTTP_200_OK)
async def extinguish_galaxy(
    galaxy_id: UUID,
    expected_event_seq: int | None = Query(default=None, ge=0),
    idempotency_key: str | None = Query(default=None),
    session: AsyncSession = Depends(get_session),
    current_user: User = Depends(get_current_user),
    services: ServiceContainer = Depends(get_service_container),
) -> GalaxyPublic:
    plan = plan_extinguish_galaxy(
        galaxy_id=galaxy_id,
        expected_event_seq=expected_event_seq,
    )

    async def execute_scoped(target_galaxy_id: UUID, _: UUID | None) -> GalaxyPublic:
        try:
            galaxy = await extinguish_galaxy_command(
                session=session,
                services=services,
                user_id=current_user.id,
                galaxy_id=target_galaxy_id,
                expected_event_seq=(
                    int(plan.request_payload["expected_event_seq"])
                    if plan.request_payload["expected_event_seq"] is not None
                    else None
                ),
            )
        except GalaxyCommandError as exc:
            raise _command_to_http_exception(exc) from exc
        return galaxy_to_public(galaxy)

    return await run_scoped_idempotent(
        session=session,
        current_user=current_user,
        services=services,
        galaxy_id=galaxy_id,
        branch_id=None,
        endpoint_key="PATCH:/galaxies/{galaxy_id}/extinguish",
        idempotency_key=idempotency_key,
        request_payload=plan.request_payload,
        execute=execute_scoped,
        replay_loader=GalaxyPublic.model_validate,
        response_dumper=lambda response: response.model_dump(mode="json"),
        empty_response_detail="Galaxy extinguish failed",
        resolved_scope=(galaxy_id, None),
    )
