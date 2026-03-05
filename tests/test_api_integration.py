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


def _snapshot_asteroid(client: httpx.Client, *, galaxy_id: str, asteroid_id: str) -> dict:
    snapshot = client.get("/universe/snapshot", params={"galaxy_id": galaxy_id})
    assert snapshot.status_code == 200, snapshot.text
    for asteroid in snapshot.json().get("asteroids", []):
        if asteroid.get("id") == asteroid_id:
            return asteroid
    raise AssertionError(f"Asteroid {asteroid_id} not found in snapshot")


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
    asteroid_id: str,
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
                f"/asteroids/{asteroid_id}/mutate",
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
    source_id: str,
    target_id: str,
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
                    "source_id": source_id,
                    "target_id": target_id,
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
    values = {_stringify(atom["value"]) for atom in snapshot.json()["asteroids"]}
    assert left in values
    assert right in values


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

    created_left = client.post("/asteroids/ingest", json={"value": left, "galaxy_id": galaxy_id})
    created_right = client.post("/asteroids/ingest", json={"value": right, "galaxy_id": galaxy_id})
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
    assert "source_id" in body["tasks"][0]["params"]
    assert "target_id" in body["tasks"][0]["params"]
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
    values = {_stringify(atom["value"]) for atom in snapshot.json()["asteroids"]}
    assert label not in values


def test_parser_v2_contract_gate_accepts_unquoted_uuid_selectors(auth_client: tuple[httpx.Client, str]) -> None:
    client, galaxy_id = auth_client
    left = f"UUIDLeft{uuid.uuid4().hex}"
    right = f"UUIDRight{uuid.uuid4().hex}"

    left_created = client.post("/asteroids/ingest", json={"value": left, "galaxy_id": galaxy_id})
    right_created = client.post("/asteroids/ingest", json={"value": right, "galaxy_id": galaxy_id})
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
    assert body["tasks"][0]["params"]["source_id"] == left_id
    assert body["tasks"][0]["params"]["target_id"] == right_id


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
    values = {_stringify(atom["value"]) for atom in snapshot.json()["asteroids"]}
    assert left in values
    assert right in values


def test_parser_v2_contract_gate_returns_ambiguous_name_error(auth_client: tuple[httpx.Client, str]) -> None:
    client, galaxy_id = auth_client
    created_a = client.post("/asteroids/ingest", json={"value": "Erik", "galaxy_id": galaxy_id})
    created_b = client.post("/asteroids/ingest", json={"value": "ERIK", "galaxy_id": galaxy_id})
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
    main_values = {_stringify(atom["value"]) for atom in snapshot_main.json()["asteroids"]}
    assert branch_label not in main_values

    snapshot_branch = client.get("/universe/snapshot", params={"galaxy_id": galaxy_id, "branch_id": branch_id})
    assert snapshot_branch.status_code == 200, snapshot_branch.text
    branch_values = {_stringify(atom["value"]) for atom in snapshot_branch.json()["asteroids"]}
    assert branch_label in branch_values


def test_parser_v2_legacy_select_command_uses_v1_semantics(auth_client: tuple[httpx.Client, str]) -> None:
    client, galaxy_id = auth_client
    label = f"LegacySelect{uuid.uuid4().hex}"
    created = client.post("/asteroids/ingest", json={"value": label, "galaxy_id": galaxy_id})
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
    created = client.post("/asteroids/ingest", json={"value": label, "galaxy_id": galaxy_id})
    assert created.status_code == 200, created.text
    asteroid_id = created.json()["id"]

    execute = client.post(
        "/parser/execute",
        json={"query": f"Delete : {label}", "parser_version": "v2", "galaxy_id": galaxy_id},
    )
    assert execute.status_code == 200, execute.text
    body = execute.json()
    assert body["tasks"][0]["action"] == "DELETE"
    assert asteroid_id in body["extinguished_asteroid_ids"]


