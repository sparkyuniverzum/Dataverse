from __future__ import annotations

from dataclasses import dataclass
from datetime import UTC, datetime
from uuid import uuid4

from app.services.calc_engine_service import CalcEngineService
from app.services.universe_service import derive_table_id


@dataclass
class DummyAtom:
    id: object
    value: str
    metadata_: dict
    created_at: datetime


@dataclass
class DummyBond:
    source_civilization_id: object
    target_civilization_id: object
    type: str


def test_build_calc_rows_extracts_values_and_circular_count() -> None:
    a_id = uuid4()
    b_id = uuid4()

    rows = CalcEngineService.build_calc_rows(
        [
            {
                "id": a_id,
                "calculated_values": {
                    "sum": 150,
                    "loop": "#CIRC!",
                },
            },
            {
                "id": b_id,
                "calculated_values": {
                    "avg": 75,
                },
            },
        ]
    )

    by_id = {row["asteroid_id"]: row for row in rows}
    assert by_id[a_id]["circular_fields_count"] == 1
    assert by_id[a_id]["calculated_values"]["sum"] == 150
    assert by_id[b_id]["circular_fields_count"] == 0


def test_build_calc_rows_skips_invalid_asteroid_id() -> None:
    rows = CalcEngineService.build_calc_rows(
        [
            {"id": "not-a-uuid", "calculated_values": {"x": 1}},
            {"id": str(uuid4()), "calculated_values": {"x": 2}},
        ]
    )

    assert len(rows) == 1
    assert rows[0]["calculated_values"]["x"] == 2


def test_evaluate_atoms_uses_flow_bonds_only_for_aggregation() -> None:
    service = CalcEngineService()
    now = datetime.now(UTC)
    galaxy_id = uuid4()

    root_id = uuid4()
    flow_source_id = uuid4()
    relation_source_id = uuid4()

    atoms = [
        DummyAtom(id=root_id, value="Root", metadata_={"total": "=SUM(cena)"}, created_at=now),
        DummyAtom(id=flow_source_id, value="FlowSource", metadata_={"cena": 100}, created_at=now),
        DummyAtom(id=relation_source_id, value="RelationSource", metadata_={"cena": 900}, created_at=now),
    ]
    bonds = [
        DummyBond(source_civilization_id=flow_source_id, target_civilization_id=root_id, type="FLOW"),
        DummyBond(source_civilization_id=relation_source_id, target_civilization_id=root_id, type="RELATION"),
    ]

    evaluated = service.evaluate_atoms(
        galaxy_id=galaxy_id,
        atoms=atoms,
        bonds=bonds,
        contracts_by_table_id={},
    )

    by_id = {item["id"]: item for item in evaluated}
    assert by_id[root_id]["calculated_values"]["total"] == 100


def test_evaluate_atoms_uses_formula_registry_as_primary_source() -> None:
    service = CalcEngineService()
    now = datetime.now(UTC)
    galaxy_id = uuid4()
    table_name = "Finance"
    table_id = derive_table_id(galaxy_id=galaxy_id, table_name=table_name)

    root_id = uuid4()
    src_a = uuid4()
    src_b = uuid4()

    atoms = [
        DummyAtom(id=root_id, value="Root", metadata_={"table": table_name}, created_at=now),
        DummyAtom(id=src_a, value="A", metadata_={"table": table_name, "cena": "20"}, created_at=now),
        DummyAtom(id=src_b, value="B", metadata_={"table": table_name, "cena": "30"}, created_at=now),
    ]
    bonds = [
        DummyBond(source_civilization_id=src_a, target_civilization_id=root_id, type="FLOW"),
        DummyBond(source_civilization_id=src_b, target_civilization_id=root_id, type="FLOW"),
    ]
    contracts = {
        table_id: {
            "formula_registry": [
                {
                    "id": "planet.total",
                    "target": "total",
                    "expression": "SUM(cena)",
                    "enabled": True,
                }
            ]
        }
    }

    evaluated = service.evaluate_atoms(
        galaxy_id=galaxy_id,
        atoms=atoms,
        bonds=bonds,
        contracts_by_table_id=contracts,
    )

    root = next(item for item in evaluated if item["id"] == root_id)
    assert root["calculated_values"]["total"] == 50


def test_evaluate_atoms_reports_deterministic_formula_error_codes() -> None:
    service = CalcEngineService()
    now = datetime.now(UTC)
    galaxy_id = uuid4()
    table_name = "Finance"
    table_id = derive_table_id(galaxy_id=galaxy_id, table_name=table_name)

    root_id = uuid4()
    atoms = [
        DummyAtom(id=root_id, value="Root", metadata_={"table": table_name}, created_at=now),
    ]

    contracts = {
        table_id: {
            "formula_registry": [
                {
                    "id": "planet.bad",
                    "target": "bad_field",
                    "expression": "INVALID(cena)",
                    "enabled": True,
                }
            ]
        }
    }

    evaluated = service.evaluate_atoms(
        galaxy_id=galaxy_id,
        atoms=atoms,
        bonds=[],
        contracts_by_table_id=contracts,
    )

    root = evaluated[0]
    assert isinstance(root.get("calc_errors"), list)
    assert any(error.get("code") == "FORMULA_PARSE_ERROR" for error in root["calc_errors"])
