import json
from pathlib import Path

from app.schema_models.star_core import (
    StarCoreDomainMetricPublic,
    StarCorePolicyPublic,
    StarCorePulseEventPublic,
    StarCoreRuntimePublic,
)


def _load_baseline() -> dict:
    root = Path(__file__).resolve().parents[1]
    baseline_path = root / "docs" / "star-contract-baseline-v1.json"
    with baseline_path.open("r", encoding="utf-8") as handle:
        return json.load(handle)


def _model_fields(model) -> list[str]:
    return list(model.model_fields.keys())


def test_star_contract_baseline_matches_backend_schema_models():
    baseline = _load_baseline()
    source = baseline["source_of_truth"]

    assert _model_fields(StarCorePolicyPublic) == source["policy"]["be_fields"]
    assert _model_fields(StarCoreRuntimePublic) == source["runtime"]["be_fields"]
    assert _model_fields(StarCoreDomainMetricPublic) == source["domains"]["be_fields"]
    assert _model_fields(StarCorePulseEventPublic) == source["pulse_event"]["be_fields"]
