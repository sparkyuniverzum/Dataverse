from pathlib import Path
import sys

sys.path.append(str(Path(__file__).resolve().parents[1]))

from app.db import resolve_database_url


def test_resolve_database_url_prefers_explicit_database_url(monkeypatch) -> None:
    monkeypatch.setenv("DATABASE_URL", "postgresql+asyncpg://custom:pw@db:5432/customdb")
    monkeypatch.setenv("POSTGRES_USER", "ignored")
    monkeypatch.setenv("POSTGRES_PASSWORD", "ignored")
    monkeypatch.setenv("POSTGRES_DB", "ignored")

    assert resolve_database_url() == "postgresql+asyncpg://custom:pw@db:5432/customdb"


def test_resolve_database_url_builds_from_postgres_env(monkeypatch) -> None:
    monkeypatch.delenv("DATABASE_URL", raising=False)
    monkeypatch.setenv("POSTGRES_USER", "dev_user")
    monkeypatch.setenv("POSTGRES_PASSWORD", "p@ss word")
    monkeypatch.setenv("POSTGRES_DB", "dataverse_dev")
    monkeypatch.setenv("POSTGRES_HOST", "127.0.0.1")
    monkeypatch.setenv("POSTGRES_PORT", "5544")

    assert (
        resolve_database_url()
        == "postgresql+asyncpg://dev_user:p%40ss+word@127.0.0.1:5544/dataverse_dev"
    )


def test_resolve_database_url_falls_back_to_default(monkeypatch) -> None:
    monkeypatch.delenv("DATABASE_URL", raising=False)
    monkeypatch.delenv("POSTGRES_USER", raising=False)
    monkeypatch.delenv("POSTGRES_PASSWORD", raising=False)
    monkeypatch.delenv("POSTGRES_DB", raising=False)
    monkeypatch.delenv("POSTGRES_HOST", raising=False)
    monkeypatch.delenv("POSTGRES_PORT", raising=False)

    assert resolve_database_url() == "postgresql+asyncpg://postgres:postgres@localhost:5432/dataverse"
