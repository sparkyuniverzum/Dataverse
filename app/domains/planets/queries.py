from __future__ import annotations

from typing import Any
from uuid import UUID

from sqlalchemy.ext.asyncio import AsyncSession


class PlanetQueryNotFoundError(LookupError):
    pass


class PlanetQueryConflictError(ValueError):
    pass


class PlanetQueryForbiddenError(PermissionError):
    pass


def _map_scope_exception(exc: Exception) -> Exception | None:
    status_code_raw = getattr(exc, "status_code", None)
    detail = getattr(exc, "detail", str(exc))
    if not isinstance(status_code_raw, int):
        return None
    message = str(detail or "Planet query failed")
    status_code = int(status_code_raw or 500)
    if status_code == 404:
        return PlanetQueryNotFoundError(message)
    if status_code == 409:
        return PlanetQueryConflictError(message)
    if status_code == 403:
        return PlanetQueryForbiddenError(message)
    return None


async def list_planet_tables(
    *,
    session: AsyncSession,
    services: Any,
    user_id: UUID,
    galaxy_id: UUID,
    branch_id: UUID | None,
) -> list[dict[str, Any]]:
    try:
        rows = await services.universe_service.tables_snapshot(
            session=session,
            user_id=user_id,
            galaxy_id=galaxy_id,
            branch_id=branch_id,
            as_of=None,
        )
    except Exception as exc:
        mapped = _map_scope_exception(exc)
        if mapped is None:
            raise
        raise mapped from exc
    return list(rows)


async def get_planet_table(
    *,
    session: AsyncSession,
    services: Any,
    user_id: UUID,
    galaxy_id: UUID,
    branch_id: UUID | None,
    table_id: UUID,
) -> dict[str, Any]:
    tables = await list_planet_tables(
        session=session,
        services=services,
        user_id=user_id,
        galaxy_id=galaxy_id,
        branch_id=branch_id,
    )
    row = next((item for item in tables if item.get("table_id") == table_id), None)
    if row is None:
        raise PlanetQueryNotFoundError("Planet not found")
    return row


async def list_latest_planet_contracts(
    *,
    session: AsyncSession,
    services: Any,
    user_id: UUID,
    galaxy_id: UUID,
    table_ids: list[UUID] | None = None,
) -> dict[UUID, Any]:
    try:
        return await services.cosmos_service.list_latest_table_contracts(
            session=session,
            user_id=user_id,
            galaxy_id=galaxy_id,
            table_ids=table_ids,
        )
    except Exception as exc:
        mapped = _map_scope_exception(exc)
        if mapped is None:
            raise
        raise mapped from exc


__all__ = [
    "PlanetQueryConflictError",
    "PlanetQueryForbiddenError",
    "PlanetQueryNotFoundError",
    "get_planet_table",
    "list_latest_planet_contracts",
    "list_planet_tables",
]
