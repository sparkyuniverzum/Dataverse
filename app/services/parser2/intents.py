from __future__ import annotations

from enum import Enum
from typing import Annotated, Any, Literal
from uuid import UUID, uuid4

from pydantic import BaseModel, Field


PARSER2_INTENT_VERSION = "2.0"


class LinkType(str, Enum):
    RELATION = "RELATION"
    TYPE = "TYPE"
    FLOW = "FLOW"


class NodeSelectorType(str, Enum):
    NAME = "NAME"
    ID = "ID"


class NodeSelector(BaseModel):
    selector_type: NodeSelectorType = NodeSelectorType.NAME
    value: str


class SourceSpan(BaseModel):
    start: int = Field(ge=0)
    end: int = Field(ge=0)


class IntentBase(BaseModel):
    intent_id: UUID = Field(default_factory=uuid4)
    intent_version: Literal[PARSER2_INTENT_VERSION] = PARSER2_INTENT_VERSION
    source_span: SourceSpan | None = None


class UpsertNodeIntent(IntentBase):
    kind: Literal["UPSERT_NODE"] = "UPSERT_NODE"
    node: NodeSelector
    metadata: dict[str, Any] = Field(default_factory=dict)


class CreateLinkIntent(IntentBase):
    kind: Literal["CREATE_LINK"] = "CREATE_LINK"
    source: NodeSelector
    target: NodeSelector
    link_type: LinkType
    metadata: dict[str, Any] = Field(default_factory=dict)


class AssignAttributeIntent(IntentBase):
    kind: Literal["ASSIGN_ATTRIBUTE"] = "ASSIGN_ATTRIBUTE"
    target: NodeSelector
    field: str = Field(min_length=1)
    value: Any


class FlowIntent(IntentBase):
    kind: Literal["FLOW"] = "FLOW"
    source: NodeSelector
    target: NodeSelector


class ExtinguishNodeIntent(IntentBase):
    kind: Literal["EXTINGUISH_NODE"] = "EXTINGUISH_NODE"
    target: NodeSelector


class SelectNodesIntent(IntentBase):
    kind: Literal["SELECT_NODES"] = "SELECT_NODES"
    target: str = Field(min_length=1)
    condition: str | None = None


class SetFormulaIntent(IntentBase):
    kind: Literal["SET_FORMULA"] = "SET_FORMULA"
    target: str = Field(min_length=1)
    field: str = Field(min_length=1)
    formula: str = Field(min_length=1)


class AddGuardianIntent(IntentBase):
    kind: Literal["ADD_GUARDIAN"] = "ADD_GUARDIAN"
    target: str = Field(min_length=1)
    field: str = Field(min_length=1)
    operator: str = Field(min_length=1)
    threshold: Any
    action: str = Field(min_length=1)


class BulkIntent(IntentBase):
    kind: Literal["BULK"] = "BULK"
    intents: list[
        Annotated[
            UpsertNodeIntent
            | CreateLinkIntent
            | AssignAttributeIntent
            | FlowIntent
            | ExtinguishNodeIntent
            | SelectNodesIntent
            | SetFormulaIntent
            | AddGuardianIntent,
            Field(discriminator="kind"),
        ]
    ] = Field(default_factory=list)


Intent = Annotated[
    UpsertNodeIntent
    | CreateLinkIntent
    | AssignAttributeIntent
    | FlowIntent
    | ExtinguishNodeIntent
    | SelectNodesIntent
    | SetFormulaIntent
    | AddGuardianIntent
    | BulkIntent,
    Field(discriminator="kind"),
]


class IntentEnvelope(BaseModel):
    schema_version: Literal[PARSER2_INTENT_VERSION] = PARSER2_INTENT_VERSION
    intents: list[Intent] = Field(default_factory=list)
