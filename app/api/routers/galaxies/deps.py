from __future__ import annotations

from uuid import UUID

from sqlalchemy.ext.asyncio import AsyncSession

from app.app_factory import ServiceContainer
from app.models import User


async def resolve_galaxy_scope(
    *,
    session: AsyncSession,
    current_user: User,
    services: ServiceContainer,
    galaxy_id: UUID,
    branch_id: UUID | None = None,
) -> tuple[UUID, UUID | None]:
    target_galaxy = await services.auth_service.resolve_user_galaxy(
        session=session,
        user_id=current_user.id,
        galaxy_id=galaxy_id,
    )
    target_branch_id = await services.cosmos_service.resolve_branch_id(
        session=session,
        user_id=current_user.id,
        galaxy_id=target_galaxy.id,
        branch_id=branch_id,
    )
    return target_galaxy.id, target_branch_id
