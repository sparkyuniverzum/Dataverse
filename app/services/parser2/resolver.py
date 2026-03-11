from __future__ import annotations

from app.core.parser2.intents import NodeSelector, NodeSelectorType
from app.core.parser2.planner import SemanticResolver
from app.services.universe_service import ProjectedCivilization


class SnapshotSemanticResolver(SemanticResolver):
    """
    Resolver backed by current projected civilization state for a given galaxy/branch.

    Resolution strategy:
    1) case-insensitive exact label match
    2) case-insensitive contains match (only if unique)
    Ambiguous matches return None to avoid accidental mis-resolution.
    """

    def __init__(self, civilizations: list[ProjectedCivilization]) -> None:
        self._exact: dict[str, list[NodeSelector]] = {}
        self._contains_source: list[tuple[str, NodeSelector]] = []

        for civilization in civilizations:
            selector = NodeSelector(selector_type=NodeSelectorType.ID, value=str(civilization.id))
            label = self._value_to_text(civilization.value).strip()
            if not label:
                continue
            normalized = label.lower()
            self._exact.setdefault(normalized, []).append(selector)
            self._contains_source.append((normalized, selector))

    def resolve_node(self, name: str) -> NodeSelector | None:
        normalized = str(name or "").strip().lower()
        if not normalized:
            return None

        exact_matches = self._exact.get(normalized, [])
        if len(exact_matches) == 1:
            return exact_matches[0]
        if len(exact_matches) > 1:
            return None

        contains_matches = [selector for label, selector in self._contains_source if normalized in label]
        if len(contains_matches) == 1:
            return contains_matches[0]
        return None

    def unresolved_issue(self, name: str) -> tuple[str, str] | None:
        normalized = str(name or "").strip().lower()
        if not normalized:
            return ("PLAN_RESOLVE_NOT_FOUND", "Entity name is empty")

        exact_matches = self._exact.get(normalized, [])
        if len(exact_matches) > 1:
            return ("PLAN_RESOLVE_AMBIGUOUS_NAME", f"Ambiguous entity name '{name}' (multiple exact matches)")
        if len(exact_matches) == 1:
            return None

        contains_matches = [selector for label, selector in self._contains_source if normalized in label]
        if len(contains_matches) > 1:
            return (
                "PLAN_RESOLVE_AMBIGUOUS_NAME",
                f"Ambiguous entity name '{name}' (multiple partial matches)",
            )
        if len(contains_matches) == 1:
            return None
        return ("PLAN_RESOLVE_NOT_FOUND", f"Entity '{name}' was not found")

    @staticmethod
    def _value_to_text(value: object) -> str:
        if isinstance(value, str):
            return value
        return str(value)
