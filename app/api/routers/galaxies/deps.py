from __future__ import annotations

from uuid import UUID

from fastapi import HTTPException
from sqlalchemy.ext.asyncio import AsyncSession

from app.app_factory import ServiceContainer
from app.domains.galaxies.queries import GalaxyQueryError, resolve_galaxy_scope as resolve_galaxy_scope_query
from app.models import User


async def resolve_galaxy_scope(
    *,
    session: AsyncSession,
    current_user: User,
    services: ServiceContainer,
    galaxy_id: UUID,
    branch_id: UUID | None = None,
) -> tuple[UUID, UUID | None]:
    try:
        return await resolve_galaxy_scope_query(
            session=session,
            services=services,
            user_id=current_user.id,
            galaxy_id=galaxy_id,
            branch_id=branch_id,
        )
    except GalaxyQueryError as exc:
        raise HTTPException(status_code=exc.status_code, detail=exc.detail) from exc
