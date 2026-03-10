from __future__ import annotations

from fastapi.responses import JSONResponse
from starlette.requests import Request

from app.api.error_envelopes import resilience_error_detail


def create_shutdown_gate_middleware():
    async def middleware(request: Request, call_next):
        accepting_requests = bool(getattr(request.app.state, "accepting_requests", True))
        if accepting_requests:
            return await call_next(request)

        return JSONResponse(
            status_code=503,
            content={
                "detail": resilience_error_detail(
                    code="SERVICE_SHUTTING_DOWN",
                    message="Service is shutting down and no longer accepts new requests.",
                    service="http.shutdown_gate",
                )
            },
        )

    return middleware
