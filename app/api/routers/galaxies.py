from __future__ import annotations

from fastapi import APIRouter

from app.api.routers.galaxies import (
    core_router,
    dashboard_router,
    onboarding_router,
    star_core_router,
    stream_router,
)

router = APIRouter(tags=["galaxies"])
router.include_router(core_router)
router.include_router(dashboard_router)
router.include_router(onboarding_router)
router.include_router(star_core_router)
router.include_router(stream_router)
