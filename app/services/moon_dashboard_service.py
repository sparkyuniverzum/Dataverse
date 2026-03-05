from __future__ import annotations

from datetime import datetime
from typing import Any
from uuid import UUID

from sqlalchemy.ext.asyncio import AsyncSession

from app.services.universe_service import (
    DEFAULT_GALAXY_ID,
    UniverseService,
    derive_table_id,
    derive_table_name,
    split_constellation_and_planet_name,
)


class MoonDashboardService:
    def __init__(self, *, universe_service: UniverseService | None = None) -> None:
        self.universe_service = universe_service or UniverseService()

    async def list_moons(
        self,
        session: AsyncSession,
        *,
        user_id: UUID,
        galaxy_id: UUID = DEFAULT_GALAXY_ID,
        branch_id: UUID | None = None,
        as_of: datetime | None = None,
    ) -> list[dict[str, Any]]:
        asteroids, _ = await self.universe_service.snapshot(
            session=session,
            user_id=user_id,
            galaxy_id=galaxy_id,
            branch_id=branch_id,
            as_of=as_of,
        )

        rows: list[dict[str, Any]] = []
        for asteroid in asteroids:
            if isinstance(asteroid, dict):
                asteroid_id = asteroid.get("id")
                value = asteroid.get("value")
                metadata = asteroid.get("metadata")
                created_at = asteroid.get("created_at")
                calculated_values = asteroid.get("calculated_values")
                active_alerts = asteroid.get("active_alerts")
                table_name = asteroid.get("table_name")
                constellation_name = asteroid.get("constellation_name")
                planet_name = asteroid.get("planet_name")
                table_id = asteroid.get("table_id")
            else:
                asteroid_id = getattr(asteroid, "id", None)
                value = getattr(asteroid, "value", None)
                metadata = getattr(asteroid, "metadata", None)
                created_at = getattr(asteroid, "created_at", None)
                calculated_values = getattr(asteroid, "calculated_values", None)
                active_alerts = getattr(asteroid, "active_alerts", None)
                table_name = getattr(asteroid, "table_name", None)
                constellation_name = getattr(asteroid, "constellation_name", None)
                planet_name = getattr(asteroid, "planet_name", None)
                table_id = getattr(asteroid, "table_id", None)

            if asteroid_id is None:
                continue

            metadata_dict = metadata if isinstance(metadata, dict) else {}
            calculated_values_dict = calculated_values if isinstance(calculated_values, dict) else {}
            active_alerts_list = active_alerts if isinstance(active_alerts, list) else []

            resolved_table_name = (
                str(table_name).strip()
                if isinstance(table_name, str) and str(table_name).strip()
                else derive_table_name(value=value, metadata=metadata_dict)
            )
            resolved_table_id = (
                table_id
                if isinstance(table_id, UUID)
                else derive_table_id(galaxy_id=galaxy_id, table_name=resolved_table_name)
            )

            resolved_constellation = str(constellation_name).strip() if isinstance(constellation_name, str) else ""
            resolved_planet = str(planet_name).strip() if isinstance(planet_name, str) else ""
            if not resolved_constellation or not resolved_planet:
                fallback_constellation, fallback_planet = split_constellation_and_planet_name(resolved_table_name)
                resolved_constellation = resolved_constellation or fallback_constellation
                resolved_planet = resolved_planet or fallback_planet

            guardians = metadata_dict.get("_guardians")
            guardian_rules_count = (
                len([rule for rule in guardians if isinstance(rule, dict)]) if isinstance(guardians, list) else 0
            )
            metadata_fields_count = len(
                [
                    key
                    for key in metadata_dict.keys()
                    if str(key) not in {"table", "table_id", "table_name", "_guardians"}
                ]
            )
            calculated_fields_count = len(calculated_values_dict)
            circular_fields_count = sum(1 for value in calculated_values_dict.values() if value == "#CIRC!")
            active_alerts_count = len(active_alerts_list)

            quality_penalty = circular_fields_count * 18 + active_alerts_count * 9
            quality_score = max(0, 100 - quality_penalty)
            status = "GREEN"
            if quality_score < 60:
                status = "RED"
            elif quality_score < 85:
                status = "YELLOW"

            rows.append(
                {
                    "asteroid_id": asteroid_id,
                    "label": str(value) if value is not None else "",
                    "table_id": resolved_table_id,
                    "table_name": resolved_table_name,
                    "constellation_name": resolved_constellation,
                    "planet_name": resolved_planet,
                    "metadata_fields_count": metadata_fields_count,
                    "calculated_fields_count": calculated_fields_count,
                    "guardian_rules_count": guardian_rules_count,
                    "active_alerts_count": active_alerts_count,
                    "circular_fields_count": circular_fields_count,
                    "quality_score": quality_score,
                    "status": status,
                    "created_at": created_at,
                }
            )

        rows.sort(
            key=lambda item: (
                str(item["constellation_name"]).lower(),
                str(item["planet_name"]).lower(),
                str(item["label"]).lower(),
            )
        )
        return rows
