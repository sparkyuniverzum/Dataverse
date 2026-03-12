from __future__ import annotations

from typing import Any
from uuid import UUID

from sqlalchemy.ext.asyncio import AsyncSession


class StarCoreQueryError(Exception):
    def __init__(self, *, status_code: int, detail: Any) -> None:
        super().__init__(str(detail))
        self.status_code = int(status_code)
        self.detail = detail


def _map_service_exception(exc: Exception) -> StarCoreQueryError | None:
    status_code_raw = getattr(exc, "status_code", None)
    detail = getattr(exc, "detail", str(exc))
    if not isinstance(status_code_raw, int):
        return None
    return StarCoreQueryError(status_code=int(status_code_raw), detail=detail)


async def get_policy(
    *,
    session: AsyncSession,
    services: Any,
    user_id: UUID,
    galaxy_id: UUID,
) -> dict[str, Any]:
    try:
        return await services.star_core_service.get_policy(
            session=session,
            user_id=user_id,
            galaxy_id=galaxy_id,
        )
    except Exception as exc:
        mapped = _map_service_exception(exc)
        if mapped is None:
            raise
        raise mapped from exc


async def get_interior(
    *,
    session: AsyncSession,
    services: Any,
    user_id: UUID,
    galaxy_id: UUID,
) -> dict[str, Any]:
    try:
        return await services.star_core_service.get_interior(
            session=session,
            user_id=user_id,
            galaxy_id=galaxy_id,
        )
    except Exception as exc:
        mapped = _map_service_exception(exc)
        if mapped is None:
            raise
        raise mapped from exc


async def get_physics_profile(
    *,
    session: AsyncSession,
    services: Any,
    user_id: UUID,
    galaxy_id: UUID,
) -> dict[str, Any]:
    try:
        return await services.star_core_service.get_physics_profile(
            session=session,
            user_id=user_id,
            galaxy_id=galaxy_id,
        )
    except Exception as exc:
        mapped = _map_service_exception(exc)
        if mapped is None:
            raise
        raise mapped from exc


async def get_planet_physics_runtime(
    *,
    session: AsyncSession,
    services: Any,
    user_id: UUID,
    galaxy_id: UUID,
    branch_id: UUID | None,
    after_event_seq: int | None,
    limit: int,
) -> dict[str, Any]:
    try:
        return await services.star_core_service.get_planet_physics_runtime(
            session=session,
            user_id=user_id,
            galaxy_id=galaxy_id,
            branch_id=branch_id,
            after_event_seq=after_event_seq,
            limit=limit,
        )
    except Exception as exc:
        mapped = _map_service_exception(exc)
        if mapped is None:
            raise
        raise mapped from exc


async def get_runtime(
    *,
    session: AsyncSession,
    services: Any,
    user_id: UUID,
    galaxy_id: UUID,
    branch_id: UUID | None,
    window_events: int,
) -> dict[str, Any]:
    try:
        return await services.star_core_service.get_runtime(
            session=session,
            user_id=user_id,
            galaxy_id=galaxy_id,
            branch_id=branch_id,
            window_events=window_events,
        )
    except Exception as exc:
        mapped = _map_service_exception(exc)
        if mapped is None:
            raise
        raise mapped from exc


async def list_pulse(
    *,
    session: AsyncSession,
    services: Any,
    user_id: UUID,
    galaxy_id: UUID,
    branch_id: UUID | None,
    after_event_seq: int | None,
    limit: int,
) -> dict[str, Any]:
    try:
        return await services.star_core_service.list_pulse(
            session=session,
            user_id=user_id,
            galaxy_id=galaxy_id,
            branch_id=branch_id,
            after_event_seq=after_event_seq,
            limit=limit,
        )
    except Exception as exc:
        mapped = _map_service_exception(exc)
        if mapped is None:
            raise
        raise mapped from exc


async def get_domain_metrics(
    *,
    session: AsyncSession,
    services: Any,
    user_id: UUID,
    galaxy_id: UUID,
    branch_id: UUID | None,
    window_events: int,
) -> dict[str, Any]:
    try:
        return await services.star_core_service.get_domain_metrics(
            session=session,
            user_id=user_id,
            galaxy_id=galaxy_id,
            branch_id=branch_id,
            window_events=window_events,
        )
    except Exception as exc:
        mapped = _map_service_exception(exc)
        if mapped is None:
            raise
        raise mapped from exc


def get_outbox_status_snapshot(*, services: Any) -> Any:
    return services.outbox_operator_service.snapshot()


__all__ = [
    "StarCoreQueryError",
    "get_domain_metrics",
    "get_interior",
    "get_outbox_status_snapshot",
    "get_physics_profile",
    "get_planet_physics_runtime",
    "get_policy",
    "get_runtime",
    "list_pulse",
]
