from __future__ import annotations

import os
from collections.abc import Mapping
from typing import Literal

_TRUTHY = {"1", "true", "yes", "on"}
_POLICY_MODES = {"disabled", "auto_unpinned", "always"}

ParserV2FallbackPolicyMode = Literal["disabled", "auto_unpinned", "always"]


def parser_v2_fallback_policy_mode(env: Mapping[str, str] | None = None) -> ParserV2FallbackPolicyMode:
    source = env or os.environ
    policy_raw = str(source.get("DATAVERSE_PARSER_V2_FALLBACK_POLICY", "")).strip().lower()
    if policy_raw in _POLICY_MODES:
        return policy_raw  # type: ignore[return-value]
    if policy_raw:
        # Unknown explicit policy is treated as disabled to avoid accidental fallback activation via typo.
        return "disabled"

    raw = str(source.get("DATAVERSE_PARSER_V2_FALLBACK_TO_V1", "false")).strip().lower()
    if raw in _TRUTHY:
        # Legacy true behavior maps to auto fallback only when parser_version was not explicitly pinned.
        return "auto_unpinned"
    # Legacy false/unknown behavior stays disabled.
    return "disabled"


def parser_v2_fallback_to_v1_enabled(env: Mapping[str, str] | None = None) -> bool:
    return parser_v2_fallback_policy_mode(env) != "disabled"
