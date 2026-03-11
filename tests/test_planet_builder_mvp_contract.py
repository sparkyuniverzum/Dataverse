from __future__ import annotations

from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
DOC = ROOT / "docs/P0-core/contracts/planet-builder-mvp-v2.md"


def _read_doc() -> str:
    assert DOC.exists(), "Missing contract doc: docs/P0-core/contracts/planet-builder-mvp-v2.md"
    return DOC.read_text(encoding="utf-8")


def test_planet_builder_contract_contains_frozen_ontology() -> None:
    body = _read_doc()
    required = [
        "## 2. Canonical ontology (frozen for this MVP)",
        "Galaxy = Workspace tenant boundary.",
        "Star = constitution and physical laws for one galaxy.",
        "Planet = table aggregate and data carrier.",
        "Moon = capability module attached to a planet contract.",
        "Civilization = row instance on a planet.",
        "Mineral = typed field value (`key + typed_value`) inside civilization.",
    ]
    for snippet in required:
        assert snippet in body


def test_planet_builder_contract_forbids_moon_civilization_aliasing() -> None:
    body = _read_doc()
    assert "are not synonyms." in body
    assert "Moon is capability." in body
    assert "Civilization is row data." in body


def test_planet_builder_contract_defines_required_gate_and_dod() -> None:
    body = _read_doc()
    required = [
        "## 12. Required gates for this contract",
        "star lock -> first planet -> moon capability commit -> civilization create/mutate/extinguish -> convergence",
        "## 13. Definition of Done (go/no-go)",
        "Convergence gate is green after create, mutate, and extinguish.",
    ]
    for snippet in required:
        assert snippet in body
