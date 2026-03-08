# Planet/Civilization Implementation Plan v1

Status: P0/P1 completed, P2 open
Date: 2026-03-08
Owner: FE + BE core

Depends on:
- `docs/contracts/api-v1.md`
- `docs/contracts/planet-civilization-logical-flow-dod-v1.md`
- `docs/contracts/planet-civilization-test-matrix-v1.md`
- `docs/contracts/planet-civilization-telemetry-v1.md`
- `docs/contracts/inspector-ia-contract-v1.md`
- `docs/contracts/moon-impact-contract-v1.md`

## 1. Goal

Close user-visible gaps between current implementation and documented logical-flow contracts.

## 2. Priorities

### P0 (Sprint 1) - critical user-flow blockers

Objective:
- Deliver expected workspace interactions with correct timeline scope behavior.

Scope:
1. Implement real context menu flow (RMB) for planet/civilization actions.
2. Add branch runtime state into FE store and UI branch selection.
3. Pass selected `branch_id` consistently through workspace read/write calls.
4. Wire branch promote action (`POST /branches/{branch_id}/promote`) in FE flow.

Target files:
- `frontend/src/components/universe/UniverseWorkspace.jsx`
- `frontend/src/components/universe/UniverseCanvas.jsx`
- `frontend/src/components/screens/GalaxySelector3D.jsx`
- `frontend/src/store/useUniverseStore.js`
- `frontend/src/lib/dataverseApi.js`

Acceptance:
1. User can open context menu with RMB and execute focus/edit/extinguish.
2. User can switch branch and immediately see branch-scoped projections.
3. User can promote branch and observe deterministic converge to main timeline.

Gates:
1. FE unit tests for context menu actions and branch switching.
2. E2E smoke: select galaxy -> select branch -> write -> refresh -> scope verified.

### P1 (Sprint 2) - contract parity and explainability

Objective:
- Align inspector and explainability flows with formal contracts.

Scope:
1. Implement backend endpoint `GET /planets/{planet_id}/moon-impact`.
2. Replace local Moon Inspector derivation with moon-impact API source.
3. Complete inspector precedence and required blocks:
   - Bond Inspector
   - Civilization Inspector
   - Moon Inspector (API-backed impact)
   - Planet Inspector

Target files:
- `app/api/routers/planets.py`
- `app/services/*` (moon-impact projection service)
- `frontend/src/components/universe/WorkspaceSidebar.jsx`
- `frontend/src/components/universe/UniverseWorkspace.jsx`

Acceptance:
1. Moon inspector shows API-provided impact summary and violations.
2. Inspector precedence is deterministic and contract-compliant.
3. No local heuristic-only impact mode remains as primary source.

Gates:
1. BE integration tests for moon-impact scope/order/error envelope.
2. FE component tests for inspector precedence + payload mapping.

### P2 (Sprint 3) - observability and closure quality

Objective:
- Convert readiness from placeholder state to executable evidence.

Scope:
1. Implement telemetry event catalog from telemetry contract:
   - `moon_opened`
   - `moon_rule_failed`
   - `bond_preview_allowed|rejected|warned`
   - `cross_planet_blocked`
   - `guided_repair_applied|failed`
2. Replace LF placeholder tests with real assertions (BE, FE unit, FE e2e).
3. Move stage-zero preset flow to `/presets/catalog` + `/presets/apply`.

Target files:
- `frontend/src/components/universe/UniverseWorkspace.jsx`
- `frontend/src/lib/*telemetry*`
- `tests/test_planet_civilization_lf_matrix_placeholder.py`
- `frontend/src/components/universe/planetCivilizationMatrix.placeholder.test.js`
- `frontend/e2e/staging/planet-civilization-lf.matrix.placeholder.spec.mjs`

Acceptance:
1. LF-01..LF-08 are no longer placeholders/skips.
2. Telemetry payload contains required shared and event-specific fields.
3. Preset source of truth is backend catalog/apply endpoints.

Gates:
1. CI green with non-placeholder LF matrix.
2. Staging evidence attached to release docs.

## 3. Delivery order

1. P0 context menu + branch scope + promote.
2. P1 moon-impact endpoint + inspector parity.
3. P2 telemetry + test matrix activation + preset API integration.

## 4. Definition of Ready (P0 start)

1. FE/BE agree on branch selection payload propagation.
2. Context menu action list is frozen (focus/edit/extinguish).
3. Branch promote UX confirms post-promote refresh behavior.
4. Test scenarios are written before implementation.

## 5. Tracking checklist

### P0 checklist
- [x] `onOpenContext` in workspace wired to real menu state and actions.
- [x] Branch selected state added to store and persisted.
- [x] All projection fetches include selected `branch_id` where supported.
- [x] Branch promote action implemented in UI and error-handled.
- [x] P0 tests and smoke scenarios merged.

P0 evidence (2026-03-08):
- FE tests: `frontend/src/components/universe/UniverseWorkspace.contextMenu.test.jsx`
- FE tests: `frontend/src/components/universe/planetCivilizationMatrix.placeholder.test.js`
- FE tests: `frontend/src/lib/dataverseApi.test.js`
- Staging smoke: `npm --prefix frontend run test:e2e -- e2e/staging/branch-scope-promote.smoke.spec.mjs` (`1 passed`)

### P1 checklist
- [x] Moon-impact endpoint implemented and documented.
- [x] Moon inspector switched to API-backed impact source.
- [x] Inspector precedence implemented exactly per IA contract.
- [x] P1 BE + FE tests merged.

P1 evidence (2026-03-08):
- BE endpoint: `GET /planets/{planet_id}/moon-impact` implemented in `app/api/routers/planets.py` with schema models in `app/schema_models/planetary.py`.
- FE integration: `frontend/src/components/universe/UniverseWorkspace.jsx` loads moon-impact payload; `frontend/src/components/universe/WorkspaceSidebar.jsx` uses API impact data as primary inspector source.
- FE helper: `frontend/src/lib/dataverseApi.js` (`buildMoonImpactUrl`).
- BE gate: `pytest -q tests/test_api_integration.py -k "planet_moon_impact_endpoint_scope_and_shape"` (`1 passed`).
- FE gates:
  - `npm --prefix frontend run test -- --run src/lib/dataverseApi.test.js src/components/universe/WorkspaceSidebar.moonImpact.test.jsx` (passed)
  - `npm --prefix frontend run test -- --run src/components/universe/planetCivilizationMatrix.placeholder.test.js` (passed)

### P2 checklist
- [ ] Telemetry catalog emitted with required fields.
- [ ] LF matrix placeholders removed/replaced with real tests.
- [ ] Preset flow uses `/presets/catalog` + `/presets/apply`.
- [ ] Release evidence updated in docs/release.

## 6. Risks and mitigations

1. Risk: branch scope drift across FE calls.
   Mitigation: centralize URL/payload builders and add contract tests for branch propagation.
2. Risk: inspector regressions due to mixed local/API models.
   Mitigation: one source-of-truth selector layer + mapping tests.
3. Risk: telemetry noise or schema drift.
   Mitigation: typed telemetry adapter and snapshot tests.

## 7. Exit criteria

1. User can complete branch-scoped workflow without ambiguity.
2. Inspector explainability is API-backed and deterministic.
3. LF test matrix status can be promoted from `SKELETON` to active/green evidence.
