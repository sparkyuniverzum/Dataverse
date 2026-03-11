from __future__ import annotations

from collections.abc import Mapping
from contextlib import nullcontext
from typing import Any


def start_span(name: str, *, attributes: Mapping[str, Any] | None = None):
    try:
        from opentelemetry import trace as otel_trace  # type: ignore[import-not-found]

        tracer = otel_trace.get_tracer("dataverse.runtime")
        context = tracer.start_as_current_span(str(name))

        class _SpanContextManager:
            def __enter__(self):
                span = context.__enter__()
                if span is not None and attributes:
                    try:
                        for key, value in attributes.items():
                            span.set_attribute(str(key), value)
                    except Exception:
                        pass
                return span

            def __exit__(self, exc_type, exc, tb):
                return context.__exit__(exc_type, exc, tb)

        return _SpanContextManager()
    except Exception:
        return nullcontext()
