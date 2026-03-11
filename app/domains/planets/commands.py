from __future__ import annotations

from dataclasses import dataclass
from typing import Any
from uuid import UUID


class PlanetPolicyError(ValueError):
    pass


@dataclass(frozen=True)
class PlanetCommandPlan:
    request_payload: dict[str, Any]


def ensure_main_timeline(*, branch_id: UUID | None) -> None:
    if branch_id is not None:
        raise PlanetPolicyError("Planet lifecycle operations are allowed only on main timeline.")


def ensure_planet_empty_for_extinguish(*, table_payload: dict[str, Any]) -> None:
    members = table_payload.get("members") if isinstance(table_payload.get("members"), list) else []
    internal_bonds = (
        table_payload.get("internal_bonds") if isinstance(table_payload.get("internal_bonds"), list) else []
    )
    external_bonds = (
        table_payload.get("external_bonds") if isinstance(table_payload.get("external_bonds"), list) else []
    )
    if members or internal_bonds or external_bonds:
        raise PlanetPolicyError("Planet is not empty. Extinguish moons and bonds first.")


def plan_create_planet(
    *,
    name: str,
    archetype: str,
    initial_schema_mode: str,
    schema_preset_key: str | None,
    seed_rows: bool,
    visual_position: dict[str, float] | None,
) -> PlanetCommandPlan:
    return PlanetCommandPlan(
        request_payload={
            "name": str(name),
            "archetype": str(archetype),
            "initial_schema_mode": str(initial_schema_mode),
            "schema_preset_key": str(schema_preset_key) if schema_preset_key is not None else None,
            "seed_rows": bool(seed_rows),
            "visual_position": dict(visual_position) if isinstance(visual_position, dict) else None,
        }
    )


def plan_extinguish_planet(*, table_id: UUID) -> PlanetCommandPlan:
    return PlanetCommandPlan(request_payload={"table_id": str(table_id)})


__all__ = [
    "PlanetCommandPlan",
    "PlanetPolicyError",
    "ensure_main_timeline",
    "ensure_planet_empty_for_extinguish",
    "plan_create_planet",
    "plan_extinguish_planet",
]
