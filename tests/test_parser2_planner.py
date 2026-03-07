import sys
from pathlib import Path

sys.path.append(str(Path(__file__).resolve().parents[1]))

from app.services.parser2 import (
    AddGuardianIntent,
    AssignAttributeIntent,
    CreateLinkIntent,
    ExtinguishNodeIntent,
    FlowIntent,
    LinkType,
    NodeSelector,
    NodeSelectorType,
    Parser2SemanticPlanner,
    SelectNodesIntent,
    SemanticResolver,
    SetFormulaIntent,
    UpsertNodeIntent,
)


class StaticResolver(SemanticResolver):
    def __init__(self, mapping: dict[str, str]) -> None:
        self.mapping = mapping

    def resolve_node(self, name: str) -> NodeSelector | None:
        resolved = self.mapping.get(name)
        if resolved is None:
            return None
        return NodeSelector(selector_type=NodeSelectorType.ID, value=resolved)


class DiagnosticResolver(StaticResolver):
    def unresolved_issue(self, name: str) -> tuple[str, str] | None:
        if name == "Ambiguous":
            return ("PLAN_RESOLVE_AMBIGUOUS_NAME", "Ambiguous match")
        if name == "Missing":
            return ("PLAN_RESOLVE_NOT_FOUND", "Missing node")
        return None


def test_planner_generates_sequential_relation_links_and_upserts() -> None:
    planner = Parser2SemanticPlanner()
    result = planner.plan_text("A + B + C")

    assert result.errors == []
    assert result.envelope is not None

    upserts = [item for item in result.envelope.intents if isinstance(item, UpsertNodeIntent)]
    links = [item for item in result.envelope.intents if isinstance(item, CreateLinkIntent)]

    assert [intent.node.value for intent in upserts] == ["A", "B", "C"]
    assert len(links) == 2
    assert all(link.link_type == LinkType.RELATION for link in links)
    assert [(link.source.value, link.target.value) for link in links] == [("A", "B"), ("B", "C")]


def test_planner_compiles_nested_type_inside_relation() -> None:
    planner = Parser2SemanticPlanner()
    result = planner.plan_text("Erik + Projekt Alfa : Zaměstnanec")

    assert result.errors == []
    assert result.envelope is not None

    links = [item for item in result.envelope.intents if isinstance(item, CreateLinkIntent)]
    assert len(links) == 2
    assert any(
        link.link_type == LinkType.TYPE and link.source.value == "Projekt Alfa" and link.target.value == "Zaměstnanec"
        for link in links
    )
    assert any(
        link.link_type == LinkType.RELATION and link.source.value == "Erik" and link.target.value == "Projekt Alfa"
        for link in links
    )


def test_planner_compiles_assignment_and_flow_statements() -> None:
    planner = Parser2SemanticPlanner()

    assign_result = planner.plan_text("Erik.salary := 50000")
    assert assign_result.errors == []
    assert assign_result.envelope is not None
    assert any(isinstance(item, AssignAttributeIntent) for item in assign_result.envelope.intents)

    flow_result = planner.plan_text("Erik -> alert_red")
    assert flow_result.errors == []
    assert flow_result.envelope is not None
    flow_intents = [item for item in flow_result.envelope.intents if isinstance(item, FlowIntent)]
    assert len(flow_intents) == 1
    assert flow_intents[0].source.value == "Erik"
    assert flow_intents[0].target.value == "alert_red"


def test_planner_extinguish_does_not_generate_upserts() -> None:
    planner = Parser2SemanticPlanner()
    result = planner.plan_text("- (Erik, Jana)")

    assert result.errors == []
    assert result.envelope is not None
    assert all(not isinstance(item, UpsertNodeIntent) for item in result.envelope.intents)
    extinguish_intents = [item for item in result.envelope.intents if isinstance(item, ExtinguishNodeIntent)]
    assert len(extinguish_intents) == 2
    assert [item.target.value for item in extinguish_intents] == ["Erik", "Jana"]


