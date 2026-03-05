from __future__ import annotations

import re
from dataclasses import dataclass
from typing import Any, Protocol
from uuid import UUID

from app.services.parser2.intents import (
    AddGuardianIntent,
    AssignAttributeIntent,
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
from app.services.parser2.models import (
    AssignNode,
    AstNode,
    EntityNode,
    ExtinguishNode,
    FlowNode,
    GroupNode,
    LiteralNode,
    ParseError,
    ReferenceNode,
    RelationLinkNode,
    TypeLinkNode,
)
from app.services.parser2.parser import Parser2Service


class SemanticResolver(Protocol):
    def resolve_node(self, name: str) -> NodeSelector | None:
        """Resolve a human name to a stable selector (typically ID-based)."""


@dataclass(frozen=True)
class PlanIssue:
    code: str
    message: str


@dataclass(frozen=True)
class SemanticPlanResult:
    envelope: IntentEnvelope | None
    ast: AstNode | None
    errors: list[PlanIssue]


@dataclass(frozen=True)
class _CompileResult:
    selectors: list[NodeSelector]
    intents: list[Intent]
    errors: list[PlanIssue]


class Parser2SemanticPlanner:
    _delete_command_re = re.compile(
        r"^(zhasni|smaz|smaž|delete)\s*:\s*(?P<target>.+)$",
        re.IGNORECASE,
    )
    _guardian_command_re = re.compile(
        r"^(hlídej|hlidej)\s*:\s*(?P<target>.+?)\.(?P<field>[^\s]+)\s*"
        r"(?P<operator>>=|<=|==|>|<)\s*(?P<threshold>.+?)\s*->\s*(?P<action>[a-zA-Z_][\w-]*)\s*$",
        re.IGNORECASE,
    )
    _set_formula_re = re.compile(
        r"^(spočítej|spocitej|vypočítej|vypocitej)\s*:\s*(?P<target>[^.]+?)\.(?P<field>[^=\s]+)\s*=\s*"
        r"(?P<func>SUM|AVG|MIN|MAX|COUNT)\s*\(\s*(?P<source_attr>[^)]+)\s*\)\s*$",
        re.IGNORECASE,
    )
    _triple_shot_re = re.compile(r"^(?P<verb>[^\s:]+)\s*:\s*(?P<target>[^@]+?)(?:\s*@\s*(?P<condition>.*))?$")

    def __init__(self, *, parser: Parser2Service | None = None, resolver: SemanticResolver | None = None) -> None:
        self.parser = parser or Parser2Service()
        self.resolver = resolver
        self._planned_upserts: set[tuple[str, str]] = set()

    def plan_text(self, text: str) -> SemanticPlanResult:
        legacy_result = self._plan_legacy_command(text)
        if legacy_result is not None:
            return legacy_result

        metadata_result = self._plan_metadata_expression(text)
        if metadata_result is not None:
            return metadata_result

        parse_result = self.parser.parse(text)
        if parse_result.errors:
            return SemanticPlanResult(
                envelope=None,
                ast=parse_result.ast,
                errors=[self._from_parse_error(item) for item in parse_result.errors],
            )

        if parse_result.ast is None:
            return SemanticPlanResult(
                envelope=None,
                ast=None,
                errors=[PlanIssue(code="PLAN_MISSING_AST", message="Parser did not produce AST")],
            )

        return self.plan_ast(parse_result.ast)

    def plan_ast(self, ast: AstNode) -> SemanticPlanResult:
        self._planned_upserts = set()
        result = self._compile_statement(ast)
        if result.errors:
            return SemanticPlanResult(envelope=None, ast=ast, errors=result.errors)
        return SemanticPlanResult(envelope=IntentEnvelope(intents=result.intents), ast=ast, errors=[])

    @staticmethod
    def _from_parse_error(error: ParseError) -> PlanIssue:
        return PlanIssue(code=error.code, message=error.message)

    def _plan_legacy_command(self, text: str) -> SemanticPlanResult | None:
        normalized = str(text or "").strip()
        if not normalized:
            return None

        delete_match = self._delete_command_re.match(normalized)
        if delete_match:
            target = delete_match.group("target").strip()
            if not target:
                return SemanticPlanResult(
                    envelope=None,
                    ast=None,
                    errors=[PlanIssue(code="PLAN_LEGACY_INVALID_DELETE", message="Delete target is empty")],
                )
            return SemanticPlanResult(
                envelope=IntentEnvelope(
                    intents=[
                        ExtinguishNodeIntent(target=NodeSelector(selector_type=NodeSelectorType.NAME, value=target))
                    ]
                ),
                ast=None,
                errors=[],
            )

        guardian_match = self._guardian_command_re.match(normalized)
        if guardian_match:
            target = guardian_match.group("target").strip()
            field = guardian_match.group("field").strip()
            operator = guardian_match.group("operator").strip()
            threshold = self._coerce_scalar(guardian_match.group("threshold"))
            action = guardian_match.group("action").strip()
            if not (target and field and operator and action):
                return SemanticPlanResult(
                    envelope=None,
                    ast=None,
                    errors=[PlanIssue(code="PLAN_LEGACY_INVALID_GUARDIAN", message="Invalid guardian command syntax")],
                )
            return SemanticPlanResult(
                envelope=IntentEnvelope(
                    intents=[
                        AddGuardianIntent(
                            target=target,
                            field=field,
                            operator=operator,
                            threshold=threshold,
                            action=action,
                        )
                    ]
                ),
                ast=None,
                errors=[],
            )

        formula_match = self._set_formula_re.match(normalized)
        if formula_match:
            target = formula_match.group("target").strip()
            field = formula_match.group("field").strip()
            func = formula_match.group("func").strip().upper()
            source_attr = formula_match.group("source_attr").strip()
            if not (target and field and source_attr):
                return SemanticPlanResult(
                    envelope=None,
                    ast=None,
                    errors=[PlanIssue(code="PLAN_LEGACY_INVALID_FORMULA", message="Invalid formula command syntax")],
                )
            return SemanticPlanResult(
                envelope=IntentEnvelope(
                    intents=[SetFormulaIntent(target=target, field=field, formula=f"={func}({source_attr})")]
                ),
                ast=None,
                errors=[],
            )

        spoj_result = self._plan_spoj(normalized)
        if spoj_result is not None:
            return spoj_result

        triple_match = self._triple_shot_re.match(normalized)
        if triple_match:
            verb = triple_match.group("verb").strip().lower()
            if verb in {"ukaz", "ukaž", "najdi", "show", "find"}:
                target = triple_match.group("target").strip()
                condition_raw = triple_match.group("condition")
                condition = condition_raw.strip() if condition_raw else None
                if not target:
                    return SemanticPlanResult(
                        envelope=None,
                        ast=None,
                        errors=[PlanIssue(code="PLAN_LEGACY_INVALID_SELECT", message="Select target is empty")],
                    )
                return SemanticPlanResult(
                    envelope=IntentEnvelope(intents=[SelectNodesIntent(target=target, condition=condition)]),
                    ast=None,
                    errors=[],
                )

        return None

    def _compile_statement(self, node: AstNode) -> _CompileResult:
        if isinstance(node, AssignNode):
            target_selector, target_intents, target_errors = self._resolve_entity(
                node.target.entity, create_missing=True
            )
            if target_errors:
                return _CompileResult(selectors=[], intents=target_intents, errors=target_errors)

            value = self._coerce_assign_value(node.value)
            if isinstance(value, PlanIssue):
                return _CompileResult(selectors=[], intents=target_intents, errors=[value])

            assign_intent = AssignAttributeIntent(target=target_selector, field=node.target.field, value=value)
            return _CompileResult(selectors=[target_selector], intents=[*target_intents, assign_intent], errors=[])

        if isinstance(node, FlowNode):
            source = self._compile_operand(node.source, create_missing=True)
            if source.errors:
                return source
            target = self._compile_operand(node.target, create_missing=True)
            if target.errors:
                return target

            flow_intents: list[Intent] = [*source.intents, *target.intents]
            for source_selector in source.selectors:
                for target_selector in target.selectors:
                    flow_intents.append(FlowIntent(source=source_selector, target=target_selector))
            return _CompileResult(selectors=target.selectors, intents=flow_intents, errors=[])

        if isinstance(node, ExtinguishNode):
            target = self._compile_operand(node.target, create_missing=False)
            if target.errors:
                return target

            intents: list[Intent] = []
            for selector in target.selectors:
                intents.append(ExtinguishNodeIntent(target=selector))
            return _CompileResult(selectors=target.selectors, intents=intents, errors=[])

        if isinstance(node, EntityNode):
            normalized_name = node.name.strip()
            if not normalized_name:
                return _CompileResult(
                    selectors=[],
                    intents=[],
                    errors=[PlanIssue(code="PLAN_EMPTY_ENTITY_NAME", message="Entity name cannot be empty")],
                )
            selector = NodeSelector(selector_type=NodeSelectorType.NAME, value=normalized_name)
            signature = (selector.selector_type.value, selector.value)
            if signature in self._planned_upserts:
                return _CompileResult(selectors=[selector], intents=[], errors=[])
            self._planned_upserts.add(signature)
            return _CompileResult(selectors=[selector], intents=[UpsertNodeIntent(node=selector)], errors=[])

        return self._compile_operand(node, create_missing=True)

    def _compile_operand(self, node: AstNode, *, create_missing: bool) -> _CompileResult:
        if isinstance(node, EntityNode):
            selector, intents, errors = self._resolve_entity(node.name, create_missing=create_missing)
            return _CompileResult(selectors=[selector], intents=intents, errors=errors)

        if isinstance(node, GroupNode):
            all_selectors: list[NodeSelector] = []
            all_intents: list[Intent] = []
            all_errors: list[PlanIssue] = []
            for item in node.items:
                compiled = self._compile_operand(item, create_missing=create_missing)
                all_selectors.extend(compiled.selectors)
                all_intents.extend(compiled.intents)
                all_errors.extend(compiled.errors)
            return _CompileResult(selectors=all_selectors, intents=all_intents, errors=all_errors)

        if isinstance(node, RelationLinkNode):
            return self._compile_relation_chain(node, create_missing=create_missing)

        if isinstance(node, TypeLinkNode):
            return self._compile_type_chain(node, create_missing=create_missing)

        if isinstance(node, ReferenceNode):
            return _CompileResult(
                selectors=[],
                intents=[],
                errors=[
                    PlanIssue(
                        code="PLAN_UNSUPPORTED_REFERENCE_OPERAND",
                        message="Reference operand is only valid as assignment target",
                    )
                ],
            )

        if isinstance(node, LiteralNode):
            return _CompileResult(
                selectors=[],
                intents=[],
                errors=[
                    PlanIssue(
                        code="PLAN_UNSUPPORTED_LITERAL_OPERAND",
                        message="Literal operand is only valid as assignment value",
                    )
                ],
            )

        if isinstance(node, AssignNode) or isinstance(node, FlowNode) or isinstance(node, ExtinguishNode):
            return self._compile_statement(node)

        return _CompileResult(
            selectors=[],
            intents=[],
            errors=[
                PlanIssue(
                    code="PLAN_UNKNOWN_AST_NODE",
                    message=f"Unsupported AST node for planner: {node.__class__.__name__}",
                )
            ],
        )

    def _compile_relation_chain(self, node: RelationLinkNode, *, create_missing: bool) -> _CompileResult:
        operands = self._flatten_relation_chain(node)
        compiled_operands = [self._compile_operand(item, create_missing=create_missing) for item in operands]

        errors = [error for item in compiled_operands for error in item.errors]
        if errors:
            intents = [intent for item in compiled_operands for intent in item.intents]
            return _CompileResult(selectors=[], intents=intents, errors=errors)

        intents: list[Intent] = []
        for item in compiled_operands:
            intents.extend(item.intents)

        for index in range(len(compiled_operands) - 1):
            left = compiled_operands[index]
            right = compiled_operands[index + 1]
            for source in left.selectors:
                for target in right.selectors:
                    intents.append(CreateLinkIntent(source=source, target=target, link_type=LinkType.RELATION))

        return _CompileResult(
            selectors=(compiled_operands[-1].selectors if compiled_operands else []),
            intents=intents,
            errors=[],
        )

    def _compile_type_chain(self, node: TypeLinkNode, *, create_missing: bool) -> _CompileResult:
        operands = self._flatten_type_chain(node)
        compiled_operands = [self._compile_operand(item, create_missing=create_missing) for item in operands]

        errors = [error for item in compiled_operands for error in item.errors]
        if errors:
            intents = [intent for item in compiled_operands for intent in item.intents]
            return _CompileResult(selectors=[], intents=intents, errors=errors)

        intents: list[Intent] = []
        for item in compiled_operands:
            intents.extend(item.intents)

        for index in range(len(compiled_operands) - 1):
            left = compiled_operands[index]
            right = compiled_operands[index + 1]
            for source in left.selectors:
                for target in right.selectors:
                    intents.append(CreateLinkIntent(source=source, target=target, link_type=LinkType.TYPE))

        return _CompileResult(
            selectors=(compiled_operands[0].selectors if compiled_operands else []),
            intents=intents,
            errors=[],
        )

    def _resolve_entity(self, name: str, *, create_missing: bool) -> tuple[NodeSelector, list[Intent], list[PlanIssue]]:
        normalized_name = name.strip()
        if not normalized_name:
            return (
                NodeSelector(value=""),
                [],
                [PlanIssue(code="PLAN_EMPTY_ENTITY_NAME", message="Entity name cannot be empty")],
            )

        if self.resolver is not None:
            resolved = self.resolver.resolve_node(normalized_name)
            if resolved is not None:
                return resolved, [], []
            unresolved_issue = getattr(self.resolver, "unresolved_issue", None)
            if callable(unresolved_issue):
                issue = unresolved_issue(normalized_name)
                if issue is not None:
                    code, message = issue
                    if code == "PLAN_RESOLVE_AMBIGUOUS_NAME":
                        return (
                            NodeSelector(selector_type=NodeSelectorType.NAME, value=normalized_name),
                            [],
                            [PlanIssue(code=code, message=message)],
                        )
                    if code == "PLAN_RESOLVE_NOT_FOUND" and not create_missing:
                        return (
                            NodeSelector(selector_type=NodeSelectorType.NAME, value=normalized_name),
                            [],
                            [PlanIssue(code=code, message=message)],
                        )

        uuid_selector = self._try_uuid_selector(normalized_name)
        if uuid_selector is not None:
            return uuid_selector, [], []

        selector = NodeSelector(selector_type=NodeSelectorType.NAME, value=normalized_name)
        if not create_missing:
            return selector, [], []

        signature = (selector.selector_type.value, selector.value)
        if signature in self._planned_upserts:
            return selector, [], []

        self._planned_upserts.add(signature)
        return selector, [UpsertNodeIntent(node=selector)], []

    @staticmethod
    def _coerce_scalar(value: str) -> Any:
        candidate = str(value).strip()
        if not candidate:
            return ""
        normalized = candidate.replace("\u00a0", "").replace(" ", "").replace(",", ".")
        try:
            float_value = float(normalized)
        except ValueError:
            return candidate
        if float_value.is_integer():
            return int(float_value)
        return float_value

    def _split_top_level(self, text: str, delimiter: str) -> list[str]:
        parts: list[str] = []
        current: list[str] = []
        depth = 0
        quote: str | None = None

        for ch in text:
            if ch in {"'", '"'}:
                if quote is None:
                    quote = ch
                elif quote == ch:
                    quote = None
                current.append(ch)
                continue
            if quote is not None:
                current.append(ch)
                continue
            if ch == "(":
                depth += 1
                current.append(ch)
                continue
            if ch == ")":
                depth = max(0, depth - 1)
                current.append(ch)
                continue
            if ch == delimiter and depth == 0:
                parts.append("".join(current).strip())
                current = []
                continue
            current.append(ch)

        parts.append("".join(current).strip())
        return parts

    def _plan_spoj(self, normalized: str) -> SemanticPlanResult | None:
        if not normalized.lower().startswith("spoj"):
            return None
        match = re.match(r"^spoj\s*:\s*(?P<body>.+)$", normalized, re.IGNORECASE)
        if not match:
            return SemanticPlanResult(
                envelope=None,
                ast=None,
                errors=[PlanIssue(code="PLAN_LEGACY_INVALID_SPOJ", message="Invalid spoj command syntax")],
            )

        body = match.group("body").strip()
        if not body:
            return SemanticPlanResult(
                envelope=None,
                ast=None,
                errors=[PlanIssue(code="PLAN_LEGACY_INVALID_SPOJ", message="Spoj command body is empty")],
            )

        comma_parts = self._split_top_level(body, ",")
        plus_parts = self._split_top_level(body, "+")

        raw_parts: list[str]
        if len(comma_parts) >= 2:
            raw_parts = comma_parts
        elif len(plus_parts) >= 2:
            raw_parts = plus_parts
        else:
            return SemanticPlanResult(
                envelope=None,
                ast=None,
                errors=[PlanIssue(code="PLAN_LEGACY_INVALID_SPOJ", message="Spoj expects at least two operands")],
            )

        if any(not item.strip() for item in raw_parts):
            return SemanticPlanResult(
                envelope=None,
                ast=None,
                errors=[PlanIssue(code="PLAN_LEGACY_INVALID_SPOJ", message="Spoj contains empty operand")],
            )

        intents: list[Intent] = []
        selectors: list[NodeSelector] = []
        self._planned_upserts = set()
        for raw in raw_parts:
            selector, new_intents, errors = self._resolve_entity(raw.strip(), create_missing=True)
            if errors:
                return SemanticPlanResult(envelope=None, ast=None, errors=errors)
            selectors.append(selector)
            intents.extend(new_intents)

        for index in range(len(selectors) - 1):
            intents.append(
                CreateLinkIntent(
                    source=selectors[index],
                    target=selectors[index + 1],
                    link_type=LinkType.RELATION,
                )
            )

        return SemanticPlanResult(envelope=IntentEnvelope(intents=intents), ast=None, errors=[])

    def _plan_metadata_expression(self, text: str) -> SemanticPlanResult | None:
        normalized = str(text or "").strip()
        if not normalized or not self._has_legacy_metadata_syntax(normalized):
            return None

        if not self._is_balanced_parentheses(normalized):
            return SemanticPlanResult(
                envelope=None,
                ast=None,
                errors=[
                    PlanIssue(code="PLAN_METADATA_UNBALANCED_PARENTHESES", message="Unbalanced parentheses in command")
                ],
            )

        has_plus = self._count_top_level_operator(normalized, "+") > 0
        has_colon = self._count_top_level_operator(normalized, ":") > 0
        if has_plus and has_colon:
            return SemanticPlanResult(
                envelope=None,
                ast=None,
                errors=[
                    PlanIssue(
                        code="PLAN_METADATA_MIXED_OPERATORS", message="Mixed operators '+' and ':' are not supported"
                    )
                ],
            )

        operator = "+" if has_plus else (":" if has_colon else "")
        raw_parts = self._split_top_level(normalized, operator) if operator else [normalized]
        if any(not part.strip() for part in raw_parts):
            return SemanticPlanResult(
                envelope=None,
                ast=None,
                errors=[
                    PlanIssue(code="PLAN_METADATA_EMPTY_OPERAND", message="Metadata expression contains empty operand")
                ],
            )

        parsed_parts = [self._parse_atom_with_metadata(part) for part in raw_parts]
        if any(not value for value, _ in parsed_parts):
            return SemanticPlanResult(
                envelope=None,
                ast=None,
                errors=[PlanIssue(code="PLAN_METADATA_INVALID_OPERAND", message="Invalid metadata operand")],
            )

        self._planned_upserts = set()
        selectors: list[NodeSelector] = []
        intents: list[Intent] = []
        for value, metadata in parsed_parts:
            selector, base_intents, errors = self._resolve_entity(value, create_missing=True)
            if errors:
                return SemanticPlanResult(envelope=None, ast=None, errors=errors)
            selectors.append(selector)
            merged = False
            if metadata:
                for idx in range(len(base_intents) - 1, -1, -1):
                    item = base_intents[idx]
                    if isinstance(item, UpsertNodeIntent) and item.node == selector:
                        base_intents[idx] = UpsertNodeIntent(node=item.node, metadata={**item.metadata, **metadata})
                        merged = True
                        break
                if not merged:
                    base_intents.append(UpsertNodeIntent(node=selector, metadata=metadata))
            intents.extend(base_intents)

        if operator:
            link_type = LinkType.RELATION if operator == "+" else LinkType.TYPE
            for index in range(len(selectors) - 1):
                intents.append(
                    CreateLinkIntent(
                        source=selectors[index],
                        target=selectors[index + 1],
                        link_type=link_type,
                    )
                )

        return SemanticPlanResult(envelope=IntentEnvelope(intents=intents), ast=None, errors=[])

    @staticmethod
    def _try_uuid_selector(name: str) -> NodeSelector | None:
        try:
            value = str(UUID(name))
        except (TypeError, ValueError):
            return None
        return NodeSelector(selector_type=NodeSelectorType.ID, value=value)

    @staticmethod
    def _is_balanced_parentheses(text: str) -> bool:
        depth = 0
        for ch in text:
            if ch == "(":
                depth += 1
            elif ch == ")":
                depth -= 1
                if depth < 0:
                    return False
        return depth == 0

    @staticmethod
    def _has_legacy_metadata_syntax(text: str) -> bool:
        return bool(re.search(r"\S\s*\([^()]*[:=][^()]*\)", text))

    def _count_top_level_operator(self, text: str, operator: str) -> int:
        count = 0
        depth = 0
        quote: str | None = None
        for ch in text:
            if ch in {"'", '"'}:
                if quote is None:
                    quote = ch
                elif quote == ch:
                    quote = None
                continue
            if quote is not None:
                continue
            if ch == "(":
                depth += 1
                continue
            if ch == ")":
                depth = max(0, depth - 1)
                continue
            if ch == operator and depth == 0:
                count += 1
        return count

    def _parse_metadata_dict(self, metadata_block: str) -> dict[str, Any]:
        parsed: dict[str, Any] = {}
        for raw_item in self._split_top_level(metadata_block, ","):
            item = raw_item.strip()
            if not item:
                continue
            separator = ":" if ":" in item else ("=" if "=" in item else None)
            if separator is None:
                continue
            key, value = item.split(separator, 1)
            key_text = key.strip()
            value_text = value.strip()
            if key_text:
                parsed[key_text] = value_text
        return parsed

    def _parse_atom_with_metadata(self, token: str) -> tuple[str, dict[str, Any]]:
        stripped = token.strip()
        if not stripped:
            return "", {}
        if not self._is_balanced_parentheses(stripped):
            return stripped, {}
        match = re.match(r"^(?P<value>.*?)\s*\((?P<meta>.*)\)\s*$", stripped)
        if not match:
            return stripped, {}
        value = match.group("value").strip()
        metadata = self._parse_metadata_dict(match.group("meta"))
        return (value if value else stripped), metadata

    def _coerce_assign_value(self, node: AstNode) -> Any | PlanIssue:
        if isinstance(node, LiteralNode):
            return node.value
        if isinstance(node, EntityNode):
            return {"entity": node.name}
        if isinstance(node, GroupNode):
            values: list[Any] = []
            for item in node.items:
                coerced = self._coerce_assign_value(item)
                if isinstance(coerced, PlanIssue):
                    return coerced
                values.append(coerced)
            return values
        return PlanIssue(code="PLAN_INVALID_ASSIGN_VALUE", message="Unsupported assignment value node")

    def _flatten_relation_chain(self, node: AstNode) -> list[AstNode]:
        if isinstance(node, RelationLinkNode):
            return [*self._flatten_relation_chain(node.left), *self._flatten_relation_chain(node.right)]
        return [node]

    def _flatten_type_chain(self, node: AstNode) -> list[AstNode]:
        if isinstance(node, TypeLinkNode):
            return [*self._flatten_type_chain(node.left), *self._flatten_type_chain(node.right)]
        return [node]
