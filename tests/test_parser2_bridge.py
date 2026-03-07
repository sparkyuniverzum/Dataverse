import sys
from pathlib import Path

sys.path.append(str(Path(__file__).resolve().parents[1]))

from app.services.parser2 import (
    AddGuardianIntent,
    AssignAttributeIntent,
    BulkIntent,
    CreateLinkIntent,
    ExtinguishNodeIntent,
    FlowIntent,
    IntentEnvelope,
    LinkType,
    NodeSelector,
    NodeSelectorType,
    Parser2ExecutorBridge,
    SelectNodesIntent,
    SetFormulaIntent,
    UpsertNodeIntent,
)


def test_bridge_maps_name_upsert_to_ingest() -> None:
    bridge = Parser2ExecutorBridge()
    envelope = IntentEnvelope(
        intents=[
            UpsertNodeIntent(
                node=NodeSelector(selector_type=NodeSelectorType.NAME, value="Erik"),
                metadata={"role": "dev"},
            )
        ]
    )

    result = bridge.to_atomic_tasks(envelope)
    assert result.errors == []
    assert len(result.tasks) == 1
    assert result.tasks[0].action == "INGEST"
    assert result.tasks[0].params == {"value": "Erik", "metadata": {"role": "dev"}}


def test_bridge_maps_id_upsert_to_update_only_with_metadata() -> None:
    bridge = Parser2ExecutorBridge()
    asteroid_id = "63b9d570-5ef6-47eb-8bf4-70bcdb6db95b"
    envelope = IntentEnvelope(
        intents=[
            UpsertNodeIntent(
                node=NodeSelector(selector_type=NodeSelectorType.ID, value=asteroid_id),
                metadata={"status": "active"},
            )
        ]
    )

    result = bridge.to_atomic_tasks(envelope)
    assert result.errors == []
    assert len(result.tasks) == 1
    assert result.tasks[0].action == "UPDATE_ASTEROID"
    assert result.tasks[0].params == {"asteroid_id": asteroid_id, "metadata": {"status": "active"}}


def test_bridge_maps_assign_attribute_to_ingest_or_update() -> None:
    bridge = Parser2ExecutorBridge()
    asteroid_id = "2c4a713f-0f3d-47d1-8e38-6aa4492f0ec3"
    envelope = IntentEnvelope(
        intents=[
            AssignAttributeIntent(
                target=NodeSelector(selector_type=NodeSelectorType.NAME, value="Erik"),
                field="salary",
                value=50000,
            ),
            AssignAttributeIntent(
                target=NodeSelector(selector_type=NodeSelectorType.ID, value=asteroid_id),
                field="state",
                value="ok",
            ),
        ]
    )

    result = bridge.to_atomic_tasks(envelope)
    assert result.errors == []
    assert [task.action for task in result.tasks] == ["INGEST", "UPDATE_ASTEROID"]
    assert result.tasks[0].params == {"value": "Erik", "metadata": {"salary": 50000}}
    assert result.tasks[1].params == {"asteroid_id": asteroid_id, "metadata": {"state": "ok"}}


def test_bridge_maps_links_for_name_and_id_selectors() -> None:
    bridge = Parser2ExecutorBridge()
    source_civilization_id = "cfe4b9fd-97d5-4052-a696-976dbd2822af"
    target_civilization_id = "9ae9732f-cb9c-4db2-a3f2-5e7f7cbe93ac"
    envelope = IntentEnvelope(
        intents=[
            CreateLinkIntent(
                source=NodeSelector(selector_type=NodeSelectorType.NAME, value="A"),
                target=NodeSelector(selector_type=NodeSelectorType.NAME, value="B"),
                link_type=LinkType.RELATION,
            ),
            CreateLinkIntent(
                source=NodeSelector(selector_type=NodeSelectorType.ID, value=source_civilization_id),
                target=NodeSelector(selector_type=NodeSelectorType.ID, value=target_civilization_id),
                link_type=LinkType.TYPE,
                metadata={"origin": "bridge-test"},
            ),
        ]
    )

    result = bridge.to_atomic_tasks(envelope)
    assert result.errors == []
    assert [task.action for task in result.tasks] == ["INGEST", "INGEST", "LINK", "LINK"]
    assert result.tasks[2].params == {"type": "RELATION"}
    assert result.tasks[3].params == {
        "source_civilization_id": source_civilization_id,
        "target_civilization_id": target_civilization_id,
        "type": "TYPE",
        "metadata": {"origin": "bridge-test"},
    }


