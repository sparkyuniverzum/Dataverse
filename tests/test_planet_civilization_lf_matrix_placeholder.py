from __future__ import annotations

import os
import uuid

import httpx
import pytest

API_BASE_URL = os.getenv("DATAVERSE_API_BASE", "http://127.0.0.1:8000")


@pytest.fixture(scope="session")
def client() -> httpx.Client:
    client = httpx.Client(base_url=API_BASE_URL, timeout=20.0)
    try:
        health = client.get("/openapi.json")
        health.raise_for_status()
    except Exception as exc:  # pragma: no cover - skip path
        client.close()
        pytest.skip(f"API is not reachable on {API_BASE_URL}: {exc}")
    yield client
    client.close()


@pytest.fixture()
def auth_client(client: httpx.Client) -> tuple[httpx.Client, str]:
    email = f"lf-matrix-{uuid.uuid4()}@dataverse.local"
    password = "Passw0rd123!"
    register = client.post("/auth/register", json={"email": email, "password": password, "galaxy_name": "LF Matrix"})
    assert register.status_code == 201, register.text
    body = register.json()
    token = body["access_token"]
    galaxy_id = body["default_galaxy"]["id"]
    client.headers.update({"Authorization": f"Bearer {token}"})
    return client, galaxy_id


def _ingest_row(client: httpx.Client, *, galaxy_id: str, value: str) -> dict:
    created = client.post("/civilizations/ingest", json={"value": value, "galaxy_id": galaxy_id})
    assert created.status_code == 200, created.text
    return created.json()


def _seed_table_row(client: httpx.Client, *, galaxy_id: str, table_name: str, label: str) -> None:
    command = f'"{label}" (table: {table_name}, amount: 1)'
    response = client.post("/parser/execute", json={"query": command, "galaxy_id": galaxy_id})
    assert response.status_code == 200, response.text


def _table_id_by_name(client: httpx.Client, *, galaxy_id: str, table_name: str) -> str:
    tables = client.get("/universe/tables", params={"galaxy_id": galaxy_id})
    assert tables.status_code == 200, tables.text
    for item in tables.json().get("tables", []):
        if str(item.get("name") or "") == table_name:
            table_id = str(item.get("table_id") or "")
            if table_id:
                return table_id
    raise AssertionError(f"Table '{table_name}' was not projected")


def _snapshot_row(client: httpx.Client, *, galaxy_id: str, civilization_id: str) -> dict:
    snapshot = client.get("/universe/snapshot", params={"galaxy_id": galaxy_id})
    assert snapshot.status_code == 200, snapshot.text
    for row in snapshot.json().get("civilizations", []):
        if str(row.get("id") or "") == civilization_id:
            return row
    raise AssertionError(f"Civilization {civilization_id} not found in snapshot")


def test_lf01_moon_discoverability_and_impact_endpoint(auth_client: tuple[httpx.Client, str]) -> None:
    client, galaxy_id = auth_client
    table_name = f"LF-01 > {uuid.uuid4().hex[:6]}"
    _seed_table_row(client, galaxy_id=galaxy_id, table_name=table_name, label=f"LF01-{uuid.uuid4().hex[:6]}")
    table_id = _table_id_by_name(client, galaxy_id=galaxy_id, table_name=table_name)

    impact = client.get(
        f"/planets/{table_id}/moon-impact",
        params={"galaxy_id": galaxy_id, "include_civilization_ids": True, "include_violation_samples": True},
    )
    assert impact.status_code == 200, impact.text
    body = impact.json()
    assert body["planet_id"] == table_id
    assert "summary" in body and isinstance(body["summary"], dict)
    assert isinstance(body.get("items", []), list)


def test_lf02_semantic_clarity_snapshot_contains_lifecycle_and_facts(auth_client: tuple[httpx.Client, str]) -> None:
    client, galaxy_id = auth_client
    created = _ingest_row(client, galaxy_id=galaxy_id, value=f"LF02-{uuid.uuid4().hex[:6]}")
    civilization_id = str(created["id"])

    row = _snapshot_row(client, galaxy_id=galaxy_id, civilization_id=civilization_id)
    assert "state" in row
    assert "health_score" in row
    assert "violation_count" in row
    assert isinstance(row.get("facts", []), list)


def test_lf03_mineral_workflow_upsert_and_remove_soft(auth_client: tuple[httpx.Client, str]) -> None:
    client, galaxy_id = auth_client
    created = _ingest_row(client, galaxy_id=galaxy_id, value=f"LF03-{uuid.uuid4().hex[:6]}")
    civilization_id = str(created["id"])

    upsert = client.patch(
        f"/civilizations/{civilization_id}/minerals/amount",
        json={"typed_value": 42, "galaxy_id": galaxy_id},
    )
    assert upsert.status_code == 200, upsert.text

    remove = client.patch(
        f"/civilizations/{civilization_id}/minerals/amount",
        json={"remove": True, "galaxy_id": galaxy_id},
    )
    assert remove.status_code == 200, remove.text

    row = _snapshot_row(client, galaxy_id=galaxy_id, civilization_id=civilization_id)
    metadata = row.get("metadata", {})
    assert "amount" not in metadata


