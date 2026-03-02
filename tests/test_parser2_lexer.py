from pathlib import Path
import sys

sys.path.append(str(Path(__file__).resolve().parents[1]))

from app.services.parser2 import Parser2Lexer, TokenType


def test_lexer_tokenizes_basic_operator_stream() -> None:
    lexer = Parser2Lexer()
    result = lexer.tokenize("Erik + Projekt Alfa : Zaměstnanec")

    assert result.errors == []
    assert [token.type for token in result.tokens] == [
        TokenType.ATOM,
        TokenType.PLUS,
        TokenType.ATOM,
        TokenType.ATOM,
        TokenType.COLON,
        TokenType.ATOM,
        TokenType.EOF,
    ]
    assert [token.value for token in result.tokens[:-1]] == [
        "Erik",
        "+",
        "Projekt",
        "Alfa",
        ":",
        "Zaměstnanec",
    ]


def test_lexer_recognizes_assign_and_arrow_and_group_tokens() -> None:
    lexer = Parser2Lexer()
    result = lexer.tokenize("(Erik, Jana) -> alert_red; Erik.salary := 50000".replace(";", ""))

    assert result.errors == []
    types = [token.type for token in result.tokens]
    assert TokenType.LPAREN in types
    assert TokenType.COMMA in types
    assert TokenType.RPAREN in types
    assert TokenType.ARROW in types
    assert TokenType.DOT in types
    assert TokenType.ASSIGN in types


def test_lexer_handles_quoted_strings() -> None:
    lexer = Parser2Lexer()
    result = lexer.tokenize('"Projekt Alfa" + \'Projekt Beta\'')

    assert result.errors == []
    assert [token.type for token in result.tokens] == [
        TokenType.STRING,
        TokenType.PLUS,
        TokenType.STRING,
        TokenType.EOF,
    ]
    assert result.tokens[0].value == "Projekt Alfa"
    assert result.tokens[2].value == "Projekt Beta"


def test_lexer_reports_unterminated_string() -> None:
    lexer = Parser2Lexer()
    result = lexer.tokenize("'unterminated")

    assert len(result.errors) == 1
    assert result.errors[0].code == "LEX_UNTERMINATED_STRING"


def test_lexer_reports_invalid_control_char() -> None:
    lexer = Parser2Lexer()
    result = lexer.tokenize("A\x01B")

    assert len(result.errors) == 1
    assert result.errors[0].code == "LEX_INVALID_CONTROL_CHAR"


def test_lexer_keeps_hyphen_inside_atom_labels() -> None:
    lexer = Parser2Lexer()
    result = lexer.tokenize("ParserContract-123 + Node-ABC")

    assert result.errors == []
    assert [token.type for token in result.tokens] == [
        TokenType.ATOM,
        TokenType.PLUS,
        TokenType.ATOM,
        TokenType.EOF,
    ]
    assert result.tokens[0].value == "ParserContract-123"
    assert result.tokens[2].value == "Node-ABC"


def test_lexer_tokenizes_unquoted_uuid_as_single_atom() -> None:
    lexer = Parser2Lexer()
    result = lexer.tokenize("63b9d570-5ef6-47eb-8bf4-70bcdb6db95b + Projekt")

    assert result.errors == []
    assert [token.type for token in result.tokens] == [
        TokenType.ATOM,
        TokenType.PLUS,
        TokenType.ATOM,
        TokenType.EOF,
    ]
    assert result.tokens[0].value == "63b9d570-5ef6-47eb-8bf4-70bcdb6db95b"
    assert result.tokens[2].value == "Projekt"


def test_lexer_keeps_minus_as_operator_when_separated_by_spaces() -> None:
    lexer = Parser2Lexer()
    result = lexer.tokenize("A - B")

    assert result.errors == []
    assert [token.type for token in result.tokens] == [
        TokenType.ATOM,
        TokenType.MINUS,
        TokenType.ATOM,
        TokenType.EOF,
    ]
    assert [token.value for token in result.tokens[:-1]] == ["A", "-", "B"]


def test_lexer_preserves_unary_minus_operator() -> None:
    lexer = Parser2Lexer()
    result = lexer.tokenize("- Erik")

    assert result.errors == []
    assert [token.type for token in result.tokens] == [
        TokenType.MINUS,
        TokenType.ATOM,
        TokenType.EOF,
    ]
