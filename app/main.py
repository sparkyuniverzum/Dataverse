from __future__ import annotations

from fastapi import Request

from app.api.routers.bonds import router as bonds_router
from app.api.routers.branches import router as branches_router
from app.api.routers.capabilities import router as capabilities_router
from app.api.routers.civilizations import router as asteroids_router
from app.api.routers.contracts import router as contracts_router
from app.api.routers.galaxies import router as galaxies_router
from app.api.routers.io import router as io_router
from app.api.routers.moons import router as moons_router
from app.api.routers.parser import router as parser_router
from app.api.routers.planets import router as planets_router
from app.api.routers.presets import router as presets_router
from app.api.routers.tasks import router as tasks_router
from app.api.routers.universe import router as universe_router
from app.app_factory import create_app
from app.modules.auth.router import router as auth_router

app = create_app()


def _is_moons_alias_path(path: str) -> bool:
    normalized = str(path or "").strip()
    return normalized == "/moons" or normalized.startswith("/moons/")


@app.middleware("http")
async def moons_alias_deprecation_middleware(request: Request, call_next):
    response = await call_next(request)
    if _is_moons_alias_path(request.url.path):
        response.headers["X-Dataverse-Deprecated-Alias"] = "true"
        response.headers["X-Dataverse-Canonical-Route"] = "/civilizations"
    return response


app.include_router(auth_router)
app.include_router(galaxies_router)
app.include_router(branches_router)
app.include_router(contracts_router)
app.include_router(presets_router)
app.include_router(asteroids_router)
app.include_router(bonds_router)
app.include_router(parser_router)
app.include_router(tasks_router)
app.include_router(universe_router)
app.include_router(io_router)
app.include_router(planets_router)
app.include_router(moons_router)
app.include_router(capabilities_router)
