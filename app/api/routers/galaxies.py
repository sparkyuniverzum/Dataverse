from __future__ import annotations

from uuid import UUID

from fastapi import APIRouter, Depends, Response, status
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.dependencies import get_current_user, get_db_session
from app.api.runtime import commit_if_active, services, transactional_context
from app.models import User

from app.api.routers.galaxies_core import router as core_router
from app.api.routers.galaxies_dashboard import router as dashboard_router
from app.api.routers.galaxies_onboarding import router as onboarding_router
from app.api.routers.galaxies_star_core import router as star_core_router
from app.api.routers.galaxies_stream import router as stream_router

router = APIRouter(prefix="/galaxies", tags=["galaxies"])
router.include_router(core_router)
router.include_router(dashboard_router)
router.include_router(onboarding_router)
router.include_router(star_core_router)
router.include_router(stream_router)


@router.delete("/{galaxy_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_galaxy(
    galaxy_id: UUID,
    session: AsyncSession = Depends(get_db_session),
    current_user: User = Depends(get_current_user),
) -> Response:
    async with transactional_context(session):
        await services.galaxy_lifecycle_service.delete_galaxy(
            session=session,
            user=current_user,
            galaxy_id=galaxy_id,
        )
    await commit_if_active(session)
    return Response(status_code=status.HTTP_204_NO_CONTENT)
