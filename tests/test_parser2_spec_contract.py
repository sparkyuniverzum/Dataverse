from __future__ import annotations

from pathlib import Path
import re
import sys

sys.path.append(str(Path(__file__).resolve().parents[1]))

from app.services.parser2 import (
    CreateLinkIntent,
    LinkType,
    NodeSelectorType,
    Parser2SemanticPlanner,
    Parser2Service,
    UpsertNodeIntent,
)

_SPEC_PATH = Path(__file__).resolve().parents[1] / "docs/contracts/parser-v2-spec.md"
_CASE_RE = re.compile(
    r"^\s*(?P<idx>\d+)\.\s+`(?P<input>[^`]*)`(?:\s+\([^)]*\))?\s+->\s+`(?P<expected>[^`]*)`\s*$"
)
_CANONICAL_PREFIXES = ("ENTITY(", "TYPE(", "REL(", "EXT(", "ASSIGN(", "FLOW(", "GROUP(")
_ERROR_PREFIXES = ("PARSE_", "LEX_")


def _load_spec_cases() -> list[tuple[int, str, str]]:
    content = _SPEC_PATH.read_text(encoding="utf-8")
    in_contract_section = False
    items: list[tuple[int, str, str]] = []
    for raw_line in content.splitlines():
        line = raw_line.rstrip()
        if line.startswith("## 7. Canonical AST forms (contract cases)"):
            in_contract_section = True
            continue
        if in_contract_section and line.startswith("## 8."):
            break
        if not in_contract_section:
            continue
        match = _CASE_RE.match(line)
        if not match:
            continue
        items.append((int(match.group("idx")), match.group("input"), match.group("expected")))
    return items


def _canonical(command: str) -> str:
    parser = Parser2Service()
    result = parser.parse(_decode_contract_command(command))
    assert result.errors == [], [error.code for error in result.errors]
    return parser.to_canonical(result.ast)


def _first_error_code(command: str) -> str:
    parser = Parser2Service()
    result = parser.parse(_decode_contract_command(command))
    assert result.errors
    return result.errors[0].code


def _decode_contract_command(command: str) -> str:
    if re.search(r"\\x[0-9A-Fa-f]{2}", command):
        return bytes(command, encoding="utf-8").decode("unicode_escape")
    return command


def _expected_error_codes(expected: str) -> set[str] | None:
    candidate = expected.strip()
    if not candidate:
        return None
    if " or " in candidate:
        parts = [part.strip() for part in candidate.split(" or ")]
        if parts and all(part.startswith(_ERROR_PREFIXES) for part in parts):
            return set(parts)
        return None
    if candidate.startswith(_ERROR_PREFIXES):
        return {candidate}
    return None


def _spec_case_map() -> dict[str, tuple[int, str]]:
    return {command: (idx, expected) for idx, command, expected in _load_spec_cases()}


def test_parser2_spec_contract_cases_are_present() -> None:
    cases = _load_spec_cases()
    assert len(cases) >= 30
    case_map = _spec_case_map()
    assert "Erik + Projekt Alfa : Zaměstnanec" in case_map
    assert "63b9d570-5ef6-47eb-8bf4-70bcdb6db95b + Projekt" in case_map
    assert "Node-ABC + Team-1" in case_map
    assert "Firma (obor: IT) + Produkt (cena: 500)" in case_map


def test_parser2_spec_ast_and_error_cases_match_implementation() -> None:
    for _idx, command, expected in _load_spec_cases():
        if expected.startswith(_CANONICAL_PREFIXES):
            assert _canonical(command) == expected
            continue
        error_codes = _expected_error_codes(expected)
        if error_codes is not None:
            assert _first_error_code(command) in error_codes


def test_parser2_spec_semantic_case_uuid_resolves_to_mixed_selectors() -> None:
    spec_idx, expected = _spec_case_map()["63b9d570-5ef6-47eb-8bf4-70bcdb6db95b + Projekt"]
    assert spec_idx > 0
    assert "mixed selectors" in expected.lower()

    planner = Parser2SemanticPlanner()
    result = planner.plan_text("63b9d570-5ef6-47eb-8bf4-70bcdb6db95b + Projekt")
    assert result.errors == []
    assert result.envelope is not None
    links = [item for item in result.envelope.intents if isinstance(item, CreateLinkIntent)]
    assert len(links) == 1
    assert links[0].source.selector_type == NodeSelectorType.ID
    assert links[0].target.selector_type == NodeSelectorType.NAME


def test_parser2_spec_semantic_case_legacy_metadata_compiles_to_upsert_and_link() -> None:
    spec_idx, expected = _spec_case_map()["Firma (obor: IT) + Produkt (cena: 500)"]
    assert spec_idx > 0
    assert "metadata" in expected.lower()

    planner = Parser2SemanticPlanner()
    result = planner.plan_text("Firma (obor: IT) + Produkt (cena: 500)")
    assert result.errors == []
    assert result.envelope is not None

    upserts = [item for item in result.envelope.intents if isinstance(item, UpsertNodeIntent)]
    links = [item for item in result.envelope.intents if isinstance(item, CreateLinkIntent)]
    assert len(upserts) == 2
    assert upserts[0].metadata == {"obor": "IT"}
    assert upserts[1].metadata == {"cena": "500"}
    assert len(links) == 1
    assert links[0].link_type == LinkType.RELATION
