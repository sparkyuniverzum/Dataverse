from __future__ import annotations

from uuid import UUID

from fastapi import HTTPException, status

from app.services.universe_service import ProjectedAsteroid


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
    def find_asteroid_by_target(
        cls,
        asteroids: list[ProjectedAsteroid],
        target: str,
    ) -> ProjectedAsteroid | None:
        normalized = target.strip().lower()
        if not normalized:
            return None

        try:
            target_id = UUID(target.strip())
        except ValueError:
            target_id = None

        if target_id is not None:
            for asteroid in asteroids:
                if asteroid.id == target_id:
                    return asteroid

        for asteroid in asteroids:
            if cls.value_to_text(asteroid.value).strip().lower() == normalized:
                return asteroid

        for asteroid in asteroids:
            if normalized in cls.value_to_text(asteroid.value).lower():
                return asteroid
        return None

    @classmethod
    def resolve_single_asteroid_by_target(
        cls,
        asteroids: list[ProjectedAsteroid],
        target: str,
    ) -> ProjectedAsteroid | None:
        normalized = str(target or "").strip()
        if not normalized:
            return None

        target_uuid = cls.parse_uuid(normalized)
        if target_uuid is not None:
            for asteroid in asteroids:
                if asteroid.id == target_uuid:
                    return asteroid
            return None

        lowered = normalized.lower()
        exact_matches = [
            asteroid
            for asteroid in asteroids
            if cls.value_to_text(asteroid.value).strip().lower() == lowered
        ]
        if len(exact_matches) == 1:
            return exact_matches[0]
        if len(exact_matches) > 1:
            raise HTTPException(
                status_code=status.HTTP_422_UNPROCESSABLE_CONTENT,
                detail=f"Ambiguous target '{target}' (multiple exact matches)",
            )

        contains_matches = [
            asteroid
            for asteroid in asteroids
            if lowered in cls.value_to_text(asteroid.value).lower()
        ]
        if len(contains_matches) == 1:
            return contains_matches[0]
        if len(contains_matches) > 1:
            raise HTTPException(
                status_code=status.HTTP_422_UNPROCESSABLE_CONTENT,
                detail=f"Ambiguous target '{target}' (multiple partial matches)",
            )
        return None

    @classmethod
    def find_asteroids_by_target(
        cls,
        asteroids: list[ProjectedAsteroid],
        target: str,
        condition: str | None,
    ) -> list[ProjectedAsteroid]:
        target_norm = target.strip().lower()
        condition_norm = condition.strip().lower() if condition else None
        selected: list[ProjectedAsteroid] = []
        for asteroid in asteroids:
            label = cls.value_to_text(asteroid.value).lower()
            if target_norm not in label:
                continue
            if condition_norm and condition_norm not in label:
                continue
            selected.append(asteroid)
        return selected
