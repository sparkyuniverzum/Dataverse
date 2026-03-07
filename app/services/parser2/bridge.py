from __future__ import annotations

from dataclasses import dataclass
from uuid import UUID

from app.services.parser2.intents import (
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
from app.services.parser_service import AtomicTask


@dataclass(frozen=True)
class BridgeIssue:
    code: str
    message: str


@dataclass(frozen=True)
class BridgeResult:
    tasks: list[AtomicTask]
    errors: list[BridgeIssue]


class Parser2ExecutorBridge:
    """
    Converts Parser2 intents into V1 AtomicTask executor payload.

    If any bridge error occurs, no tasks are returned to avoid partial execution.
    """

    def to_atomic_tasks(self, envelope: IntentEnvelope) -> BridgeResult:
        tasks: list[AtomicTask] = []
        errors: list[BridgeIssue] = []
        known_name_upserts: set[str] = set()
        for intent in envelope.intents:
            self._compile_intent(intent=intent, tasks=tasks, errors=errors, known_name_upserts=known_name_upserts)
        if errors:
            return BridgeResult(tasks=[], errors=errors)
        return BridgeResult(tasks=tasks, errors=[])

    def _compile_intent(
        self,
        *,
        intent: Intent,
        tasks: list[AtomicTask],
        errors: list[BridgeIssue],
        known_name_upserts: set[str],
    ) -> None:
        if isinstance(intent, BulkIntent):
            for nested in intent.intents:
                self._compile_intent(
                    intent=nested,
                    tasks=tasks,
                    errors=errors,
                    known_name_upserts=known_name_upserts,
                )
            return

        if isinstance(intent, UpsertNodeIntent):
            self._compile_upsert(
                intent=intent,
                tasks=tasks,
                errors=errors,
                known_name_upserts=known_name_upserts,
            )
            return

        if isinstance(intent, AssignAttributeIntent):
            self._compile_assign(
                intent=intent,
                tasks=tasks,
                errors=errors,
                known_name_upserts=known_name_upserts,
            )
            return

        if isinstance(intent, CreateLinkIntent):
            self._compile_link(
                source=intent.source,
                target=intent.target,
                link_type=intent.link_type,
                metadata=intent.metadata,
                tasks=tasks,
                errors=errors,
                known_name_upserts=known_name_upserts,
            )
            return

        if isinstance(intent, FlowIntent):
            self._compile_link(
                source=intent.source,
                target=intent.target,
                link_type=LinkType.FLOW,
                metadata={},
                tasks=tasks,
                errors=errors,
                known_name_upserts=known_name_upserts,
            )
            return

        if isinstance(intent, ExtinguishNodeIntent):
            self._compile_extinguish(intent=intent, tasks=tasks, errors=errors)
            return

        if isinstance(intent, SelectNodesIntent):
            tasks.append(
                AtomicTask(
                    action="SELECT",
                    params={"target_asteroid": intent.target, "condition": intent.condition},
                )
            )
            return

        if isinstance(intent, SetFormulaIntent):
            tasks.append(
                AtomicTask(
                    action="SET_FORMULA",
                    params={"target": intent.target, "field": intent.field, "formula": intent.formula},
                )
            )
            return

        if isinstance(intent, AddGuardianIntent):
            tasks.append(
                AtomicTask(
                    action="ADD_GUARDIAN",
                    params={
                        "target": intent.target,
                        "field": intent.field,
                        "operator": intent.operator,
                        "threshold": intent.threshold,
                        "action": intent.action,
                    },
                )
            )
            return

        errors.append(
            BridgeIssue(
                code="BRIDGE_UNSUPPORTED_INTENT",
                message=f"Unsupported intent kind: {intent.kind}",
            )
        )

    def _compile_upsert(
        self,
        *,
        intent: UpsertNodeIntent,
        tasks: list[AtomicTask],
        errors: list[BridgeIssue],
        known_name_upserts: set[str],
    ) -> None:
        selector = intent.node
        if selector.selector_type == NodeSelectorType.NAME:
            known_name_upserts.add(selector.value)
            tasks.append(
                AtomicTask(
                    action="INGEST",
                    params={
                        "value": selector.value,
                        "metadata": dict(intent.metadata),
                    },
                )
            )
            return

        if selector.selector_type == NodeSelectorType.ID:
            asteroid_id = self._validate_uuid_selector(selector=selector, errors=errors)
            if asteroid_id is None:
                return
            if intent.metadata:
                tasks.append(
                    AtomicTask(
                        action="UPDATE_ASTEROID",
                        params={"asteroid_id": asteroid_id, "metadata": dict(intent.metadata)},
                    )
                )
            return

        errors.append(
            BridgeIssue(
                code="BRIDGE_UNSUPPORTED_SELECTOR",
                message=f"Unsupported selector type for UPSERT_NODE: {selector.selector_type}",
            )
        )

    def _compile_assign(
        self,
        *,
        intent: AssignAttributeIntent,
        tasks: list[AtomicTask],
        errors: list[BridgeIssue],
        known_name_upserts: set[str],
    ) -> None:
        selector = intent.target
        metadata = {intent.field: intent.value}

        if selector.selector_type == NodeSelectorType.NAME:
            known_name_upserts.add(selector.value)
            tasks.append(
                AtomicTask(
                    action="INGEST",
                    params={"value": selector.value, "metadata": metadata},
                )
            )
            return

        if selector.selector_type == NodeSelectorType.ID:
            asteroid_id = self._validate_uuid_selector(selector=selector, errors=errors)
            if asteroid_id is None:
                return
            tasks.append(
                AtomicTask(
                    action="UPDATE_ASTEROID",
                    params={"asteroid_id": asteroid_id, "metadata": metadata},
                )
            )
            return

        errors.append(
            BridgeIssue(
                code="BRIDGE_UNSUPPORTED_SELECTOR",
                message=f"Unsupported selector type for ASSIGN_ATTRIBUTE: {selector.selector_type}",
            )
        )

    def _compile_link(
        self,
        *,
        source: NodeSelector,
        target: NodeSelector,
        link_type: LinkType,
        metadata: dict,
        tasks: list[AtomicTask],
        errors: list[BridgeIssue],
        known_name_upserts: set[str],
    ) -> None:
        if source.selector_type == NodeSelectorType.NAME and target.selector_type == NodeSelectorType.NAME:
            link_params = {"type": link_type.value}
            if metadata:
                link_params["metadata"] = dict(metadata)
            if source.value in known_name_upserts and target.value in known_name_upserts:
                tasks.append(AtomicTask(action="LINK", params=link_params))
                return
            tasks.append(AtomicTask(action="INGEST", params={"value": source.value, "metadata": {}}))
            tasks.append(AtomicTask(action="INGEST", params={"value": target.value, "metadata": {}}))
            known_name_upserts.add(source.value)
            known_name_upserts.add(target.value)
            tasks.append(AtomicTask(action="LINK", params=link_params))
            return

        if source.selector_type == NodeSelectorType.ID and target.selector_type == NodeSelectorType.ID:
            source_civilization_id = self._validate_uuid_selector(selector=source, errors=errors)
            target_civilization_id = self._validate_uuid_selector(selector=target, errors=errors)
            if source_civilization_id is None or target_civilization_id is None:
                return
            link_params = {
                "source_civilization_id": source_civilization_id,
                "target_civilization_id": target_civilization_id,
                "type": link_type.value,
            }
            if metadata:
                link_params["metadata"] = dict(metadata)
            tasks.append(AtomicTask(action="LINK", params=link_params))
            return

        errors.append(
            BridgeIssue(
                code="BRIDGE_MIXED_SELECTOR_LINK",
                message="CREATE_LINK/FLOW requires both selectors as NAME or both as ID",
            )
        )

    def _compile_extinguish(
        self,
        *,
        intent: ExtinguishNodeIntent,
        tasks: list[AtomicTask],
        errors: list[BridgeIssue],
    ) -> None:
        selector = intent.target
        if selector.selector_type == NodeSelectorType.NAME:
            tasks.append(AtomicTask(action="DELETE", params={"target": selector.value}))
            return

        if selector.selector_type == NodeSelectorType.ID:
            asteroid_id = self._validate_uuid_selector(selector=selector, errors=errors)
            if asteroid_id is None:
                return
            tasks.append(AtomicTask(action="EXTINGUISH", params={"asteroid_id": asteroid_id}))
            return

        errors.append(
            BridgeIssue(
                code="BRIDGE_UNSUPPORTED_SELECTOR",
                message=f"Unsupported selector type for EXTINGUISH_NODE: {selector.selector_type}",
            )
        )

    def _validate_uuid_selector(self, *, selector: NodeSelector, errors: list[BridgeIssue]) -> str | None:
        try:
            return str(UUID(selector.value))
        except (TypeError, ValueError):
            errors.append(
                BridgeIssue(
                    code="BRIDGE_INVALID_SELECTOR_ID",
                    message=f"Invalid UUID selector value: {selector.value}",
                )
            )
            return None
