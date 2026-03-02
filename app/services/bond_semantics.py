from __future__ import annotations

from dataclasses import dataclass
from typing import Any


_ALIASES: dict[str, str] = {
    "RELATION": "RELATION",
    "REL": "RELATION",
    "LINK": "RELATION",
    "EDGE": "RELATION",
    "BOND": "RELATION",
    "TYPE": "TYPE",
    "TYP": "TYPE",
    "FLOW": "FLOW",
    "DATAFLOW": "FLOW",
    "DATA_FLOW": "FLOW",
    "FORMULA": "FLOW",
    "GUARDIAN": "GUARDIAN",
    "GUARD": "GUARDIAN",
    "WATCH": "GUARDIAN",
}

_DIRECTIONAL_TYPES = {"TYPE", "FLOW", "GUARDIAN"}
_DESCRIPTIONS: dict[str, str] = {
    "RELATION": "Mutual relation between nodes (bidirectional context).",
    "TYPE": "Typing flow from instance to type (source -> target).",
    "FLOW": "Data flow relation (source -> target).",
    "GUARDIAN": "Guardian/control flow (source -> target).",
}


@dataclass(frozen=True)
class BondSemantics:
    bond_type: str
    directional: bool
    flow_direction: str
    description: str


def normalize_bond_type(raw_value: Any) -> str:
    normalized = str(raw_value or "").strip().upper().replace("-", "_").replace(" ", "_")
    if not normalized:
        return "RELATION"
    return _ALIASES.get(normalized, normalized)


def bond_semantics(raw_value: Any) -> BondSemantics:
    bond_type = normalize_bond_type(raw_value)
    directional = bond_type in _DIRECTIONAL_TYPES
    flow_direction = "source_to_target" if directional else "bidirectional"
    description = _DESCRIPTIONS.get(bond_type, "Custom relation type; direction follows source -> target.")
    return BondSemantics(
        bond_type=bond_type,
        directional=directional,
        flow_direction=flow_direction,
        description=description,
    )

