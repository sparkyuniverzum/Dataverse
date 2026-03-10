from __future__ import annotations

from typing import Any

from app.services.trace_context import current_trace_context


def structured_log_extra(
    *,
    event_name: str,
    module: str,
    trace_id: str | None = None,
    correlation_id: str | None = None,
    **fields: Any,
) -> dict[str, Any]:
    context_trace_id, context_correlation_id = current_trace_context()
    payload: dict[str, Any] = {
        "event_name": str(event_name or "").strip() or "log.event",
        "trace_id": str(trace_id or context_trace_id or "").strip() or "n/a",
        "correlation_id": str(correlation_id or context_correlation_id or "").strip() or "n/a",
        "module_name": str(module or "").strip() or "dataverse",
    }
    payload.update(fields)
    return payload
