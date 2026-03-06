from __future__ import annotations

import sys
import uuid
from pathlib import Path

import pytest
from pydantic import ValidationError

sys.path.append(str(Path(__file__).resolve().parents[1]))

from app.schema_models.moon_capabilities import (
    MoonCapabilityCreateRequest,
    MoonCapabilityDeprecateRequest,
    MoonCapabilityUpdateRequest,
)


def test_moon_capability_create_request_normalizes_fields() -> None:
    payload = MoonCapabilityCreateRequest(
        galaxy_id=uuid.uuid4(),
        capability_key="  cashflow_rules  ",
        capability_class="validation",
        config={"required": ["amount"]},
        idempotency_key="  key-1  ",
    )
    assert payload.capability_key == "cashflow_rules"
    assert payload.idempotency_key == "key-1"


@pytest.mark.parametrize("capability_class", ["unknown", "", "VALIDATION"])
def test_moon_capability_create_request_rejects_invalid_capability_class(capability_class: str) -> None:
    with pytest.raises(ValidationError):
        MoonCapabilityCreateRequest(
            capability_key="rules",
            capability_class=capability_class,
            config={},
        )


def test_moon_capability_update_request_requires_patch() -> None:
    with pytest.raises(ValidationError):
        MoonCapabilityUpdateRequest(galaxy_id=uuid.uuid4())


def test_moon_capability_deprecate_request_normalizes_idempotency() -> None:
    payload = MoonCapabilityDeprecateRequest(galaxy_id=uuid.uuid4(), idempotency_key="  abc  ")
    assert payload.idempotency_key == "abc"
