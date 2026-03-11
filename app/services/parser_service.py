"""Compatibility shim for parser services.

Canonical shared task/result types live in `app.services.parser_types`.
Legacy parser implementation lives in `app.infrastructure.runtime.parser.parser_legacy_service`.
"""

from app.infrastructure.runtime.parser.parser_legacy_service import ParserService
from app.services.parser_types import AtomicTask, ParseResult

__all__ = ["AtomicTask", "ParseResult", "ParserService"]
