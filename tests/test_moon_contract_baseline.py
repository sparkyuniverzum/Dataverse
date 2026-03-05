from __future__ import annotations

import json
import sys
from pathlib import Path

from fastapi.routing import APIRoute

sys.path.append(str(Path(__file__).resolve().parents[1]))

from app.main import app
from app.schema_models.moons import MoonCreateRequest, MoonExtinguishResponse, MoonListResponse, MoonMutateRequest
from app.schema_models.universe import MoonRowContract


def _root() -> Path:
    return Path(__file__).resolve().parents[1]


def _load_baseline() -> dict:
    baseline_path = _root() / "docs" / "moon-contract-baseline-v1.json"
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


def test_moon_contract_baseline_matches_backend_schema_models() -> None:
    source = _load_baseline()["source_of_truth"]
    assert _model_fields(MoonCreateRequest) == source["moon_create_request"]["be_fields"]
    assert _model_fields(MoonMutateRequest) == source["moon_mutate_request"]["be_fields"]
    assert _model_fields(MoonRowContract) == source["moon_row_public"]["be_fields"]
    assert _model_fields(MoonListResponse) == source["moon_list_response"]["be_fields"]
    assert _model_fields(MoonExtinguishResponse) == source["moon_extinguish_response"]["be_fields"]


def test_moon_contract_baseline_routes_are_registered() -> None:
    source = _load_baseline()["source_of_truth"]
    expected_signatures = set(source["moon_endpoints"])
    runtime_signatures = _registered_http_signatures()
    for signature in expected_signatures:
        assert signature in runtime_signatures


def test_moon_contract_doc_contains_frozen_markers() -> None:
    baseline = _load_baseline()
    source = baseline["source_of_truth"]
    contract_doc = _root() / baseline["contract_doc"]
    body = contract_doc.read_text(encoding="utf-8")
    for marker in source["contract_doc_markers"]:
        assert marker in body
