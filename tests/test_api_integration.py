from __future__ import annotations

import os
import uuid
from concurrent.futures import ThreadPoolExecutor
from datetime import UTC, datetime, timedelta
from threading import Barrier

import httpx
import pytest

API_BASE_URL = os.getenv("DATAVERSE_API_BASE", "http://127.0.0.1:8000")


def _stringify(value: object) -> str:
    if isinstance(value, str):
        return value
    return str(value)


def _parse_iso_datetime(value: str) -> datetime:
    return datetime.fromisoformat(value.replace("Z", "+00:00")).astimezone(UTC)


def _latest_entity_event_seq(client: httpx.Client, *, galaxy_id: str, entity_id: str) -> int:
    activity = client.get(f"/galaxies/{galaxy_id}/activity", params={"limit": 200})
    assert activity.status_code == 200, activity.text
    items = activity.json().get("items", [])
    for item in items:
        if item.get("entity_id") == entity_id:
            return int(item["event_seq"])
    raise AssertionError(f"No activity event found for entity_id={entity_id}")


def _snapshot_asteroid(client: httpx.Client, *, galaxy_id: str, civilization_id: str) -> dict:
    snapshot = client.get("/universe/snapshot", params={"galaxy_id": galaxy_id})
    assert snapshot.status_code == 200, snapshot.text
    for civilization in snapshot.json().get("civilizations", []):
        if civilization.get("id") == civilization_id:
            return civilization
    raise AssertionError(f"Civilization {civilization_id} not found in snapshot")


def _assert_occ_conflict(response: httpx.Response, *, expected_event_seq: int | None = None) -> dict:
    assert response.status_code == 409, response.text
    body = response.json()
    detail = body.get("detail", {})
    assert isinstance(detail, dict), body
    assert detail.get("code") == "OCC_CONFLICT"
    assert isinstance(detail.get("context"), str) and detail.get("context")
    assert isinstance(detail.get("entity_id"), str) and detail.get("entity_id")
    assert isinstance(detail.get("current_event_seq"), int)
    if expected_event_seq is not None:
        assert detail.get("expected_event_seq") == expected_event_seq
    return detail


def _parallel_mutate_with_expected_seq(
    *,
    auth_header: str,
    galaxy_id: str,
    civilization_id: str,
    expected_event_seq: int,
) -> list[tuple[int, dict]]:
    barrier = Barrier(2)

    def _call(status_label: str) -> tuple[int, dict]:
        with httpx.Client(
            base_url=API_BASE_URL,
            timeout=20.0,
            headers={"Authorization": auth_header},
        ) as worker_client:
            barrier.wait(timeout=10.0)
            response = worker_client.patch(
                f"/civilizations/{civilization_id}/mutate",
                json={
                    "metadata": {"race_status": status_label},
                    "expected_event_seq": expected_event_seq,
                    "galaxy_id": galaxy_id,
                },
            )
            body: dict
            try:
                parsed = response.json()
                body = parsed if isinstance(parsed, dict) else {}
            except ValueError:
                body = {}
            return response.status_code, body

    with ThreadPoolExecutor(max_workers=2) as pool:
        result_a = pool.submit(_call, "A")
        result_b = pool.submit(_call, "B")
        return [result_a.result(timeout=25.0), result_b.result(timeout=25.0)]


def _parallel_link_with_expected_seq(
    *,
    auth_header: str,
    galaxy_id: str,
    source_civilization_id: str,
    target_civilization_id: str,
    relation_type: str,
    expected_source_event_seq: int,
    expected_target_event_seq: int,
) -> list[tuple[int, dict]]:
    barrier = Barrier(2)

    def _call() -> tuple[int, dict]:
        with httpx.Client(
            base_url=API_BASE_URL,
            timeout=20.0,
            headers={"Authorization": auth_header},
        ) as worker_client:
            barrier.wait(timeout=10.0)
            response = worker_client.post(
                "/bonds/link",
                json={
                    "source_civilization_id": source_civilization_id,
                    "target_civilization_id": target_civilization_id,
                    "type": relation_type,
                    "expected_source_event_seq": expected_source_event_seq,
                    "expected_target_event_seq": expected_target_event_seq,
                    "galaxy_id": galaxy_id,
                },
            )
            body: dict
            try:
                parsed = response.json()
                body = parsed if isinstance(parsed, dict) else {}
            except ValueError:
                body = {}
            return response.status_code, body

    with ThreadPoolExecutor(max_workers=2) as pool:
        result_a = pool.submit(_call)
        result_b = pool.submit(_call)
        return [result_a.result(timeout=25.0), result_b.result(timeout=25.0)]


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
    email = f"user-{uuid.uuid4()}@dataverse.local"
    password = "Passw0rd123!"
    register = client.post("/auth/register", json={"email": email, "password": password, "galaxy_name": "Test Galaxy"})
    assert register.status_code == 201, register.text
    body = register.json()
    token = body["access_token"]
    galaxy_id = body["default_galaxy"]["id"]
    client.headers.update({"Authorization": f"Bearer {token}"})
    return client, galaxy_id


def test_auth_session_lifecycle_login_refresh_logout_and_me(client: httpx.Client) -> None:
    email = f"auth-lifecycle-{uuid.uuid4()}@dataverse.local"
    password = "Passw0rd123!"
    previous_authorization = client.headers.get("Authorization")

    try:
        register = client.post(
            "/auth/register", json={"email": email, "password": password, "galaxy_name": "Auth Lifecycle"}
        )
        assert register.status_code == 201, register.text
        register_body = register.json()
        assert isinstance(register_body.get("access_token"), str) and register_body["access_token"]
        assert isinstance(register_body.get("refresh_token"), str) and register_body["refresh_token"]
        assert register_body.get("token_type") == "bearer"
        assert register_body.get("user", {}).get("email") == email
        assert isinstance(register_body.get("default_galaxy", {}).get("id"), str)

        login = client.post("/auth/login", json={"email": email, "password": password})
        assert login.status_code == 200, login.text
        login_body = login.json()
        access_token = str(login_body.get("access_token") or "")
        refresh_token = str(login_body.get("refresh_token") or "")
        assert access_token
        assert refresh_token
        assert login_body.get("token_type") == "bearer"

        client.headers.update({"Authorization": f"Bearer {access_token}"})
        me_before_logout = client.get("/auth/me")
        assert me_before_logout.status_code == 200, me_before_logout.text
        assert me_before_logout.json().get("email") == email

        refresh = client.post("/auth/refresh", json={"refresh_token": refresh_token})
        assert refresh.status_code == 200, refresh.text
        refresh_body = refresh.json()
        refreshed_access_token = str(refresh_body.get("access_token") or "")
        refreshed_refresh_token = str(refresh_body.get("refresh_token") or "")
        assert refreshed_access_token
        assert refreshed_refresh_token
        assert refresh_body.get("token_type") == "bearer"
        expires_at_raw = str(refresh_body.get("expires_at") or "")
        assert expires_at_raw
        assert _parse_iso_datetime(expires_at_raw) > datetime.now(UTC)

        client.headers.update({"Authorization": f"Bearer {refreshed_access_token}"})
        me_after_refresh = client.get("/auth/me")
        assert me_after_refresh.status_code == 200, me_after_refresh.text
        assert me_after_refresh.json().get("email") == email

        logout = client.post("/auth/logout")
        assert logout.status_code == 200, logout.text
        assert logout.json().get("ok") is True

        me_after_logout = client.get("/auth/me")
        assert me_after_logout.status_code == 401, me_after_logout.text

        refresh_after_logout = client.post("/auth/refresh", json={"refresh_token": refreshed_refresh_token})
        assert refresh_after_logout.status_code == 401, refresh_after_logout.text
    finally:
        if previous_authorization:
            client.headers.update({"Authorization": previous_authorization})
        else:
            client.headers.pop("Authorization", None)


def test_asteroids_alias_endpoints_are_not_found(auth_client: tuple[httpx.Client, str]) -> None:
    client, galaxy_id = auth_client
    missing_id = str(uuid.uuid4())

    get_removed = client.get(f"/asteroids/{missing_id}", params={"galaxy_id": galaxy_id})
    assert get_removed.status_code == 404, get_removed.text

    post_removed = client.post(
        "/asteroids/ingest",
        json={"value": f"Legacy-{uuid.uuid4()}", "metadata": {}, "galaxy_id": galaxy_id},
    )
    assert post_removed.status_code == 404, post_removed.text


def test_parser_accepts_query_text_and_equal_pair(auth_client: tuple[httpx.Client, str]) -> None:
    client, galaxy_id = auth_client
    command = f"ParserContract-{uuid.uuid4()}"

    resp_query = client.post("/parser/execute", json={"query": command, "galaxy_id": galaxy_id})
    assert resp_query.status_code == 200, resp_query.text
    query_body = resp_query.json()
    assert query_body["tasks"][0]["action"] == "INGEST"

    resp_text = client.post("/parser/execute", json={"text": command, "galaxy_id": galaxy_id})
    assert resp_text.status_code == 200, resp_text.text
    text_body = resp_text.json()
    assert text_body["tasks"][0]["action"] == "INGEST"

    resp_both = client.post("/parser/execute", json={"query": command, "text": command, "galaxy_id": galaxy_id})
    assert resp_both.status_code == 200, resp_both.text
    both_body = resp_both.json()
    assert both_body["tasks"][0]["action"] == "INGEST"


def test_parser_rejects_mismatched_query_and_text(auth_client: tuple[httpx.Client, str]) -> None:
    client, galaxy_id = auth_client
    resp = client.post("/parser/execute", json={"query": "A", "text": "B", "galaxy_id": galaxy_id})
    assert resp.status_code == 422
    assert "must match" in resp.text


def test_parser_v2_executes_relation_command(auth_client: tuple[httpx.Client, str]) -> None:
    client, galaxy_id = auth_client
    left = f"V2A{uuid.uuid4().hex}"
    right = f"V2B{uuid.uuid4().hex}"

    execute = client.post(
        "/parser/execute",
        json={"query": f"{left} + {right}", "parser_version": "v2", "galaxy_id": galaxy_id},
    )
    assert execute.status_code == 200, execute.text
    body = execute.json()
    actions = [task["action"] for task in body["tasks"]]
    assert "LINK" in actions
    assert actions.count("INGEST") >= 2

    snapshot = client.get("/universe/snapshot", params={"galaxy_id": galaxy_id})
    assert snapshot.status_code == 200, snapshot.text
    values = {_stringify(atom["value"]) for atom in snapshot.json()["civilizations"]}
    assert left in values
    assert right in values


def test_parser_plan_returns_tasks_without_persisting_changes(auth_client: tuple[httpx.Client, str]) -> None:
    client, galaxy_id = auth_client
    left = f"PlanA{uuid.uuid4().hex}"

    planned = client.post(
        "/parser/plan",
        json={"query": left, "galaxy_id": galaxy_id},
    )
    assert planned.status_code == 200, planned.text
    body = planned.json()
    actions = [task["action"] for task in body.get("tasks", [])]
    assert "INGEST" in actions

    snapshot = client.get("/universe/snapshot", params={"galaxy_id": galaxy_id})
    assert snapshot.status_code == 200, snapshot.text
    values = {_stringify(atom["value"]) for atom in snapshot.json()["civilizations"]}
    assert left not in values


def test_parser_v2_returns_parse_error_for_invalid_syntax(auth_client: tuple[httpx.Client, str]) -> None:
    client, galaxy_id = auth_client
    execute = client.post(
        "/parser/execute",
        json={"query": "Erik +", "parser_version": "v2", "galaxy_id": galaxy_id},
    )
    assert execute.status_code == 422
    assert "Parse error" in execute.text


def test_parser_v2_resolves_existing_names_to_ids_without_ingest(auth_client: tuple[httpx.Client, str]) -> None:
    client, galaxy_id = auth_client
    left = f"ResolveA{uuid.uuid4().hex}"
    right = f"ResolveB{uuid.uuid4().hex}"

    created_left = client.post("/civilizations/ingest", json={"value": left, "galaxy_id": galaxy_id})
    created_right = client.post("/civilizations/ingest", json={"value": right, "galaxy_id": galaxy_id})
    assert created_left.status_code == 200, created_left.text
    assert created_right.status_code == 200, created_right.text

    execute = client.post(
        "/parser/execute",
        json={"query": f"{left} + {right}", "parser_version": "v2", "galaxy_id": galaxy_id},
    )
    assert execute.status_code == 200, execute.text
    body = execute.json()

    actions = [task["action"] for task in body["tasks"]]
    assert actions == ["LINK"]
    assert "source_civilization_id" in body["tasks"][0]["params"]
    assert "target_civilization_id" in body["tasks"][0]["params"]
    assert body["tasks"][0]["params"]["type"] == "RELATION"


def test_parser_v2_returns_bridge_error_for_mixed_id_and_name_selectors(auth_client: tuple[httpx.Client, str]) -> None:
    client, galaxy_id = auth_client
    id_literal = str(uuid.uuid4())
    label = f"V2Bridge{uuid.uuid4().hex}"

    execute = client.post(
        "/parser/execute",
        json={"query": f'"{id_literal}" + {label}', "parser_version": "v2", "galaxy_id": galaxy_id},
    )
    assert execute.status_code == 422
    assert "requires both selectors as NAME or both as ID" in execute.text

    snapshot = client.get("/universe/snapshot", params={"galaxy_id": galaxy_id})
    assert snapshot.status_code == 200, snapshot.text
    values = {_stringify(atom["value"]) for atom in snapshot.json()["civilizations"]}
    assert label not in values


def test_parser_v2_contract_gate_accepts_unquoted_uuid_selectors(auth_client: tuple[httpx.Client, str]) -> None:
    client, galaxy_id = auth_client
    left = f"UUIDLeft{uuid.uuid4().hex}"
    right = f"UUIDRight{uuid.uuid4().hex}"

    left_created = client.post("/civilizations/ingest", json={"value": left, "galaxy_id": galaxy_id})
    right_created = client.post("/civilizations/ingest", json={"value": right, "galaxy_id": galaxy_id})
    assert left_created.status_code == 200, left_created.text
    assert right_created.status_code == 200, right_created.text

    left_id = left_created.json()["id"]
    right_id = right_created.json()["id"]
    execute = client.post(
        "/parser/execute",
        json={"query": f"{left_id} + {right_id}", "parser_version": "v2", "galaxy_id": galaxy_id},
    )
    assert execute.status_code == 200, execute.text
    body = execute.json()
    assert [task["action"] for task in body["tasks"]] == ["LINK"]
    assert body["tasks"][0]["params"]["source_civilization_id"] == left_id
    assert body["tasks"][0]["params"]["target_civilization_id"] == right_id


def test_parser_v2_contract_gate_accepts_unquoted_hyphen_names(auth_client: tuple[httpx.Client, str]) -> None:
    client, galaxy_id = auth_client
    left = f"Node-{uuid.uuid4().hex[:8]}"
    right = f"Team-{uuid.uuid4().hex[:8]}"

    execute = client.post(
        "/parser/execute",
        json={"query": f"{left} + {right}", "parser_version": "v2", "galaxy_id": galaxy_id},
    )
    assert execute.status_code == 200, execute.text
    body = execute.json()
    actions = [task["action"] for task in body["tasks"]]
    assert "LINK" in actions
    assert actions.count("INGEST") >= 2

    snapshot = client.get("/universe/snapshot", params={"galaxy_id": galaxy_id})
    assert snapshot.status_code == 200, snapshot.text
    values = {_stringify(atom["value"]) for atom in snapshot.json()["civilizations"]}
    assert left in values
    assert right in values


def test_parser_v2_contract_gate_returns_ambiguous_name_error(auth_client: tuple[httpx.Client, str]) -> None:
    client, galaxy_id = auth_client
    created_a = client.post("/civilizations/ingest", json={"value": "Erik", "galaxy_id": galaxy_id})
    created_b = client.post("/civilizations/ingest", json={"value": "ERIK", "galaxy_id": galaxy_id})
    assert created_a.status_code == 200, created_a.text
    assert created_b.status_code == 200, created_b.text

    execute = client.post(
        "/parser/execute",
        json={"query": "- erik", "parser_version": "v2", "galaxy_id": galaxy_id},
    )
    assert execute.status_code == 422
    body = execute.json()
    assert "Ambiguous" in body["detail"]


def test_parser_v2_contract_gate_returns_not_found_error_on_lookup(auth_client: tuple[httpx.Client, str]) -> None:
    client, galaxy_id = auth_client
    missing = f"Missing-{uuid.uuid4().hex}"

    execute = client.post(
        "/parser/execute",
        json={"query": f"- {missing}", "parser_version": "v2", "galaxy_id": galaxy_id},
    )
    assert execute.status_code == 422
    body = execute.json()
    assert "was not found" in body["detail"]


def test_parser_v2_respects_branch_timeline(auth_client: tuple[httpx.Client, str]) -> None:
    client, galaxy_id = auth_client
    branch_label = f"V2Branch{uuid.uuid4().hex}"

    branch = client.post(
        "/branches",
        json={"name": f"ParserV2Branch-{uuid.uuid4()}", "galaxy_id": galaxy_id},
    )
    assert branch.status_code == 201, branch.text
    branch_id = branch.json()["id"]

    execute = client.post(
        "/parser/execute",
        json={
            "query": branch_label,
            "parser_version": "v2",
            "galaxy_id": galaxy_id,
            "branch_id": branch_id,
        },
    )
    assert execute.status_code == 200, execute.text

    snapshot_main = client.get("/universe/snapshot", params={"galaxy_id": galaxy_id})
    assert snapshot_main.status_code == 200, snapshot_main.text
    main_values = {_stringify(atom["value"]) for atom in snapshot_main.json()["civilizations"]}
    assert branch_label not in main_values

    snapshot_branch = client.get("/universe/snapshot", params={"galaxy_id": galaxy_id, "branch_id": branch_id})
    assert snapshot_branch.status_code == 200, snapshot_branch.text
    branch_values = {_stringify(atom["value"]) for atom in snapshot_branch.json()["civilizations"]}
    assert branch_label in branch_values


def test_parser_v2_legacy_select_command_uses_v1_semantics(auth_client: tuple[httpx.Client, str]) -> None:
    client, galaxy_id = auth_client
    label = f"LegacySelect{uuid.uuid4().hex}"
    created = client.post("/civilizations/ingest", json={"value": label, "galaxy_id": galaxy_id})
    assert created.status_code == 200, created.text

    execute = client.post(
        "/parser/execute",
        json={"query": f"show : {label}", "parser_version": "v2", "galaxy_id": galaxy_id},
    )
    assert execute.status_code == 200, execute.text
    body = execute.json()
    assert body["tasks"][0]["action"] == "SELECT"
    selected_values = {_stringify(item["value"]) for item in body["selected_asteroids"]}
    assert label in selected_values


def test_parser_v2_legacy_delete_command_uses_v1_semantics(auth_client: tuple[httpx.Client, str]) -> None:
    client, galaxy_id = auth_client
    label = f"LegacyDelete{uuid.uuid4().hex}"
    created = client.post("/civilizations/ingest", json={"value": label, "galaxy_id": galaxy_id})
    assert created.status_code == 200, created.text
    civilization_id = created.json()["id"]

    execute = client.post(
        "/parser/execute",
        json={"query": f"Delete : {label}", "parser_version": "v2", "galaxy_id": galaxy_id},
    )
    assert execute.status_code == 200, execute.text
    body = execute.json()
    assert body["tasks"][0]["action"] == "DELETE"
    assert civilization_id in body["extinguished_civilization_ids"]


def test_parser_v2_legacy_guardian_command_uses_v1_semantics(auth_client: tuple[httpx.Client, str]) -> None:
    client, galaxy_id = auth_client
    project = f"LegacyGuardian{uuid.uuid4().hex}"
    created = client.post(
        "/civilizations/ingest",
        json={"value": project, "metadata": {"celkem": 1200}, "galaxy_id": galaxy_id},
    )
    assert created.status_code == 200, created.text

    execute = client.post(
        "/parser/execute",
        json={"query": f"Hlídej : {project}.celkem > 1000 -> pulse", "parser_version": "v2", "galaxy_id": galaxy_id},
    )
    assert execute.status_code == 200, execute.text
    body = execute.json()
    assert body["tasks"][0]["action"] == "ADD_GUARDIAN"

    snapshot = client.get("/universe/snapshot", params={"galaxy_id": galaxy_id})
    assert snapshot.status_code == 200, snapshot.text
    by_value = {_stringify(atom["value"]): atom for atom in snapshot.json()["civilizations"]}
    guardians = by_value[project]["metadata"].get("_guardians", [])
    assert any(isinstance(rule, dict) and rule.get("action") == "pulse" for rule in guardians)


def test_semantic_constitution_endpoint_by_endpoint_closure_v1(auth_client: tuple[httpx.Client, str]) -> None:
    client, galaxy_id = auth_client

    relation_left = f"SemRelA-{uuid.uuid4().hex[:8]}"
    relation_right = f"SemRelB-{uuid.uuid4().hex[:8]}"
    relation_execute = client.post(
        "/parser/execute",
        json={"query": f"{relation_left} + {relation_right}", "parser_version": "v2", "galaxy_id": galaxy_id},
    )
    assert relation_execute.status_code == 200, relation_execute.text
    relation_body = relation_execute.json()
    relation_link_task = next((task for task in relation_body.get("tasks", []) if task.get("action") == "LINK"), None)
    assert relation_link_task is not None
    assert str(relation_link_task.get("params", {}).get("type") or "").upper() == "RELATION"

    type_left = f"SemTypeA-{uuid.uuid4().hex[:8]}"
    type_right = f"SemTypeB-{uuid.uuid4().hex[:8]}"
    type_execute = client.post(
        "/parser/execute",
        json={"query": f"{type_left} : {type_right}", "parser_version": "v2", "galaxy_id": galaxy_id},
    )
    assert type_execute.status_code == 200, type_execute.text
    type_body = type_execute.json()
    type_link_task = next((task for task in type_body.get("tasks", []) if task.get("action") == "LINK"), None)
    assert type_link_task is not None
    assert str(type_link_task.get("params", {}).get("type") or "").upper() == "TYPE"
    type_bond = next(
        (bond for bond in type_body.get("bonds", []) if str(bond.get("type") or "").upper() == "TYPE"), None
    )
    assert type_bond is not None
    type_bond_id = type_bond["id"]

    guardian_label = f"SemGuardian-{uuid.uuid4().hex[:8]}"
    seeded_guardian = client.post(
        "/civilizations/ingest",
        json={"value": guardian_label, "metadata": {"score": 10}, "galaxy_id": galaxy_id},
    )
    assert seeded_guardian.status_code == 200, seeded_guardian.text
    guardian_id = seeded_guardian.json()["id"]

    guardian_execute = client.post(
        "/parser/execute",
        json={
            "query": f"Hlídej : {guardian_label}.score > 5 -> pulse",
            "parser_version": "v2",
            "galaxy_id": galaxy_id,
        },
    )
    assert guardian_execute.status_code == 200, guardian_execute.text
    guardian_body = guardian_execute.json()
    assert any(task.get("action") == "ADD_GUARDIAN" for task in guardian_body.get("tasks", []))

    delete_label = f"SemDelete-{uuid.uuid4().hex[:8]}"
    seeded_delete = client.post("/civilizations/ingest", json={"value": delete_label, "galaxy_id": galaxy_id})
    assert seeded_delete.status_code == 200, seeded_delete.text
    delete_id = seeded_delete.json()["id"]
    delete_execute = client.post(
        "/parser/execute",
        json={"query": f"Delete : {delete_label}", "parser_version": "v2", "galaxy_id": galaxy_id},
    )
    assert delete_execute.status_code == 200, delete_execute.text
    delete_body = delete_execute.json()
    assert any(task.get("action") == "DELETE" for task in delete_body.get("tasks", []))
    assert delete_id in delete_body.get("extinguished_civilization_ids", [])

    extinguish_bond = client.patch(f"/bonds/{type_bond_id}/extinguish", params={"galaxy_id": galaxy_id})
    assert extinguish_bond.status_code == 200, extinguish_bond.text
    assert extinguish_bond.json()["id"] == type_bond_id
    assert extinguish_bond.json()["is_deleted"] is True

    extinguish_asteroid = client.patch(f"/civilizations/{guardian_id}/extinguish", params={"galaxy_id": galaxy_id})
    assert extinguish_asteroid.status_code == 200, extinguish_asteroid.text
    assert extinguish_asteroid.json()["id"] == guardian_id
    assert extinguish_asteroid.json()["is_deleted"] is True

    empty_planet_name = f"SemPlanet > Empty-{uuid.uuid4().hex[:8]}"
    created_planet = client.post(
        "/planets",
        json={
            "name": empty_planet_name,
            "archetype": "catalog",
            "initial_schema_mode": "empty",
            "galaxy_id": galaxy_id,
            "idempotency_key": f"sem-planet-create-{uuid.uuid4()}",
        },
    )
    assert created_planet.status_code == 201, created_planet.text
    table_id = created_planet.json()["table_id"]
    extinguish_planet = client.patch(f"/planets/{table_id}/extinguish", params={"galaxy_id": galaxy_id})
    assert extinguish_planet.status_code == 200, extinguish_planet.text
    assert extinguish_planet.json()["table_id"] == table_id
    assert extinguish_planet.json()["extinguished"] is True

    normalized_branch_name = "  Sprint Alpha "
    first_branch = client.post("/branches", json={"name": normalized_branch_name, "galaxy_id": galaxy_id})
    assert first_branch.status_code == 201, first_branch.text
    second_branch = client.post("/branches", json={"name": "SPRINT ALPHA", "galaxy_id": galaxy_id})
    assert second_branch.status_code == 409, second_branch.text
    assert "already exists" in str(second_branch.json().get("detail", "")).lower()

    extinguish_galaxy = client.patch(f"/galaxies/{galaxy_id}/extinguish")
    assert extinguish_galaxy.status_code == 200, extinguish_galaxy.text
    assert extinguish_galaxy.json()["id"] == galaxy_id
    assert extinguish_galaxy.json()["deleted_at"] is not None


def test_task_executor_rolls_back_on_failed_link(auth_client: tuple[httpx.Client, str]) -> None:
    client, galaxy_id = auth_client
    token = f"rollback-probe-{uuid.uuid4()}"

    fail = client.post("/parser/execute", json={"query": f"{token} + {token}", "galaxy_id": galaxy_id})
    assert fail.status_code == 422

    snapshot = client.get("/universe/snapshot", params={"galaxy_id": galaxy_id})
    assert snapshot.status_code == 200
    atoms = snapshot.json()["civilizations"]
    atom_values = [_stringify(atom["value"]) for atom in atoms]
    assert not any(token in value for value in atom_values)


def test_snapshot_excludes_soft_deleted_atoms_and_orphaned_bonds(auth_client: tuple[httpx.Client, str]) -> None:
    client, galaxy_id = auth_client
    a_label = f"snapshot-a-{uuid.uuid4()}"
    b_label = f"snapshot-b-{uuid.uuid4()}"

    atom_a = client.post("/civilizations/ingest", json={"value": a_label, "galaxy_id": galaxy_id})
    atom_b = client.post("/civilizations/ingest", json={"value": b_label, "galaxy_id": galaxy_id})
    assert atom_a.status_code == 200, atom_a.text
    assert atom_b.status_code == 200, atom_b.text
    atom_a_id = atom_a.json()["id"]
    atom_b_id = atom_b.json()["id"]

    bond = client.post(
        "/bonds/link",
        json={
            "source_civilization_id": atom_a_id,
            "target_civilization_id": atom_b_id,
            "type": "REL_TEST",
            "galaxy_id": galaxy_id,
        },
    )
    assert bond.status_code == 200, bond.text
    bond_id = bond.json()["id"]

    before = client.get("/universe/snapshot", params={"galaxy_id": galaxy_id})
    assert before.status_code == 200
    before_body = before.json()
    before_atom_ids = {atom["id"] for atom in before_body["civilizations"]}
    before_bond_ids = {edge["id"] for edge in before_body["bonds"]}
    assert atom_a_id in before_atom_ids
    assert atom_b_id in before_atom_ids
    assert bond_id in before_bond_ids

    extinguish_atom = client.patch(f"/civilizations/{atom_a_id}/extinguish", params={"galaxy_id": galaxy_id})
    assert extinguish_atom.status_code == 200, extinguish_atom.text

    after = client.get("/universe/snapshot", params={"galaxy_id": galaxy_id})
    assert after.status_code == 200
    after_body = after.json()
    after_atom_ids = {atom["id"] for atom in after_body["civilizations"]}
    after_bond_ids = {edge["id"] for edge in after_body["bonds"]}
    assert atom_a_id not in after_atom_ids
    assert bond_id not in after_bond_ids


