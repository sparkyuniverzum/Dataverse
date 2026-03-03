from __future__ import annotations

from app.services.physics_engine_service import PhysicsEngineService


def test_derive_asteroid_state_monotonic_with_error_pressure() -> None:
    service = PhysicsEngineService()

    baseline = service._derive_asteroid_state(error_count=0, circular_fields_count=0, bond_degree=0)
    stressed = service._derive_asteroid_state(error_count=4, circular_fields_count=2, bond_degree=3)

    assert stressed["stress_score"] > baseline["stress_score"]
    assert stressed["emissive_boost"] > baseline["emissive_boost"]
    assert stressed["pulse_factor"] > baseline["pulse_factor"]
    assert stressed["opacity_factor"] < baseline["opacity_factor"]


def test_derive_bond_state_flow_bias_is_higher_than_relation() -> None:
    service = PhysicsEngineService()

    relation = service._derive_bond_state(
        bond_type="RELATION",
        source_stress=0.2,
        target_stress=0.3,
        source_degree=2,
        target_degree=2,
    )
    flow = service._derive_bond_state(
        bond_type="FLOW",
        source_stress=0.2,
        target_stress=0.3,
        source_degree=2,
        target_degree=2,
    )

    assert flow["stress_score"] > relation["stress_score"]
    assert flow["emissive_boost"] > relation["emissive_boost"]
    assert flow["pulse_factor"] > relation["pulse_factor"]


def test_derive_bond_state_respects_stress_inputs() -> None:
    service = PhysicsEngineService()

    low = service._derive_bond_state(
        bond_type="FLOW",
        source_stress=0.0,
        target_stress=0.0,
        source_degree=1,
        target_degree=1,
    )
    high = service._derive_bond_state(
        bond_type="FLOW",
        source_stress=1.0,
        target_stress=1.0,
        source_degree=1,
        target_degree=1,
    )

    assert high["stress_score"] > low["stress_score"]
    assert high["emissive_boost"] > low["emissive_boost"]
    assert high["opacity_factor"] < low["opacity_factor"]
