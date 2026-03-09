from __future__ import annotations

import sys
from datetime import UTC, datetime
from pathlib import Path

import pytest
from fastapi import HTTPException, status

sys.path.append(str(Path(__file__).resolve().parents[1]))

from app.services.task_executor.contract_validation import TableContractValidator


@pytest.mark.parametrize(
    ("expected_type", "value"),
    [
        ("datetime", "2026-03-01T10:00:00Z"),
        ("timestamp", "2026-03-01T10:00:00+00:00"),
        ("timestamptz", datetime(2026, 3, 1, 10, 0, tzinfo=UTC)),
        ("date", "2026-03-01"),
    ],
)
def test_matches_expected_type_accepts_datetime_family(expected_type: str, value: object) -> None:
    assert TableContractValidator._matches_expected_type(expected_type, value) is True


@pytest.mark.parametrize(
    ("expected_type", "value"),
    [
        ("datetime", "not-a-datetime"),
        ("timestamp", "2026-99-99T99:99:99Z"),
        ("date", ""),
    ],
)
def test_matches_expected_type_rejects_invalid_datetime_values(expected_type: str, value: object) -> None:
    assert TableContractValidator._matches_expected_type(expected_type, value) is False


def test_matches_expected_type_rejects_unsupported_type() -> None:
    with pytest.raises(HTTPException) as exc:
        TableContractValidator._matches_expected_type("duration", "P3D")

    assert exc.value.status_code == status.HTTP_422_UNPROCESSABLE_CONTENT
    assert "unsupported field type 'duration'" in str(exc.value.detail)


def test_raise_contract_violation_includes_structured_payload_for_base_contract() -> None:
    with pytest.raises(HTTPException) as exc:
        TableContractValidator._raise_contract_violation(
            table_name="Core > Orders",
            reason="type_mismatch",
            message_suffix="field 'amount' must be 'number'",
            mineral_key="amount",
            actual_value="abc",
            expected_type="number",
            source=None,
        )

    assert exc.value.status_code == status.HTTP_422_UNPROCESSABLE_CONTENT
    detail = exc.value.detail
    assert isinstance(detail, dict)
    assert detail["code"] == "TABLE_CONTRACT_VIOLATION"
    assert detail["table_name"] == "Core > Orders"
    assert detail["reason"] == "type_mismatch"
    assert detail["mineral_key"] == "amount"
    assert detail["actual_value"] == "abc"
    assert detail["expected_type"] == "number"
    assert detail["expected_constraint"] == {"type": "number"}
    assert detail["repair_hint"] == "Use value compatible with type 'number' for 'amount'."
    assert detail["source"] == "base_contract"
    assert detail["capability_key"] is None
    assert detail["capability_id"] is None
    assert "Table contract violation [Core > Orders]" in detail["message"]


def test_raise_contract_violation_includes_capability_source() -> None:
    with pytest.raises(HTTPException) as exc:
        TableContractValidator._raise_contract_violation(
            table_name="Core > Orders",
            reason="validator_failed",
            message_suffix="validator failed for field 'state'",
            mineral_key="state",
            actual_value="legacy",
            operator="==",
            expected_value="active",
            rule_id="state-enum",
            source={
                "source": "moon_capability",
                "capability_key": "lifecycle-governance",
                "capability_id": "11111111-1111-1111-1111-111111111111",
            },
        )

    assert exc.value.status_code == status.HTTP_422_UNPROCESSABLE_CONTENT
    detail = exc.value.detail
    assert isinstance(detail, dict)
    assert detail["reason"] == "validator_failed"
    assert detail["mineral_key"] == "state"
    assert detail["operator"] == "=="
    assert detail["expected_value"] == "active"
    assert detail["expected_constraint"] == {"operator": "==", "value": "active"}
    assert detail["repair_hint"] == "Adjust 'state' to satisfy '== active'."
    assert detail["rule_id"] == "state-enum"
    assert detail["source"] == "moon_capability"
    assert detail["capability_key"] == "lifecycle-governance"
    assert detail["capability_id"] == "11111111-1111-1111-1111-111111111111"


def test_extract_contract_field_uses_value_as_label_fallback() -> None:
    assert (
        TableContractValidator._extract_contract_field(
            value="Entity Alpha",
            metadata={},
            field="label",
        )
        == "Entity Alpha"
    )
    assert (
        TableContractValidator._extract_contract_field(
            value="Entity Alpha",
            metadata={"label": "Custom Label"},
            field="label",
        )
        == "Custom Label"
    )


def test_extract_contract_field_supports_state_status_aliases() -> None:
    assert (
        TableContractValidator._extract_contract_field(
            value="Entity Alpha",
            metadata={"status": "active"},
            field="state",
        )
        == "active"
    )
    assert (
        TableContractValidator._extract_contract_field(
            value="Entity Alpha",
            metadata={"state": "active"},
            field="status",
        )
        == "active"
    )