def test_snapshot_as_of_returns_historical_state(auth_client: tuple[httpx.Client, str]) -> None:
    client, galaxy_id = auth_client
    label_a = f"asof-a-{uuid.uuid4()}"
    label_b = f"asof-b-{uuid.uuid4()}"

    atom_a = client.post("/civilizations/ingest", json={"value": label_a, "galaxy_id": galaxy_id})
    atom_b = client.post("/civilizations/ingest", json={"value": label_b, "galaxy_id": galaxy_id})
    assert atom_a.status_code == 200, atom_a.text
    assert atom_b.status_code == 200, atom_b.text

    atom_a_body = atom_a.json()
    atom_b_body = atom_b.json()
    atom_a_id = atom_a_body["id"]
    atom_b_id = atom_b_body["id"]

    bond = client.post(
        "/bonds/link",
        json={
            "source_civilization_id": atom_a_id,
            "target_civilization_id": atom_b_id,
            "type": "ASOF_REL",
            "galaxy_id": galaxy_id,
        },
    )
    assert bond.status_code == 200, bond.text
    bond_body = bond.json()
    bond_id = bond_body["id"]

    created_at = _parse_iso_datetime(atom_a_body["created_at"])
    before_creation = (created_at - timedelta(milliseconds=1)).isoformat()

    snapshot_before_creation = client.get(
        "/universe/snapshot", params={"as_of": before_creation, "galaxy_id": galaxy_id}
    )
    assert snapshot_before_creation.status_code == 200
    before_creation_ids = {atom["id"] for atom in snapshot_before_creation.json()["civilizations"]}
    assert atom_a_id not in before_creation_ids
    assert atom_b_id not in before_creation_ids

    extinguish = client.patch(f"/civilizations/{atom_a_id}/extinguish", params={"galaxy_id": galaxy_id})
    assert extinguish.status_code == 200, extinguish.text
    deleted_at = _parse_iso_datetime(extinguish.json()["deleted_at"])

    bond_created_at = _parse_iso_datetime(bond_body["created_at"])
    as_of_alive = bond_created_at.isoformat()
    snapshot_alive = client.get("/universe/snapshot", params={"as_of": as_of_alive, "galaxy_id": galaxy_id})
    assert snapshot_alive.status_code == 200
    alive_body = snapshot_alive.json()
    alive_atom_ids = {atom["id"] for atom in alive_body["civilizations"]}
    alive_bond_ids = {edge["id"] for edge in alive_body["bonds"]}
    assert atom_a_id in alive_atom_ids
    assert atom_b_id in alive_atom_ids
    assert bond_id in alive_bond_ids

    as_of_after_delete = (deleted_at + timedelta(milliseconds=1)).isoformat()
    snapshot_after_delete = client.get(
        "/universe/snapshot",
        params={"as_of": as_of_after_delete, "galaxy_id": galaxy_id},
    )
    assert snapshot_after_delete.status_code == 200
    after_delete_body = snapshot_after_delete.json()
    after_delete_atom_ids = {atom["id"] for atom in after_delete_body["civilizations"]}
    after_delete_bond_ids = {edge["id"] for edge in after_delete_body["bonds"]}
    assert atom_a_id not in after_delete_atom_ids
    assert bond_id not in after_delete_bond_ids


def test_parser_metadata_parentheses_are_persisted_and_visible_in_snapshot(
    auth_client: tuple[httpx.Client, str],
) -> None:
    client, galaxy_id = auth_client
    company = f"Firma-{uuid.uuid4()}"
    product = f"Produkt-{uuid.uuid4()}"
    command = f"{company} (obor: IT, mesto=Praha) + {product} (cena: 500, mena: CZK)"

    execute = client.post("/parser/execute", json={"query": command, "galaxy_id": galaxy_id})
    assert execute.status_code == 200, execute.text
    body = execute.json()

    ingest_tasks = [task for task in body["tasks"] if task["action"] == "INGEST"]
    assert len(ingest_tasks) == 2
    assert ingest_tasks[0]["params"]["metadata"] == {"obor": "IT", "mesto": "Praha"}
    assert ingest_tasks[1]["params"]["metadata"] == {"cena": "500", "mena": "CZK"}

    atoms_by_value = {_stringify(atom["value"]): atom for atom in body["civilizations"]}
    assert atoms_by_value[company]["metadata"] == {"obor": "IT", "mesto": "Praha"}
    assert atoms_by_value[product]["metadata"] == {"cena": "500", "mena": "CZK"}

    snapshot = client.get("/universe/snapshot", params={"galaxy_id": galaxy_id})
    assert snapshot.status_code == 200, snapshot.text
    snapshot_atoms = {_stringify(atom["value"]): atom for atom in snapshot.json()["civilizations"]}

    company_atom = snapshot_atoms[company]
    product_atom = snapshot_atoms[product]
    assert company_atom["metadata"] == {"obor": "IT", "mesto": "Praha"}
    assert product_atom["metadata"].get("mena") == "CZK"
    assert product_atom["metadata"].get("cena") in {"500", 500}
    assert isinstance(company_atom["created_at"], str) and company_atom["created_at"]
    assert isinstance(product_atom["created_at"], str) and product_atom["created_at"]


def test_delete_command_soft_deletes_atom_and_hides_from_live_snapshot(auth_client: tuple[httpx.Client, str]) -> None:
    client, galaxy_id = auth_client
    label = f"delete-me-{uuid.uuid4()}"
    created = client.post("/civilizations/ingest", json={"value": label, "galaxy_id": galaxy_id})
    assert created.status_code == 200, created.text
    atom_id = created.json()["id"]

    deleted = client.post("/parser/execute", json={"query": f"Delete : {label}", "galaxy_id": galaxy_id})
    assert deleted.status_code == 200, deleted.text
    deleted_body = deleted.json()
    assert deleted_body["tasks"][0]["action"] == "DELETE"
    assert atom_id in deleted_body["extinguished_civilization_ids"]

    snapshot_live = client.get("/universe/snapshot", params={"galaxy_id": galaxy_id})
    assert snapshot_live.status_code == 200, snapshot_live.text
    live_values = {_stringify(atom["value"]) for atom in snapshot_live.json()["civilizations"]}
    assert label not in live_values


def test_delete_command_soft_deletes_connected_bond_and_returns_bond_id(auth_client: tuple[httpx.Client, str]) -> None:
    client, galaxy_id = auth_client
    a_label = f"delete-bond-a-{uuid.uuid4()}"
    b_label = f"delete-bond-b-{uuid.uuid4()}"

    atom_a = client.post("/civilizations/ingest", json={"value": a_label, "galaxy_id": galaxy_id})
    atom_b = client.post("/civilizations/ingest", json={"value": b_label, "galaxy_id": galaxy_id})
    assert atom_a.status_code == 200, atom_a.text
    assert atom_b.status_code == 200, atom_b.text

    atom_a_id = atom_a.json()["id"]
    atom_b_id = atom_b.json()["id"]
    linked = client.post(
        "/bonds/link",
        json={
            "source_civilization_id": atom_a_id,
            "target_civilization_id": atom_b_id,
            "type": "REL_DELETE",
            "galaxy_id": galaxy_id,
        },
    )
    assert linked.status_code == 200, linked.text
    bond_id = linked.json()["id"]

    deleted = client.post("/parser/execute", json={"query": f"Delete : {a_label}", "galaxy_id": galaxy_id})
    assert deleted.status_code == 200, deleted.text
    deleted_body = deleted.json()
    assert deleted_body["tasks"][0]["action"] == "DELETE"
    assert atom_a_id in deleted_body["extinguished_civilization_ids"]
    assert bond_id in deleted_body["extinguished_bond_ids"]

    snapshot_live = client.get("/universe/snapshot", params={"galaxy_id": galaxy_id})
    assert snapshot_live.status_code == 200, snapshot_live.text
    live_body = snapshot_live.json()
    live_atom_ids = {atom["id"] for atom in live_body["civilizations"]}
    live_bond_ids = {bond["id"] for bond in live_body["bonds"]}
    assert atom_a_id not in live_atom_ids
    assert atom_b_id in live_atom_ids
    assert bond_id not in live_bond_ids


def test_set_formula_command_is_calculated_in_snapshot_output(auth_client: tuple[httpx.Client, str]) -> None:
    client, galaxy_id = auth_client
    project = f"Projekt-{uuid.uuid4()}"
    item_a = f"PolozkaA-{uuid.uuid4()}"
    item_b = f"PolozkaB-{uuid.uuid4()}"

    project_resp = client.post("/civilizations/ingest", json={"value": project, "galaxy_id": galaxy_id})
    a_resp = client.post(
        "/civilizations/ingest",
        json={"value": item_a, "metadata": {"cena": 120, "state": "active"}, "galaxy_id": galaxy_id},
    )
    b_resp = client.post(
        "/civilizations/ingest",
        json={"value": item_b, "metadata": {"cena": 30, "state": "active"}, "galaxy_id": galaxy_id},
    )
    assert project_resp.status_code == 200, project_resp.text
    assert a_resp.status_code == 200, a_resp.text
    assert b_resp.status_code == 200, b_resp.text

    project_id = project_resp.json()["id"]
    a_id = a_resp.json()["id"]
    b_id = b_resp.json()["id"]

    link_a = client.post(
        "/bonds/link",
        json={
            "source_civilization_id": a_id,
            "target_civilization_id": project_id,
            "type": "FLOW",
            "galaxy_id": galaxy_id,
        },
    )
    link_b = client.post(
        "/bonds/link",
        json={
            "source_civilization_id": b_id,
            "target_civilization_id": project_id,
            "type": "FLOW",
            "galaxy_id": galaxy_id,
        },
    )
    assert link_a.status_code == 200, link_a.text
    assert link_b.status_code == 200, link_b.text

    set_formula = client.post(
        "/parser/execute",
        json={"query": f"Spočítej : {project}.celkem = SUM(cena)", "galaxy_id": galaxy_id},
    )
    assert set_formula.status_code == 200, set_formula.text
    set_formula_body = set_formula.json()
    assert set_formula_body["tasks"][0]["action"] == "SET_FORMULA"
    assert set_formula_body["civilizations"][0]["metadata"]["celkem"] == "=SUM(cena)"

    snapshot = client.get("/universe/snapshot", params={"galaxy_id": galaxy_id})
    assert snapshot.status_code == 200, snapshot.text
    atoms_by_value = {_stringify(atom["value"]): atom for atom in snapshot.json()["civilizations"]}
    assert atoms_by_value[project]["metadata"]["celkem"] in {"=SUM(cena)", 0, 150}
    assert atoms_by_value[project]["calculated_values"]["celkem"] in {0, 150}


def test_mutate_asteroid_updates_value_and_metadata(auth_client: tuple[httpx.Client, str]) -> None:
    client, galaxy_id = auth_client
    original = f"Mutate-{uuid.uuid4()}"
    renamed = f"Mutate-Renamed-{uuid.uuid4()}"

    created = client.post("/civilizations/ingest", json={"value": original, "galaxy_id": galaxy_id})
    assert created.status_code == 200, created.text
    civilization_id = created.json()["id"]

    patch_value = client.patch(
        f"/civilizations/{civilization_id}/mutate",
        json={"value": renamed, "galaxy_id": galaxy_id},
    )
    assert patch_value.status_code == 200, patch_value.text
    assert _stringify(patch_value.json()["value"]) == renamed

    patch_meta = client.patch(
        f"/civilizations/{civilization_id}/mutate",
        json={"metadata": {"stav": "aktivni"}, "galaxy_id": galaxy_id},
    )
    assert patch_meta.status_code == 200, patch_meta.text
    assert patch_meta.json()["metadata"]["stav"] == "aktivni"

    snapshot = client.get("/universe/snapshot", params={"galaxy_id": galaxy_id})
    assert snapshot.status_code == 200, snapshot.text
    by_value = {_stringify(atom["value"]): atom for atom in snapshot.json()["civilizations"]}
    assert renamed in by_value
    assert by_value[renamed]["metadata"]["stav"] == "aktivni"


def test_mutate_asteroid_occ_rejects_stale_expected_event_seq(auth_client: tuple[httpx.Client, str]) -> None:
    client, galaxy_id = auth_client
    original = f"OCC-Mutate-{uuid.uuid4()}"
    renamed = f"OCC-Mutate-Renamed-{uuid.uuid4()}"

    created = client.post("/civilizations/ingest", json={"value": original, "galaxy_id": galaxy_id})
    assert created.status_code == 200, created.text
    civilization_id = created.json()["id"]
    initial_seq = _latest_entity_event_seq(client, galaxy_id=galaxy_id, entity_id=civilization_id)

    ok_mutate = client.patch(
        f"/civilizations/{civilization_id}/mutate",
        json={"value": renamed, "expected_event_seq": initial_seq, "galaxy_id": galaxy_id},
    )
    assert ok_mutate.status_code == 200, ok_mutate.text

    stale_mutate = client.patch(
        f"/civilizations/{civilization_id}/mutate",
        json={"metadata": {"status": "stale-write"}, "expected_event_seq": initial_seq, "galaxy_id": galaxy_id},
    )
    detail = _assert_occ_conflict(stale_mutate, expected_event_seq=initial_seq)
    assert "update_asteroid" in detail["context"].lower()
    assert detail["entity_id"] == civilization_id

    snapshot = client.get("/universe/snapshot", params={"galaxy_id": galaxy_id})
    assert snapshot.status_code == 200, snapshot.text
    by_value = {_stringify(atom["value"]): atom for atom in snapshot.json()["civilizations"]}
    assert renamed in by_value
    assert by_value[renamed]["metadata"].get("status") != "stale-write"


def test_mutate_asteroid_occ_parallel_writes_allow_single_winner(auth_client: tuple[httpx.Client, str]) -> None:
    client, galaxy_id = auth_client
    original = f"OCC-Parallel-{uuid.uuid4()}"
    auth_header = str(client.headers.get("Authorization") or "")
    assert auth_header.startswith("Bearer "), "Missing auth header in test client"

    created = client.post("/civilizations/ingest", json={"value": original, "galaxy_id": galaxy_id})
    assert created.status_code == 200, created.text
    civilization_id = created.json()["id"]
    initial_seq = _latest_entity_event_seq(client, galaxy_id=galaxy_id, entity_id=civilization_id)

    outcomes = _parallel_mutate_with_expected_seq(
        auth_header=auth_header,
        galaxy_id=galaxy_id,
        civilization_id=civilization_id,
        expected_event_seq=initial_seq,
    )
    statuses = sorted(status for status, _ in outcomes)
    assert statuses == [200, 409], outcomes

    conflict_payload = next(payload for status, payload in outcomes if status == 409)
    detail = conflict_payload.get("detail", {})
    assert isinstance(detail, dict), conflict_payload
    assert detail.get("code") == "OCC_CONFLICT"
    assert detail.get("expected_event_seq") == initial_seq

    snapshot_after = _snapshot_asteroid(client, galaxy_id=galaxy_id, civilization_id=civilization_id)
    assert snapshot_after["current_event_seq"] == initial_seq + 1
    assert snapshot_after["metadata"].get("race_status") in {"A", "B"}


def test_snapshot_and_write_responses_expose_current_event_seq(auth_client: tuple[httpx.Client, str]) -> None:
    client, galaxy_id = auth_client
    label = f"SeqProbe-{uuid.uuid4()}"
    renamed = f"SeqProbe-Renamed-{uuid.uuid4()}"

    created = client.post("/civilizations/ingest", json={"value": label, "galaxy_id": galaxy_id})
    assert created.status_code == 200, created.text
    civilization = created.json()
    civilization_id = civilization["id"]
    assert isinstance(civilization.get("current_event_seq"), int)
    assert civilization["current_event_seq"] > 0

    snapshot_before = _snapshot_asteroid(client, galaxy_id=galaxy_id, civilization_id=civilization_id)
    assert snapshot_before["current_event_seq"] == civilization["current_event_seq"]

    mutated = client.patch(
        f"/civilizations/{civilization_id}/mutate",
        json={"value": renamed, "galaxy_id": galaxy_id},
    )
    assert mutated.status_code == 200, mutated.text
    mutated_body = mutated.json()
    assert mutated_body["current_event_seq"] > civilization["current_event_seq"]

    snapshot_after = _snapshot_asteroid(client, galaxy_id=galaxy_id, civilization_id=civilization_id)
    assert snapshot_after["current_event_seq"] == mutated_body["current_event_seq"]


def test_mutate_idempotency_key_replays_success_and_guards_payload(auth_client: tuple[httpx.Client, str]) -> None:
    client, galaxy_id = auth_client
    label = f"IdemMut-{uuid.uuid4()}"
    key = f"idem-{uuid.uuid4()}"

    created = client.post("/civilizations/ingest", json={"value": label, "galaxy_id": galaxy_id})
    assert created.status_code == 200, created.text
    civilization_id = created.json()["id"]

    first = client.patch(
        f"/civilizations/{civilization_id}/mutate",
        json={"metadata": {"stage": "done"}, "idempotency_key": key, "galaxy_id": galaxy_id},
    )
    assert first.status_code == 200, first.text
    first_body = first.json()

    replay = client.patch(
        f"/civilizations/{civilization_id}/mutate",
        json={"metadata": {"stage": "done"}, "idempotency_key": key, "galaxy_id": galaxy_id},
    )
    assert replay.status_code == 200, replay.text
    replay_body = replay.json()
    assert replay_body["id"] == first_body["id"]
    assert replay_body["current_event_seq"] == first_body["current_event_seq"]

    no_key_repeat = client.patch(
        f"/civilizations/{civilization_id}/mutate",
        json={"metadata": {"stage": "done"}, "galaxy_id": galaxy_id},
    )
    assert no_key_repeat.status_code == 422

    key_conflict = client.patch(
        f"/civilizations/{civilization_id}/mutate",
        json={"metadata": {"stage": "other"}, "idempotency_key": key, "galaxy_id": galaxy_id},
    )
    assert key_conflict.status_code == 409
    assert "Idempotency key" in key_conflict.text


def test_parser_execute_idempotency_key_replays_and_conflicts(auth_client: tuple[httpx.Client, str]) -> None:
    client, galaxy_id = auth_client
    label = f"IdemParser-{uuid.uuid4()}"
    key = f"idem-parser-{uuid.uuid4()}"

    first = client.post(
        "/parser/execute",
        json={"query": label, "idempotency_key": key, "galaxy_id": galaxy_id},
    )
    assert first.status_code == 200, first.text
    first_body = first.json()
    assert first_body["civilizations"]
    civilization_id = first_body["civilizations"][0]["id"]
    first_seq = first_body["civilizations"][0]["current_event_seq"]

    replay = client.post(
        "/parser/execute",
        json={"query": label, "idempotency_key": key, "galaxy_id": galaxy_id},
    )
    assert replay.status_code == 200, replay.text
    replay_body = replay.json()
    assert replay_body["civilizations"][0]["id"] == civilization_id
    assert replay_body["civilizations"][0]["current_event_seq"] == first_seq

    snapshot = _snapshot_asteroid(client, galaxy_id=galaxy_id, civilization_id=civilization_id)
    assert snapshot["current_event_seq"] == first_seq

    conflict = client.post(
        "/parser/execute",
        json={"query": f"{label}-other", "idempotency_key": key, "galaxy_id": galaxy_id},
    )
    assert conflict.status_code == 409
    assert "Idempotency key" in conflict.text


def test_extinguish_asteroid_occ_rejects_stale_expected_event_seq(auth_client: tuple[httpx.Client, str]) -> None:
    client, galaxy_id = auth_client
    label = f"OCC-Delete-{uuid.uuid4()}"

    created = client.post("/civilizations/ingest", json={"value": label, "galaxy_id": galaxy_id})
    assert created.status_code == 200, created.text
    civilization_id = created.json()["id"]
    initial_seq = _latest_entity_event_seq(client, galaxy_id=galaxy_id, entity_id=civilization_id)

    updated = client.patch(
        f"/civilizations/{civilization_id}/mutate",
        json={"metadata": {"phase": "updated"}, "galaxy_id": galaxy_id},
    )
    assert updated.status_code == 200, updated.text

    stale_delete = client.patch(
        f"/civilizations/{civilization_id}/extinguish",
        params={"galaxy_id": galaxy_id, "expected_event_seq": initial_seq},
    )
    detail = _assert_occ_conflict(stale_delete, expected_event_seq=initial_seq)
    assert "delete" in detail["context"].lower()

    snapshot = client.get("/universe/snapshot", params={"galaxy_id": galaxy_id})
    assert snapshot.status_code == 200, snapshot.text
    values = {_stringify(atom["value"]) for atom in snapshot.json()["civilizations"]}
    assert label in values


def test_link_occ_rejects_stale_expected_source_seq(auth_client: tuple[httpx.Client, str]) -> None:
    client, galaxy_id = auth_client
    source_label = f"OCC-Link-S-{uuid.uuid4()}"
    target_label = f"OCC-Link-T-{uuid.uuid4()}"

    source = client.post("/civilizations/ingest", json={"value": source_label, "galaxy_id": galaxy_id})
    target = client.post("/civilizations/ingest", json={"value": target_label, "galaxy_id": galaxy_id})
    assert source.status_code == 200, source.text
    assert target.status_code == 200, target.text
    source_civilization_id = source.json()["id"]
    target_civilization_id = target.json()["id"]
    source_seq = _latest_entity_event_seq(client, galaxy_id=galaxy_id, entity_id=source_civilization_id)
    target_seq = _latest_entity_event_seq(client, galaxy_id=galaxy_id, entity_id=target_civilization_id)

    source_mutate = client.patch(
        f"/civilizations/{source_civilization_id}/mutate",
        json={"metadata": {"touch": "new"}, "galaxy_id": galaxy_id},
    )
    assert source_mutate.status_code == 200, source_mutate.text

    stale_link = client.post(
        "/bonds/link",
        json={
            "source_civilization_id": source_civilization_id,
            "target_civilization_id": target_civilization_id,
            "type": "RELATION",
            "expected_source_event_seq": source_seq,
            "expected_target_event_seq": target_seq,
            "galaxy_id": galaxy_id,
        },
    )
    detail = _assert_occ_conflict(stale_link, expected_event_seq=source_seq)
    assert "source" in detail["context"].lower()


def test_guardian_command_is_idempotent_for_same_rule(auth_client: tuple[httpx.Client, str]) -> None:
    client, galaxy_id = auth_client
    project = f"GuardianProjekt-{uuid.uuid4()}"

    created = client.post(
        "/civilizations/ingest",
        json={"value": project, "metadata": {"celkem": 1200}, "galaxy_id": galaxy_id},
    )
    assert created.status_code == 200, created.text

    cmd = f"Hlídej : {project}.celkem > 1000 -> pulse"
    first = client.post("/parser/execute", json={"query": cmd, "galaxy_id": galaxy_id})
    second = client.post("/parser/execute", json={"query": cmd, "galaxy_id": galaxy_id})
    assert first.status_code == 200, first.text
    assert second.status_code == 200, second.text

    snapshot = client.get("/universe/snapshot", params={"galaxy_id": galaxy_id})
    assert snapshot.status_code == 200, snapshot.text
    civilizations = {_stringify(atom["value"]): atom for atom in snapshot.json()["civilizations"]}
    civilization = civilizations[project]

    guardians = civilization["metadata"].get("_guardians", [])
    assert isinstance(guardians, list)
    matching = [
        rule
        for rule in guardians
        if isinstance(rule, dict)
        and rule.get("field") == "celkem"
        and rule.get("operator") == ">"
        and rule.get("threshold") == 1000
        and rule.get("action") == "pulse"
    ]
    assert len(matching) == 1


def test_execute_tasks_rollback_after_partial_write(auth_client: tuple[httpx.Client, str]) -> None:
    client, galaxy_id = auth_client
    label = f"rollback-after-write-{uuid.uuid4()}"
    # First INGEST succeeds in executor loop, LINK fails (same source/target), whole tx must rollback.
    failed = client.post("/parser/execute", json={"query": f"{label} + {label}", "galaxy_id": galaxy_id})
    assert failed.status_code == 422, failed.text

    snapshot = client.get("/universe/snapshot", params={"galaxy_id": galaxy_id})
    assert snapshot.status_code == 200, snapshot.text
    values = {_stringify(atom["value"]) for atom in snapshot.json()["civilizations"]}
    assert label not in values

    # Session/API must remain usable after failed tx.
    ok = client.post("/civilizations/ingest", json={"value": label, "galaxy_id": galaxy_id})
    assert ok.status_code == 200, ok.text


def test_forbidden_access_to_foreign_galaxy(client: httpx.Client) -> None:
    email_a = f"tenant-a-{uuid.uuid4()}@dataverse.local"
    email_b = f"tenant-b-{uuid.uuid4()}@dataverse.local"
    password = "Passw0rd123!"

    reg_a = client.post("/auth/register", json={"email": email_a, "password": password, "galaxy_name": "A"})
    reg_b = client.post("/auth/register", json={"email": email_b, "password": password, "galaxy_name": "B"})
    assert reg_a.status_code == 201, reg_a.text
    assert reg_b.status_code == 201, reg_b.text

    token_a = reg_a.json()["access_token"]
    galaxy_b = reg_b.json()["default_galaxy"]["id"]

    client.headers.update({"Authorization": f"Bearer {token_a}"})
    forbidden = client.get("/universe/snapshot", params={"galaxy_id": galaxy_b})
    assert forbidden.status_code == 403, forbidden.text


def test_snapshot_v1_contract_contains_table_projection_fields(auth_client: tuple[httpx.Client, str]) -> None:
    client, galaxy_id = auth_client
    command = f"Firma-{uuid.uuid4()} (category: Firma) + Produkt-{uuid.uuid4()} (table: Nabidka)"
    execute = client.post("/parser/execute", json={"query": command, "galaxy_id": galaxy_id})
    assert execute.status_code == 200, execute.text

    snapshot = client.get("/universe/snapshot", params={"galaxy_id": galaxy_id})
    assert snapshot.status_code == 200, snapshot.text
    body = snapshot.json()
    assert "civilizations" in body
    assert "bonds" in body
    assert isinstance(body["civilizations"], list)
    assert isinstance(body["bonds"], list)
    assert body["civilizations"], "Expected at least one civilization in snapshot"

    civilization = body["civilizations"][0]
    assert "table_id" in civilization
    assert "table_name" in civilization
    assert (
        "constellation_name" in civilization
        and isinstance(civilization["constellation_name"], str)
        and civilization["constellation_name"]
    )
    assert "planet_name" in civilization
    assert isinstance(civilization["planet_name"], str) and civilization["planet_name"]
    assert "metadata" in civilization
    assert "calculated_values" in civilization
    assert "active_alerts" in civilization
    assert "physics" in civilization and isinstance(civilization["physics"], dict)
    assert isinstance(civilization["physics"].get("engine_version"), str) and civilization["physics"]["engine_version"]
    assert "stress_score" in civilization["physics"]
    assert "created_at" in civilization
    assert "current_event_seq" in civilization and isinstance(civilization["current_event_seq"], int)

    if body["bonds"]:
        bond = body["bonds"][0]
        assert "source_table_id" in bond
        assert "source_table_name" in bond
        assert "source_constellation_name" in bond
        assert "source_planet_name" in bond
        assert "target_table_id" in bond
        assert "target_table_name" in bond
        assert "target_constellation_name" in bond
        assert "target_planet_name" in bond
        assert "current_event_seq" in bond and isinstance(bond["current_event_seq"], int)


def test_galaxy_dashboard_v1_endpoints_return_read_model_views(auth_client: tuple[httpx.Client, str]) -> None:
    client, galaxy_id = auth_client
    execute = client.post(
        "/parser/execute",
        json={
            "query": (
                f"DashA-{uuid.uuid4()} (table: EntitaA > Planeta1, cena: 10) + "
                f"DashB-{uuid.uuid4()} (table: EntitaB > Planeta2, cena: 20)"
            ),
            "galaxy_id": galaxy_id,
        },
    )
    assert execute.status_code == 200, execute.text

    summary = client.get(f"/galaxies/{galaxy_id}/summary")
    assert summary.status_code == 200, summary.text
    summary_body = summary.json()
    assert summary_body["galaxy_id"] == galaxy_id
    assert summary_body["moons_count"] >= 2
    assert summary_body["bonds_count"] >= 1
    assert summary_body["constellations_count"] >= 1
    assert summary_body["planets_count"] >= 1

    health = client.get(f"/galaxies/{galaxy_id}/health")
    assert health.status_code == 200, health.text
    health_body = health.json()
    assert health_body["galaxy_id"] == galaxy_id
    assert health_body["status"] in {"GREEN", "YELLOW", "RED"}
    assert isinstance(health_body["quality_score"], int)

    activity = client.get(f"/galaxies/{galaxy_id}/activity", params={"limit": 10})
    assert activity.status_code == 200, activity.text
    activity_body = activity.json()
    assert "items" in activity_body and isinstance(activity_body["items"], list)
    assert activity_body["items"], "Expected activity rows after parser execution"
    first = activity_body["items"][0]
    assert "event_id" in first
    assert "event_type" in first
    assert "event_seq" in first
    assert "happened_at" in first


