import sys
from pathlib import Path

sys.path.append(str(Path(__file__).resolve().parents[1]))

from app.infrastructure.runtime.parser.parser_legacy_service import ParserService


def test_plus_syntax_parses_metadata_inside_parentheses() -> None:
    parser = ParserService()
    tasks = parser.parse("Firma (obor: IT) + Produkt (cena: 500)")

    assert [task.action for task in tasks] == ["INGEST", "INGEST", "LINK"]
    assert tasks[0].params["value"] == "Firma"
    assert tasks[0].params["metadata"] == {"obor": "IT"}
    assert tasks[1].params["value"] == "Produkt"
    assert tasks[1].params["metadata"] == {"cena": "500"}
    assert tasks[2].params["type"] == "RELATION"


def test_colon_syntax_parses_metadata_with_colons_and_equals() -> None:
    parser = ParserService()
    tasks = parser.parse("Zaměstnanec : Pavel (pozice: ředitel, plat = 100 000)")

    assert [task.action for task in tasks] == ["INGEST", "INGEST", "LINK"]
    assert tasks[0].params["value"] == "Zaměstnanec"
    assert tasks[1].params["value"] == "Pavel"
    assert tasks[1].params["metadata"] == {"pozice": "ředitel", "plat": "100 000"}
    assert tasks[2].params["type"] == "TYPE"


def test_triple_shot_select_stays_compatible() -> None:
    parser = ParserService()
    tasks = parser.parse("Ukaž : Zákazníci @ z Prahy")

    assert len(tasks) == 1
    assert tasks[0].action == "SELECT"
    assert tasks[0].params["target_civilization"] == "Zákazníci"
    assert tasks[0].params["condition"] == "z Prahy"


def test_triple_shot_show_alias_maps_to_select() -> None:
    parser = ParserService()
    tasks = parser.parse("show : customers @ active")

    assert len(tasks) == 1
    assert tasks[0].action == "SELECT"
    assert tasks[0].params["target_civilization"] == "customers"
    assert tasks[0].params["condition"] == "active"


def test_delete_command_is_mapped_to_delete_task() -> None:
    parser = ParserService()
    tasks = parser.parse("Zhasni : Pavel")

    assert len(tasks) == 1
    assert tasks[0].action == "DELETE"
    assert tasks[0].params["target"] == "Pavel"


def test_set_formula_command_is_mapped_to_set_formula_task() -> None:
    parser = ParserService()
    tasks = parser.parse("Spočítej : Projekt.celkem = SUM(cena)")

    assert len(tasks) == 1
    assert tasks[0].action == "SET_FORMULA"
    assert tasks[0].params == {
        "target": "Projekt",
        "field": "celkem",
        "formula": "=SUM(cena)",
    }


def test_guardian_command_is_mapped_to_add_guardian_task() -> None:
    parser = ParserService()
    tasks = parser.parse("Hlídej : Projekt.celkem > 1000 -> pulse")

    assert len(tasks) == 1
    assert tasks[0].action == "ADD_GUARDIAN"
    assert tasks[0].params == {
        "target": "Projekt",
        "field": "celkem",
        "operator": ">",
        "threshold": 1000,
        "action": "pulse",
    }


def test_plus_chain_creates_sequential_links() -> None:
    parser = ParserService()
    tasks = parser.parse("A + B + C")

    assert [task.action for task in tasks] == ["INGEST", "INGEST", "INGEST", "LINK", "LINK"]
    assert tasks[3].params["type"] == "RELATION"
    assert tasks[4].params["type"] == "RELATION"


def test_colon_chain_creates_sequential_type_links() -> None:
    parser = ParserService()
    tasks = parser.parse("A : B : C")

    assert [task.action for task in tasks] == ["INGEST", "INGEST", "INGEST", "LINK", "LINK"]
    assert tasks[3].params["type"] == "TYPE"
    assert tasks[4].params["type"] == "TYPE"


