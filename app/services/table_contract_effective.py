from __future__ import annotations

from dataclasses import dataclass
from datetime import datetime
from typing import Any
from uuid import UUID

from app.models import MoonCapability, TableContract


@dataclass(frozen=True)
class EffectiveTableContract:
    id: UUID
    galaxy_id: UUID
    table_id: UUID
    version: int
    required_fields: list[str]
    field_types: dict[str, str]
    unique_rules: list[dict[str, Any]]
    validators: list[dict[str, Any]]
    formula_registry: list[dict[str, Any]]
    physics_rulebook: dict[str, Any]
    created_by: UUID
    created_at: datetime
    updated_at: datetime
    deleted_at: datetime | None
    required_field_sources: dict[str, dict[str, Any]]
    field_type_sources: dict[str, dict[str, Any]]
    validator_sources: list[dict[str, Any]]
    unique_rule_sources: list[dict[str, Any]]


def _normalize_string_list(values: list[Any]) -> list[str]:
    normalized: list[str] = []
    seen: set[str] = set()
    for raw in values:
        value = str(raw or "").strip()
        if not value or value in seen:
            continue
        seen.add(value)
        normalized.append(value)
    return normalized


def _normalize_field_types(values: dict[str, Any]) -> dict[str, str]:
    normalized: dict[str, str] = {}
    for raw_key, raw_value in values.items():
        key = str(raw_key or "").strip()
        value = str(raw_value or "").strip().lower()
        if not key or not value:
            continue
        normalized[key] = value
    return normalized


def _normalize_dict_list(values: list[Any]) -> list[dict[str, Any]]:
    return [dict(item) for item in values if isinstance(item, dict)]


def _merge_dict_list(base: list[dict[str, Any]], extra: list[dict[str, Any]]) -> list[dict[str, Any]]:
    if not extra:
        return base
    existing = {repr(item) for item in base}
    merged = list(base)
    for item in extra:
        marker = repr(item)
        if marker in existing:
            continue
        existing.add(marker)
        merged.append(item)
    return merged


def _merge_rule_list_with_sources(
    *,
    base_rules: list[dict[str, Any]],
    base_sources: list[dict[str, Any]],
    extra_rules: list[dict[str, Any]],
    source: dict[str, Any],
) -> tuple[list[dict[str, Any]], list[dict[str, Any]]]:
    merged_rules = list(base_rules)
    merged_sources = list(base_sources)
    existing = {repr(item): idx for idx, item in enumerate(merged_rules)}
    for item in extra_rules:
        marker = repr(item)
        if marker in existing:
            continue
        existing[marker] = len(merged_rules)
        merged_rules.append(item)
        merged_sources.append(dict(source))
    return merged_rules, merged_sources


def _normalize_physics_rulebook(physics_rulebook: Any) -> dict[str, Any]:
    source = physics_rulebook if isinstance(physics_rulebook, dict) else {}
    rules = _normalize_dict_list(source.get("rules") if isinstance(source.get("rules"), list) else [])
    defaults = source.get("defaults") if isinstance(source.get("defaults"), dict) else {}

    auto_semantics = defaults.get("auto_semantics") if isinstance(defaults, dict) else []
    normalized_defaults = dict(defaults)
    normalized_defaults["auto_semantics"] = _normalize_dict_list(
        auto_semantics if isinstance(auto_semantics, list) else []
    )
    return {
        "rules": rules,
        "defaults": normalized_defaults,
    }


def _sorted_active_capabilities(capabilities: list[MoonCapability]) -> list[MoonCapability]:
    return sorted(
        [
            item
            for item in capabilities
            if item.deleted_at is None and str(item.status or "").strip().lower() == "active"
        ],
        key=lambda item: (
            int(item.order_index),
            str(item.capability_key or "").lower(),
            int(item.version),
            item.created_at,
            item.id,
        ),
    )