def test_star_core_mvp_endpoints_return_policy_runtime_and_pulse(auth_client: tuple[httpx.Client, str]) -> None:
    client, galaxy_id = auth_client
    execute = client.post(
        "/parser/execute",
        json={
            "query": (
                f"StarA-{uuid.uuid4()} (table: Core > Pulse, amount: 5) + "
                f"StarB-{uuid.uuid4()} (table: Core > Pulse, amount: 7)"
            ),
            "galaxy_id": galaxy_id,
        },
    )
    assert execute.status_code == 200, execute.text

    policy = client.get(f"/galaxies/{galaxy_id}/star-core/policy")
    assert policy.status_code == 200, policy.text
    policy_body = policy.json()
    assert "galaxy_id" not in policy_body
    assert "user_id" not in policy_body
    assert "generated_at" not in policy_body
    assert "topology_mode" not in policy_body
    assert "soft_delete_flag_field" not in policy_body
    assert "soft_delete_timestamp_field" not in policy_body
    assert "event_sourcing_enabled" not in policy_body
    assert "locked_by" not in policy_body
    assert policy_body["no_hard_delete"] is True
    assert policy_body["deletion_mode"] == "soft_delete"
    assert policy_body["lock_status"] in {"draft", "locked"}

    physics_before = client.get(f"/galaxies/{galaxy_id}/star-core/physics/profile")
    assert physics_before.status_code == 200, physics_before.text
    physics_before_body = physics_before.json()
    assert physics_before_body["profile_key"] == "BALANCE"
    assert physics_before_body["profile_version"] == 1
    assert physics_before_body["lock_status"] in {"draft", "locked"}
    assert isinstance(physics_before_body["coefficients"], dict)
    assert "a" in physics_before_body["coefficients"]

    lock = client.post(
        f"/galaxies/{galaxy_id}/star-core/policy/lock",
        json={
            "profile_key": "SENTINEL",
            "lock_after_apply": True,
            "physical_profile_key": "FORGE",
            "physical_profile_version": 2,
        },
    )
    assert lock.status_code == 200, lock.text
    lock_body = lock.json()
    assert "galaxy_id" not in lock_body
    assert "user_id" not in lock_body
    assert "generated_at" not in lock_body
    assert "topology_mode" not in lock_body
    assert "soft_delete_flag_field" not in lock_body
    assert "soft_delete_timestamp_field" not in lock_body
    assert "event_sourcing_enabled" not in lock_body
    assert "locked_by" not in lock_body
    assert lock_body["profile_key"] == "SENTINEL"
    assert lock_body["lock_status"] == "locked"
    assert lock_body["can_edit_core_laws"] is False

    physics_after = client.get(f"/galaxies/{galaxy_id}/star-core/physics/profile")
    assert physics_after.status_code == 200, physics_after.text
    physics_after_body = physics_after.json()
    assert physics_after_body["profile_key"] == "FORGE"
    assert physics_after_body["profile_version"] == 2
    assert physics_after_body["lock_status"] == "locked"
    assert isinstance(physics_after_body["coefficients"], dict)
    assert physics_after_body["coefficients"]["a"] > 0

    second_lock = client.post(
        f"/galaxies/{galaxy_id}/star-core/policy/lock",
        json={"profile_key": "ARCHIVE", "lock_after_apply": True},
    )
    assert second_lock.status_code == 409, second_lock.text

    runtime = client.get(f"/galaxies/{galaxy_id}/star-core/runtime", params={"window_events": 64})
    assert runtime.status_code == 200, runtime.text
    runtime_body = runtime.json()
    assert "galaxy_id" not in runtime_body
    assert "user_id" not in runtime_body
    assert "branch_id" not in runtime_body
    assert "sampled_window_size" not in runtime_body
    assert "sampled_since" not in runtime_body
    assert "sampled_until" not in runtime_body
    assert "hot_event_types" not in runtime_body
    assert "hot_entities_count" not in runtime_body
    assert "updated_at" not in runtime_body
    assert runtime_body["as_of_event_seq"] >= 1
    assert runtime_body["events_count"] >= 1
    assert isinstance(runtime_body["writes_per_minute"], float)

    pulse = client.get(f"/galaxies/{galaxy_id}/star-core/pulse", params={"limit": 20})
    assert pulse.status_code == 200, pulse.text
    pulse_body = pulse.json()
    assert pulse_body["galaxy_id"] == galaxy_id
    assert pulse_body["sampled_count"] >= 1
    assert isinstance(pulse_body["event_types"], list)
    assert isinstance(pulse_body["events"], list)
    first_event = pulse_body["events"][0]
    assert "event_seq" in first_event
    assert "event_type" in first_event
    assert "entity_id" in first_event
    assert "timestamp" not in first_event
    assert "payload" not in first_event
    assert first_event["visual_hint"] in {
        "source_shockwave",
        "fade_to_singularity",
        "bridge_flux",
        "surface_pulse",
        "orbital_pulse",
    }
    assert isinstance(first_event["intensity"], float)

    domains = client.get(f"/galaxies/{galaxy_id}/star-core/metrics/domains", params={"window_events": 64})
    assert domains.status_code == 200, domains.text
    domains_body = domains.json()
    assert domains_body["galaxy_id"] == galaxy_id
    assert domains_body["sampled_window_size"] == 64
    assert isinstance(domains_body["total_events_count"], int)
    assert isinstance(domains_body["domains"], list)
    if domains_body["domains"]:
        domain = domains_body["domains"][0]
        assert "domain_name" in domain
        assert "status" in domain
        assert "events_count" in domain
        assert "activity_intensity" in domain
        assert "planets_count" not in domain
        assert "moons_count" not in domain
        assert "internal_bonds_count" not in domain
        assert "external_bonds_count" not in domain
        assert "guardian_rules_count" not in domain
        assert "alerted_moons_count" not in domain
        assert "circular_fields_count" not in domain
        assert "quality_score" not in domain
        assert "writes_per_minute" not in domain
        assert "hot_event_types" not in domain


def test_star_core_planet_physics_endpoint_returns_runtime_shape(auth_client: tuple[httpx.Client, str]) -> None:
    client, galaxy_id = auth_client
    execute = client.post(
        "/parser/execute",
        json={
            "query": (
                f"PhyA-{uuid.uuid4()} (table: Physics > Prime, amount: 11) + "
                f"PhyB-{uuid.uuid4()} (table: Physics > Prime, amount: 13)"
            ),
            "galaxy_id": galaxy_id,
        },
    )
    assert execute.status_code == 200, execute.text

    runtime = client.get(
        f"/galaxies/{galaxy_id}/star-core/physics/planets",
        params={"limit": 128},
    )
    assert runtime.status_code == 200, runtime.text
    body = runtime.json()
    assert isinstance(body.get("as_of_event_seq"), int)
    assert body["as_of_event_seq"] >= 1
    assert isinstance(body.get("items"), list)
    assert body["items"], "Expected at least one planet runtime physics item"

    item = body["items"][0]
    assert "table_id" in item
    assert item["phase"] in {"ACTIVE", "OVERLOADED", "DORMANT", "CORRODING", "CRITICAL", "CALM"}
    assert isinstance(item.get("source_event_seq"), int)
    assert isinstance(item.get("engine_version"), str)

    metrics = item.get("metrics")
    assert isinstance(metrics, dict)
    for key in ("activity", "stress", "health", "inactivity", "corrosion"):
        assert isinstance(metrics.get(key), float)
    assert isinstance(metrics.get("rows"), int)

    visual = item.get("visual")
    assert isinstance(visual, dict)
    for key in ("size_factor", "luminosity", "pulse_rate", "hue", "saturation", "corrosion_level", "crack_intensity"):
        assert isinstance(visual.get(key), float)

    after_seq = client.get(
        f"/galaxies/{galaxy_id}/star-core/physics/planets",
        params={"after_event_seq": body["as_of_event_seq"], "limit": 128},
    )
    assert after_seq.status_code == 200, after_seq.text
    after_body = after_seq.json()
    assert isinstance(after_body.get("items"), list)


def test_planet_preview_payload_parity_v1(auth_client: tuple[httpx.Client, str]) -> None:
    client, galaxy_id = auth_client
    created_planet = client.post(
        "/planets",
        json={
            "name": f"P6-01 > Parity-{uuid.uuid4().hex[:8]}",
            "archetype": "catalog",
            "initial_schema_mode": "empty",
            "galaxy_id": galaxy_id,
            "idempotency_key": f"p6-01-parity-planet-{uuid.uuid4()}",
        },
    )
    assert created_planet.status_code == 201, created_planet.text
    planet_id = str(created_planet.json()["table_id"])

    row_a = client.post(
        "/civilizations",
        json={
            "galaxy_id": galaxy_id,
            "planet_id": planet_id,
            "label": "P6-01 Parity A",
            "minerals": {
                "entity_id": f"p6-01-a-{uuid.uuid4().hex[:8]}",
                "label": "P6-01 Parity A",
                "state": "active",
                "amount": 17,
            },
            "idempotency_key": f"p6-01-parity-row-a-{uuid.uuid4()}",
        },
    )
    assert row_a.status_code == 201, row_a.text
    row_b = client.post(
        "/civilizations",
        json={
            "galaxy_id": galaxy_id,
            "planet_id": planet_id,
            "label": "P6-01 Parity B",
            "minerals": {
                "entity_id": f"p6-01-b-{uuid.uuid4().hex[:8]}",
                "label": "P6-01 Parity B",
                "state": "active",
                "amount": 29,
            },
            "idempotency_key": f"p6-01-parity-row-b-{uuid.uuid4()}",
        },
    )
    assert row_b.status_code == 201, row_b.text

    def _preview_payload(item: dict) -> dict:
        metrics = item.get("metrics") if isinstance(item.get("metrics"), dict) else {}
        visual = item.get("visual") if isinstance(item.get("visual"), dict) else {}
        return {
            "table_id": str(item.get("table_id") or ""),
            "phase": str(item.get("phase") or "").upper(),
            "corrosion_level": round(float(visual.get("corrosion_level") or 0), 6),
            "crack_intensity": round(float(visual.get("crack_intensity") or 0), 6),
            "pulse_factor": round(float(visual.get("pulse_rate") or 0), 6),
            "emissive_boost": round(float(visual.get("luminosity") or 0), 6),
            "health": round(float(metrics.get("health") or 0), 6),
            "source_event_seq": int(item.get("source_event_seq") or 0),
        }

    runtime_a = client.get(
        f"/galaxies/{galaxy_id}/star-core/physics/planets",
        params={"limit": 256},
    )
    assert runtime_a.status_code == 200, runtime_a.text
    body_a = runtime_a.json()
    items_a = body_a.get("items", [])
    assert isinstance(items_a, list) and items_a

    parity_a = {}
    for raw_item in items_a:
        payload = _preview_payload(raw_item)
        table_id = payload["table_id"]
        if not table_id:
            continue
        assert payload["phase"] in {"ACTIVE", "OVERLOADED", "DORMANT", "CORRODING", "CRITICAL", "CALM"}
        assert 0.0 <= payload["corrosion_level"] <= 1.0
        assert 0.0 <= payload["crack_intensity"] <= 1.0
        assert payload["pulse_factor"] >= 0.0
        assert 0.0 <= payload["emissive_boost"] <= 1.0
        assert 0.0 <= payload["health"] <= 1.0
        assert payload["source_event_seq"] >= 0
        parity_a[table_id] = payload
    assert parity_a, "Expected at least one normalized preview payload row"

    runtime_b = client.get(
        f"/galaxies/{galaxy_id}/star-core/physics/planets",
        params={"limit": 256},
    )
    assert runtime_b.status_code == 200, runtime_b.text
    items_b = runtime_b.json().get("items", [])
    assert isinstance(items_b, list) and items_b
    normalized_b = (_preview_payload(item) for item in items_b)
    parity_b = {payload["table_id"]: payload for payload in normalized_b if payload["table_id"]}

    shared_table_ids = sorted(set(parity_a.keys()) & set(parity_b.keys()))
    assert shared_table_ids, "Expected overlap between repeated runtime pulls for parity check"
    for table_id in shared_table_ids:
        assert parity_b[table_id] == parity_a[table_id]


def test_planet_moon_preview_convergence_lifecycle_v1(auth_client: tuple[httpx.Client, str]) -> None:
    client, galaxy_id = auth_client
    planet_name = f"P6-03 > Lifecycle-{uuid.uuid4().hex[:8]}"
    created_planet = client.post(
        "/planets",
        json={
            "name": planet_name,
            "archetype": "catalog",
            "initial_schema_mode": "empty",
            "galaxy_id": galaxy_id,
            "idempotency_key": f"p6-03-lifecycle-planet-{uuid.uuid4()}",
        },
    )
    assert created_planet.status_code == 201, created_planet.text
    table_id = str(created_planet.json()["table_id"])

    created = client.post(
        "/civilizations",
        json={
            "galaxy_id": galaxy_id,
            "planet_id": table_id,
            "label": "P6-03 Lifecycle Seed",
            "minerals": {
                "entity_id": f"p6-03-seed-{uuid.uuid4().hex[:8]}",
                "label": "P6-03 Lifecycle Seed",
                "state": "active",
            },
            "idempotency_key": f"p6-03-lifecycle-create-{uuid.uuid4()}",
        },
    )
    assert created.status_code == 201, created.text
    created_body = created.json()
    moon_id = str(created_body["moon_id"])
    event_seq = int(created_body.get("current_event_seq") or 0)
    assert event_seq >= 1

    allowed_phases = {"ACTIVE", "OVERLOADED", "DORMANT", "CORRODING", "CRITICAL", "CALM"}

    def _preview_row() -> dict:
        runtime = client.get(
            f"/galaxies/{galaxy_id}/star-core/physics/planets",
            params={"limit": 256},
        )
        assert runtime.status_code == 200, runtime.text
        items = runtime.json().get("items", [])
        assert isinstance(items, list)
        row = next((item for item in items if str(item.get("table_id") or "") == table_id), None)
        assert row is not None
        metrics = row.get("metrics") if isinstance(row.get("metrics"), dict) else {}
        visual = row.get("visual") if isinstance(row.get("visual"), dict) else {}
        phase = str(row.get("phase") or "").upper()
        assert phase in allowed_phases
        return {
            "phase": phase,
            "rows": int(metrics.get("rows") or 0),
            "health": round(float(metrics.get("health") or 0), 6),
            "corrosion_level": round(float(visual.get("corrosion_level") or 0), 6),
            "crack_intensity": round(float(visual.get("crack_intensity") or 0), 6),
            "source_event_seq": int(row.get("source_event_seq") or 0),
        }

    def _table_member_ids() -> set[str]:
        tables = client.get("/universe/tables", params={"galaxy_id": galaxy_id})
        assert tables.status_code == 200, tables.text
        table_row = next(
            (row for row in tables.json().get("tables", []) if str(row.get("table_id") or "") == table_id),
            None,
        )
        assert table_row is not None
        return {str(member.get("id")) for member in table_row.get("members", []) if member.get("id")}

    def _snapshot_ids() -> set[str]:
        snapshot = client.get("/universe/snapshot", params={"galaxy_id": galaxy_id})
        assert snapshot.status_code == 200, snapshot.text
        rows = [row for row in snapshot.json().get("civilizations", []) if str(row.get("table_id") or "") == table_id]
        return {str(row.get("id")) for row in rows if row.get("id")}

    preview_after_create_a = _preview_row()
    preview_after_create_b = _preview_row()
    assert preview_after_create_b == preview_after_create_a
    member_ids_after_create = _table_member_ids()
    snapshot_ids_after_create = _snapshot_ids()
    assert moon_id in member_ids_after_create
    assert member_ids_after_create == snapshot_ids_after_create
    assert preview_after_create_a["rows"] == len(member_ids_after_create)
    assert preview_after_create_a["source_event_seq"] >= 1

    mutated = client.patch(
        f"/civilizations/{moon_id}/minerals/state",
        json={
            "galaxy_id": galaxy_id,
            "typed_value": "archived",
            "expected_event_seq": event_seq,
            "idempotency_key": f"p6-03-lifecycle-mutate-{uuid.uuid4()}",
        },
    )
    assert mutated.status_code == 200, mutated.text
    mutated_seq = int(mutated.json().get("current_event_seq") or 0)
    assert mutated_seq > event_seq

    preview_after_mutate_a = _preview_row()
    preview_after_mutate_b = _preview_row()
    assert preview_after_mutate_b == preview_after_mutate_a
    member_ids_after_mutate = _table_member_ids()
    snapshot_ids_after_mutate = _snapshot_ids()
    assert moon_id in member_ids_after_mutate
    assert member_ids_after_mutate == snapshot_ids_after_mutate
    assert preview_after_mutate_a["rows"] == len(member_ids_after_mutate)
    assert preview_after_mutate_a["source_event_seq"] >= preview_after_create_a["source_event_seq"]

    extinguished = client.patch(
        f"/civilizations/{moon_id}/extinguish",
        params={
            "galaxy_id": galaxy_id,
            "expected_event_seq": mutated_seq,
            "idempotency_key": f"p6-03-lifecycle-extinguish-{uuid.uuid4()}",
        },
    )
    assert extinguished.status_code == 200, extinguished.text
    extinguished_body = extinguished.json()
    assert str(extinguished_body.get("moon_id") or extinguished_body.get("id") or "") == moon_id
    assert extinguished_body["is_deleted"] is True

    preview_after_extinguish_a = _preview_row()
    preview_after_extinguish_b = _preview_row()
    assert preview_after_extinguish_b == preview_after_extinguish_a
    member_ids_after_extinguish = _table_member_ids()
    snapshot_ids_after_extinguish = _snapshot_ids()
    assert moon_id not in member_ids_after_extinguish
    assert member_ids_after_extinguish == snapshot_ids_after_extinguish
    assert preview_after_extinguish_a["rows"] == len(member_ids_after_extinguish)
    assert preview_after_extinguish_a["rows"] == 0
    assert preview_after_extinguish_a["source_event_seq"] == 0


def test_star_core_endpoint_by_endpoint_closure_v2(auth_client: tuple[httpx.Client, str]) -> None:
    client, galaxy_id = auth_client

    main_seed = client.post(
        "/parser/execute",
        json={
            "query": (
                f"ClosureMainA-{uuid.uuid4()} (table: Closure > Prime, amount: 9) + "
                f"ClosureMainB-{uuid.uuid4()} (table: Closure > Prime, amount: 3)"
            ),
            "galaxy_id": galaxy_id,
        },
    )
    assert main_seed.status_code == 200, main_seed.text

    branch_name = f"star-closure-{uuid.uuid4().hex[:10]}"
    branch = client.post("/branches", json={"name": branch_name, "galaxy_id": galaxy_id})
    assert branch.status_code == 201, branch.text
    branch_id = branch.json()["id"]

    branch_seed = client.post(
        "/parser/execute",
        json={
            "query": f"ClosureBranch-{uuid.uuid4()} (table: Closure > Branch, amount: 11)",
            "galaxy_id": galaxy_id,
            "branch_id": branch_id,
        },
    )
    assert branch_seed.status_code == 200, branch_seed.text

    policy = client.get(f"/galaxies/{galaxy_id}/star-core/policy")
    assert policy.status_code == 200, policy.text
    policy_body = policy.json()
    assert set(policy_body.keys()) == {
        "profile_key",
        "law_preset",
        "profile_mode",
        "no_hard_delete",
        "deletion_mode",
        "occ_enforced",
        "idempotency_supported",
        "branch_scope_supported",
        "lock_status",
        "policy_version",
        "locked_at",
        "can_edit_core_laws",
    }

    lock = client.post(
        f"/galaxies/{galaxy_id}/star-core/policy/lock",
        json={
            "profile_key": "SENTINEL",
            "lock_after_apply": True,
            "physical_profile_key": "ARCHIVE",
            "physical_profile_version": 3,
        },
    )
    assert lock.status_code == 200, lock.text
    lock_body = lock.json()
    assert lock_body["lock_status"] == "locked"
    assert lock_body["profile_key"] == "SENTINEL"
    assert lock_body["can_edit_core_laws"] is False

    physics_profile = client.get(f"/galaxies/{galaxy_id}/star-core/physics/profile")
    assert physics_profile.status_code == 200, physics_profile.text
    physics_profile_body = physics_profile.json()
    assert set(physics_profile_body.keys()) == {
        "galaxy_id",
        "profile_key",
        "profile_version",
        "lock_status",
        "locked_at",
        "coefficients",
    }
    assert physics_profile_body["galaxy_id"] == galaxy_id
    assert physics_profile_body["profile_key"] == "ARCHIVE"
    assert physics_profile_body["profile_version"] == 3
    assert isinstance(physics_profile_body["coefficients"], dict)
    assert "a" in physics_profile_body["coefficients"]

    runtime_main = client.get(f"/galaxies/{galaxy_id}/star-core/runtime", params={"window_events": 64})
    assert runtime_main.status_code == 200, runtime_main.text
    runtime_main_body = runtime_main.json()
    assert set(runtime_main_body.keys()) == {"as_of_event_seq", "events_count", "writes_per_minute"}
    assert isinstance(runtime_main_body["as_of_event_seq"], int)
    assert isinstance(runtime_main_body["events_count"], int)
    assert isinstance(runtime_main_body["writes_per_minute"], float)

    runtime_branch = client.get(
        f"/galaxies/{galaxy_id}/star-core/runtime",
        params={"branch_id": branch_id, "window_events": 64},
    )
    assert runtime_branch.status_code == 200, runtime_branch.text
    runtime_branch_body = runtime_branch.json()
    assert set(runtime_branch_body.keys()) == {"as_of_event_seq", "events_count", "writes_per_minute"}

    pulse_main = client.get(f"/galaxies/{galaxy_id}/star-core/pulse", params={"limit": 16})
    assert pulse_main.status_code == 200, pulse_main.text
    pulse_main_body = pulse_main.json()
    assert set(pulse_main_body.keys()) == {
        "galaxy_id",
        "branch_id",
        "last_event_seq",
        "sampled_count",
        "event_types",
        "events",
    }
    if pulse_main_body["events"]:
        event = pulse_main_body["events"][0]
        assert set(event.keys()) == {"event_seq", "event_type", "entity_id", "visual_hint", "intensity"}

    pulse_branch = client.get(
        f"/galaxies/{galaxy_id}/star-core/pulse",
        params={"branch_id": branch_id, "limit": 16},
    )
    assert pulse_branch.status_code == 200, pulse_branch.text
    pulse_branch_body = pulse_branch.json()
    assert pulse_branch_body["galaxy_id"] == galaxy_id
    assert pulse_branch_body["branch_id"] == branch_id
    after_seq = max(0, int(pulse_branch_body.get("last_event_seq") or 0))
    pulse_branch_after = client.get(
        f"/galaxies/{galaxy_id}/star-core/pulse",
        params={"branch_id": branch_id, "after_event_seq": after_seq, "limit": 16},
    )
    assert pulse_branch_after.status_code == 200, pulse_branch_after.text
    assert isinstance(pulse_branch_after.json().get("events"), list)

    domains_main = client.get(f"/galaxies/{galaxy_id}/star-core/metrics/domains", params={"window_events": 64})
    assert domains_main.status_code == 200, domains_main.text
    domains_main_body = domains_main.json()
    assert set(domains_main_body.keys()) == {
        "galaxy_id",
        "branch_id",
        "sampled_window_size",
        "sampled_since",
        "sampled_until",
        "total_events_count",
        "domains",
        "updated_at",
    }
    if domains_main_body["domains"]:
        row = domains_main_body["domains"][0]
        assert set(row.keys()) == {"domain_name", "status", "events_count", "activity_intensity"}

    domains_branch = client.get(
        f"/galaxies/{galaxy_id}/star-core/metrics/domains",
        params={"branch_id": branch_id, "window_events": 64},
    )
    assert domains_branch.status_code == 200, domains_branch.text
    assert domains_branch.json()["branch_id"] == branch_id

    planet_runtime_main = client.get(
        f"/galaxies/{galaxy_id}/star-core/physics/planets",
        params={"limit": 200},
    )
    assert planet_runtime_main.status_code == 200, planet_runtime_main.text
    planet_runtime_main_body = planet_runtime_main.json()
    assert set(planet_runtime_main_body.keys()) == {"as_of_event_seq", "items"}
    assert isinstance(planet_runtime_main_body["as_of_event_seq"], int)
    assert isinstance(planet_runtime_main_body["items"], list)
    if planet_runtime_main_body["items"]:
        item = planet_runtime_main_body["items"][0]
        assert set(item.keys()) == {"table_id", "phase", "metrics", "visual", "source_event_seq", "engine_version"}
        assert set(item["metrics"].keys()) == {"activity", "stress", "health", "inactivity", "corrosion", "rows"}
        assert set(item["visual"].keys()) == {
            "size_factor",
            "luminosity",
            "pulse_rate",
            "hue",
            "saturation",
            "corrosion_level",
            "crack_intensity",
        }

    planet_runtime_main_after = client.get(
        f"/galaxies/{galaxy_id}/star-core/physics/planets",
        params={"after_event_seq": planet_runtime_main_body["as_of_event_seq"], "limit": 200},
    )
    assert planet_runtime_main_after.status_code == 200, planet_runtime_main_after.text
    assert isinstance(planet_runtime_main_after.json().get("items"), list)

    planet_runtime_branch = client.get(
        f"/galaxies/{galaxy_id}/star-core/physics/planets",
        params={"branch_id": branch_id, "limit": 200},
    )
    assert planet_runtime_branch.status_code == 200, planet_runtime_branch.text
    planet_runtime_branch_body = planet_runtime_branch.json()
    assert set(planet_runtime_branch_body.keys()) == {"as_of_event_seq", "items"}
    assert isinstance(planet_runtime_branch_body["items"], list)

    planet_runtime_branch_after = client.get(
        f"/galaxies/{galaxy_id}/star-core/physics/planets",
        params={
            "branch_id": branch_id,
            "after_event_seq": planet_runtime_branch_body["as_of_event_seq"],
            "limit": 200,
        },
    )
    assert planet_runtime_branch_after.status_code == 200, planet_runtime_branch_after.text
    assert isinstance(planet_runtime_branch_after.json().get("items"), list)


def test_constellation_layer_v1_endpoint_returns_l2_group_metrics(auth_client: tuple[httpx.Client, str]) -> None:
    client, galaxy_id = auth_client
    execute = client.post(
        "/parser/execute",
        json={
            "query": (
                f"L2A-{uuid.uuid4()} (table: Kancelar > PlanetA, cena: 10) + "
                f"L2B-{uuid.uuid4()} (table: Kancelar > PlanetB, cena: 20)"
            ),
            "galaxy_id": galaxy_id,
        },
    )
    assert execute.status_code == 200, execute.text

    response = client.get(f"/galaxies/{galaxy_id}/constellations")
    assert response.status_code == 200, response.text
    body = response.json()
    assert "items" in body and isinstance(body["items"], list)
    assert body["items"], "Expected at least one constellation row"

    row = body["items"][0]
    assert "name" in row
    assert "planets_count" in row
    assert "planet_names" in row and isinstance(row["planet_names"], list)
    assert "moons_count" in row
    assert "formula_fields_count" in row
    assert "internal_bonds_count" in row
    assert "external_bonds_count" in row
    assert "guardian_rules_count" in row
    assert "alerted_moons_count" in row
    assert "circular_fields_count" in row
    assert "quality_score" in row
    assert row["status"] in {"GREEN", "YELLOW", "RED"}


def test_planet_layer_v1_endpoint_returns_l3_planet_metrics(auth_client: tuple[httpx.Client, str]) -> None:
    client, galaxy_id = auth_client
    execute = client.post(
        "/parser/execute",
        json={
            "query": (
                f"L3A-{uuid.uuid4()} (table: Finance > Orion, cena: 10) + "
                f"L3B-{uuid.uuid4()} (table: Finance > Orion, naklad: 7)"
            ),
            "galaxy_id": galaxy_id,
        },
    )
    assert execute.status_code == 200, execute.text

    response = client.get(f"/galaxies/{galaxy_id}/planets")
    assert response.status_code == 200, response.text
    body = response.json()
    assert "items" in body and isinstance(body["items"], list)
    assert body["items"], "Expected at least one planet row"

    row = body["items"][0]
    assert "table_id" in row
    assert "name" in row
    assert "constellation_name" in row
    assert "moons_count" in row
    assert "schema_fields_count" in row
    assert "formula_fields_count" in row
    assert "internal_bonds_count" in row
    assert "external_bonds_count" in row
    assert "guardian_rules_count" in row
    assert "alerted_moons_count" in row
    assert "circular_fields_count" in row
    assert "quality_score" in row
    assert row["status"] in {"GREEN", "YELLOW", "RED"}
    assert row["sector_mode"] in {"belt", "ring"}


def test_moon_layer_v1_endpoint_returns_l4_moon_metrics(auth_client: tuple[httpx.Client, str]) -> None:
    client, galaxy_id = auth_client
    label = f"L4A-{uuid.uuid4()}"
    execute = client.post(
        "/parser/execute",
        json={
            "query": f"{label} (table: Finance > Orion, cena: 10, marze: =SUM(cena))",
            "parser_version": "v1",
            "galaxy_id": galaxy_id,
        },
    )
    assert execute.status_code == 200, execute.text

    response = client.get(f"/galaxies/{galaxy_id}/moons")
    assert response.status_code == 200, response.text
    body = response.json()
    assert "items" in body and isinstance(body["items"], list)
    assert body["items"], "Expected at least one moon row"

    row = body["items"][0]
    assert "civilization_id" in row
    assert "label" in row
    assert "table_id" in row
    assert "table_name" in row
    assert "constellation_name" in row
    assert "planet_name" in row
    assert "metadata_fields_count" in row
    assert "calculated_fields_count" in row
    assert "guardian_rules_count" in row
    assert "active_alerts_count" in row
    assert "circular_fields_count" in row
    assert "quality_score" in row
    assert row["status"] in {"GREEN", "YELLOW", "RED"}
    assert "created_at" in row


