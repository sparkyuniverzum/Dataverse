from __future__ import annotations

from datetime import datetime
from typing import Any, TypedDict

from app.domains.civilizations.minerals.policy import RESERVED_MINERAL_METADATA_KEYS


class MineralFactPayload(TypedDict):
    key: str
    typed_value: Any
    value_type: str
    source: str
    status: str
    readonly: bool
    errors: list[str]


def infer_mineral_value_type(value: Any) -> str:
    if value is None:
        return "null"
    if isinstance(value, bool):
        return "boolean"
    if isinstance(value, int | float):
        return "number"
    if isinstance(value, datetime):
        return "datetime"
    if isinstance(value, str):
        candidate = value.strip()
        if candidate:
            try:
                datetime.fromisoformat(candidate.replace("Z", "+00:00"))
                return "datetime"
            except ValueError:
                return "string"
        return "string"
    if isinstance(value, list | dict):
        return "json"
    return "json"


def build_civilization_mineral_facts(
    *,
    value: Any,
    metadata: dict[str, Any] | None = None,
    calculated_values: dict[str, Any] | None = None,
    calc_errors: list[Any] | None = None,
) -> list[MineralFactPayload]:
    metadata_dict = metadata if isinstance(metadata, dict) else {}
    calculated_dict = calculated_values if isinstance(calculated_values, dict) else {}
    calc_errors_list = calc_errors if isinstance(calc_errors, list) else []

    errors_by_field: dict[str, list[str]] = {}
    for item in calc_errors_list:
        if not isinstance(item, dict):
            continue
        field = str(item.get("field") or "").strip()
        code = str(item.get("code") or "").strip()
        message = str(item.get("message") or "").strip()
        if not field:
            continue
        line = message or code or "Calculation error"
        errors_by_field.setdefault(field, [])
        if line not in errors_by_field[field]:
            errors_by_field[field].append(line)

    facts: list[MineralFactPayload] = [
        {
            "key": "value",
            "typed_value": value,
            "value_type": infer_mineral_value_type(value),
            "source": "value",
            "status": "valid",
            "readonly": False,
            "errors": [],
        }
    ]
    fact_index: dict[str, int] = {"value": 0}

    for key in sorted(metadata_dict.keys()):
        if key in RESERVED_MINERAL_METADATA_KEYS:
            continue
        typed_value = metadata_dict.get(key)
        normalized_key = str(key)
        if normalized_key in fact_index:
            continue
        facts.append(
            {
                "key": normalized_key,
                "typed_value": typed_value,
                "value_type": infer_mineral_value_type(typed_value),
                "source": "metadata",
                "status": "valid",
                "readonly": False,
                "errors": [],
            }
        )
        fact_index[normalized_key] = len(facts) - 1

    for key in sorted(calculated_dict.keys()):
        normalized_key = str(key)
        typed_value = calculated_dict.get(key)
        field_errors = list(errors_by_field.get(normalized_key, []))
        is_circular = typed_value == "#CIRC!"
        status = "invalid" if is_circular or bool(field_errors) else "valid"
        errors = field_errors
        if is_circular and "Circular formula dependency" not in errors:
            errors.append("Circular formula dependency")
        if normalized_key in fact_index:
            if errors:
                current_fact = facts[fact_index[normalized_key]]
                merged_errors = list(current_fact["errors"])
                for message in errors:
                    if message not in merged_errors:
                        merged_errors.append(message)
                current_fact["errors"] = merged_errors
                current_fact["status"] = "invalid"
            continue
        facts.append(
            {
                "key": normalized_key,
                "typed_value": typed_value,
                "value_type": infer_mineral_value_type(typed_value),
                "source": "calculated",
                "status": status,
                "readonly": True,
                "errors": errors,
            }
        )
        fact_index[normalized_key] = len(facts) - 1

    for key in sorted(errors_by_field.keys()):
        if key in calculated_dict:
            continue
        if key in fact_index:
            current_fact = facts[fact_index[key]]
            merged_errors = list(current_fact["errors"])
            for message in errors_by_field.get(key, []):
                if message not in merged_errors:
                    merged_errors.append(message)
            current_fact["errors"] = merged_errors
            current_fact["status"] = "invalid"
            continue
        facts.append(
            {
                "key": key,
                "typed_value": None,
                "value_type": "null",
                "source": "calculated",
                "status": "invalid",
                "readonly": True,
                "errors": list(errors_by_field.get(key, [])),
            }
        )
        fact_index[key] = len(facts) - 1

    return facts
