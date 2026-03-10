from fastapi import APIRouter

from app.api.routers.galaxies.core import router as core_router
from app.api.routers.galaxies.dashboard import router as dashboard_router
from app.api.routers.galaxies.onboarding import router as onboarding_router
from app.api.routers.galaxies.star_core import router as star_core_router
from app.api.routers.galaxies.stream import router as stream_router

router = APIRouter(tags=["galaxies"])
router.include_router(core_router)
router.include_router(dashboard_router)
router.include_router(onboarding_router)
router.include_router(star_core_router)
router.include_router(stream_router)

__all__ = [
    "core_router",
    "dashboard_router",
    "onboarding_router",
    "router",
    "star_core_router",
    "stream_router",
]
