from __future__ import annotations

import asyncio
import json
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, Query, Request, status
from fastapi.responses import StreamingResponse

from app.api.runtime import get_service_container
from app.app_factory import ServiceContainer
from app.db import AsyncSessionLocal
from app.domains.galaxies.queries import GalaxyQueryError, resolve_galaxy_scope as resolve_galaxy_scope_query
from app.models import User
from app.modules.auth.dependencies import get_current_user

router = APIRouter(tags=["galaxies"])


def sse_frame(*, event: str, data: dict, event_id: int | None = None) -> str:
    lines: list[str] = []
    if event_id is not None:
        lines.append(f"id: {event_id}")
    lines.append(f"event: {event}")
    payload = json.dumps(dict(data), ensure_ascii=False, separators=(",", ":"))
    lines.append(f"data: {payload}")
    return "\n".join(lines) + "\n\n"


@router.get("/galaxies/{galaxy_id}/events/stream", status_code=status.HTTP_200_OK)
async def galaxy_events_stream(
    galaxy_id: UUID,
    request: Request,
    branch_id: UUID | None = Query(default=None),
    last_event_seq: int | None = Query(default=None, ge=0),
    poll_ms: int = Query(default=1200, ge=300, le=10000),
    heartbeat_sec: int = Query(default=15, ge=5, le=60),
    batch_size: int = Query(default=64, ge=1, le=256),
    current_user: User = Depends(get_current_user),
    services: ServiceContainer = Depends(get_service_container),
) -> StreamingResponse:
    async with AsyncSessionLocal() as bootstrap_session:
        try:
            target_galaxy_id, target_branch_id = await resolve_galaxy_scope_query(
                session=bootstrap_session,
                services=services,
                user_id=current_user.id,
                galaxy_id=galaxy_id,
                branch_id=branch_id,
            )
        except GalaxyQueryError as exc:
            raise HTTPException(status_code=exc.status_code, detail=exc.detail) from exc
        initial_cursor = (
            int(last_event_seq)
            if last_event_seq is not None
            else await services.event_store.latest_event_seq(
                session=bootstrap_session,
                user_id=current_user.id,
                galaxy_id=target_galaxy_id,
                branch_id=target_branch_id,
            )
        )

    poll_seconds = max(0.3, poll_ms / 1000.0)
    heartbeat_ticks = max(1, int(round(heartbeat_sec / poll_seconds)))

    async def event_generator():
        cursor = max(0, initial_cursor)
        idle_ticks = 0

        yield sse_frame(
            event="ready",
            event_id=cursor if cursor > 0 else None,
            data={
                "last_event_seq": cursor,
                "poll_ms": poll_ms,
                "heartbeat_sec": heartbeat_sec,
            },
        )

        try:
            while True:
                if request is not None and await request.is_disconnected():
                    break

                async with AsyncSessionLocal() as stream_session:
                    events = await services.event_store.list_events_after(
                        session=stream_session,
                        user_id=current_user.id,
                        galaxy_id=target_galaxy_id,
                        branch_id=target_branch_id,
                        after_event_seq=cursor,
                        limit=batch_size,
                    )

                if events:
                    cursor = int(events[-1].event_seq)
                    event_types = sorted({str(event.event_type or "") for event in events if event.event_type})
                    entity_ids = sorted({str(event.entity_id) for event in events if event.entity_id is not None})
                    serialized_events = [
                        {
                            "event_seq": int(event.event_seq),
                            "event_type": str(event.event_type or ""),
                            "entity_id": str(event.entity_id),
                            "payload": event.payload if isinstance(event.payload, dict) else {},
                            "timestamp": event.timestamp.isoformat(),
                        }
                        for event in events
                    ]
                    yield sse_frame(
                        event="update",
                        event_id=cursor,
                        data={
                            "last_event_seq": cursor,
                            "events_count": len(events),
                            "event_types": event_types,
                            "entity_ids": entity_ids[:24],
                            "events": serialized_events,
                        },
                    )
                    idle_ticks = 0
                    continue

                idle_ticks += 1
                if idle_ticks >= heartbeat_ticks:
                    yield sse_frame(
                        event="keepalive",
                        event_id=cursor if cursor > 0 else None,
                        data={"last_event_seq": cursor},
                    )
                    idle_ticks = 0

                await asyncio.sleep(poll_seconds)
        except asyncio.CancelledError:
            return

    headers = {
        "Cache-Control": "no-cache",
        "Connection": "keep-alive",
        "X-Accel-Buffering": "no",
    }
    return StreamingResponse(event_generator(), media_type="text/event-stream", headers=headers)
