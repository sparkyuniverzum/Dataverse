from __future__ import annotations

from typing import Any
from uuid import UUID

from sqlalchemy.ext.asyncio import AsyncSession


class GalaxyQueryError(Exception):
    def __init__(self, *, status_code: int, detail: Any) -> None:
        super().__init__(str(detail))
        self.status_code = int(status_code)
        self.detail = detail


class GalaxyQueryNotFoundError(GalaxyQueryError):
    def __init__(self, detail: Any) -> None:
        super().__init__(status_code=404, detail=detail)


class GalaxyQueryConflictError(GalaxyQueryError):
    def __init__(self, detail: Any) -> None:
        super().__init__(status_code=409, detail=detail)


class GalaxyQueryForbiddenError(GalaxyQueryError):
    def __init__(self, detail: Any) -> None:
        super().__init__(status_code=403, detail=detail)


def _map_service_exception(exc: Exception) -> GalaxyQueryError | None:
    status_code_raw = getattr(exc, "status_code", None)
    detail = getattr(exc, "detail", str(exc))
    if not isinstance(status_code_raw, int):
        return None
    status_code = int(status_code_raw)
    if status_code == 404:
        return GalaxyQueryNotFoundError(detail)
    if status_code == 409:
        return GalaxyQueryConflictError(detail)
    if status_code == 403:
        return GalaxyQueryForbiddenError(detail)
    return GalaxyQueryError(status_code=status_code, detail=detail)


async def list_galaxies(
    *,
    session: AsyncSession,
    services: Any,
    user_id: UUID,
) -> list[Any]:
    try:
        rows = await services.auth_service.list_galaxies(
            session=session,
            user_id=user_id,
        )
    except Exception as exc:
        mapped = _map_service_exception(exc)
        if mapped is None:
            raise
        raise mapped from exc
    return list(rows)


async def resolve_user_galaxy(
    *,
    session: AsyncSession,
    services: Any,
    user_id: UUID,
    galaxy_id: UUID | None,
) -> Any:
    try:
        return await services.auth_service.resolve_user_galaxy(
            session=session,
            user_id=user_id,
            galaxy_id=galaxy_id,
        )
    except Exception as exc:
        mapped = _map_service_exception(exc)
        if mapped is None:
            raise
        raise mapped from exc


async def resolve_galaxy_scope(
    *,
    session: AsyncSession,
    services: Any,
    user_id: UUID,
    galaxy_id: UUID,
    branch_id: UUID | None = None,
) -> tuple[UUID, UUID | None]:
    target_galaxy = await resolve_user_galaxy(
        session=session,
        services=services,
        user_id=user_id,
        galaxy_id=galaxy_id,
    )
    try:
        target_branch_id = await services.cosmos_service.resolve_branch_id(
            session=session,
            user_id=user_id,
            galaxy_id=target_galaxy.id,
            branch_id=branch_id,
        )
    except Exception as exc:
        mapped = _map_service_exception(exc)
        if mapped is None:
            raise
        raise mapped from exc
    return target_galaxy.id, target_branch_id


__all__ = [
    "GalaxyQueryConflictError",
    "GalaxyQueryError",
    "GalaxyQueryForbiddenError",
    "GalaxyQueryNotFoundError",
    "list_galaxies",
    "resolve_galaxy_scope",
    "resolve_user_galaxy",
]
