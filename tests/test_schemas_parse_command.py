from pathlib import Path
import sys

import pytest
from pydantic import ValidationError

sys.path.append(str(Path(__file__).resolve().parents[1]))

from app.schemas import ParseCommandRequest


def test_parse_command_request_defaults_to_parser_v2() -> None:
    payload = ParseCommandRequest(query="A + B")
    assert payload.parser_version == "v2"


def test_parse_command_request_accepts_and_normalizes_v2() -> None:
    payload = ParseCommandRequest(query="A + B", parser_version="V2")
    assert payload.parser_version == "v2"


def test_parse_command_request_rejects_unknown_parser_version() -> None:
    with pytest.raises(ValidationError):
        ParseCommandRequest(query="A + B", parser_version="legacy")
