from __future__ import annotations

import os
import uuid
from datetime import datetime, timedelta, timezone

import httpx
import pytest

API_BASE_URL = os.getenv("DATAVERSE_API_BASE", "http://127.0.0.1:8000")


def _stringify(value: object) -> str:
    if isinstance(value, str):
        return value
    return str(value)


def _parse_iso_datetime(value: str) -> datetime:
    return datetime.fromisoformat(value.replace("Z", "+00:00")).astimezone(timezone.utc)


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

    snapshot_before_creation = client.get("/universe/snapshot", params={"as_of": before_creation, "galaxy_id": galaxy_id})
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


def test_parser_metadata_parentheses_are_persisted_and_visible_in_snapshot(auth_client: tuple[httpx.Client, str]) -> None:
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
    a_resp = client.post("/asteroids/ingest", json={"value": item_a, "metadata": {"cena": "120"}, "galaxy_id": galaxy_id})
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
    assert "constellation_name" in asteroid and isinstance(asteroid["constellation_name"], str) and asteroid["constellation_name"]
    assert "planet_name" in asteroid and isinstance(asteroid["planet_name"], str) and asteroid["planet_name"]
    assert "metadata" in asteroid
    assert "calculated_values" in asteroid
    assert "active_alerts" in asteroid
    assert "created_at" in asteroid

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


def test_galaxy_dashboard_v1_endpoints_return_read_model_views(auth_client: tuple[httpx.Client, str]) -> None:
    client, galaxy_id = auth_client
    execute = client.post(
        "/parser/execute",
        json={
            "query": f"DashA-{uuid.uuid4()} (table: EntitaA > Planeta1, cena: 10) + DashB-{uuid.uuid4()} (table: EntitaB > Planeta2, cena: 20)",
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
            "query": f"FlowA-{uuid.uuid4()} (table: Finance > Orion, cena: 10) + FlowB-{uuid.uuid4()} (table: Finance > Orion, cena: 20)",
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
        assert "constellation_name" in table and isinstance(table["constellation_name"], str) and table["constellation_name"]
        assert "planet_name" in table and isinstance(table["planet_name"], str) and table["planet_name"]
        assert "schema_fields" in table and isinstance(table["schema_fields"], list)
        assert "formula_fields" in table and isinstance(table["formula_fields"], list)
        assert "members" in table and isinstance(table["members"], list)
        assert "internal_bonds" in table and isinstance(table["internal_bonds"], list)
        assert "external_bonds" in table and isinstance(table["external_bonds"], list)
        assert "sector" in table and isinstance(table["sector"], dict)

        sector = table["sector"]
        assert "center" in sector and isinstance(sector["center"], list) and len(sector["center"]) == 3
        assert "size" in sector and isinstance(sector["size"], (int, float))
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
    assert error_items[0]["code"] == "ROW_EXECUTION_ERROR"
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
    created = client.post("/asteroids/ingest", json={"value": label, "metadata": {"kategorie": "Test"}, "galaxy_id": galaxy_id})
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

    extinguished = client.patch(
        f"/branches/{first.json()['id']}/extinguish",
        params={"galaxy_id": galaxy_id},
    )
    assert extinguished.status_code == 200, extinguished.text

    recreated = client.post(
        "/branches",
        json={"name": "SCENARIO A", "galaxy_id": galaxy_id},
    )
    assert recreated.status_code == 201, recreated.text


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
        json={"value": f"SeedStrict-{uuid.uuid4()}", "metadata": {"table": table_name, "cena": 10, "sku": "S-001"}, "galaxy_id": galaxy_id},
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

    csv_payload = (
        "value,table,cena,sku\n"
        f"{invalid_label},{table_name},abc,S-010\n"
        f"{valid_label},{table_name},45,S-011\n"
    )
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


def test_table_contract_is_enforced_for_ingest_and_mutate(auth_client: tuple[httpx.Client, str]) -> None:
    client, galaxy_id = auth_client
    table_name = f"ContractGuard-{uuid.uuid4()}"

    seeded = client.post(
        "/asteroids/ingest",
        json={"value": f"Seed-{uuid.uuid4()}", "metadata": {"table": table_name, "cena": 10, "sku": "S-001"}, "galaxy_id": galaxy_id},
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
        json={"value": f"Missing-{uuid.uuid4()}", "metadata": {"table": table_name, "sku": "S-002"}, "galaxy_id": galaxy_id},
    )
    assert missing_required.status_code == 422, missing_required.text
    assert "required field 'cena'" in missing_required.text

    invalid_type = client.post(
        "/asteroids/ingest",
        json={"value": f"Type-{uuid.uuid4()}", "metadata": {"table": table_name, "cena": "abc", "sku": "S-003"}, "galaxy_id": galaxy_id},
    )
    assert invalid_type.status_code == 422, invalid_type.text
    assert "must be 'number'" in invalid_type.text

    unique_violation = client.post(
        "/asteroids/ingest",
        json={"value": f"Unique-{uuid.uuid4()}", "metadata": {"table": table_name, "cena": 20, "sku": "S-001"}, "galaxy_id": galaxy_id},
    )
    assert unique_violation.status_code == 422, unique_violation.text
    assert "unique rule" in unique_violation.text

    invalid_mutate = client.patch(
        f"/asteroids/{seeded_id}/mutate",
        json={"metadata": {"cena": -5}, "galaxy_id": galaxy_id},
    )
    assert invalid_mutate.status_code == 422, invalid_mutate.text
    assert "validator failed" in invalid_mutate.text


def test_csv_import_contract_violation_is_reported_per_row(auth_client: tuple[httpx.Client, str]) -> None:
    client, galaxy_id = auth_client
    table_name = f"ImportContract-{uuid.uuid4()}"
    valid_label = f"ImportOk-{uuid.uuid4()}"
    invalid_label = f"ImportBad-{uuid.uuid4()}"

    seeded = client.post(
        "/asteroids/ingest",
        json={"value": f"SeedImport-{uuid.uuid4()}", "metadata": {"table": table_name, "cena": 10, "sku": "I-001"}, "galaxy_id": galaxy_id},
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

    csv_payload = (
        "value,table,cena,sku\n"
        f"{invalid_label},{table_name},abc,I-010\n"
        f"{valid_label},{table_name},45,I-011\n"
    )
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
