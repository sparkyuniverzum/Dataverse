from __future__ import annotations

from app.telemetry import configure_open_telemetry


def test_configure_open_telemetry_disabled_by_default(monkeypatch) -> None:
    monkeypatch.setenv("DATAVERSE_OTEL_ENABLED", "0")
    assert configure_open_telemetry(service_name="dataverse-test") is False
