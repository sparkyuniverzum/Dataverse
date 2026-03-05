from __future__ import annotations

from pathlib import Path


_ROOT = Path(__file__).resolve().parents[1]


def _read_doc(relative_path: str) -> str:
    path = _ROOT / relative_path
    assert path.exists(), f"Missing contract doc: {relative_path}"
    return path.read_text(encoding="utf-8")


def test_contract_closure_docs_exist_with_required_sections() -> None:
    expected: dict[str, list[str]] = {
        "docs/contracts/semantic-constitution-v1.md": [
            "## III. Železná pravidla systému (zákony)",
            "Zákon zachování informace",
            "hard-delete",
            "| Moon | Měsíc (Capability) |",
            "| Civilization | Civilizace (Instance) |",
        ],
        "docs/contracts/galaxy-workspace-contract-v1.md": [
            "## 3. Invariants",
            "GET /galaxies",
            "POST /branches",
            "GET /galaxies/{galaxy_id}/onboarding",
        ],
        "docs/contracts/moon-contract-v1.md": [
            "## 2. Moon capability classes (MVP)",
            "Dictionary Moon",
            "Validation Moon",
            "Formula Moon",
            "Bridge Moon",
            "GET /moons",
            "PATCH /moons/{moon_id}/mutate",
        ],
        "docs/contracts/civilization-contract-v1.md": [
            "## 3. Lifecycle API surface",
            "POST /asteroids/ingest",
            "PATCH /asteroids/{asteroid_id}/mutate",
            "PATCH /asteroids/{asteroid_id}/extinguish",
        ],
        "docs/contracts/mineral-contract-v1.md": [
            "## 3. Validation and typing contract",
            "required_fields",
            "field_types",
            "validators",
            "unique_rules",
        ],
        "docs/contracts/planet-builder-mvp-v2.md": [
            "## 2. Canonical ontology (frozen for this MVP)",
            "Moon = capability module attached to a planet contract.",
            "Civilization = row instance on a planet.",
            "## 13. Definition of Done (go/no-go)",
        ],
    }

    for relative_path, snippets in expected.items():
        body = _read_doc(relative_path)
        for snippet in snippets:
            assert snippet in body, f"Missing snippet `{snippet}` in {relative_path}"


def test_contract_gap_diff_references_full_mvp_layers() -> None:
    body = _read_doc("docs/contracts/contract-gap-diff-v2.md")
    for layer in (
        "Galaxy workspace v1",
        "Moon capability v1",
        "Civilization v1",
        "Mineral v1",
        "Planet Builder MVP v2",
    ):
        assert layer in body
    for marker in ("DONE", "PARTIAL", "MISSING"):
        assert marker in body


def test_runtime_alias_migration_adr_exists_with_required_sections() -> None:
    body = _read_doc("docs/upgrade/adr-moon-civilization-runtime-alias-migration-v1.md")
    for snippet in (
        "Moon = capability",
        "Civilization = row",
        "Migration phases",
        "/moons*",
        "/civilizations*",
    ):
        assert snippet in body
