from __future__ import annotations

import logging
from collections.abc import Awaitable, Callable, Sequence
from typing import Any
from uuid import UUID, uuid4

from fastapi import HTTPException, Request, status
from sqlalchemy.exc import SQLAlchemyError
from sqlalchemy.ext.asyncio import AsyncSession

from app.app_factory import ServiceContainer, get_or_create_services
from app.core.task_executor.models import TaskExecutionResult
from app.domains.shared.commands import (
    SharedCommandError,
    build_idempotency_request_hash,
    check_idempotency_replay,
    store_idempotency_response,
)
from app.models import User
from app.services.parser_types import AtomicTask
from app.services.trace_context import ensure_trace_context, extract_trace_id_from_traceparent

services: ServiceContainer = get_or_create_services()
logger = logging.getLogger(__name__)


def get_service_container(request: Request) -> ServiceContainer:
    container = getattr(request.app.state, "services", None)
    if isinstance(container, ServiceContainer):
        return container
    # Fallback for edge cases (tests/tools creating app without app_factory.create_app).
    return services


def resolve_trace_context(request: Request) -> tuple[str, str]:
    state_trace_id = str(getattr(request.state, "trace_id", "") or "").strip()
    header_trace_id = str(request.headers.get("x-trace-id") or request.headers.get("x-request-id") or "").strip()
    parent_trace_id = extract_trace_id_from_traceparent(request.headers.get("traceparent"))
    state_correlation_id = str(getattr(request.state, "correlation_id", "") or "").strip()
    header_correlation_id = str(request.headers.get("x-correlation-id") or "").strip()
    trace_id, correlation_id = ensure_trace_context(
        trace_id=state_trace_id or header_trace_id or parent_trace_id or uuid4().hex,
        correlation_id=state_correlation_id or header_correlation_id,
    )
    request.state.trace_id = trace_id
    request.state.correlation_id = correlation_id
    return trace_id, correlation_id


def transactional_context(session: AsyncSession):
    return session.begin_nested() if session.in_transaction() else session.begin()


async def commit_if_active(session: AsyncSession) -> None:
    if session.in_transaction():
        await session.commit()


async def ensure_onboarding_progress_safe(
    *,
    session: AsyncSession,
    services: ServiceContainer,
    user_id: UUID,
    galaxy_id: UUID,
    context: str,
) -> None:
    """
    Onboarding progress is non-critical for auth and basic scope flows.
    Keep core endpoint success even when onboarding storage is temporarily unavailable.
    """
    try:
        async with session.begin_nested():
            await services.onboarding_service.ensure_progress(
                session=session,
                user_id=user_id,
                galaxy_id=galaxy_id,
            )
    except SQLAlchemyError as exc:
        logger.warning(
            "Skipped onboarding progress init (%s): user_id=%s galaxy_id=%s error=%s",
            context,
            user_id,
            galaxy_id,
            exc,
        )


def normalize_idempotency_key(raw: str | None) -> str | None:
    candidate = str(raw or "").strip()
    return candidate if candidate else None


def _shared_command_to_http_exception(exc: SharedCommandError) -> HTTPException:
    return HTTPException(status_code=exc.status_code, detail=exc.detail)


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
            try:
                request_hash = build_idempotency_request_hash(
                    services=services,
                    request_payload=request_payload,
                )
                replay = await check_idempotency_replay(
                    session=session,
                    services=services,
                    user_id=current_user.id,
                    galaxy_id=target_galaxy_id,
                    branch_id=target_branch_id,
                    endpoint=endpoint_key,
                    idempotency_key=normalized_idempotency_key,
                    request_hash=request_hash,
                )
            except SharedCommandError as exc:
                raise _shared_command_to_http_exception(exc) from exc
            if replay is not None:
                replayed_response = replay_loader(replay.response_payload)
            else:
                response_to_store = await execute(target_galaxy_id, target_branch_id)
                try:
                    await store_idempotency_response(
                        session=session,
                        services=services,
                        user_id=current_user.id,
                        galaxy_id=target_galaxy_id,
                        branch_id=target_branch_id,
                        endpoint=endpoint_key,
                        idempotency_key=normalized_idempotency_key,
                        request_hash=request_hash,
                        status_code=status.HTTP_200_OK,
                        response_payload=response_dumper(response_to_store),
                    )
                except SharedCommandError as exc:
                    raise _shared_command_to_http_exception(exc) from exc
        else:
            response_to_store = await execute(target_galaxy_id, target_branch_id)

    await commit_if_active(session)
    if replayed_response is not None:
        return replayed_response
    if response_to_store is None:
        raise HTTPException(status_code=empty_response_status, detail=empty_response_detail)
    return response_to_store


async def run_scoped_atomic_idempotent(
    *,
    session: AsyncSession,
    current_user: User,
    services: ServiceContainer,
    tasks: Sequence[AtomicTask],
    galaxy_id: UUID | None,
    branch_id: UUID | None,
    endpoint_key: str,
    idempotency_key: str | None,
    request_payload: dict[str, Any],
    map_execution: Callable[[TaskExecutionResult], Any],
    replay_loader: Callable[[dict[str, Any]], Any],
    response_dumper: Callable[[Any], dict[str, Any]],
    empty_response_detail: str,
    empty_response_status: int = status.HTTP_500_INTERNAL_SERVER_ERROR,
    resolved_scope: tuple[UUID, UUID | None] | None = None,
) -> Any:
    task_list = list(tasks)

    async def execute_scoped(target_galaxy_id: UUID, target_branch_id: UUID | None) -> Any:
        execution = await services.task_executor_service.execute_tasks(
            session=session,
            tasks=task_list,
            user_id=current_user.id,
            galaxy_id=target_galaxy_id,
            branch_id=target_branch_id,
            manage_transaction=False,
        )
        return map_execution(execution)

    return await run_scoped_idempotent(
        session=session,
        current_user=current_user,
        services=services,
        galaxy_id=galaxy_id,
        branch_id=branch_id,
        endpoint_key=endpoint_key,
        idempotency_key=idempotency_key,
        request_payload=request_payload,
        execute=execute_scoped,
        replay_loader=replay_loader,
        response_dumper=response_dumper,
        empty_response_detail=empty_response_detail,
        empty_response_status=empty_response_status,
        resolved_scope=resolved_scope,
    )
