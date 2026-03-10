from __future__ import annotations

import logging
import os

logger = logging.getLogger(__name__)


def _env_enabled(name: str, *, default: bool = False) -> bool:
    raw = str(os.getenv(name, "1" if default else "0")).strip().lower()
    return raw not in {"0", "false", "off", "no"}


def configure_open_telemetry(*, service_name: str = "dataverse-api") -> bool:
    if not _env_enabled("DATAVERSE_OTEL_ENABLED", default=False):
        return False
    try:
        from opentelemetry import trace as otel_trace  # type: ignore[import-not-found]
        from opentelemetry.sdk.resources import Resource  # type: ignore[import-not-found]
        from opentelemetry.sdk.trace import TracerProvider  # type: ignore[import-not-found]
    except Exception:
        logger.info("OpenTelemetry disabled: sdk/api not installed.")
        return False

    provider = otel_trace.get_tracer_provider()
    if bool(getattr(provider, "_dataverse_otel_configured", False)):
        return True

    tracer_provider = TracerProvider(resource=Resource.create({"service.name": service_name}))
    otel_trace.set_tracer_provider(tracer_provider)
    tracer_provider._dataverse_otel_configured = True  # type: ignore[attr-defined]
    logger.info("OpenTelemetry tracer provider configured.")
    return True