def test_bond_layer_v1_endpoint_returns_flow_quality_metrics(auth_client: tuple[httpx.Client, str]) -> None:
    client, galaxy_id = auth_client
    execute = client.post(
        "/parser/execute",
        json={
            "query": (
                f"FlowA-{uuid.uuid4()} (table: Finance > Orion, cena: 10) + "
                f"FlowB-{uuid.uuid4()} (table: Finance > Orion, cena: 20)"
            ),
            "galaxy_id": galaxy_id,
        },
    )
    assert execute.status_code == 200, execute.text

    response = client.get(f"/galaxies/{galaxy_id}/bonds")
    assert response.status_code == 200, response.text
    body = response.json()
    assert "items" in body and isinstance(body["items"], list)
    assert body["items"], "Expected at least one bond row"

    row = body["items"][0]
    assert "bond_id" in row
    assert "type" in row
    assert "directional" in row and isinstance(row["directional"], bool)
    assert row["flow_direction"] in {"source_to_target", "bidirectional"}
    assert "source_civilization_id" in row
    assert "target_civilization_id" in row
    assert "source_label" in row
    assert "target_label" in row
    assert "source_table_id" in row
    assert "target_table_id" in row
    assert "source_constellation_name" in row
    assert "source_planet_name" in row
    assert "target_constellation_name" in row
    assert "target_planet_name" in row
    assert "active_alerts_count" in row
    assert "circular_fields_count" in row
    assert "quality_score" in row
    assert row["status"] in {"GREEN", "YELLOW", "RED"}
    assert "created_at" in row


def test_tables_v1_contract_contains_sector_and_bond_buckets(auth_client: tuple[httpx.Client, str]) -> None:
    client, galaxy_id = auth_client
    a_label = f"TabA-{uuid.uuid4()}"
    b_label = f"TabB-{uuid.uuid4()}"
    execute = client.post(
        "/parser/execute",
        json={
            "query": f"{a_label} (table: Alpha, cena: 10) + {b_label} (table: Beta, cena: 20)",
            "galaxy_id": galaxy_id,
        },
    )
    assert execute.status_code == 200, execute.text

    tables = client.get("/universe/tables", params={"galaxy_id": galaxy_id})
    assert tables.status_code == 200, tables.text
    body = tables.json()
    assert "tables" in body
    assert isinstance(body["tables"], list)
    assert body["tables"], "Expected at least one table bucket"

    for table in body["tables"]:
        assert "table_id" in table
        assert "galaxy_id" in table
        assert "name" in table
        assert (
            "constellation_name" in table
            and isinstance(table["constellation_name"], str)
            and table["constellation_name"]
        )
        assert "planet_name" in table and isinstance(table["planet_name"], str) and table["planet_name"]
        assert "schema_fields" in table and isinstance(table["schema_fields"], list)
        assert "formula_fields" in table and isinstance(table["formula_fields"], list)
        assert "members" in table and isinstance(table["members"], list)
        assert "internal_bonds" in table and isinstance(table["internal_bonds"], list)
        assert "external_bonds" in table and isinstance(table["external_bonds"], list)
        assert "sector" in table and isinstance(table["sector"], dict)

        sector = table["sector"]
        assert "center" in sector and isinstance(sector["center"], list) and len(sector["center"]) == 3
        assert "size" in sector and isinstance(sector["size"], int | float)
        assert "mode" in sector and sector["mode"] in {"belt", "ring"}
        assert sector.get("grid_plate") is True


def test_csv_import_commit_creates_asteroids_and_metadata(auth_client: tuple[httpx.Client, str]) -> None:
    client, galaxy_id = auth_client
    a_label = f"CSV-A-{uuid.uuid4()}"
    b_label = f"CSV-B-{uuid.uuid4()}"
    csv_payload = f"value,cena,mena\n{a_label},100,CZK\n{b_label},250,EUR\n"

    imported = client.post(
        "/io/imports",
        data={"mode": "commit", "strict": "true", "galaxy_id": galaxy_id},
        files={"file": ("import.csv", csv_payload.encode("utf-8"), "text/csv")},
    )
    assert imported.status_code == 200, imported.text
    body = imported.json()
    assert body["job"]["status"] in {"COMPLETED", "COMPLETED_WITH_ERRORS"}
    assert body["job"]["processed_rows"] == 2

    snapshot = client.get("/universe/snapshot", params={"galaxy_id": galaxy_id})
    assert snapshot.status_code == 200, snapshot.text
    by_value = {_stringify(atom["value"]): atom for atom in snapshot.json()["civilizations"]}
    assert by_value[a_label]["metadata"].get("cena") in {"100", 100}
    assert by_value[a_label]["metadata"].get("mena") == "CZK"
    assert by_value[b_label]["metadata"].get("cena") in {"250", 250}


def test_csv_import_preview_does_not_mutate_snapshot(auth_client: tuple[httpx.Client, str]) -> None:
    client, galaxy_id = auth_client
    preview_label = f"CSV-Preview-{uuid.uuid4()}"
    csv_payload = f"value,cena,mena\n{preview_label},333,CZK\n"

    imported = client.post(
        "/io/imports",
        data={"mode": "preview", "strict": "true", "galaxy_id": galaxy_id},
        files={"file": ("preview.csv", csv_payload.encode("utf-8"), "text/csv")},
    )
    assert imported.status_code == 200, imported.text
    job = imported.json()["job"]
    assert job["mode"] == "preview"
    assert job["processed_rows"] == 1
    assert job["errors_count"] == 0

    snapshot = client.get("/universe/snapshot", params={"galaxy_id": galaxy_id})
    assert snapshot.status_code == 200, snapshot.text
    values = {_stringify(atom["value"]) for atom in snapshot.json()["civilizations"]}
    assert preview_label not in values


def test_csv_import_lenient_mode_persists_valid_rows_and_exposes_errors(auth_client: tuple[httpx.Client, str]) -> None:
    client, galaxy_id = auth_client
    ok_a = f"CSV-Lenient-A-{uuid.uuid4()}"
    ok_b = f"CSV-Lenient-B-{uuid.uuid4()}"
    csv_payload = f"value,source,target,cena\n{ok_a},,,10\n,ONLY_SOURCE,,\n{ok_b},,,20\n"

    imported = client.post(
        "/io/imports",
        data={"mode": "commit", "strict": "false", "galaxy_id": galaxy_id},
        files={"file": ("lenient.csv", csv_payload.encode("utf-8"), "text/csv")},
    )
    assert imported.status_code == 200, imported.text
    job = imported.json()["job"]
    job_id = job["id"]
    assert job["status"] == "COMPLETED_WITH_ERRORS"
    assert job["total_rows"] == 3
    assert job["processed_rows"] == 2
    assert job["errors_count"] == 1

    job_detail = client.get(f"/io/imports/{job_id}")
    assert job_detail.status_code == 200, job_detail.text
    detail = job_detail.json()
    assert detail["id"] == job_id
    assert detail["errors_count"] == 1
    assert detail["processed_rows"] == 2

    errors = client.get(f"/io/imports/{job_id}/errors")
    assert errors.status_code == 200, errors.text
    error_items = errors.json()["errors"]
    assert len(error_items) == 1
    assert error_items[0]["row_number"] == 3
    assert error_items[0]["code"] == "ROW_INPUT_INVALID"
    assert "partial bond columns" in error_items[0]["message"]
    assert "ONLY_SOURCE" in (error_items[0]["raw_value"] or "")

    snapshot = client.get("/universe/snapshot", params={"galaxy_id": galaxy_id})
    assert snapshot.status_code == 200, snapshot.text
    values = {_stringify(atom["value"]) for atom in snapshot.json()["civilizations"]}
    assert ok_a in values
    assert ok_b in values


def test_csv_export_snapshot_returns_csv(auth_client: tuple[httpx.Client, str]) -> None:
    client, galaxy_id = auth_client
    label = f"CSV-Export-{uuid.uuid4()}"
    created = client.post(
        "/civilizations/ingest", json={"value": label, "metadata": {"kategorie": "Test"}, "galaxy_id": galaxy_id}
    )
    assert created.status_code == 200, created.text

    exported = client.get("/io/exports/snapshot", params={"format": "csv", "galaxy_id": galaxy_id})
    assert exported.status_code == 200, exported.text
    assert exported.headers.get("content-type", "").startswith("text/csv")
    assert "record_type,id,value" in exported.text
    assert label in exported.text


def test_csv_export_tables_with_branch_id_respects_branch_timeline(auth_client: tuple[httpx.Client, str]) -> None:
    client, galaxy_id = auth_client
    main_label = f"Tables-Main-{uuid.uuid4()}"
    branch_label = f"Tables-Branch-{uuid.uuid4()}"
    csv_payload = f"value,cena\n{branch_label},700\n"

    created_main = client.post("/civilizations/ingest", json={"value": main_label, "galaxy_id": galaxy_id})
    assert created_main.status_code == 200, created_main.text

    branch = client.post(
        "/branches",
        json={"name": f"TablesExportBranch-{uuid.uuid4()}", "galaxy_id": galaxy_id},
    )
    assert branch.status_code == 201, branch.text
    branch_id = branch.json()["id"]

    imported = client.post(
        "/io/imports",
        data={"mode": "commit", "strict": "true", "galaxy_id": galaxy_id, "branch_id": branch_id},
        files={"file": ("branch-tables.csv", csv_payload.encode("utf-8"), "text/csv")},
    )
    assert imported.status_code == 200, imported.text
    assert imported.json()["job"]["processed_rows"] == 1

    exported_main = client.get("/io/exports/tables", params={"format": "csv", "galaxy_id": galaxy_id})
    assert exported_main.status_code == 200, exported_main.text
    assert main_label in exported_main.text
    assert branch_label not in exported_main.text

    exported_branch = client.get(
        "/io/exports/tables",
        params={"format": "csv", "galaxy_id": galaxy_id, "branch_id": branch_id},
    )
    assert exported_branch.status_code == 200, exported_branch.text
    assert branch_label in exported_branch.text


def test_branch_create_rejects_duplicate_normalized_name(auth_client: tuple[httpx.Client, str]) -> None:
    client, galaxy_id = auth_client
    first = client.post(
        "/branches",
        json={"name": "  Scenario A  ", "galaxy_id": galaxy_id},
    )
    assert first.status_code == 201, first.text

    duplicate = client.post(
        "/branches",
        json={"name": "scenario a", "galaxy_id": galaxy_id},
    )
    assert duplicate.status_code == 409, duplicate.text
    assert "same normalized name" in duplicate.text


def test_branch_snapshot_isolated_from_new_main_events(auth_client: tuple[httpx.Client, str]) -> None:
    client, galaxy_id = auth_client
    base_label = f"branch-base-{uuid.uuid4()}"
    future_label = f"branch-future-{uuid.uuid4()}"

    created_base = client.post("/civilizations/ingest", json={"value": base_label, "galaxy_id": galaxy_id})
    assert created_base.status_code == 200, created_base.text

    branch = client.post(
        "/branches",
        json={"name": f"Scenario-{uuid.uuid4()}", "galaxy_id": galaxy_id},
    )
    assert branch.status_code == 201, branch.text
    branch_id = branch.json()["id"]

    created_future = client.post("/civilizations/ingest", json={"value": future_label, "galaxy_id": galaxy_id})
    assert created_future.status_code == 200, created_future.text

    snapshot_main = client.get("/universe/snapshot", params={"galaxy_id": galaxy_id})
    assert snapshot_main.status_code == 200, snapshot_main.text
    main_values = {_stringify(atom["value"]) for atom in snapshot_main.json()["civilizations"]}
    assert base_label in main_values
    assert future_label in main_values

    snapshot_branch = client.get(
        "/universe/snapshot",
        params={"galaxy_id": galaxy_id, "branch_id": branch_id},
    )
    assert snapshot_branch.status_code == 200, snapshot_branch.text
    branch_values = {_stringify(atom["value"]) for atom in snapshot_branch.json()["civilizations"]}
    assert base_label in branch_values
    assert future_label not in branch_values


def test_branch_ingest_writes_only_to_branch_timeline(auth_client: tuple[httpx.Client, str]) -> None:
    client, galaxy_id = auth_client
    main_label = f"main-{uuid.uuid4()}"
    branch_label = f"branch-{uuid.uuid4()}"

    created_main = client.post("/civilizations/ingest", json={"value": main_label, "galaxy_id": galaxy_id})
    assert created_main.status_code == 200, created_main.text

    branch = client.post(
        "/branches",
        json={"name": f"WriteScenario-{uuid.uuid4()}", "galaxy_id": galaxy_id},
    )
    assert branch.status_code == 201, branch.text
    branch_id = branch.json()["id"]

    created_branch = client.post(
        "/civilizations/ingest",
        json={"value": branch_label, "galaxy_id": galaxy_id, "branch_id": branch_id},
    )
    assert created_branch.status_code == 200, created_branch.text

    main_snapshot = client.get("/universe/snapshot", params={"galaxy_id": galaxy_id})
    assert main_snapshot.status_code == 200, main_snapshot.text
    main_values = {_stringify(atom["value"]) for atom in main_snapshot.json()["civilizations"]}
    assert main_label in main_values
    assert branch_label not in main_values

    branch_snapshot = client.get("/universe/snapshot", params={"galaxy_id": galaxy_id, "branch_id": branch_id})
    assert branch_snapshot.status_code == 200, branch_snapshot.text
    branch_values = {_stringify(atom["value"]) for atom in branch_snapshot.json()["civilizations"]}
    assert main_label in branch_values
    assert branch_label in branch_values


def test_branch_extinguish_does_not_delete_main_timeline(auth_client: tuple[httpx.Client, str]) -> None:
    client, galaxy_id = auth_client
    label = f"branch-extinguish-{uuid.uuid4()}"

    created = client.post("/civilizations/ingest", json={"value": label, "galaxy_id": galaxy_id})
    assert created.status_code == 200, created.text
    civilization_id = created.json()["id"]

    branch = client.post(
        "/branches",
        json={"name": f"ExtinguishScenario-{uuid.uuid4()}", "galaxy_id": galaxy_id},
    )
    assert branch.status_code == 201, branch.text
    branch_id = branch.json()["id"]

    extinguished = client.patch(
        f"/civilizations/{civilization_id}/extinguish",
        params={"galaxy_id": galaxy_id, "branch_id": branch_id},
    )
    assert extinguished.status_code == 200, extinguished.text

    main_snapshot = client.get("/universe/snapshot", params={"galaxy_id": galaxy_id})
    assert main_snapshot.status_code == 200, main_snapshot.text
    main_values = {_stringify(atom["value"]) for atom in main_snapshot.json()["civilizations"]}
    assert label in main_values

    branch_snapshot = client.get("/universe/snapshot", params={"galaxy_id": galaxy_id, "branch_id": branch_id})
    assert branch_snapshot.status_code == 200, branch_snapshot.text
    branch_values = {_stringify(atom["value"]) for atom in branch_snapshot.json()["civilizations"]}
    assert label not in branch_values


def test_branch_read_endpoints_reject_foreign_branch_id(client: httpx.Client) -> None:
    owner_email = f"owner-{uuid.uuid4()}@dataverse.local"
    owner_password = "Passw0rd123!"
    owner_register = client.post(
        "/auth/register",
        json={"email": owner_email, "password": owner_password, "galaxy_name": "Owner Galaxy"},
    )
    assert owner_register.status_code == 201, owner_register.text
    owner_body = owner_register.json()
    owner_token = owner_body["access_token"]
    owner_galaxy_id = owner_body["default_galaxy"]["id"]

    foreign_email = f"foreign-{uuid.uuid4()}@dataverse.local"
    foreign_password = "Passw0rd123!"
    foreign_register = client.post(
        "/auth/register",
        json={"email": foreign_email, "password": foreign_password, "galaxy_name": "Foreign Galaxy"},
    )
    assert foreign_register.status_code == 201, foreign_register.text
    foreign_body = foreign_register.json()
    foreign_token = foreign_body["access_token"]
    foreign_galaxy_id = foreign_body["default_galaxy"]["id"]

    client.headers.update({"Authorization": f"Bearer {foreign_token}"})
    foreign_branch = client.post(
        "/branches",
        json={"name": f"ForeignBranch-{uuid.uuid4()}", "galaxy_id": foreign_galaxy_id},
    )
    assert foreign_branch.status_code == 201, foreign_branch.text
    foreign_branch_id = foreign_branch.json()["id"]

    client.headers.update({"Authorization": f"Bearer {owner_token}"})
    snapshot = client.get(
        "/universe/snapshot",
        params={"galaxy_id": owner_galaxy_id, "branch_id": foreign_branch_id},
    )
    assert snapshot.status_code == 403, snapshot.text
    assert "Forbidden branch access" in snapshot.text

    tables = client.get(
        "/universe/tables",
        params={"galaxy_id": owner_galaxy_id, "branch_id": foreign_branch_id},
    )
    assert tables.status_code == 403, tables.text
    assert "Forbidden branch access" in tables.text


def test_branch_promote_replays_branch_events_into_main(auth_client: tuple[httpx.Client, str]) -> None:
    client, galaxy_id = auth_client
    branch_label = f"branch-promote-{uuid.uuid4()}"

    branch = client.post(
        "/branches",
        json={"name": f"PromoteScenario-{uuid.uuid4()}", "galaxy_id": galaxy_id},
    )
    assert branch.status_code == 201, branch.text
    branch_id = branch.json()["id"]

    created_branch = client.post(
        "/civilizations/ingest",
        json={"value": branch_label, "galaxy_id": galaxy_id, "branch_id": branch_id},
    )
    assert created_branch.status_code == 200, created_branch.text

    snapshot_main_before = client.get("/universe/snapshot", params={"galaxy_id": galaxy_id})
    assert snapshot_main_before.status_code == 200, snapshot_main_before.text
    main_before_values = {_stringify(atom["value"]) for atom in snapshot_main_before.json()["civilizations"]}
    assert branch_label not in main_before_values

    promoted = client.post(f"/branches/{branch_id}/promote", params={"galaxy_id": galaxy_id})
    assert promoted.status_code == 200, promoted.text
    promoted_body = promoted.json()
    assert promoted_body["promoted_events_count"] >= 1
    assert promoted_body["branch"]["id"] == branch_id
    assert promoted_body["branch"]["deleted_at"] is not None

    snapshot_main_after = client.get("/universe/snapshot", params={"galaxy_id": galaxy_id})
    assert snapshot_main_after.status_code == 200, snapshot_main_after.text
    main_after_values = {_stringify(atom["value"]) for atom in snapshot_main_after.json()["civilizations"]}
    assert branch_label in main_after_values

    snapshot_branch_after = client.get("/universe/snapshot", params={"galaxy_id": galaxy_id, "branch_id": branch_id})
    assert snapshot_branch_after.status_code == 404


def test_branch_promote_after_branch_import_replays_into_main(auth_client: tuple[httpx.Client, str]) -> None:
    client, galaxy_id = auth_client
    branch_label = f"BranchImportPromote-{uuid.uuid4()}"
    csv_payload = f"value,cena\n{branch_label},845\n"

    branch = client.post(
        "/branches",
        json={"name": f"PromoteAfterImport-{uuid.uuid4()}", "galaxy_id": galaxy_id},
    )
    assert branch.status_code == 201, branch.text
    branch_id = branch.json()["id"]

    imported = client.post(
        "/io/imports",
        data={"mode": "commit", "strict": "true", "galaxy_id": galaxy_id, "branch_id": branch_id},
        files={"file": ("promote-after-import.csv", csv_payload.encode("utf-8"), "text/csv")},
    )
    assert imported.status_code == 200, imported.text
    assert imported.json()["job"]["processed_rows"] == 1

    snapshot_main_before = client.get("/universe/snapshot", params={"galaxy_id": galaxy_id})
    assert snapshot_main_before.status_code == 200, snapshot_main_before.text
    main_before_values = {_stringify(atom["value"]) for atom in snapshot_main_before.json()["civilizations"]}
    assert branch_label not in main_before_values

    promoted = client.post(f"/branches/{branch_id}/promote", params={"galaxy_id": galaxy_id})
    assert promoted.status_code == 200, promoted.text
    promoted_body = promoted.json()
    assert promoted_body["promoted_events_count"] >= 1
    assert promoted_body["branch"]["id"] == branch_id
    assert promoted_body["branch"]["deleted_at"] is not None

    snapshot_main_after = client.get("/universe/snapshot", params={"galaxy_id": galaxy_id})
    assert snapshot_main_after.status_code == 200, snapshot_main_after.text
    main_after_values = {_stringify(atom["value"]) for atom in snapshot_main_after.json()["civilizations"]}
    assert branch_label in main_after_values


def test_csv_import_commit_with_branch_id_writes_only_to_branch(auth_client: tuple[httpx.Client, str]) -> None:
    client, galaxy_id = auth_client
    branch_label = f"CSV-Branch-{uuid.uuid4()}"
    csv_payload = f"value,cena\n{branch_label},700\n"

    branch = client.post(
        "/branches",
        json={"name": f"ImportBranch-{uuid.uuid4()}", "galaxy_id": galaxy_id},
    )
    assert branch.status_code == 201, branch.text
    branch_id = branch.json()["id"]

    imported = client.post(
        "/io/imports",
        data={"mode": "commit", "strict": "true", "galaxy_id": galaxy_id, "branch_id": branch_id},
        files={"file": ("branch-import.csv", csv_payload.encode("utf-8"), "text/csv")},
    )
    assert imported.status_code == 200, imported.text
    job = imported.json()["job"]
    assert job["status"] in {"COMPLETED", "COMPLETED_WITH_ERRORS"}
    assert job["processed_rows"] == 1

    snapshot_main = client.get("/universe/snapshot", params={"galaxy_id": galaxy_id})
    assert snapshot_main.status_code == 200, snapshot_main.text
    main_values = {_stringify(atom["value"]) for atom in snapshot_main.json()["civilizations"]}
    assert branch_label not in main_values

    snapshot_branch = client.get("/universe/snapshot", params={"galaxy_id": galaxy_id, "branch_id": branch_id})
    assert snapshot_branch.status_code == 200, snapshot_branch.text
    branch_values = {_stringify(atom["value"]) for atom in snapshot_branch.json()["civilizations"]}
    assert branch_label in branch_values


def test_csv_import_contract_violation_strict_mode_stops_processing(auth_client: tuple[httpx.Client, str]) -> None:
    client, galaxy_id = auth_client
    table_name = f"ImportStrictContract-{uuid.uuid4()}"
    valid_label = f"StrictImportOk-{uuid.uuid4()}"
    invalid_label = f"StrictImportBad-{uuid.uuid4()}"

    seeded = client.post(
        "/civilizations/ingest",
        json={
            "value": f"SeedStrict-{uuid.uuid4()}",
            "metadata": {"table": table_name, "cena": 10, "sku": "S-001"},
            "galaxy_id": galaxy_id,
        },
    )
    assert seeded.status_code == 200, seeded.text
    seeded_id = seeded.json()["id"]

    snapshot = client.get("/universe/snapshot", params={"galaxy_id": galaxy_id})
    assert snapshot.status_code == 200, snapshot.text
    seeded_atom = next((item for item in snapshot.json()["civilizations"] if item["id"] == seeded_id), None)
    assert seeded_atom is not None
    table_id = seeded_atom["table_id"]

    contract = client.post(
        f"/contracts/{table_id}",
        json={
            "galaxy_id": galaxy_id,
            "required_fields": ["cena", "sku"],
            "field_types": {"cena": "number", "sku": "string"},
            "validators": [{"field": "cena", "operator": ">", "value": 0}],
        },
    )
    assert contract.status_code == 201, contract.text

    csv_payload = f"value,table,cena,sku\n{invalid_label},{table_name},abc,S-010\n{valid_label},{table_name},45,S-011\n"
    imported = client.post(
        "/io/imports",
        data={"mode": "commit", "strict": "true", "galaxy_id": galaxy_id},
        files={"file": ("strict-contract-import.csv", csv_payload.encode("utf-8"), "text/csv")},
    )
    assert imported.status_code == 200, imported.text
    job = imported.json()["job"]
    assert job["status"] == "FAILED"
    assert job["processed_rows"] == 0
    assert job["errors_count"] == 1
    assert job["summary"].get("failure_row") == 2

    errors = client.get(f"/io/imports/{job['id']}/errors")
    assert errors.status_code == 200, errors.text
    error_items = errors.json()["errors"]
    assert len(error_items) == 1
    assert error_items[0]["row_number"] == 2
    assert error_items[0]["code"] == "ROW_CONTRACT_VIOLATION"
    assert "Table contract violation" in error_items[0]["message"]

    snapshot_after = client.get("/universe/snapshot", params={"galaxy_id": galaxy_id})
    assert snapshot_after.status_code == 200, snapshot_after.text
    values = {_stringify(atom["value"]) for atom in snapshot_after.json()["civilizations"]}
    assert invalid_label not in values
    assert valid_label not in values


def test_table_contract_versioning_returns_latest(auth_client: tuple[httpx.Client, str]) -> None:
    client, galaxy_id = auth_client
    table_name = f"Contract-{uuid.uuid4()}"
    label = f"ContractEntity-{uuid.uuid4()}"

    created = client.post(
        "/civilizations/ingest",
        json={"value": label, "metadata": {"table": table_name, "cena": 100}, "galaxy_id": galaxy_id},
    )
    assert created.status_code == 200, created.text

    snapshot = client.get("/universe/snapshot", params={"galaxy_id": galaxy_id})
    assert snapshot.status_code == 200, snapshot.text
    civilization = next((item for item in snapshot.json()["civilizations"] if _stringify(item["value"]) == label), None)
    assert civilization is not None
    table_id = civilization["table_id"]

    v1 = client.post(
        f"/contracts/{table_id}",
        json={
            "galaxy_id": galaxy_id,
            "required_fields": ["cena"],
            "field_types": {"cena": "number"},
            "validators": [{"field": "cena", "operator": ">", "value": 0}],
        },
    )
    assert v1.status_code == 201, v1.text
    assert v1.json()["version"] == 1

    v2 = client.post(
        f"/contracts/{table_id}",
        json={
            "galaxy_id": galaxy_id,
            "required_fields": ["cena", "mena"],
            "field_types": {"cena": "number", "mena": "string"},
            "unique_rules": [{"fields": ["value"]}],
            "formula_registry": [
                {
                    "id": "planet.cashflow",
                    "target": "zustatek",
                    "expression": "SUM(prijem)-SUM(vydaj)",
                    "depends_on": ["prijem", "vydaj"],
                    "trigger": "on_commit",
                }
            ],
            "physics_rulebook": {
                "rules": [
                    {
                        "id": "risk-red",
                        "when": [{"field": "cena", "op": ">", "value": 1000}],
                        "effects": {"color": "#ff6b8a"},
                    }
                ],
                "defaults": {"color": "#92ffd8", "radius": 1.2},
            },
        },
    )
    assert v2.status_code == 201, v2.text
    assert v2.json()["version"] == 2

    fetched = client.get(
        f"/contracts/{table_id}",
        params={"galaxy_id": galaxy_id},
    )
    assert fetched.status_code == 200, fetched.text
    body = fetched.json()
    assert body["version"] == 2
    assert body["field_types"]["mena"] == "string"
    assert "mena" in body["required_fields"]
    assert body["schema_registry"]["field_types"]["mena"] == "string"
    assert body["formula_registry"][0]["id"] == "planet.cashflow"
    assert body["physics_rulebook"]["defaults"]["color"] == "#92ffd8"


