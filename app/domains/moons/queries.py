from __future__ import annotations

from typing import Any
from uuid import UUID

from sqlalchemy.ext.asyncio import AsyncSession


class MoonCapabilityQueryNotFoundError(LookupError):
    pass


class MoonCapabilityQueryConflictError(ValueError):
    pass


class MoonCapabilityQueryForbiddenError(PermissionError):
    pass


def _map_scope_exception(exc: Exception) -> Exception | None:
    status_code_raw = getattr(exc, "status_code", None)
    detail = getattr(exc, "detail", str(exc))
    if not isinstance(status_code_raw, int):
        return None
    message = str(detail or "Moon capability query failed")
    status_code = int(status_code_raw or 500)
    if status_code == 404:
        return MoonCapabilityQueryNotFoundError(message)
    if status_code == 409:
        return MoonCapabilityQueryConflictError(message)
    if status_code == 403:
        return MoonCapabilityQueryForbiddenError(message)
    return None


async def list_planet_capabilities(
    *,
    session: AsyncSession,
    services: Any,
    user_id: UUID,
    galaxy_id: UUID,
    planet_id: UUID,
    include_inactive: bool = False,
    include_history: bool = False,
) -> list[Any]:
    try:
        rows = await services.cosmos_service.list_moon_capabilities(
            session=session,
            user_id=user_id,
            galaxy_id=galaxy_id,
            table_id=planet_id,
            include_inactive=include_inactive,
            include_history=include_history,
        )
    except Exception as exc:
        mapped = _map_scope_exception(exc)
        if mapped is None:
            raise
        raise mapped from exc
    return list(rows)


__all__ = [
    "MoonCapabilityQueryConflictError",
    "MoonCapabilityQueryForbiddenError",
    "MoonCapabilityQueryNotFoundError",
    "list_planet_capabilities",
]
