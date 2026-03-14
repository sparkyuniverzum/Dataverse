from __future__ import annotations

from fastapi.routing import APIRoute

from app.api.routers import (
    branches as branches_router_module,
    capabilities as capabilities_router_module,
    civilizations_view as civilizations_view_router_module,
    contracts as contracts_router_module,
    galaxies as galaxies_router_package,
    io as io_router_module,
    planets as planets_router_module,
    presets as presets_router_module,
    universe as universe_router_module,
)
from app.db import get_read_session, get_session


def _route_by_path(router, path: str, method: str) -> APIRoute:
    method_upper = method.upper()
    for route in router.routes:
        if not isinstance(route, APIRoute):
            continue
        if route.path == path and method_upper in route.methods:
            return route
    raise AssertionError(f"Route not found: {method_upper} {path}")


def _has_dependency(route: APIRoute, dependency) -> bool:
    for item in route.dependant.dependencies:
        if item.call is dependency:
            return True
    return False


def test_galaxies_dashboard_get_routes_use_read_session_dependency() -> None:
    router = galaxies_router_package.dashboard_router
    expected_paths = [
        "/galaxies/{galaxy_id}/summary",
        "/galaxies/{galaxy_id}/health",
        "/galaxies/{galaxy_id}/activity",
        "/galaxies/{galaxy_id}/constellations",
        "/galaxies/{galaxy_id}/planets",
        "/galaxies/{galaxy_id}/moons",
        "/galaxies/{galaxy_id}/bonds",
    ]
    for path in expected_paths:
        route = _route_by_path(router, path, "GET")
        assert _has_dependency(route, get_read_session), f"{path} should depend on get_read_session"
        assert not _has_dependency(route, get_session), f"{path} should not depend on get_session"


def test_star_core_get_routes_use_read_and_post_routes_keep_write_dependency() -> None:
    router = galaxies_router_package.star_core_router
    get_paths = [
        "/galaxies/{galaxy_id}/star-core/policy",
        "/galaxies/{galaxy_id}/star-core/interior",
        "/galaxies/{galaxy_id}/star-core/physics/profile",
        "/galaxies/{galaxy_id}/star-core/physics/planets",
        "/galaxies/{galaxy_id}/star-core/runtime",
        "/galaxies/{galaxy_id}/star-core/pulse",
        "/galaxies/{galaxy_id}/star-core/metrics/domains",
    ]
    post_paths = [
        "/galaxies/{galaxy_id}/star-core/interior/entry/start",
        "/galaxies/{galaxy_id}/star-core/interior/constitution/select",
        "/galaxies/{galaxy_id}/star-core/policy/lock",
        "/galaxies/{galaxy_id}/star-core/physics/profile/migrate",
        "/star-core/outbox/run-once",
    ]

    for path in get_paths:
        route = _route_by_path(router, path, "GET")
        assert _has_dependency(route, get_read_session), f"{path} should depend on get_read_session"
        assert not _has_dependency(route, get_session), f"{path} should not depend on get_session"

    for path in post_paths:
        route = _route_by_path(router, path, "POST")
        assert _has_dependency(route, get_session), f"{path} should depend on get_session"


def test_read_heavy_routers_get_routes_use_read_session_dependency() -> None:
    cases = [
        (branches_router_module.router, "GET", "/branches"),
        (contracts_router_module.router, "GET", "/contracts/{table_id}"),
        (galaxies_router_package.core_router, "GET", "/galaxies"),
        (galaxies_router_package.onboarding_router, "GET", "/galaxies/{galaxy_id}/onboarding"),
        (universe_router_module.router, "GET", "/universe/snapshot"),
        (universe_router_module.router, "GET", "/universe/tables"),
        (io_router_module.router, "GET", "/io/imports/{job_id}"),
        (io_router_module.router, "GET", "/io/imports/{job_id}/errors"),
        (io_router_module.router, "GET", "/io/exports/snapshot"),
        (io_router_module.router, "GET", "/io/exports/tables"),
        (presets_router_module.router, "GET", "/presets/catalog"),
        (planets_router_module.router, "GET", "/planets"),
        (planets_router_module.router, "GET", "/planets/{table_id}"),
        (planets_router_module.router, "GET", "/planets/{planet_id}/moon-impact"),
        (civilizations_view_router_module.router, "GET", "/civilizations"),
        (civilizations_view_router_module.router, "GET", "/civilizations/{civilization_id}"),
        (capabilities_router_module.router, "GET", "/planets/{planet_id}/capabilities"),
    ]
    for router, method, path in cases:
        route = _route_by_path(router, path, method)
        assert _has_dependency(route, get_read_session), f"{path} should depend on get_read_session"
        assert not _has_dependency(route, get_session), f"{path} should not depend on get_session"
