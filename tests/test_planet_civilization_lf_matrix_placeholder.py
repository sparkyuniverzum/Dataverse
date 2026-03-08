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


def _create_planet(client: httpx.Client, *, galaxy_id: str, name: str) -> str:
    created = client.post(
        "/planets",
        json={
            "name": name,
            "archetype": "catalog",
            "initial_schema_mode": "empty",
            "galaxy_id": galaxy_id,
            "idempotency_key": f"lf-planet-{uuid.uuid4()}",
        },
    )
    assert created.status_code == 201, created.text
    return str(created.json()["table_id"])


def _snapshot_row(client: httpx.Client, *, galaxy_id: str, civilization_id: str) -> dict:
    snapshot = client.get("/universe/snapshot", params={"galaxy_id": galaxy_id})
    assert snapshot.status_code == 200, snapshot.text
    for row in snapshot.json().get("civilizations", []):
        if str(row.get("id") or "") == civilization_id:
            return row
    raise AssertionError(f"Civilization {civilization_id} not found in snapshot")


def _latest_entity_event_seq(client: httpx.Client, *, galaxy_id: str, entity_id: str) -> int:
    activity = client.get(f"/galaxies/{galaxy_id}/activity", params={"limit": 200})
    assert activity.status_code == 200, activity.text
    for item in activity.json().get("items", []):
        if str(item.get("entity_id") or "") == str(entity_id):
            return int(item["event_seq"])
    raise AssertionError(f"No activity event found for entity_id={entity_id}")


