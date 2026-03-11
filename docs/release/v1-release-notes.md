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
  - `docs/contracts/planet-civilization-delivery-canonical-v1.md` marks `PM-P0-01` .. `PM-P0-08` as `GREEN`.
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
  - `docs/contracts/planet-civilization-delivery-canonical-v1.md` is the canonical closure source.

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
  - `PM-P2-01` .. `PM-P2-03` are all `GREEN` in `docs/contracts/planet-civilization-delivery-canonical-v1.md`.

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

## Planet Builder UX flow P5 closure addendum (2026-03-06)

- `PM-P5-03` closed:
  - real workspace bootstrap path is covered in browser smoke (first-run create and rerun enter paths).
- `PM-P5-04` closed:
  - real `star lock -> first planet wizard -> grid convergence` path is covered in browser smoke.
- Gate evidence:
  - `frontend/e2e/staging/workspace-starlock-wizard-grid.smoke.spec.mjs`
  - `npm --prefix frontend run test:e2e:workspace-starlock`
  - `./scripts/staging_workspace_starlock_wizard_grid_smoke.sh`

## Planet+Moon v3 P6 reconciliation addendum (2026-03-06)

- Local FE gate sweep for current P6 scope is green:
  - `cd frontend && npm test -- src/components/universe/planetPhysicsParity.test.js src/lib/hierarchy_layout.test.js src/components/universe/scene/physicsSystem.test.js src/components/universe/projectionConvergenceGate.test.js src/components/universe/workspaceContractExplainability.test.js src/components/universe/planetBuilderFlow.test.js src/components/universe/planetBuilderWizardPanel.component.test.jsx src/components/universe/accessibilityPreview.test.jsx src/components/universe/scene/performanceBudget.test.js src/components/universe/workspaceUiPersistence.test.js` -> `10 files, 40 tests passed`.
- Staging gate artifacts added for preview layer:
  - `frontend/e2e/staging/planet-moon-preview.smoke.spec.mjs`
  - `frontend/e2e/staging/accessibility-preview.smoke.spec.mjs`
  - `frontend/e2e/staging/preview-performance.smoke.spec.mjs`
  - `./scripts/staging_planet_moon_preview_smoke.sh`
  - `./scripts/staging_accessibility_preview_smoke.sh`
  - `./scripts/staging_preview_performance_smoke.sh`
- P6 remains open and is tracked as partial closure:
  - open gaps: `PM-P6-01` (live API execution evidence for dedicated BE parity gate), `PM-P6-03` (live API execution evidence for dedicated BE lifecycle gate).
- Canonical P6 state is maintained in:
  - `docs/contracts/planet-civilization-delivery-canonical-v1.md`

## Planet+Moon v3 P6 evidence sync addendum (2026-03-07)

- `PM-P6-07A` / `CMV2-07` staging evidence executed:
  - `npm --prefix frontend run test:e2e:workspace-starlock`
  - result: `1 passed (2.2m)` for `frontend/e2e/staging/workspace-starlock-wizard-grid.smoke.spec.mjs`.
- `PM-P6-01A` dedicated BE parity gate added:
  - `tests/test_api_integration.py::test_planet_preview_payload_parity_v1`
  - local verification in this environment:
    - `ruff check tests/test_api_integration.py` -> passed
    - `python -m py_compile tests/test_api_integration.py` -> passed
    - `pytest -q tests/test_api_integration.py -k test_planet_preview_payload_parity_v1` -> skipped when API server is unavailable
- `PM-P6-03A` dedicated BE preview lifecycle gate added:
  - `tests/test_api_integration.py::test_planet_moon_preview_convergence_lifecycle_v1`
  - local verification in this environment:
    - `ruff check tests/test_api_integration.py` -> passed
    - `python -m py_compile tests/test_api_integration.py` -> passed
    - `pytest -q tests/test_api_integration.py -k "test_planet_moon_preview_convergence_lifecycle_v1 or test_planet_preview_payload_parity_v1 or test_civilization_mineral_edit_mutate_facts_convergence_v1"` -> `3 skipped` when API server is unavailable
- `PM-P6-04A` staging evidence:
  - `npm --prefix frontend run test:e2e:planet-moon-preview`
  - first run timeout (`180000ms`), immediate rerun passed: `1 passed (1.8m)`.
- `PM-P6-08A` staging evidence:
  - `npm --prefix frontend run test:e2e:accessibility-preview` -> `1 passed (3.6m)`.
- `PM-P6-09A` staging evidence:
  - `npm --prefix frontend run test:e2e:preview-performance` -> `1 passed (1.9m)`.
