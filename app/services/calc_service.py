from __future__ import annotations

import re
from collections.abc import Mapping
from typing import Any


_FORMULA_RE = re.compile(r"^=\s*(SUM|AVG|MIN|MAX|COUNT)\s*\(\s*([^)]+)\s*\)\s*$", re.IGNORECASE)


def _get_field(source: Any, name: str, default: Any = None) -> Any:
    if isinstance(source, Mapping):
        return source.get(name, default)
    return getattr(source, name, default)


def _metadata_from_atom(atom: Any) -> dict[str, Any]:
    if isinstance(atom, Mapping):
        metadata = atom.get("metadata", {})
    else:
        metadata = getattr(atom, "metadata_", {})
    if isinstance(metadata, dict):
        return metadata
    return {}


def _to_number(value: Any) -> float | None:
    if isinstance(value, bool):
        return None
    if isinstance(value, (int, float)):
        return float(value)
    if isinstance(value, str):
        cleaned = value.strip().replace("\u00A0", "").replace(" ", "").replace(",", ".")
        if not cleaned:
            return None
        try:
            return float(cleaned)
        except ValueError:
            return None
    return None


def _finalize_number(value: float) -> int | float:
    rounded = round(value)
    if abs(value - rounded) < 1e-9:
        return int(rounded)
    return value


def _aggregate(operation: str, values: list[float]) -> int | float:
    if operation == "SUM":
        return _finalize_number(sum(values))
    if operation == "AVG":
        return _finalize_number(sum(values) / len(values)) if values else 0
    if operation == "MIN":
        return _finalize_number(min(values)) if values else 0
    if operation == "MAX":
        return _finalize_number(max(values)) if values else 0
    if operation == "COUNT":
        return len(values)
    return 0


def evaluate_universe(atoms: list[Any], bonds: list[Any]) -> list[dict[str, Any]]:
    atoms_by_id: dict[Any, dict[str, Any]] = {}
    for atom in atoms:
        atom_id = _get_field(atom, "id")
        if atom_id is None:
            continue
        atoms_by_id[atom_id] = {
            "id": atom_id,
            "value": _get_field(atom, "value"),
            "metadata": dict(_metadata_from_atom(atom)),
            "created_at": _get_field(atom, "created_at"),
        }

    adjacency_list: dict[Any, set[Any]] = {}
    for bond in bonds:
        source_id = _get_field(bond, "source_id")
        target_id = _get_field(bond, "target_id")
        if source_id is None or target_id is None:
            continue
        adjacency_list.setdefault(source_id, set()).add(target_id)
        adjacency_list.setdefault(target_id, set()).add(source_id)

    resolved_cache: dict[tuple[Any, str], Any] = {}

    def resolve_value(atom_id: Any, field_name: str, visited_set: set[Any]) -> Any:
        cache_key = (atom_id, field_name)
        if cache_key in resolved_cache:
            return resolved_cache[cache_key]

        atom_data = atoms_by_id.get(atom_id)
        if atom_data is None:
            return None

        metadata = atom_data["metadata"]
        raw_value = metadata.get(field_name)
        if raw_value is None:
            resolved_cache[cache_key] = None
            return None

        if isinstance(raw_value, str) and raw_value.strip().startswith("="):
            if atom_id in visited_set:
                resolved_cache[cache_key] = "#CIRC!"
                return "#CIRC!"

            match = _FORMULA_RE.match(raw_value.strip())
            if not match:
                resolved_cache[cache_key] = raw_value
                return raw_value

            operation = match.group(1).upper()
            target_attribute = match.group(2).strip()
            next_visited = set(visited_set)
            next_visited.add(atom_id)

            numbers: list[float] = []
            circular_hit = False
            for neighbor_id in adjacency_list.get(atom_id, set()):
                resolved_neighbor = resolve_value(neighbor_id, target_attribute, next_visited)
                if resolved_neighbor == "#CIRC!":
                    circular_hit = True
                    continue
                numeric = _to_number(resolved_neighbor)
                if numeric is not None:
                    numbers.append(numeric)

            result = "#CIRC!" if circular_hit else _aggregate(operation, numbers)
            resolved_cache[cache_key] = result
            return result

        numeric = _to_number(raw_value)
        result = _finalize_number(numeric) if numeric is not None else raw_value
        resolved_cache[cache_key] = result
        return result

    evaluated_atoms: list[dict[str, Any]] = []
    for atom in atoms:
        atom_id = _get_field(atom, "id")
        atom_data = atoms_by_id.get(atom_id)
        if atom_data is None:
            continue

        evaluated_metadata: dict[str, Any] = {}
        for metadata_key in atom_data["metadata"].keys():
            evaluated_metadata[metadata_key] = resolve_value(atom_id, metadata_key, set())

        evaluated_atoms.append(
            {
                "id": atom_data["id"],
                "value": atom_data["value"],
                "metadata": evaluated_metadata,
                "calculated_values": dict(evaluated_metadata),
                "created_at": atom_data["created_at"],
            }
        )

    return evaluated_atoms


def evaluate_universe_formulas(atoms: list[Any], bonds: list[Any]) -> list[dict[str, Any]]:
    return evaluate_universe(atoms, bonds)
