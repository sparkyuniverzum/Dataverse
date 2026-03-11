# Planet/Civilization Delivery Canonical v1

Status: active (canonical merged source)
Date: 2026-03-10
Owner: Core BE/FE architecture
Merged sources:
- historical logical-flow DoD and Wave-0 execution artifacts
- historical UI workflow sprint/audit artifacts
- historical test-matrix and telemetry artifacts

## 1. What changed

This document merges delivery and execution governance into one canonical source:
1. Logical-flow DoD gates.
2. Wave 0 execution package closure.
3. UI workflow sprint and audit closure.
4. Test matrix and telemetry closure baseline.

## 2. Why it changed

Delivery ownership and closure evidence were spread across multiple planning and audit documents. One canonical source improves traceability from gate ID -> implementation -> evidence.

## 3. Canonical delivery baseline

1. Logical-flow readiness gates are green (`SG-LF-*` baseline).
2. Wave 0 execution package is closed and kickoff decision is recorded.
3. UI workflow audit findings `F1..F7` are resolved for v1 baseline.
4. Test matrix and telemetry schema are mandatory closure artifacts for new iterations.

## 4. Evidence

1. `npm --prefix frontend run test:e2e -- e2e/staging/planet-civilization-lf.matrix.placeholder.spec.mjs` -> pass (latest reruns green)
2. `npm --prefix frontend run test:e2e:planet-civilization-mineral-workflow` -> pass (latest reruns green)
3. `npm --prefix frontend run test -- src/components/universe/QuickGridOverlay.civilizations.test.jsx` -> pass in stabilization cycle
4. `PYTHONPATH=. pytest -q tests/test_api_integration.py -rs` -> `99 passed, 1 skipped`
5. `npm --prefix frontend run test -- src/components/universe/planetCivilizationMatrix.placeholder.test.js --passWithNoTests=false` -> `177 passed`
6. `npm --prefix frontend run test -- src/components/universe/planetBuilderConsistencyGuard.test.js src/components/universe/planetBuilderUiState.test.js src/components/universe/planetBuilderFlow.test.js src/components/universe/StageZeroSetupPanel.preview.test.jsx` -> `17 passed`
7. `npm --prefix frontend run test:e2e:workspace-starlock` -> `1 passed`
8. `npm --prefix frontend run test -- src/context/AuthContext.test.jsx src/hooks/useGalaxyGate.test.js` -> `10 passed`
9. `npm --prefix frontend run test -- src/components/universe/useUniverseRuntimeSync.test.js src/components/universe/runtimeProjectionPatch.test.js src/components/universe/runtimeSyncUtils.test.js src/components/universe/workflowEventBridge.test.js` -> `16 passed`
10. `npm --prefix frontend run test -- src/components/universe/runtimeConnectivityState.test.js src/components/universe/WorkspaceSidebar.connectivity.test.jsx src/components/universe/QuickGridOverlay.civilizations.test.jsx src/components/universe/QuickGridOverlay.minerals.test.jsx` -> `26 passed`
11. `npm --prefix frontend run test -- src/hooks/useConnectivityState.test.js src/components/app/appConnectivityNoticeState.test.js src/components/app/AppConnectivityNotice.test.jsx src/components/universe/runtimeConnectivityState.test.js` -> `10 passed`
12. `npm --prefix frontend run test -- src/lib/snapshotNormalization.test.js src/lib/snapshotNormalizationBudget.test.js src/lib/dataverseApi.test.js src/components/universe/runtimeNormalizationSignal.test.js src/components/universe/useUniverseRuntimeSync.test.js src/components/universe/runtimeSyncUtils.test.js src/components/universe/workflowEventBridge.test.js` -> `44 passed`

## 5. Post-closure FE cleanup completed

Completed on 2026-03-10 after canonical v1 closure and before next runtime sprint:
1. Planet builder render logic was aligned to one derived UI state source (`planetBuilderUiState`).
2. Stage Zero setup panel prop-drilling was replaced with local context adapter.
3. Builder consistency guard was added to detect legacy/FSM mismatch in dev mode.
4. Placeholder matrix tests were realigned with current bond preview and remove_soft UI contracts.
5. Auth/session bootstrap no longer treats transient network failures as forced logout and selected galaxy persistence is scoped per authenticated user.
6. Runtime sync now uses bounded stream dedupe and safe local snapshot patching before projection refresh fallback.
7. Offline continuity now spans workspace write guards, app entry notices, and galaxy gate action locking through one shared connectivity source.
8. Snapshot normalization hot path is now split into helper slices, budget-classified, and surfaced back into runtime sync as heavy-payload signal.

## 6. Remaining open items

1. [x] 2026-03-10: no blocking open items in delivery closure scope for v1.
2. [x] 2026-03-10: next iteration moved through runtime-stability hardening and subsequent UX closure in `docs/contracts/ux-rework-blueprint-v1.md`.
