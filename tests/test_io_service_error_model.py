from __future__ import annotations

import json

from fastapi import HTTPException, status

from app.services.io_service import ImportExportService


def test_classify_row_failure_value_error() -> None:
    failure = ImportExportService._classify_row_failure(ValueError("Row requires 'value' column"))

    assert failure.code == "ROW_INPUT_INVALID"
    assert "requires 'value'" in failure.message
    assert failure.details["kind"] == "value_error"


def test_classify_row_failure_http_contract_violation() -> None:
    failure = ImportExportService._classify_row_failure(
        HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail="Table contract violation [Finance]: field 'cena' must be 'number'",
        )
    )

    assert failure.code == "ROW_CONTRACT_VIOLATION"
    assert "Table contract violation" in failure.message
    assert failure.details["http_status"] == 422


def test_classify_row_failure_http_conflict_uses_domain_code() -> None:
    failure = ImportExportService._classify_row_failure(
        HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail={"code": "OCC_CONFLICT", "message": "OCC conflict for UPDATE_ASTEROID"},
        )
    )

    assert failure.code == "OCC_CONFLICT"
    assert "OCC conflict" in failure.message
    assert failure.details["http_status"] == 409


def test_serialize_row_error_payload_contains_structured_error() -> None:
    failure = ImportExportService._classify_row_failure(ValueError("Invalid UUID: bad"))
    payload = ImportExportService._serialize_row_error_payload(
        row={"source_id": "bad", "target_id": ""},
        failure=failure,
    )
    parsed = json.loads(payload)

    assert parsed["row"]["source_id"] == "bad"
    assert parsed["error"]["code"] == "ROW_INPUT_INVALID"
    assert "Invalid UUID" in parsed["error"]["message"]
