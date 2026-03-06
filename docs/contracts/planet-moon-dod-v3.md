# Planet + Moon DoD v3

Status: active (post-MVP execution plan)  
Date: 2026-03-06  
Owner: Core BE/FE architecture  
Depends on: `docs/contracts/planet-builder-mvp-v2.md`, `docs/contracts/moon-contract-v1.md`, `docs/contracts/civilization-contract-v1.md`, `docs/contracts/mineral-contract-v1.md`, `docs/upgrade/adr-moon-civilization-runtime-alias-migration-v1.md`

## 1. Purpose

Define strict post-MVP Definition of Done for the strategic layer:
- Planet (table data carrier),
- Moon (capability module),
- Civilization (row lifecycle),
- Mineral (typed field value).

This document converts architecture intent into execution priorities and machine-verifiable gates.

## 2. Canonical ontology (non-negotiable)

1. Galaxy = workspace tenant boundary.
2. Star = constitution + physical law authority.
3. Planet = table aggregate and data carrier.
4. Moon = capability module attached to planet contract.
5. Civilization = row instance.
6. Mineral = typed value inside civilization.

Invariant: `Moon capability != Civilization row`.

## 3. Priority buckets

## 3.1 P0 (release blocking for Planet Builder v1)

### P0.1 Moon first-class capability entity

Goal:
- capability state is no longer only implicit in `TableContract` payload.

DoD:
1. Dedicated capability aggregate exists (persistent identity + versioning + audit trail).
2. Capability lifecycle supports create/update/deprecate.
3. Planet contract projection and capability aggregate remain deterministic and converged.

Acceptance checks:
1. Capability create/update changes validation/projection behavior in same refresh cycle.
2. Capability rollback restores previous behavior without residual drift.

### P0.2 Deterministic capability composition

Goal:
- combining multiple capability modules always yields deterministic execution.

DoD:
1. Explicit composition order is defined and versioned.
2. Conflict policy is explicit (`fail_fast` or deterministic precedence).
3. Same input timeline always yields same rule evaluation output.

Acceptance checks:
1. Conflict scenario returns machine-readable conflict reason.
2. Replayed event stream reproduces identical effective rule graph.

### P0.3 Contract evolution over existing civilizations

Goal:
- capability/contract changes over live data are operationally safe.

DoD:
1. Evolution modes are explicit (`revalidate`, `backfill`, `mark_invalid`, `retryable`).
2. Existing civilizations are processed without partial hidden failures.
3. OCC/idempotency semantics are preserved during migration writes.

Acceptance checks:
1. Post-evolution writes follow new contract immediately.
2. Invalid pre-existing rows are explicitly surfaced in projection.

### P0.4 Validation explainability (operator-grade)

Goal:
- every contract failure is explainable and actionable.

DoD:
1. Error payload exposes rule id, capability id, mineral key, and failing value.
2. FE can render deterministic “why this failed” diagnostics.
3. No generic `422` without structured reason for contract failures.

Acceptance checks:
1. Integration tests assert structured error envelope fields.
2. FE tests assert diagnostic rendering path.

### P0.5 Bridge Moon integrity governance

Goal:
- cross-planet relations preserve integrity under lifecycle operations.

DoD:
1. Referential rules are explicit (source/target existence, orphan policy).
2. Soft-delete propagation policy is explicit across bridges.
3. Bridge flow remains convergence-safe for snapshot/tables/grid/3D.

Acceptance checks:
1. Cross-planet extinguish/mutate scenarios preserve relation integrity.
2. No dangling references after replay.

## 3.2 P1 (hardening after P0 closure)

Execution backlog: `docs/contracts/planet-moon-p1-backlog-v1.md`

### P1.1 Runtime naming closure (`/civilizations*` canonical)

DoD:
1. FE runtime uses `/civilizations*` as primary everywhere.
2. `/moons*` is compatibility-only with explicit deprecation markers.
3. Route inventory freeze covers both surfaces during migration window.

### P1.2 Capability compatibility matrix

DoD:
1. Allowed and forbidden capability combinations are explicit.
2. Forbidden combos fail deterministically before commit.
3. Matrix is test-gated and versioned.

### P1.3 Planet visual-law parity (BE -> FE)

DoD:
1. Physical metrics (`size`, `luminosity`, `corrosion`, `phase`) are BE-authoritative.
2. FE only maps authoritative metrics to rendering.
3. Parity tests prevent FE-side semantic drift.