def test_planner_uses_resolver_for_existing_nodes_without_upsert() -> None:
    resolver = StaticResolver(
        {
            "Erik": "cfe4b9fd-97d5-4052-a696-976dbd2822af",
            "Projekt": "2c4a713f-0f3d-47d1-8e38-6aa4492f0ec3",
        }
    )
    planner = Parser2SemanticPlanner(resolver=resolver)
    result = planner.plan_text("Erik + Projekt")

    assert result.errors == []
    assert result.envelope is not None
    assert all(not isinstance(item, UpsertNodeIntent) for item in result.envelope.intents)

    links = [item for item in result.envelope.intents if isinstance(item, CreateLinkIntent)]
    assert len(links) == 1
    assert links[0].source.selector_type == NodeSelectorType.ID
    assert links[0].target.selector_type == NodeSelectorType.ID


def test_planner_reports_reference_operand_error_for_non_assignment() -> None:
    planner = Parser2SemanticPlanner()
    result = planner.plan_text("Erik.salary + Bonus")

    assert result.envelope is None
    assert result.errors
    assert result.errors[0].code == "PLAN_UNSUPPORTED_REFERENCE_OPERAND"


def test_planner_treats_uuid_literal_as_id_selector_without_upsert() -> None:
    planner = Parser2SemanticPlanner()
    source_civilization_id = "cfe4b9fd-97d5-4052-a696-976dbd2822af"
    target_civilization_id = "2c4a713f-0f3d-47d1-8e38-6aa4492f0ec3"
    result = planner.plan_text(f'"{source_civilization_id}" + "{target_civilization_id}"')

    assert result.errors == []
    assert result.envelope is not None
    assert all(not isinstance(item, UpsertNodeIntent) for item in result.envelope.intents)
    links = [item for item in result.envelope.intents if isinstance(item, CreateLinkIntent)]
    assert len(links) == 1
    assert links[0].source.selector_type == NodeSelectorType.ID
    assert links[0].target.selector_type == NodeSelectorType.ID


def test_planner_treats_unquoted_uuid_literal_as_id_selector_without_upsert() -> None:
    planner = Parser2SemanticPlanner()
    source_civilization_id = "63b9d570-5ef6-47eb-8bf4-70bcdb6db95b"
    target_civilization_id = "2c4a713f-0f3d-47d1-8e38-6aa4492f0ec3"
    result = planner.plan_text(f"{source_civilization_id} + {target_civilization_id}")

    assert result.errors == []
    assert result.envelope is not None
    assert all(not isinstance(item, UpsertNodeIntent) for item in result.envelope.intents)
    links = [item for item in result.envelope.intents if isinstance(item, CreateLinkIntent)]
    assert len(links) == 1
    assert links[0].source.selector_type == NodeSelectorType.ID
    assert links[0].target.selector_type == NodeSelectorType.ID


def test_planner_can_produce_mixed_selectors_for_bridge_validation() -> None:
    planner = Parser2SemanticPlanner()
    source_civilization_id = "63b9d570-5ef6-47eb-8bf4-70bcdb6db95b"
    result = planner.plan_text(f'"{source_civilization_id}" + Projekt')

    assert result.errors == []
    assert result.envelope is not None
    links = [item for item in result.envelope.intents if isinstance(item, CreateLinkIntent)]
    assert len(links) == 1
    assert links[0].source.selector_type == NodeSelectorType.ID
    assert links[0].target.selector_type == NodeSelectorType.NAME


def test_planner_compiles_legacy_select_command() -> None:
    planner = Parser2SemanticPlanner()
    result = planner.plan_text("show : Projekt @ active")

    assert result.errors == []
    assert result.envelope is not None
    selects = [item for item in result.envelope.intents if isinstance(item, SelectNodesIntent)]
    assert len(selects) == 1
    assert selects[0].target == "Projekt"
    assert selects[0].condition == "active"


