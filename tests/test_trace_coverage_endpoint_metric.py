from __future__ import annotations

import asyncio

from fastapi import APIRouter, FastAPI, HTTPException
from httpx import ASGITransport, AsyncClient

from app.middleware.trace_context import create_trace_context_middleware


def _build_app() -> FastAPI:
    app = FastAPI()
    app.middleware("http")(create_trace_context_middleware())
    router = APIRouter()

    @router.get("/coverage/health")
    async def coverage_health():
        return {"ok": True}

    @router.get("/coverage/items/{item_id}")
    async def coverage_get_item(item_id: int):
        return {"item_id": item_id}

    @router.post("/coverage/items")
    async def coverage_create_item(payload: dict):
        return {"created": payload}

    @router.patch("/coverage/items/{item_id}")
    async def coverage_patch_item(item_id: int, payload: dict):
        return {"item_id": item_id, "patched": payload}

    @router.get("/coverage/error")
    async def coverage_error():
        raise HTTPException(status_code=400, detail="forced")

    app.include_router(router)
    return app


def test_trace_coverage_metric_for_router_endpoints_is_at_least_95_percent() -> None:
    async def run() -> None:
        app = _build_app()
        checks: list[bool] = []
        transport = ASGITransport(app=app)
        async with AsyncClient(transport=transport, base_url="http://testserver") as client:
            response = await client.get("/coverage/health")
            checks.append(bool(response.headers.get("X-Trace-Id")) and bool(response.headers.get("X-Correlation-Id")))

            response = await client.get("/coverage/items/7", headers={"x-request-id": "req-7"})
            checks.append(response.headers.get("X-Trace-Id") == "req-7")
            checks.append(response.headers.get("X-Correlation-Id") == "req-7")

            response = await client.post(
                "/coverage/items",
                json={"name": "A"},
                headers={"x-correlation-id": "corr-post"},
            )
            checks.append(bool(response.headers.get("X-Trace-Id")))
            checks.append(response.headers.get("X-Correlation-Id") == "corr-post")

            response = await client.patch(
                "/coverage/items/11",
                json={"state": "ok"},
                headers={"x-trace-id": "trace-patch"},
            )
            checks.append(response.headers.get("X-Trace-Id") == "trace-patch")
            checks.append(response.headers.get("X-Correlation-Id") == "trace-patch")

            response = await client.get("/coverage/error")
            checks.append(response.status_code == 400)
            checks.append(bool(response.headers.get("X-Trace-Id")) and bool(response.headers.get("X-Correlation-Id")))

        total = len(checks)
        passed = sum(1 for item in checks if item)
        coverage = passed / total if total else 0.0
        assert coverage >= 0.95, f"trace coverage expected >= 0.95, got {coverage:.3f} ({passed}/{total})"

    asyncio.run(run())
