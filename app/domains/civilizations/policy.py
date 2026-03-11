from __future__ import annotations

from collections.abc import Collection, Mapping
from typing import Any


class CivilizationPolicyError(ValueError):
    def __init__(
        self,
        *,
        code: str,
        message: str,
        context: dict[str, Any] | None = None,
    ) -> None:
        self.code = str(code).strip().upper()
        self.message = str(message)
        self.context = context if isinstance(context, dict) else None
        super().__init__(self.message)

    def to_detail(self) -> dict[str, Any]:
        detail: dict[str, Any] = {
            "code": self.code,
            "message": self.message,
        }
        if isinstance(self.context, dict) and self.context:
            detail.update(self.context)
        return detail


def _normalize_reserved_keys(reserved_keys: Collection[str]) -> set[str]:
    return {str(key or "").strip().lower() for key in reserved_keys if str(key or "").strip()}


def normalize_civilization_metadata_patch(
    metadata: Mapping[str, Any] | None,
    *,
    reserved_keys: Collection[str],
) -> dict[str, Any]:
    patch = dict(metadata or {})
    normalized_reserved = _normalize_reserved_keys(reserved_keys)
    blocked_keys = sorted({str(key) for key in patch.keys() if str(key or "").strip().lower() in normalized_reserved})
    if blocked_keys:
        raise CivilizationPolicyError(
            code="RESERVED_METADATA_KEYS_NOT_ALLOWED",
            message="Use mineral endpoint for mineral writes; reserved metadata keys are blocked on /mutate.",
            context={
                "keys": blocked_keys,
                "repair_hint": "Use PATCH /civilizations/{civilization_id}/minerals/{mineral_key} for minerals.",
            },
        )
    return patch


def normalize_mineral_key(
    raw_key: str,
    *,
    reserved_keys: Collection[str],
) -> str:
    key = str(raw_key or "").strip()
    if not key:
        raise CivilizationPolicyError(
            code="MINERAL_KEY_EMPTY",
            message="`mineral_key` must be non-empty",
        )
    normalized_reserved = _normalize_reserved_keys(reserved_keys)
    if key.lower() in normalized_reserved:
        raise CivilizationPolicyError(
            code="MINERAL_KEY_RESERVED",
            message=f"`{key}` is reserved and cannot be mutated as mineral key",
        )
    return key
