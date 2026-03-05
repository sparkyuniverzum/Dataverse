from __future__ import annotations

from collections.abc import Awaitable, Callable
from typing import Any
from uuid import UUID

from fastapi import HTTPException, Request, status
from sqlalchemy.ext.asyncio import AsyncSession

from app.app_factory import ServiceContainer, get_or_create_services
from app.models import User

services: ServiceContainer = get_or_create_services()


def get_service_container(request: Request) -> ServiceContainer:
    container = getattr(request.app.state, "services", None)
    if isinstance(container, ServiceContainer):
        return container
    # Fallback for edge cases (tests/tools creating app without app_factory.create_app).
    return services


def transactional_context(session: AsyncSession):
    return session.begin_nested() if session.in_transaction() else session.begin()


async def commit_if_active(session: AsyncSession) -> None:
    if session.in_transaction():
        await session.commit()


def normalize_idempotency_key(raw: str | None) -> str | None:
    candidate = str(raw or "").strip()
    return candidate if candidate else None


async def resolve_galaxy_id_for_user(
    session: AsyncSession,
    *,
    user: User,
    galaxy_id: UUID | None,
    services: ServiceContainer,
) -> UUID:
    galaxy = await services.auth_service.resolve_user_galaxy(
        session=session,
        user_id=user.id,
        galaxy_id=galaxy_id,
    )
    return galaxy.id


async def resolve_branch_id_for_user(
    session: AsyncSession,
    *,
    user: User,
    galaxy_id: UUID,
    branch_id: UUID | None,
    services: ServiceContainer,
) -> UUID | None:
    return await services.cosmos_service.resolve_branch_id(
        session=session,
        user_id=user.id,
        galaxy_id=galaxy_id,
        branch_id=branch_id,
    )


async def resolve_scope_for_user(
    *,
    session: AsyncSession,
    user: User,
    galaxy_id: UUID | None,
    branch_id: UUID | None,
    services: ServiceContainer,
) -> tuple[UUID, UUID | None]:
    target_galaxy_id = await resolve_galaxy_id_for_user(
        session=session,
        user=user,
        galaxy_id=galaxy_id,
        services=services,
    )
    target_branch_id = await resolve_branch_id_for_user(
        session=session,
        user=user,
        galaxy_id=target_galaxy_id,
        branch_id=branch_id,
        services=services,
    )
    return target_galaxy_id, target_branch_id


async def run_scoped_idempotent(
    *,
    session: AsyncSession,
    current_user: User,
    services: ServiceContainer,
    galaxy_id: UUID | None,
    branch_id: UUID | None,
    endpoint_key: str,
    idempotency_key: str | None,
    request_payload: dict[str, Any],
    execute: Callable[[UUID, UUID | None], Awaitable[Any]],
    replay_loader: Callable[[dict[str, Any]], Any],
    response_dumper: Callable[[Any], dict[str, Any]],
    empty_response_detail: str,
    empty_response_status: int = status.HTTP_500_INTERNAL_SERVER_ERROR,
    resolved_scope: tuple[UUID, UUID | None] | None = None,
) -> Any:
    normalized_idempotency_key = normalize_idempotency_key(idempotency_key)
    replayed_response: Any | None = None
    response_to_store: Any | None = None

    async with transactional_context(session):
        if resolved_scope is None:
            target_galaxy_id, target_branch_id = await resolve_scope_for_user(
                session=session,
                user=current_user,
                galaxy_id=galaxy_id,
                branch_id=branch_id,
                services=services,
            )
        else:
            target_galaxy_id, target_branch_id = resolved_scope

        if normalized_idempotency_key is not None:
            request_hash = services.idempotency_service.request_hash(request_payload)
            replay = await services.idempotency_service.check_replay(
                session=session,
                user_id=current_user.id,
                galaxy_id=target_galaxy_id,
                branch_id=target_branch_id,
                endpoint=endpoint_key,
                idempotency_key=normalized_idempotency_key,
                request_hash=request_hash,
            )
            if replay is not None:
                replayed_response = replay_loader(replay.response_payload)
            else:
                response_to_store = await execute(target_galaxy_id, target_branch_id)
                await services.idempotency_service.store_response(
                    session=session,
                    user_id=current_user.id,
                    galaxy_id=target_galaxy_id,
                    branch_id=target_branch_id,
                    endpoint=endpoint_key,
                    idempotency_key=normalized_idempotency_key,
                    request_hash=request_hash,
                    status_code=status.HTTP_200_OK,
                    response_payload=response_dumper(response_to_store),
                )
        else:
            response_to_store = await execute(target_galaxy_id, target_branch_id)

    await commit_if_active(session)
    if replayed_response is not None:
        return replayed_response
    if response_to_store is None:
        raise HTTPException(status_code=empty_response_status, detail=empty_response_detail)
    return response_to_store
