from __future__ import annotations

from dataclasses import dataclass
from typing import Any
from uuid import UUID


class MoonCapabilityPolicyError(ValueError):
    pass


@dataclass(frozen=True)
class MoonCapabilityCommandPlan:
    request_payload: dict[str, Any]


def ensure_main_timeline(*, branch_id: UUID | None) -> None:
    if branch_id is not None:
        raise MoonCapabilityPolicyError(
            "Capability lifecycle operations are allowed only on main timeline.",
        )


def plan_upsert_moon_capability(
    *,
    planet_id: UUID,
    capability_key: str,
    capability_class: str,
    config: dict[str, Any] | None,
    order_index: int,
    status: str,
) -> MoonCapabilityCommandPlan:
    normalized_config = dict(config or {})
    return MoonCapabilityCommandPlan(
        request_payload={
            "planet_id": str(planet_id),
            "capability_key": capability_key,
            "capability_class": capability_class,
            "config": normalized_config,
            "order_index": int(order_index),
            "status": status,
        }
    )


def plan_update_moon_capability(
    *,
    capability_id: UUID,
    capability_class: str | None,
    config: dict[str, Any] | None,
    order_index: int | None,
    status: str | None,
    expected_version: int | None,
) -> MoonCapabilityCommandPlan:
    normalized_config = dict(config) if isinstance(config, dict) else config
    return MoonCapabilityCommandPlan(
        request_payload={
            "capability_id": str(capability_id),
            "capability_class": capability_class,
            "config": normalized_config,
            "order_index": int(order_index) if order_index is not None else None,
            "status": status,
            "expected_version": int(expected_version) if expected_version is not None else None,
        }
    )


def plan_deprecate_moon_capability(
    *,
    capability_id: UUID,
    expected_version: int | None,
) -> MoonCapabilityCommandPlan:
    return MoonCapabilityCommandPlan(
        request_payload={
            "capability_id": str(capability_id),
            "expected_version": int(expected_version) if expected_version is not None else None,
        }
    )


__all__ = [
    "MoonCapabilityCommandPlan",
    "MoonCapabilityPolicyError",
    "ensure_main_timeline",
    "plan_deprecate_moon_capability",
    "plan_update_moon_capability",
    "plan_upsert_moon_capability",
]
