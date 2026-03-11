import sys
from pathlib import Path

from pydantic import TypeAdapter

sys.path.append(str(Path(__file__).resolve().parents[1]))

from app.core.parser2.intents import (
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


def test_single_intent_roundtrip_with_discriminator() -> None:
    adapter = TypeAdapter(Intent)
    payload = {
        "kind": "CREATE_LINK",
        "source": {"selector_type": "NAME", "value": "Erik"},
        "target": {"selector_type": "NAME", "value": "Projekt Alfa"},
        "link_type": "RELATION",
    }

    parsed = adapter.validate_python(payload)
    assert isinstance(parsed, CreateLinkIntent)
    assert parsed.link_type == LinkType.RELATION

    serialized = parsed.model_dump(mode="json")
    reparsed = adapter.validate_python(serialized)
    assert isinstance(reparsed, CreateLinkIntent)
    assert reparsed.target.value == "Projekt Alfa"


def test_envelope_serialization_roundtrip() -> None:
    envelope = IntentEnvelope(
        intents=[
            UpsertNodeIntent(node=NodeSelector(value="Erik")),
            AssignAttributeIntent(target=NodeSelector(value="Erik"), field="salary", value="50000"),
            CreateLinkIntent(
                source=NodeSelector(value="Erik"),
                target=NodeSelector(value="Projekt Alfa"),
                link_type=LinkType.RELATION,
            ),
            FlowIntent(source=NodeSelector(value="Erik"), target=NodeSelector(value="alert_red")),
            ExtinguishNodeIntent(target=NodeSelector(value="Legacy Node")),
        ]
    )

    payload = envelope.model_dump(mode="json")
    restored = IntentEnvelope.model_validate(payload)

    assert restored.schema_version == "2.0"
    assert len(restored.intents) == 5
    assert isinstance(restored.intents[0], UpsertNodeIntent)
    assert isinstance(restored.intents[1], AssignAttributeIntent)
    assert isinstance(restored.intents[2], CreateLinkIntent)
    assert isinstance(restored.intents[3], FlowIntent)
    assert isinstance(restored.intents[4], ExtinguishNodeIntent)


def test_bulk_intent_embeds_child_intents_with_discriminator() -> None:
    bulk = BulkIntent(
        intents=[
            UpsertNodeIntent(node=NodeSelector(value="Jana")),
            CreateLinkIntent(
                source=NodeSelector(value="Jana"),
                target=NodeSelector(value="Tym"),
                link_type=LinkType.TYPE,
            ),
        ]
    )

    payload = bulk.model_dump(mode="json")
    restored = BulkIntent.model_validate(payload)

    assert len(restored.intents) == 2
    assert isinstance(restored.intents[0], UpsertNodeIntent)
    assert isinstance(restored.intents[1], CreateLinkIntent)
    assert restored.intents[1].link_type == LinkType.TYPE


def test_invalid_discriminator_is_rejected() -> None:
    adapter = TypeAdapter(Intent)
    payload = {
        "kind": "UNKNOWN_KIND",
        "node": {"selector_type": "NAME", "value": "Erik"},
    }

    try:
        adapter.validate_python(payload)
    except Exception as exc:  # noqa: BLE001 - validating specific error class is not required here
        assert "kind" in str(exc)
        return

    raise AssertionError("Expected validation error for unknown kind discriminator")


def test_selector_type_id_can_be_used_for_future_resolver_phase() -> None:
    intent = UpsertNodeIntent(
        node=NodeSelector(selector_type=NodeSelectorType.ID, value="63b9d570-5ef6-47eb-8bf4-70bcdb6db95b")
    )
    assert intent.node.selector_type == NodeSelectorType.ID


def test_legacy_command_intents_roundtrip() -> None:
    envelope = IntentEnvelope(
        intents=[
            SelectNodesIntent(target="Projekt", condition="active"),
            SetFormulaIntent(target="Projekt", field="celkem", formula="=SUM(cena)"),
            AddGuardianIntent(target="Projekt", field="celkem", operator=">", threshold=1000, action="pulse"),
        ]
    )

    payload = envelope.model_dump(mode="json")
    restored = IntentEnvelope.model_validate(payload)

    assert len(restored.intents) == 3
    assert isinstance(restored.intents[0], SelectNodesIntent)
    assert isinstance(restored.intents[1], SetFormulaIntent)
    assert isinstance(restored.intents[2], AddGuardianIntent)
