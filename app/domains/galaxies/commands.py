from __future__ import annotations

from dataclasses import dataclass
from typing import Any
from uuid import UUID

from sqlalchemy.ext.asyncio import AsyncSession


class GalaxyCommandError(Exception):
    def __init__(self, *, status_code: int, detail: Any) -> None:
        super().__init__(str(detail))
        self.status_code = int(status_code)
        self.detail = detail


@dataclass(frozen=True)
class GalaxyCommandPlan:
    request_payload: dict[str, Any]


def _map_service_exception(exc: Exception) -> GalaxyCommandError | None:
    status_code_raw = getattr(exc, "status_code", None)
    detail = getattr(exc, "detail", str(exc))
    if not isinstance(status_code_raw, int):
        return None
    return GalaxyCommandError(status_code=int(status_code_raw), detail=detail)


def plan_create_galaxy(*, name: str) -> GalaxyCommandPlan:
    return GalaxyCommandPlan(request_payload={"name": str(name)})


def plan_extinguish_galaxy(*, galaxy_id: UUID, expected_event_seq: int | None) -> GalaxyCommandPlan:
    return GalaxyCommandPlan(
        request_payload={
            "galaxy_id": str(galaxy_id),
            "expected_event_seq": int(expected_event_seq) if expected_event_seq is not None else None,
        }
    )


def plan_update_onboarding(*, action: str, mode: str | None, machine: dict[str, Any] | None) -> GalaxyCommandPlan:
    return GalaxyCommandPlan(
        request_payload={
            "action": str(action),
            "mode": str(mode) if mode is not None else None,
            "machine": dict(machine) if isinstance(machine, dict) else None,
        }
    )


async def create_galaxy(
    *,
    session: AsyncSession,
    services: Any,
    user_id: UUID,
    name: str,
) -> Any:
    try:
        return await services.auth_service.create_galaxy(
            session=session,
            user_id=user_id,
            name=name,
        )
    except Exception as exc:
        mapped = _map_service_exception(exc)
        if mapped is None:
            raise
        raise mapped from exc


async def extinguish_galaxy(
    *,
    session: AsyncSession,
    services: Any,
    user_id: UUID,
    galaxy_id: UUID,
    expected_event_seq: int | None,
) -> Any:
    try:
        return await services.auth_service.soft_delete_galaxy(
            session=session,
            user_id=user_id,
            galaxy_id=galaxy_id,
            expected_event_seq=expected_event_seq,
        )
    except Exception as exc:
        mapped = _map_service_exception(exc)
        if mapped is None:
            raise
        raise mapped from exc


async def update_onboarding(
    *,
    session: AsyncSession,
    services: Any,
    user_id: UUID,
    galaxy_id: UUID,
    payload: Any,
) -> Any:
    try:
        return await services.onboarding_service.update_public(
            session=session,
            user_id=user_id,
            galaxy_id=galaxy_id,
            payload=payload,
        )
    except Exception as exc:
        mapped = _map_service_exception(exc)
        if mapped is None:
            raise
        raise mapped from exc


__all__ = [
    "GalaxyCommandError",
    "GalaxyCommandPlan",
    "create_galaxy",
    "extinguish_galaxy",
    "plan_create_galaxy",
    "plan_extinguish_galaxy",
    "plan_update_onboarding",
    "update_onboarding",
]
