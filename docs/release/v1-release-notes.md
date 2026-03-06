# DataVerse V1 Release Notes

Date: 2026-03-02
Release tag: `v1.0.1`
Release SHA: `89f4f17`

## Scope closed in V1
- API/parser/table contracts are frozen and synchronized with implementation.
- Runtime reliability finalized (transaction boundaries, rollback safety, idempotence).
- UX operating clarity and visual discipline stabilized.
- Scenario branches + table contracts finalized (including branch promotion and branch-aware reads/writes).
- Parser diagnostics and command semantics documented and test-guarded.
- Branch naming guard finalized (`trim + casefold`, deterministic `409`) with DB-level unique active-name index.

## Validation evidence
- `make v1-release-gate` -> passed
- `make v1-release-full` -> passed
- Included checks:
  - `make migrate-check`
  - `make test-backend-unit`
  - `make test-contracts`
  - `make test-backend-integration`
  - `make ops-smoke`
  - `cd frontend && npm ci && npm test && npm run build`

## Operational notes
- Hard delete remains forbidden by design and DB triggers.
- Event log remains the single write source of truth.
- Read projections remain deterministic for live and branch timelines.

## MVP closure addendum (2026-03-05)
- Star physics migration path implemented and gated:
  - `POST /galaxies/{galaxy_id}/star-core/physics/profile/migrate` (dry-run + apply).
- FE projection replay convergence gate added:
  - `src/components/universe/projectionConvergenceGate.test.js`.
- Contract matrix closure confirmed:
  - `docs/contracts/contract-gap-diff-v2.md` has all tracked rows in `DONE`.

## Planet+Moon v3 P0 closure addendum (2026-03-06)
- P0 gate set is fully green for capability + civilization + mineral + bridge integrity path.
- Added and closed gate set:
  - `tests/test_api_integration.py::test_moon_capability_entity_lifecycle_and_projection_convergence`
  - `tests/test_moon_contracts.py::test_capability_composition_order_and_conflict_policy`
  - `tests/test_api_integration.py::test_contract_evolution_revalidate_backfill_mark_invalid`
  - `tests/test_api_integration.py::test_contract_violation_explainability_payload_shape`
  - `frontend/src/components/universe/workspaceContractExplainability.test.js`
  - `tests/test_api_integration.py::test_bridge_integrity_soft_delete_and_replay_convergence`
- Consolidated DoD status:
  - `docs/contracts/planet-moon-dod-v3.md` marks `PM-P0-01` .. `PM-P0-08` as `GREEN`.
- Release gate confirmation:
  - `scripts/star_contract_gate.sh` -> PASS

## Planet+Moon v3 P1 closure addendum (2026-03-06)
- P1 hardening gate set is fully green:
  - `PM-P1-01` `/civilizations*` canonical runtime gate.
  - `PM-P1-02` `/moons*` compatibility + deprecation marker parity gate.
  - `PM-P1-03` capability matrix freeze + machine-readable conflict guard.
  - `PM-P1-04` BE->FE planet visual-law parity gate.
- Added/closed gate evidence:
  - `frontend/src/lib/civilizationRuntimeRouteGate.test.js`
  - `tests/test_api_integration.py::test_moons_alias_deprecation_marker_and_parity`
  - `tests/test_moon_contract_freeze_gate.py::test_capability_matrix_freeze_v1`
  - `frontend/src/components/universe/planetPhysicsParity.test.js`
- Consolidated status:
  - `docs/contracts/planet-moon-p1-backlog-v1.md` is closed.

## Planet+Moon v3 P2 progress addendum (2026-03-06)
- `PM-P2-01` closed: bulk civilization write resilience (`OCC + idempotency + rollback`).
  - Gate: `tests/test_api_integration.py::test_bulk_civilization_writes_occ_idempotency`.
- `PM-P2-02` closed: replay convergence under load (BE + FE).
  - Gates:
    - `tests/test_universe_projection_errors.py::test_projection_replay_convergence_under_load`
    - `frontend/src/components/universe/projectionConvergenceGate.test.js` (high-volume replay scenario).

## Planet+Moon v3 P2 closure addendum (2026-03-06)
- `PM-P2-03` closed: deterministic guided repair flow in FE runtime path.
  - Gate: `frontend/src/components/universe/repairFlowContract.test.js`.
- Guided repair runtime now includes:
  - deterministic repair suggestion from contract-violation detail,
  - idempotent mutation payload builder for repair apply,
  - local audit trail records for planned/applied/failed repair actions.
- Official closure status:
  - `PM-P2-01` .. `PM-P2-03` are all `GREEN` in `docs/contracts/planet-moon-dod-v3.md`.

## Planet Builder UX flow kickoff (2026-03-06)
- Started next MVP layer above repair baseline:
  - explicit Planet Builder state machine + causal mission copy in workspace UI.
- Initial gate:
  - `frontend/src/components/universe/planetBuilderFlow.test.js`.
- Follow-up closure:
  - transition guards now block invalid builder transitions and recover to last valid step (`P3-02`).
- Mission gate added:
  - FE e2e-like scenario `StarLockedRequired -> ... -> Converged` (`P3-03`).
- P4 kickoff:
  - interactive Planet Builder wizard harness gate (`PM-P4-01`) for mission + guards + recover behavior.
- P4 progress:
  - component-level wizard harness with real UI click events is now gated (`PM-P4-02`).
  - Playwright browser smoke gate is now green (`PM-P4-03`).
- P4 closure:
  - all `PM-P4-*` gates are green (interactive harness + component harness + browser smoke).
- P5 kickoff:
  - real auth bootstrap helper (`PM-P5-01`) and real auth/session lifecycle smoke (`PM-P5-02`) are implemented.
