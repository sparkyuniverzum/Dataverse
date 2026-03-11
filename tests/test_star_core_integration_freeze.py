from __future__ import annotations

import json
import os
import uuid
from pathlib import Path

import httpx
import pytest

API_BASE_URL = os.getenv("DATAVERSE_API_BASE", "http://127.0.0.1:8000")


def _load_json(path: str) -> dict:
    root = Path(__file__).resolve().parents[1]
    with (root / path).open("r", encoding="utf-8") as handle:
        return json.load(handle)


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
    email = f"star-freeze-{uuid.uuid4()}@dataverse.local"
    password = "Passw0rd123!"
    register = client.post(
        "/auth/register",
        json={"email": email, "password": password, "galaxy_name": "Star Freeze Gate"},
    )
    assert register.status_code == 201, register.text
    body = register.json()
    token = body["access_token"]
    galaxy_id = body["default_galaxy"]["id"]
    client.headers.update({"Authorization": f"Bearer {token}"})
    return client, galaxy_id


def _seed_star_activity(client: httpx.Client, galaxy_id: str, *, table_name: str = "Core > Freeze") -> None:
    seeded = client.post(
        "/parser/execute",
        json={
            "query": (
                f"StarSeedA-{uuid.uuid4()} (table: {table_name}, amount: 5) + "
                f"StarSeedB-{uuid.uuid4()} (table: {table_name}, amount: 7)"
            ),
            "galaxy_id": galaxy_id,
        },
    )
    assert seeded.status_code == 200, seeded.text


def test_star_baseline_v1_integration_freeze_gate(auth_client: tuple[httpx.Client, str]) -> None:
    client, galaxy_id = auth_client
    baseline = _load_json("docs/P0-core/baselines/star-contract-baseline-v1.json")
    source = baseline["source_of_truth"]

    _seed_star_activity(client, galaxy_id, table_name="Core > Baseline")

    policy = client.get(f"/galaxies/{galaxy_id}/star-core/policy")
    assert policy.status_code == 200, policy.text
    assert set(policy.json().keys()) == set(source["policy"]["be_fields"])

    runtime = client.get(f"/galaxies/{galaxy_id}/star-core/runtime", params={"window_events": 64})
    assert runtime.status_code == 200, runtime.text
    assert set(runtime.json().keys()) == set(source["runtime"]["be_fields"])

    pulse = client.get(f"/galaxies/{galaxy_id}/star-core/pulse", params={"limit": 32})
    assert pulse.status_code == 200, pulse.text
    pulse_body = pulse.json()
    if pulse_body.get("events"):
        assert set(pulse_body["events"][0].keys()) == set(source["pulse_event"]["be_fields"])

    domains = client.get(f"/galaxies/{galaxy_id}/star-core/metrics/domains", params={"window_events": 64})
    assert domains.status_code == 200, domains.text
    domains_body = domains.json()
    if domains_body.get("domains"):
        assert set(domains_body["domains"][0].keys()) == set(source["domains"]["be_fields"])


def test_star_physics_v2_integration_freeze_gate(auth_client: tuple[httpx.Client, str]) -> None:
    client, galaxy_id = auth_client
    baseline = _load_json("docs/P0-core/baselines/star-physics-contract-baseline-v2.json")
    source = baseline["source_of_truth"]

    _seed_star_activity(client, galaxy_id, table_name="Physics > Baseline")

    locked = client.post(
        f"/galaxies/{galaxy_id}/star-core/policy/lock",
        json={
            "profile_key": "SENTINEL",
            "lock_after_apply": True,
            "physical_profile_key": "FORGE",
            "physical_profile_version": 2,
        },
    )
    assert locked.status_code == 200, locked.text

    profile = client.get(f"/galaxies/{galaxy_id}/star-core/physics/profile")
    assert profile.status_code == 200, profile.text
    profile_body = profile.json()
    assert set(profile_body.keys()) == set(source["physics_profile"]["be_fields"])
    assert profile_body["profile_key"] == "FORGE"
    assert profile_body["profile_version"] == 2

    planets = client.get(f"/galaxies/{galaxy_id}/star-core/physics/planets", params={"limit": 128})
    assert planets.status_code == 200, planets.text
    planets_body = planets.json()
    assert set(planets_body.keys()) == {"as_of_event_seq", "items"}
    assert isinstance(planets_body["items"], list)
    if planets_body["items"]:
        item = planets_body["items"][0]
        assert set(item.keys()) == set(source["planet_physics_item"]["be_fields"])
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


