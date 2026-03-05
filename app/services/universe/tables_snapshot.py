from __future__ import annotations

import math
from collections.abc import Mapping
from datetime import datetime
from typing import TYPE_CHECKING, Any
from uuid import UUID

from app.services.bond_semantics import bond_semantics, normalize_bond_type
from app.services.universe.types import (
    ProjectedAsteroid,
    ProjectedBond,
    derive_table_id,
    derive_table_name,
    normalize_table_name,
    split_constellation_and_planet_name,
)

if TYPE_CHECKING:
    from app.services.universe_service import UniverseService


def _bond_attr(bond: ProjectedBond | dict[str, Any], key: str) -> Any:
    if isinstance(bond, Mapping):
        return bond.get(key)
    return getattr(bond, key, None)


def _normalize_visual_position(value: Any) -> tuple[float, float, float] | None:
    if not isinstance(value, Mapping):
        return None
    try:
        x = float(value.get("x", 0.0))
        y = float(value.get("y", 0.0))
        z = float(value.get("z", 0.0))
    except (TypeError, ValueError):
        return None
    return (x, y, z)


def build_tables_snapshot(
    service: UniverseService,
    *,
    galaxy_id: UUID,
    asteroids: list[ProjectedAsteroid | dict[str, Any]],
    bonds: list[ProjectedBond | dict[str, Any]],
    contract_hints: Mapping[UUID, dict[str, Any]] | None = None,
) -> list[dict[str, Any]]:
    asteroid_rows: list[dict[str, Any]] = []
    for asteroid in asteroids:
        if isinstance(asteroid, Mapping):
            asteroid_id = asteroid.get("id")
            if not isinstance(asteroid_id, UUID):
                continue
            metadata = asteroid.get("metadata", {})
            metadata_dict = metadata if isinstance(metadata, dict) else {}
            table_name_raw = asteroid.get("table_name")
            table_name = (
                normalize_table_name(table_name_raw)
                if isinstance(table_name_raw, str)
                else derive_table_name(value=asteroid.get("value"), metadata=metadata_dict)
            )
            table_id = asteroid.get("table_id")
            table_uuid = table_id if isinstance(table_id, UUID) else derive_table_id(galaxy_id=galaxy_id, table_name=table_name)
            asteroid_rows.append(
                {
                    "id": asteroid_id,
                    "value": asteroid.get("value"),
                    "metadata": metadata_dict,
                    "created_at": asteroid.get("created_at"),
                    "table_name": table_name,
                    "table_id": table_uuid,
                }
            )
        elif isinstance(asteroid, ProjectedAsteroid):
            table_name = derive_table_name(value=asteroid.value, metadata=asteroid.metadata)
            asteroid_rows.append(
                {
                    "id": asteroid.id,
                    "value": asteroid.value,
                    "metadata": asteroid.metadata,
                    "created_at": asteroid.created_at,
                    "table_name": table_name,
                    "table_id": derive_table_id(galaxy_id=galaxy_id, table_name=table_name),
                }
            )

    def _created_sort(row: dict[str, Any]) -> tuple[int, float, str]:
        created_at = row.get("created_at")
        if isinstance(created_at, datetime):
            return (0, created_at.timestamp(), str(row["id"]))
        return (1, 0.0, str(row["id"]))

    asteroid_rows.sort(key=_created_sort)
    asteroid_by_id: dict[UUID, dict[str, Any]] = {item["id"]: item for item in asteroid_rows}

    table_buckets: dict[UUID, dict[str, Any]] = {}
    if isinstance(contract_hints, Mapping):
        for table_id, hint in contract_hints.items():
            if not isinstance(table_id, UUID) or not isinstance(hint, Mapping):
                continue
            raw_name = hint.get("table_name")
            table_name = normalize_table_name(raw_name if isinstance(raw_name, str) else str(table_id))
            raw_schema_fields = hint.get("schema_fields")
            raw_formula_fields = hint.get("formula_fields")
            schema_fields = {
                str(item).strip()
                for item in (raw_schema_fields if isinstance(raw_schema_fields, list) else [])
                if str(item).strip()
            }
            formula_fields = {
                str(item).strip()
                for item in (raw_formula_fields if isinstance(raw_formula_fields, list) else [])
                if str(item).strip()
            }
            visual_position = _normalize_visual_position(hint.get("planet_visual_position"))
            table_buckets[table_id] = {
                "table_id": table_id,
                "galaxy_id": galaxy_id,
                "name": table_name,
                "archetype": str(hint.get("planet_archetype") or "").strip() or None,
                "contract_version": int(hint.get("contract_version") or 0) or None,
                "schema_fields": schema_fields,
                "formula_fields": formula_fields,
                "visual_position": visual_position,
                "members": [],
                "internal_bonds": [],
                "external_bonds": [],
            }

    for row in asteroid_rows:
        table_id = row["table_id"]
        table_name = row["table_name"]
        bucket = table_buckets.setdefault(
            table_id,
            {
                "table_id": table_id,
                "galaxy_id": galaxy_id,
                "name": table_name,
                "archetype": None,
                "contract_version": None,
                "schema_fields": set(),
                "formula_fields": set(),
                "visual_position": None,
                "members": [],
                "internal_bonds": [],
                "external_bonds": [],
            },
        )
        if isinstance(table_name, str) and table_name.strip() and table_name != "Uncategorized":
            bucket["name"] = table_name
        metadata = row.get("metadata", {})
        if isinstance(metadata, dict):
            for key, value in metadata.items():
                if not key.startswith("_"):
                    bucket["schema_fields"].add(key)
                if isinstance(value, str) and value.strip().startswith("="):
                    bucket["formula_fields"].add(key)

        bucket["members"].append(
            {
                "id": row["id"],
                "value": row.get("value"),
                "created_at": row.get("created_at"),
            }
        )

    for bond in bonds:
        source_id = _bond_attr(bond, "source_id")
        target_id = _bond_attr(bond, "target_id")
        if not isinstance(source_id, UUID) or not isinstance(target_id, UUID):
            continue

        source = asteroid_by_id.get(source_id)
        target = asteroid_by_id.get(target_id)
        if source is None or target is None:
            continue

        source_table = table_buckets.get(source["table_id"])
        target_table = table_buckets.get(target["table_id"])
        if source_table is None or target_table is None:
            continue

        bond_id = _bond_attr(bond, "id")
        if not isinstance(bond_id, UUID):
            continue
        bond_type = normalize_bond_type(_bond_attr(bond, "type"))
        bond_payload = {
            "id": bond_id,
            "source_id": source_id,
            "target_id": target_id,
            "type": bond_type,
        }
        semantics = bond_semantics(bond_type)
        bond_payload["directional"] = semantics.directional
        bond_payload["flow_direction"] = semantics.flow_direction
        if source["table_id"] == target["table_id"]:
            source_table["internal_bonds"].append(bond_payload)
        else:
            source_table["external_bonds"].append(
                {
                    **bond_payload,
                    "peer_table_id": target["table_id"],
                    "peer_table_name": target["table_name"],
                }
            )
            target_table["external_bonds"].append(
                {
                    **bond_payload,
                    "peer_table_id": source["table_id"],
                    "peer_table_name": source["table_name"],
                }
            )

    ordered_tables = sorted(
        table_buckets.values(),
        key=lambda item: (item["name"].lower(), str(item["table_id"])),
    )
    total = len(ordered_tables)
    table_rows: list[dict[str, Any]] = []
    for index, table in enumerate(ordered_tables):
        members = sorted(table["members"], key=_created_sort)
        schema_fields = sorted(table["schema_fields"])
        formula_fields = sorted(table["formula_fields"])
        default_mode = "ring" if (len(members) > 5 or len(schema_fields) > 3) else "belt"
        manual_center = table.get("visual_position")
        if isinstance(manual_center, tuple) and len(manual_center) == 3:
            center = manual_center
            mode = "manual"
        else:
            center = service._sector_center(index, total)
            mode = default_mode
        size = max(260.0, min(460.0, 260.0 + math.sqrt(max(len(members), 1)) * 48.0 + (80.0 if mode == "ring" else 20.0)))
        constellation_name, planet_name = split_constellation_and_planet_name(table["name"])

        table_rows.append(
            {
                "table_id": table["table_id"],
                "galaxy_id": table["galaxy_id"],
                "name": table["name"],
                "constellation_name": constellation_name,
                "planet_name": planet_name,
                "archetype": table.get("archetype"),
                "contract_version": table.get("contract_version"),
                "schema_fields": schema_fields,
                "formula_fields": formula_fields,
                "members": members,
                "internal_bonds": sorted(table["internal_bonds"], key=lambda item: str(item["id"])),
                "external_bonds": sorted(table["external_bonds"], key=lambda item: (str(item["peer_table_id"]), str(item["id"]))),
                "sector": {
                    "center": [center[0], center[1], center[2]],
                    "size": size,
                    "mode": mode,
                    "grid_plate": True,
                },
            }
        )

    return table_rows
