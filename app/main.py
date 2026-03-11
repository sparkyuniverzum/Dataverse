from __future__ import annotations

import os

from app.api.routers.bonds import router as bonds_router
from app.api.routers.branches import router as branches_router
from app.api.routers.capabilities import router as capabilities_router
from app.api.routers.civilizations import router as asteroids_router
from app.api.routers.contracts import router as contracts_router
from app.api.routers.galaxies import router as galaxies_router
from app.api.routers.io import router as io_router
from app.api.routers.moons import router as civilization_capability_router
from app.api.routers.parser import router as parser_router
from app.api.routers.planets import router as planets_router
from app.api.routers.presets import router as presets_router
from app.api.routers.tasks import router as tasks_router
from app.api.routers.universe import router as universe_router
from app.app_factory import create_app
from app.logging_config import configure_json_logging
from app.middleware.resilience import RateLimitConfig, create_rate_limit_middleware
from app.middleware.shutdown_gate import create_shutdown_gate_middleware
from app.middleware.trace_context import create_trace_context_middleware
from app.modules.auth.router import router as auth_router
from app.telemetry import configure_open_telemetry

configure_json_logging()
configure_open_telemetry()
app = create_app()
app.middleware("http")(create_trace_context_middleware())
app.middleware("http")(create_shutdown_gate_middleware())
app.middleware("http")(
    create_rate_limit_middleware(
        RateLimitConfig(
            enabled=str(os.getenv("DATAVERSE_RATE_LIMIT_ENABLED", "1")).strip() not in {"0", "false", "False"},
            max_requests=int(os.getenv("DATAVERSE_RATE_LIMIT_MAX_REQUESTS", "300")),
            window_seconds=int(os.getenv("DATAVERSE_RATE_LIMIT_WINDOW_SECONDS", "60")),
        )
    )
)


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
app.include_router(civilization_capability_router)
app.include_router(capabilities_router)
