from __future__ import annotations

import json
import sys
from pathlib import Path

from fastapi.routing import APIRoute

sys.path.append(str(Path(__file__).resolve().parents[1]))

from app.main import app


def _root() -> Path:
    return Path(__file__).resolve().parents[1]


def _load_baseline() -> dict:
    baseline_path = _root() / "docs" / "moon-contract-baseline-v1.json"
    with baseline_path.open("r", encoding="utf-8") as handle:
        return json.load(handle)


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


def test_moon_freeze_gate_baseline_envelope_is_stable() -> None:
    baseline = _load_baseline()
    assert baseline["version"] == "1.0.0"
    assert baseline["scope"] == "moon-contract-v1"
    assert baseline["contract_doc"] == "docs/contracts/moon-contract-v1.md"


def test_moon_freeze_gate_routes_match_contract_exactly_and_keep_soft_delete_only() -> None:
    source = _load_baseline()["source_of_truth"]
    expected_signatures = set(source["moon_endpoints"])
    expected_paths = {signature.split(" ", 1)[1] for signature in expected_signatures}
    runtime_moon_signatures = {
        signature for signature in _registered_http_signatures() if signature.split(" ", 1)[1] in expected_paths
    }
    assert runtime_moon_signatures == expected_signatures

    forbidden_delete_routes = [
        signature
        for signature in _registered_http_signatures()
        if signature.startswith("DELETE ") and signature.split(" ", 1)[1].startswith("/moons")
    ]
    assert forbidden_delete_routes == []


def test_moon_freeze_gate_contract_doc_keeps_invariant_markers() -> None:
    contract_doc = _root() / "docs/contracts/moon-contract-v1.md"
    body = contract_doc.read_text(encoding="utf-8")

    required_markers = [
        "## 5. API path mapping",
        "GET /moons",
        "POST /moons",
        "PATCH /moons/{moon_id}/mutate",
        "PATCH /moons/{moon_id}/extinguish",
        "## 6. Invariants",
        "Moon capability effects are deterministic for the same input timeline.",
        "No Moon capability may introduce hard-delete semantics.",
    ]
    for marker in required_markers:
        assert marker in body
