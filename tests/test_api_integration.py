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
    assert "metadata" in asteroid
    assert "calculated_values" in asteroid
    assert "active_alerts" in asteroid
    assert "created_at" in asteroid

    if body["bonds"]:
        bond = body["bonds"][0]
        assert "source_table_id" in bond
        assert "source_table_name" in bond
        assert "target_table_id" in bond
        assert "target_table_name" in bond


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
