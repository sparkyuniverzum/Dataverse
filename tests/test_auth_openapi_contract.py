from app.modules.auth.dependencies import oauth2_scheme
from app.modules.auth.router import router as auth_router


def test_oauth2_scheme_points_to_swagger_token_endpoint() -> None:
    assert oauth2_scheme.model.flows.password is not None
    assert oauth2_scheme.model.flows.password.tokenUrl == "/auth/token"


def test_auth_router_exposes_oauth2_token_endpoint() -> None:
    token_routes = [route for route in auth_router.routes if getattr(route, "path", None) == "/auth/token"]
    assert len(token_routes) == 1
    assert "POST" in token_routes[0].methods
