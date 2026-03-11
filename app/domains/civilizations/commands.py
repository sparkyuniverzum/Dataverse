from __future__ import annotations

from dataclasses import dataclass
from typing import Any
from uuid import UUID

from app.domains.civilizations.minerals.policy import (
    RESERVED_MINERAL_METADATA_KEYS,
    CivilizationPolicyError,
    normalize_civilization_metadata_patch,
    normalize_mineral_key,
)
from app.services.parser_types import AtomicTask


@dataclass(frozen=True)
class CivilizationCommandPlan:
    tasks: list[AtomicTask]
    request_payload: dict[str, Any]


def compose_planet_scoped_metadata(
    *,
    planet_id: UUID,
    table_name: str,
    minerals: dict[str, Any] | None,
) -> dict[str, Any]:
    metadata = dict(minerals or {})
    metadata["table"] = table_name
    metadata["table_id"] = str(planet_id)
    return metadata


def plan_ingest_civilization(
    *,
    value: Any,
    metadata: dict[str, Any] | None = None,
) -> CivilizationCommandPlan:
    metadata_payload = dict(metadata or {})
    return CivilizationCommandPlan(
        tasks=[AtomicTask(action="INGEST", params={"value": value, "metadata": metadata_payload})],
        request_payload={"value": value, "metadata": metadata_payload},
    )


def plan_mutate_civilization(
    *,
    civilization_id: UUID,
    value: Any | None,
    metadata: dict[str, Any] | None,
    expected_event_seq: int | None,
) -> CivilizationCommandPlan:
    metadata_patch = normalize_civilization_metadata_patch(
        metadata,
        reserved_keys=RESERVED_MINERAL_METADATA_KEYS,
    )
    params: dict[str, Any] = {"civilization_id": str(civilization_id)}
    if value is not None:
        params["value"] = value
    if metadata_patch:
        params["metadata"] = metadata_patch
    if expected_event_seq is not None:
        params["expected_event_seq"] = expected_event_seq
    return CivilizationCommandPlan(
        tasks=[AtomicTask(action="UPDATE_ASTEROID", params=params)],
        request_payload={
            "civilization_id": str(civilization_id),
            "value": value,
            "metadata": metadata_patch,
            "expected_event_seq": expected_event_seq,
        },
    )


def plan_extinguish_civilization(
    *,
    civilization_id: UUID,
    expected_event_seq: int | None,
) -> CivilizationCommandPlan:
    params: dict[str, Any] = {"civilization_id": str(civilization_id)}
    if expected_event_seq is not None:
        params["expected_event_seq"] = expected_event_seq
    return CivilizationCommandPlan(
        tasks=[AtomicTask(action="EXTINGUISH", params=params)],
        request_payload={"civilization_id": str(civilization_id), "expected_event_seq": expected_event_seq},
    )


def plan_mineral_mutation(
    *,
    civilization_id: UUID,
    mineral_key: str,
    typed_value: Any | None,
    remove: bool,
    expected_event_seq: int,
) -> CivilizationCommandPlan:
    normalized_key = normalize_mineral_key(mineral_key, reserved_keys=RESERVED_MINERAL_METADATA_KEYS)
    params: dict[str, Any] = {"civilization_id": str(civilization_id), "expected_event_seq": expected_event_seq}
    if remove:
        params["metadata_remove"] = [normalized_key]
    else:
        params["metadata"] = {normalized_key: typed_value}
    return CivilizationCommandPlan(
        tasks=[AtomicTask(action="UPDATE_ASTEROID", params=params)],
        request_payload={
            "civilization_id": str(civilization_id),
            "mineral_key": normalized_key,
            "remove": remove,
            "typed_value": typed_value if not remove else None,
            "expected_event_seq": expected_event_seq,
        },
    )


def pick_mutated_civilization(*, execution: Any, civilization_id: UUID) -> Any | None:
    civilizations = list(getattr(execution, "civilizations", []) or [])
    if not civilizations:
        return None
    return next(
        (civilization for civilization in civilizations if civilization.id == civilization_id), civilizations[0]
    )


def pick_ingested_civilization(*, execution: Any) -> Any | None:
    civilizations = list(getattr(execution, "civilizations", []) or [])
    if not civilizations:
        return None
    return civilizations[0]


def pick_extinguished_civilization(*, execution: Any, civilization_id: UUID) -> tuple[bool, Any | None]:
    extinguished_ids = set(getattr(execution, "extinguished_civilization_ids", []) or [])
    if civilization_id not in extinguished_ids:
        return False, None
    extinguished_rows = list(getattr(execution, "extinguished_civilizations", []) or [])
    row = next((civilization for civilization in extinguished_rows if civilization.id == civilization_id), None)
    return True, row


__all__ = [
    "CivilizationCommandPlan",
    "CivilizationPolicyError",
    "compose_planet_scoped_metadata",
    "pick_extinguished_civilization",
    "pick_ingested_civilization",
    "pick_mutated_civilization",
    "plan_extinguish_civilization",
    "plan_ingest_civilization",
    "plan_mineral_mutation",
    "plan_mutate_civilization",
]
