from __future__ import annotations

from fastapi import HTTPException, status

MATRIX_VERSION = "v1"
MATRIX_CONFLICT_CODE = "MOON_CAPABILITY_MATRIX_CONFLICT"
MATRIX_FORBIDDEN_REASON_SAME_KEY_CLASS_CHANGE = "capability_class_change_forbidden"
SUPPORTED_CAPABILITY_CLASSES = frozenset({"dictionary", "validation", "formula", "bridge"})


def build_class_change_conflict_detail(
    *,
    capability_key: str,
    current_class: str,
    requested_class: str,
) -> dict[str, object]:
    return {
        "code": MATRIX_CONFLICT_CODE,
        "reason": MATRIX_FORBIDDEN_REASON_SAME_KEY_CLASS_CHANGE,
        "matrix_version": MATRIX_VERSION,
        "capability_key": str(capability_key),
        "current_class": str(current_class),
        "requested_class": str(requested_class),
        "message": (
            "Moon capability class transition is forbidden for the same capability_key "
            f"('{capability_key}'): {current_class} -> {requested_class}"
        ),
    }


def ensure_capability_matrix_transition(
    *,
    capability_key: str,
    current_class: str,
    requested_class: str,
) -> None:
    normalized_current = str(current_class or "").strip().lower()
    normalized_requested = str(requested_class or "").strip().lower()
    if normalized_current == normalized_requested:
        return
    raise HTTPException(
        status_code=status.HTTP_409_CONFLICT,
        detail=build_class_change_conflict_detail(
            capability_key=capability_key,
            current_class=normalized_current,
            requested_class=normalized_requested,
        ),
    )
