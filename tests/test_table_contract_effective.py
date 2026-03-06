from __future__ import annotations

import uuid
from datetime import UTC, datetime
from types import SimpleNamespace

from app.services.table_contract_effective import compile_effective_table_contract


def _base_contract() -> SimpleNamespace:
    now = datetime.now(UTC)
    return SimpleNamespace(
        id=uuid.uuid4(),
        galaxy_id=uuid.uuid4(),
        table_id=uuid.uuid4(),
        version=1,
        required_fields=["entity_id", "label"],
        field_types={"entity_id": "string", "label": "string"},
        unique_rules=[{"fields": ["entity_id"]}],
        validators=[],
        formula_registry=[],
        physics_rulebook={"rules": [], "defaults": {"color": "#92ffd8", "auto_semantics": []}},
        created_by=uuid.uuid4(),
        created_at=now,
        updated_at=now,
        deleted_at=None,
    )


def _capability(*, capability_key: str, order_index: int, config: dict, status: str = "active") -> SimpleNamespace:
    now = datetime.now(UTC)
    return SimpleNamespace(
        id=uuid.uuid4(),
        galaxy_id=uuid.uuid4(),
        table_id=uuid.uuid4(),
        capability_key=capability_key,
        capability_class="validation",
        config_json=config,
        order_index=order_index,
        status=status,
        version=1,
        created_by=uuid.uuid4(),
        created_at=now,
        updated_at=now,
        deleted_at=None,
    )


def test_compile_effective_table_contract_merges_validation_fields() -> None:
    base = _base_contract()
    capability = _capability(
        capability_key="cashflow.validation",
        order_index=10,
        config={
            "required_fields": ["amount"],
            "field_types": {"amount": "number"},
            "validators": [{"field": "amount", "operator": ">", "value": 0}],
        },
    )

    effective = compile_effective_table_contract(base_contract=base, capabilities=[capability])

    assert effective.version == 1
    assert set(effective.required_fields) == {"entity_id", "label", "amount"}
    assert effective.field_types["amount"] == "number"
    assert any(str(item.get("field")) == "amount" for item in effective.validators)


def test_compile_effective_table_contract_ignores_deprecated_capabilities() -> None:
    base = _base_contract()
    capability = _capability(
        capability_key="cashflow.validation",
        order_index=10,
        config={"required_fields": ["amount"], "field_types": {"amount": "number"}},
        status="deprecated",
    )

    effective = compile_effective_table_contract(base_contract=base, capabilities=[capability])

    assert "amount" not in effective.required_fields
    assert "amount" not in effective.field_types