- `PM-P6-10B` staging evidence:
  - `npm --prefix frontend run test:e2e:workspace-resume-preview` -> passed (`1 passed`, `2.3m`) on 2026-03-07 after resume-flow fixes.
  - applied fixes:
    - `frontend/src/hooks/useGalaxyGate.js`: do not wipe selected galaxy during auth bootstrap loading.
    - `frontend/src/components/universe/UniverseWorkspace.jsx`: preserve restored quick-grid-open state while projection data is still loading.
- `PM-P6-05B` staging evidence:
  - `npm --prefix frontend run test:e2e:camera-focus-flow` -> passed (`1 passed`, `3.1m`) on 2026-03-07.
  - `./scripts/staging_camera_focus_flow_smoke.sh` -> `PASS`.
  - gate artifacts:
    - `frontend/e2e/staging/camera-focus-flow.smoke.spec.mjs`
    - `frontend/src/components/universe/CameraPilot.test.jsx`
    - `frontend/src/components/universe/cameraPilotMath.test.js`

## Logical flow Wave 0 addendum (2026-03-07)

- `W0-LF-01` closed (`GREEN`): canonical glossary freeze approved.
- Artifact:
  - `docs/contracts/planet-civilization-domain-canonical-v1.md`
- Decision:
  - Planet/Moon/Civilization/Mineral/Bond vocabulary is frozen with anti-confusion mapping and mineral coupling rules.
- `W0-LF-02` closed (`GREEN`): UX intent freeze approved.
- Artifact:
  - `docs/contracts/planet-civilization-domain-canonical-v1.md`
- Decision:
  - discoverability/inspectability/explainability scenarios and acceptance checklist are frozen for implementation.
- `W0-LF-03` closed (`GREEN`): success metrics and thresholds approved.
- Artifact:
  - metrics section in `docs/contracts/planet-civilization-domain-canonical-v1.md`
- Decision:
  - `LF-M01..LF-M06` are the canonical logical-flow success metrics for Wave 1+.
- `W0-LF-04` closed (`GREEN`): canonical row route policy is frozen.
- Contract updates:
  - `docs/contracts/api-v1.md`
  - `docs/contracts/planet-civilization-domain-canonical-v1.md`
- Policy result:
  - `/civilizations*` is canonical row lifecycle API.
  - `/moons*` remains compatibility alias with mandatory headers:
    - `X-Dataverse-Deprecated-Alias: true`
    - `X-Dataverse-Canonical-Route: /civilizations`
- `W0-LF-05` closed (`GREEN`): error envelope freeze for contract violations.
- Canonical explainability keys are frozen:
  - `rule_id`, `capability_id`, `mineral_key`, `expected_constraint`, `repair_hint`
- FE compatibility mapping is implemented in:
  - `frontend/src/components/universe/workspaceContractExplainability.js`
- Live API evidence:
  - `pytest -q tests/test_api_integration.py -k test_contract_violation_explainability_payload_shape` -> `1 passed, 93 deselected` (2026-03-07).
- `W0-LF-06` closed (`GREEN`): Visual Builder unified context contract decided.
- Contract artifact:
  - `docs/contracts/visual-builder-context-contract-v1.md`
- Decision:
  - `WorkspaceContextV1` is the canonical FE builder envelope (planet + moon + civilization + bond + star context).
  - adapter mode from existing endpoints is explicitly defined until dedicated endpoint is implemented.
- `W0-LF-07` closed (`GREEN`): Bond pre-commit validate/preview contract decided.
- Contract artifact:
  - `docs/contracts/bond-preview-validate-contract-v1.md`
- Decision:
  - `POST /bonds/validate` is the canonical dry-run decision contract for bond builder.
  - reject/warn taxonomy is frozen for FE explainability before commit.
- `W0-LF-08` closed (`GREEN`): Moon-impact query contract decided.
- Contract artifact:
  - `docs/contracts/moon-impact-contract-v1.md`
- Decision:
  - `GET /planets/{planet_id}/moon-impact` is the canonical impact explainability read path.
  - impact samples reuse canonical violation keys (`rule_id`, `capability_id`, `expected_constraint`, `repair_hint`).
- `W0-LF-09` closed (`GREEN`): Visual Builder state machine contract decided.
- Contract artifact:
  - `docs/contracts/visual-builder-state-machine-v1.md`
- Decision:
  - one canonical machine covers navigation, bond draft/preview, builder flow, and recover semantics.
- `W0-LF-10` closed (`GREEN`): Inspector IA contract decided.
- Contract artifact:
  - `docs/contracts/inspector-ia-contract-v1.md`
- Decision:
  - inspector precedence and required field/action inventory are frozen for Planet/Moon/Civilization/Bond inspectors.
