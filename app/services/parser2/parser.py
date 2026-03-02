from __future__ import annotations

from app.services.parser2.lexer import Parser2Lexer
from app.services.parser2.models import (
    AssignNode,
    AstNode,
    EntityNode,
    ExtinguishNode,
    FlowNode,
    GroupNode,
    LexResult,
    LiteralNode,
    ParseError,
    ParseResult,
    ReferenceNode,
    RelationLinkNode,
    Token,
    TokenType,
    TypeLinkNode,
)


class _Parser2SyntaxError(Exception):
    def __init__(self, *, code: str, message: str, token: Token) -> None:
        super().__init__(message)
        self.code = code
        self.message = message
        self.token = token


class Parser2Service:
    def __init__(self) -> None:
        self.lexer = Parser2Lexer()
        self.tokens: list[Token] = []
        self.current = 0

    def tokenize(self, text: str) -> LexResult:
        return self.lexer.tokenize(text)

    def parse(self, text: str) -> ParseResult:
        lexed = self.lexer.tokenize(text)
        if lexed.errors:
            return ParseResult(ast=None, tokens=lexed.tokens, errors=lexed.errors)

        stripped = text.strip()
        if not stripped:
            return ParseResult(
                ast=None,
                tokens=lexed.tokens,
                errors=[
                    ParseError(
                        code="PARSE_EMPTY_INPUT",
                        message="Command is empty.",
                        start=0,
                        end=0,
                    )
                ],
            )

        self.tokens = lexed.tokens
        self.current = 0

        try:
            ast = self._parse_statement()
            self._expect(TokenType.EOF, code="PARSE_TRAILING_TOKENS", message="Unexpected trailing tokens")
            return ParseResult(ast=ast, tokens=lexed.tokens, errors=[])
        except _Parser2SyntaxError as exc:
            return ParseResult(
                ast=None,
                tokens=lexed.tokens,
                errors=[
                    ParseError(
                        code=exc.code,
                        message=exc.message,
                        start=exc.token.start,
                        end=exc.token.end,
                    )
                ],
            )

    def to_canonical(self, node: AstNode | None) -> str:
        if node is None:
            return "<NONE>"
        if isinstance(node, EntityNode):
            return f'ENTITY("{node.name}")'
        if isinstance(node, ReferenceNode):
            return f'REF("{node.entity}"."{node.field}")'
        if isinstance(node, LiteralNode):
            return f'LIT("{node.value}")'
        if isinstance(node, GroupNode):
            children = ", ".join(self.to_canonical(item) for item in node.items)
            return f"GROUP([{children}])"
        if isinstance(node, TypeLinkNode):
            return f"TYPE({self.to_canonical(node.left)}, {self.to_canonical(node.right)})"
        if isinstance(node, RelationLinkNode):
            return f"REL({self.to_canonical(node.left)}, {self.to_canonical(node.right)})"
        if isinstance(node, FlowNode):
            return f"FLOW({self.to_canonical(node.source)}, {self.to_canonical(node.target)})"
        if isinstance(node, AssignNode):
            return f"ASSIGN({self.to_canonical(node.target)}, {self.to_canonical(node.value)})"
        if isinstance(node, ExtinguishNode):
            return f"EXT({self.to_canonical(node.target)})"
        return f"<{node.__class__.__name__}>"

    def _parse_statement(self) -> AstNode:
        expression = self._parse_relation_expression()

        if self._match(TokenType.ASSIGN):
            if not isinstance(expression, ReferenceNode):
                raise _Parser2SyntaxError(
                    code="PARSE_INVALID_ASSIGN_TARGET",
                    message="Assignment target must be in entity.field format",
                    token=self._previous(),
                )
            value = self._parse_assignment_value()
            return AssignNode(target=expression, value=value)

        if self._match(TokenType.ARROW):
            target = self._parse_relation_expression()
            return FlowNode(source=expression, target=target)

        return expression

    def _parse_assignment_value(self) -> AstNode:
        if self._peek().type == TokenType.STRING:
            token = self._advance()
            return LiteralNode(value=token.value)

        if self._peek().type == TokenType.ATOM and self._peek_next().type in {
            TokenType.EOF,
            TokenType.COMMA,
            TokenType.RPAREN,
        }:
            token = self._advance()
            return LiteralNode(value=token.value)

        return self._parse_relation_expression()

    def _parse_relation_expression(self) -> AstNode:
        node = self._parse_type_expression()
        while self._match(TokenType.PLUS):
            right = self._parse_type_expression()
            node = RelationLinkNode(left=node, right=right)
        return node

    def _parse_type_expression(self) -> AstNode:
        node = self._parse_unary_expression()
        while self._match(TokenType.COLON):
            right = self._parse_unary_expression()
            node = TypeLinkNode(left=node, right=right)
        return node

    def _parse_unary_expression(self) -> AstNode:
        if self._match(TokenType.MINUS):
            return ExtinguishNode(target=self._parse_unary_expression())
        return self._parse_primary_expression()

    def _parse_primary_expression(self) -> AstNode:
        if self._match(TokenType.LPAREN):
            return self._parse_group_or_parenthesized()

        if self._peek().type in {TokenType.ATOM, TokenType.STRING}:
            return self._parse_entity_or_reference()

        token = self._peek()
        raise _Parser2SyntaxError(
            code="PARSE_EXPECTED_OPERAND",
            message="Expected expression operand",
            token=token,
        )

    def _parse_group_or_parenthesized(self) -> AstNode:
        if self._peek().type == TokenType.RPAREN:
            raise _Parser2SyntaxError(
                code="PARSE_EXPECTED_OPERAND",
                message="Expected operand inside parentheses",
                token=self._peek(),
            )

        first = self._parse_relation_expression()
        items = [first]

        if self._match(TokenType.COMMA):
            while True:
                items.append(self._parse_relation_expression())
                if not self._match(TokenType.COMMA):
                    break
            self._expect(TokenType.RPAREN, code="PARSE_EXPECTED_RPAREN", message="Missing closing ')' ")
            return GroupNode(items=items)

        self._expect(TokenType.RPAREN, code="PARSE_EXPECTED_RPAREN", message="Missing closing ')' ")
        return first

    def _parse_entity_or_reference(self) -> AstNode:
        name_tokens: list[Token] = []

        while self._peek().type in {TokenType.ATOM, TokenType.STRING}:
            name_tokens.append(self._advance())

        if not name_tokens:
            raise _Parser2SyntaxError(
                code="PARSE_EXPECTED_IDENTIFIER",
                message="Expected identifier",
                token=self._peek(),
            )

        entity_name = " ".join(token.value for token in name_tokens).strip()
        if not entity_name:
            raise _Parser2SyntaxError(
                code="PARSE_EXPECTED_IDENTIFIER",
                message="Expected identifier",
                token=name_tokens[0],
            )

        if self._match(TokenType.DOT):
            field_token = self._peek()
            if field_token.type not in {TokenType.ATOM, TokenType.STRING}:
                raise _Parser2SyntaxError(
                    code="PARSE_INVALID_REFERENCE",
                    message="Expected field name after '.'",
                    token=field_token,
                )
            field = self._advance().value
            return ReferenceNode(entity=entity_name, field=field)

        return EntityNode(name=entity_name)

    def _match(self, token_type: TokenType) -> bool:
        if self._peek().type != token_type:
            return False
        self.current += 1
        return True

    def _expect(self, token_type: TokenType, *, code: str, message: str) -> Token:
        token = self._peek()
        if token.type != token_type:
            raise _Parser2SyntaxError(code=code, message=message, token=token)
        self.current += 1
        return self._previous()

    def _advance(self) -> Token:
        token = self._peek()
        self.current += 1
        return token

    def _peek(self) -> Token:
        return self.tokens[self.current]

    def _peek_next(self) -> Token:
        next_index = self.current + 1
        if next_index >= len(self.tokens):
            return self.tokens[-1]
        return self.tokens[next_index]

    def _previous(self) -> Token:
        return self.tokens[self.current - 1]
