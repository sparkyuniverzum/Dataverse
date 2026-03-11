from __future__ import annotations

import json
import logging
from datetime import UTC, datetime
from typing import Any

from app.infrastructure.runtime.observability.trace_context import current_trace_context

REQUIRED_STRUCTURED_FIELDS = ("event_name", "trace_id", "correlation_id", "module")


class DataverseJsonFormatter(logging.Formatter):
    _RESERVED_KEYS = {
        "name",
        "msg",
        "args",
        "levelname",
        "levelno",
        "pathname",
        "filename",
        "module",
        "exc_info",
        "exc_text",
        "stack_info",
        "lineno",
        "funcName",
        "created",
        "msecs",
        "relativeCreated",
        "thread",
        "threadName",
        "processName",
        "process",
        "message",
        "asctime",
    }

    def format(self, record: logging.LogRecord) -> str:
        context_trace_id, context_correlation_id = current_trace_context()
        payload: dict[str, Any] = {
            "timestamp": datetime.now(UTC).isoformat(),
            "level": str(record.levelname or "INFO"),
            "message": record.getMessage(),
            "logger": str(record.name or "root"),
            "event_name": str(getattr(record, "event_name", "") or "log.event"),
            "trace_id": str(getattr(record, "trace_id", "") or context_trace_id or "n/a"),
            "correlation_id": str(getattr(record, "correlation_id", "") or context_correlation_id or "n/a"),
            "module": str(getattr(record, "module_name", "") or getattr(record, "module", "") or record.name),
        }

        for key, value in record.__dict__.items():
            if key in self._RESERVED_KEYS or key in payload:
                continue
            payload[key] = value

        if record.exc_info:
            payload["exception"] = self.formatException(record.exc_info)
        return json.dumps(payload, ensure_ascii=False, separators=(",", ":"), sort_keys=True)


def configure_json_logging(*, level: int = logging.INFO) -> None:
    root_logger = logging.getLogger()
    for handler in root_logger.handlers:
        if isinstance(getattr(handler, "formatter", None), DataverseJsonFormatter):
            root_logger.setLevel(level)
            return

    handler = logging.StreamHandler()
    handler.setFormatter(DataverseJsonFormatter())
    root_logger.handlers = [handler]
    root_logger.setLevel(level)
