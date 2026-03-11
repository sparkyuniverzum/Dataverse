from __future__ import annotations

import re
from typing import Any

from app.services.parser_types import AtomicTask, ParseResult


class ParserService:
    _atom_with_metadata_re = re.compile(r"^(?P<value>.*?)\s*\((?P<meta>.*)\)\s*$")
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

    def __init__(self) -> None:
        self.intent_map = {
            "ukaz": "SELECT",
            "ukaž": "SELECT",
            "najdi": "SELECT",
            "show": "SELECT",
            "find": "SELECT",
            "smaz": "EXTINGUISH",
            "smaž": "EXTINGUISH",
            "zhasni": "EXTINGUISH",
            "delete": "EXTINGUISH",
        }
        self.relation_operators = {"+": "RELATION", ":": "TYPE"}
        self.requires_colon_verbs = {
            "ukaz",
            "ukaž",
            "najdi",
            "show",
            "find",
            "smaz",
            "smaž",
            "zhasni",
            "delete",
            "hlidej",
            "hlídej",
            "spocitej",
            "spočítej",
            "vypocitej",
            "vypočítej",
            "spoj",
        }

    @staticmethod
    def _coerce_scalar(value: str) -> Any:
        candidate = value.strip()
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

    def _detect_missing_colon_for_known_verb(self, normalized: str) -> str | None:
        if ":" in normalized:
            return None
        parts = normalized.split(maxsplit=1)
        if not parts:
            return None
        first_word = parts[0].strip().lower()
        if first_word in self.requires_colon_verbs:
            return f"Missing ':' after command verb '{first_word}'."
        return None

    def _parse_metadata_dict(self, metadata_block: str) -> dict[str, str]:
        parsed: dict[str, str] = {}
        for raw_item in self._split_top_level(metadata_block, ","):
            item = raw_item.strip()
            if not item:
                continue

            separator = ":" if ":" in item else ("=" if "=" in item else None)
            if separator is None:
                continue

            key, value = item.split(separator, 1)
            key = key.strip()
            value = value.strip()
            if key:
                parsed[key] = value
        return parsed

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

    def _parse_atom_token(self, token: str) -> tuple[str, dict[str, str]]:
        stripped = token.strip()
        if not stripped:
            return "", {}
        if not self._is_balanced_parentheses(stripped):
            return stripped, {}

        match = self._atom_with_metadata_re.match(stripped)
        if not match:
            return stripped, {}

        value = match.group("value").strip()
        metadata = self._parse_metadata_dict(match.group("meta"))
        return (value if value else stripped), metadata

    def _build_link_tasks(
        self,
        parsed_parts: list[tuple[str, dict[str, str]]],
        *,
        relation_type: str,
    ) -> list[AtomicTask]:
        tasks: list[AtomicTask] = []
        for value, metadata in parsed_parts:
            tasks.append(AtomicTask(action="INGEST", params={"value": value, "metadata": metadata}))

        for index in range(len(parsed_parts) - 1):
            source_metadata = parsed_parts[index][1]
            target_metadata = parsed_parts[index + 1][1]
            link_params: dict[str, Any] = {"type": relation_type}
            if source_metadata or target_metadata:
                link_params["metadata"] = {
                    "source_civilization": source_metadata,
                    "target_civilization": target_metadata,
                }
            tasks.append(AtomicTask(action="LINK", params=link_params))
        return tasks

    def _parse_delete(self, normalized: str) -> list[AtomicTask] | None:
        delete_match = self._delete_command_re.match(normalized)
        if not delete_match:
            return None
        target = delete_match.group("target").strip()
        if not target:
            return []
        return [AtomicTask(action="DELETE", params={"target": target})]

    def _parse_guardian(self, normalized: str) -> list[AtomicTask] | None:
        guardian_match = self._guardian_command_re.match(normalized)
        if not guardian_match:
            return None

        target = guardian_match.group("target").strip()
        field = guardian_match.group("field").strip()
        operator = guardian_match.group("operator").strip()
        threshold = self._coerce_scalar(guardian_match.group("threshold"))
        action = guardian_match.group("action").strip()

        if not (target and field and operator and action):
            return []
        return [
            AtomicTask(
                action="ADD_GUARDIAN",
                params={
                    "target": target,
                    "field": field,
                    "operator": operator,
                    "threshold": threshold,
                    "action": action,
                },
            )
        ]

    def _parse_formula(self, normalized: str) -> list[AtomicTask] | None:
        formula_match = self._set_formula_re.match(normalized)
        if not formula_match:
            return None

        target = formula_match.group("target").strip()
        field = formula_match.group("field").strip()
        func = formula_match.group("func").strip().upper()
        source_attr = formula_match.group("source_attr").strip()

        if not (target and field and source_attr):
            return []
        return [
            AtomicTask(
                action="SET_FORMULA",
                params={
                    "target": target,
                    "field": field,
                    "formula": f"={func}({source_attr})",
                },
            )
        ]

    def _parse_triple_shot(self, normalized: str) -> list[AtomicTask] | None:
        triple_shot_match = self._triple_shot_re.match(normalized)
        if not triple_shot_match:
            return None

        verb = triple_shot_match.group("verb").strip().lower()
        action = self.intent_map.get(verb)
        if action is None:
            return None

        target = triple_shot_match.group("target").strip()
        condition_raw = triple_shot_match.group("condition")
        condition = condition_raw.strip() if condition_raw else None
        if not target:
            return []

        return [AtomicTask(action=action, params={"target_civilization": target, "condition": condition})]

    def _parse_spoj(self, normalized: str) -> list[AtomicTask] | None:
        lower = normalized.lower()
        if not lower.startswith("spoj"):
            return None

        match = re.match(r"^spoj\s*:\s*(?P<body>.+)$", normalized, re.IGNORECASE)
        if not match:
            return []

        body = match.group("body").strip()
        if not body:
            return []

        comma_parts = self._split_top_level(body, ",")
        plus_parts = self._split_top_level(body, "+")

        raw_parts: list[str]
        if len(comma_parts) >= 2:
            raw_parts = comma_parts
        elif len(plus_parts) >= 2:
            raw_parts = plus_parts
        else:
            return []

        if any(not item.strip() for item in raw_parts):
            return []

        parsed_parts = [self._parse_atom_token(part) for part in raw_parts]
        parsed_parts = [(value, metadata) for value, metadata in parsed_parts if value]
        if len(parsed_parts) < 2:
            return []

        return self._build_link_tasks(parsed_parts, relation_type="RELATION")

    def _parse_binary_chain_result(self, normalized: str, operator: str) -> ParseResult:
        parts = self._split_top_level(normalized, operator)
        if len(parts) < 2:
            return ParseResult(tasks=[], errors=[f"Invalid expression: missing '{operator}' operands."])
        if any(not part.strip() for part in parts):
            return ParseResult(tasks=[], errors=[f"Invalid expression: empty operand around '{operator}'."])

        parsed_parts = [self._parse_atom_token(part) for part in parts]
        parsed_parts = [(value, metadata) for value, metadata in parsed_parts if value]

        if len(parsed_parts) < 2:
            return ParseResult(
                tasks=[], errors=[f"Invalid expression: expected at least two operands for '{operator}'."]
            )
        relation_type = self.relation_operators[operator]
        return ParseResult(tasks=self._build_link_tasks(parsed_parts, relation_type=relation_type), errors=[])

    def parse_with_diagnostics(self, text: str) -> ParseResult:
        normalized = text.strip()
        if not normalized:
            return ParseResult(tasks=[], errors=["Command is empty."])
        if not self._is_balanced_parentheses(normalized):
            return ParseResult(tasks=[], errors=["Unbalanced parentheses in command."])

        missing_colon_error = self._detect_missing_colon_for_known_verb(normalized)
        if missing_colon_error is not None:
            return ParseResult(tasks=[], errors=[missing_colon_error])

        for strategy in (
            self._parse_delete,
            self._parse_guardian,
            self._parse_formula,
            self._parse_spoj,
            self._parse_triple_shot,
        ):
            parsed = strategy(normalized)
            if parsed is not None:
                if parsed:
                    return ParseResult(tasks=parsed, errors=[])
                return ParseResult(tasks=[], errors=["Invalid command syntax."])

        has_plus = self._count_top_level_operator(normalized, "+") > 0
        has_colon = self._count_top_level_operator(normalized, ":") > 0
        if has_plus and has_colon:
            return ParseResult(
                tasks=[],
                errors=["Mixed operators '+' and ':' in one command are not supported."],
            )

        if has_plus:
            return self._parse_binary_chain_result(normalized, "+")

        if has_colon:
            return self._parse_binary_chain_result(normalized, ":")

        value, metadata = self._parse_atom_token(normalized)
        if not value:
            return ParseResult(tasks=[], errors=["Missing civilization value."])
        return ParseResult(
            tasks=[AtomicTask(action="INGEST", params={"value": value, "metadata": metadata})],
            errors=[],
        )

    def parse(self, text: str) -> list[AtomicTask]:
        return self.parse_with_diagnostics(text).tasks
