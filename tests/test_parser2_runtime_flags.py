import sys
from pathlib import Path

sys.path.append(str(Path(__file__).resolve().parents[1]))

from app.services.parser2.runtime_flags import parser_v2_fallback_to_v1_enabled


def test_parser_v2_fallback_flag_defaults_to_disabled() -> None:
    assert parser_v2_fallback_to_v1_enabled({}) is False


def test_parser_v2_fallback_flag_can_be_disabled() -> None:
    assert parser_v2_fallback_to_v1_enabled({"DATAVERSE_PARSER_V2_FALLBACK_TO_V1": "false"}) is False
    assert parser_v2_fallback_to_v1_enabled({"DATAVERSE_PARSER_V2_FALLBACK_TO_V1": "0"}) is False
    assert parser_v2_fallback_to_v1_enabled({"DATAVERSE_PARSER_V2_FALLBACK_TO_V1": "off"}) is False


def test_parser_v2_fallback_flag_accepts_truthy_values() -> None:
    assert parser_v2_fallback_to_v1_enabled({"DATAVERSE_PARSER_V2_FALLBACK_TO_V1": "true"}) is True
    assert parser_v2_fallback_to_v1_enabled({"DATAVERSE_PARSER_V2_FALLBACK_TO_V1": "1"}) is True
    assert parser_v2_fallback_to_v1_enabled({"DATAVERSE_PARSER_V2_FALLBACK_TO_V1": "yes"}) is True
