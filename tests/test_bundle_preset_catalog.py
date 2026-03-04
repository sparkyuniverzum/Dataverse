from app.presets.bundle_presets import get_preset_bundle, list_preset_bundles


def test_bundle_preset_catalog_has_expected_entries() -> None:
    bundles = list_preset_bundles()
    keys = [item.key for item in bundles]

    assert len(bundles) >= 2
    assert len(set(keys)) == len(keys)
    assert "simple_crm" in keys
    assert "employee_onboarding" in keys


def test_bundle_preset_detail_contains_graph_manifest() -> None:
    bundle = get_preset_bundle("simple_crm")
    assert bundle is not None

    assert bundle.version == 1
    planets = bundle.manifest.get("planets", [])
    moons = bundle.manifest.get("moons", [])
    bonds = bundle.manifest.get("bonds", [])

    assert len(planets) == 2
    assert len(moons) >= 3
    assert len(bonds) >= 1
    assert any(item.get("schema_preset_key") == "contacts_org" for item in planets)
