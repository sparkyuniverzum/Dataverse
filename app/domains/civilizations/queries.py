from __future__ import annotations

from typing import Any
from uuid import UUID

from sqlalchemy.ext.asyncio import AsyncSession


class CivilizationQueryNotFoundError(LookupError):
    pass


class CivilizationQueryConflictError(ValueError):
    pass


async def list_active_civilizations(
    *,
    session: AsyncSession,
    services: Any,
    user_id: UUID,
    galaxy_id: UUID,
    branch_id: UUID | None,
) -> list[Any]:
    civilizations, _ = await services.universe_service.snapshot(
        session=session,
        user_id=user_id,
        galaxy_id=galaxy_id,
        branch_id=branch_id,
    )
    return list(civilizations)


async def get_active_civilization(
    *,
    session: AsyncSession,
    services: Any,
    user_id: UUID,
    galaxy_id: UUID,
    branch_id: UUID | None,
    civilization_id: UUID,
) -> Any:
    civilizations = await list_active_civilizations(
        session=session,
        services=services,
        user_id=user_id,
        galaxy_id=galaxy_id,
        branch_id=branch_id,
    )
    for civilization in civilizations:
        source_id = civilization.get("id") if isinstance(civilization, dict) else getattr(civilization, "id", None)
        if str(source_id or "") == str(civilization_id):
            return civilization
    raise CivilizationQueryNotFoundError("Civilization not found")


async def resolve_planet_table_name(
    *,
    session: AsyncSession,
    services: Any,
    user_id: UUID,
    galaxy_id: UUID,
    branch_id: UUID | None,
    planet_id: UUID,
) -> str:
    tables = await services.universe_service.tables_snapshot(
        session=session,
        user_id=user_id,
        galaxy_id=galaxy_id,
        branch_id=branch_id,
    )
    row = next((item for item in tables if str(item.get("table_id") or "") == str(planet_id)), None)
    if row is None:
        raise CivilizationQueryNotFoundError("Planet not found")
    table_name = str(row.get("name") or "").strip()
    if not table_name:
        raise CivilizationQueryConflictError("Planet table name is not resolved")
    return table_name


__all__ = [
    "CivilizationQueryConflictError",
    "CivilizationQueryNotFoundError",
    "get_active_civilization",
    "list_active_civilizations",
    "resolve_planet_table_name",
]
