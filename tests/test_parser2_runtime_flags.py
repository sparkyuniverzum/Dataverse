import sys
from pathlib import Path

sys.path.append(str(Path(__file__).resolve().parents[1]))

from app.core.parser2.runtime_flags import (
    parser_v2_fallback_policy_mode,
    parser_v2_fallback_to_v1_enabled,
)


def test_parser_v2_fallback_policy_defaults_to_disabled() -> None:
    assert parser_v2_fallback_policy_mode({}) == "disabled"
    assert parser_v2_fallback_to_v1_enabled({}) is False


def test_parser_v2_fallback_policy_uses_explicit_mode_when_valid() -> None:
    assert parser_v2_fallback_policy_mode({"DATAVERSE_PARSER_V2_FALLBACK_POLICY": "disabled"}) == "disabled"
    assert parser_v2_fallback_policy_mode({"DATAVERSE_PARSER_V2_FALLBACK_POLICY": "auto_unpinned"}) == "auto_unpinned"
    assert parser_v2_fallback_policy_mode({"DATAVERSE_PARSER_V2_FALLBACK_POLICY": "always"}) == "always"
    assert parser_v2_fallback_to_v1_enabled({"DATAVERSE_PARSER_V2_FALLBACK_POLICY": "always"}) is True


def test_parser_v2_fallback_policy_rejects_unknown_mode_to_disabled() -> None:
    assert parser_v2_fallback_policy_mode({"DATAVERSE_PARSER_V2_FALLBACK_POLICY": "typo"}) == "disabled"
    assert parser_v2_fallback_to_v1_enabled({"DATAVERSE_PARSER_V2_FALLBACK_POLICY": "typo"}) is False


def test_parser_v2_fallback_policy_keeps_legacy_env_backward_compatibility() -> None:
    assert parser_v2_fallback_policy_mode({"DATAVERSE_PARSER_V2_FALLBACK_TO_V1": "true"}) == "auto_unpinned"
    assert parser_v2_fallback_to_v1_enabled({"DATAVERSE_PARSER_V2_FALLBACK_TO_V1": "true"}) is True
    assert parser_v2_fallback_policy_mode({"DATAVERSE_PARSER_V2_FALLBACK_TO_V1": "0"}) == "disabled"
    assert parser_v2_fallback_to_v1_enabled({"DATAVERSE_PARSER_V2_FALLBACK_TO_V1": "0"}) is False
