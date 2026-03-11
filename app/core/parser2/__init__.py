from __future__ import annotations

from pathlib import Path

_PARSER2_IMPL_PATH = Path(__file__).resolve().parents[2] / "services" / "parser2"
if _PARSER2_IMPL_PATH.exists():
    parser2_impl_path = str(_PARSER2_IMPL_PATH)
    if parser2_impl_path not in __path__:
        __path__.append(parser2_impl_path)

from .bridge import (  # noqa: E402
    BridgeIssue,
    BridgeResult,
    Parser2ExecutorBridge,
)
from .intents import (  # noqa: E402
    PARSER2_INTENT_VERSION,
    AddGuardianIntent,
    AssignAttributeIntent,
    BulkIntent,
    CreateLinkIntent,
    ExtinguishNodeIntent,
    FlowIntent,
    Intent,
    IntentEnvelope,
    LinkType,
    NodeSelector,
    NodeSelectorType,
    SelectNodesIntent,
    SetFormulaIntent,
    UpsertNodeIntent,
)
from .lexer import Parser2Lexer  # noqa: E402
from .models import (  # noqa: E402
    AssignNode,
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
from .parser import Parser2Service  # noqa: E402
from .planner import (  # noqa: E402
    Parser2SemanticPlanner,
    PlanIssue,
    SemanticPlanResult,
    SemanticResolver,
)
from .resolver import SnapshotSemanticResolver  # noqa: E402
from .runtime_flags import parser_v2_fallback_to_v1_enabled  # noqa: E402

__all__ = [
    "AssignNode",
    "AddGuardianIntent",
    "AssignAttributeIntent",
    "BulkIntent",
    "CreateLinkIntent",
    "EntityNode",
    "ExtinguishNodeIntent",
    "ExtinguishNode",
    "FlowIntent",
    "FlowNode",
    "GroupNode",
    "Intent",
    "IntentEnvelope",
    "LexResult",
    "LinkType",
    "LiteralNode",
    "NodeSelector",
    "NodeSelectorType",
    "PARSER2_INTENT_VERSION",
    "ParseError",
    "ParseResult",
    "Parser2Lexer",
    "Parser2ExecutorBridge",
    "Parser2Service",
    "Parser2SemanticPlanner",
    "PlanIssue",
    "ReferenceNode",
    "RelationLinkNode",
    "BridgeIssue",
    "BridgeResult",
    "SemanticPlanResult",
    "SemanticResolver",
    "SelectNodesIntent",
    "SetFormulaIntent",
    "SnapshotSemanticResolver",
    "parser_v2_fallback_to_v1_enabled",
    "Token",
    "TokenType",
    "TypeLinkNode",
    "UpsertNodeIntent",
]
