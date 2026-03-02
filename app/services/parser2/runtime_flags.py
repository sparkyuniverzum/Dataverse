from __future__ import annotations

import os
from collections.abc import Mapping


_TRUTHY = {"1", "true", "yes", "on"}
_FALSY = {"0", "false", "no", "off"}


def parser_v2_fallback_to_v1_enabled(env: Mapping[str, str] | None = None) -> bool:
    source = env or os.environ
    raw = str(source.get("DATAVERSE_PARSER_V2_FALLBACK_TO_V1", "false")).strip().lower()
    if raw in _FALSY:
        return False
    if raw in _TRUTHY:
        return True
    return True