def test_plus_operator_inside_metadata_is_not_split() -> None:
    parser = ParserService()
    tasks = parser.parse("Firma (poznamka: A+B) + Produkt (kod: P-1)")

    assert [task.action for task in tasks] == ["INGEST", "INGEST", "LINK"]
    assert tasks[0].params["metadata"] == {"poznamka": "A+B"}
    assert tasks[1].params["metadata"] == {"kod": "P-1"}


def test_invalid_binary_chain_returns_empty_tasks() -> None:
    parser = ParserService()

    assert parser.parse("A + ") == []
    assert parser.parse(" : Typ") == []
    assert parser.parse("A : ") == []


def test_non_intent_colon_command_stays_as_type_link() -> None:
    parser = ParserService()
    tasks = parser.parse("Projekt : Kategorie")

    assert [task.action for task in tasks] == ["INGEST", "INGEST", "LINK"]
    assert tasks[2].params["type"] == "TYPE"


def test_guardian_threshold_parses_float_with_comma() -> None:
    parser = ParserService()
    tasks = parser.parse("Hlidej : Projekt.celkem >= 12,5 -> color_red")

    assert len(tasks) == 1
    assert tasks[0].action == "ADD_GUARDIAN"
    assert tasks[0].params["operator"] == ">="
    assert tasks[0].params["threshold"] == 12.5


def test_single_ingest_with_metadata_fallback() -> None:
    parser = ParserService()
    tasks = parser.parse("Firma (obor: IT, mesto=Praha)")

    assert [task.action for task in tasks] == ["INGEST"]
    assert tasks[0].params["value"] == "Firma"
    assert tasks[0].params["metadata"] == {"obor": "IT", "mesto": "Praha"}


def test_spoj_command_translates_to_valid_relation_tasks() -> None:
    parser = ParserService()
    tasks = parser.parse("Spoj : Pavel, Audi")

    assert [task.action for task in tasks] == ["INGEST", "INGEST", "LINK"]
    assert tasks[0].params["value"] == "Pavel"
    assert tasks[1].params["value"] == "Audi"
    assert tasks[2].params["type"] == "RELATION"


def test_spoj_chain_translates_to_sequential_links() -> None:
    parser = ParserService()
    tasks = parser.parse("Spoj : A + B + C")

    assert [task.action for task in tasks] == ["INGEST", "INGEST", "INGEST", "LINK", "LINK"]
    assert tasks[3].params["type"] == "RELATION"
    assert tasks[4].params["type"] == "RELATION"


def test_diagnostics_detect_mixed_top_level_operators() -> None:
    parser = ParserService()
    result = parser.parse_with_diagnostics("A : B + C")

    assert result.tasks == []
    assert result.errors
    assert "Mixed operators" in result.errors[0]


def test_diagnostics_detect_empty_operand_in_chain() -> None:
    parser = ParserService()
    result = parser.parse_with_diagnostics("A + + B")

    assert result.tasks == []
    assert result.errors
    assert "empty operand" in result.errors[0]


def test_diagnostics_detect_missing_colon_for_known_verb() -> None:
    parser = ParserService()
    result = parser.parse_with_diagnostics("Smaz Pavel")

    assert result.tasks == []
    assert result.errors
    assert "Missing ':'" in result.errors[0]


def test_diagnostics_detect_missing_colon_for_spoj() -> None:
    parser = ParserService()
    result = parser.parse_with_diagnostics("Spoj Pavel, Audi")

    assert result.tasks == []
    assert result.errors
    assert "Missing ':'" in result.errors[0]


def test_legacy_parse_keeps_compatibility_and_returns_empty_for_invalid() -> None:
    parser = ParserService()
    tasks = parser.parse("Smaz Pavel")

    assert tasks == []


def test_empty_input_behavior_is_stable_for_diagnostics_and_legacy_parse() -> None:
    parser = ParserService()
    diagnostics = parser.parse_with_diagnostics("   ")
    assert diagnostics.tasks == []
    assert diagnostics.errors == ["Command is empty."]
    assert parser.parse("   ") == []
