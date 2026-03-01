from __future__ import annotations

from datetime import datetime
from typing import Any
from uuid import UUID

from sqlalchemy.ext.asyncio import AsyncSession

from app.services.universe_service import DEFAULT_GALAXY_ID, UniverseService, derive_table_id, derive_table_name, split_constellation_and_planet_name


class BondDashboardService:
    DIRECTIONAL_TYPES = {"TYPE", "FORMULA", "GUARDIAN"}

    def __init__(self, *, universe_service: UniverseService | None = None) -> None:
        self.universe_service = universe_service or UniverseService()

    async def list_bonds(
        self,
        session: AsyncSession,
        *,
        user_id: UUID,
        galaxy_id: UUID = DEFAULT_GALAXY_ID,
        branch_id: UUID | None = None,
        as_of: datetime | None = None,
    ) -> list[dict[str, Any]]:
        asteroids, bonds = await self.universe_service.snapshot(
            session=session,
            user_id=user_id,
            galaxy_id=galaxy_id,
            branch_id=branch_id,
            as_of=as_of,
        )

        asteroid_by_id: dict[UUID, dict[str, Any]] = {}
        for asteroid in asteroids:
            if isinstance(asteroid, dict):
                asteroid_id = asteroid.get("id")
                value = asteroid.get("value")
                metadata = asteroid.get("metadata")
                calculated_values = asteroid.get("calculated_values")
                active_alerts = asteroid.get("active_alerts")
                table_name = asteroid.get("table_name")
                table_id = asteroid.get("table_id")
                constellation_name = asteroid.get("constellation_name")
                planet_name = asteroid.get("planet_name")
            else:
                asteroid_id = getattr(asteroid, "id", None)
                value = getattr(asteroid, "value", None)
                metadata = getattr(asteroid, "metadata", None)
                calculated_values = getattr(asteroid, "calculated_values", None)
                active_alerts = getattr(asteroid, "active_alerts", None)
                table_name = getattr(asteroid, "table_name", None)
                table_id = getattr(asteroid, "table_id", None)
                constellation_name = getattr(asteroid, "constellation_name", None)
                planet_name = getattr(asteroid, "planet_name", None)

            if not isinstance(asteroid_id, UUID):
                continue

            metadata_dict = metadata if isinstance(metadata, dict) else {}
            calculated_values_dict = calculated_values if isinstance(calculated_values, dict) else {}
            active_alerts_list = active_alerts if isinstance(active_alerts, list) else []

            resolved_table_name = (
                str(table_name).strip()
                if isinstance(table_name, str) and table_name.strip()
                else derive_table_name(value=value, metadata=metadata_dict)
            )
            resolved_table_id = table_id if isinstance(table_id, UUID) else derive_table_id(galaxy_id=galaxy_id, table_name=resolved_table_name)

            resolved_constellation = str(constellation_name).strip() if isinstance(constellation_name, str) else ""
            resolved_planet = str(planet_name).strip() if isinstance(planet_name, str) else ""
            if not resolved_constellation or not resolved_planet:
                fallback_constellation, fallback_planet = split_constellation_and_planet_name(resolved_table_name)
                resolved_constellation = resolved_constellation or fallback_constellation
                resolved_planet = resolved_planet or fallback_planet

            asteroid_by_id[asteroid_id] = {
                "id": asteroid_id,
                "label": str(value) if value is not None else "",
                "table_id": resolved_table_id,
                "table_name": resolved_table_name,
                "constellation_name": resolved_constellation,
                "planet_name": resolved_planet,
                "alerts_count": len(active_alerts_list),
                "circular_fields_count": sum(1 for item in calculated_values_dict.values() if item == "#CIRC!"),
            }

        rows: list[dict[str, Any]] = []
        for bond in bonds:
            source = asteroid_by_id.get(bond.source_id)
            target = asteroid_by_id.get(bond.target_id)
            if source is None or target is None:
                continue

            bond_type = str(bond.type or "RELATION").upper()
            directional = bond_type in self.DIRECTIONAL_TYPES
            flow_direction = "source_to_target" if directional else "bidirectional"

            alerts_count = int(source["alerts_count"]) + int(target["alerts_count"])
            circular_count = int(source["circular_fields_count"]) + int(target["circular_fields_count"])

            quality_penalty = circular_count * 16 + alerts_count * 8
            quality_score = max(0, 100 - quality_penalty)
            status = "GREEN"
            if quality_score < 60:
                status = "RED"
            elif quality_score < 85:
                status = "YELLOW"

            rows.append(
                {
                    "bond_id": bond.id,
                    "type": bond_type,
                    "directional": directional,
                    "flow_direction": flow_direction,
                    "source_id": source["id"],
                    "target_id": target["id"],
                    "source_label": source["label"],
                    "target_label": target["label"],
                    "source_table_id": source["table_id"],
                    "target_table_id": target["table_id"],
                    "source_constellation_name": source["constellation_name"],
                    "source_planet_name": source["planet_name"],
                    "target_constellation_name": target["constellation_name"],
                    "target_planet_name": target["planet_name"],
                    "active_alerts_count": alerts_count,
                    "circular_fields_count": circular_count,
                    "quality_score": quality_score,
                    "status": status,
                    "created_at": bond.created_at,
                }
            )

        rows.sort(
            key=lambda item: (
                str(item["source_constellation_name"]).lower(),
                str(item["source_planet_name"]).lower(),
                str(item["source_label"]).lower(),
                str(item["target_label"]).lower(),
            )
        )
        return rows

