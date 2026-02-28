import re
from dataclasses import dataclass
from typing import Any


@dataclass(frozen=True)
class AtomicTask:
    action: str  # INGEST, LINK, SELECT, EXTINGUISH
    params: dict[str, Any]


class ParserService:
    _atom_with_metadata_re = re.compile(r"^(?P<value>.*?)\s*\((?P<meta>[^()]*)\)\s*$")
    _delete_command_re = re.compile(r"^(zhasni|smaz|smaž|delete)\s*:\s*(?P<target>.+)$", re.IGNORECASE)
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

    def __init__(self) -> None:
        self.intent_map = {
            "ukaz": "SELECT",
            "ukaž": "SELECT",
            "najdi": "SELECT",
            "smaz": "EXTINGUISH",
            "smaž": "EXTINGUISH",
            "zhasni": "EXTINGUISH",
            "spoj": "LINK",
        }
        self.operators = {
            "+": "LINK_RELATION",
            ":": "LINK_TYPE",
        }

    @staticmethod
    def _coerce_scalar(value: str) -> Any:
        candidate = value.strip()
        if not candidate:
            return ""
        normalized = candidate.replace("\u00A0", "").replace(" ", "").replace(",", ".")
        try:
            float_value = float(normalized)
        except ValueError:
            return candidate
        if float_value.is_integer():
            return int(float_value)
        return float_value

    def _parse_metadata_dict(self, metadata_block: str) -> dict[str, str]:
        parsed: dict[str, str] = {}
        for raw_item in metadata_block.split(","):
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

    def _parse_atom_token(self, token: str) -> tuple[str, dict[str, str]]:
        stripped = token.strip()
        if not stripped:
            return "", {}

        match = self._atom_with_metadata_re.match(stripped)
        if not match:
            return stripped, {}

        value = match.group("value").strip()
        metadata = self._parse_metadata_dict(match.group("meta"))
        return (value if value else stripped), metadata

    def _split_top_level(self, text: str, delimiter: str) -> list[str]:
        parts: list[str] = []
        current: list[str] = []
        depth = 0

        for ch in text:
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

    def parse(self, text: str) -> list[AtomicTask]:
        normalized = text.strip()
        if not normalized:
            return []

        instructions: list[AtomicTask] = []

        delete_match = self._delete_command_re.match(normalized)
        if delete_match:
            target = delete_match.group("target").strip()
            if target:
                return [AtomicTask(action="DELETE", params={"target": target})]
            return []

        guardian_match = self._guardian_command_re.match(normalized)
        if guardian_match:
            target = guardian_match.group("target").strip()
            field = guardian_match.group("field").strip()
            operator = guardian_match.group("operator").strip()
            threshold = self._coerce_scalar(guardian_match.group("threshold"))
            action = guardian_match.group("action").strip()
            if target and field and operator and action:
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
            return []

        formula_match = self._set_formula_re.match(normalized)
        if formula_match:
            target = formula_match.group("target").strip()
            field = formula_match.group("field").strip()
            func = formula_match.group("func").strip().upper()
            source_attr = formula_match.group("source_attr").strip()
            if target and field and source_attr:
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
            return []

        triple_shot_match = re.match(r"^(\w+)\s*:\s*([^@]+?)(?:\s*@\s*(.*))?$", normalized)
        if triple_shot_match and triple_shot_match.group(1).lower() in self.intent_map:
            action_word = triple_shot_match.group(1).lower()
            target = triple_shot_match.group(2).strip()
            condition = triple_shot_match.group(3)

            action = self.intent_map.get(action_word, "SELECT")
            instructions.append(
                AtomicTask(
                    action=action,
                    params={
                        "target_asteroid": target,
                        "condition": condition.strip() if condition else None,
                    },
                )
            )
            return instructions

        plus_parts = self._split_top_level(normalized, "+")
        if len(plus_parts) >= 2:
            parsed_parts = [self._parse_atom_token(part) for part in plus_parts]
            parsed_parts = [(value, metadata) for value, metadata in parsed_parts if value]

            for value, metadata in parsed_parts:
                instructions.append(AtomicTask(action="INGEST", params={"value": value, "metadata": metadata}))

            if len(parsed_parts) >= 2:
                source_metadata = parsed_parts[-2][1]
                target_metadata = parsed_parts[-1][1]
                link_params = {"type": "RELATION"}
                if source_metadata or target_metadata:
                    link_params["metadata"] = {
                        "source_asteroid": source_metadata,
                        "target_asteroid": target_metadata,
                    }
                instructions.append(AtomicTask(action="LINK", params=link_params))
            return instructions

        colon_parts = self._split_top_level(normalized, ":")
        if len(colon_parts) >= 2:
            left_raw = colon_parts[0]
            right_raw = ":".join(colon_parts[1:])
            left_value, left_metadata = self._parse_atom_token(left_raw)
            right_value, right_metadata = self._parse_atom_token(right_raw)

            instructions.append(
                AtomicTask(action="INGEST", params={"value": left_value, "metadata": left_metadata})
            )
            instructions.append(
                AtomicTask(action="INGEST", params={"value": right_value, "metadata": right_metadata})
            )

            link_params = {"type": "TYPE"}
            if left_metadata or right_metadata:
                link_params["metadata"] = {
                    "source_asteroid": left_metadata,
                    "target_asteroid": right_metadata,
                }
            instructions.append(AtomicTask(action="LINK", params=link_params))
            return instructions

        value, metadata = self._parse_atom_token(normalized)
        instructions.append(AtomicTask(action="INGEST", params={"value": value, "metadata": metadata}))
        return instructions
