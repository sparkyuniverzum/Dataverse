import sys
from pathlib import Path

sys.path.append(str(Path(__file__).resolve().parents[1]))

from app.services.parser2 import Parser2Service


def _canonical(command: str) -> str:
    parser = Parser2Service()
    result = parser.parse(command)
    assert result.errors == [], [error.code for error in result.errors]
    return parser.to_canonical(result.ast)


def _first_error_code(command: str) -> str:
    parser = Parser2Service()
    result = parser.parse(command)
    assert result.errors
    return result.errors[0].code


def test_type_link_expression() -> None:
    assert _canonical("Erik : Zaměstnanec") == 'TYPE(ENTITY("Erik"), ENTITY("Zaměstnanec"))'


def test_relation_link_expression() -> None:
    assert _canonical("Erik + Projekt Alfa") == 'REL(ENTITY("Erik"), ENTITY("Projekt Alfa"))'


def test_relation_link_expression_with_hyphenated_names_without_quotes() -> None:
    assert _canonical("Node-ABC + Team-1") == 'REL(ENTITY("Node-ABC"), ENTITY("Team-1"))'


def test_relation_link_expression_with_unquoted_uuid_operand() -> None:
    assert _canonical("63b9d570-5ef6-47eb-8bf4-70bcdb6db95b + Projekt") == (
        'REL(ENTITY("63b9d570-5ef6-47eb-8bf4-70bcdb6db95b"), ENTITY("Projekt"))'
    )


def test_operator_precedence_colon_over_plus() -> None:
    assert _canonical("Erik + Projekt Alfa : Zaměstnanec") == (
        'REL(ENTITY("Erik"), TYPE(ENTITY("Projekt Alfa"), ENTITY("Zaměstnanec")))'
    )


def test_unary_extinguish_expression() -> None:
    assert _canonical("- Erik") == 'EXT(ENTITY("Erik"))'


def test_assignment_expression() -> None:
    assert _canonical("Erik.salary := 50000") == 'ASSIGN(REF("Erik"."salary"), LIT("50000"))'


def test_assignment_accepts_equal_alias() -> None:
    assert _canonical('Erik.salary = "50k"') == 'ASSIGN(REF("Erik"."salary"), LIT("50k"))'


def test_flow_expression() -> None:
    assert _canonical("Erik -> alert_red") == 'FLOW(ENTITY("Erik"), ENTITY("alert_red"))'


def test_group_expression_for_bulk() -> None:
    assert _canonical("(Erik, Jana, Petr) : Zaměstnanec") == (
        'TYPE(GROUP([ENTITY("Erik"), ENTITY("Jana"), ENTITY("Petr")]), ENTITY("Zaměstnanec"))'
    )


def test_nested_grouping_expression() -> None:
    assert _canonical("((A))") == 'ENTITY("A")'


def test_parse_reports_empty_input() -> None:
    assert _first_error_code("   ") == "PARSE_EMPTY_INPUT"


def test_parse_reports_invalid_reference() -> None:
    assert _first_error_code("Erik.") == "PARSE_INVALID_REFERENCE"


def test_parse_reports_invalid_assign_target() -> None:
    assert _first_error_code("Erik := 10") == "PARSE_INVALID_ASSIGN_TARGET"


def test_parse_reports_expected_operand_after_plus() -> None:
    assert _first_error_code("Erik +") == "PARSE_EXPECTED_OPERAND"
