from __future__ import annotations

from collections import defaultdict
from datetime import datetime
from typing import Any
from uuid import UUID

from sqlalchemy.ext.asyncio import AsyncSession

from app.services.universe_service import (
    DEFAULT_GALAXY_ID,
    UniverseService,
    derive_table_name,
    split_constellation_and_planet_name,
)


class ConstellationDashboardService:
    def __init__(self, *, universe_service: UniverseService | None = None) -> None:
        self.universe_service = universe_service or UniverseService()

    async def list_constellations(
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

        by_name: dict[str, dict[str, Any]] = {}
        table_to_constellation: dict[str, str] = {}

        for table in tables:
            table_id = str(table.get("table_id"))
            constellation_name = str(table.get("constellation_name") or "").strip()
            if not constellation_name:
                name = str(table.get("name") or "")
                constellation_name, _ = split_constellation_and_planet_name(name)

            bucket = by_name.setdefault(
                constellation_name,
                {
                    "name": constellation_name,
                    "planets_count": 0,
                    "moons_count": 0,
                    "formula_fields_count": 0,
                    "internal_bonds_count": 0,
                    "external_bonds_count": 0,
                    "table_ids": set(),
                    "planet_names": set(),
                    "internal_bond_ids": set(),
                    "external_bond_ids": set(),
                },
            )
            table_to_constellation[table_id] = constellation_name
            bucket["table_ids"].add(table_id)
            bucket["planets_count"] += 1
            bucket["moons_count"] += len(table.get("members") or [])
            bucket["formula_fields_count"] += len(table.get("formula_fields") or [])

            planet_name = str(table.get("planet_name") or "").strip()
            if not planet_name:
                _, planet_name = split_constellation_and_planet_name(str(table.get("name") or ""))
            if planet_name:
                bucket["planet_names"].add(planet_name)

        # Internal/external bonds at constellation level (dedup by bond id)
        for table in tables:
            table_id = str(table.get("table_id"))
            current_constellation = table_to_constellation.get(table_id)
            if not current_constellation:
                continue
            bucket = by_name[current_constellation]

            for bond in table.get("internal_bonds") or []:
                bond_id = str(bond.get("id") or "")
                if bond_id:
                    bucket["internal_bond_ids"].add(bond_id)

            for bond in table.get("external_bonds") or []:
                bond_id = str(bond.get("id") or "")
                if not bond_id:
                    continue
                peer_table_id = str(bond.get("peer_table_id") or "")
                peer_constellation = table_to_constellation.get(peer_table_id)
                if peer_constellation and peer_constellation == current_constellation:
                    bucket["internal_bond_ids"].add(bond_id)
                else:
                    bucket["external_bond_ids"].add(bond_id)

        guardians_by_constellation: dict[str, int] = defaultdict(int)
        alerts_by_constellation: dict[str, int] = defaultdict(int)
        circular_by_constellation: dict[str, int] = defaultdict(int)

        for asteroid in asteroids:
            if not isinstance(asteroid, dict):
                metadata = getattr(asteroid, "metadata", None)
                value = getattr(asteroid, "value", None)
                calculated_values = {}
                active_alerts = []
            else:
                metadata = asteroid.get("metadata")
                value = asteroid.get("value")
                calculated_values = asteroid.get("calculated_values")
                active_alerts = asteroid.get("active_alerts")

            metadata_dict = metadata if isinstance(metadata, dict) else {}
            table_name = derive_table_name(value=value, metadata=metadata_dict)
            constellation_name, _ = split_constellation_and_planet_name(table_name)

            guardians = metadata_dict.get("_guardians")
            if isinstance(guardians, list):
                guardians_by_constellation[constellation_name] += len([rule for rule in guardians if isinstance(rule, dict)])

            if isinstance(active_alerts, list) and active_alerts:
                alerts_by_constellation[constellation_name] += 1

            if isinstance(calculated_values, dict):
                circular_by_constellation[constellation_name] += sum(1 for value in calculated_values.values() if value == "#CIRC!")

        rows: list[dict[str, Any]] = []
        for constellation_name, bucket in by_name.items():
            internal_count = len(bucket["internal_bond_ids"])
            external_count = len(bucket["external_bond_ids"])
            guardians_count = guardians_by_constellation[constellation_name]
            alerted_count = alerts_by_constellation[constellation_name]
            circular_count = circular_by_constellation[constellation_name]

            quality_penalty = circular_count * 15 + alerted_count * 8
            quality_score = max(0, 100 - quality_penalty)
            status = "GREEN"
            if quality_score < 60:
                status = "RED"
            elif quality_score < 85:
                status = "YELLOW"

            rows.append(
                {
                    "name": constellation_name,
                    "planets_count": bucket["planets_count"],
                    "planet_names": sorted(bucket["planet_names"]),
                    "moons_count": bucket["moons_count"],
                    "formula_fields_count": bucket["formula_fields_count"],
                    "internal_bonds_count": internal_count,
                    "external_bonds_count": external_count,
                    "guardian_rules_count": guardians_count,
                    "alerted_moons_count": alerted_count,
                    "circular_fields_count": circular_count,
                    "quality_score": quality_score,
                    "status": status,
                }
            )

        rows.sort(key=lambda item: str(item["name"]).lower())
        return rows
