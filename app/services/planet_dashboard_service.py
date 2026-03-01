from __future__ import annotations

from collections import defaultdict
from datetime import datetime
from typing import Any
from uuid import UUID

from sqlalchemy.ext.asyncio import AsyncSession

from app.services.universe_service import (
    DEFAULT_GALAXY_ID,
    UniverseService,
    split_constellation_and_planet_name,
)


class PlanetDashboardService:
    def __init__(self, *, universe_service: UniverseService | None = None) -> None:
        self.universe_service = universe_service or UniverseService()

    async def list_planets(
        self,
        session: AsyncSession,
        *,
        user_id: UUID,
        galaxy_id: UUID = DEFAULT_GALAXY_ID,
        branch_id: UUID | None = None,
        as_of: datetime | None = None,
    ) -> list[dict[str, Any]]:
        tables = await self.universe_service.tables_snapshot(
            session=session,
            user_id=user_id,
            galaxy_id=galaxy_id,
            branch_id=branch_id,
            as_of=as_of,
        )
        asteroids, _ = await self.universe_service.snapshot(
            session=session,
            user_id=user_id,
            galaxy_id=galaxy_id,
            branch_id=branch_id,
            as_of=as_of,
        )

        asteroid_to_table_id: dict[str, str] = {}
        rows_by_table_id: dict[str, dict[str, Any]] = {}

        for table in tables:
            table_id = str(table.get("table_id"))
            if not table_id:
                continue

            constellation_name = str(table.get("constellation_name") or "").strip()
            planet_name = str(table.get("planet_name") or "").strip()
            if not constellation_name or not planet_name:
                resolved_constellation, resolved_planet = split_constellation_and_planet_name(table.get("name"))
                constellation_name = constellation_name or resolved_constellation
                planet_name = planet_name or resolved_planet

            members = [member for member in (table.get("members") or []) if isinstance(member, dict)]
            for member in members:
                member_id = str(member.get("id") or "")
                if member_id:
                    asteroid_to_table_id[member_id] = table_id

            rows_by_table_id[table_id] = {
                "table_id": table_id,
                "name": planet_name,
                "constellation_name": constellation_name,
                "moons_count": len(members),
                "schema_fields_count": len(table.get("schema_fields") or []),
                "formula_fields_count": len(table.get("formula_fields") or []),
                "internal_bonds_count": len(table.get("internal_bonds") or []),
                "external_bonds_count": len(table.get("external_bonds") or []),
                "guardian_rules_count": 0,
                "alerted_moons_count": 0,
                "circular_fields_count": 0,
                "quality_score": 100,
                "status": "GREEN",
                "sector_mode": str((table.get("sector") or {}).get("mode") or "belt"),
            }

        guardians_by_table: dict[str, int] = defaultdict(int)
        alerts_by_table: dict[str, int] = defaultdict(int)
        circular_by_table: dict[str, int] = defaultdict(int)

        for asteroid in asteroids:
            if isinstance(asteroid, dict):
                asteroid_id = str(asteroid.get("id") or "")
                metadata = asteroid.get("metadata")
                calculated_values = asteroid.get("calculated_values")
                active_alerts = asteroid.get("active_alerts")
            else:
                asteroid_id = str(getattr(asteroid, "id", "") or "")
                metadata = getattr(asteroid, "metadata", None)
                calculated_values = getattr(asteroid, "calculated_values", None)
                active_alerts = getattr(asteroid, "active_alerts", None)

            if not asteroid_id:
                continue

            table_id = asteroid_to_table_id.get(asteroid_id)
            if not table_id:
                continue

            metadata_dict = metadata if isinstance(metadata, dict) else {}
            calculated_values_dict = calculated_values if isinstance(calculated_values, dict) else {}
            active_alerts_list = active_alerts if isinstance(active_alerts, list) else []

            guardians = metadata_dict.get("_guardians")
            if isinstance(guardians, list):
                guardians_by_table[table_id] += len([rule for rule in guardians if isinstance(rule, dict)])

            if active_alerts_list:
                alerts_by_table[table_id] += 1

            circular_by_table[table_id] += sum(1 for value in calculated_values_dict.values() if value == "#CIRC!")

        rows: list[dict[str, Any]] = []
        for table_id, row in rows_by_table_id.items():
            guardians_count = guardians_by_table[table_id]
            alerts_count = alerts_by_table[table_id]
            circular_count = circular_by_table[table_id]

            quality_penalty = circular_count * 18 + alerts_count * 9
            quality_score = max(0, 100 - quality_penalty)

            status = "GREEN"
            if quality_score < 60:
                status = "RED"
            elif quality_score < 85:
                status = "YELLOW"

            row["guardian_rules_count"] = guardians_count
            row["alerted_moons_count"] = alerts_count
            row["circular_fields_count"] = circular_count
            row["quality_score"] = quality_score
            row["status"] = status
            rows.append(row)

        rows.sort(key=lambda item: (str(item["constellation_name"]).lower(), str(item["name"]).lower()))
        return rows

