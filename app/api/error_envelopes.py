from __future__ import annotations

from typing import Any


def resilience_error_detail(
    *,
    code: str,
    message: str,
    service: str | None = None,
    retry_after_seconds: int | None = None,
    **extra: Any,
) -> dict[str, Any]:
    detail: dict[str, Any] = {
        "code": str(code or "").strip() or "RESILIENCE_ERROR",
        "message": str(message or "").strip() or "Request rejected by resilience policy.",
    }
    normalized_service = str(service or "").strip()
    if normalized_service:
        detail["service"] = normalized_service
    if retry_after_seconds is not None:
        detail["retry_after_seconds"] = int(retry_after_seconds)
    detail.update(extra)
    return detail