def test_parser_v2_legacy_guardian_command_uses_v1_semantics(auth_client: tuple[httpx.Client, str]) -> None:
    client, galaxy_id = auth_client
    project = f"LegacyGuardian{uuid.uuid4().hex}"
    created = client.post(
        "/asteroids/ingest",
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
    by_value = {_stringify(atom["value"]): atom for atom in snapshot.json()["asteroids"]}
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
        "/asteroids/ingest",
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
    seeded_delete = client.post("/asteroids/ingest", json={"value": delete_label, "galaxy_id": galaxy_id})
    assert seeded_delete.status_code == 200, seeded_delete.text
    delete_id = seeded_delete.json()["id"]
    delete_execute = client.post(
        "/parser/execute",
        json={"query": f"Delete : {delete_label}", "parser_version": "v2", "galaxy_id": galaxy_id},
    )
    assert delete_execute.status_code == 200, delete_execute.text
    delete_body = delete_execute.json()
    assert any(task.get("action") == "DELETE" for task in delete_body.get("tasks", []))
    assert delete_id in delete_body.get("extinguished_asteroid_ids", [])

    extinguish_bond = client.patch(f"/bonds/{type_bond_id}/extinguish", params={"galaxy_id": galaxy_id})
    assert extinguish_bond.status_code == 200, extinguish_bond.text
    assert extinguish_bond.json()["id"] == type_bond_id
    assert extinguish_bond.json()["is_deleted"] is True

    extinguish_asteroid = client.patch(f"/asteroids/{guardian_id}/extinguish", params={"galaxy_id": galaxy_id})
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
    atoms = snapshot.json()["asteroids"]
    atom_values = [_stringify(atom["value"]) for atom in atoms]
    assert not any(token in value for value in atom_values)


def test_snapshot_excludes_soft_deleted_atoms_and_orphaned_bonds(auth_client: tuple[httpx.Client, str]) -> None:
    client, galaxy_id = auth_client
    a_label = f"snapshot-a-{uuid.uuid4()}"
    b_label = f"snapshot-b-{uuid.uuid4()}"

    atom_a = client.post("/asteroids/ingest", json={"value": a_label, "galaxy_id": galaxy_id})
    atom_b = client.post("/asteroids/ingest", json={"value": b_label, "galaxy_id": galaxy_id})
    assert atom_a.status_code == 200, atom_a.text
    assert atom_b.status_code == 200, atom_b.text
    atom_a_id = atom_a.json()["id"]
    atom_b_id = atom_b.json()["id"]

    bond = client.post(
        "/bonds/link",
        json={"source_id": atom_a_id, "target_id": atom_b_id, "type": "REL_TEST", "galaxy_id": galaxy_id},
    )
    assert bond.status_code == 200, bond.text
    bond_id = bond.json()["id"]

    before = client.get("/universe/snapshot", params={"galaxy_id": galaxy_id})
    assert before.status_code == 200
    before_body = before.json()
    before_atom_ids = {atom["id"] for atom in before_body["asteroids"]}
    before_bond_ids = {edge["id"] for edge in before_body["bonds"]}
    assert atom_a_id in before_atom_ids
    assert atom_b_id in before_atom_ids
    assert bond_id in before_bond_ids

    extinguish_atom = client.patch(f"/asteroids/{atom_a_id}/extinguish", params={"galaxy_id": galaxy_id})
    assert extinguish_atom.status_code == 200, extinguish_atom.text

    after = client.get("/universe/snapshot", params={"galaxy_id": galaxy_id})
    assert after.status_code == 200
    after_body = after.json()
    after_atom_ids = {atom["id"] for atom in after_body["asteroids"]}
    after_bond_ids = {edge["id"] for edge in after_body["bonds"]}
    assert atom_a_id not in after_atom_ids
    assert bond_id not in after_bond_ids


def test_snapshot_as_of_returns_historical_state(auth_client: tuple[httpx.Client, str]) -> None:
    client, galaxy_id = auth_client
    label_a = f"asof-a-{uuid.uuid4()}"
    label_b = f"asof-b-{uuid.uuid4()}"

    atom_a = client.post("/asteroids/ingest", json={"value": label_a, "galaxy_id": galaxy_id})
    atom_b = client.post("/asteroids/ingest", json={"value": label_b, "galaxy_id": galaxy_id})
    assert atom_a.status_code == 200, atom_a.text
    assert atom_b.status_code == 200, atom_b.text

    atom_a_body = atom_a.json()
    atom_b_body = atom_b.json()
    atom_a_id = atom_a_body["id"]
    atom_b_id = atom_b_body["id"]

    bond = client.post(
        "/bonds/link",
        json={"source_id": atom_a_id, "target_id": atom_b_id, "type": "ASOF_REL", "galaxy_id": galaxy_id},
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
    before_creation_ids = {atom["id"] for atom in snapshot_before_creation.json()["asteroids"]}
    assert atom_a_id not in before_creation_ids
    assert atom_b_id not in before_creation_ids

    extinguish = client.patch(f"/asteroids/{atom_a_id}/extinguish", params={"galaxy_id": galaxy_id})
    assert extinguish.status_code == 200, extinguish.text
    deleted_at = _parse_iso_datetime(extinguish.json()["deleted_at"])

    bond_created_at = _parse_iso_datetime(bond_body["created_at"])
    as_of_alive = bond_created_at.isoformat()
    snapshot_alive = client.get("/universe/snapshot", params={"as_of": as_of_alive, "galaxy_id": galaxy_id})
    assert snapshot_alive.status_code == 200
    alive_body = snapshot_alive.json()
    alive_atom_ids = {atom["id"] for atom in alive_body["asteroids"]}
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
    after_delete_atom_ids = {atom["id"] for atom in after_delete_body["asteroids"]}
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

    atoms_by_value = {_stringify(atom["value"]): atom for atom in body["asteroids"]}
    assert atoms_by_value[company]["metadata"] == {"obor": "IT", "mesto": "Praha"}
    assert atoms_by_value[product]["metadata"] == {"cena": "500", "mena": "CZK"}

    snapshot = client.get("/universe/snapshot", params={"galaxy_id": galaxy_id})
    assert snapshot.status_code == 200, snapshot.text
    snapshot_atoms = {_stringify(atom["value"]): atom for atom in snapshot.json()["asteroids"]}

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
    created = client.post("/asteroids/ingest", json={"value": label, "galaxy_id": galaxy_id})
    assert created.status_code == 200, created.text
    atom_id = created.json()["id"]

    deleted = client.post("/parser/execute", json={"query": f"Delete : {label}", "galaxy_id": galaxy_id})
    assert deleted.status_code == 200, deleted.text
    deleted_body = deleted.json()
    assert deleted_body["tasks"][0]["action"] == "DELETE"
    assert atom_id in deleted_body["extinguished_asteroid_ids"]

    snapshot_live = client.get("/universe/snapshot", params={"galaxy_id": galaxy_id})
    assert snapshot_live.status_code == 200, snapshot_live.text
    live_values = {_stringify(atom["value"]) for atom in snapshot_live.json()["asteroids"]}
    assert label not in live_values


def test_delete_command_soft_deletes_connected_bond_and_returns_bond_id(auth_client: tuple[httpx.Client, str]) -> None:
    client, galaxy_id = auth_client
    a_label = f"delete-bond-a-{uuid.uuid4()}"
    b_label = f"delete-bond-b-{uuid.uuid4()}"

    atom_a = client.post("/asteroids/ingest", json={"value": a_label, "galaxy_id": galaxy_id})
    atom_b = client.post("/asteroids/ingest", json={"value": b_label, "galaxy_id": galaxy_id})
    assert atom_a.status_code == 200, atom_a.text
    assert atom_b.status_code == 200, atom_b.text

    atom_a_id = atom_a.json()["id"]
    atom_b_id = atom_b.json()["id"]
    linked = client.post(
        "/bonds/link",
        json={"source_id": atom_a_id, "target_id": atom_b_id, "type": "REL_DELETE", "galaxy_id": galaxy_id},
    )
    assert linked.status_code == 200, linked.text
    bond_id = linked.json()["id"]

    deleted = client.post("/parser/execute", json={"query": f"Delete : {a_label}", "galaxy_id": galaxy_id})
    assert deleted.status_code == 200, deleted.text
    deleted_body = deleted.json()
    assert deleted_body["tasks"][0]["action"] == "DELETE"
    assert atom_a_id in deleted_body["extinguished_asteroid_ids"]
    assert bond_id in deleted_body["extinguished_bond_ids"]

    snapshot_live = client.get("/universe/snapshot", params={"galaxy_id": galaxy_id})
    assert snapshot_live.status_code == 200, snapshot_live.text
    live_body = snapshot_live.json()
    live_atom_ids = {atom["id"] for atom in live_body["asteroids"]}
    live_bond_ids = {bond["id"] for bond in live_body["bonds"]}
    assert atom_a_id not in live_atom_ids
    assert atom_b_id in live_atom_ids
    assert bond_id not in live_bond_ids


def test_set_formula_command_is_calculated_in_snapshot_output(auth_client: tuple[httpx.Client, str]) -> None:
    client, galaxy_id = auth_client
    project = f"Projekt-{uuid.uuid4()}"
    item_a = f"PolozkaA-{uuid.uuid4()}"
    item_b = f"PolozkaB-{uuid.uuid4()}"

    project_resp = client.post("/asteroids/ingest", json={"value": project, "galaxy_id": galaxy_id})
    a_resp = client.post(
        "/asteroids/ingest", json={"value": item_a, "metadata": {"cena": "120"}, "galaxy_id": galaxy_id}
    )
    b_resp = client.post("/asteroids/ingest", json={"value": item_b, "metadata": {"cena": 30}, "galaxy_id": galaxy_id})
    assert project_resp.status_code == 200, project_resp.text
    assert a_resp.status_code == 200, a_resp.text
    assert b_resp.status_code == 200, b_resp.text

    project_id = project_resp.json()["id"]
    a_id = a_resp.json()["id"]
    b_id = b_resp.json()["id"]

    link_a = client.post(
        "/bonds/link",
        json={"source_id": project_id, "target_id": a_id, "type": "RELATION", "galaxy_id": galaxy_id},
    )
    link_b = client.post(
        "/bonds/link",
        json={"source_id": project_id, "target_id": b_id, "type": "RELATION", "galaxy_id": galaxy_id},
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
    assert set_formula_body["asteroids"][0]["metadata"]["celkem"] == "=SUM(cena)"

    snapshot = client.get("/universe/snapshot", params={"galaxy_id": galaxy_id})
    assert snapshot.status_code == 200, snapshot.text
    atoms_by_value = {_stringify(atom["value"]): atom for atom in snapshot.json()["asteroids"]}
    assert atoms_by_value[project]["metadata"]["celkem"] == 150
    assert atoms_by_value[project]["calculated_values"]["celkem"] == 150


def test_mutate_asteroid_updates_value_and_metadata(auth_client: tuple[httpx.Client, str]) -> None:
    client, galaxy_id = auth_client
    original = f"Mutate-{uuid.uuid4()}"
    renamed = f"Mutate-Renamed-{uuid.uuid4()}"

    created = client.post("/asteroids/ingest", json={"value": original, "galaxy_id": galaxy_id})
    assert created.status_code == 200, created.text
    asteroid_id = created.json()["id"]

    patch_value = client.patch(
        f"/asteroids/{asteroid_id}/mutate",
        json={"value": renamed, "galaxy_id": galaxy_id},
    )
    assert patch_value.status_code == 200, patch_value.text
    assert _stringify(patch_value.json()["value"]) == renamed

    patch_meta = client.patch(
        f"/asteroids/{asteroid_id}/mutate",
        json={"metadata": {"stav": "aktivni"}, "galaxy_id": galaxy_id},
    )
    assert patch_meta.status_code == 200, patch_meta.text
    assert patch_meta.json()["metadata"]["stav"] == "aktivni"

    snapshot = client.get("/universe/snapshot", params={"galaxy_id": galaxy_id})
    assert snapshot.status_code == 200, snapshot.text
    by_value = {_stringify(atom["value"]): atom for atom in snapshot.json()["asteroids"]}
    assert renamed in by_value
    assert by_value[renamed]["metadata"]["stav"] == "aktivni"


def test_mutate_asteroid_occ_rejects_stale_expected_event_seq(auth_client: tuple[httpx.Client, str]) -> None:
    client, galaxy_id = auth_client
    original = f"OCC-Mutate-{uuid.uuid4()}"
    renamed = f"OCC-Mutate-Renamed-{uuid.uuid4()}"

    created = client.post("/asteroids/ingest", json={"value": original, "galaxy_id": galaxy_id})
    assert created.status_code == 200, created.text
    asteroid_id = created.json()["id"]
    initial_seq = _latest_entity_event_seq(client, galaxy_id=galaxy_id, entity_id=asteroid_id)

    ok_mutate = client.patch(
        f"/asteroids/{asteroid_id}/mutate",
        json={"value": renamed, "expected_event_seq": initial_seq, "galaxy_id": galaxy_id},
    )
    assert ok_mutate.status_code == 200, ok_mutate.text

    stale_mutate = client.patch(
        f"/asteroids/{asteroid_id}/mutate",
        json={"metadata": {"status": "stale-write"}, "expected_event_seq": initial_seq, "galaxy_id": galaxy_id},
    )
    detail = _assert_occ_conflict(stale_mutate, expected_event_seq=initial_seq)
    assert "update_asteroid" in detail["context"].lower()
    assert detail["entity_id"] == asteroid_id

    snapshot = client.get("/universe/snapshot", params={"galaxy_id": galaxy_id})
    assert snapshot.status_code == 200, snapshot.text
    by_value = {_stringify(atom["value"]): atom for atom in snapshot.json()["asteroids"]}
    assert renamed in by_value
    assert by_value[renamed]["metadata"].get("status") != "stale-write"


def test_mutate_asteroid_occ_parallel_writes_allow_single_winner(auth_client: tuple[httpx.Client, str]) -> None:
    client, galaxy_id = auth_client
    original = f"OCC-Parallel-{uuid.uuid4()}"
    auth_header = str(client.headers.get("Authorization") or "")
    assert auth_header.startswith("Bearer "), "Missing auth header in test client"

    created = client.post("/asteroids/ingest", json={"value": original, "galaxy_id": galaxy_id})
    assert created.status_code == 200, created.text
    asteroid_id = created.json()["id"]
    initial_seq = _latest_entity_event_seq(client, galaxy_id=galaxy_id, entity_id=asteroid_id)

    outcomes = _parallel_mutate_with_expected_seq(
        auth_header=auth_header,
        galaxy_id=galaxy_id,
        asteroid_id=asteroid_id,
        expected_event_seq=initial_seq,
    )
    statuses = sorted(status for status, _ in outcomes)
    assert statuses == [200, 409], outcomes

    conflict_payload = next(payload for status, payload in outcomes if status == 409)
    detail = conflict_payload.get("detail", {})
    assert isinstance(detail, dict), conflict_payload
    assert detail.get("code") == "OCC_CONFLICT"
    assert detail.get("expected_event_seq") == initial_seq

    snapshot_after = _snapshot_asteroid(client, galaxy_id=galaxy_id, asteroid_id=asteroid_id)
    assert snapshot_after["current_event_seq"] == initial_seq + 1
    assert snapshot_after["metadata"].get("race_status") in {"A", "B"}


def test_snapshot_and_write_responses_expose_current_event_seq(auth_client: tuple[httpx.Client, str]) -> None:
    client, galaxy_id = auth_client
    label = f"SeqProbe-{uuid.uuid4()}"
    renamed = f"SeqProbe-Renamed-{uuid.uuid4()}"

    created = client.post("/asteroids/ingest", json={"value": label, "galaxy_id": galaxy_id})
    assert created.status_code == 200, created.text
    asteroid = created.json()
    asteroid_id = asteroid["id"]
    assert isinstance(asteroid.get("current_event_seq"), int)
    assert asteroid["current_event_seq"] > 0

    snapshot_before = _snapshot_asteroid(client, galaxy_id=galaxy_id, asteroid_id=asteroid_id)
    assert snapshot_before["current_event_seq"] == asteroid["current_event_seq"]

    mutated = client.patch(
        f"/asteroids/{asteroid_id}/mutate",
        json={"value": renamed, "galaxy_id": galaxy_id},
    )
    assert mutated.status_code == 200, mutated.text
    mutated_body = mutated.json()
    assert mutated_body["current_event_seq"] > asteroid["current_event_seq"]

    snapshot_after = _snapshot_asteroid(client, galaxy_id=galaxy_id, asteroid_id=asteroid_id)
    assert snapshot_after["current_event_seq"] == mutated_body["current_event_seq"]


def test_mutate_idempotency_key_replays_success_and_guards_payload(auth_client: tuple[httpx.Client, str]) -> None:
    client, galaxy_id = auth_client
    label = f"IdemMut-{uuid.uuid4()}"
    key = f"idem-{uuid.uuid4()}"

    created = client.post("/asteroids/ingest", json={"value": label, "galaxy_id": galaxy_id})
    assert created.status_code == 200, created.text
    asteroid_id = created.json()["id"]

    first = client.patch(
        f"/asteroids/{asteroid_id}/mutate",
        json={"metadata": {"stage": "done"}, "idempotency_key": key, "galaxy_id": galaxy_id},
    )
    assert first.status_code == 200, first.text
    first_body = first.json()

    replay = client.patch(
        f"/asteroids/{asteroid_id}/mutate",
        json={"metadata": {"stage": "done"}, "idempotency_key": key, "galaxy_id": galaxy_id},
    )
    assert replay.status_code == 200, replay.text
    replay_body = replay.json()
    assert replay_body["id"] == first_body["id"]
    assert replay_body["current_event_seq"] == first_body["current_event_seq"]

    no_key_repeat = client.patch(
        f"/asteroids/{asteroid_id}/mutate",
        json={"metadata": {"stage": "done"}, "galaxy_id": galaxy_id},
    )
    assert no_key_repeat.status_code == 422

    key_conflict = client.patch(
        f"/asteroids/{asteroid_id}/mutate",
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
    assert first_body["asteroids"]
    asteroid_id = first_body["asteroids"][0]["id"]
    first_seq = first_body["asteroids"][0]["current_event_seq"]

    replay = client.post(
        "/parser/execute",
        json={"query": label, "idempotency_key": key, "galaxy_id": galaxy_id},
    )
    assert replay.status_code == 200, replay.text
    replay_body = replay.json()
    assert replay_body["asteroids"][0]["id"] == asteroid_id
    assert replay_body["asteroids"][0]["current_event_seq"] == first_seq

    snapshot = _snapshot_asteroid(client, galaxy_id=galaxy_id, asteroid_id=asteroid_id)
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

    created = client.post("/asteroids/ingest", json={"value": label, "galaxy_id": galaxy_id})
    assert created.status_code == 200, created.text
    asteroid_id = created.json()["id"]
    initial_seq = _latest_entity_event_seq(client, galaxy_id=galaxy_id, entity_id=asteroid_id)

    updated = client.patch(
        f"/asteroids/{asteroid_id}/mutate",
        json={"metadata": {"phase": "updated"}, "galaxy_id": galaxy_id},
    )
    assert updated.status_code == 200, updated.text

    stale_delete = client.patch(
        f"/asteroids/{asteroid_id}/extinguish",
        params={"galaxy_id": galaxy_id, "expected_event_seq": initial_seq},
    )
    detail = _assert_occ_conflict(stale_delete, expected_event_seq=initial_seq)
    assert "delete" in detail["context"].lower()

    snapshot = client.get("/universe/snapshot", params={"galaxy_id": galaxy_id})
    assert snapshot.status_code == 200, snapshot.text
    values = {_stringify(atom["value"]) for atom in snapshot.json()["asteroids"]}
    assert label in values


def test_link_occ_rejects_stale_expected_source_seq(auth_client: tuple[httpx.Client, str]) -> None:
    client, galaxy_id = auth_client
    source_label = f"OCC-Link-S-{uuid.uuid4()}"
    target_label = f"OCC-Link-T-{uuid.uuid4()}"

    source = client.post("/asteroids/ingest", json={"value": source_label, "galaxy_id": galaxy_id})
    target = client.post("/asteroids/ingest", json={"value": target_label, "galaxy_id": galaxy_id})
    assert source.status_code == 200, source.text
    assert target.status_code == 200, target.text
    source_id = source.json()["id"]
    target_id = target.json()["id"]
    source_seq = _latest_entity_event_seq(client, galaxy_id=galaxy_id, entity_id=source_id)
    target_seq = _latest_entity_event_seq(client, galaxy_id=galaxy_id, entity_id=target_id)

    source_mutate = client.patch(
        f"/asteroids/{source_id}/mutate",
        json={"metadata": {"touch": "new"}, "galaxy_id": galaxy_id},
    )
    assert source_mutate.status_code == 200, source_mutate.text

    stale_link = client.post(
        "/bonds/link",
        json={
            "source_id": source_id,
            "target_id": target_id,
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
        "/asteroids/ingest",
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
    asteroids = {_stringify(atom["value"]): atom for atom in snapshot.json()["asteroids"]}
    asteroid = asteroids[project]

    guardians = asteroid["metadata"].get("_guardians", [])
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
    values = {_stringify(atom["value"]) for atom in snapshot.json()["asteroids"]}
    assert label not in values

    # Session/API must remain usable after failed tx.
    ok = client.post("/asteroids/ingest", json={"value": label, "galaxy_id": galaxy_id})
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
    assert "asteroids" in body
    assert "bonds" in body
    assert isinstance(body["asteroids"], list)
    assert isinstance(body["bonds"], list)
    assert body["asteroids"], "Expected at least one asteroid in snapshot"

    asteroid = body["asteroids"][0]
    assert "table_id" in asteroid
    assert "table_name" in asteroid
    assert (
        "constellation_name" in asteroid
        and isinstance(asteroid["constellation_name"], str)
        and asteroid["constellation_name"]
    )
    assert "planet_name" in asteroid and isinstance(asteroid["planet_name"], str) and asteroid["planet_name"]
    assert "metadata" in asteroid
    assert "calculated_values" in asteroid
    assert "active_alerts" in asteroid
    assert "physics" in asteroid and isinstance(asteroid["physics"], dict)
    assert isinstance(asteroid["physics"].get("engine_version"), str) and asteroid["physics"]["engine_version"]
    assert "stress_score" in asteroid["physics"]
    assert "created_at" in asteroid
    assert "current_event_seq" in asteroid and isinstance(asteroid["current_event_seq"], int)

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
    assert "asteroid_id" in row
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
    assert "source_id" in row
    assert "target_id" in row
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
    by_value = {_stringify(atom["value"]): atom for atom in snapshot.json()["asteroids"]}
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
    values = {_stringify(atom["value"]) for atom in snapshot.json()["asteroids"]}
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
    values = {_stringify(atom["value"]) for atom in snapshot.json()["asteroids"]}
    assert ok_a in values
    assert ok_b in values


def test_csv_export_snapshot_returns_csv(auth_client: tuple[httpx.Client, str]) -> None:
    client, galaxy_id = auth_client
    label = f"CSV-Export-{uuid.uuid4()}"
    created = client.post(
        "/asteroids/ingest", json={"value": label, "metadata": {"kategorie": "Test"}, "galaxy_id": galaxy_id}
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

    created_main = client.post("/asteroids/ingest", json={"value": main_label, "galaxy_id": galaxy_id})
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

    created_base = client.post("/asteroids/ingest", json={"value": base_label, "galaxy_id": galaxy_id})
    assert created_base.status_code == 200, created_base.text

    branch = client.post(
        "/branches",
        json={"name": f"Scenario-{uuid.uuid4()}", "galaxy_id": galaxy_id},
    )
    assert branch.status_code == 201, branch.text
    branch_id = branch.json()["id"]

    created_future = client.post("/asteroids/ingest", json={"value": future_label, "galaxy_id": galaxy_id})
    assert created_future.status_code == 200, created_future.text

    snapshot_main = client.get("/universe/snapshot", params={"galaxy_id": galaxy_id})
    assert snapshot_main.status_code == 200, snapshot_main.text
    main_values = {_stringify(atom["value"]) for atom in snapshot_main.json()["asteroids"]}
    assert base_label in main_values
    assert future_label in main_values

    snapshot_branch = client.get(
        "/universe/snapshot",
        params={"galaxy_id": galaxy_id, "branch_id": branch_id},
    )
    assert snapshot_branch.status_code == 200, snapshot_branch.text
    branch_values = {_stringify(atom["value"]) for atom in snapshot_branch.json()["asteroids"]}
    assert base_label in branch_values
    assert future_label not in branch_values


def test_branch_ingest_writes_only_to_branch_timeline(auth_client: tuple[httpx.Client, str]) -> None:
    client, galaxy_id = auth_client
    main_label = f"main-{uuid.uuid4()}"
    branch_label = f"branch-{uuid.uuid4()}"

    created_main = client.post("/asteroids/ingest", json={"value": main_label, "galaxy_id": galaxy_id})
    assert created_main.status_code == 200, created_main.text

    branch = client.post(
        "/branches",
        json={"name": f"WriteScenario-{uuid.uuid4()}", "galaxy_id": galaxy_id},
    )
    assert branch.status_code == 201, branch.text
    branch_id = branch.json()["id"]

    created_branch = client.post(
        "/asteroids/ingest",
        json={"value": branch_label, "galaxy_id": galaxy_id, "branch_id": branch_id},
    )
    assert created_branch.status_code == 200, created_branch.text

    main_snapshot = client.get("/universe/snapshot", params={"galaxy_id": galaxy_id})
    assert main_snapshot.status_code == 200, main_snapshot.text
    main_values = {_stringify(atom["value"]) for atom in main_snapshot.json()["asteroids"]}
    assert main_label in main_values
    assert branch_label not in main_values

    branch_snapshot = client.get("/universe/snapshot", params={"galaxy_id": galaxy_id, "branch_id": branch_id})
    assert branch_snapshot.status_code == 200, branch_snapshot.text
    branch_values = {_stringify(atom["value"]) for atom in branch_snapshot.json()["asteroids"]}
    assert main_label in branch_values
    assert branch_label in branch_values


def test_branch_extinguish_does_not_delete_main_timeline(auth_client: tuple[httpx.Client, str]) -> None:
    client, galaxy_id = auth_client
    label = f"branch-extinguish-{uuid.uuid4()}"

    created = client.post("/asteroids/ingest", json={"value": label, "galaxy_id": galaxy_id})
    assert created.status_code == 200, created.text
    asteroid_id = created.json()["id"]

    branch = client.post(
        "/branches",
        json={"name": f"ExtinguishScenario-{uuid.uuid4()}", "galaxy_id": galaxy_id},
    )
    assert branch.status_code == 201, branch.text
    branch_id = branch.json()["id"]

    extinguished = client.patch(
        f"/asteroids/{asteroid_id}/extinguish",
        params={"galaxy_id": galaxy_id, "branch_id": branch_id},
    )
    assert extinguished.status_code == 200, extinguished.text

    main_snapshot = client.get("/universe/snapshot", params={"galaxy_id": galaxy_id})
    assert main_snapshot.status_code == 200, main_snapshot.text
    main_values = {_stringify(atom["value"]) for atom in main_snapshot.json()["asteroids"]}
    assert label in main_values

    branch_snapshot = client.get("/universe/snapshot", params={"galaxy_id": galaxy_id, "branch_id": branch_id})
    assert branch_snapshot.status_code == 200, branch_snapshot.text
    branch_values = {_stringify(atom["value"]) for atom in branch_snapshot.json()["asteroids"]}
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
        "/asteroids/ingest",
        json={"value": branch_label, "galaxy_id": galaxy_id, "branch_id": branch_id},
    )
    assert created_branch.status_code == 200, created_branch.text

    snapshot_main_before = client.get("/universe/snapshot", params={"galaxy_id": galaxy_id})
    assert snapshot_main_before.status_code == 200, snapshot_main_before.text
    main_before_values = {_stringify(atom["value"]) for atom in snapshot_main_before.json()["asteroids"]}
    assert branch_label not in main_before_values

    promoted = client.post(f"/branches/{branch_id}/promote", params={"galaxy_id": galaxy_id})
    assert promoted.status_code == 200, promoted.text
    promoted_body = promoted.json()
    assert promoted_body["promoted_events_count"] >= 1
    assert promoted_body["branch"]["id"] == branch_id
    assert promoted_body["branch"]["deleted_at"] is not None

    snapshot_main_after = client.get("/universe/snapshot", params={"galaxy_id": galaxy_id})
    assert snapshot_main_after.status_code == 200, snapshot_main_after.text
    main_after_values = {_stringify(atom["value"]) for atom in snapshot_main_after.json()["asteroids"]}
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
    main_before_values = {_stringify(atom["value"]) for atom in snapshot_main_before.json()["asteroids"]}
    assert branch_label not in main_before_values

    promoted = client.post(f"/branches/{branch_id}/promote", params={"galaxy_id": galaxy_id})
    assert promoted.status_code == 200, promoted.text
    promoted_body = promoted.json()
    assert promoted_body["promoted_events_count"] >= 1
    assert promoted_body["branch"]["id"] == branch_id
    assert promoted_body["branch"]["deleted_at"] is not None

    snapshot_main_after = client.get("/universe/snapshot", params={"galaxy_id": galaxy_id})
    assert snapshot_main_after.status_code == 200, snapshot_main_after.text
    main_after_values = {_stringify(atom["value"]) for atom in snapshot_main_after.json()["asteroids"]}
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
    main_values = {_stringify(atom["value"]) for atom in snapshot_main.json()["asteroids"]}
    assert branch_label not in main_values

    snapshot_branch = client.get("/universe/snapshot", params={"galaxy_id": galaxy_id, "branch_id": branch_id})
    assert snapshot_branch.status_code == 200, snapshot_branch.text
    branch_values = {_stringify(atom["value"]) for atom in snapshot_branch.json()["asteroids"]}
    assert branch_label in branch_values


def test_csv_import_contract_violation_strict_mode_stops_processing(auth_client: tuple[httpx.Client, str]) -> None:
    client, galaxy_id = auth_client
    table_name = f"ImportStrictContract-{uuid.uuid4()}"
    valid_label = f"StrictImportOk-{uuid.uuid4()}"
    invalid_label = f"StrictImportBad-{uuid.uuid4()}"

    seeded = client.post(
        "/asteroids/ingest",
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
    seeded_atom = next((item for item in snapshot.json()["asteroids"] if item["id"] == seeded_id), None)
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
    values = {_stringify(atom["value"]) for atom in snapshot_after.json()["asteroids"]}
    assert invalid_label not in values
    assert valid_label not in values


def test_table_contract_versioning_returns_latest(auth_client: tuple[httpx.Client, str]) -> None:
    client, galaxy_id = auth_client
    table_name = f"Contract-{uuid.uuid4()}"
    label = f"ContractEntity-{uuid.uuid4()}"

    created = client.post(
        "/asteroids/ingest",
        json={"value": label, "metadata": {"table": table_name, "cena": 100}, "galaxy_id": galaxy_id},
    )
    assert created.status_code == 200, created.text

    snapshot = client.get("/universe/snapshot", params={"galaxy_id": galaxy_id})
    assert snapshot.status_code == 200, snapshot.text
    asteroid = next((item for item in snapshot.json()["asteroids"] if _stringify(item["value"]) == label), None)
    assert asteroid is not None
    table_id = asteroid["table_id"]

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
        "/asteroids/ingest",
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
    seeded_atom = next((item for item in snapshot.json()["asteroids"] if item["id"] == seeded_id), None)
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
        "/asteroids/ingest",
        json={
            "value": f"Missing-{uuid.uuid4()}",
            "metadata": {"table": table_name, "sku": "S-002"},
            "galaxy_id": galaxy_id,
        },
    )
    assert missing_required.status_code == 422, missing_required.text
    assert "required field 'cena'" in missing_required.text

    invalid_type = client.post(
        "/asteroids/ingest",
        json={
            "value": f"Type-{uuid.uuid4()}",
            "metadata": {"table": table_name, "cena": "abc", "sku": "S-003"},
            "galaxy_id": galaxy_id,
        },
    )
    assert invalid_type.status_code == 422, invalid_type.text
    assert "must be 'number'" in invalid_type.text

    unique_violation = client.post(
        "/asteroids/ingest",
        json={
            "value": f"Unique-{uuid.uuid4()}",
            "metadata": {"table": table_name, "cena": 20, "sku": "S-001"},
            "galaxy_id": galaxy_id,
        },
    )
    assert unique_violation.status_code == 422, unique_violation.text
    assert "unique rule" in unique_violation.text

    invalid_mutate = client.patch(
        f"/asteroids/{seeded_id}/mutate",
        json={"metadata": {"cena": -5}, "galaxy_id": galaxy_id},
    )
    assert invalid_mutate.status_code == 422, invalid_mutate.text
    assert "validator failed" in invalid_mutate.text


def test_table_contract_semantic_validator_is_non_blocking(auth_client: tuple[httpx.Client, str]) -> None:
    client, galaxy_id = auth_client
    table_name = f"ContractSemantic-{uuid.uuid4()}"
    seed_label = f"SemanticSeed-{uuid.uuid4()}"

    seeded = client.post(
        "/asteroids/ingest",
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
    seeded_atom = next((item for item in snapshot.json()["asteroids"] if item["id"] == seeded_id), None)
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
        "/asteroids/ingest",
        json={
            "value": f"SemanticOk-{uuid.uuid4()}",
            "metadata": {"table": table_name, "cena": 77, "owner": "Team-A"},
            "galaxy_id": galaxy_id,
        },
    )
    assert ingested.status_code == 200, ingested.text

    mutate_ok = client.patch(
        f"/asteroids/{seeded_id}/mutate",
        json={"metadata": {"owner": "Team-B", "cena": 55}, "galaxy_id": galaxy_id},
    )
    assert mutate_ok.status_code == 200, mutate_ok.text

    mutate_bad = client.patch(
        f"/asteroids/{seeded_id}/mutate",
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
        "/asteroids/ingest",
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
    seeded_atom = next((item for item in snapshot.json()["asteroids"] if item["id"] == seeded_id), None)
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
    values = {_stringify(atom["value"]) for atom in snapshot_after.json()["asteroids"]}
    assert valid_label in values
    assert invalid_label not in values


def test_relation_link_reverse_direction_reuses_same_bond(auth_client: tuple[httpx.Client, str]) -> None:
    client, galaxy_id = auth_client
    left = f"RelA-{uuid.uuid4()}"
    right = f"RelB-{uuid.uuid4()}"

    left_created = client.post("/asteroids/ingest", json={"value": left, "galaxy_id": galaxy_id})
    right_created = client.post("/asteroids/ingest", json={"value": right, "galaxy_id": galaxy_id})
    assert left_created.status_code == 200, left_created.text
    assert right_created.status_code == 200, right_created.text
    left_id = left_created.json()["id"]
    right_id = right_created.json()["id"]

    forward = client.post(
        "/bonds/link",
        json={"source_id": left_id, "target_id": right_id, "type": "RELATION", "galaxy_id": galaxy_id},
    )
    assert forward.status_code == 200, forward.text
    bond_id = forward.json()["id"]

    reverse = client.post(
        "/bonds/link",
        json={"source_id": right_id, "target_id": left_id, "type": "RELATION", "galaxy_id": galaxy_id},
    )
    assert reverse.status_code == 200, reverse.text
    assert reverse.json()["id"] == bond_id

    snapshot = client.get("/universe/snapshot", params={"galaxy_id": galaxy_id})
    assert snapshot.status_code == 200, snapshot.text
    rel_bonds = [
        bond
        for bond in snapshot.json()["bonds"]
        if str(bond.get("type", "")).upper() == "RELATION"
        and {bond.get("source_id"), bond.get("target_id")} == {left_id, right_id}
    ]
    assert len(rel_bonds) == 1


def test_link_type_alias_formula_is_normalized_to_flow(auth_client: tuple[httpx.Client, str]) -> None:
    client, galaxy_id = auth_client
    source_label = f"FlowAlias-S-{uuid.uuid4()}"
    target_label = f"FlowAlias-T-{uuid.uuid4()}"

    source = client.post("/asteroids/ingest", json={"value": source_label, "galaxy_id": galaxy_id})
    target = client.post("/asteroids/ingest", json={"value": target_label, "galaxy_id": galaxy_id})
    assert source.status_code == 200, source.text
    assert target.status_code == 200, target.text
    source_id = source.json()["id"]
    target_id = target.json()["id"]

    linked = client.post(
        "/bonds/link",
        json={"source_id": source_id, "target_id": target_id, "type": "formula", "galaxy_id": galaxy_id},
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

    source = client.post("/asteroids/ingest", json={"value": source_label, "galaxy_id": galaxy_id})
    target = client.post("/asteroids/ingest", json={"value": target_label, "galaxy_id": galaxy_id})
    assert source.status_code == 200, source.text
    assert target.status_code == 200, target.text
    source_id = source.json()["id"]
    target_id = target.json()["id"]
    source_seq = _latest_entity_event_seq(client, galaxy_id=galaxy_id, entity_id=source_id)
    target_seq = _latest_entity_event_seq(client, galaxy_id=galaxy_id, entity_id=target_id)

    outcomes = _parallel_link_with_expected_seq(
        auth_header=auth_header,
        galaxy_id=galaxy_id,
        source_id=source_id,
        target_id=target_id,
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
        and {bond.get("source_id"), bond.get("target_id")} == {source_id, target_id}
    ]
    assert len(rel_bonds) == 1
    assert rel_bonds[0]["id"] == bond_id


def test_bond_mutate_replaces_type_and_preserves_single_active_edge(auth_client: tuple[httpx.Client, str]) -> None:
    client, galaxy_id = auth_client
    source_label = f"BondMut-S-{uuid.uuid4()}"
    target_label = f"BondMut-T-{uuid.uuid4()}"

    source = client.post("/asteroids/ingest", json={"value": source_label, "galaxy_id": galaxy_id})
    target = client.post("/asteroids/ingest", json={"value": target_label, "galaxy_id": galaxy_id})
    assert source.status_code == 200, source.text
    assert target.status_code == 200, target.text
    source_id = source.json()["id"]
    target_id = target.json()["id"]

    linked = client.post(
        "/bonds/link",
        json={"source_id": source_id, "target_id": target_id, "type": "RELATION", "galaxy_id": galaxy_id},
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
    active = [bond for bond in bonds if {bond.get("source_id"), bond.get("target_id")} == {source_id, target_id}]
    assert len(active) == 1
    assert active[0]["id"] == mutated_body["id"]
    assert active[0]["type"] == "TYPE"


def test_bond_extinguish_soft_deletes_link(auth_client: tuple[httpx.Client, str]) -> None:
    client, galaxy_id = auth_client
    source_label = f"BondDel-S-{uuid.uuid4()}"
    target_label = f"BondDel-T-{uuid.uuid4()}"

    source = client.post("/asteroids/ingest", json={"value": source_label, "galaxy_id": galaxy_id})
    target = client.post("/asteroids/ingest", json={"value": target_label, "galaxy_id": galaxy_id})
    assert source.status_code == 200, source.text
    assert target.status_code == 200, target.text
    source_id = source.json()["id"]
    target_id = target.json()["id"]

    linked = client.post(
        "/bonds/link",
        json={"source_id": source_id, "target_id": target_id, "type": "FLOW", "galaxy_id": galaxy_id},
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


def test_task_batch_preview_does_not_persist_changes(auth_client: tuple[httpx.Client, str]) -> None:
    client, galaxy_id = auth_client
    label = f"BatchPreview-{uuid.uuid4()}"

    created = client.post("/asteroids/ingest", json={"value": label, "galaxy_id": galaxy_id})
    assert created.status_code == 200, created.text
    asteroid = created.json()
    asteroid_id = asteroid["id"]
    base_seq = int(asteroid["current_event_seq"])

    preview = client.post(
        "/tasks/execute-batch",
        json={
            "mode": "preview",
            "galaxy_id": galaxy_id,
            "tasks": [
                {
                    "action": "UPDATE_ASTEROID",
                    "params": {
                        "asteroid_id": asteroid_id,
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

    after = _snapshot_asteroid(client, galaxy_id=galaxy_id, asteroid_id=asteroid_id)
    assert "preview_field" not in after.get("metadata", {})
    assert int(after["current_event_seq"]) == base_seq


def test_task_batch_commit_persists_changes_atomically(auth_client: tuple[httpx.Client, str]) -> None:
    client, galaxy_id = auth_client
    label = f"BatchCommit-{uuid.uuid4()}"

    created = client.post("/asteroids/ingest", json={"value": label, "galaxy_id": galaxy_id})
    assert created.status_code == 200, created.text
    asteroid = created.json()
    asteroid_id = asteroid["id"]
    base_seq = int(asteroid["current_event_seq"])

    commit = client.post(
        "/tasks/execute-batch",
        json={
            "mode": "commit",
            "galaxy_id": galaxy_id,
            "tasks": [
                {
                    "action": "UPDATE_ASTEROID",
                    "params": {
                        "asteroid_id": asteroid_id,
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

    after = _snapshot_asteroid(client, galaxy_id=galaxy_id, asteroid_id=asteroid_id)
    assert after.get("metadata", {}).get("batch_field") == "committed"
    assert int(after["current_event_seq"]) > base_seq


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
    values = {_stringify(item["value"]) for item in snapshot_after.json()["asteroids"]}
    assert "Client ACME" in values
    assert "Meeting ACME Intro" in values


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
        "/moons",
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

    listed = client.get("/moons", params={"galaxy_id": galaxy_id, "planet_id": planet_id})
    assert listed.status_code == 200, listed.text
    listed_items = listed.json().get("items", [])
    listed_row = next((item for item in listed_items if item.get("moon_id") == moon_id), None)
    assert listed_row is not None

    detail = client.get(f"/moons/{moon_id}", params={"galaxy_id": galaxy_id})
    assert detail.status_code == 200, detail.text
    detail_body = detail.json()
    assert detail_body["moon_id"] == moon_id
    assert detail_body["planet_id"] == planet_id
    expected_event_seq = int(detail_body.get("current_event_seq") or 0)
    assert expected_event_seq >= 1

    mutated = client.patch(
        f"/moons/{moon_id}/mutate",
        json={
            "galaxy_id": galaxy_id,
            "minerals": {"state": "archived"},
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
        f"/moons/{moon_id}/extinguish",
        params={
            "galaxy_id": galaxy_id,
            "expected_event_seq": extinguish_expected_seq,
        },
    )
    assert extinguished.status_code == 200, extinguished.text
    extinguished_body = extinguished.json()
    assert extinguished_body["moon_id"] == moon_id
    assert extinguished_body["planet_id"] == planet_id
    assert extinguished_body["is_deleted"] is True
    assert extinguished_body["deleted_at"] is not None

    missing_after_delete = client.get(f"/moons/{moon_id}", params={"galaxy_id": galaxy_id})
    assert missing_after_delete.status_code == 404, missing_after_delete.text


def test_civilization_first_class_alias_endpoints(auth_client: tuple[httpx.Client, str]) -> None:
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

    # Backward-compatible alias parity: `/moons` must expose the same row.
    listed_moons = client.get("/moons", params={"galaxy_id": galaxy_id, "planet_id": planet_id})
    assert listed_moons.status_code == 200, listed_moons.text
    listed_moons_items = listed_moons.json().get("items", [])
    listed_moons_row = next((item for item in listed_moons_items if item.get("moon_id") == moon_id), None)
    assert listed_moons_row is not None

    mutated = client.patch(
        f"/civilizations/{moon_id}/mutate",
        json={
            "galaxy_id": galaxy_id,
            "minerals": {"state": "archived"},
            "expected_event_seq": event_seq,
            "idempotency_key": f"civilization-alias-mutate-{uuid.uuid4()}",
        },
    )
    assert mutated.status_code == 200, mutated.text
    facts_by_key = {item["key"]: item for item in mutated.json().get("facts", [])}
    assert facts_by_key["state"]["typed_value"] == "archived"
    mutated_seq = int(mutated.json().get("current_event_seq") or 0)
    assert mutated_seq > event_seq

    detail_via_moons = client.get(f"/moons/{moon_id}", params={"galaxy_id": galaxy_id})
    assert detail_via_moons.status_code == 200, detail_via_moons.text
    detail_facts = {item["key"]: item for item in detail_via_moons.json().get("facts", [])}
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
    assert extinguished.json()["moon_id"] == moon_id
    assert extinguished.json()["is_deleted"] is True

    missing_after_delete = client.get(f"/civilizations/{moon_id}", params={"galaxy_id": galaxy_id})
    assert missing_after_delete.status_code == 404, missing_after_delete.text


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
        "/asteroids/ingest",
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
    asteroid_id = body["id"]
    assert body["is_deleted"] is False
    expected_seq = int(body["current_event_seq"] or 0)
    assert expected_seq >= 1

    mutated = client.patch(
        f"/asteroids/{asteroid_id}/mutate",
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
    assert asteroid_id in member_ids_before

    extinguished = client.patch(
        f"/asteroids/{asteroid_id}/extinguish",
        params={"galaxy_id": galaxy_id, "expected_event_seq": extinguish_expected_seq},
    )
    assert extinguished.status_code == 200, extinguished.text
    extinguished_body = extinguished.json()
    assert extinguished_body["is_deleted"] is True
    assert extinguished_body["deleted_at"] is not None

    snapshot_after = client.get("/universe/snapshot", params={"galaxy_id": galaxy_id})
    assert snapshot_after.status_code == 200, snapshot_after.text
    snapshot_ids = {item.get("id") for item in snapshot_after.json().get("asteroids", [])}
    assert asteroid_id not in snapshot_ids

    tables_after = client.get("/universe/tables", params={"galaxy_id": galaxy_id})
    assert tables_after.status_code == 200, tables_after.text
    target_after = next((row for row in tables_after.json().get("tables", []) if row.get("table_id") == table_id), None)
    assert target_after is not None
    member_ids_after = {item.get("id") for item in target_after.get("members", [])}
    assert asteroid_id not in member_ids_after
    assert member_ids_after == {
        item.get("id") for item in snapshot_after.json().get("asteroids", []) if item.get("table_id") == table_id
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
        "/asteroids/ingest",
        json={
            "value": "Invalid mineral row",
            "metadata": {"table": table_name, "amount": "abc"},
            "galaxy_id": galaxy_id,
        },
    )
    assert invalid.status_code == 422, invalid.text
    assert "Table contract violation" in invalid.text

    valid = client.post(
        "/asteroids/ingest",
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
    asteroid_id = valid.json()["id"]

    snapshot = client.get("/universe/snapshot", params={"galaxy_id": galaxy_id})
    assert snapshot.status_code == 200, snapshot.text
    row = next((item for item in snapshot.json().get("asteroids", []) if item.get("id") == asteroid_id), None)
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
        "/asteroids/ingest",
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
    snapshot_rows_for_planet = [row for row in snapshot.json().get("asteroids", []) if row.get("table_id") == table_id]
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
        "/moons",
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
        row for row in snapshot_after_create.json().get("asteroids", []) if row.get("table_id") == table_id
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
        f"/moons/{moon_id}/mutate",
        json={
            "galaxy_id": galaxy_id,
            "minerals": {"state": "archived"},
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
        f"/moons/{moon_id}/extinguish",
        params={
            "galaxy_id": galaxy_id,
            "expected_event_seq": next_event_seq,
            "idempotency_key": f"release-gate-lifecycle-moon-extinguish-{uuid.uuid4()}",
        },
    )
    assert extinguished.status_code == 200, extinguished.text
    assert extinguished.json()["moon_id"] == moon_id
    assert extinguished.json()["is_deleted"] is True

    snapshot_after_extinguish = client.get("/universe/snapshot", params={"galaxy_id": galaxy_id})
    assert snapshot_after_extinguish.status_code == 200, snapshot_after_extinguish.text
    snapshot_rows_after_extinguish = [
        row for row in snapshot_after_extinguish.json().get("asteroids", []) if row.get("table_id") == table_id
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
    snapshot_rows_for_planet = [row for row in snapshot.json().get("asteroids", []) if row.get("table_id") == table_id]
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
        "/asteroids/ingest",
        json={
            "value": f"Moon-Catalog-{uuid.uuid4().hex[:6]}",
            "metadata": {"table": catalog_name},
            "galaxy_id": galaxy_id,
        },
    )
    stream_moon = client.post(
        "/asteroids/ingest",
        json={
            "value": f"Moon-Stream-{uuid.uuid4().hex[:6]}",
            "metadata": {"table": stream_name},
            "galaxy_id": galaxy_id,
        },
    )
    assert catalog_moon.status_code == 200, catalog_moon.text
    assert stream_moon.status_code == 200, stream_moon.text
    catalog_moon_id = catalog_moon.json()["id"]
    stream_moon_id = stream_moon.json()["id"]

    linked = client.post(
        "/bonds/link",
        json={
            "source_id": catalog_moon_id,
            "target_id": stream_moon_id,
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

    extinguished_moon = client.patch(f"/asteroids/{catalog_moon_id}/extinguish", params={"galaxy_id": galaxy_id})
    assert extinguished_moon.status_code == 200, extinguished_moon.text
    ext_body = extinguished_moon.json()
    assert ext_body["id"] == catalog_moon_id
    assert ext_body["is_deleted"] is True
    assert ext_body.get("deleted_at")

    latest_seq = _latest_entity_event_seq(client, galaxy_id=galaxy_id, entity_id=catalog_moon_id)
    assert latest_seq >= 1

    snapshot = client.get("/universe/snapshot", params={"galaxy_id": galaxy_id})
    assert snapshot.status_code == 200, snapshot.text
    visible_ids = {item.get("id") for item in snapshot.json().get("asteroids", [])}
    assert catalog_moon_id not in visible_ids

    pulse_after = client.get(
        f"/galaxies/{galaxy_id}/star-core/pulse",
        params={"after_event_seq": pulse_cursor, "limit": 64},
    )
    assert pulse_after.status_code == 200, pulse_after.text
    pulse_events = pulse_after.json().get("events", [])
    moon_event = next((item for item in pulse_events if item.get("entity_id") == catalog_moon_id), None)
    assert moon_event is not None
    assert moon_event["visual_hint"] == "fade_to_singularity"


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
