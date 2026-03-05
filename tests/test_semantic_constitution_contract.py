from __future__ import annotations

import json
import sys
from pathlib import Path

from fastapi.routing import APIRoute

sys.path.append(str(Path(__file__).resolve().parents[1]))

from app.main import app
from app.services.cosmos_service import CosmosService
from app.services.parser_service import ParserService


def _root() -> Path:
    return Path(__file__).resolve().parents[1]


def _load_baseline() -> dict:
    baseline_path = _root() / "docs" / "semantic-constitution-baseline-v1.json"
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


def test_semantic_constitution_doc_contains_required_markers() -> None:
    baseline = _load_baseline()
    source = baseline["source_of_truth"]
    contract_doc = _root() / baseline["contract_doc"]
    body = contract_doc.read_text(encoding="utf-8")
    for marker in source["required_doc_markers"]:
        assert marker in body


def test_semantic_constitution_parser_operator_examples_match() -> None:
    source = _load_baseline()["source_of_truth"]
    parser = ParserService()

    for case in source["parser_operator_examples"]:
        tasks = parser.parse(case["query"])
        assert [task.action for task in tasks] == case["expected_actions"]
        expected_link_type = case.get("expected_link_type")
        if expected_link_type:
            link_task = next(task for task in tasks if task.action == "LINK")
            assert str(link_task.params.get("type")).upper() == str(expected_link_type).upper()


def test_semantic_constitution_has_soft_delete_routes_and_no_hard_delete_http_verbs() -> None:
    source = _load_baseline()["source_of_truth"]
    signatures = _registered_http_signatures()

    for route_signature in source["soft_delete_extinguish_routes"]:
        assert route_signature in signatures

    no_delete_prefixes = tuple(source["no_delete_route_prefixes"])
    forbidden_delete_routes = [
        signature
        for signature in signatures
        if signature.startswith("DELETE ") and signature.split(" ", 1)[1].startswith(no_delete_prefixes)
    ]
    assert forbidden_delete_routes == []


def test_semantic_constitution_branch_name_normalization_is_trim_plus_casefold() -> None:
    source = _load_baseline()["source_of_truth"]
    for case in source["branch_name_normalization_examples"]:
        normalized = CosmosService._normalize_branch_name(case["raw"])  # noqa: SLF001
        assert normalized == case["normalized"]