def test_star_physics_profile_migration_and_limit_guard_gate(auth_client: tuple[httpx.Client, str]) -> None:
    client, galaxy_id = auth_client

    _seed_star_activity(client, galaxy_id, table_name="Physics > Guard")
    locked = client.post(
        f"/galaxies/{galaxy_id}/star-core/policy/lock",
        json={
            "profile_key": "SENTINEL",
            "lock_after_apply": True,
            "physical_profile_key": "ARCHIVE",
            "physical_profile_version": 3,
        },
    )
    assert locked.status_code == 200, locked.text

    before = client.get(f"/galaxies/{galaxy_id}/star-core/physics/profile")
    assert before.status_code == 200, before.text
    before_body = before.json()

    migrate_dry_run = client.post(
        f"/galaxies/{galaxy_id}/star-core/physics/profile/migrate",
        json={
            "from_version": 3,
            "to_version": 4,
            "reason": "gate-smoke",
            "dry_run": True,
        },
    )
    assert migrate_dry_run.status_code == 200, migrate_dry_run.text
    migrate_dry_run_body = migrate_dry_run.json()
    assert migrate_dry_run_body["dry_run"] is True
    assert migrate_dry_run_body["applied"] is False
    assert migrate_dry_run_body["from_version"] == 3
    assert migrate_dry_run_body["to_version"] == 4
    assert migrate_dry_run_body["profile_key"] == "ARCHIVE"
    assert migrate_dry_run_body["lock_status"] == "locked"
    assert isinstance(migrate_dry_run_body["impacted_planets"], int)

    after = client.get(f"/galaxies/{galaxy_id}/star-core/physics/profile")
    assert after.status_code == 200, after.text
    after_body = after.json()
    assert after_body == before_body

    migrate_apply = client.post(
        f"/galaxies/{galaxy_id}/star-core/physics/profile/migrate",
        json={
            "from_version": 3,
            "to_version": 4,
            "reason": "gate-apply",
            "dry_run": False,
        },
    )
    assert migrate_apply.status_code == 200, migrate_apply.text
    migrate_apply_body = migrate_apply.json()
    assert migrate_apply_body["dry_run"] is False
    assert migrate_apply_body["applied"] is True
    assert migrate_apply_body["from_version"] == 3
    assert migrate_apply_body["to_version"] == 4

    migrated = client.get(f"/galaxies/{galaxy_id}/star-core/physics/profile")
    assert migrated.status_code == 200, migrated.text
    migrated_body = migrated.json()
    assert migrated_body["profile_version"] == 4

    pulse_limited = client.get(f"/galaxies/{galaxy_id}/star-core/pulse", params={"limit": 1})
    assert pulse_limited.status_code == 200, pulse_limited.text
    pulse_limited_body = pulse_limited.json()
    assert pulse_limited_body["sampled_count"] <= 1
    assert len(pulse_limited_body.get("events", [])) <= 1

    pulse_too_large = client.get(f"/galaxies/{galaxy_id}/star-core/pulse", params={"limit": 257})
    assert pulse_too_large.status_code == 422, pulse_too_large.text

    planets_limited = client.get(f"/galaxies/{galaxy_id}/star-core/physics/planets", params={"limit": 1})
    assert planets_limited.status_code == 200, planets_limited.text
    assert len(planets_limited.json().get("items", [])) <= 1

    planets_too_large = client.get(f"/galaxies/{galaxy_id}/star-core/physics/planets", params={"limit": 1001})
    assert planets_too_large.status_code == 422, planets_too_large.text
