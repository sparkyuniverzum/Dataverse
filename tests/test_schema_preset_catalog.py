from app.presets.schema_presets import get_schema_preset, list_schema_presets


def test_schema_preset_catalog_has_expected_core_set() -> None:
    presets = list_schema_presets()
    keys = [item.key for item in presets]

    assert len(presets) == 10
    assert len(set(keys)) == len(keys)
    assert "registry_core" in keys
    assert "transactions" in keys
    assert "metrics_timeseries" in keys



def test_schema_preset_detail_contains_contract_and_seed_rows() -> None:
    preset = get_schema_preset("transactions")
    assert preset is not None

    assert preset.version == 1
    assert "tx_id" in preset.required_fields
    assert preset.field_types["amount"] == "number"
    assert any(item.get("field") == "amount" for item in preset.validators)
    assert len(preset.default_rows) >= 2
