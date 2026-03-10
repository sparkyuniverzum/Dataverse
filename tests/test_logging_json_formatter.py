from __future__ import annotations

import json
import logging

from app.logging_config import DataverseJsonFormatter


def test_json_formatter_emits_required_fields_with_fallbacks() -> None:
    formatter = DataverseJsonFormatter()
    record = logging.LogRecord(
        name="app.test.logger",
        level=logging.INFO,
        pathname=__file__,
        lineno=10,
        msg="hello",
        args=(),
        exc_info=None,
    )

    payload = json.loads(formatter.format(record))

    assert payload["message"] == "hello"
    assert payload["event_name"] == "log.event"
    assert payload["trace_id"] == "n/a"
    assert payload["correlation_id"] == "n/a"
    assert isinstance(payload["module"], str)
    assert payload["module"] != ""


def test_json_formatter_emits_structured_extra_fields() -> None:
    formatter = DataverseJsonFormatter()
    record = logging.LogRecord(
        name="app.test.logger",
        level=logging.INFO,
        pathname=__file__,
        lineno=20,
        msg="outbox done",
        args=(),
        exc_info=None,
    )
    record.event_name = "outbox.run_once.completed"
    record.trace_id = "trace-123"
    record.correlation_id = "corr-456"
    record.module_name = "outbox.runner"
    record.published = 2
    record.failed = 1

    payload = json.loads(formatter.format(record))

    assert payload["event_name"] == "outbox.run_once.completed"
    assert payload["trace_id"] == "trace-123"
    assert payload["correlation_id"] == "corr-456"
    assert payload["module"] == "outbox.runner"
    assert payload["published"] == 2
    assert payload["failed"] == 1