def compile_effective_table_contract(
    *,
    base_contract: TableContract,
    capabilities: list[MoonCapability],
) -> EffectiveTableContract:
    required_fields = _normalize_string_list(
        base_contract.required_fields if isinstance(base_contract.required_fields, list) else []
    )
    required_field_sources: dict[str, dict[str, Any]] = {
        field: {"source": "base_contract", "capability_key": None, "capability_id": None}
        for field in required_fields
    }
    field_types = _normalize_field_types(
        base_contract.field_types if isinstance(base_contract.field_types, dict) else {}
    )
    field_type_sources: dict[str, dict[str, Any]] = {
        key: {"source": "base_contract", "capability_key": None, "capability_id": None}
        for key in field_types
    }
    unique_rules = _normalize_dict_list(
        base_contract.unique_rules if isinstance(base_contract.unique_rules, list) else []
    )
    unique_rule_sources: list[dict[str, Any]] = [
        {"source": "base_contract", "capability_key": None, "capability_id": None} for _ in unique_rules
    ]
    validators = _normalize_dict_list(base_contract.validators if isinstance(base_contract.validators, list) else [])
    validator_sources: list[dict[str, Any]] = [
        {"source": "base_contract", "capability_key": None, "capability_id": None} for _ in validators
    ]
    formula_registry = _normalize_dict_list(
        base_contract.formula_registry if isinstance(base_contract.formula_registry, list) else []
    )
    physics_rulebook = _normalize_physics_rulebook(base_contract.physics_rulebook)

    for capability in _sorted_active_capabilities(capabilities):
        config = capability.config_json if isinstance(capability.config_json, dict) else {}
        source = {
            "source": "moon_capability",
            "capability_key": str(capability.capability_key),
            "capability_id": str(capability.id),
        }

        raw_required = [str(item) for item in list(config.get("required_fields") or [])]
        for field in _normalize_string_list(raw_required):
            if field not in required_field_sources:
                required_field_sources[field] = dict(source)
            required_fields = _normalize_string_list(required_fields + [field])

        capability_field_types = _normalize_field_types(config.get("field_types") or {})
        for key, value in capability_field_types.items():
            field_types[key] = value
            field_type_sources[key] = dict(source)

        unique_rules, unique_rule_sources = _merge_rule_list_with_sources(
            base_rules=unique_rules,
            base_sources=unique_rule_sources,
            extra_rules=_normalize_dict_list(config.get("unique_rules") or []),
            source=source,
        )
        validators, validator_sources = _merge_rule_list_with_sources(
            base_rules=validators,
            base_sources=validator_sources,
            extra_rules=_normalize_dict_list(config.get("validators") or []),
            source=source,
        )
        formula_registry = _merge_dict_list(
            formula_registry,
            _normalize_dict_list(config.get("formula_registry") or []),
        )

        physics_patch = _normalize_physics_rulebook(config.get("physics_rulebook") or {})
        physics_rulebook["rules"] = _merge_dict_list(
            _normalize_dict_list(physics_rulebook.get("rules") or []),
            _normalize_dict_list(physics_patch.get("rules") or []),
        )

        defaults_base = physics_rulebook.get("defaults") if isinstance(physics_rulebook.get("defaults"), dict) else {}
        defaults_patch = physics_patch.get("defaults") if isinstance(physics_patch.get("defaults"), dict) else {}
        merged_defaults = dict(defaults_base)
        for key, value in defaults_patch.items():
            if key == "auto_semantics":
                continue
            merged_defaults[key] = value
        merged_defaults["auto_semantics"] = _merge_dict_list(
            _normalize_dict_list(defaults_base.get("auto_semantics") if isinstance(defaults_base, dict) else []),
            _normalize_dict_list(defaults_patch.get("auto_semantics") if isinstance(defaults_patch, dict) else []),
        )
        physics_rulebook["defaults"] = merged_defaults

    return EffectiveTableContract(
        id=base_contract.id,
        galaxy_id=base_contract.galaxy_id,
        table_id=base_contract.table_id,
        version=int(base_contract.version),
        required_fields=required_fields,
        field_types=field_types,
        unique_rules=unique_rules,
        validators=validators,
        formula_registry=formula_registry,
        physics_rulebook=physics_rulebook,
        created_by=base_contract.created_by,
        created_at=base_contract.created_at,
        updated_at=base_contract.updated_at,
        deleted_at=base_contract.deleted_at,
        required_field_sources=required_field_sources,
        field_type_sources=field_type_sources,
        validator_sources=validator_sources,
        unique_rule_sources=unique_rule_sources,
    )
