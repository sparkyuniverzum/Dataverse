from __future__ import annotations

from fastapi import APIRouter

from app.api.routers.galaxies_core import router as core_router
from app.api.routers.galaxies_dashboard import router as dashboard_router
from app.api.routers.galaxies_onboarding import router as onboarding_router
from app.api.routers.galaxies_star_core import router as star_core_router
from app.api.routers.galaxies_stream import router as stream_router

router = APIRouter(tags=["galaxies"])
router.include_router(core_router)
router.include_router(dashboard_router)
router.include_router(onboarding_router)
router.include_router(star_core_router)
router.include_router(stream_router)