def test_table_contract_is_enforced_for_ingest_and_mutate(auth_client: tuple[httpx.Client, str]) -> None:
    client, galaxy_id = auth_client
    table_name = f"ContractGuard-{uuid.uuid4()}"

    seeded = client.post(
        "/civilizations/ingest",
        json={
            "value": f"Seed-{uuid.uuid4()}",
            "metadata": {"table": table_name, "cena": 10, "sku": "S-001"},
            "galaxy_id": galaxy_id,
        },
    )
    assert seeded.status_code == 200, seeded.text
    seeded_id = seeded.json()["id"]

    snapshot = client.get("/universe/snapshot", params={"galaxy_id": galaxy_id})
    assert snapshot.status_code == 200, snapshot.text
    seeded_atom = next((item for item in snapshot.json()["civilizations"] if item["id"] == seeded_id), None)
    assert seeded_atom is not None
    table_id = seeded_atom["table_id"]

    contract = client.post(
        f"/contracts/{table_id}",
        json={
            "galaxy_id": galaxy_id,
            "required_fields": ["cena", "sku"],
            "field_types": {"cena": "number", "sku": "string"},
            "unique_rules": [{"fields": ["sku"]}],
            "validators": [{"field": "cena", "operator": ">", "value": 0}],
        },
    )
    assert contract.status_code == 201, contract.text

    missing_required = client.post(
        "/civilizations/ingest",
        json={
            "value": f"Missing-{uuid.uuid4()}",
            "metadata": {"table": table_name, "sku": "S-002"},
            "galaxy_id": galaxy_id,
        },
    )
    assert missing_required.status_code == 422, missing_required.text
    assert "required field 'cena'" in missing_required.text

    invalid_type = client.post(
        "/civilizations/ingest",
        json={
            "value": f"Type-{uuid.uuid4()}",
            "metadata": {"table": table_name, "cena": "abc", "sku": "S-003"},
            "galaxy_id": galaxy_id,
        },
    )
    assert invalid_type.status_code == 422, invalid_type.text
    assert "must be 'number'" in invalid_type.text

    unique_violation = client.post(
        "/civilizations/ingest",
        json={
            "value": f"Unique-{uuid.uuid4()}",
            "metadata": {"table": table_name, "cena": 20, "sku": "S-001"},
            "galaxy_id": galaxy_id,
        },
    )
    assert unique_violation.status_code == 422, unique_violation.text
    assert "unique rule" in unique_violation.text

    invalid_mutate = client.patch(
        f"/civilizations/{seeded_id}/mutate",
        json={"metadata": {"cena": -5}, "galaxy_id": galaxy_id},
    )
    assert invalid_mutate.status_code == 422, invalid_mutate.text
    assert "validator failed" in invalid_mutate.text


def test_table_contract_semantic_validator_is_non_blocking(auth_client: tuple[httpx.Client, str]) -> None:
    client, galaxy_id = auth_client
    table_name = f"ContractSemantic-{uuid.uuid4()}"
    seed_label = f"SemanticSeed-{uuid.uuid4()}"

    seeded = client.post(
        "/civilizations/ingest",
        json={
            "value": seed_label,
            "metadata": {"table": table_name, "cena": 42, "owner": "init"},
            "galaxy_id": galaxy_id,
        },
    )
    assert seeded.status_code == 200, seeded.text
    seeded_id = seeded.json()["id"]

    snapshot = client.get("/universe/snapshot", params={"galaxy_id": galaxy_id})
    assert snapshot.status_code == 200, snapshot.text
    seeded_atom = next((item for item in snapshot.json()["civilizations"] if item["id"] == seeded_id), None)
    assert seeded_atom is not None
    table_id = seeded_atom["table_id"]

    contract = client.post(
        f"/contracts/{table_id}",
        json={
            "galaxy_id": galaxy_id,
            "required_fields": ["cena"],
            "field_types": {"cena": "number"},
            "validators": [
                {"field": "owner", "operator": "semantic", "value": {"mode": "relation"}},
                {"field": "cena", "operator": ">", "value": 0},
            ],
        },
    )
    assert contract.status_code == 201, contract.text

    ingested = client.post(
        "/civilizations/ingest",
        json={
            "value": f"SemanticOk-{uuid.uuid4()}",
            "metadata": {"table": table_name, "cena": 77, "owner": "Team-A"},
            "galaxy_id": galaxy_id,
        },
    )
    assert ingested.status_code == 200, ingested.text

    mutate_ok = client.patch(
        f"/civilizations/{seeded_id}/mutate",
        json={"metadata": {"owner": "Team-B", "cena": 55}, "galaxy_id": galaxy_id},
    )
    assert mutate_ok.status_code == 200, mutate_ok.text

    mutate_bad = client.patch(
        f"/civilizations/{seeded_id}/mutate",
        json={"metadata": {"cena": -1}, "galaxy_id": galaxy_id},
    )
    assert mutate_bad.status_code == 422, mutate_bad.text
    assert "validator failed" in mutate_bad.text


def test_csv_import_contract_violation_is_reported_per_row(auth_client: tuple[httpx.Client, str]) -> None:
    client, galaxy_id = auth_client
    table_name = f"ImportContract-{uuid.uuid4()}"
    valid_label = f"ImportOk-{uuid.uuid4()}"
    invalid_label = f"ImportBad-{uuid.uuid4()}"

    seeded = client.post(
        "/civilizations/ingest",
        json={
            "value": f"SeedImport-{uuid.uuid4()}",
            "metadata": {"table": table_name, "cena": 10, "sku": "I-001"},
            "galaxy_id": galaxy_id,
        },
    )
    assert seeded.status_code == 200, seeded.text
    seeded_id = seeded.json()["id"]

    snapshot = client.get("/universe/snapshot", params={"galaxy_id": galaxy_id})
    assert snapshot.status_code == 200, snapshot.text
    seeded_atom = next((item for item in snapshot.json()["civilizations"] if item["id"] == seeded_id), None)
    assert seeded_atom is not None
    table_id = seeded_atom["table_id"]

    contract = client.post(
        f"/contracts/{table_id}",
        json={
            "galaxy_id": galaxy_id,
            "required_fields": ["cena", "sku"],
            "field_types": {"cena": "number", "sku": "string"},
            "validators": [{"field": "cena", "operator": ">", "value": 0}],
        },
    )
    assert contract.status_code == 201, contract.text

    csv_payload = f"value,table,cena,sku\n{invalid_label},{table_name},abc,I-010\n{valid_label},{table_name},45,I-011\n"
    imported = client.post(
        "/io/imports",
        data={"mode": "commit", "strict": "false", "galaxy_id": galaxy_id},
        files={"file": ("contract-import.csv", csv_payload.encode("utf-8"), "text/csv")},
    )
    assert imported.status_code == 200, imported.text
    job = imported.json()["job"]
    assert job["status"] == "COMPLETED_WITH_ERRORS"
    assert job["processed_rows"] == 1
    assert job["errors_count"] == 1

    errors = client.get(f"/io/imports/{job['id']}/errors")
    assert errors.status_code == 200, errors.text
    items = errors.json()["errors"]
    assert len(items) == 1
    assert items[0]["row_number"] == 2
    assert items[0]["code"] == "ROW_CONTRACT_VIOLATION"
    assert "Table contract violation" in items[0]["message"]

    snapshot_after = client.get("/universe/snapshot", params={"galaxy_id": galaxy_id})
    assert snapshot_after.status_code == 200, snapshot_after.text
    values = {_stringify(atom["value"]) for atom in snapshot_after.json()["civilizations"]}
    assert valid_label in values
    assert invalid_label not in values


def test_relation_link_reverse_direction_reuses_same_bond(auth_client: tuple[httpx.Client, str]) -> None:
    client, galaxy_id = auth_client
    left = f"RelA-{uuid.uuid4()}"
    right = f"RelB-{uuid.uuid4()}"

    left_created = client.post("/civilizations/ingest", json={"value": left, "galaxy_id": galaxy_id})
    right_created = client.post("/civilizations/ingest", json={"value": right, "galaxy_id": galaxy_id})
    assert left_created.status_code == 200, left_created.text
    assert right_created.status_code == 200, right_created.text
    left_id = left_created.json()["id"]
    right_id = right_created.json()["id"]

    forward = client.post(
        "/bonds/link",
        json={
            "source_civilization_id": left_id,
            "target_civilization_id": right_id,
            "type": "RELATION",
            "galaxy_id": galaxy_id,
        },
    )
    assert forward.status_code == 200, forward.text
    bond_id = forward.json()["id"]

    reverse = client.post(
        "/bonds/link",
        json={
            "source_civilization_id": right_id,
            "target_civilization_id": left_id,
            "type": "RELATION",
            "galaxy_id": galaxy_id,
        },
    )
    assert reverse.status_code == 200, reverse.text
    assert reverse.json()["id"] == bond_id

    snapshot = client.get("/universe/snapshot", params={"galaxy_id": galaxy_id})
    assert snapshot.status_code == 200, snapshot.text
    rel_bonds = [
        bond
        for bond in snapshot.json()["bonds"]
        if str(bond.get("type", "")).upper() == "RELATION"
        and {bond.get("source_civilization_id"), bond.get("target_civilization_id")} == {left_id, right_id}
    ]
    assert len(rel_bonds) == 1


def test_link_type_alias_formula_is_normalized_to_flow(auth_client: tuple[httpx.Client, str]) -> None:
    client, galaxy_id = auth_client
    source_label = f"FlowAlias-S-{uuid.uuid4()}"
    target_label = f"FlowAlias-T-{uuid.uuid4()}"

    source = client.post("/civilizations/ingest", json={"value": source_label, "galaxy_id": galaxy_id})
    target = client.post("/civilizations/ingest", json={"value": target_label, "galaxy_id": galaxy_id})
    assert source.status_code == 200, source.text
    assert target.status_code == 200, target.text
    source_civilization_id = source.json()["id"]
    target_civilization_id = target.json()["id"]

    linked = client.post(
        "/bonds/link",
        json={
            "source_civilization_id": source_civilization_id,
            "target_civilization_id": target_civilization_id,
            "type": "formula",
            "galaxy_id": galaxy_id,
        },
    )
    assert linked.status_code == 200, linked.text
    body = linked.json()
    assert body["type"] == "FLOW"
    assert body["directional"] is True
    assert body["flow_direction"] == "source_to_target"

    snapshot = client.get("/universe/snapshot", params={"galaxy_id": galaxy_id})
    assert snapshot.status_code == 200, snapshot.text
    matched = [bond for bond in snapshot.json()["bonds"] if bond.get("id") == body["id"]]
    assert len(matched) == 1
    assert matched[0]["type"] == "FLOW"
    assert matched[0]["directional"] is True
    assert matched[0]["flow_direction"] == "source_to_target"


def test_link_parallel_same_relation_returns_single_bond(auth_client: tuple[httpx.Client, str]) -> None:
    client, galaxy_id = auth_client
    auth_header = str(client.headers.get("Authorization") or "")
    assert auth_header.startswith("Bearer "), "Missing auth header in test client"
    source_label = f"ParallelLink-S-{uuid.uuid4()}"
    target_label = f"ParallelLink-T-{uuid.uuid4()}"

    source = client.post("/civilizations/ingest", json={"value": source_label, "galaxy_id": galaxy_id})
    target = client.post("/civilizations/ingest", json={"value": target_label, "galaxy_id": galaxy_id})
    assert source.status_code == 200, source.text
    assert target.status_code == 200, target.text
    source_civilization_id = source.json()["id"]
    target_civilization_id = target.json()["id"]
    source_seq = _latest_entity_event_seq(client, galaxy_id=galaxy_id, entity_id=source_civilization_id)
    target_seq = _latest_entity_event_seq(client, galaxy_id=galaxy_id, entity_id=target_civilization_id)

    outcomes = _parallel_link_with_expected_seq(
        auth_header=auth_header,
        galaxy_id=galaxy_id,
        source_civilization_id=source_civilization_id,
        target_civilization_id=target_civilization_id,
        relation_type="RELATION",
        expected_source_event_seq=source_seq,
        expected_target_event_seq=target_seq,
    )
    statuses = sorted(status for status, _ in outcomes)
    assert statuses == [200, 200], outcomes

    result_ids = {payload.get("id") for status, payload in outcomes if status == 200}
    assert len(result_ids) == 1
    bond_id = next(iter(result_ids))
    assert bond_id

    snapshot = client.get("/universe/snapshot", params={"galaxy_id": galaxy_id})
    assert snapshot.status_code == 200, snapshot.text
    rel_bonds = [
        bond
        for bond in snapshot.json()["bonds"]
        if str(bond.get("type", "")).upper() == "RELATION"
        and {bond.get("source_civilization_id"), bond.get("target_civilization_id")}
        == {source_civilization_id, target_civilization_id}
    ]
    assert len(rel_bonds) == 1
    assert rel_bonds[0]["id"] == bond_id


def test_bond_mutate_replaces_type_and_preserves_single_active_edge(auth_client: tuple[httpx.Client, str]) -> None:
    client, galaxy_id = auth_client
    source_label = f"BondMut-S-{uuid.uuid4()}"
    target_label = f"BondMut-T-{uuid.uuid4()}"

    source = client.post("/civilizations/ingest", json={"value": source_label, "galaxy_id": galaxy_id})
    target = client.post("/civilizations/ingest", json={"value": target_label, "galaxy_id": galaxy_id})
    assert source.status_code == 200, source.text
    assert target.status_code == 200, target.text
    source_civilization_id = source.json()["id"]
    target_civilization_id = target.json()["id"]

    linked = client.post(
        "/bonds/link",
        json={
            "source_civilization_id": source_civilization_id,
            "target_civilization_id": target_civilization_id,
            "type": "RELATION",
            "galaxy_id": galaxy_id,
        },
    )
    assert linked.status_code == 200, linked.text
    original = linked.json()

    mutated = client.patch(
        f"/bonds/{original['id']}/mutate",
        json={
            "type": "TYPE",
            "expected_event_seq": original["current_event_seq"],
            "galaxy_id": galaxy_id,
        },
    )
    assert mutated.status_code == 200, mutated.text
    mutated_body = mutated.json()
    assert mutated_body["id"] != original["id"]
    assert mutated_body["type"] == "TYPE"
    assert mutated_body["directional"] is True
    assert mutated_body["flow_direction"] == "source_to_target"

    snapshot = client.get("/universe/snapshot", params={"galaxy_id": galaxy_id})
    assert snapshot.status_code == 200, snapshot.text
    bonds = snapshot.json()["bonds"]
    active = [
        bond
        for bond in bonds
        if {bond.get("source_civilization_id"), bond.get("target_civilization_id")}
        == {source_civilization_id, target_civilization_id}
    ]
    assert len(active) == 1
    assert active[0]["id"] == mutated_body["id"]
    assert active[0]["type"] == "TYPE"


def test_bond_extinguish_soft_deletes_link(auth_client: tuple[httpx.Client, str]) -> None:
    client, galaxy_id = auth_client
    source_label = f"BondDel-S-{uuid.uuid4()}"
    target_label = f"BondDel-T-{uuid.uuid4()}"

    source = client.post("/civilizations/ingest", json={"value": source_label, "galaxy_id": galaxy_id})
    target = client.post("/civilizations/ingest", json={"value": target_label, "galaxy_id": galaxy_id})
    assert source.status_code == 200, source.text
    assert target.status_code == 200, target.text
    source_civilization_id = source.json()["id"]
    target_civilization_id = target.json()["id"]

    linked = client.post(
        "/bonds/link",
        json={
            "source_civilization_id": source_civilization_id,
            "target_civilization_id": target_civilization_id,
            "type": "FLOW",
            "galaxy_id": galaxy_id,
        },
    )
    assert linked.status_code == 200, linked.text
    body = linked.json()

    extinguished = client.patch(
        f"/bonds/{body['id']}/extinguish",
        params={"galaxy_id": galaxy_id, "expected_event_seq": body["current_event_seq"]},
    )
    assert extinguished.status_code == 200, extinguished.text
    ext_body = extinguished.json()
    assert ext_body["id"] == body["id"]
    assert ext_body["is_deleted"] is True
    assert ext_body["deleted_at"] is not None

    snapshot = client.get("/universe/snapshot", params={"galaxy_id": galaxy_id})
    assert snapshot.status_code == 200, snapshot.text
    bond_ids = {bond["id"] for bond in snapshot.json()["bonds"]}
    assert body["id"] not in bond_ids


def test_bridge_integrity_soft_delete_and_replay_convergence(auth_client: tuple[httpx.Client, str]) -> None:
    client, galaxy_id = auth_client

    source_planet_name = f"BridgeSrc > Planet-{uuid.uuid4().hex[:8]}"
    target_planet_name = f"BridgeDst > Planet-{uuid.uuid4().hex[:8]}"
    source_planet = client.post(
        "/planets",
        json={
            "name": source_planet_name,
            "archetype": "catalog",
            "initial_schema_mode": "empty",
            "galaxy_id": galaxy_id,
            "idempotency_key": f"bridge-src-planet-{uuid.uuid4()}",
        },
    )
    target_planet = client.post(
        "/planets",
        json={
            "name": target_planet_name,
            "archetype": "catalog",
            "initial_schema_mode": "empty",
            "galaxy_id": galaxy_id,
            "idempotency_key": f"bridge-dst-planet-{uuid.uuid4()}",
        },
    )
    assert source_planet.status_code == 201, source_planet.text
    assert target_planet.status_code == 201, target_planet.text
    source_table_id = source_planet.json()["table_id"]
    target_table_id = target_planet.json()["table_id"]

    created_source = client.post(
        "/civilizations",
        json={
            "galaxy_id": galaxy_id,
            "planet_id": source_table_id,
            "label": "Bridge Source",
            "minerals": {
                "entity_id": f"bridge-src-{uuid.uuid4().hex[:8]}",
                "label": "Bridge Source",
                "state": "active",
            },
            "idempotency_key": f"bridge-src-civ-{uuid.uuid4()}",
        },
    )
    created_target = client.post(
        "/civilizations",
        json={
            "galaxy_id": galaxy_id,
            "planet_id": target_table_id,
            "label": "Bridge Target",
            "minerals": {
                "entity_id": f"bridge-dst-{uuid.uuid4().hex[:8]}",
                "label": "Bridge Target",
                "state": "active",
            },
            "idempotency_key": f"bridge-dst-civ-{uuid.uuid4()}",
        },
    )
    assert created_source.status_code == 201, created_source.text
    assert created_target.status_code == 201, created_target.text
    source_row_id = created_source.json().get("moon_id") or created_source.json().get("id")
    target_row_id = created_target.json().get("moon_id") or created_target.json().get("id")
    assert source_row_id is not None
    assert target_row_id is not None
    source_expected_seq = int(created_source.json().get("current_event_seq") or 0)
    assert source_expected_seq >= 1

    linked = client.post(
        "/bonds/link",
        json={
            "source_civilization_id": source_row_id,
            "target_civilization_id": target_row_id,
            "type": "RELATION",
            "galaxy_id": galaxy_id,
        },
    )
    assert linked.status_code == 200, linked.text
    linked_body = linked.json()
    bridge_bond_id = linked_body["id"]
    bridge_created_at = _parse_iso_datetime(linked_body["created_at"])

    snapshot_before = client.get("/universe/snapshot", params={"galaxy_id": galaxy_id})
    assert snapshot_before.status_code == 200, snapshot_before.text
    before_rows = snapshot_before.json().get("civilizations", [])
    before_bonds = snapshot_before.json().get("bonds", [])
    before_row_ids = {row.get("id") for row in before_rows}
    before_bond_ids = {bond.get("id") for bond in before_bonds}
    assert source_row_id in before_row_ids
    assert target_row_id in before_row_ids
    assert bridge_bond_id in before_bond_ids

    extinguished = client.patch(
        f"/civilizations/{source_row_id}/extinguish",
        params={
            "galaxy_id": galaxy_id,
            "expected_event_seq": source_expected_seq,
            "idempotency_key": f"bridge-src-extinguish-{uuid.uuid4()}",
        },
    )
    assert extinguished.status_code == 200, extinguished.text
    ext_body = extinguished.json()
    assert str(ext_body.get("moon_id") or ext_body.get("id")) == str(source_row_id)
    assert ext_body["is_deleted"] is True
    assert ext_body["deleted_at"] is not None
    deleted_at = _parse_iso_datetime(ext_body["deleted_at"])

    snapshot_after = client.get("/universe/snapshot", params={"galaxy_id": galaxy_id})
    assert snapshot_after.status_code == 200, snapshot_after.text
    after_rows = snapshot_after.json().get("civilizations", [])
    after_bonds = snapshot_after.json().get("bonds", [])
    after_row_ids = {row.get("id") for row in after_rows}
    after_bond_ids = {bond.get("id") for bond in after_bonds}
    assert source_row_id not in after_row_ids
    assert target_row_id in after_row_ids
    assert bridge_bond_id not in after_bond_ids

    tables_after = client.get("/universe/tables", params={"galaxy_id": galaxy_id})
    assert tables_after.status_code == 200, tables_after.text
    source_table_row = next(
        (row for row in tables_after.json().get("tables", []) if row.get("table_id") == source_table_id),
        None,
    )
    target_table_row = next(
        (row for row in tables_after.json().get("tables", []) if row.get("table_id") == target_table_id),
        None,
    )
    assert source_table_row is not None
    assert target_table_row is not None
    source_members = {item.get("id") for item in source_table_row.get("members", [])}
    target_members = {item.get("id") for item in target_table_row.get("members", [])}
    assert source_row_id not in source_members
    assert target_row_id in target_members

    as_of_alive = bridge_created_at.isoformat()
    snapshot_alive = client.get("/universe/snapshot", params={"galaxy_id": galaxy_id, "as_of": as_of_alive})
    assert snapshot_alive.status_code == 200, snapshot_alive.text
    alive_row_ids = {row.get("id") for row in snapshot_alive.json().get("civilizations", [])}
    alive_bond_ids = {bond.get("id") for bond in snapshot_alive.json().get("bonds", [])}
    assert source_row_id in alive_row_ids
    assert target_row_id in alive_row_ids
    assert bridge_bond_id in alive_bond_ids

    as_of_after_delete = (deleted_at + timedelta(milliseconds=1)).isoformat()
    snapshot_after_delete = client.get(
        "/universe/snapshot",
        params={"galaxy_id": galaxy_id, "as_of": as_of_after_delete},
    )
    assert snapshot_after_delete.status_code == 200, snapshot_after_delete.text
    after_delete_row_ids = {row.get("id") for row in snapshot_after_delete.json().get("civilizations", [])}
    after_delete_bond_ids = {bond.get("id") for bond in snapshot_after_delete.json().get("bonds", [])}
    assert source_row_id not in after_delete_row_ids
    assert target_row_id in after_delete_row_ids
    assert bridge_bond_id not in after_delete_bond_ids


def test_task_batch_preview_does_not_persist_changes(auth_client: tuple[httpx.Client, str]) -> None:
    client, galaxy_id = auth_client
    label = f"BatchPreview-{uuid.uuid4()}"

    created = client.post("/civilizations/ingest", json={"value": label, "galaxy_id": galaxy_id})
    assert created.status_code == 200, created.text
    civilization = created.json()
    civilization_id = civilization["id"]
    base_seq = int(civilization["current_event_seq"])

    preview = client.post(
        "/tasks/execute-batch",
        json={
            "mode": "preview",
            "galaxy_id": galaxy_id,
            "tasks": [
                {
                    "action": "UPDATE_ASTEROID",
                    "params": {
                        "civilization_id": civilization_id,
                        "metadata": {"preview_field": "yes"},
                        "expected_event_seq": base_seq,
                    },
                }
            ],
        },
    )
    assert preview.status_code == 200, preview.text
    body = preview.json()
    assert body["mode"] == "preview"
    assert body["task_count"] == 1
    assert len(body["result"]["tasks"]) == 1

    after = _snapshot_asteroid(client, galaxy_id=galaxy_id, civilization_id=civilization_id)
    assert "preview_field" not in after.get("metadata", {})
    assert int(after["current_event_seq"]) == base_seq


def test_task_batch_rejects_intent_payload_shape(auth_client: tuple[httpx.Client, str]) -> None:
    client, galaxy_id = auth_client
    response = client.post(
        "/tasks/execute-batch",
        json={
            "mode": "commit",
            "galaxy_id": galaxy_id,
            "tasks": [
                {
                    "kind": "UPSERT_NODE",
                    "node": {"selector_type": "NAME", "value": f"IntentTask-{uuid.uuid4().hex[:8]}"},
                    "metadata": {"state": "active"},
                }
            ],
        },
    )
    assert response.status_code == 422, response.text


def test_task_batch_commit_persists_changes_atomically(auth_client: tuple[httpx.Client, str]) -> None:
    client, galaxy_id = auth_client
    label = f"BatchCommit-{uuid.uuid4()}"

    created = client.post("/civilizations/ingest", json={"value": label, "galaxy_id": galaxy_id})
    assert created.status_code == 200, created.text
    civilization = created.json()
    civilization_id = civilization["id"]
    base_seq = int(civilization["current_event_seq"])

    commit = client.post(
        "/tasks/execute-batch",
        json={
            "mode": "commit",
            "galaxy_id": galaxy_id,
            "tasks": [
                {
                    "action": "UPDATE_ASTEROID",
                    "params": {
                        "civilization_id": civilization_id,
                        "metadata": {"batch_field": "committed"},
                        "expected_event_seq": base_seq,
                    },
                },
                {
                    "action": "INGEST",
                    "params": {
                        "value": f"BatchCommit-New-{uuid.uuid4()}",
                        "metadata": {"table": "Batch > Commit"},
                    },
                },
            ],
        },
    )
    assert commit.status_code == 200, commit.text
    body = commit.json()
    assert body["mode"] == "commit"
    assert body["task_count"] == 2
    assert len(body["result"]["tasks"]) == 2

    after = _snapshot_asteroid(client, galaxy_id=galaxy_id, civilization_id=civilization_id)
    assert after.get("metadata", {}).get("batch_field") == "committed"
    assert int(after["current_event_seq"]) > base_seq


def test_bulk_civilization_writes_occ_idempotency(auth_client: tuple[httpx.Client, str]) -> None:
    client, galaxy_id = auth_client
    planet_name = f"BulkCivilization > Planet-{uuid.uuid4().hex[:8]}"
    created_planet = client.post(
        "/planets",
        json={
            "name": planet_name,
            "archetype": "catalog",
            "initial_schema_mode": "empty",
            "galaxy_id": galaxy_id,
            "idempotency_key": f"bulk-civil-planet-{uuid.uuid4()}",
        },
    )
    assert created_planet.status_code == 201, created_planet.text
    planet_id = created_planet.json()["table_id"]

    created_seed = client.post(
        "/civilizations",
        json={
            "galaxy_id": galaxy_id,
            "planet_id": planet_id,
            "label": "Bulk Civilization Seed",
            "minerals": {
                "entity_id": f"bulk-seed-{uuid.uuid4().hex[:8]}",
                "label": "Bulk Civilization Seed",
                "state": "active",
            },
            "idempotency_key": f"bulk-civil-seed-{uuid.uuid4()}",
        },
    )
    assert created_seed.status_code == 201, created_seed.text
    seed_body = created_seed.json()
    seed_id = seed_body["moon_id"]
    seed_event_seq = int(seed_body.get("current_event_seq") or 0)
    assert seed_event_seq >= 1

    batch_key = f"bulk-civil-batch-{uuid.uuid4()}"
    batch_label = f"Bulk Civilization Insert-{uuid.uuid4().hex[:6]}"
    batch_payload = {
        "mode": "commit",
        "idempotency_key": batch_key,
        "galaxy_id": galaxy_id,
        "tasks": [
            {
                "action": "UPDATE_ASTEROID",
                "params": {
                    "civilization_id": seed_id,
                    "metadata": {"review_status": "reviewed"},
                    "expected_event_seq": seed_event_seq,
                },
            },
            {
                "action": "INGEST",
                "params": {
                    "value": batch_label,
                    "metadata": {
                        "table": planet_name,
                        "entity_id": f"bulk-batch-{uuid.uuid4().hex[:8]}",
                        "label": batch_label,
                        "state": "active",
                    },
                },
            },
        ],
    }
    first_batch = client.post("/tasks/execute-batch", json=batch_payload)
    assert first_batch.status_code == 200, first_batch.text
    assert first_batch.json()["mode"] == "commit"
    assert first_batch.json()["task_count"] == 2

    detail_after_batch = client.get(f"/civilizations/{seed_id}", params={"galaxy_id": galaxy_id})
    assert detail_after_batch.status_code == 200, detail_after_batch.text
    detail_after_batch_body = detail_after_batch.json()
    facts_by_key_after_batch = {item["key"]: item for item in detail_after_batch_body.get("facts", [])}
    assert facts_by_key_after_batch["review_status"]["typed_value"] == "reviewed"
    seq_after_batch = int(detail_after_batch_body.get("current_event_seq") or 0)
    assert seq_after_batch == seed_event_seq + 1

    list_after_batch = client.get("/civilizations", params={"galaxy_id": galaxy_id, "planet_id": planet_id})
    assert list_after_batch.status_code == 200, list_after_batch.text
    rows_after_batch = list_after_batch.json().get("items", [])
    assert len(rows_after_batch) == 2
    inserted_row = next((item for item in rows_after_batch if item.get("label") == batch_label), None)
    assert inserted_row is not None
    inserted_row_id = str(inserted_row.get("moon_id"))

    replay_batch = client.post("/tasks/execute-batch", json=batch_payload)
    assert replay_batch.status_code == 200, replay_batch.text
    assert replay_batch.json()["task_count"] == 2

    detail_after_replay = client.get(f"/civilizations/{seed_id}", params={"galaxy_id": galaxy_id})
    assert detail_after_replay.status_code == 200, detail_after_replay.text
    assert int(detail_after_replay.json().get("current_event_seq") or 0) == seq_after_batch

    list_after_replay = client.get("/civilizations", params={"galaxy_id": galaxy_id, "planet_id": planet_id})
    assert list_after_replay.status_code == 200, list_after_replay.text
    rows_after_replay = list_after_replay.json().get("items", [])
    assert len(rows_after_replay) == 2
    inserted_rows_after_replay = [item for item in rows_after_replay if item.get("label") == batch_label]
    assert len(inserted_rows_after_replay) == 1
    assert str(inserted_rows_after_replay[0].get("moon_id")) == inserted_row_id

    key_conflict_payload = {
        **batch_payload,
        "tasks": [
            {
                "action": "UPDATE_ASTEROID",
                "params": {
                    "civilization_id": seed_id,
                    "metadata": {"review_status": "other"},
                    "expected_event_seq": seed_event_seq,
                },
            }
        ],
    }
    key_conflict = client.post("/tasks/execute-batch", json=key_conflict_payload)
    assert key_conflict.status_code == 409, key_conflict.text
    assert "Idempotency key" in key_conflict.text

    stale_expected_seq = seq_after_batch - 1
    rollback_label = f"Bulk Civilization Rollback-{uuid.uuid4().hex[:6]}"
    conflict_batch = client.post(
        "/tasks/execute-batch",
        json={
            "mode": "commit",
            "idempotency_key": f"bulk-civil-conflict-{uuid.uuid4()}",
            "galaxy_id": galaxy_id,
            "tasks": [
                {
                    "action": "INGEST",
                    "params": {
                        "value": rollback_label,
                        "metadata": {
                            "table": planet_name,
                            "entity_id": f"bulk-rollback-{uuid.uuid4().hex[:8]}",
                            "label": rollback_label,
                            "state": "active",
                        },
                    },
                },
                {
                    "action": "UPDATE_ASTEROID",
                    "params": {
                        "civilization_id": seed_id,
                        "metadata": {"review_status": "should-not-commit"},
                        "expected_event_seq": stale_expected_seq,
                    },
                },
            ],
        },
    )
    detail = _assert_occ_conflict(conflict_batch, expected_event_seq=stale_expected_seq)
    assert "update_asteroid" in str(detail.get("context", "")).lower()
    assert detail.get("entity_id") == seed_id

    list_after_conflict = client.get("/civilizations", params={"galaxy_id": galaxy_id, "planet_id": planet_id})
    assert list_after_conflict.status_code == 200, list_after_conflict.text
    rows_after_conflict = list_after_conflict.json().get("items", [])
    assert len(rows_after_conflict) == 2
    assert all(item.get("label") != rollback_label for item in rows_after_conflict)

    detail_after_conflict = client.get(f"/civilizations/{seed_id}", params={"galaxy_id": galaxy_id})
    assert detail_after_conflict.status_code == 200, detail_after_conflict.text
    detail_after_conflict_body = detail_after_conflict.json()
    assert int(detail_after_conflict_body.get("current_event_seq") or 0) == seq_after_batch
    facts_by_key_after_conflict = {item["key"]: item for item in detail_after_conflict_body.get("facts", [])}
    assert facts_by_key_after_conflict["review_status"]["typed_value"] == "reviewed"