## 3.3 P2 (scale, operations, and repair ergonomics)

### P2.1 Bulk + replay resilience

DoD:
1. Bulk writes preserve OCC/idempotency guarantees.
2. Replay convergence remains green under high event volume.

### P2.2 Capability observability dashboard

DoD:
1. Runtime exposes rule-failure rates, drift trend, and validation latency.
2. Alertable SLOs exist for capability evaluation path.

### P2.3 Guided repair flows

DoD:
1. FE offers deterministic repair suggestions for known contract violations.
2. Repair actions remain idempotent and auditable.

## 4. Test matrix (required gates)

Legend:
- `GREEN`: already covered by current automated gate.
- `ADD`: required new gate for v3 closure.

| ID | Priority | Scope | Gate type | Status | Target test / command |
|---|---|---|---|---|---|
| PM-P0-01 | P0 | Moon first-class capability entity | BE integration | GREEN | `tests/test_api_integration.py::test_moon_capability_entity_lifecycle_and_projection_convergence` |
| PM-P0-02 | P0 | Deterministic capability composition | BE machine + integration | GREEN | `tests/test_moon_contracts.py::test_capability_composition_order_and_conflict_policy` |
| PM-P0-03 | P0 | Contract evolution on existing civilizations | BE integration | GREEN | `tests/test_api_integration.py::test_contract_evolution_revalidate_backfill_mark_invalid` |
| PM-P0-04 | P0 | Validation explainability payload | BE integration | GREEN | `tests/test_api_integration.py::test_contract_violation_explainability_payload_shape` |
| PM-P0-05 | P0 | Explainability rendering | FE gate | GREEN | `frontend/src/components/universe/workspaceContractExplainability.test.js` |
| PM-P0-06 | P0 | Bridge Moon integrity | BE integration | GREEN | `tests/test_api_integration.py::test_bridge_integrity_soft_delete_and_replay_convergence` |
| PM-P0-07 | P0 | E2E convergence baseline | BE integration | GREEN | `pytest -q tests/test_api_integration.py -k "release_gate_star_lock_first_planet_moon_lifecycle_grid_convergence"` |
| PM-P0-08 | P0 | FE replay convergence | FE gate | GREEN | `cd frontend && npm test -- --run src/components/universe/projectionConvergenceGate.test.js` |
| PM-P1-01 | P1 | `/civilizations*` canonical runtime | FE contract gate | ADD | `frontend/src/lib/civilizationRuntimeRouteGate.test.js` |
| PM-P1-02 | P1 | `/moons*` compatibility window | BE+FE contract | ADD | `tests/test_api_integration.py::test_moons_alias_deprecation_marker_and_parity` + FE route inventory gate |
| PM-P1-03 | P1 | Capability compatibility matrix | BE machine gate | ADD | `tests/test_moon_contract_freeze_gate.py::test_capability_matrix_freeze_v1` |
| PM-P1-04 | P1 | Planet visual-law parity | FE gate | ADD | `frontend/src/components/universe/planetPhysicsParity.test.js` |
| PM-P2-01 | P2 | Bulk write resilience | BE integration | ADD | `tests/test_api_integration.py::test_bulk_civilization_writes_occ_idempotency` |
| PM-P2-02 | P2 | Replay under load | BE+FE convergence | ADD | `tests/test_universe_projection_errors.py::test_projection_replay_convergence_under_load` + FE replay gate |
| PM-P2-03 | P2 | Guided repair flow | FE e2e-like unit | ADD | `frontend/src/components/universe/repairFlowContract.test.js` |

## 5. Exit criteria by phase

### Planet+Moon v3 P0 closure

1. All `PM-P0-*` gates are green.
2. No non-explainable contract `422` remains in primary builder flow.
3. Replay convergence remains green after create/mutate/extinguish and bridge updates.

### Planet+Moon v3 P1 closure

1. Runtime canonical path is `/civilizations*` across FE write flows.
2. `/moons*` behavior is compatibility-only and explicitly marked.
3. Capability matrix freeze gate is green.

### Planet+Moon v3 P2 closure

1. Bulk/replay resilience gates are green.
2. Observability signals are available for on-call diagnosis.
3. Guided repair flows are deterministic and audited.

## 6. Out of scope for this document

1. Marketing copy and onboarding narrative text quality.
2. Visual art direction specifics (shader style, color themes).
3. Non-core module domains outside Planet/Moon/Civilization/Mineral runtime.
