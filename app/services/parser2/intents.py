from __future__ import annotations

from enum import StrEnum
from typing import Annotated, Any, Literal
from uuid import UUID, uuid4

from pydantic import BaseModel, Field, model_validator

PARSER2_INTENT_VERSION = "2.0"


class LinkType(StrEnum):
    RELATION = "RELATION"
    TYPE = "TYPE"
    FLOW = "FLOW"


class NodeSelectorType(StrEnum):
    NAME = "NAME"
    ID = "ID"


class NodeSelector(BaseModel):
    selector_type: NodeSelectorType = NodeSelectorType.NAME
    value: str

    def __eq__(self, other: object) -> bool:
        # Backward compatibility for tests/callers that still compare selector to plain target string.
        if isinstance(other, str):
            return self.value == other
        return super().__eq__(other)


def _coerce_selector(value: Any) -> Any:
    if isinstance(value, str):
        return {"value": value}
    return value


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

    @model_validator(mode="before")
    @classmethod
    def _coerce_node(cls, data: Any) -> Any:
        if isinstance(data, dict) and "node" in data:
            data = dict(data)
            data["node"] = _coerce_selector(data.get("node"))
        return data


class CreateLinkIntent(IntentBase):
    kind: Literal["CREATE_LINK"] = "CREATE_LINK"
    source: NodeSelector
    target: NodeSelector
    link_type: LinkType
    metadata: dict[str, Any] = Field(default_factory=dict)

    @model_validator(mode="before")
    @classmethod
    def _coerce_nodes(cls, data: Any) -> Any:
        if isinstance(data, dict):
            data = dict(data)
            if "source" in data:
                data["source"] = _coerce_selector(data.get("source"))
            if "target" in data:
                data["target"] = _coerce_selector(data.get("target"))
        return data


class AssignAttributeIntent(IntentBase):
    kind: Literal["ASSIGN_ATTRIBUTE"] = "ASSIGN_ATTRIBUTE"
    target: NodeSelector
    field: str = Field(min_length=1)
    value: Any
    expected_event_seq: int | None = Field(default=None, ge=0)

    @model_validator(mode="before")
    @classmethod
    def _coerce_target(cls, data: Any) -> Any:
        if isinstance(data, dict) and "target" in data:
            data = dict(data)
            data["target"] = _coerce_selector(data.get("target"))
        return data


class FlowIntent(IntentBase):
    kind: Literal["FLOW"] = "FLOW"
    source: NodeSelector
    target: NodeSelector

    @model_validator(mode="before")
    @classmethod
    def _coerce_nodes(cls, data: Any) -> Any:
        if isinstance(data, dict):
            data = dict(data)
            if "source" in data:
                data["source"] = _coerce_selector(data.get("source"))
            if "target" in data:
                data["target"] = _coerce_selector(data.get("target"))
        return data


class ExtinguishNodeIntent(IntentBase):
    kind: Literal["EXTINGUISH_NODE"] = "EXTINGUISH_NODE"
    target: NodeSelector

    @model_validator(mode="before")
    @classmethod
    def _coerce_target(cls, data: Any) -> Any:
        if isinstance(data, dict) and "target" in data:
            data = dict(data)
            data["target"] = _coerce_selector(data.get("target"))
        return data


class SelectNodesIntent(IntentBase):
    kind: Literal["SELECT_NODES"] = "SELECT_NODES"
    target: NodeSelector
    condition: str | None = None

    @model_validator(mode="before")
    @classmethod
    def _coerce_target(cls, data: Any) -> Any:
        if isinstance(data, dict) and "target" in data:
            data = dict(data)
            data["target"] = _coerce_selector(data.get("target"))
        return data


class SetFormulaIntent(IntentBase):
    kind: Literal["SET_FORMULA"] = "SET_FORMULA"
    target: NodeSelector
    field: str = Field(min_length=1)
    formula: str = Field(min_length=1)

    @model_validator(mode="before")
    @classmethod
    def _coerce_target(cls, data: Any) -> Any:
        if isinstance(data, dict) and "target" in data:
            data = dict(data)
            data["target"] = _coerce_selector(data.get("target"))
        return data


class AddGuardianIntent(IntentBase):
    kind: Literal["ADD_GUARDIAN"] = "ADD_GUARDIAN"
    target: NodeSelector
    field: str = Field(min_length=1)
    operator: str = Field(min_length=1)
    threshold: Any
    action: str = Field(min_length=1)

    @model_validator(mode="before")
    @classmethod
    def _coerce_target(cls, data: Any) -> Any:
        if isinstance(data, dict) and "target" in data:
            data = dict(data)
            data["target"] = _coerce_selector(data.get("target"))
        return data


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
