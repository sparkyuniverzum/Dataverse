from __future__ import annotations

import uuid
from datetime import UTC, datetime
from types import SimpleNamespace

from app.schemas import (
    FactSource,
    FactStatus,
    FactValueType,
    UniverseAsteroidSnapshot,
    asteroid_snapshot_to_moon_row,
    build_moon_facts,
    infer_fact_value_type,
)
from app.services.table_contract_effective import compile_effective_table_contract


def test_infer_fact_value_type_covers_base_primitives() -> None:
    assert infer_fact_value_type(None) == FactValueType.NULL
    assert infer_fact_value_type(True) == FactValueType.BOOLEAN
    assert infer_fact_value_type(12.5) == FactValueType.NUMBER
    assert infer_fact_value_type("2026-03-03T10:00:00Z") == FactValueType.DATETIME
    assert infer_fact_value_type("text") == FactValueType.STRING
    assert infer_fact_value_type({"a": 1}) == FactValueType.JSON


def test_build_moon_facts_includes_value_metadata_and_calculated_layers() -> None:
    facts = build_moon_facts(
        value="Sroub",
        metadata={"table": "Sklad > Material", "cena": 10, "jednotka": "ks"},
        calculated_values={"celkem": 100, "bad": "#CIRC!"},
    )
    by_key = {item.key: item for item in facts}

    assert by_key["value"].source == FactSource.VALUE
    assert by_key["value"].typed_value == "Sroub"
    assert by_key["cena"].source == FactSource.METADATA
    assert by_key["cena"].value_type == FactValueType.NUMBER
    assert by_key["celkem"].source == FactSource.CALCULATED
    assert by_key["celkem"].readonly is True
    assert by_key["bad"].status == FactStatus.INVALID
    assert by_key["bad"].errors == ["Circular formula dependency"]
    assert "table" not in by_key


def test_build_moon_facts_keeps_metadata_source_when_calculated_key_collides() -> None:
    facts = build_moon_facts(
        value="Payment",
        metadata={"table": "Finance > Transactions", "amount": 123.45, "status": "paid"},
        calculated_values={"amount": 999.99, "vat": 25},
    )
    by_key = {item.key: item for item in facts}

    assert by_key["amount"].source == FactSource.METADATA
    assert by_key["amount"].typed_value == 123.45
    assert by_key["vat"].source == FactSource.CALCULATED
    assert by_key["vat"].readonly is True


def test_asteroid_snapshot_to_moon_row_projects_canonical_shape() -> None:
    snapshot = UniverseAsteroidSnapshot(
        id=uuid.uuid4(),
        value="Hrebiky",
        table_id=uuid.uuid4(),
        table_name="Sklad > Material",
        constellation_name="Sklad",
        planet_name="Material",
        metadata={"cena": 120, "jednotka": "ks"},
        calculated_values={"suma": 240},
        active_alerts=["LOW_STOCK"],
        created_at=datetime.now(UTC),
        current_event_seq=7,
    )

    row = asteroid_snapshot_to_moon_row(snapshot)

    assert row.moon_id == snapshot.id
    assert row.planet_id == snapshot.table_id
    assert row.label == "Hrebiky"
    assert row.current_event_seq == 7
    assert row.active_alerts == ["LOW_STOCK"]
    assert any(fact.key == "cena" for fact in row.facts)
    assert any(fact.key == "suma" and fact.source == FactSource.CALCULATED for fact in row.facts)


def _base_contract() -> SimpleNamespace:
    now = datetime.now(UTC)
    return SimpleNamespace(
        id=uuid.uuid4(),
        galaxy_id=uuid.uuid4(),
        table_id=uuid.uuid4(),
        version=1,
        required_fields=["entity_id"],
        field_types={"entity_id": "string", "amount": "number", "mode": "string"},
        unique_rules=[],
        validators=[],
        formula_registry=[],
        physics_rulebook={"rules": [], "defaults": {}},
        created_by=uuid.uuid4(),
        created_at=now,
        updated_at=now,
        deleted_at=None,
    )


def _capability(*, key: str, order_index: int, config: dict) -> SimpleNamespace:
    now = datetime.now(UTC)
    return SimpleNamespace(
        id=uuid.uuid4(),
        galaxy_id=uuid.uuid4(),
        table_id=uuid.uuid4(),
        capability_key=key,
        capability_class="validation",
        status="active",
        config_json=config,
        order_index=order_index,
        version=1,
        created_by=uuid.uuid4(),
        created_at=now,
        updated_at=now,
        deleted_at=None,
    )


def test_capability_composition_order_and_conflict_policy() -> None:
    base = _base_contract()
    cap_validation_low = _capability(
        key="validation.low",
        order_index=10,
        config={
            "field_types": {"amount": "string"},
            "validators": [{"id": "amount-low", "field": "amount", "operator": ">", "value": "0"}],
        },
    )
    cap_validation_high = _capability(
        key="validation.high",
        order_index=20,
        config={
            "field_types": {"amount": "number"},
            "validators": [{"id": "amount-high", "field": "amount", "operator": ">", "value": 0}],
        },
    )
    cap_mode_a = _capability(
        key="mode.alpha",
        order_index=30,
        config={"field_types": {"mode": "string"}},
    )
    cap_mode_z = _capability(
        key="mode.zeta",
        order_index=30,
        config={"field_types": {"mode": "number"}},
    )

    effective_a = compile_effective_table_contract(
        base_contract=base,
        capabilities=[cap_validation_high, cap_mode_z, cap_validation_low, cap_mode_a],
    )
    effective_b = compile_effective_table_contract(
        base_contract=base,
        capabilities=[cap_mode_a, cap_validation_low, cap_mode_z, cap_validation_high],
    )

    assert effective_a.required_fields == effective_b.required_fields
    assert effective_a.field_types == effective_b.field_types
    assert effective_a.validators == effective_b.validators
    assert effective_a.field_types["amount"] == "number"
    assert effective_a.field_type_sources["amount"]["capability_key"] == "validation.high"
    # Same order_index conflict is resolved deterministically by capability_key ordering.
    assert effective_a.field_types["mode"] == "number"
    assert effective_a.field_type_sources["mode"]["capability_key"] == "mode.zeta"