def test_apply_bundle_preset_preview_and_commit(auth_client: tuple[httpx.Client, str]) -> None:
    client, galaxy_id = auth_client

    preview = client.post(
        "/presets/apply",
        json={
            "bundle_key": "simple_crm",
            "mode": "preview",
            "seed_rows": True,
            "galaxy_id": galaxy_id,
        },
    )
    assert preview.status_code == 200, preview.text
    preview_body = preview.json()
    assert preview_body["mode"] == "preview"
    assert preview_body["bundle"]["key"] == "simple_crm"
    assert preview_body["graph_plan"]["moons_requested"] >= 3
    assert preview_body["graph_plan"]["bonds_requested"] >= 1
    assert len(preview_body["planets"]) == 2

    commit = client.post(
        "/presets/apply",
        json={
            "bundle_key": "simple_crm",
            "mode": "commit",
            "seed_rows": True,
            "idempotency_key": f"bundle-{uuid.uuid4()}",
            "galaxy_id": galaxy_id,
        },
    )
    assert commit.status_code == 200, commit.text
    commit_body = commit.json()
    assert commit_body["mode"] == "commit"
    assert commit_body["bundle"]["key"] == "simple_crm"
    assert commit_body["execution"] is not None
    assert commit_body["execution"]["task_count"] >= 1
    assert len(commit_body["created_refs"]) >= commit_body["graph_plan"]["moons_to_create"]

    clients_planet = next((item for item in commit_body["planets"] if item["planet_key"] == "clients"), None)
    meetings_planet = next((item for item in commit_body["planets"] if item["planet_key"] == "meetings"), None)
    assert clients_planet is not None
    assert meetings_planet is not None
    assert clients_planet["contract"] is not None
    assert meetings_planet["contract"] is not None

    clients_contract = client.get(f"/contracts/{clients_planet['table_id']}", params={"galaxy_id": galaxy_id})
    assert clients_contract.status_code == 200, clients_contract.text
    clients_contract_body = clients_contract.json()
    assert "full_name" in clients_contract_body["field_types"]

    snapshot_after = client.get("/universe/snapshot", params={"galaxy_id": galaxy_id})
    assert snapshot_after.status_code == 200, snapshot_after.text
    values = {_stringify(item["value"]) for item in snapshot_after.json()["civilizations"]}
    assert "Client ACME" in values
    assert "Meeting ACME Intro" in values


def test_apply_single_planet_bundle_requires_explicit_planet_id_on_commit(
    auth_client: tuple[httpx.Client, str],
) -> None:
    client, galaxy_id = auth_client

    preview = client.post(
        "/presets/apply",
        json={
            "bundle_key": "personal_cashflow",
            "mode": "preview",
            "seed_rows": True,
            "galaxy_id": galaxy_id,
        },
    )
    if preview.status_code == 404:
        pytest.skip("Bundle 'personal_cashflow' is not available in this environment.")
    assert preview.status_code == 200, preview.text
    preview_body = preview.json()
    assert len(preview_body.get("planets") or []) == 1

    created = client.post(
        "/planets",
        json={
            "name": f"Preset target {uuid.uuid4().hex[:8]}",
            "archetype": "catalog",
            "initial_schema_mode": "empty",
            "seed_rows": False,
            "galaxy_id": galaxy_id,
        },
    )
    assert created.status_code == 201, created.text
    target_planet_id = str(created.json().get("table_id") or "")
    assert target_planet_id

    missing_planet_commit = client.post(
        "/presets/apply",
        json={
            "bundle_key": "personal_cashflow",
            "mode": "commit",
            "seed_rows": True,
            "idempotency_key": f"bundle-single-missing-planet-{uuid.uuid4()}",
            "galaxy_id": galaxy_id,
        },
    )
    assert missing_planet_commit.status_code == 422, missing_planet_commit.text
    assert "planet_id" in missing_planet_commit.text

    commit = client.post(
        "/presets/apply",
        json={
            "bundle_key": "personal_cashflow",
            "mode": "commit",
            "seed_rows": True,
            "planet_id": target_planet_id,
            "idempotency_key": f"bundle-single-with-planet-{uuid.uuid4()}",
            "galaxy_id": galaxy_id,
        },
    )
    assert commit.status_code == 200, commit.text
    commit_body = commit.json()
    assert commit_body["mode"] == "commit"
    assert len(commit_body.get("planets") or []) == 1
    assert str(commit_body["planets"][0]["table_id"]) == target_planet_id


def test_planet_mvp_create_list_detail_and_universe_tables(auth_client: tuple[httpx.Client, str]) -> None:
    client, galaxy_id = auth_client
    planet_name = f"Ops > Planet-{uuid.uuid4().hex[:8]}"
    created = client.post(
        "/planets",
        json={
            "name": planet_name,
            "archetype": "catalog",
            "initial_schema_mode": "empty",
            "galaxy_id": galaxy_id,
            "idempotency_key": f"planet-create-{uuid.uuid4()}",
        },
    )
    assert created.status_code == 201, created.text
    body = created.json()
    table_id = body["table_id"]
    assert body["archetype"] == "catalog"
    assert body["table"]["table_id"] == table_id
    assert body["table"]["archetype"] == "catalog"
    assert body["table"]["contract_version"] >= 1

    listed = client.get("/planets", params={"galaxy_id": galaxy_id})
    assert listed.status_code == 200, listed.text
    listed_items = listed.json().get("items", [])
    listed_row = next((item for item in listed_items if item.get("table_id") == table_id), None)
    assert listed_row is not None
    assert listed_row["is_empty"] is True
    assert listed_row["archetype"] == "catalog"

    detail = client.get(f"/planets/{table_id}", params={"galaxy_id": galaxy_id})
    assert detail.status_code == 200, detail.text
    detail_body = detail.json()
    assert detail_body["table_id"] == table_id
    assert detail_body["archetype"] == "catalog"
    assert detail_body["is_empty"] is True

    universe_tables = client.get("/universe/tables", params={"galaxy_id": galaxy_id})
    assert universe_tables.status_code == 200, universe_tables.text
    table_row = next(
        (item for item in universe_tables.json().get("tables", []) if item.get("table_id") == table_id),
        None,
    )
    assert table_row is not None
    assert table_row["archetype"] == "catalog"


def test_moon_first_class_crud_endpoints(auth_client: tuple[httpx.Client, str]) -> None:
    client, galaxy_id = auth_client
    planet_name = f"MoonCrud > Planet-{uuid.uuid4().hex[:8]}"
    created_planet = client.post(
        "/planets",
        json={
            "name": planet_name,
            "archetype": "catalog",
            "initial_schema_mode": "empty",
            "galaxy_id": galaxy_id,
            "idempotency_key": f"moon-crud-planet-{uuid.uuid4()}",
        },
    )
    assert created_planet.status_code == 201, created_planet.text
    planet_id = created_planet.json()["table_id"]

    created_moon = client.post(
        "/civilizations",
        json={
            "galaxy_id": galaxy_id,
            "planet_id": planet_id,
            "label": "Moon CRUD Seed",
            "minerals": {
                "entity_id": f"moon-{uuid.uuid4().hex[:8]}",
                "label": "Moon CRUD Seed",
                "state": "active",
                "segment": "starter",
            },
            "idempotency_key": f"moon-crud-create-{uuid.uuid4()}",
        },
    )
    assert created_moon.status_code == 201, created_moon.text
    created_body = created_moon.json()
    moon_id = created_body["moon_id"]
    assert created_body["planet_id"] == planet_id
    facts_by_key = {item["key"]: item for item in created_body.get("facts", [])}
    assert "entity_id" in facts_by_key
    assert "state" in facts_by_key

    listed = client.get("/civilizations", params={"galaxy_id": galaxy_id, "planet_id": planet_id})
    assert listed.status_code == 200, listed.text
    listed_items = listed.json().get("items", [])
    listed_row = next((item for item in listed_items if item.get("moon_id") == moon_id), None)
    assert listed_row is not None

    detail = client.get(f"/civilizations/{moon_id}", params={"galaxy_id": galaxy_id})
    assert detail.status_code == 200, detail.text
    detail_body = detail.json()
    assert detail_body["moon_id"] == moon_id
    assert detail_body["planet_id"] == planet_id
    expected_event_seq = int(detail_body.get("current_event_seq") or 0)
    assert expected_event_seq >= 1

    mutated = client.patch(
        f"/civilizations/{moon_id}/minerals/state",
        json={
            "galaxy_id": galaxy_id,
            "typed_value": "archived",
            "remove": False,
            "expected_event_seq": expected_event_seq,
            "idempotency_key": f"moon-crud-mutate-{uuid.uuid4()}",
        },
    )
    assert mutated.status_code == 200, mutated.text
    mutated_body = mutated.json()
    mutated_facts_by_key = {item["key"]: item for item in mutated_body.get("facts", [])}
    assert mutated_facts_by_key["state"]["typed_value"] == "archived"
    extinguish_expected_seq = int(mutated_body.get("current_event_seq") or 0)
    assert extinguish_expected_seq >= expected_event_seq

    extinguished = client.patch(
        f"/civilizations/{moon_id}/extinguish",
        params={
            "galaxy_id": galaxy_id,
            "expected_event_seq": extinguish_expected_seq,
        },
    )
    assert extinguished.status_code == 200, extinguished.text
    extinguished_body = extinguished.json()
    assert extinguished_body["id"] == moon_id
    assert extinguished_body["is_deleted"] is True
    assert extinguished_body["deleted_at"] is not None

    missing_after_delete = client.get(f"/civilizations/{moon_id}", params={"galaxy_id": galaxy_id})
    assert missing_after_delete.status_code == 404, missing_after_delete.text


def test_moon_capability_first_class_endpoints(auth_client: tuple[httpx.Client, str]) -> None:
    client, galaxy_id = auth_client
    planet_name = f"MoonCapability > Planet-{uuid.uuid4().hex[:8]}"
    created_planet = client.post(
        "/planets",
        json={
            "name": planet_name,
            "archetype": "catalog",
            "initial_schema_mode": "empty",
            "galaxy_id": galaxy_id,
            "idempotency_key": f"moon-capability-planet-{uuid.uuid4()}",
        },
    )
    assert created_planet.status_code == 201, created_planet.text
    planet_id = created_planet.json()["table_id"]

    listed_empty = client.get(f"/planets/{planet_id}/capabilities", params={"galaxy_id": galaxy_id})
    assert listed_empty.status_code == 200, listed_empty.text
    assert listed_empty.json().get("items", []) == []

    create_idempotency_key = f"moon-capability-create-{uuid.uuid4()}"
    create_payload = {
        "galaxy_id": galaxy_id,
        "capability_key": "cashflow.validation",
        "capability_class": "validation",
        "config": {"required_fields": ["amount"], "field_types": {"amount": "number"}},
        "order_index": 10,
        "status": "active",
        "idempotency_key": create_idempotency_key,
    }
    created = client.post(f"/planets/{planet_id}/capabilities", json=create_payload)
    assert created.status_code == 201, created.text
    created_body = created.json()
    capability_id = created_body["id"]
    assert created_body["planet_id"] == planet_id
    assert created_body["capability_key"] == "cashflow.validation"
    assert created_body["capability_class"] == "validation"
    assert created_body["status"] == "active"
    assert int(created_body["version"]) == 1

    effective_contract_after_create = client.get(f"/contracts/{planet_id}", params={"galaxy_id": galaxy_id})
    assert effective_contract_after_create.status_code == 200, effective_contract_after_create.text
    effective_contract_body = effective_contract_after_create.json()
    assert "amount" in effective_contract_body.get("required_fields", [])
    assert effective_contract_body.get("field_types", {}).get("amount") == "number"

    replay = client.post(f"/planets/{planet_id}/capabilities", json=create_payload)
    assert replay.status_code == 201, replay.text
    replay_body = replay.json()
    assert replay_body["id"] == capability_id
    assert int(replay_body["version"]) == 1

    updated = client.patch(
        f"/capabilities/{capability_id}",
        json={
            "galaxy_id": galaxy_id,
            "expected_version": 1,
            "config": {"required_fields": ["amount", "transaction_type"], "field_types": {"amount": "number"}},
            "order_index": 12,
            "idempotency_key": f"moon-capability-update-{uuid.uuid4()}",
        },
    )
    assert updated.status_code == 200, updated.text
    updated_body = updated.json()
    assert updated_body["id"] != capability_id
    assert updated_body["capability_key"] == "cashflow.validation"
    assert updated_body["order_index"] == 12
    assert int(updated_body["version"]) == 2
    current_capability_id = updated_body["id"]

    stale_update = client.patch(
        f"/capabilities/{current_capability_id}",
        json={
            "galaxy_id": galaxy_id,
            "expected_version": 1,
            "config": {"required_fields": ["amount"]},
            "idempotency_key": f"moon-capability-stale-{uuid.uuid4()}",
        },
    )
    assert stale_update.status_code == 409, stale_update.text
    stale_detail = stale_update.json().get("detail", {})
    assert stale_detail.get("code") == "OCC_CONFLICT"
    assert stale_detail.get("context") == "moon_capability_update"
    assert stale_detail.get("expected_version") == 1
    assert stale_detail.get("current_version") == 2

    deprecated = client.patch(
        f"/capabilities/{current_capability_id}/deprecate",
        json={
            "galaxy_id": galaxy_id,
            "expected_version": 2,
            "idempotency_key": f"moon-capability-deprecate-{uuid.uuid4()}",
        },
    )
    assert deprecated.status_code == 200, deprecated.text
    deprecated_body = deprecated.json()
    assert deprecated_body["status"] == "deprecated"
    assert int(deprecated_body["version"]) == 3

    effective_contract_after_deprecate = client.get(f"/contracts/{planet_id}", params={"galaxy_id": galaxy_id})
    assert effective_contract_after_deprecate.status_code == 200, effective_contract_after_deprecate.text
    deprecated_contract_body = effective_contract_after_deprecate.json()
    assert "amount" not in deprecated_contract_body.get("required_fields", [])

    listed_default = client.get(f"/planets/{planet_id}/capabilities", params={"galaxy_id": galaxy_id})
    assert listed_default.status_code == 200, listed_default.text
    assert listed_default.json().get("items", []) == []

    listed_inactive = client.get(
        f"/planets/{planet_id}/capabilities",
        params={"galaxy_id": galaxy_id, "include_inactive": True},
    )
    assert listed_inactive.status_code == 200, listed_inactive.text
    inactive_items = listed_inactive.json().get("items", [])
    assert len(inactive_items) == 1
    assert inactive_items[0]["status"] == "deprecated"
    assert int(inactive_items[0]["version"]) == 3

    listed_history = client.get(
        f"/planets/{planet_id}/capabilities",
        params={"galaxy_id": galaxy_id, "include_inactive": True, "include_history": True},
    )
    assert listed_history.status_code == 200, listed_history.text
    history_items = listed_history.json().get("items", [])
    versions = sorted(int(item.get("version") or 0) for item in history_items)
    assert versions == [1, 2, 3]


def test_moon_capability_matrix_forbids_same_key_class_transition(auth_client: tuple[httpx.Client, str]) -> None:
    client, galaxy_id = auth_client
    planet_name = f"MoonMatrix > Planet-{uuid.uuid4().hex[:8]}"
    created_planet = client.post(
        "/planets",
        json={
            "name": planet_name,
            "archetype": "catalog",
            "initial_schema_mode": "empty",
            "galaxy_id": galaxy_id,
            "idempotency_key": f"moon-matrix-planet-{uuid.uuid4()}",
        },
    )
    assert created_planet.status_code == 201, created_planet.text
    planet_id = created_planet.json()["table_id"]

    created = client.post(
        f"/planets/{planet_id}/capabilities",
        json={
            "galaxy_id": galaxy_id,
            "capability_key": "cashflow.guard",
            "capability_class": "validation",
            "config": {
                "validators": [
                    {
                        "id": "amount-positive",
                        "field": "amount",
                        "operator": ">",
                        "value": 0,
                    }
                ]
            },
            "order_index": 15,
            "status": "active",
            "idempotency_key": f"moon-matrix-create-{uuid.uuid4()}",
        },
    )
    assert created.status_code == 201, created.text
    capability_id = created.json()["id"]
    assert created.json()["capability_class"] == "validation"

    forbidden_transition = client.patch(
        f"/capabilities/{capability_id}",
        json={
            "galaxy_id": galaxy_id,
            "expected_version": 1,
            "capability_class": "formula",
            "config": {"formula_registry": [{"id": "vat", "target": "vat", "expression": "SUM(amount)"}]},
            "idempotency_key": f"moon-matrix-forbidden-{uuid.uuid4()}",
        },
    )
    assert forbidden_transition.status_code == 409, forbidden_transition.text
    detail = forbidden_transition.json().get("detail", {})
    assert isinstance(detail, dict)
    assert detail.get("code") == "MOON_CAPABILITY_MATRIX_CONFLICT"
    assert detail.get("reason") == "capability_class_change_forbidden"
    assert detail.get("matrix_version") == "v1"
    assert detail.get("capability_key") == "cashflow.guard"
    assert detail.get("current_class") == "validation"
    assert detail.get("requested_class") == "formula"


def test_moon_capability_entity_lifecycle_and_projection_convergence(auth_client: tuple[httpx.Client, str]) -> None:
    client, galaxy_id = auth_client
    planet_name = f"CapabilityLifecycle > Planet-{uuid.uuid4().hex[:8]}"
    created_planet = client.post(
        "/planets",
        json={
            "name": planet_name,
            "archetype": "catalog",
            "initial_schema_mode": "empty",
            "galaxy_id": galaxy_id,
            "idempotency_key": f"capability-lifecycle-planet-{uuid.uuid4()}",
        },
    )
    assert created_planet.status_code == 201, created_planet.text
    planet_id = created_planet.json()["table_id"]

    def assert_projection_converged() -> set[str]:
        snapshot = client.get("/universe/snapshot", params={"galaxy_id": galaxy_id})
        assert snapshot.status_code == 200, snapshot.text
        snapshot_ids = {
            str(row.get("id"))
            for row in snapshot.json().get("civilizations", [])
            if str(row.get("table_id")) == str(planet_id)
        }

        tables = client.get("/universe/tables", params={"galaxy_id": galaxy_id})
        assert tables.status_code == 200, tables.text
        table_row = next(
            (row for row in tables.json().get("tables", []) if str(row.get("table_id")) == str(planet_id)),
            None,
        )
        assert table_row is not None
        member_ids = {str(item.get("id")) for item in table_row.get("members", [])}
        assert member_ids == snapshot_ids
        return snapshot_ids

    created_capability = client.post(
        f"/planets/{planet_id}/capabilities",
        json={
            "galaxy_id": galaxy_id,
            "capability_key": "transaction.guard",
            "capability_class": "validation",
            "config": {
                "required_fields": ["amount", "transaction_type"],
                "field_types": {"amount": "number", "transaction_type": "string"},
            },
            "order_index": 15,
            "status": "active",
            "idempotency_key": f"capability-lifecycle-create-{uuid.uuid4()}",
        },
    )
    assert created_capability.status_code == 201, created_capability.text
    capability_body = created_capability.json()
    capability_id = capability_body["id"]
    assert capability_body["capability_key"] == "transaction.guard"
    assert int(capability_body["version"]) == 1

    effective_contract = client.get(f"/contracts/{planet_id}", params={"galaxy_id": galaxy_id})
    assert effective_contract.status_code == 200, effective_contract.text
    effective_body = effective_contract.json()
    assert "amount" in effective_body.get("required_fields", [])
    assert "transaction_type" in effective_body.get("required_fields", [])

    first_row = client.post(
        "/civilizations",
        json={
            "galaxy_id": galaxy_id,
            "planet_id": planet_id,
            "label": "Lifecycle Row 1",
            "minerals": {
                "entity_id": f"row-{uuid.uuid4().hex[:8]}",
                "label": "Lifecycle Row 1",
                "state": "active",
                "amount": 1200,
                "transaction_type": "income",
            },
            "idempotency_key": f"capability-lifecycle-row1-{uuid.uuid4()}",
        },
    )
    assert first_row.status_code == 201, first_row.text
    first_row_id = str(first_row.json()["moon_id"])
    converged_ids_after_first = assert_projection_converged()
    assert first_row_id in converged_ids_after_first

    second_row_missing_required = client.post(
        "/civilizations",
        json={
            "galaxy_id": galaxy_id,
            "planet_id": planet_id,
            "label": "Lifecycle Row Missing",
            "minerals": {
                "entity_id": f"row-{uuid.uuid4().hex[:8]}",
                "label": "Lifecycle Row Missing",
                "state": "active",
                "amount": 200,
            },
            "idempotency_key": f"capability-lifecycle-missing-{uuid.uuid4()}",
        },
    )
    assert second_row_missing_required.status_code == 422, second_row_missing_required.text
    missing_detail = second_row_missing_required.json().get("detail", {})
    assert missing_detail.get("reason") == "required_missing"
    assert missing_detail.get("mineral_key") == "transaction_type"
    assert missing_detail.get("source") == "moon_capability"
    assert missing_detail.get("capability_key") == "transaction.guard"
    assert missing_detail.get("capability_id") == capability_id

    updated_capability = client.patch(
        f"/capabilities/{capability_id}",
        json={
            "galaxy_id": galaxy_id,
            "expected_version": 1,
            "order_index": 25,
            "config": {
                "required_fields": ["amount", "transaction_type", "segment"],
                "field_types": {"amount": "number", "transaction_type": "string", "segment": "string"},
            },
            "idempotency_key": f"capability-lifecycle-update-{uuid.uuid4()}",
        },
    )
    assert updated_capability.status_code == 200, updated_capability.text
    updated_body = updated_capability.json()
    assert int(updated_body["version"]) == 2
    current_capability_id = updated_body["id"]

    deprecated = client.patch(
        f"/capabilities/{current_capability_id}/deprecate",
        json={
            "galaxy_id": galaxy_id,
            "expected_version": 2,
            "idempotency_key": f"capability-lifecycle-deprecate-{uuid.uuid4()}",
        },
    )
    assert deprecated.status_code == 200, deprecated.text
    assert deprecated.json()["status"] == "deprecated"
    assert int(deprecated.json()["version"]) == 3

    contract_after_deprecate = client.get(f"/contracts/{planet_id}", params={"galaxy_id": galaxy_id})
    assert contract_after_deprecate.status_code == 200, contract_after_deprecate.text
    contract_after_deprecate_body = contract_after_deprecate.json()
    assert "amount" not in contract_after_deprecate_body.get("required_fields", [])
    assert "transaction_type" not in contract_after_deprecate_body.get("required_fields", [])

    third_row = client.post(
        "/civilizations",
        json={
            "galaxy_id": galaxy_id,
            "planet_id": planet_id,
            "label": "Lifecycle Row 2",
            "minerals": {
                "entity_id": f"row-{uuid.uuid4().hex[:8]}",
                "label": "Lifecycle Row 2",
                "state": "active",
            },
            "idempotency_key": f"capability-lifecycle-row2-{uuid.uuid4()}",
        },
    )
    assert third_row.status_code == 201, third_row.text
    third_row_id = str(third_row.json()["moon_id"])
    converged_ids_after_third = assert_projection_converged()
    assert first_row_id in converged_ids_after_third
    assert third_row_id in converged_ids_after_third


def test_contract_evolution_revalidate_backfill_mark_invalid(auth_client: tuple[httpx.Client, str]) -> None:
    client, galaxy_id = auth_client
    planet_name = f"Evolution > Planet-{uuid.uuid4().hex[:8]}"
    created_planet = client.post(
        "/planets",
        json={
            "name": planet_name,
            "archetype": "catalog",
            "initial_schema_mode": "empty",
            "galaxy_id": galaxy_id,
            "idempotency_key": f"contract-evolution-planet-{uuid.uuid4()}",
        },
    )
    assert created_planet.status_code == 201, created_planet.text
    planet_id = created_planet.json()["table_id"]

    created_row = client.post(
        "/civilizations",
        json={
            "galaxy_id": galaxy_id,
            "planet_id": planet_id,
            "label": "Evolution Seed",
            "minerals": {
                "entity_id": f"evo-{uuid.uuid4().hex[:8]}",
                "label": "Evolution Seed",
                "state": "active",
            },
            "idempotency_key": f"contract-evolution-seed-{uuid.uuid4()}",
        },
    )
    assert created_row.status_code == 201, created_row.text
    row_id = created_row.json()["moon_id"]

    evolved_capability = client.post(
        f"/planets/{planet_id}/capabilities",
        json={
            "galaxy_id": galaxy_id,
            "capability_key": "score.governance",
            "capability_class": "validation",
            "config": {
                "required_fields": ["score"],
                "field_types": {"score": "number"},
                "validators": [{"id": "score-positive", "field": "score", "operator": ">", "value": 0}],
            },
            "order_index": 30,
            "status": "active",
            "idempotency_key": f"contract-evolution-capability-{uuid.uuid4()}",
        },
    )
    assert evolved_capability.status_code == 201, evolved_capability.text
    capability_body = evolved_capability.json()
    assert capability_body["capability_key"] == "score.governance"

    row_detail = client.get(f"/civilizations/{row_id}", params={"galaxy_id": galaxy_id})
    assert row_detail.status_code == 200, row_detail.text
    current_seq = int(row_detail.json().get("current_event_seq") or 0)
    assert current_seq >= 1

    revalidate_fail = client.patch(
        f"/civilizations/{row_id}/mutate",
        json={
            "galaxy_id": galaxy_id,
            "value": "Evolution Seed Revalidate",
            "expected_event_seq": current_seq,
            "idempotency_key": f"contract-evolution-revalidate-{uuid.uuid4()}",
        },
    )
    assert revalidate_fail.status_code == 422, revalidate_fail.text
    revalidate_detail_raw = revalidate_fail.json().get("detail", {})
    revalidate_detail = revalidate_detail_raw[0] if isinstance(revalidate_detail_raw, list) else revalidate_detail_raw
    assert revalidate_detail.get("code") == "TABLE_CONTRACT_VIOLATION"
    assert revalidate_detail.get("reason") == "required_missing"
    assert revalidate_detail.get("mineral_key") == "score"
    assert revalidate_detail.get("source") == "moon_capability"
    assert revalidate_detail.get("capability_key") == "score.governance"

    mark_invalid = client.patch(
        f"/civilizations/{row_id}/mutate",
        json={
            "galaxy_id": galaxy_id,
            "metadata": {"score": -5},
            "expected_event_seq": current_seq,
            "idempotency_key": f"contract-evolution-invalid-{uuid.uuid4()}",
        },
    )
    assert mark_invalid.status_code == 422, mark_invalid.text
    mark_invalid_detail_raw = mark_invalid.json().get("detail", {})
    mark_invalid_detail = (
        mark_invalid_detail_raw[0] if isinstance(mark_invalid_detail_raw, list) else mark_invalid_detail_raw
    )
    assert mark_invalid_detail.get("code") == "TABLE_CONTRACT_VIOLATION"
    assert mark_invalid_detail.get("reason") == "validator_failed"
    assert mark_invalid_detail.get("mineral_key") == "score"
    assert mark_invalid_detail.get("actual_value") == -5
    assert mark_invalid_detail.get("rule_id") == "score-positive"

    backfill = client.patch(
        f"/civilizations/{row_id}/mutate",
        json={
            "galaxy_id": galaxy_id,
            "metadata": {"score": 10},
            "expected_event_seq": current_seq,
            "idempotency_key": f"contract-evolution-backfill-{uuid.uuid4()}",
        },
    )
    assert backfill.status_code == 200, backfill.text
    backfill_body = backfill.json()
    assert backfill_body.get("metadata", {}).get("score") == 10
    next_seq = int(backfill_body.get("current_event_seq") or 0)
    assert next_seq > current_seq

    revalidate_ok = client.patch(
        f"/civilizations/{row_id}/mutate",
        json={
            "galaxy_id": galaxy_id,
            "value": "Evolution Seed Valid",
            "expected_event_seq": next_seq,
            "idempotency_key": f"contract-evolution-revalidate-ok-{uuid.uuid4()}",
        },
    )
    assert revalidate_ok.status_code == 200, revalidate_ok.text

    snapshot = client.get("/universe/snapshot", params={"galaxy_id": galaxy_id})
    assert snapshot.status_code == 200, snapshot.text
    row = next((item for item in snapshot.json().get("civilizations", []) if item.get("id") == row_id), None)
    assert row is not None
    assert row.get("metadata", {}).get("score") == 10


