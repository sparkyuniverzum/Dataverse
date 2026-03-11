from __future__ import annotations

from datetime import datetime
from typing import Any
from uuid import UUID

from sqlalchemy.ext.asyncio import AsyncSession

from app.domains.bonds.semantics import bond_semantics
from app.services.universe_service import (
    DEFAULT_GALAXY_ID,
    UniverseService,
    derive_table_id,
    derive_table_name,
    split_constellation_and_planet_name,
)


class BondDashboardService:
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
        civilizations, bonds = await self.universe_service.snapshot(
            session=session,
            user_id=user_id,
            galaxy_id=galaxy_id,
            branch_id=branch_id,
            as_of=as_of,
        )

        civilization_by_id: dict[UUID, dict[str, Any]] = {}
        for civilization in civilizations:
            if isinstance(civilization, dict):
                civilization_id = civilization.get("id")
                value = civilization.get("value")
                metadata = civilization.get("metadata")
                calculated_values = civilization.get("calculated_values")
                active_alerts = civilization.get("active_alerts")
                table_name = civilization.get("table_name")
                table_id = civilization.get("table_id")
                constellation_name = civilization.get("constellation_name")
                planet_name = civilization.get("planet_name")
            else:
                civilization_id = getattr(civilization, "id", None)
                value = getattr(civilization, "value", None)
                metadata = getattr(civilization, "metadata", None)
                calculated_values = getattr(civilization, "calculated_values", None)
                active_alerts = getattr(civilization, "active_alerts", None)
                table_name = getattr(civilization, "table_name", None)
                table_id = getattr(civilization, "table_id", None)
                constellation_name = getattr(civilization, "constellation_name", None)
                planet_name = getattr(civilization, "planet_name", None)

            if not isinstance(civilization_id, UUID):
                continue

            metadata_dict = metadata if isinstance(metadata, dict) else {}
            calculated_values_dict = calculated_values if isinstance(calculated_values, dict) else {}
            active_alerts_list = active_alerts if isinstance(active_alerts, list) else []

            resolved_table_name = (
                str(table_name).strip()
                if isinstance(table_name, str) and table_name.strip()
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

            civilization_by_id[civilization_id] = {
                "id": civilization_id,
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
            if isinstance(bond, dict):
                source_id = bond.get("source_civilization_id")
                target_id = bond.get("target_civilization_id")
                bond_id = bond.get("id")
                bond_type_raw = bond.get("type")
                bond_created_at = bond.get("created_at")
            else:
                source_id = getattr(bond, "source_civilization_id", None)
                target_id = getattr(bond, "target_civilization_id", None)
                bond_id = getattr(bond, "id", None)
                bond_type_raw = getattr(bond, "type", None)
                bond_created_at = getattr(bond, "created_at", None)

            if not isinstance(source_id, UUID) or not isinstance(target_id, UUID) or not isinstance(bond_id, UUID):
                continue

            source = civilization_by_id.get(source_id)
            target = civilization_by_id.get(target_id)
            if source is None or target is None:
                continue

            semantics = bond_semantics(bond_type_raw)
            bond_type = semantics.bond_type
            directional = semantics.directional
            flow_direction = semantics.flow_direction

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
                    "bond_id": bond_id,
                    "type": bond_type,
                    "directional": directional,
                    "flow_direction": flow_direction,
                    "source_civilization_id": source["id"],
                    "target_civilization_id": target["id"],
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
                    "created_at": bond_created_at,
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
