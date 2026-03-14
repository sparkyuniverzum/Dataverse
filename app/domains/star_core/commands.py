from __future__ import annotations

from dataclasses import dataclass
from typing import Any
from uuid import UUID

from sqlalchemy.ext.asyncio import AsyncSession


class StarCoreCommandError(Exception):
    def __init__(self, *, status_code: int, detail: Any) -> None:
        super().__init__(str(detail))
        self.status_code = int(status_code)
        self.detail = detail


@dataclass(frozen=True)
class StarCoreCommandPlan:
    request_payload: dict[str, Any]


def _map_service_exception(exc: Exception) -> StarCoreCommandError | None:
    status_code_raw = getattr(exc, "status_code", None)
    detail = getattr(exc, "detail", str(exc))
    if not isinstance(status_code_raw, int):
        return None
    return StarCoreCommandError(status_code=int(status_code_raw), detail=detail)


def plan_apply_profile_lock(
    *,
    profile_key: str,
    physical_profile_key: str,
    physical_profile_version: int,
    lock_after_apply: bool,
) -> StarCoreCommandPlan:
    return StarCoreCommandPlan(
        request_payload={
            "profile_key": str(profile_key),
            "physical_profile_key": str(physical_profile_key),
            "physical_profile_version": int(physical_profile_version),
            "lock_after_apply": bool(lock_after_apply),
        }
    )


def plan_select_interior_constitution(*, constitution_id: str) -> StarCoreCommandPlan:
    return StarCoreCommandPlan(
        request_payload={
            "constitution_id": str(constitution_id).strip().lower(),
        }
    )


def plan_start_interior_entry() -> StarCoreCommandPlan:
    return StarCoreCommandPlan(
        request_payload={
            "action": "start_interior_entry",
        }
    )


def plan_migrate_physics_profile(
    *,
    from_version: int,
    to_version: int,
    reason: str,
    dry_run: bool,
) -> StarCoreCommandPlan:
    return StarCoreCommandPlan(
        request_payload={
            "from_version": int(from_version),
            "to_version": int(to_version),
            "reason": str(reason),
            "dry_run": bool(dry_run),
        }
    )


def plan_outbox_run_once(*, requeue_limit: int, relay_batch_size: int) -> StarCoreCommandPlan:
    return StarCoreCommandPlan(
        request_payload={
            "requeue_limit": int(requeue_limit),
            "relay_batch_size": int(relay_batch_size),
        }
    )


async def apply_profile_and_lock(
    *,
    session: AsyncSession,
    services: Any,
    user_id: UUID,
    galaxy_id: UUID,
    profile_key: str,
    physical_profile_key: str,
    physical_profile_version: int,
    lock_after_apply: bool,
) -> dict[str, Any]:
    try:
        return await services.star_core_service.apply_profile_and_lock(
            session=session,
            user_id=user_id,
            galaxy_id=galaxy_id,
            profile_key=profile_key,
            physical_profile_key=physical_profile_key,
            physical_profile_version=physical_profile_version,
            lock_after_apply=lock_after_apply,
        )
    except Exception as exc:
        mapped = _map_service_exception(exc)
        if mapped is None:
            raise
        raise mapped from exc


async def select_interior_constitution(
    *,
    session: AsyncSession,
    services: Any,
    user_id: UUID,
    galaxy_id: UUID,
    constitution_id: str,
) -> dict[str, Any]:
    try:
        return await services.star_core_service.select_interior_constitution(
            session=session,
            user_id=user_id,
            galaxy_id=galaxy_id,
            constitution_id=constitution_id,
        )
    except Exception as exc:
        mapped = _map_service_exception(exc)
        if mapped is None:
            raise
        raise mapped from exc


async def start_interior_entry(
    *,
    session: AsyncSession,
    services: Any,
    user_id: UUID,
    galaxy_id: UUID,
) -> dict[str, Any]:
    try:
        return await services.star_core_service.start_interior_entry(
            session=session,
            user_id=user_id,
            galaxy_id=galaxy_id,
        )
    except Exception as exc:
        mapped = _map_service_exception(exc)
        if mapped is None:
            raise
        raise mapped from exc


async def migrate_physics_profile(
    *,
    session: AsyncSession,
    services: Any,
    user_id: UUID,
    galaxy_id: UUID,
    from_version: int,
    to_version: int,
    reason: str,
    dry_run: bool,
) -> dict[str, Any]:
    try:
        return await services.star_core_service.migrate_physics_profile(
            session=session,
            user_id=user_id,
            galaxy_id=galaxy_id,
            from_version=from_version,
            to_version=to_version,
            reason=reason,
            dry_run=dry_run,
        )
    except Exception as exc:
        mapped = _map_service_exception(exc)
        if mapped is None:
            raise
        raise mapped from exc


async def run_outbox_once(
    *,
    session: AsyncSession,
    services: Any,
    requeue_limit: int,
    relay_batch_size: int,
    trace_id: str | None,
    correlation_id: str | None,
) -> Any:
    try:
        return await services.outbox_operator_service.trigger_run_once(
            session=session,
            requeue_limit=requeue_limit,
            relay_batch_size=relay_batch_size,
            trace_id=trace_id,
            correlation_id=correlation_id,
        )
    except Exception as exc:
        mapped = _map_service_exception(exc)
        if mapped is None:
            raise
        raise mapped from exc


__all__ = [
    "StarCoreCommandError",
    "StarCoreCommandPlan",
    "apply_profile_and_lock",
    "migrate_physics_profile",
    "plan_apply_profile_lock",
    "plan_migrate_physics_profile",
    "plan_outbox_run_once",
    "plan_select_interior_constitution",
    "plan_start_interior_entry",
    "run_outbox_once",
    "select_interior_constitution",
    "start_interior_entry",
]
