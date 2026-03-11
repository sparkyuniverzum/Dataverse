from __future__ import annotations

from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, Query, Request, status
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.error_envelopes import resilience_error_detail
from app.api.mappers.public import (
    star_core_domain_metrics_to_public,
    star_core_physics_migration_to_public,
    star_core_physics_profile_to_public,
    star_core_planet_physics_to_public,
    star_core_policy_to_public,
    star_core_pulse_to_public,
    star_core_runtime_to_public,
)
from app.api.routers.galaxies.deps import resolve_galaxy_scope
from app.api.runtime import commit_if_active, get_service_container, resolve_trace_context, transactional_context
from app.app_factory import ServiceContainer
from app.db import get_read_session, get_session
from app.domains.star_core.commands import (
    StarCoreCommandError,
    apply_profile_and_lock as apply_profile_and_lock_command,
    migrate_physics_profile as migrate_physics_profile_command,
    plan_apply_profile_lock,
    plan_migrate_physics_profile,
    plan_outbox_run_once,
    run_outbox_once,
)
from app.domains.star_core.queries import (
    StarCoreQueryError,
    get_domain_metrics as get_domain_metrics_query,
    get_outbox_status_snapshot,
    get_physics_profile as get_physics_profile_query,
    get_planet_physics_runtime as get_planet_physics_runtime_query,
    get_policy as get_policy_query,
    get_runtime as get_runtime_query,
    list_pulse as list_pulse_query,
)
from app.infrastructure.runtime.observability.circuit_breaker import CircuitBreakerOpenError
from app.infrastructure.runtime.observability.telemetry_spans import start_span
from app.models import User
from app.modules.auth.dependencies import get_current_user
from app.schemas import (
    StarCoreDomainMetricsResponse,
    StarCoreOutboxRunOnceRequest,
    StarCoreOutboxRunOnceResponse,
    StarCoreOutboxStatusResponse,
    StarCorePhysicsProfileMigrateRequest,
    StarCorePhysicsProfileMigrateResponse,
    StarCorePhysicsProfilePublic,
    StarCorePlanetPhysicsResponse,
    StarCorePolicyPublic,
    StarCoreProfileApplyRequest,
    StarCorePulseResponse,
    StarCoreRuntimePublic,
)

router = APIRouter(tags=["galaxies"])


def _query_to_http_exception(exc: StarCoreQueryError) -> HTTPException:
    return HTTPException(status_code=exc.status_code, detail=exc.detail)


def _command_to_http_exception(exc: StarCoreCommandError) -> HTTPException:
    return HTTPException(status_code=exc.status_code, detail=exc.detail)


@router.get(
    "/galaxies/{galaxy_id}/star-core/policy", response_model=StarCorePolicyPublic, status_code=status.HTTP_200_OK
)
async def star_core_policy(
    galaxy_id: UUID,
    session: AsyncSession = Depends(get_read_session),
    current_user: User = Depends(get_current_user),
    services: ServiceContainer = Depends(get_service_container),
) -> StarCorePolicyPublic:
    target_galaxy_id, _ = await resolve_galaxy_scope(
        session=session,
        current_user=current_user,
        services=services,
        galaxy_id=galaxy_id,
    )
    try:
        policy = await get_policy_query(
            session=session,
            services=services,
            user_id=current_user.id,
            galaxy_id=target_galaxy_id,
        )
    except StarCoreQueryError as exc:
        raise _query_to_http_exception(exc) from exc
    return star_core_policy_to_public(policy)


@router.post(
    "/galaxies/{galaxy_id}/star-core/policy/lock", response_model=StarCorePolicyPublic, status_code=status.HTTP_200_OK
)
async def star_core_policy_lock(
    galaxy_id: UUID,
    payload: StarCoreProfileApplyRequest,
    session: AsyncSession = Depends(get_session),
    current_user: User = Depends(get_current_user),
    services: ServiceContainer = Depends(get_service_container),
) -> StarCorePolicyPublic:
    plan = plan_apply_profile_lock(
        profile_key=payload.profile_key,
        physical_profile_key=payload.physical_profile_key,
        physical_profile_version=payload.physical_profile_version,
        lock_after_apply=payload.lock_after_apply,
    )
    target_galaxy_id, _ = await resolve_galaxy_scope(
        session=session,
        current_user=current_user,
        services=services,
        galaxy_id=galaxy_id,
    )
    async with transactional_context(session):
        try:
            policy = await apply_profile_and_lock_command(
                session=session,
                services=services,
                user_id=current_user.id,
                galaxy_id=target_galaxy_id,
                profile_key=str(plan.request_payload["profile_key"]),
                physical_profile_key=str(plan.request_payload["physical_profile_key"]),
                physical_profile_version=int(plan.request_payload["physical_profile_version"]),
                lock_after_apply=bool(plan.request_payload["lock_after_apply"]),
            )
        except StarCoreCommandError as exc:
            raise _command_to_http_exception(exc) from exc
    await commit_if_active(session)
    return star_core_policy_to_public(policy)


