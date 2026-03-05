from __future__ import annotations

from app.services.parser2.models import LexResult, ParseError, Token, TokenType


class Parser2Lexer:
    _CONTROL_CHAR_MIN = 0x20

    def tokenize(self, text: str) -> LexResult:
        tokens: list[Token] = []
        errors: list[ParseError] = []
        index = 0
        length = len(text)

        while index < length:
            ch = text[index]

            if ch.isspace():
                index += 1
                continue

            if ord(ch) < self._CONTROL_CHAR_MIN:
                errors.append(
                    ParseError(
                        code="LEX_INVALID_CONTROL_CHAR",
                        message=f"Invalid control character at position {index}",
                        start=index,
                        end=index + 1,
                    )
                )
                index += 1
                continue

            two_char = text[index : index + 2]
            if two_char == "->":
                tokens.append(Token(type=TokenType.ARROW, value=two_char, start=index, end=index + 2))
                index += 2
                continue
            if two_char == ":=":
                tokens.append(Token(type=TokenType.ASSIGN, value=two_char, start=index, end=index + 2))
                index += 2
                continue

            if ch in {'"', "'"}:
                token, next_index, error = self._consume_string(text, index)
                if token is not None:
                    tokens.append(token)
                if error is not None:
                    errors.append(error)
                index = next_index
                continue

            single_char_map = {
                ":": TokenType.COLON,
                "+": TokenType.PLUS,
                "-": TokenType.MINUS,
                ".": TokenType.DOT,
                ",": TokenType.COMMA,
                "(": TokenType.LPAREN,
                ")": TokenType.RPAREN,
                "=": TokenType.ASSIGN,
            }
            single_type = single_char_map.get(ch)
            if single_type is not None:
                tokens.append(Token(type=single_type, value=ch, start=index, end=index + 1))
                index += 1
                continue

            token, next_index = self._consume_atom(text, index)
            tokens.append(token)
            index = next_index

        tokens.append(Token(type=TokenType.EOF, value="", start=length, end=length))
        return LexResult(tokens=tokens, errors=errors)

    def _consume_string(self, text: str, start_index: int) -> tuple[Token | None, int, ParseError | None]:
        quote = text[start_index]
        index = start_index + 1
        length = len(text)
        value_chars: list[str] = []

        while index < length:
            ch = text[index]
            if ch == "\\" and index + 1 < length:
                value_chars.append(text[index + 1])
                index += 2
                continue
            if ch == quote:
                token = Token(
                    type=TokenType.STRING,
                    value="".join(value_chars),
                    start=start_index,
                    end=index + 1,
                )
                return token, index + 1, None
            value_chars.append(ch)
            index += 1

        error = ParseError(
            code="LEX_UNTERMINATED_STRING",
            message="Unterminated string literal",
            start=start_index,
            end=length,
        )
        return None, length, error

    def _consume_atom(self, text: str, start_index: int) -> tuple[Token, int]:
        index = start_index
        length = len(text)
        stop_chars = set(":+.,()=\"'")

        while index < length:
            ch = text[index]
            if ord(ch) < self._CONTROL_CHAR_MIN:
                break
            if ch.isspace() or ch in stop_chars:
                break
            if text[index : index + 2] in {"->", ":="}:
                break
            index += 1

        token = Token(type=TokenType.ATOM, value=text[start_index:index], start=start_index, end=index)
        return token, index
