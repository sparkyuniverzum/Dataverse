from __future__ import annotations

from dataclasses import dataclass
from typing import Any
from uuid import UUID

from app.services.parser_types import AtomicTask


@dataclass(frozen=True)
class BondCommandPlan:
    tasks: list[AtomicTask]
    request_payload: dict[str, Any]


def plan_link_bond(
    *,
    source_civilization_id: UUID,
    target_civilization_id: UUID,
    bond_type: str,
    expected_source_event_seq: int | None,
    expected_target_event_seq: int | None,
) -> BondCommandPlan:
    params: dict[str, Any] = {
        "source_civilization_id": str(source_civilization_id),
        "target_civilization_id": str(target_civilization_id),
        "type": bond_type,
    }
    if expected_source_event_seq is not None:
        params["expected_source_event_seq"] = expected_source_event_seq
    if expected_target_event_seq is not None:
        params["expected_target_event_seq"] = expected_target_event_seq
    return BondCommandPlan(
        tasks=[AtomicTask(action="LINK", params=params)],
        request_payload={
            "source_civilization_id": str(source_civilization_id),
            "target_civilization_id": str(target_civilization_id),
            "type": bond_type,
            "expected_source_event_seq": expected_source_event_seq,
            "expected_target_event_seq": expected_target_event_seq,
        },
    )


def plan_mutate_bond(
    *,
    bond_id: UUID,
    bond_type: str,
    expected_event_seq: int | None,
) -> BondCommandPlan:
    params: dict[str, Any] = {"bond_id": str(bond_id), "type": bond_type}
    if expected_event_seq is not None:
        params["expected_event_seq"] = expected_event_seq
    return BondCommandPlan(
        tasks=[AtomicTask(action="UPDATE_BOND", params=params)],
        request_payload={
            "bond_id": str(bond_id),
            "type": bond_type,
            "expected_event_seq": expected_event_seq,
        },
    )


def plan_extinguish_bond(
    *,
    bond_id: UUID,
    expected_event_seq: int | None,
) -> BondCommandPlan:
    params: dict[str, Any] = {"bond_id": str(bond_id)}
    if expected_event_seq is not None:
        params["expected_event_seq"] = expected_event_seq
    return BondCommandPlan(
        tasks=[AtomicTask(action="EXTINGUISH_BOND", params=params)],
        request_payload={
            "bond_id": str(bond_id),
            "expected_event_seq": expected_event_seq,
        },
    )


def pick_linked_bond(*, execution: Any) -> Any | None:
    bonds = list(getattr(execution, "bonds", []) or [])
    if not bonds:
        return None
    return bonds[0]


def pick_mutated_bond(*, execution: Any) -> Any | None:
    bonds = list(getattr(execution, "bonds", []) or [])
    if not bonds:
        return None
    return bonds[-1]


def pick_extinguished_bond(*, execution: Any) -> Any | None:
    bonds = list(getattr(execution, "bonds", []) or [])
    if not bonds:
        return None
    return bonds[0]


__all__ = [
    "BondCommandPlan",
    "pick_extinguished_bond",
    "pick_linked_bond",
    "pick_mutated_bond",
    "plan_extinguish_bond",
    "plan_link_bond",
    "plan_mutate_bond",
]