@router.get(
    "/galaxies/{galaxy_id}/star-core/physics/profile",
    response_model=StarCorePhysicsProfilePublic,
    status_code=status.HTTP_200_OK,
)
async def star_core_physics_profile(
    galaxy_id: UUID,
    session: AsyncSession = Depends(get_read_session),
    current_user: User = Depends(get_current_user),
    services: ServiceContainer = Depends(get_service_container),
) -> StarCorePhysicsProfilePublic:
    target_galaxy_id, _ = await resolve_galaxy_scope(
        session=session,
        current_user=current_user,
        services=services,
        galaxy_id=galaxy_id,
    )
    try:
        profile = await get_physics_profile_query(
            session=session,
            services=services,
            user_id=current_user.id,
            galaxy_id=target_galaxy_id,
        )
    except StarCoreQueryError as exc:
        raise _query_to_http_exception(exc) from exc
    return star_core_physics_profile_to_public(profile)


@router.post(
    "/galaxies/{galaxy_id}/star-core/physics/profile/migrate",
    response_model=StarCorePhysicsProfileMigrateResponse,
    status_code=status.HTTP_200_OK,
)
async def star_core_physics_profile_migrate(
    galaxy_id: UUID,
    payload: StarCorePhysicsProfileMigrateRequest,
    session: AsyncSession = Depends(get_session),
    current_user: User = Depends(get_current_user),
    services: ServiceContainer = Depends(get_service_container),
) -> StarCorePhysicsProfileMigrateResponse:
    plan = plan_migrate_physics_profile(
        from_version=payload.from_version,
        to_version=payload.to_version,
        reason=payload.reason,
        dry_run=payload.dry_run,
    )
    target_galaxy_id, _ = await resolve_galaxy_scope(
        session=session,
        current_user=current_user,
        services=services,
        galaxy_id=galaxy_id,
    )
    async with transactional_context(session):
        try:
            migration = await migrate_physics_profile_command(
                session=session,
                services=services,
                user_id=current_user.id,
                galaxy_id=target_galaxy_id,
                from_version=int(plan.request_payload["from_version"]),
                to_version=int(plan.request_payload["to_version"]),
                reason=str(plan.request_payload["reason"]),
                dry_run=bool(plan.request_payload["dry_run"]),
            )
        except StarCoreCommandError as exc:
            raise _command_to_http_exception(exc) from exc
    await commit_if_active(session)
    return star_core_physics_migration_to_public(migration)


@router.get(
    "/galaxies/{galaxy_id}/star-core/physics/planets",
    response_model=StarCorePlanetPhysicsResponse,
    status_code=status.HTTP_200_OK,
)
async def star_core_planet_physics(
    galaxy_id: UUID,
    branch_id: UUID | None = Query(default=None),
    after_event_seq: int | None = Query(default=None, ge=0),
    limit: int = Query(default=200, ge=1, le=1000),
    session: AsyncSession = Depends(get_read_session),
    current_user: User = Depends(get_current_user),
    services: ServiceContainer = Depends(get_service_container),
) -> StarCorePlanetPhysicsResponse:
    target_galaxy_id, target_branch_id = await resolve_galaxy_scope(
        session=session,
        current_user=current_user,
        services=services,
        galaxy_id=galaxy_id,
        branch_id=branch_id,
    )
    try:
        runtime = await get_planet_physics_runtime_query(
            session=session,
            services=services,
            user_id=current_user.id,
            galaxy_id=target_galaxy_id,
            branch_id=target_branch_id,
            after_event_seq=after_event_seq,
            limit=limit,
        )
    except StarCoreQueryError as exc:
        raise _query_to_http_exception(exc) from exc
    return star_core_planet_physics_to_public(runtime)


@router.get(
    "/galaxies/{galaxy_id}/star-core/runtime", response_model=StarCoreRuntimePublic, status_code=status.HTTP_200_OK
)
async def star_core_runtime(
    galaxy_id: UUID,
    branch_id: UUID | None = Query(default=None),
    window_events: int = Query(default=120, ge=16, le=256),
    session: AsyncSession = Depends(get_read_session),
    current_user: User = Depends(get_current_user),
    services: ServiceContainer = Depends(get_service_container),
) -> StarCoreRuntimePublic:
    target_galaxy_id, target_branch_id = await resolve_galaxy_scope(
        session=session,
        current_user=current_user,
        services=services,
        galaxy_id=galaxy_id,
        branch_id=branch_id,
    )
    try:
        runtime = await get_runtime_query(
            session=session,
            services=services,
            user_id=current_user.id,
            galaxy_id=target_galaxy_id,
            branch_id=target_branch_id,
            window_events=window_events,
        )
    except StarCoreQueryError as exc:
        raise _query_to_http_exception(exc) from exc
    return star_core_runtime_to_public(runtime)


