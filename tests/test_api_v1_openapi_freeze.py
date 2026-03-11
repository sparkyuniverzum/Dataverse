from __future__ import annotations

import hashlib
import json
import sys
from pathlib import Path

from fastapi.routing import APIRoute

sys.path.append(str(Path(__file__).resolve().parents[1]))

from app.main import app


def _root() -> Path:
    return Path(__file__).resolve().parents[1]


def _load_baseline() -> dict:
    baseline_path = _root() / "docs" / "api-v1-openapi-baseline-v1.json"
    with baseline_path.open("r", encoding="utf-8") as handle:
        return json.load(handle)


def _method_path_signatures() -> list[str]:
    signatures: set[str] = set()
    for route in app.routes:
        if not isinstance(route, APIRoute):
            continue
        for method in route.methods:
            if method in {"HEAD", "OPTIONS"}:
                continue
            signatures.add(f"{method} {route.path}")
    return sorted(signatures)


def _freeze_payload(schema: dict) -> dict:
    return {
        "openapi": schema.get("openapi"),
        "info": {
            "title": schema.get("info", {}).get("title"),
            "version": schema.get("info", {}).get("version"),
        },
        "paths": schema.get("paths", {}),
        "components": schema.get("components", {}),
        "security": schema.get("security", []),
    }


def _freeze_hash(schema: dict) -> str:
    payload = _freeze_payload(schema)
    serialized = json.dumps(payload, ensure_ascii=False, sort_keys=True, separators=(",", ":"))
    return hashlib.sha256(serialized.encode("utf-8")).hexdigest()


def test_api_v1_openapi_baseline_envelope_is_stable() -> None:
    baseline = _load_baseline()
    source = baseline["source_of_truth"]

    assert baseline["version"] == "1.0.0"
    assert baseline["scope"] == "api-v1-openapi-freeze"
    assert baseline["contract_doc"] == "docs/P0-core/contracts/api-v1.md"
    assert source["openapi"] == "3.1.0"
    assert isinstance(source["info_title"], str) and source["info_title"].strip()
    assert isinstance(source["info_version"], str) and source["info_version"].strip()


def test_api_v1_openapi_method_path_signatures_are_frozen() -> None:
    baseline = _load_baseline()["source_of_truth"]
    assert _method_path_signatures() == baseline["method_path_signatures"]


def test_api_v1_openapi_security_schemes_and_hash_are_frozen() -> None:
    baseline = _load_baseline()["source_of_truth"]
    schema = app.openapi()
    freeze_payload = _freeze_payload(schema)
    security_schemes = sorted(list((freeze_payload.get("components", {}).get("securitySchemes", {}) or {}).keys()))
    assert security_schemes == baseline["required_security_schemes"]
    assert _freeze_hash(schema) == baseline["schema_sha256"]
