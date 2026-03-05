import sys
import uuid
from dataclasses import dataclass
from datetime import UTC, datetime
from pathlib import Path

sys.path.append(str(Path(__file__).resolve().parents[1]))

from app.services.calc_service import evaluate_universe


@dataclass
class DummyAtom:
    id: uuid.UUID
    value: str
    metadata_: dict
    created_at: datetime


@dataclass
class DummyBond:
    source_id: uuid.UUID
    target_id: uuid.UUID


def test_evaluate_universe_sum_and_avg() -> None:
    project_id = uuid.uuid4()
    task_a_id = uuid.uuid4()
    task_b_id = uuid.uuid4()
    now = datetime.now(UTC)

    atoms = [
        DummyAtom(
            id=project_id,
            value="Projekt",
            metadata_={"celkem": "=SUM(cena)", "prumer": "=AVG(cena)"},
            created_at=now,
        ),
        DummyAtom(id=task_a_id, value="A", metadata_={"cena": "100"}, created_at=now),
        DummyAtom(id=task_b_id, value="B", metadata_={"cena": 50}, created_at=now),
    ]
    bonds = [
        DummyBond(source_id=project_id, target_id=task_a_id),
        DummyBond(source_id=project_id, target_id=task_b_id),
    ]

    evaluated = evaluate_universe(atoms, bonds)
    by_id = {item["id"]: item for item in evaluated}
    project = by_id[project_id]

    assert project["metadata"]["celkem"] == 150
    assert project["metadata"]["prumer"] == 75
    assert project["value"] == "Projekt"


def test_evaluate_universe_count_ignores_non_numeric_values() -> None:
    root_id = uuid.uuid4()
    a_id = uuid.uuid4()
    b_id = uuid.uuid4()
    c_id = uuid.uuid4()
    now = datetime.now(UTC)

    atoms = [
        DummyAtom(id=root_id, value="Root", metadata_={"pocet": "=COUNT(cena)"}, created_at=now),
        DummyAtom(id=a_id, value="A", metadata_={"cena": "9"}, created_at=now),
        DummyAtom(id=b_id, value="B", metadata_={"cena": "x"}, created_at=now),
        DummyAtom(id=c_id, value="C", metadata_={"cena": 1.5}, created_at=now),
    ]
    bonds = [
        DummyBond(source_id=root_id, target_id=a_id),
        DummyBond(source_id=root_id, target_id=b_id),
        DummyBond(source_id=root_id, target_id=c_id),
    ]

    evaluated = evaluate_universe(atoms, bonds)
    root = {item["id"]: item for item in evaluated}[root_id]
    assert root["metadata"]["pocet"] == 2


def test_evaluate_universe_resolves_recursive_formula_chain() -> None:
    root_id = uuid.uuid4()
    mid_id = uuid.uuid4()
    leaf_id = uuid.uuid4()
    now = datetime.now(UTC)

    atoms = [
        DummyAtom(id=root_id, value="Root", metadata_={"sum_mid": "=SUM(v)"}, created_at=now),
        DummyAtom(id=mid_id, value="Mid", metadata_={"v": "=SUM(cena)"}, created_at=now),
        DummyAtom(id=leaf_id, value="Leaf", metadata_={"cena": "8"}, created_at=now),
    ]
    bonds = [
        DummyBond(source_id=root_id, target_id=mid_id),
        DummyBond(source_id=mid_id, target_id=leaf_id),
    ]

    evaluated = evaluate_universe(atoms, bonds)
    by_id = {item["id"]: item for item in evaluated}
    assert by_id[mid_id]["metadata"]["v"] == 8
    assert by_id[root_id]["metadata"]["sum_mid"] == 8


def test_evaluate_universe_detects_circular_reference() -> None:
    a_id = uuid.uuid4()
    b_id = uuid.uuid4()
    now = datetime.now(UTC)

    atoms = [
        DummyAtom(id=a_id, value="A", metadata_={"x": "=SUM(x)"}, created_at=now),
        DummyAtom(id=b_id, value="B", metadata_={"x": "=SUM(x)"}, created_at=now),
    ]
    bonds = [DummyBond(source_id=a_id, target_id=b_id)]

    evaluated = evaluate_universe(atoms, bonds)
    by_id = {item["id"]: item for item in evaluated}
    assert by_id[a_id]["metadata"]["x"] == "#CIRC!"
    assert by_id[b_id]["metadata"]["x"] == "#CIRC!"
