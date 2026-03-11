from __future__ import annotations

from dataclasses import dataclass
from datetime import datetime
from typing import Any
from uuid import UUID

from sqlalchemy.ext.asyncio import AsyncSession


class BranchCommandError(Exception):
    def __init__(self, *, status_code: int, detail: Any) -> None:
        super().__init__(str(detail))
        self.status_code = int(status_code)
        self.detail = detail


@dataclass(frozen=True)
class BranchCommandPlan:
    request_payload: dict[str, Any]


def _map_service_exception(exc: Exception) -> BranchCommandError | None:
    status_code_raw = getattr(exc, "status_code", None)
    detail = getattr(exc, "detail", str(exc))
    if not isinstance(status_code_raw, int):
        return None
    return BranchCommandError(status_code=int(status_code_raw), detail=detail)


def plan_create_branch(*, galaxy_id: UUID | None, name: str, as_of: datetime | None) -> BranchCommandPlan:
    return BranchCommandPlan(
        request_payload={
            "galaxy_id": str(galaxy_id) if galaxy_id is not None else None,
            "name": str(name),
            "as_of": as_of,
        }
    )


def plan_promote_branch(*, branch_id: UUID, galaxy_id: UUID | None) -> BranchCommandPlan:
    return BranchCommandPlan(
        request_payload={
            "branch_id": str(branch_id),
            "galaxy_id": str(galaxy_id) if galaxy_id is not None else None,
        }
    )


def plan_close_branch(*, branch_id: UUID, galaxy_id: UUID | None) -> BranchCommandPlan:
    return BranchCommandPlan(
        request_payload={
            "branch_id": str(branch_id),
            "galaxy_id": str(galaxy_id) if galaxy_id is not None else None,
        }
    )


async def create_branch(
    *,
    session: AsyncSession,
    services: Any,
    user_id: UUID,
    galaxy_id: UUID | None,
    name: str,
    as_of: datetime | None,
) -> Any:
    try:
        return await services.cosmos_service.create_branch(
            session=session,
            user_id=user_id,
            galaxy_id=galaxy_id,
            name=name,
            as_of=as_of,
        )
    except Exception as exc:
        mapped = _map_service_exception(exc)
        if mapped is None:
            raise
        raise mapped from exc


async def promote_branch(
    *,
    session: AsyncSession,
    services: Any,
    user_id: UUID,
    branch_id: UUID,
    galaxy_id: UUID | None,
) -> tuple[Any, int]:
    try:
        return await services.cosmos_service.promote_branch(
            session=session,
            user_id=user_id,
            galaxy_id=galaxy_id,
            branch_id=branch_id,
        )
    except Exception as exc:
        mapped = _map_service_exception(exc)
        if mapped is None:
            raise
        raise mapped from exc


async def close_branch(
    *,
    session: AsyncSession,
    services: Any,
    user_id: UUID,
    branch_id: UUID,
    galaxy_id: UUID | None,
) -> Any:
    try:
        return await services.cosmos_service.close_branch(
            session=session,
            user_id=user_id,
            galaxy_id=galaxy_id,
            branch_id=branch_id,
        )
    except Exception as exc:
        mapped = _map_service_exception(exc)
        if mapped is None:
            raise
        raise mapped from exc


__all__ = [
    "BranchCommandError",
    "BranchCommandPlan",
    "close_branch",
    "create_branch",
    "plan_close_branch",
    "plan_create_branch",
    "plan_promote_branch",
    "promote_branch",
]