- `W0-LF-11` closed (`GREEN`): persistence scope and resume safety contract decided.
- Contract artifact:
  - `docs/contracts/visual-builder-state-machine-v1.md`
- Decision:
  - persisted keys and invalid-state recovery fallback are explicitly frozen.
- `W0-LF-12` closed (`GREEN`): feature-flag rollout plan decided.
- Contract artifact:
  - `docs/release/planet-civilization-operations-canonical-v1.md`
- Decision:
  - phased rollout + promotion gates + rollback matrix are frozen for `moon_discovery_v1`, `bond_builder_v1`, `cross_planet_guard_v1`.
- `W0-LF-13` closed (`GREEN`): test matrix skeleton and placeholders committed.
- Artifacts:
  - `docs/contracts/planet-civilization-delivery-canonical-v1.md`
  - `tests/test_planet_civilization_lf_matrix_placeholder.py`
  - `frontend/src/components/universe/planetCivilizationMatrix.placeholder.test.js`
  - `frontend/e2e/staging/planet-civilization-lf.matrix.placeholder.spec.mjs`
- `W0-LF-14` closed (`GREEN`): deterministic two-planet fixtures committed.
- Artifacts:
  - `tests/fixtures/planet_civilization/compatible_cross_planet_bond.json`
  - `tests/fixtures/planet_civilization/incompatible_cross_planet_bond.json`
  - `tests/fixtures/planet_civilization/README.md`
- `W0-LF-15` closed (`GREEN`): telemetry schema contract decided.
- Artifact:
  - `docs/contracts/planet-civilization-delivery-canonical-v1.md`
- `W0-LF-16` closed (`GREEN`): logical-flow rollback policy decided.
- Artifacts:
  - `docs/release/planet-civilization-operations-canonical-v1.md`
  - `docs/release/v1-rollout-runbook.md` (logical-flow operations reference)
- Wave 0 readiness closure:
  - all `W0-LF-01..16` and `SG-LF-01..16` are `GREEN` as of 2026-03-07.

## Planet/Civilization P2 telemetry + LF activation addendum (2026-03-08)

- Telemetry catalog runtime wiring is active in FE workspace:
  - `frontend/src/lib/workspaceTelemetry.js`
  - `frontend/src/components/universe/UniverseWorkspace.jsx`
- Telemetry gates added/updated:
  - `frontend/src/lib/workspaceTelemetry.test.js`
  - `frontend/src/components/universe/UniverseWorkspace.contextMenu.test.jsx` (moon open emission path).
- LF matrix placeholder replacement completed in FE gate inventory:
  - `frontend/src/components/universe/planetCivilizationMatrix.placeholder.test.js` now carries executable `LF-01..LF-08` checks without `it.skip`.
  - `frontend/e2e/staging/planet-civilization-lf.matrix.placeholder.spec.mjs` is executable staging smoke gate with real workspace flow assertions.
- Verification snapshot:
  - `pre-commit` checks passed.
  - frontend targeted unit run passed (`2 files`, `19 tests`).
  - LF staging e2e smoke run passed (`1 test`).
- P2 preset runtime closure evidence:
  - FE runtime flow now uses canonical `/presets/catalog` + `/presets/apply` path in stage-zero setup.

## Planet+Moon P6 + LF closure sync addendum (2026-03-08)

- Dedicated P6 BE gates executed and passing:
  - `pytest -q tests/test_api_integration.py -k "test_planet_preview_payload_parity_v1 or test_planet_moon_preview_convergence_lifecycle_v1"` -> `2 passed`.
- LF BE matrix gate executed and passing:
  - `pytest -q tests/test_planet_civilization_lf_matrix_placeholder.py` -> `8 passed`.
- Closure synchronization completed:
  - `docs/contracts/planet-civilization-delivery-canonical-v1.md`
- Normalized closure status as of 2026-03-08:
  - `PM-P6-01` .. `PM-P6-10` are `GREEN`.
  - `LF-01` .. `LF-08` are `GREEN`.

## Planet/Civilization UI-WF-4 closure addendum (2026-03-10)

- UI workflow sprint closure synchronized:
  - `docs/contracts/planet-civilization-delivery-canonical-v1.md` now marks `UI-WF-4` as closed.
- Operator runbook note frozen:
  - `docs/release/v1-rollout-runbook.md` section `UI-WF-4 Operator Runbook Note (2026-03-10)`.
- BE release-hardening gate executed:
  - `pytest -q tests/test_api_integration.py` -> `99 passed, 1 skipped in 32.85s`.
- Skip classification:
  - skipped case is onboarding bundle availability (`personal_cashflow`) and is accepted as non-blocking for current UI-WF-4 runtime closure.
