from __future__ import annotations

from uuid import uuid4

from app.services.universe.tables_snapshot import build_tables_snapshot
from app.services.universe_service import UniverseService


def test_tables_snapshot_uses_manual_visual_position_when_present() -> None:
    service = UniverseService()
    galaxy_id = uuid4()
    table_id = uuid4()

    tables = build_tables_snapshot(
        service,
        galaxy_id=galaxy_id,
        asteroids=[],
        bonds=[],
        contract_hints={
            table_id: {
                "table_name": "Core > Planeta-1",
                "schema_fields": ["transaction_name", "amount", "transaction_type"],
                "formula_fields": [],
                "planet_archetype": "catalog",
                "contract_version": 1,
                "planet_visual_position": {"x": 190, "y": 12, "z": -40},
            }
        },
    )

    assert len(tables) == 1
    table = tables[0]
    assert table["table_id"] == table_id
    assert table["sector"]["center"] == [190.0, 12.0, -40.0]
    assert table["sector"]["mode"] == "manual"


def test_tables_snapshot_falls_back_to_derived_sector_when_manual_missing() -> None:
    service = UniverseService()
    galaxy_id = uuid4()
    table_id = uuid4()

    tables = build_tables_snapshot(
        service,
        galaxy_id=galaxy_id,
        asteroids=[],
        bonds=[],
        contract_hints={
            table_id: {
                "table_name": "Core > Planeta-1",
                "schema_fields": ["entity_id"],
                "formula_fields": [],
                "planet_archetype": "catalog",
                "contract_version": 1,
            }
        },
    )

    assert len(tables) == 1
    table = tables[0]
    assert table["sector"]["mode"] in {"belt", "ring"}
    assert len(table["sector"]["center"]) == 3
