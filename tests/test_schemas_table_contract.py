from __future__ import annotations

import uuid

from app.schemas import TableContractUpsertRequest


def test_table_contract_request_builds_schema_registry_from_top_level_fields() -> None:
    payload = TableContractUpsertRequest(
        galaxy_id=uuid.uuid4(),
        required_fields=["cena", "cena", "sku"],
        field_types={"cena": "Number", "sku": "STRING"},
        unique_rules=[{"fields": ["sku"]}],
        validators=[{"field": "cena", "operator": ">", "value": 0}],
    )

    assert payload.required_fields == ["cena", "sku"]
    assert payload.field_types == {"cena": "number", "sku": "string"}
    assert payload.schema_registry["required_fields"] == ["cena", "sku"]
    assert payload.schema_registry["field_types"]["cena"] == "number"


def test_table_contract_request_uses_schema_registry_when_top_level_is_empty() -> None:
    payload = TableContractUpsertRequest(
        galaxy_id=uuid.uuid4(),
        schema_registry={
            "required_fields": ["owner"],
            "field_types": {"owner": "string"},
            "unique_rules": [{"fields": ["owner"]}],
            "validators": [{"field": "owner", "operator": "semantic", "value": {"mode": "relation"}}],
            "auto_semantics": [{"id": "role-employee", "kind": "bucket_by_metadata_value", "field": "role", "in": ["employee"]}],
        },
    )

    assert payload.required_fields == ["owner"]
    assert payload.field_types == {"owner": "string"}
    assert payload.unique_rules == [{"fields": ["owner"]}]
    assert payload.validators[0]["operator"] == "semantic"
    assert payload.auto_semantics[0]["id"] == "role-employee"


def test_table_contract_request_normalizes_formula_and_physics_registries() -> None:
    payload = TableContractUpsertRequest(
        galaxy_id=uuid.uuid4(),
        formula_registry=[
            {"id": "planet.cashflow", "target": "zustatek", "expression": "SUM(prijem)-SUM(vydaj)", "depends_on": ["prijem", "vydaj"]},
            {"id": "", "target": "bad", "expression": "x"},
        ],
        physics_rulebook={"rules": [{"id": "risk-red"}], "defaults": {"color": "#92ffd8"}},
    )

    assert len(payload.formula_registry) == 2
    assert payload.formula_registry[0]["id"] == "planet.cashflow"
    assert payload.physics_rulebook["rules"] == [{"id": "risk-red"}]
    assert payload.physics_rulebook["defaults"]["color"] == "#92ffd8"