@router.get(
    "/galaxies/{galaxy_id}/star-core/pulse", response_model=StarCorePulseResponse, status_code=status.HTTP_200_OK
)
async def star_core_pulse(
    galaxy_id: UUID,
    branch_id: UUID | None = Query(default=None),
    after_event_seq: int | None = Query(default=None, ge=0),
    limit: int = Query(default=64, ge=1, le=256),
    session: AsyncSession = Depends(get_read_session),
    current_user: User = Depends(get_current_user),
    services: ServiceContainer = Depends(get_service_container),
) -> StarCorePulseResponse:
    target_galaxy_id, target_branch_id = await resolve_galaxy_scope(
        session=session,
        current_user=current_user,
        services=services,
        galaxy_id=galaxy_id,
        branch_id=branch_id,
    )
    try:
        pulse = await list_pulse_query(
            session=session,
            services=services,
            user_id=current_user.id,
            galaxy_id=target_galaxy_id,
            branch_id=target_branch_id,
            after_event_seq=after_event_seq,
            limit=limit,
        )
    except StarCoreQueryError as exc:
        raise _query_to_http_exception(exc) from exc
    return star_core_pulse_to_public(pulse)


@router.get(
    "/galaxies/{galaxy_id}/star-core/metrics/domains",
    response_model=StarCoreDomainMetricsResponse,
    status_code=status.HTTP_200_OK,
)
async def star_core_domain_metrics(
    galaxy_id: UUID,
    branch_id: UUID | None = Query(default=None),
    window_events: int = Query(default=240, ge=32, le=512),
    session: AsyncSession = Depends(get_read_session),
    current_user: User = Depends(get_current_user),
    services: ServiceContainer = Depends(get_service_container),
) -> StarCoreDomainMetricsResponse:
    target_galaxy_id, target_branch_id = await resolve_galaxy_scope(
        session=session,
        current_user=current_user,
        services=services,
        galaxy_id=galaxy_id,
        branch_id=branch_id,
    )
    try:
        domain_metrics = await get_domain_metrics_query(
            session=session,
            services=services,
            user_id=current_user.id,
            galaxy_id=target_galaxy_id,
            branch_id=target_branch_id,
            window_events=window_events,
        )
    except StarCoreQueryError as exc:
        raise _query_to_http_exception(exc) from exc
    return star_core_domain_metrics_to_public(domain_metrics)


@router.post(
    "/star-core/outbox/run-once",
    response_model=StarCoreOutboxRunOnceResponse,
    status_code=status.HTTP_200_OK,
)
async def star_core_outbox_run_once(
    payload: StarCoreOutboxRunOnceRequest,
    request: Request,
    session: AsyncSession = Depends(get_session),
    current_user: User = Depends(get_current_user),
    services: ServiceContainer = Depends(get_service_container),
) -> StarCoreOutboxRunOnceResponse:
    _ = current_user
    plan = plan_outbox_run_once(
        requeue_limit=payload.requeue_limit,
        relay_batch_size=payload.relay_batch_size,
    )
    trace_id, correlation_id = resolve_trace_context(request)
    try:
        with start_span(
            "api.star_core.outbox.run_once",
            attributes={
                "outbox.requeue_limit": int(plan.request_payload["requeue_limit"]),
                "outbox.relay_batch_size": int(plan.request_payload["relay_batch_size"]),
            },
        ):
            async with transactional_context(session):
                summary = await run_outbox_once(
                    session=session,
                    services=services,
                    requeue_limit=int(plan.request_payload["requeue_limit"]),
                    relay_batch_size=int(plan.request_payload["relay_batch_size"]),
                    trace_id=trace_id,
                    correlation_id=correlation_id,
                )
    except StarCoreCommandError as exc:
        raise _command_to_http_exception(exc) from exc
    except CircuitBreakerOpenError as exc:
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail=resilience_error_detail(
                code="CIRCUIT_OPEN",
                message="Outbox run is temporarily unavailable.",
                service="outbox.operator",
                trace_id=trace_id,
                correlation_id=correlation_id,
            ),
        ) from exc
    await commit_if_active(session)
    status_snapshot = services.outbox_operator_service.snapshot()
    return StarCoreOutboxRunOnceResponse(
        state=status_snapshot.state,
        run_count=status_snapshot.run_count,
        requeued=summary.requeued,
        scanned=summary.scanned,
        published=summary.published,
        failed=summary.failed,
        dead_lettered=summary.dead_lettered,
        completed_at=summary.completed_at,
    )


@router.get(
    "/star-core/outbox/status",
    response_model=StarCoreOutboxStatusResponse,
    status_code=status.HTTP_200_OK,
)
async def star_core_outbox_status(
    current_user: User = Depends(get_current_user),
    services: ServiceContainer = Depends(get_service_container),
) -> StarCoreOutboxStatusResponse:
    _ = current_user
    snapshot = get_outbox_status_snapshot(services=services)
    latest = snapshot.latest
    latest_payload = (
        StarCoreOutboxRunOnceResponse(
            state=snapshot.state,
            run_count=snapshot.run_count,
            requeued=latest.requeued,
            scanned=latest.scanned,
            published=latest.published,
            failed=latest.failed,
            dead_lettered=latest.dead_lettered,
            completed_at=latest.completed_at,
        )
        if latest is not None
        else None
    )
    return StarCoreOutboxStatusResponse(
        state=snapshot.state,
        run_count=snapshot.run_count,
        latest=latest_payload,
    )