def test_bridge_maps_flow_to_flow_link() -> None:
    bridge = Parser2ExecutorBridge()
    envelope = IntentEnvelope(
        intents=[
            FlowIntent(
                source=NodeSelector(selector_type=NodeSelectorType.NAME, value="Erik"),
                target=NodeSelector(selector_type=NodeSelectorType.NAME, value="alert_red"),
            )
        ]
    )

    result = bridge.to_atomic_tasks(envelope)
    assert result.errors == []
    assert [task.action for task in result.tasks] == ["INGEST", "INGEST", "LINK"]
    assert result.tasks[2].params == {"type": "FLOW"}


def test_bridge_maps_extinguish_for_name_and_id() -> None:
    bridge = Parser2ExecutorBridge()
    asteroid_id = "f6e91fd3-5a7d-44d0-99d7-d57af877d4ea"
    envelope = IntentEnvelope(
        intents=[
            ExtinguishNodeIntent(target=NodeSelector(selector_type=NodeSelectorType.NAME, value="Legacy")),
            ExtinguishNodeIntent(target=NodeSelector(selector_type=NodeSelectorType.ID, value=asteroid_id)),
        ]
    )

    result = bridge.to_atomic_tasks(envelope)
    assert result.errors == []
    assert [task.action for task in result.tasks] == ["DELETE", "EXTINGUISH"]
    assert result.tasks[0].params == {"target": "Legacy"}
    assert result.tasks[1].params == {"asteroid_id": asteroid_id}


def test_bridge_maps_select_formula_and_guardian_intents() -> None:
    bridge = Parser2ExecutorBridge()
    envelope = IntentEnvelope(
        intents=[
            SelectNodesIntent(target="Projekt", condition="active"),
            SetFormulaIntent(target="Projekt", field="celkem", formula="=SUM(cena)"),
            AddGuardianIntent(target="Projekt", field="celkem", operator=">", threshold=1000, action="pulse"),
        ]
    )

    result = bridge.to_atomic_tasks(envelope)
    assert result.errors == []
    assert [task.action for task in result.tasks] == ["SELECT", "SET_FORMULA", "ADD_GUARDIAN"]
    assert result.tasks[0].params == {"target_asteroid": "Projekt", "condition": "active"}
    assert result.tasks[1].params == {"target": "Projekt", "field": "celkem", "formula": "=SUM(cena)"}
    assert result.tasks[2].params == {
        "target": "Projekt",
        "field": "celkem",
        "operator": ">",
        "threshold": 1000,
        "action": "pulse",
    }


def test_bridge_flattens_bulk_intents() -> None:
    bridge = Parser2ExecutorBridge()
    envelope = IntentEnvelope(
        intents=[
            BulkIntent(
                intents=[
                    UpsertNodeIntent(node=NodeSelector(value="A")),
                    CreateLinkIntent(
                        source=NodeSelector(value="A"),
                        target=NodeSelector(value="B"),
                        link_type=LinkType.RELATION,
                    ),
                ]
            )
        ]
    )

    result = bridge.to_atomic_tasks(envelope)
    assert result.errors == []
    assert [task.action for task in result.tasks] == ["INGEST", "INGEST", "INGEST", "LINK"]


def test_bridge_rejects_mixed_link_selectors_with_no_partial_output() -> None:
    bridge = Parser2ExecutorBridge()
    envelope = IntentEnvelope(
        intents=[
            UpsertNodeIntent(node=NodeSelector(value="A")),
            CreateLinkIntent(
                source=NodeSelector(selector_type=NodeSelectorType.ID, value="cfe4b9fd-97d5-4052-a696-976dbd2822af"),
                target=NodeSelector(selector_type=NodeSelectorType.NAME, value="B"),
                link_type=LinkType.RELATION,
            ),
        ]
    )

    result = bridge.to_atomic_tasks(envelope)
    assert result.tasks == []
    assert len(result.errors) == 1
    assert result.errors[0].code == "BRIDGE_MIXED_SELECTOR_LINK"


def test_bridge_rejects_invalid_uuid_selector_with_no_partial_output() -> None:
    bridge = Parser2ExecutorBridge()
    envelope = IntentEnvelope(
        intents=[
            AssignAttributeIntent(
                target=NodeSelector(selector_type=NodeSelectorType.ID, value="not-a-uuid"),
                field="status",
                value="bad",
            )
        ]
    )

    result = bridge.to_atomic_tasks(envelope)
    assert result.tasks == []
    assert len(result.errors) == 1
    assert result.errors[0].code == "BRIDGE_INVALID_SELECTOR_ID"
