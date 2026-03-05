from __future__ import annotations

from dataclasses import dataclass
from enum import Enum
from typing import Any


class TokenType(str, Enum):
    ATOM = "ATOM"
    STRING = "STRING"
    COLON = "COLON"
    PLUS = "PLUS"
    ARROW = "ARROW"
    ASSIGN = "ASSIGN"
    MINUS = "MINUS"
    DOT = "DOT"
    COMMA = "COMMA"
    LPAREN = "LPAREN"
    RPAREN = "RPAREN"
    EOF = "EOF"


@dataclass(frozen=True)
class Token:
    type: TokenType
    value: str
    start: int
    end: int


@dataclass(frozen=True)
class ParseError:
    code: str
    message: str
    start: int
    end: int


@dataclass(frozen=True)
class LexResult:
    tokens: list[Token]
    errors: list[ParseError]


@dataclass(frozen=True)
class ParseResult:
    ast: AstNode | None
    tokens: list[Token]
    errors: list[ParseError]


class AstNode:
    kind: str


@dataclass(frozen=True)
class EntityNode(AstNode):
    name: str
    kind: str = "ENTITY"


@dataclass(frozen=True)
class ReferenceNode(AstNode):
    entity: str
    field: str
    kind: str = "REFERENCE"


@dataclass(frozen=True)
class LiteralNode(AstNode):
    value: Any
    kind: str = "LITERAL"


@dataclass(frozen=True)
class GroupNode(AstNode):
    items: list[AstNode]
    kind: str = "GROUP"


@dataclass(frozen=True)
class TypeLinkNode(AstNode):
    left: AstNode
    right: AstNode
    kind: str = "TYPE_LINK"


@dataclass(frozen=True)
class RelationLinkNode(AstNode):
    left: AstNode
    right: AstNode
    kind: str = "RELATION_LINK"


@dataclass(frozen=True)
class FlowNode(AstNode):
    source: AstNode
    target: AstNode
    kind: str = "FLOW"


@dataclass(frozen=True)
class AssignNode(AstNode):
    target: ReferenceNode
    value: AstNode
    kind: str = "ASSIGN"


@dataclass(frozen=True)
class ExtinguishNode(AstNode):
    target: AstNode
    kind: str = "EXTINGUISH"
