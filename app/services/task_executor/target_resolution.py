from __future__ import annotations

from uuid import UUID

from fastapi import HTTPException, status

from app.services.universe_service import ProjectedCivilization


class TargetResolver:
    @staticmethod
    def value_to_text(value: object) -> str:
        if isinstance(value, str):
            return value
        return str(value)

    @staticmethod
    def parse_uuid(value: object) -> UUID | None:
        if value is None:
            return None
        try:
            return UUID(str(value))
        except (TypeError, ValueError):
            return None

    @classmethod
    def find_civilization_by_target(
        cls,
        civilizations: list[ProjectedCivilization],
        target: str,
    ) -> ProjectedCivilization | None:
        normalized = target.strip().lower()
        if not normalized:
            return None

        try:
            target_civilization_id = UUID(target.strip())
        except ValueError:
            target_civilization_id = None

        if target_civilization_id is not None:
            for civilization in civilizations:
                if civilization.id == target_civilization_id:
                    return civilization

        for civilization in civilizations:
            if cls.value_to_text(civilization.value).strip().lower() == normalized:
                return civilization

        for civilization in civilizations:
            if normalized in cls.value_to_text(civilization.value).lower():
                return civilization
        return None

    @classmethod
    def resolve_single_civilization_by_target(
        cls,
        civilizations: list[ProjectedCivilization],
        target: str,
    ) -> ProjectedCivilization | None:
        normalized = str(target or "").strip()
        if not normalized:
            return None

        target_uuid = cls.parse_uuid(normalized)
        if target_uuid is not None:
            for civilization in civilizations:
                if civilization.id == target_uuid:
                    return civilization
            return None

        lowered = normalized.lower()
        exact_matches = [c for c in civilizations if cls.value_to_text(c.value).strip().lower() == lowered]
        if len(exact_matches) == 1:
            return exact_matches[0]
        if len(exact_matches) > 1:
            raise HTTPException(
                status_code=status.HTTP_422_UNPROCESSABLE_CONTENT,
                detail=f"Ambiguous target '{target}' (multiple exact matches)",
            )

        contains_matches = [c for c in civilizations if lowered in cls.value_to_text(c.value).lower()]
        if len(contains_matches) == 1:
            return contains_matches[0]
        if len(contains_matches) > 1:
            raise HTTPException(
                status_code=status.HTTP_422_UNPROCESSABLE_CONTENT,
                detail=f"Ambiguous target '{target}' (multiple partial matches)",
            )
        return None

    @classmethod
    def find_civilizations_by_target(
        cls,
        civilizations: list[ProjectedCivilization],
        target: str,
        condition: str | None,
    ) -> list[ProjectedCivilization]:
        target_norm = target.strip().lower()
        condition_norm = condition.strip().lower() if condition else None
        selected: list[ProjectedCivilization] = []
        for civilization in civilizations:
            label = cls.value_to_text(civilization.value).lower()
            if target_norm not in label:
                continue
            if condition_norm and condition_norm not in label:
                continue
            selected.append(civilization)
        return selected
