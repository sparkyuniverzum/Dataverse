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
from app.services.circuit_breaker import CircuitBreakerOpenError
from app.services.telemetry_spans import start_span

router = APIRouter(tags=["galaxies"])


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
    policy = await services.star_core_service.get_policy(
        session=session,
        user_id=current_user.id,
        galaxy_id=target_galaxy_id,
    )
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
    target_galaxy_id, _ = await resolve_galaxy_scope(
        session=session,
        current_user=current_user,
        services=services,
        galaxy_id=galaxy_id,
    )
    async with transactional_context(session):
        policy = await services.star_core_service.apply_profile_and_lock(
            session=session,
            user_id=current_user.id,
            galaxy_id=target_galaxy_id,
            profile_key=payload.profile_key,
            physical_profile_key=payload.physical_profile_key,
            physical_profile_version=payload.physical_profile_version,
            lock_after_apply=payload.lock_after_apply,
        )
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
    profile = await services.star_core_service.get_physics_profile(
        session=session,
        user_id=current_user.id,
        galaxy_id=target_galaxy_id,
    )
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
    target_galaxy_id, _ = await resolve_galaxy_scope(
        session=session,
        current_user=current_user,
        services=services,
        galaxy_id=galaxy_id,
    )
    async with transactional_context(session):
        migration = await services.star_core_service.migrate_physics_profile(
            session=session,
            user_id=current_user.id,
            galaxy_id=target_galaxy_id,
            from_version=payload.from_version,
            to_version=payload.to_version,
            reason=payload.reason,
            dry_run=payload.dry_run,
        )
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
    runtime = await services.star_core_service.get_planet_physics_runtime(
        session=session,
        user_id=current_user.id,
        galaxy_id=target_galaxy_id,
        branch_id=target_branch_id,
        after_event_seq=after_event_seq,
        limit=limit,
    )
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
    runtime = await services.star_core_service.get_runtime(
        session=session,
        user_id=current_user.id,
        galaxy_id=target_galaxy_id,
        branch_id=target_branch_id,
        window_events=window_events,
    )
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
    pulse = await services.star_core_service.list_pulse(
        session=session,
        user_id=current_user.id,
        galaxy_id=target_galaxy_id,
        branch_id=target_branch_id,
        after_event_seq=after_event_seq,
        limit=limit,
    )
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
    domain_metrics = await services.star_core_service.get_domain_metrics(
        session=session,
        user_id=current_user.id,
        galaxy_id=target_galaxy_id,
        branch_id=target_branch_id,
        window_events=window_events,
    )
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
    trace_id, correlation_id = resolve_trace_context(request)
    try:
        with start_span(
            "api.star_core.outbox.run_once",
            attributes={
                "outbox.requeue_limit": int(payload.requeue_limit),
                "outbox.relay_batch_size": int(payload.relay_batch_size),
            },
        ):
            async with transactional_context(session):
                summary = await services.outbox_operator_service.trigger_run_once(
                    session=session,
                    requeue_limit=payload.requeue_limit,
                    relay_batch_size=payload.relay_batch_size,
                    trace_id=trace_id,
                    correlation_id=correlation_id,
                )
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
    snapshot = services.outbox_operator_service.snapshot()
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