def test_contract_violation_explainability_payload_shape(auth_client: tuple[httpx.Client, str]) -> None:
    client, galaxy_id = auth_client
    planet_name = f"Explainability > Planet-{uuid.uuid4().hex[:8]}"
    created_planet = client.post(
        "/planets",
        json={
            "name": planet_name,
            "archetype": "catalog",
            "initial_schema_mode": "empty",
            "galaxy_id": galaxy_id,
            "idempotency_key": f"explainability-planet-{uuid.uuid4()}",
        },
    )
    assert created_planet.status_code == 201, created_planet.text
    planet_id = created_planet.json()["table_id"]

    base_contract = client.post(
        f"/contracts/{planet_id}",
        json={
            "galaxy_id": galaxy_id,
            "required_fields": ["entity_id", "state"],
            "field_types": {"entity_id": "string", "state": "string"},
            "validators": [],
            "unique_rules": [],
            "physics_rulebook": {"defaults": {"table_name": planet_name}},
        },
    )
    assert base_contract.status_code == 201, base_contract.text

    capability = client.post(
        f"/planets/{planet_id}/capabilities",
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
            "order_index": 20,
            "status": "active",
            "idempotency_key": f"explainability-capability-{uuid.uuid4()}",
        },
    )
    assert capability.status_code == 201, capability.text
    capability_body = capability.json()
    capability_id = capability_body["id"]
    assert capability_body["capability_key"] == "state.guard"

    violated = client.post(
        "/civilizations/ingest",
        json={
            "value": "Explainability row",
            "metadata": {
                "table": planet_name,
                "entity_id": f"entity-{uuid.uuid4().hex[:8]}",
                "state": "archived",
            },
            "galaxy_id": galaxy_id,
        },
    )
    assert violated.status_code == 422, violated.text
    detail = violated.json().get("detail")
    assert isinstance(detail, dict)
    assert detail["code"] == "TABLE_CONTRACT_VIOLATION"
    assert "Table contract violation" in str(detail["message"])
    assert detail["table_name"] == planet_name
    assert detail["reason"] == "validator_failed"
    assert detail["mineral_key"] == "state"
    assert detail["actual_value"] == "archived"
    assert detail["operator"] == "=="
    assert detail["expected_value"] == "active"
    assert detail["expected_constraint"] == {"operator": "==", "value": "active"}
    assert detail["repair_hint"] == "Adjust 'state' to satisfy '== active'."
    assert detail["rule_id"] == "state-must-be-active"
    assert detail["source"] == "moon_capability"
    assert detail["capability_key"] == "state.guard"
    assert detail["capability_id"] == capability_id


