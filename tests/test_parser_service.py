from pathlib import Path
import sys

sys.path.append(str(Path(__file__).resolve().parents[1]))

from app.services.parser_service import ParserService


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
    assert tasks[0].params["target_asteroid"] == "Zákazníci"
    assert tasks[0].params["condition"] == "z Prahy"


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
