from __future__ import annotations

from collections.abc import Mapping
from typing import Any

_ALLOWED_OPERATORS = {">", "<", "==", ">=", "<="}


def _to_number(value: Any) -> float | None:
    if isinstance(value, bool):
        return None
    if isinstance(value, (int, float)):
        return float(value)
    if isinstance(value, str):
        cleaned = value.strip().replace("\u00a0", "").replace(" ", "").replace(",", ".")
        if not cleaned:
            return None
        try:
            return float(cleaned)
        except ValueError:
            return None
    return None


def _compare(left: Any, operator: str, right: Any) -> bool:
    if operator not in _ALLOWED_OPERATORS:
        return False

    left_num = _to_number(left)
    right_num = _to_number(right)
    if left_num is not None and right_num is not None:
        if operator == ">":
            return left_num > right_num
        if operator == "<":
            return left_num < right_num
        if operator == "==":
            return left_num == right_num
        if operator == ">=":
            return left_num >= right_num
        if operator == "<=":
            return left_num <= right_num

    if operator != "==":
        return False
    return str(left).strip() == str(right).strip()


def evaluate_guardians(asteroids_snapshot: list[dict[str, Any]]) -> list[dict[str, Any]]:
    evaluated: list[dict[str, Any]] = []

    for asteroid in asteroids_snapshot:
        if not isinstance(asteroid, Mapping):
            continue

        asteroid_out = dict(asteroid)
        metadata = asteroid_out.get("metadata")
        if not isinstance(metadata, dict):
            metadata = {}
        asteroid_out["metadata"] = metadata

        calculated_values = asteroid_out.get("calculated_values")
        if not isinstance(calculated_values, dict):
            calculated_values = {}
        asteroid_out["calculated_values"] = calculated_values

        guardians = metadata.get("_guardians")
        if not isinstance(guardians, list):
            asteroid_out["active_alerts"] = []
            evaluated.append(asteroid_out)
            continue

        active_alerts: list[str] = []
        for rule in guardians:
            if not isinstance(rule, Mapping):
                continue

            field = str(rule.get("field", "")).strip()
            operator = str(rule.get("operator", "")).strip()
            action = str(rule.get("action", "")).strip()
            threshold = rule.get("threshold")
            if not field or not action or not operator:
                continue

            left_value = calculated_values.get(field, metadata.get(field))
            if left_value is None:
                continue

            if _compare(left_value, operator, threshold) and action not in active_alerts:
                active_alerts.append(action)

        asteroid_out["active_alerts"] = active_alerts
        evaluated.append(asteroid_out)

    return evaluated
