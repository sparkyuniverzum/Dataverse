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