def test_lf04_bond_preview_gate_has_reject_and_structured_decision(auth_client: tuple[httpx.Client, str]) -> None:
    client, galaxy_id = auth_client
    left = _ingest_row(client, galaxy_id=galaxy_id, value=f"LF04-A-{uuid.uuid4().hex[:6]}")
    right = _ingest_row(client, galaxy_id=galaxy_id, value=f"LF04-B-{uuid.uuid4().hex[:6]}")
    left_id = str(left["id"])
    right_id = str(right["id"])

    rejected = client.post(
        "/bonds/validate",
        json={
            "operation": "create",
            "source_civilization_id": left_id,
            "target_civilization_id": left_id,
            "type": "RELATION",
            "galaxy_id": galaxy_id,
        },
    )
    assert rejected.status_code == 200, rejected.text
    rejected_body = rejected.json()
    assert rejected_body.get("decision") == "REJECT"
    assert rejected_body.get("blocking") is True

    preview = client.post(
        "/bonds/validate",
        json={
            "operation": "create",
            "source_civilization_id": left_id,
            "target_civilization_id": right_id,
            "type": "RELATION",
            "galaxy_id": galaxy_id,
        },
    )
    assert preview.status_code == 200, preview.text
    preview_body = preview.json()
    assert preview_body.get("decision") in {"ALLOW", "WARN", "REJECT"}
    assert isinstance(preview_body.get("preview", {}), dict)
    assert isinstance(preview_body.get("reasons", []), list)


def test_lf05_state_machine_contract_rejects_invalid_mutate_shape(auth_client: tuple[httpx.Client, str]) -> None:
    client, galaxy_id = auth_client
    invalid = client.post(
        "/bonds/validate",
        json={
            "operation": "mutate",
            "type": "RELATION",
            "galaxy_id": galaxy_id,
        },
    )
    assert invalid.status_code == 422, invalid.text


def test_lf06_cross_planet_preview_flags_cross_planet_context(auth_client: tuple[httpx.Client, str]) -> None:
    client, galaxy_id = auth_client
    table_left = f"LF-06 > Left {uuid.uuid4().hex[:6]}"
    table_right = f"LF-06 > Right {uuid.uuid4().hex[:6]}"
    left_label = f"LF06-A-{uuid.uuid4().hex[:6]}"
    right_label = f"LF06-B-{uuid.uuid4().hex[:6]}"

    _seed_table_row(client, galaxy_id=galaxy_id, table_name=table_left, label=left_label)
    _seed_table_row(client, galaxy_id=galaxy_id, table_name=table_right, label=right_label)

    snapshot = client.get("/universe/snapshot", params={"galaxy_id": galaxy_id})
    assert snapshot.status_code == 200, snapshot.text
    by_value = {str(item.get("value") or ""): item for item in snapshot.json().get("civilizations", [])}
    left_id = str(by_value[left_label]["id"])
    right_id = str(by_value[right_label]["id"])

    preview = client.post(
        "/bonds/validate",
        json={
            "operation": "create",
            "source_civilization_id": left_id,
            "target_civilization_id": right_id,
            "type": "RELATION",
            "galaxy_id": galaxy_id,
        },
    )
    assert preview.status_code == 200, preview.text
    preview_body = preview.json()
    assert isinstance(preview_body.get("preview", {}), dict)
    assert isinstance(preview_body["preview"].get("cross_planet"), bool)


def test_lf07_snapshot_replay_parity_is_deterministic_without_writes(auth_client: tuple[httpx.Client, str]) -> None:
    client, galaxy_id = auth_client
    _ingest_row(client, galaxy_id=galaxy_id, value=f"LF07-{uuid.uuid4().hex[:6]}")

    first = client.get("/universe/snapshot", params={"galaxy_id": galaxy_id})
    second = client.get("/universe/snapshot", params={"galaxy_id": galaxy_id})
    assert first.status_code == 200, first.text
    assert second.status_code == 200, second.text

    first_ids = sorted(str(item.get("id") or "") for item in first.json().get("civilizations", []))
    second_ids = sorted(str(item.get("id") or "") for item in second.json().get("civilizations", []))
    assert first_ids == second_ids


def test_lf08_limit_guard_is_enforced_for_moon_impact(auth_client: tuple[httpx.Client, str]) -> None:
    client, galaxy_id = auth_client
    table_name = f"LF-08 > {uuid.uuid4().hex[:6]}"
    _seed_table_row(client, galaxy_id=galaxy_id, table_name=table_name, label=f"LF08-{uuid.uuid4().hex[:6]}")
    table_id = _table_id_by_name(client, galaxy_id=galaxy_id, table_name=table_name)

    limited = client.get(
        f"/planets/{table_id}/moon-impact",
        params={"galaxy_id": galaxy_id, "limit": 1001},
    )
    assert limited.status_code in {400, 422}, limited.text
