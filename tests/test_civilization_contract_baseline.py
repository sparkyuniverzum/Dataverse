from __future__ import annotations

import json
import sys
from pathlib import Path

from fastapi.routing import APIRoute

sys.path.append(str(Path(__file__).resolve().parents[1]))

from app.main import app
from app.schema_models.execution import AsteroidIngestRequest, AsteroidMutateRequest, AsteroidResponse
from app.schema_models.universe import UniverseAsteroidSnapshot


def _root() -> Path:
    return Path(__file__).resolve().parents[1]


def _load_baseline() -> dict:
    baseline_path = _root() / "docs" / "civilization-contract-baseline-v1.json"
    with baseline_path.open("r", encoding="utf-8") as handle:
        return json.load(handle)


def _model_fields(model: type) -> list[str]:
    return list(model.model_fields.keys())


def _registered_http_signatures() -> set[str]:
    signatures: set[str] = set()
    for route in app.routes:
        if not isinstance(route, APIRoute):
            continue
        for method in route.methods:
            if method in {"HEAD", "OPTIONS"}:
                continue
            signatures.add(f"{method} {route.path}")
    return signatures


def test_civilization_contract_baseline_matches_backend_schema_models() -> None:
    source = _load_baseline()["source_of_truth"]
    assert _model_fields(AsteroidIngestRequest) == source["asteroid_ingest_request"]["be_fields"]
    assert _model_fields(AsteroidMutateRequest) == source["asteroid_mutate_request"]["be_fields"]
    assert _model_fields(AsteroidResponse) == source["asteroid_response"]["be_fields"]
    assert _model_fields(UniverseAsteroidSnapshot) == source["civilization_snapshot_row"]["be_fields"]


def test_civilization_contract_baseline_routes_are_registered() -> None:
    source = _load_baseline()["source_of_truth"]
    expected_signatures = set(source["civilization_endpoints"])
    runtime_signatures = _registered_http_signatures()
    for signature in expected_signatures:
        assert signature in runtime_signatures


def test_civilization_contract_doc_contains_frozen_markers() -> None:
    baseline = _load_baseline()
    source = baseline["source_of_truth"]
    contract_doc = _root() / baseline["contract_doc"]
    body = contract_doc.read_text(encoding="utf-8")
    for marker in source["contract_doc_markers"]:
        assert marker in body
