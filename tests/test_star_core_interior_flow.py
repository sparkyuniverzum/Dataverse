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
    except Exception as exc:
        client.close()
        pytest.skip(f"API is not reachable on {API_BASE_URL}: {exc}")
    yield client
    client.close()


@pytest.fixture()
def auth_client(client: httpx.Client) -> tuple[httpx.Client, str]:
    email = f"user-{uuid.uuid4()}@dataverse.local"
    password = "Passw0rd123!"
    register = client.post(
        "/auth/register", json={"email": email, "password": password, "galaxy_name": "Test Star Core"}
    )
    assert register.status_code == 201, register.text
    body = register.json()
    token = body["access_token"]
    galaxy_id = body["default_galaxy"]["id"]
    client.headers.update({"Authorization": f"Bearer {token}"})
    return client, galaxy_id


def test_star_core_interior_governance_flow(auth_client: tuple[httpx.Client, str]) -> None:
    client, galaxy_id = auth_client

    # 1. Get Initial Interior State
    resp = client.get(f"/galaxies/{galaxy_id}/star-core/interior")
    assert resp.status_code == 200, resp.text
    body = resp.json()
    assert body["galaxy_id"] == galaxy_id
    # Default phase might be constitution_select OR policy_lock_ready if defaults already matched
    assert body["interior_phase"] in ["constitution_select", "policy_lock_ready"]
    # If policy_lock_ready, then a constitution is already selected by default
    if body["interior_phase"] == "constitution_select":
        assert body["selected_constitution_id"] is None
        assert body["lock_ready"] is False
        assert "constitution_required" in body["lock_blockers"]
    else:
        assert body["selected_constitution_id"] is not None
        assert body["lock_ready"] is True

    # 2. Start Interior Entry (Transition phase)
    resp = client.post(f"/galaxies/{galaxy_id}/star-core/interior/entry/start", json={})
    assert resp.status_code == 200, resp.text
    body = resp.json()
    assert body["interior_phase"] == "star_core_interior_entry"
    assert body["next_action"]["action_key"] == "stabilize_core_entry"

    # 3. Select Constitution (Rovnovaha)
    # We must wait for the entry window to close or allow for phase-based lock_ready logic
    import time

    time.sleep(1.0)  # Wait for _INTERIOR_ENTRY_PHASE_WINDOW (650ms) to pass

    resp = client.post(
        f"/galaxies/{galaxy_id}/star-core/interior/constitution/select", json={"constitution_id": "rovnovaha"}
    )
    assert resp.status_code == 200, resp.text
    body = resp.json()
    assert body["selected_constitution_id"] == "rovnovaha"
    # Should be policy_lock_ready now, but entry phase might still be active if very fast
    assert body["interior_phase"] in ["policy_lock_ready", "star_core_interior_entry"]
    assert body["lock_ready"] is True
    assert not body["lock_blockers"]

    # 4. Perform Policy Lock
    # We must match the constitution definition
    constitution = next(c for c in body["available_constitutions"] if c["constitution_id"] == "rovnovaha")

    resp = client.post(
        f"/galaxies/{galaxy_id}/star-core/policy/lock",
        json={
            "profile_key": constitution["profile_key"],
            "physical_profile_key": constitution["physical_profile_key"],
            "physical_profile_version": constitution["physical_profile_version"],
            "lock_after_apply": True,
        },
    )
    assert resp.status_code == 200, resp.text
    body = resp.json()
    # Phase should transition to policy_lock_transition
    assert body["interior_phase"] == "policy_lock_transition"
    assert body["lock_transition_state"] == "locked"
    assert body["first_orbit_ready"] is True

    # 5. Verify final locked state in Policy
    resp = client.get(f"/galaxies/{galaxy_id}/star-core/policy")
    assert resp.status_code == 200, resp.text
    policy = resp.json()
    assert policy["lock_status"] == "locked"
    assert policy["can_edit_core_laws"] is False
