from __future__ import annotations

from app.services.projection.read_model_projector import ReadModelProjector


def test_metadata_update_may_skip_rollups_for_plain_patch_without_global_dependencies() -> None:
    assert ReadModelProjector._metadata_update_may_skip_rollups(
        metadata_patch={"note": "x", "priority": 1},
        bonds_count=0,
        formula_fields_count=0,
        guardian_rules_count=0,
    )


def test_metadata_update_may_not_skip_when_global_dependencies_exist() -> None:
    assert not ReadModelProjector._metadata_update_may_skip_rollups(
        metadata_patch={"note": "x"},
        bonds_count=1,
        formula_fields_count=0,
        guardian_rules_count=0,
    )
    assert not ReadModelProjector._metadata_update_may_skip_rollups(
        metadata_patch={"note": "x"},
        bonds_count=0,
        formula_fields_count=1,
        guardian_rules_count=0,
    )
    assert not ReadModelProjector._metadata_update_may_skip_rollups(
        metadata_patch={"note": "x"},
        bonds_count=0,
        formula_fields_count=0,
        guardian_rules_count=1,
    )


def test_metadata_update_may_not_skip_for_structural_or_formula_patch() -> None:
    assert not ReadModelProjector._metadata_update_may_skip_rollups(
        metadata_patch={"table": "Finance"},
        bonds_count=0,
        formula_fields_count=0,
        guardian_rules_count=0,
    )
    assert not ReadModelProjector._metadata_update_may_skip_rollups(
        metadata_patch={"celkem": "=SUM(cena)"},
        bonds_count=0,
        formula_fields_count=0,
        guardian_rules_count=0,
    )
    assert not ReadModelProjector._metadata_update_may_skip_rollups(
        metadata_patch={"_guardians": [{"field": "x"}]},
        bonds_count=0,
        formula_fields_count=0,
        guardian_rules_count=0,
    )