def test_planet_moon_impact_endpoint_scope_and_shape(auth_client: tuple[httpx.Client, str]) -> None:
    client, galaxy_id = auth_client
    planet_name = f"MoonImpact > Planet-{uuid.uuid4().hex[:8]}"
    created_planet = client.post(
        "/planets",
        json={
            "name": planet_name,
            "archetype": "catalog",
            "initial_schema_mode": "empty",
            "galaxy_id": galaxy_id,
            "idempotency_key": f"moon-impact-planet-{uuid.uuid4()}",
        },
    )
    assert created_planet.status_code == 201, created_planet.text
    planet_id = created_planet.json()["table_id"]

    capability = client.post(
        f"/planets/{planet_id}/capabilities",
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
            "order_index": 10,
            "status": "active",
            "idempotency_key": f"moon-impact-capability-{uuid.uuid4()}",
        },
    )
    assert capability.status_code == 201, capability.text
    capability_body = capability.json()
    capability_id = capability_body["id"]

    seeded = client.post(
        "/civilizations/ingest",
        json={
            "value": "Moon impact valid row",
            "metadata": {
                "table": planet_name,
                "entity_id": f"impact-ok-{uuid.uuid4().hex[:8]}",
                "label": "Moon impact valid row",
                "state": "active",
            },
            "galaxy_id": galaxy_id,
            "idempotency_key": f"moon-impact-row-valid-{uuid.uuid4()}",
        },
    )
    assert seeded.status_code == 200, seeded.text

    impact = client.get(
        f"/planets/{planet_id}/moon-impact",
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
    assert body["planet_id"] == planet_id
    assert body["galaxy_id"] == galaxy_id
    assert body["branch_id"] is None
    assert isinstance(body.get("generated_at"), str) and body.get("generated_at")
    assert isinstance(body.get("items"), list)
    assert isinstance(body.get("summary"), dict)

    items = body["items"]
    state_rule = next((item for item in items if item.get("rule_id") == "state-must-be-active"), None)
    assert state_rule is not None
    assert state_rule["capability_id"] == capability_id
    assert state_rule["rule_kind"] == "validator"
    assert state_rule["impact_kind"] == "validate"
    assert state_rule["mineral_key"] == "state"
    assert int(state_rule["active_violations_count"]) >= 0
    assert int(state_rule["impacted_civilizations_count"]) >= 0
    assert isinstance(state_rule.get("impacted_civilization_ids"), list)
    assert isinstance(state_rule.get("violation_samples"), list)
    if state_rule["violation_samples"]:
        sample = state_rule["violation_samples"][0]
        assert sample["mineral_key"] == "state"
        assert sample["state"] in {"WARNING", "ANOMALY"}
        assert sample["detail"]["rule_id"] == "state-must-be-active"
        assert sample["detail"]["capability_id"] == capability_id
        assert sample["detail"]["expected_constraint"] == {"operator": "==", "value": "active"}
        assert isinstance(sample["detail"]["repair_hint"], str) and sample["detail"]["repair_hint"]

    summary = body["summary"]
    assert int(summary["capabilities_count"]) >= 1
    assert int(summary["rules_count"]) >= 1
    assert int(summary["active_violations_count"]) >= 0


def test_civilization_first_class_canonical_endpoints(auth_client: tuple[httpx.Client, str]) -> None:
    client, galaxy_id = auth_client
    planet_name = f"CivilizationAlias > Planet-{uuid.uuid4().hex[:8]}"
    created_planet = client.post(
        "/planets",
        json={
            "name": planet_name,
            "archetype": "catalog",
            "initial_schema_mode": "empty",
            "galaxy_id": galaxy_id,
            "idempotency_key": f"civilization-alias-planet-{uuid.uuid4()}",
        },
    )
    assert created_planet.status_code == 201, created_planet.text
    planet_id = created_planet.json()["table_id"]

    created = client.post(
        "/civilizations",
        json={
            "galaxy_id": galaxy_id,
            "planet_id": planet_id,
            "label": "Civilization Alias Seed",
            "minerals": {
                "entity_id": f"civilization-{uuid.uuid4().hex[:8]}",
                "label": "Civilization Alias Seed",
                "state": "active",
            },
            "idempotency_key": f"civilization-alias-create-{uuid.uuid4()}",
        },
    )
    assert created.status_code == 201, created.text
    created_body = created.json()
    moon_id = created_body["moon_id"]
    event_seq = int(created_body.get("current_event_seq") or 0)
    assert event_seq >= 1

    listed = client.get("/civilizations", params={"galaxy_id": galaxy_id, "planet_id": planet_id})
    assert listed.status_code == 200, listed.text
    listed_items = listed.json().get("items", [])
    listed_row = next((item for item in listed_items if item.get("moon_id") == moon_id), None)
    assert listed_row is not None

    removed_alias_list = client.get("/moons", params={"galaxy_id": galaxy_id, "planet_id": planet_id})
    assert removed_alias_list.status_code == 404, removed_alias_list.text

    mutated = client.patch(
        f"/civilizations/{moon_id}/minerals/state",
        json={
            "galaxy_id": galaxy_id,
            "typed_value": "archived",
            "expected_event_seq": event_seq,
            "idempotency_key": f"civilization-alias-mutate-{uuid.uuid4()}",
        },
    )
    assert mutated.status_code == 200, mutated.text
    facts_by_key = {item["key"]: item for item in mutated.json().get("facts", [])}
    assert facts_by_key["state"]["typed_value"] == "archived"
    mutated_seq = int(mutated.json().get("current_event_seq") or 0)
    assert mutated_seq > event_seq

    detail_via_civilizations = client.get(f"/civilizations/{moon_id}", params={"galaxy_id": galaxy_id})
    assert detail_via_civilizations.status_code == 200, detail_via_civilizations.text
    detail_facts = {item["key"]: item for item in detail_via_civilizations.json().get("facts", [])}
    assert detail_facts["state"]["typed_value"] == "archived"

    extinguished = client.patch(
        f"/civilizations/{moon_id}/extinguish",
        params={
            "galaxy_id": galaxy_id,
            "expected_event_seq": mutated_seq,
            "idempotency_key": f"civilization-alias-extinguish-{uuid.uuid4()}",
        },
    )
    assert extinguished.status_code == 200, extinguished.text
    extinguished_body = extinguished.json()
    assert str(extinguished_body.get("moon_id") or extinguished_body.get("id") or "") == str(moon_id)
    assert extinguished_body["is_deleted"] is True

    missing_after_delete = client.get(f"/civilizations/{moon_id}", params={"galaxy_id": galaxy_id})
    assert missing_after_delete.status_code == 404, missing_after_delete.text


def test_moons_alias_endpoints_removed(auth_client: tuple[httpx.Client, str]) -> None:
    client, galaxy_id = auth_client
    planet_name = f"MoonAliasParity > Planet-{uuid.uuid4().hex[:8]}"
    created_planet = client.post(
        "/planets",
        json={
            "name": planet_name,
            "archetype": "catalog",
            "initial_schema_mode": "empty",
            "galaxy_id": galaxy_id,
            "idempotency_key": f"moon-alias-parity-planet-{uuid.uuid4()}",
        },
    )
    assert created_planet.status_code == 201, created_planet.text
    planet_id = created_planet.json()["table_id"]

    created = client.post(
        "/civilizations",
        json={
            "galaxy_id": galaxy_id,
            "planet_id": planet_id,
            "label": "Moon Alias Parity Seed",
            "minerals": {
                "entity_id": f"moon-alias-{uuid.uuid4().hex[:8]}",
                "label": "Moon Alias Parity Seed",
                "state": "active",
            },
            "idempotency_key": f"moon-alias-parity-create-{uuid.uuid4()}",
        },
    )
    assert created.status_code == 201, created.text
    moon_id = created.json()["moon_id"]
    expected_event_seq = int(created.json().get("current_event_seq") or 0)
    assert expected_event_seq >= 1

    listed_moons = client.get("/moons", params={"galaxy_id": galaxy_id, "planet_id": planet_id})
    assert listed_moons.status_code == 404, listed_moons.text

    detail_moon = client.get(f"/moons/{moon_id}", params={"galaxy_id": galaxy_id})
    assert detail_moon.status_code == 404, detail_moon.text

    mutated_moon = client.patch(
        f"/moons/{moon_id}/mutate",
        json={
            "galaxy_id": galaxy_id,
            "minerals": {"state": "archived"},
            "expected_event_seq": expected_event_seq,
            "idempotency_key": f"moon-alias-parity-mutate-{uuid.uuid4()}",
        },
    )
    assert mutated_moon.status_code == 404, mutated_moon.text

    extinguished_moon = client.patch(
        f"/moons/{moon_id}/extinguish",
        params={
            "galaxy_id": galaxy_id,
            "expected_event_seq": expected_event_seq,
            "idempotency_key": f"moon-alias-parity-extinguish-{uuid.uuid4()}",
        },
    )
    assert extinguished_moon.status_code == 404, extinguished_moon.text


def test_civilization_mineral_endpoint_patch_remove_and_health(auth_client: tuple[httpx.Client, str]) -> None:
    client, galaxy_id = auth_client
    planet_name = f"CivilizationMineral > Planet-{uuid.uuid4().hex[:8]}"
    created_planet = client.post(
        "/planets",
        json={
            "name": planet_name,
            "archetype": "catalog",
            "initial_schema_mode": "empty",
            "galaxy_id": galaxy_id,
            "idempotency_key": f"civilization-mineral-endpoint-planet-{uuid.uuid4()}",
        },
    )
    assert created_planet.status_code == 201, created_planet.text
    planet_id = created_planet.json()["table_id"]

    created = client.post(
        "/civilizations",
        json={
            "galaxy_id": galaxy_id,
            "planet_id": planet_id,
            "label": "Civilization Mineral Seed",
            "minerals": {
                "entity_id": f"civilization-mineral-{uuid.uuid4().hex[:8]}",
                "label": "Civilization Mineral Seed",
                "state": "active",
                "segment": "core",
            },
            "idempotency_key": f"civilization-mineral-endpoint-create-{uuid.uuid4()}",
        },
    )
    assert created.status_code == 201, created.text
    created_body = created.json()
    moon_id = created_body["moon_id"]
    created_event_seq = int(created_body.get("current_event_seq") or 0)
    assert created_event_seq >= 1
    assert created_body["state"] == "ACTIVE"
    assert created_body["health_score"] == 100
    assert created_body["violation_count"] == 0
    assert created_body["last_violation_at"] is None

    mineral_mutate = client.patch(
        f"/civilizations/{moon_id}/minerals/segment",
        json={
            "galaxy_id": galaxy_id,
            "typed_value": "enterprise",
            "expected_event_seq": created_event_seq,
            "idempotency_key": f"civilization-mineral-endpoint-mutate-{uuid.uuid4()}",
        },
    )
    assert mineral_mutate.status_code == 200, mineral_mutate.text
    mineral_mutate_body = mineral_mutate.json()
    mutate_event_seq = int(mineral_mutate_body.get("current_event_seq") or 0)
    assert mutate_event_seq > created_event_seq
    mutate_facts = {fact["key"]: fact for fact in mineral_mutate_body.get("facts", [])}
    assert mutate_facts["segment"]["typed_value"] == "enterprise"
    assert mineral_mutate_body["state"] == "ACTIVE"
    assert mineral_mutate_body["violation_count"] == 0

    remove_via_canonical = client.patch(
        f"/civilizations/{moon_id}/minerals/segment",
        json={
            "galaxy_id": galaxy_id,
            "remove": True,
            "expected_event_seq": mutate_event_seq,
            "idempotency_key": f"civilization-mineral-endpoint-remove-{uuid.uuid4()}",
        },
    )
    assert remove_via_canonical.status_code == 200, remove_via_canonical.text
    removed_body = remove_via_canonical.json()
    remove_event_seq = int(removed_body.get("current_event_seq") or 0)
    assert remove_event_seq > mutate_event_seq
    removed_facts = {fact["key"]: fact for fact in removed_body.get("facts", [])}
    assert "segment" not in removed_facts

    stale_occ = client.patch(
        f"/civilizations/{moon_id}/minerals/state",
        json={
            "galaxy_id": galaxy_id,
            "typed_value": "active",
            "expected_event_seq": mutate_event_seq,
            "idempotency_key": f"civilization-mineral-endpoint-occ-{uuid.uuid4()}",
        },
    )
    _assert_occ_conflict(stale_occ, expected_event_seq=mutate_event_seq)

    detail = client.get(f"/civilizations/{moon_id}", params={"galaxy_id": galaxy_id})
    assert detail.status_code == 200, detail.text
    detail_body = detail.json()
    detail_facts = {fact["key"]: fact for fact in detail_body.get("facts", [])}
    assert "segment" not in detail_facts
    assert detail_body["state"] == "ACTIVE"
    assert detail_body["health_score"] == 100
    assert detail_body["violation_count"] == 0


def test_civilization_mineral_state_blocks_archived_to_active_transition(
    auth_client: tuple[httpx.Client, str],
) -> None:
    client, galaxy_id = auth_client
    planet_name = f"CivilizationMineralLifecycle > Planet-{uuid.uuid4().hex[:8]}"
    created_planet = client.post(
        "/planets",
        json={
            "name": planet_name,
            "archetype": "catalog",
            "initial_schema_mode": "empty",
            "galaxy_id": galaxy_id,
            "idempotency_key": f"civilization-mineral-lifecycle-planet-{uuid.uuid4()}",
        },
    )
    assert created_planet.status_code == 201, created_planet.text
    planet_id = created_planet.json()["table_id"]

    created = client.post(
        "/civilizations",
        json={
            "galaxy_id": galaxy_id,
            "planet_id": planet_id,
            "label": "Civilization Mineral Lifecycle Seed",
            "minerals": {
                "entity_id": f"civilization-mineral-lifecycle-{uuid.uuid4().hex[:8]}",
                "label": "Civilization Mineral Lifecycle Seed",
                "state": "active",
            },
            "idempotency_key": f"civilization-mineral-lifecycle-create-{uuid.uuid4()}",
        },
    )
    assert created.status_code == 201, created.text
    created_body = created.json()
    moon_id = str(created_body["moon_id"])
    created_event_seq = int(created_body.get("current_event_seq") or 0)
    assert created_event_seq >= 1

    archive = client.patch(
        f"/civilizations/{moon_id}/minerals/state",
        json={
            "galaxy_id": galaxy_id,
            "typed_value": "archived",
            "expected_event_seq": created_event_seq,
            "idempotency_key": f"civilization-mineral-lifecycle-archive-{uuid.uuid4()}",
        },
    )
    assert archive.status_code == 200, archive.text
    archive_body = archive.json()
    archive_event_seq = int(archive_body.get("current_event_seq") or 0)
    assert archive_event_seq > created_event_seq
    archive_facts = {fact["key"]: fact for fact in archive_body.get("facts", [])}
    assert archive_facts["state"]["typed_value"] == "archived"
    # Top-level `state` in this payload is health/runtime state, not lifecycle mineral value.
    archive_detail = client.get(f"/civilizations/{moon_id}", params={"galaxy_id": galaxy_id})
    assert archive_detail.status_code == 200, archive_detail.text
    archive_detail_facts = {fact["key"]: fact for fact in archive_detail.json().get("facts", [])}
    assert archive_detail_facts["state"]["typed_value"] == "archived"

    invalid_reactivate = client.patch(
        f"/civilizations/{moon_id}/minerals/state",
        json={
            "galaxy_id": galaxy_id,
            "typed_value": "active",
            "expected_event_seq": archive_event_seq,
            "idempotency_key": f"civilization-mineral-lifecycle-reactivate-{uuid.uuid4()}",
        },
    )
    assert invalid_reactivate.status_code == 422, invalid_reactivate.text
    invalid_detail = invalid_reactivate.json().get("detail", {})
    assert isinstance(invalid_detail, dict)
    assert invalid_detail.get("code") == "LIFECYCLE_TRANSITION_BLOCKED"
    assert invalid_detail.get("reason") == "invalid_transition"
    assert invalid_detail.get("from_state") == "ARCHIVED"
    assert invalid_detail.get("target_state") == "ACTIVE"


def test_civilization_mineral_edit_mutate_facts_convergence_v1(auth_client: tuple[httpx.Client, str]) -> None:
    client, galaxy_id = auth_client
    planet_name = f"CMV2-08 > Planet-{uuid.uuid4().hex[:8]}"
    created_planet = client.post(
        "/planets",
        json={
            "name": planet_name,
            "archetype": "catalog",
            "initial_schema_mode": "empty",
            "galaxy_id": galaxy_id,
            "idempotency_key": f"cmv2-08-planet-{uuid.uuid4()}",
        },
    )
    assert created_planet.status_code == 201, created_planet.text
    planet_id = created_planet.json()["table_id"]

    created = client.post(
        "/civilizations",
        json={
            "galaxy_id": galaxy_id,
            "planet_id": planet_id,
            "label": "CMV2-08 Seed",
            "minerals": {
                "entity_id": f"cmv2-08-{uuid.uuid4().hex[:8]}",
                "label": "CMV2-08 Seed",
                "state": "active",
                "amount": 100,
            },
            "idempotency_key": f"cmv2-08-create-{uuid.uuid4()}",
        },
    )
    assert created.status_code == 201, created.text
    created_body = created.json()
    moon_id = str(created_body["moon_id"])
    first_seq = int(created_body.get("current_event_seq") or 0)
    assert first_seq >= 1

    mutated = client.patch(
        f"/civilizations/{moon_id}/minerals/amount",
        json={
            "galaxy_id": galaxy_id,
            "typed_value": 321.5,
            "expected_event_seq": first_seq,
            "idempotency_key": f"cmv2-08-mutate-{uuid.uuid4()}",
        },
    )
    assert mutated.status_code == 200, mutated.text
    mutated_body = mutated.json()
    second_seq = int(mutated_body.get("current_event_seq") or 0)
    assert second_seq > first_seq
    mutated_facts = {fact["key"]: fact for fact in mutated_body.get("facts", [])}
    assert mutated_facts["amount"]["typed_value"] == 321.5

    listed = client.get("/civilizations", params={"galaxy_id": galaxy_id, "planet_id": planet_id})
    assert listed.status_code == 200, listed.text
    listed_row = next((item for item in listed.json().get("items", []) if item.get("moon_id") == moon_id), None)
    assert listed_row is not None
    listed_facts = {fact["key"]: fact for fact in listed_row.get("facts", [])}
    assert listed_facts["amount"]["typed_value"] == 321.5
    assert int(listed_row.get("current_event_seq") or 0) == second_seq

    detail = client.get(f"/civilizations/{moon_id}", params={"galaxy_id": galaxy_id})
    assert detail.status_code == 200, detail.text
    detail_body = detail.json()
    detail_facts = {fact["key"]: fact for fact in detail_body.get("facts", [])}
    assert detail_facts["amount"]["typed_value"] == 321.5
    assert int(detail_body.get("current_event_seq") or 0) == second_seq

    snapshot = client.get("/universe/snapshot", params={"galaxy_id": galaxy_id})
    assert snapshot.status_code == 200, snapshot.text
    snapshot_row = next((item for item in snapshot.json().get("civilizations", []) if item.get("id") == moon_id), None)
    assert snapshot_row is not None
    snapshot_facts = {fact["key"]: fact for fact in snapshot_row.get("facts", [])}
    assert snapshot_facts["amount"]["typed_value"] == 321.5
    assert int(snapshot_row.get("current_event_seq") or 0) == second_seq

    removed = client.patch(
        f"/civilizations/{moon_id}/minerals/state",
        json={
            "galaxy_id": galaxy_id,
            "remove": True,
            "expected_event_seq": second_seq,
            "idempotency_key": f"cmv2-08-remove-{uuid.uuid4()}",
        },
    )
    assert removed.status_code == 422, removed.text
    removed_detail = removed.json().get("detail", {})
    assert isinstance(removed_detail, dict)
    assert removed_detail.get("code") == "LIFECYCLE_TRANSITION_BLOCKED"
    assert removed_detail.get("reason") == "state_remove_not_allowed"
    assert removed_detail.get("from_state") == "ACTIVE"

    detail_after_remove = client.get(f"/civilizations/{moon_id}", params={"galaxy_id": galaxy_id})
    assert detail_after_remove.status_code == 200, detail_after_remove.text
    detail_after_remove_facts = {fact["key"]: fact for fact in detail_after_remove.json().get("facts", [])}
    assert detail_after_remove_facts["state"]["typed_value"] == "active"
    assert int(detail_after_remove.json().get("current_event_seq") or 0) == second_seq

    snapshot_after_remove = client.get("/universe/snapshot", params={"galaxy_id": galaxy_id})
    assert snapshot_after_remove.status_code == 200, snapshot_after_remove.text
    snapshot_after_remove_row = next(
        (item for item in snapshot_after_remove.json().get("civilizations", []) if item.get("id") == moon_id),
        None,
    )
    assert snapshot_after_remove_row is not None
    snapshot_after_remove_facts = {fact["key"]: fact for fact in snapshot_after_remove_row.get("facts", [])}
    assert snapshot_after_remove_facts["state"]["typed_value"] == "active"
    assert int(snapshot_after_remove_row.get("current_event_seq") or 0) == second_seq


def test_civilization_contract_gate_create_mutate_extinguish_and_converge(
    auth_client: tuple[httpx.Client, str],
) -> None:
    client, galaxy_id = auth_client
    planet_name = f"Civilization > Gate-{uuid.uuid4().hex[:8]}"
    created_planet = client.post(
        "/planets",
        json={
            "name": planet_name,
            "archetype": "catalog",
            "initial_schema_mode": "empty",
            "galaxy_id": galaxy_id,
            "idempotency_key": f"civil-gate-planet-{uuid.uuid4()}",
        },
    )
    assert created_planet.status_code == 201, created_planet.text
    table_id = created_planet.json()["table_id"]

    created = client.post(
        "/civilizations/ingest",
        json={
            "value": "Civilization Gate Seed",
            "metadata": {
                "table": planet_name,
                "entity_id": f"entity-{uuid.uuid4().hex[:8]}",
                "label": "Civilization Gate Seed",
                "state": "active",
                "segment": "ops",
            },
            "galaxy_id": galaxy_id,
            "idempotency_key": f"civil-gate-ingest-{uuid.uuid4()}",
        },
    )
    assert created.status_code == 200, created.text
    body = created.json()
    civilization_id = body["id"]
    assert body["is_deleted"] is False
    expected_seq = int(body["current_event_seq"] or 0)
    assert expected_seq >= 1

    mutated = client.patch(
        f"/civilizations/{civilization_id}/mutate",
        json={
            "metadata": {"state": "archived"},
            "expected_event_seq": expected_seq,
            "galaxy_id": galaxy_id,
            "idempotency_key": f"civil-gate-mutate-{uuid.uuid4()}",
        },
    )
    assert mutated.status_code == 200, mutated.text
    mutated_body = mutated.json()
    assert mutated_body["metadata"]["state"] == "archived"
    extinguish_expected_seq = int(mutated_body["current_event_seq"] or 0)
    assert extinguish_expected_seq >= expected_seq

    tables_before = client.get("/universe/tables", params={"galaxy_id": galaxy_id})
    assert tables_before.status_code == 200, tables_before.text
    target_table = next(
        (row for row in tables_before.json().get("tables", []) if row.get("table_id") == table_id), None
    )
    assert target_table is not None
    member_ids_before = {item.get("id") for item in target_table.get("members", [])}
    assert civilization_id in member_ids_before

    extinguished = client.patch(
        f"/civilizations/{civilization_id}/extinguish",
        params={"galaxy_id": galaxy_id, "expected_event_seq": extinguish_expected_seq},
    )
    assert extinguished.status_code == 200, extinguished.text
    extinguished_body = extinguished.json()
    assert extinguished_body["is_deleted"] is True
    assert extinguished_body["deleted_at"] is not None

    snapshot_after = client.get("/universe/snapshot", params={"galaxy_id": galaxy_id})
    assert snapshot_after.status_code == 200, snapshot_after.text
    snapshot_ids = {item.get("id") for item in snapshot_after.json().get("civilizations", [])}
    assert civilization_id not in snapshot_ids

    tables_after = client.get("/universe/tables", params={"galaxy_id": galaxy_id})
    assert tables_after.status_code == 200, tables_after.text
    target_after = next((row for row in tables_after.json().get("tables", []) if row.get("table_id") == table_id), None)
    assert target_after is not None
    member_ids_after = {item.get("id") for item in target_after.get("members", [])}
    assert civilization_id not in member_ids_after
    assert member_ids_after == {
        item.get("id") for item in snapshot_after.json().get("civilizations", []) if item.get("table_id") == table_id
    }


def test_mineral_contract_gate_typing_validation_and_facts_projection(auth_client: tuple[httpx.Client, str]) -> None:
    client, galaxy_id = auth_client
    table_name = f"Mineral > Gate-{uuid.uuid4().hex[:8]}"
    table_id = str(uuid.uuid5(uuid.NAMESPACE_URL, f"dataverse:{galaxy_id}:{table_name.lower()}"))

    contract = client.post(
        f"/contracts/{table_id}",
        json={
            "galaxy_id": galaxy_id,
            "required_fields": ["amount"],
            "field_types": {"amount": "number", "paid_at": "datetime"},
            "validators": [{"field": "amount", "operator": ">", "value": 0}],
            "unique_rules": [],
            "formula_registry": [{"id": "vat-calc", "target": "vat", "expression": "SUM(amount)"}],
            "physics_rulebook": {"defaults": {"table_name": table_name}},
        },
    )
    assert contract.status_code == 201, contract.text

    invalid = client.post(
        "/civilizations/ingest",
        json={
            "value": "Invalid mineral row",
            "metadata": {"table": table_name, "amount": "abc"},
            "galaxy_id": galaxy_id,
        },
    )
    assert invalid.status_code == 422, invalid.text
    assert "Table contract violation" in invalid.text

    valid = client.post(
        "/civilizations/ingest",
        json={
            "value": "Valid mineral row",
            "metadata": {
                "table": table_name,
                "amount": 123.45,
                "paid_at": "2026-03-01T10:00:00Z",
                "status": "paid",
            },
            "galaxy_id": galaxy_id,
        },
    )
    assert valid.status_code == 200, valid.text
    civilization_id = valid.json()["id"]

    snapshot = client.get("/universe/snapshot", params={"galaxy_id": galaxy_id})
    assert snapshot.status_code == 200, snapshot.text
    row = next((item for item in snapshot.json().get("civilizations", []) if item.get("id") == civilization_id), None)
    assert row is not None
    assert row["table_name"] == table_name
    facts = row.get("facts", [])
    assert isinstance(facts, list)
    facts_by_key = {item["key"]: item for item in facts}
    assert facts_by_key["amount"]["value_type"] == "number"
    assert facts_by_key["amount"]["source"] == "metadata"
    assert facts_by_key["status"]["value_type"] == "string"
    assert facts_by_key["paid_at"]["value_type"] == "datetime"
    if "vat" in facts_by_key:
        assert facts_by_key["vat"]["source"] == "calculated"


def test_release_gate_star_lock_first_planet_grid_convergence(auth_client: tuple[httpx.Client, str]) -> None:
    client, galaxy_id = auth_client

    lock = client.post(
        f"/galaxies/{galaxy_id}/star-core/policy/lock",
        json={
            "profile_key": "SENTINEL",
            "lock_after_apply": True,
            "physical_profile_key": "BALANCE",
            "physical_profile_version": 1,
        },
    )
    assert lock.status_code == 200, lock.text
    lock_body = lock.json()
    assert lock_body["lock_status"] == "locked"
    assert lock_body["can_edit_core_laws"] is False

    planet_name = f"Core > FirstPlanet-{uuid.uuid4().hex[:8]}"
    created_planet = client.post(
        "/planets",
        json={
            "name": planet_name,
            "archetype": "catalog",
            "initial_schema_mode": "empty",
            "galaxy_id": galaxy_id,
            "idempotency_key": f"release-gate-first-planet-{uuid.uuid4()}",
        },
    )
    assert created_planet.status_code == 201, created_planet.text
    planet_body = created_planet.json()
    table_id = planet_body["table_id"]

    tables_after_create = client.get("/universe/tables", params={"galaxy_id": galaxy_id})
    assert tables_after_create.status_code == 200, tables_after_create.text
    table_row = next(
        (row for row in tables_after_create.json().get("tables", []) if row.get("table_id") == table_id),
        None,
    )
    assert table_row is not None
    assert isinstance(table_row.get("members"), list)
    assert table_row["members"] == []

    first_moon = client.post(
        "/civilizations/ingest",
        json={
            "value": f"FirstMoon-{uuid.uuid4().hex[:6]}",
            # Catalog archetype requires entity_id/label/state by table contract.
            # Avoid reserved `type/category` keys so table resolution stays on `table`.
            "metadata": {
                "table": planet_name,
                "entity_id": f"seed-{uuid.uuid4().hex[:8]}",
                "label": "Seed moon",
                "state": "active",
                "seed_kind": "seed",
            },
            "galaxy_id": galaxy_id,
        },
    )
    assert first_moon.status_code == 200, first_moon.text
    moon_id = first_moon.json()["id"]

    snapshot = client.get("/universe/snapshot", params={"galaxy_id": galaxy_id})
    assert snapshot.status_code == 200, snapshot.text
    snapshot_rows_for_planet = [r for r in snapshot.json().get("civilizations", []) if r.get("table_id") == table_id]
    snapshot_ids = {row.get("id") for row in snapshot_rows_for_planet}
    assert moon_id in snapshot_ids

    tables_after_ingest = client.get("/universe/tables", params={"galaxy_id": galaxy_id})
    assert tables_after_ingest.status_code == 200, tables_after_ingest.text
    table_row_after_ingest = next(
        (row for row in tables_after_ingest.json().get("tables", []) if row.get("table_id") == table_id),
        None,
    )
    assert table_row_after_ingest is not None
    member_ids = {member.get("id") for member in table_row_after_ingest.get("members", [])}
    assert moon_id in member_ids

    # Grid convergence gate: table members and snapshot rows for the same planet must be identical.
    assert member_ids == snapshot_ids


def test_release_gate_star_lock_first_planet_moon_lifecycle_grid_convergence(
    auth_client: tuple[httpx.Client, str],
) -> None:
    client, galaxy_id = auth_client

    lock = client.post(
        f"/galaxies/{galaxy_id}/star-core/policy/lock",
        json={
            "profile_key": "SENTINEL",
            "lock_after_apply": True,
            "physical_profile_key": "BALANCE",
            "physical_profile_version": 1,
        },
    )
    assert lock.status_code == 200, lock.text
    lock_body = lock.json()
    assert lock_body["lock_status"] == "locked"
    assert lock_body["can_edit_core_laws"] is False

    planet_name = f"Core > Lifecycle-{uuid.uuid4().hex[:8]}"
    created_planet = client.post(
        "/planets",
        json={
            "name": planet_name,
            "archetype": "catalog",
            "initial_schema_mode": "empty",
            "galaxy_id": galaxy_id,
            "idempotency_key": f"release-gate-lifecycle-planet-{uuid.uuid4()}",
        },
    )
    assert created_planet.status_code == 201, created_planet.text
    table_id = created_planet.json()["table_id"]

    created_moon = client.post(
        "/civilizations",
        json={
            "galaxy_id": galaxy_id,
            "planet_id": table_id,
            "label": "Lifecycle Moon",
            "minerals": {
                "entity_id": f"moon-{uuid.uuid4().hex[:8]}",
                "label": "Lifecycle Moon",
                "state": "active",
            },
            "idempotency_key": f"release-gate-lifecycle-moon-create-{uuid.uuid4()}",
        },
    )
    assert created_moon.status_code == 201, created_moon.text
    created_moon_body = created_moon.json()
    moon_id = created_moon_body["moon_id"]
    current_event_seq = int(created_moon_body.get("current_event_seq") or 0)
    assert current_event_seq >= 1

    snapshot_after_create = client.get("/universe/snapshot", params={"galaxy_id": galaxy_id})
    assert snapshot_after_create.status_code == 200, snapshot_after_create.text
    snapshot_rows_after_create = [
        row for row in snapshot_after_create.json().get("civilizations", []) if row.get("table_id") == table_id
    ]
    snapshot_ids_after_create = {row.get("id") for row in snapshot_rows_after_create}
    assert moon_id in snapshot_ids_after_create

    tables_after_create = client.get("/universe/tables", params={"galaxy_id": galaxy_id})
    assert tables_after_create.status_code == 200, tables_after_create.text
    table_row_after_create = next(
        (row for row in tables_after_create.json().get("tables", []) if row.get("table_id") == table_id),
        None,
    )
    assert table_row_after_create is not None
    table_member_ids_after_create = {item.get("id") for item in table_row_after_create.get("members", [])}
    assert moon_id in table_member_ids_after_create
    assert table_member_ids_after_create == snapshot_ids_after_create

    mutated_moon = client.patch(
        f"/civilizations/{moon_id}/minerals/state",
        json={
            "galaxy_id": galaxy_id,
            "typed_value": "archived",
            "remove": False,
            "expected_event_seq": current_event_seq,
            "idempotency_key": f"release-gate-lifecycle-moon-mutate-{uuid.uuid4()}",
        },
    )
    assert mutated_moon.status_code == 200, mutated_moon.text
    mutated_body = mutated_moon.json()
    facts_by_key = {fact["key"]: fact for fact in mutated_body.get("facts", [])}
    assert facts_by_key["state"]["typed_value"] == "archived"
    next_event_seq = int(mutated_body.get("current_event_seq") or 0)
    assert next_event_seq > current_event_seq

    extinguished = client.patch(
        f"/civilizations/{moon_id}/extinguish",
        params={
            "galaxy_id": galaxy_id,
            "expected_event_seq": next_event_seq,
            "idempotency_key": f"release-gate-lifecycle-moon-extinguish-{uuid.uuid4()}",
        },
    )
    assert extinguished.status_code == 200, extinguished.text
    assert extinguished.json()["id"] == moon_id
    assert extinguished.json()["is_deleted"] is True

    snapshot_after_extinguish = client.get("/universe/snapshot", params={"galaxy_id": galaxy_id})
    assert snapshot_after_extinguish.status_code == 200, snapshot_after_extinguish.text
    snapshot_rows_after_extinguish = [
        row for row in snapshot_after_extinguish.json().get("civilizations", []) if row.get("table_id") == table_id
    ]
    snapshot_ids_after_extinguish = {row.get("id") for row in snapshot_rows_after_extinguish}
    assert moon_id not in snapshot_ids_after_extinguish

    tables_after_extinguish = client.get("/universe/tables", params={"galaxy_id": galaxy_id})
    assert tables_after_extinguish.status_code == 200, tables_after_extinguish.text
    table_row_after_extinguish = next(
        (row for row in tables_after_extinguish.json().get("tables", []) if row.get("table_id") == table_id),
        None,
    )
    assert table_row_after_extinguish is not None
    table_member_ids_after_extinguish = {item.get("id") for item in table_row_after_extinguish.get("members", [])}
    assert moon_id not in table_member_ids_after_extinguish
    assert table_member_ids_after_extinguish == snapshot_ids_after_extinguish


def test_release_gate_star_lock_first_planet_lego_schema_seeded_grid_convergence(
    auth_client: tuple[httpx.Client, str],
) -> None:
    client, galaxy_id = auth_client

    lock = client.post(
        f"/galaxies/{galaxy_id}/star-core/policy/lock",
        json={
            "profile_key": "SENTINEL",
            "lock_after_apply": True,
            "physical_profile_key": "BALANCE",
            "physical_profile_version": 1,
        },
    )
    assert lock.status_code == 200, lock.text
    lock_body = lock.json()
    assert lock_body["lock_status"] == "locked"
    assert lock_body["can_edit_core_laws"] is False

    planet_name = f"Core > LegoPlanet-{uuid.uuid4().hex[:8]}"
    created_planet = client.post(
        "/planets",
        json={
            "name": planet_name,
            "archetype": "catalog",
            "initial_schema_mode": "empty",
            "galaxy_id": galaxy_id,
            "idempotency_key": f"release-gate-lego-planet-{uuid.uuid4()}",
        },
    )
    assert created_planet.status_code == 201, created_planet.text
    table_id = created_planet.json()["table_id"]

    schema_commit = client.post(
        f"/contracts/{table_id}",
        json={
            "galaxy_id": galaxy_id,
            "required_fields": ["transaction_name", "amount", "transaction_type"],
            "field_types": {
                "value": "string",
                "transaction_name": "string",
                "amount": "number",
                "transaction_type": "string",
            },
            "unique_rules": [],
            "validators": [],
            "auto_semantics": [],
            "schema_registry": {
                "required_fields": ["transaction_name", "amount", "transaction_type"],
                "field_types": {
                    "value": "string",
                    "transaction_name": "string",
                    "amount": "number",
                    "transaction_type": "string",
                },
                "unique_rules": [],
                "validators": [],
                "auto_semantics": [],
            },
            "formula_registry": [],
            "physics_rulebook": {"rules": [], "defaults": {}},
        },
    )
    assert schema_commit.status_code in (200, 201), schema_commit.text
    schema_body = schema_commit.json()
    assert schema_body["field_types"]["amount"] == "number"
    assert "transaction_name" in schema_body["required_fields"]

    seed_rows = [
        {"label": "Salary", "amount": 48000, "transaction_type": "INCOME"},
        {"label": "Rent", "amount": -17000, "transaction_type": "EXPENSE"},
        {"label": "Groceries", "amount": -4200, "transaction_type": "EXPENSE"},
    ]
    created_ids: list[str] = []
    for row in seed_rows:
        created_civilization = client.post(
            "/civilizations",
            json={
                "galaxy_id": galaxy_id,
                "planet_id": table_id,
                "label": row["label"],
                "minerals": {
                    "entity_id": f"civilization-{uuid.uuid4().hex[:8]}",
                    "label": row["label"],
                    "state": "active",
                    "transaction_name": row["label"],
                    "amount": row["amount"],
                    "transaction_type": row["transaction_type"],
                },
                "idempotency_key": f"release-gate-lego-seed-{uuid.uuid4()}",
            },
        )
        assert created_civilization.status_code == 201, created_civilization.text
        created_body = created_civilization.json()
        created_ids.append(str(created_body["moon_id"]))
        facts_by_key = {fact["key"]: fact for fact in created_body.get("facts", [])}
        assert facts_by_key["transaction_name"]["typed_value"] == row["label"]
        assert facts_by_key["amount"]["value_type"] == "number"
        assert facts_by_key["transaction_type"]["typed_value"] == row["transaction_type"]

    snapshot = client.get("/universe/snapshot", params={"galaxy_id": galaxy_id})
    assert snapshot.status_code == 200, snapshot.text
    snapshot_rows_for_planet = [r for r in snapshot.json().get("civilizations", []) if r.get("table_id") == table_id]
    snapshot_ids = {str(row.get("id")) for row in snapshot_rows_for_planet}
    assert set(created_ids).issubset(snapshot_ids)
    for row in snapshot_rows_for_planet:
        if str(row.get("id")) not in created_ids:
            continue
        facts_by_key = {fact["key"]: fact for fact in row.get("facts", [])}
        assert facts_by_key["amount"]["value_type"] == "number"
        assert facts_by_key["transaction_name"]["source"] == "metadata"
        assert facts_by_key["transaction_type"]["source"] == "metadata"

    tables = client.get("/universe/tables", params={"galaxy_id": galaxy_id})
    assert tables.status_code == 200, tables.text
    table_row = next((row for row in tables.json().get("tables", []) if row.get("table_id") == table_id), None)
    assert table_row is not None
    member_ids = {str(member.get("id")) for member in table_row.get("members", [])}
    assert set(created_ids).issubset(member_ids)

    # End-to-end convergence gate: members surfaced in grid projection must equal snapshot rows for same planet.
    assert member_ids == snapshot_ids


def test_planet_stage0_two_planets_validate_star_laws(auth_client: tuple[httpx.Client, str]) -> None:
    client, galaxy_id = auth_client
    catalog_name = f"Law > Catalog-{uuid.uuid4().hex[:8]}"
    stream_name = f"Law > Stream-{uuid.uuid4().hex[:8]}"

    created_catalog = client.post(
        "/planets",
        json={
            "name": catalog_name,
            "archetype": "catalog",
            "initial_schema_mode": "empty",
            "galaxy_id": galaxy_id,
            "idempotency_key": f"planet-catalog-{uuid.uuid4()}",
        },
    )
    assert created_catalog.status_code == 201, created_catalog.text
    catalog_table_id = created_catalog.json()["table_id"]

    lock = client.post(
        f"/galaxies/{galaxy_id}/star-core/policy/lock",
        json={"profile_key": "SENTINEL", "lock_after_apply": True},
    )
    assert lock.status_code == 200, lock.text
    lock_body = lock.json()
    assert lock_body["lock_status"] == "locked"
    assert lock_body["can_edit_core_laws"] is False

    lock_again = client.post(
        f"/galaxies/{galaxy_id}/star-core/policy/lock",
        json={"profile_key": "ARCHIVE", "lock_after_apply": True},
    )
    assert lock_again.status_code == 409, lock_again.text

    created_stream = client.post(
        "/planets",
        json={
            "name": stream_name,
            "archetype": "stream",
            "initial_schema_mode": "empty",
            "galaxy_id": galaxy_id,
            "idempotency_key": f"planet-stream-{uuid.uuid4()}",
        },
    )
    assert created_stream.status_code == 201, created_stream.text
    stream_table_id = created_stream.json()["table_id"]

    catalog_moon = client.post(
        "/civilizations/ingest",
        json={
            "value": f"Moon-Catalog-{uuid.uuid4().hex[:6]}",
            "metadata": {
                "table": catalog_name,
                "entity_id": f"moon-catalog-{uuid.uuid4().hex[:8]}",
                "label": "Catalog moon",
                "state": "active",
            },
            "galaxy_id": galaxy_id,
        },
    )
    stream_moon = client.post(
        "/civilizations/ingest",
        json={
            "value": 1.0,
            "metadata": {
                "table": stream_name,
                "event_id": f"evt-{uuid.uuid4().hex[:8]}",
                "event_time": "2026-01-01T00:00:00Z",
                "value": 1.0,
            },
            "galaxy_id": galaxy_id,
        },
    )
    assert catalog_moon.status_code == 200, catalog_moon.text
    assert stream_moon.status_code == 200, stream_moon.text
    catalog_moon_body = catalog_moon.json()
    catalog_moon_id = catalog_moon_body.get("moon_id") or catalog_moon_body.get("id")
    assert catalog_moon_id is not None
    catalog_moon_event_seq = int(catalog_moon_body.get("current_event_seq") or 0)
    assert catalog_moon_event_seq >= 1
    stream_moon_body = stream_moon.json()
    stream_moon_id = stream_moon_body.get("moon_id") or stream_moon_body.get("id")
    assert stream_moon_id is not None

    linked = client.post(
        "/bonds/link",
        json={
            "source_civilization_id": catalog_moon_id,
            "target_civilization_id": stream_moon_id,
            "type": "RELATION",
            "galaxy_id": galaxy_id,
        },
    )
    assert linked.status_code == 200, linked.text

    catalog_detail = client.get(f"/planets/{catalog_table_id}", params={"galaxy_id": galaxy_id})
    stream_detail = client.get(f"/planets/{stream_table_id}", params={"galaxy_id": galaxy_id})
    assert catalog_detail.status_code == 200, catalog_detail.text
    assert stream_detail.status_code == 200, stream_detail.text
    assert catalog_detail.json()["is_empty"] is False
    assert stream_detail.json()["is_empty"] is False
    assert catalog_detail.json()["external_bonds_count"] >= 1
    assert stream_detail.json()["external_bonds_count"] >= 1

    tables = client.get("/universe/tables", params={"galaxy_id": galaxy_id})
    assert tables.status_code == 200, tables.text
    table_by_id = {item["table_id"]: item for item in tables.json().get("tables", [])}
    assert catalog_table_id in table_by_id
    assert stream_table_id in table_by_id
    assert len(table_by_id[catalog_table_id].get("members", [])) >= 1
    assert len(table_by_id[stream_table_id].get("members", [])) >= 1
    assert len(table_by_id[catalog_table_id].get("external_bonds", [])) >= 1
    assert len(table_by_id[stream_table_id].get("external_bonds", [])) >= 1

    non_empty_extinguish = client.patch(f"/planets/{catalog_table_id}/extinguish", params={"galaxy_id": galaxy_id})
    assert non_empty_extinguish.status_code == 409, non_empty_extinguish.text
    assert "not empty" in non_empty_extinguish.text.lower()

    pulse_before = client.get(f"/galaxies/{galaxy_id}/star-core/pulse", params={"limit": 1})
    assert pulse_before.status_code == 200, pulse_before.text
    pulse_cursor = int(pulse_before.json().get("last_event_seq") or 0)
    catalog_extinguish_seq = _latest_entity_event_seq(client, galaxy_id=galaxy_id, entity_id=catalog_moon_id)
    assert catalog_extinguish_seq >= catalog_moon_event_seq

    extinguished_moon = client.patch(
        f"/civilizations/{catalog_moon_id}/extinguish",
        params={"galaxy_id": galaxy_id, "expected_event_seq": catalog_extinguish_seq},
    )
    assert extinguished_moon.status_code == 200, extinguished_moon.text
    ext_body = extinguished_moon.json()
    assert str(ext_body.get("moon_id") or ext_body.get("id")) == str(catalog_moon_id)
    assert ext_body["is_deleted"] is True
    assert ext_body.get("deleted_at")

    latest_seq = _latest_entity_event_seq(client, galaxy_id=galaxy_id, entity_id=catalog_moon_id)
    assert latest_seq >= 1

    snapshot = client.get("/universe/snapshot", params={"galaxy_id": galaxy_id})
    assert snapshot.status_code == 200, snapshot.text
    visible_ids = {item.get("id") for item in snapshot.json().get("civilizations", [])}
    assert catalog_moon_id not in visible_ids

    pulse_after = client.get(
        f"/galaxies/{galaxy_id}/star-core/pulse",
        params={"after_event_seq": pulse_cursor, "limit": 64},
    )
    assert pulse_after.status_code == 200, pulse_after.text
    pulse_events = pulse_after.json().get("events", [])
    moon_events = [item for item in pulse_events if item.get("entity_id") == catalog_moon_id]
    assert moon_events
    assert any(item.get("visual_hint") == "fade_to_singularity" for item in moon_events)


def test_planet_mvp_extinguish_empty_planet(auth_client: tuple[httpx.Client, str]) -> None:
    client, galaxy_id = auth_client
    created = client.post(
        "/planets",
        json={
            "name": f"Ops > Extinguish-{uuid.uuid4().hex[:8]}",
            "archetype": "catalog",
            "initial_schema_mode": "empty",
            "galaxy_id": galaxy_id,
        },
    )
    assert created.status_code == 201, created.text
    table_id = created.json()["table_id"]

    extinguished = client.patch(
        f"/planets/{table_id}/extinguish",
        params={"galaxy_id": galaxy_id, "idempotency_key": f"planet-extinguish-{uuid.uuid4()}"},
    )
    assert extinguished.status_code == 200, extinguished.text
    body = extinguished.json()
    assert body["table_id"] == table_id
    assert body["extinguished"] is True
    assert body["deleted_contract_versions"] >= 1

    detail = client.get(f"/planets/{table_id}", params={"galaxy_id": galaxy_id})
    assert detail.status_code == 404, detail.text

    universe_tables = client.get("/universe/tables", params={"galaxy_id": galaxy_id})
    assert universe_tables.status_code == 200, universe_tables.text
    assert not any(item.get("table_id") == table_id for item in universe_tables.json().get("tables", []))


def test_planet_mvp_extinguish_rejects_non_empty_planet(auth_client: tuple[httpx.Client, str]) -> None:
    client, galaxy_id = auth_client
    created = client.post(
        "/planets",
        json={
            "name": f"Ops > Busy-{uuid.uuid4().hex[:8]}",
            "archetype": "catalog",
            "initial_schema_mode": "preset",
            "schema_preset_key": "registry_core",
            "seed_rows": True,
            "galaxy_id": galaxy_id,
        },
    )
    assert created.status_code == 201, created.text
    table_id = created.json()["table_id"]

    extinguish = client.patch(f"/planets/{table_id}/extinguish", params={"galaxy_id": galaxy_id})
    assert extinguish.status_code == 409, extinguish.text
    assert "not empty" in extinguish.text.lower()


def test_presets_catalog_reflects_stage_unlocks(auth_client: tuple[httpx.Client, str]) -> None:
    client, galaxy_id = auth_client
    response = client.get("/presets/catalog", params={"galaxy_id": galaxy_id})
    assert response.status_code == 200, response.text
    body = response.json()
    archetypes = body.get("archetypes", [])
    assert archetypes and isinstance(archetypes, list)

    all_items = [item for group in archetypes for item in group.get("presets", [])]
    by_key = {item["key"]: item for item in all_items}

    assert "catalog_starter" in by_key
    assert by_key["catalog_starter"]["starter"] is True
    assert by_key["catalog_starter"]["is_unlocked"] is True
    assert by_key["catalog_starter"]["locked_by_stage"] == 1

    assert "simple_crm" in by_key
    assert by_key["simple_crm"]["locked_by_stage"] >= 2
    assert by_key["simple_crm"]["is_unlocked"] is False
    assert isinstance(by_key["simple_crm"]["lock_reason"], str) and by_key["simple_crm"]["lock_reason"]


def test_bond_validate_preview_allows_create_and_returns_normalized_payload(
    auth_client: tuple[httpx.Client, str],
) -> None:
    client, galaxy_id = auth_client
    source = client.post(
        "/civilizations/ingest",
        json={"value": f"Preview-A-{uuid.uuid4().hex[:8]}", "galaxy_id": galaxy_id},
    )
    target = client.post(
        "/civilizations/ingest",
        json={"value": f"Preview-B-{uuid.uuid4().hex[:8]}", "galaxy_id": galaxy_id},
    )
    assert source.status_code == 200, source.text
    assert target.status_code == 200, target.text
    source_civilization_id = source.json()["id"]
    target_civilization_id = target.json()["id"]

    source_seq = _latest_entity_event_seq(client, galaxy_id=galaxy_id, entity_id=source_civilization_id)
    target_seq = _latest_entity_event_seq(client, galaxy_id=galaxy_id, entity_id=target_civilization_id)

    preview = client.post(
        "/bonds/validate",
        json={
            "operation": "create",
            "source_civilization_id": source_civilization_id,
            "target_civilization_id": target_civilization_id,
            "type": "RELATION",
            "expected_source_event_seq": source_seq,
            "expected_target_event_seq": target_seq,
            "galaxy_id": galaxy_id,
        },
    )
    assert preview.status_code == 200, preview.text
    body = preview.json()
    assert body["decision"] in {"ALLOW", "WARN", "REJECT"}
    if body["decision"] in {"ALLOW", "WARN"}:
        assert body["accepted"] is True
        assert body["blocking"] is False
    assert body["normalized"]["type"] == "RELATION"
    assert isinstance(body.get("preview"), dict)
    assert isinstance(body.get("reasons"), list)

    if body["decision"] in {"ALLOW", "WARN"}:
        committed = client.post(
            "/bonds/link",
            json={
                "source_civilization_id": source_civilization_id,
                "target_civilization_id": target_civilization_id,
                "type": "RELATION",
                "expected_source_event_seq": source_seq,
                "expected_target_event_seq": target_seq,
                "galaxy_id": galaxy_id,
            },
        )
        assert committed.status_code == 200, committed.text
        committed_body = committed.json()
        assert committed_body["source_civilization_id"] in {source_civilization_id, target_civilization_id}
        assert committed_body["target_civilization_id"] in {source_civilization_id, target_civilization_id}
        assert committed_body["type"] == "RELATION"


def test_bond_validate_preview_rejects_same_endpoint_with_structured_reason(
    auth_client: tuple[httpx.Client, str],
) -> None:
    client, galaxy_id = auth_client
    source = client.post(
        "/civilizations/ingest", json={"value": f"Same-A-{uuid.uuid4().hex[:8]}", "galaxy_id": galaxy_id}
    )
    assert source.status_code == 200, source.text
    source_civilization_id = source.json()["id"]

    preview = client.post(
        "/bonds/validate",
        json={
            "operation": "create",
            "source_civilization_id": source_civilization_id,
            "target_civilization_id": source_civilization_id,
            "type": "FLOW",
            "expected_source_event_seq": _latest_entity_event_seq(
                client, galaxy_id=galaxy_id, entity_id=source_civilization_id
            ),
            "expected_target_event_seq": _latest_entity_event_seq(
                client, galaxy_id=galaxy_id, entity_id=source_civilization_id
            ),
            "galaxy_id": galaxy_id,
        },
    )
    assert preview.status_code == 200, preview.text
    body = preview.json()
    assert body["decision"] == "REJECT"
    assert body["accepted"] is False
    assert body["blocking"] is True
    reason_codes = {item.get("code") for item in body.get("reasons", []) if isinstance(item, dict)}
    assert "BOND_VALIDATE_SAME_ENDPOINT" in reason_codes or "BOND_VALIDATE_INTERNAL_ERROR" in reason_codes