def test_lf01_moon_discoverability_and_impact_endpoint(auth_client: tuple[httpx.Client, str]) -> None:
    client, galaxy_id = auth_client
    planet_name = f"LF-01 > Planet-{uuid.uuid4().hex[:6]}"
    table_id = _create_planet(client, galaxy_id=galaxy_id, name=planet_name)
    capability = client.post(
        f"/planets/{table_id}/capabilities",
        json={
            "galaxy_id": galaxy_id,
            "capability_key": "state.guard",
            "capability_class": "validation",
            "config": {
                "validators": [
                    {
                        "id": "state-must-be-active",
                        "field": "state",
                        "operator": "==",
                        "value": "active",
                    }
                ]
            },
            "order_index": 1,
            "status": "active",
            "idempotency_key": f"lf01-cap-{uuid.uuid4()}",
        },
    )
    assert capability.status_code == 201, capability.text
    capability_id = str(capability.json()["id"])
    seeded = client.post(
        "/civilizations/ingest",
        json={
            "value": f"LF01-{uuid.uuid4().hex[:6]}",
            "metadata": {
                "table": planet_name,
                "entity_id": f"lf01-{uuid.uuid4().hex[:6]}",
                "label": "LF01 Row",
                "state": "active",
            },
            "galaxy_id": galaxy_id,
            "idempotency_key": f"lf01-row-{uuid.uuid4()}",
        },
    )
    assert seeded.status_code == 200, seeded.text

    impact = client.get(
        f"/planets/{table_id}/moon-impact",
        params={
            "galaxy_id": galaxy_id,
            "capability_id": capability_id,
            "include_civilization_ids": True,
            "include_violation_samples": True,
            "limit": 200,
        },
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

    detail = client.get(f"/civilizations/{civilization_id}", params={"galaxy_id": galaxy_id})
    assert detail.status_code == 200, detail.text
    row = detail.json()
    assert "state" in row
    assert "health_score" in row
    assert "violation_count" in row
    assert isinstance(row.get("facts", []), list)


def test_lf03_mineral_workflow_upsert_and_remove_soft(auth_client: tuple[httpx.Client, str]) -> None:
    client, galaxy_id = auth_client
    created = _ingest_row(client, galaxy_id=galaxy_id, value=f"LF03-{uuid.uuid4().hex[:6]}")
    civilization_id = str(created["id"])
    expected_event_seq = int(created.get("current_event_seq") or 0)
    assert expected_event_seq >= 1

    upsert = client.patch(
        f"/civilizations/{civilization_id}/minerals/amount",
        json={"typed_value": 42, "expected_event_seq": expected_event_seq, "galaxy_id": galaxy_id},
    )
    assert upsert.status_code == 200, upsert.text
    upsert_body = upsert.json()
    next_event_seq = int(upsert_body.get("current_event_seq") or 0)
    assert next_event_seq > expected_event_seq

    remove = client.patch(
        f"/civilizations/{civilization_id}/minerals/amount",
        json={"remove": True, "expected_event_seq": next_event_seq, "galaxy_id": galaxy_id},
    )
    assert remove.status_code == 200, remove.text

    detail = client.get(f"/civilizations/{civilization_id}", params={"galaxy_id": galaxy_id})
    assert detail.status_code == 200, detail.text
    facts_by_key = {fact["key"]: fact for fact in detail.json().get("facts", [])}
    assert "amount" not in facts_by_key


def test_lf04_bond_preview_gate_has_reject_and_structured_decision(auth_client: tuple[httpx.Client, str]) -> None:
    client, galaxy_id = auth_client
    left = _ingest_row(client, galaxy_id=galaxy_id, value=f"LF04-A-{uuid.uuid4().hex[:6]}")
    right = _ingest_row(client, galaxy_id=galaxy_id, value=f"LF04-B-{uuid.uuid4().hex[:6]}")
    left_id = str(left["id"])
    right_id = str(right["id"])
    left_seq = _latest_entity_event_seq(client, galaxy_id=galaxy_id, entity_id=left_id)
    right_seq = _latest_entity_event_seq(client, galaxy_id=galaxy_id, entity_id=right_id)

    preview = client.post(
        "/bonds/validate",
        json={
            "operation": "create",
            "source_civilization_id": left_id,
            "target_civilization_id": right_id,
            "type": "RELATION",
            "expected_source_event_seq": left_seq,
            "expected_target_event_seq": right_seq,
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
    left_planet_name = f"LF-06 > Left-{uuid.uuid4().hex[:6]}"
    right_planet_name = f"LF-06 > Right-{uuid.uuid4().hex[:6]}"
    left_planet_id = _create_planet(client, galaxy_id=galaxy_id, name=left_planet_name)
    right_planet_id = _create_planet(client, galaxy_id=galaxy_id, name=right_planet_name)
    left_row = client.post(
        "/civilizations",
        json={
            "galaxy_id": galaxy_id,
            "planet_id": left_planet_id,
            "label": "LF06 Left",
            "minerals": {
                "entity_id": f"lf06-left-{uuid.uuid4().hex[:6]}",
                "label": "LF06 Left",
                "state": "active",
            },
            "idempotency_key": f"lf06-left-{uuid.uuid4()}",
        },
    )
    assert left_row.status_code == 201, left_row.text
    right_row = client.post(
        "/civilizations",
        json={
            "galaxy_id": galaxy_id,
            "planet_id": right_planet_id,
            "label": "LF06 Right",
            "minerals": {
                "entity_id": f"lf06-right-{uuid.uuid4().hex[:6]}",
                "label": "LF06 Right",
                "state": "active",
            },
            "idempotency_key": f"lf06-right-{uuid.uuid4()}",
        },
    )
    assert right_row.status_code == 201, right_row.text
    left_id = str(left_row.json()["moon_id"])
    right_id = str(right_row.json()["moon_id"])
    left_seq = _latest_entity_event_seq(client, galaxy_id=galaxy_id, entity_id=left_id)
    right_seq = _latest_entity_event_seq(client, galaxy_id=galaxy_id, entity_id=right_id)

    preview = client.post(
        "/bonds/validate",
        json={
            "operation": "create",
            "source_civilization_id": left_id,
            "target_civilization_id": right_id,
            "type": "RELATION",
            "expected_source_event_seq": left_seq,
            "expected_target_event_seq": right_seq,
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
    table_id = _create_planet(client, galaxy_id=galaxy_id, name=f"LF-08 > Planet-{uuid.uuid4().hex[:6]}")

    limited = client.get(
        f"/planets/{table_id}/moon-impact",
        params={"galaxy_id": galaxy_id, "limit": 1001},
    )
    assert limited.status_code in {400, 422}, limited.text