def test_planner_compiles_legacy_delete_command() -> None:
    planner = Parser2SemanticPlanner()
    result = planner.plan_text("Delete : Legacy Node")

    assert result.errors == []
    assert result.envelope is not None
    deletes = [item for item in result.envelope.intents if isinstance(item, ExtinguishNodeIntent)]
    assert len(deletes) == 1
    assert deletes[0].target.value == "Legacy Node"


def test_planner_compiles_legacy_guardian_and_formula_commands() -> None:
    planner = Parser2SemanticPlanner()
    guardian_result = planner.plan_text("Hlídej : Projekt.celkem > 1000 -> pulse")
    formula_result = planner.plan_text("Spočítej : Projekt.celkem = SUM(cena)")

    assert guardian_result.errors == []
    assert guardian_result.envelope is not None
    guardians = [item for item in guardian_result.envelope.intents if isinstance(item, AddGuardianIntent)]
    assert len(guardians) == 1
    assert guardians[0].target == "Projekt"
    assert guardians[0].field == "celkem"
    assert guardians[0].operator == ">"
    assert guardians[0].threshold == 1000
    assert guardians[0].action == "pulse"

    assert formula_result.errors == []
    assert formula_result.envelope is not None
    formulas = [item for item in formula_result.envelope.intents if isinstance(item, SetFormulaIntent)]
    assert len(formulas) == 1
    assert formulas[0].target == "Projekt"
    assert formulas[0].field == "celkem"
    assert formulas[0].formula == "=SUM(cena)"


def test_planner_compiles_legacy_spoj_command_to_relation_chain() -> None:
    planner = Parser2SemanticPlanner()
    result = planner.plan_text("Spoj : A, B, C")

    assert result.errors == []
    assert result.envelope is not None
    links = [item for item in result.envelope.intents if isinstance(item, CreateLinkIntent)]
    assert len(links) == 2
    assert all(link.link_type == LinkType.RELATION for link in links)
    assert [(link.source.value, link.target.value) for link in links] == [("A", "B"), ("B", "C")]


def test_planner_compiles_legacy_metadata_relation_expression() -> None:
    planner = Parser2SemanticPlanner()
    result = planner.plan_text("Firma (obor: IT) + Produkt (cena: 500)")

    assert result.errors == []
    assert result.envelope is not None
    upserts = [item for item in result.envelope.intents if isinstance(item, UpsertNodeIntent)]
    links = [item for item in result.envelope.intents if isinstance(item, CreateLinkIntent)]
    assert len(upserts) == 2
    assert upserts[0].node.value == "Firma"
    assert upserts[0].metadata == {"obor": "IT"}
    assert upserts[1].node.value == "Produkt"
    assert upserts[1].metadata == {"cena": "500"}
    assert len(links) == 1
    assert links[0].link_type == LinkType.RELATION


def test_planner_compiles_legacy_metadata_single_ingest_expression() -> None:
    planner = Parser2SemanticPlanner()
    result = planner.plan_text("Firma (obor: IT, mesto=Praha)")

    assert result.errors == []
    assert result.envelope is not None
    upserts = [item for item in result.envelope.intents if isinstance(item, UpsertNodeIntent)]
    assert len(upserts) == 1
    assert upserts[0].node.value == "Firma"
    assert upserts[0].metadata == {"obor": "IT", "mesto": "Praha"}


def test_planner_returns_error_for_ambiguous_resolver_match() -> None:
    planner = Parser2SemanticPlanner(resolver=DiagnosticResolver({}))
    result = planner.plan_text("Ambiguous + C")

    assert result.envelope is None
    assert result.errors
    assert result.errors[0].code == "PLAN_RESOLVE_AMBIGUOUS_NAME"


def test_planner_returns_error_for_missing_node_when_create_missing_is_false() -> None:
    planner = Parser2SemanticPlanner(resolver=DiagnosticResolver({}))
    result = planner.plan_text("- Missing")

    assert result.envelope is None
    assert result.errors
    assert result.errors[0].code == "PLAN_RESOLVE_NOT_FOUND"
