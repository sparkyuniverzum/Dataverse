# Planet/Civilization Runtime Stability Sprint v2

Status: closed
Date: 2026-03-10
Owner: FE Runtime + BE Auth/Platform
Depends on:
- `docs/contracts/planet-civilization-domain-canonical-v1.md`
- `docs/contracts/planet-civilization-delivery-canonical-v1.md`
- `docs/release/planet-civilization-operations-canonical-v1.md`

## 1. What changed

This sprint document defines the next implementation wave after v1 canonical closure, focused on runtime resilience and UX continuity under load/failure:
1. auth/session hardening (security + network-aware behavior),
2. SSE sync redesign (delta-first instead of full projection reload per event),
3. bounded stream dedupe memory,
4. offline/online UX continuity,
5. hot-path performance hardening (normalization + 3D updates).

## 2. Why it changed

Recent review identified high-impact risk clusters not covered by v1 closure:
1. refresh token exposure risk and aggressive logout on transient network errors,
2. full snapshot fetch on stream bursts causing latency/jank,
3. unbounded event ID dedupe memory growth,
4. cross-account selected galaxy contamination risk,
5. JS main-thread pressure in rendering and normalization paths.

The goal is to close these risks without expanding monolith files.

## 3. Scope and guardrails

In scope:
1. FE auth/session behavior + BE-compatible token handling contract updates.
2. FE runtime sync path for stream event application and bounded dedupe.
3. UX offline continuity and explicit write locking behavior.
4. performance hardening plan + incremental implementation for hot paths.

Guardrails:
1. monolith creation is prohibited.
2. split by responsibility (small helpers/hooks/services).
3. per block use focused tests only; long staging smokes run as bundled gates.
4. agent implements; user runs tests and commits.

Out of scope for this sprint:
1. full onboarding redesign,
2. complete GPU shader rewrite (kept as staged migration design + first slice),
3. infrastructure broker rollout (Kafka/Rabbit) beyond current outbox relay architecture.

## 4. Priority backlog

### P0 Security + session correctness

1. move refresh-token persistence away from JS-readable storage to secure transport model.
2. split network error handling from auth invalid handling in session bootstrap/refresh flow.
3. namespace/clear selected galaxy state per authenticated user identity.

Done criteria:
1. transient network failure does not force logout.
2. only explicit auth-invalid responses clear session.
3. cross-account stale galaxy selection is prevented.

### P1 Runtime sync + memory safety

1. apply stream deltas locally first; avoid full projection refresh per event.
2. keep full refresh only for initial load/reconnect/fallback mismatch.
3. replace unbounded dedupe set with capped LRU/TTL strategy.

Done criteria:
1. burst stream traffic does not cause repeated full snapshot fetch loops.
2. dedupe cache memory remains bounded over long-running session.
3. reconnect/fallback still converges to consistent projection.

### P2 UX continuity under failure

1. add explicit offline indicator with guarded write actions while disconnected.
2. preserve visible user context during short connectivity loss.
3. keep write semantics explicit (no hidden side-effect CTA).

Done criteria:
1. offline/online transitions are visible and reversible.
2. user is not unexpectedly ejected to login during transient outages.

### P3 Performance hardening

1. reduce allocation churn in `physicsSystem` update paths.
2. stage worker/chunked normalization where heavy transforms remain.
3. define phased GPU migration plan for material/color interpolation path.

Done criteria:
1. reduced visible jank in primary workspace flows under update load.
2. measurable reduction of hot-path allocations.

## 5. Execution blocks

1. `RSV2-1` P0 auth/session safety.
2. `RSV2-2` P1 stream delta engine + bounded dedupe.
3. `RSV2-3` P2 offline UX continuity + write guard behavior.
4. `RSV2-4` P3 normalization/render hot-path optimization slice.

## 6. Evidence baseline and gates

Focused gates per block:
1. `RSV2-1`
   - `npm --prefix frontend run test -- src/context/AuthContext.test.jsx src/hooks/useGalaxyGate.test.js`
2. `RSV2-2`
   - `npm --prefix frontend run test -- src/components/universe/useUniverseRuntimeSync.test.js src/components/universe/runtimeProjectionPatch.test.js src/components/universe/runtimeSyncUtils.test.js src/components/universe/workflowEventBridge.test.js`
3. `RSV2-3`
   - `npm --prefix frontend run test -- src/hooks/useConnectivityState.test.js src/components/app/appConnectivityNoticeState.test.js src/components/app/AppConnectivityNotice.test.jsx src/components/universe/runtimeConnectivityState.test.js`
   - `npm --prefix frontend run test -- src/components/universe/WorkspaceSidebar.connectivity.test.jsx src/components/universe/QuickGridOverlay.civilizations.test.jsx src/components/universe/QuickGridOverlay.minerals.test.jsx`
4. `RSV2-4`
   - `npm --prefix frontend run test -- src/lib/snapshotNormalization.test.js src/lib/snapshotNormalizationBudget.test.js src/lib/dataverseApi.test.js`
   - `npm --prefix frontend run test -- src/components/universe/runtimeNormalizationSignal.test.js src/components/universe/useUniverseRuntimeSync.test.js src/components/universe/runtimeSyncUtils.test.js`

Bundled long gates (after multi-block bundle, not per block):
1. `npm --prefix frontend run test:e2e:workspace-starlock`
2. `npm --prefix frontend run test:e2e:planet-civilization-mineral-workflow`
3. `npm --prefix frontend run test:e2e -- e2e/staging/planet-civilization-lf.matrix.placeholder.spec.mjs`
4. `PYTHONPATH=. pytest -q tests/test_api_integration.py -rs`

## 7. Remaining open items

1. [x] `RSV2-1` auth/session patch set merged with focused tests green. Done 2026-03-10.
2. [x] `RSV2-2` stream delta + bounded dedupe merged with focused tests green. Done 2026-03-10.
3. [x] `RSV2-3` offline continuity patch merged with focused tests green. Done 2026-03-10.
4. [x] `RSV2-4` performance slice merged with focused tests green. Done 2026-03-10.
5. [x] bundled long gates rerun green after `RSV2-1..RSV2-4`. Done 2026-03-10.

## 8. Related FE closure before RSV2

Closed immediately before this sprint so runtime hardening starts from a cleaner FE builder baseline:
1. `SZ-A` single derived builder UI state introduced (`planetBuilderUiState`).
2. `SZ-B` Stage Zero prop-drilling replaced with local context adapter.
3. `SZ-C` builder consistency guard added and remaining shadow boolean usage reduced.
4. Placeholder Wave1 test matrix aligned with current bond preview + remove_soft UI contracts.

Evidence:
1. `npm --prefix frontend run test -- src/components/universe/planetCivilizationMatrix.placeholder.test.js --passWithNoTests=false` -> `177 passed`
2. `npm --prefix frontend run test -- src/components/universe/planetBuilderConsistencyGuard.test.js src/components/universe/planetBuilderUiState.test.js src/components/universe/planetBuilderFlow.test.js src/components/universe/StageZeroSetupPanel.preview.test.jsx` -> `17 passed`
3. `npm --prefix frontend run test:e2e:workspace-starlock` -> `1 passed`

Reason to record here:
1. `RSV2-*` blocks assume Stage Zero/builder render flow no longer depends on widespread shadow UI booleans.
2. Runtime/auth/offline work should build on this reduced coupling baseline, not reopen builder state ownership.

## 9. RSV2-1 closure evidence

Implemented slices:
1. `RSV2-1A` network-vs-auth split in auth bootstrap/refresh flow.
2. `RSV2-1A` selected galaxy persistence scoped per authenticated user.
3. `RSV2-1B` normalized auth failure envelope helper and deterministic refresh cleanup rules.
4. `RSV2-1B` session runtime refs reset on local logout/clear.

Evidence:
1. `npm --prefix frontend run format:check` -> green
2. `npm --prefix frontend run test -- src/context/AuthContext.test.jsx src/hooks/useGalaxyGate.test.js` -> `10 passed`

Closed outcomes:
1. transient network failure no longer implies forced logout during bootstrap/refresh path
2. explicit `401/403` remains the only auth-invalid session signal
3. stale selected galaxy no longer crosses account boundary via one global key

Next implementation slice:
1. `RSV2-2A`: introduce runtime delta patch helper + bounded event-id dedupe primitive, covered by focused tests only

## 10. RSV2-2 closure evidence

Implemented slices:
1. `RSV2-2A` bounded stream event dedupe helper replacing unbounded in-hook `Set`.
2. `RSV2-2A` delta-first frame classification to skip refresh for empty or telemetry-only update batches.
3. `RSV2-2B` local snapshot patch helper for safe known event batches.
4. `RSV2-2B` refresh fallback retained only for unsupported/unsafe event batches.

Evidence:
1. `npm --prefix frontend run format:check` -> green
2. `npm --prefix frontend run test -- src/components/universe/useUniverseRuntimeSync.test.js src/components/universe/runtimeProjectionPatch.test.js src/components/universe/runtimeSyncUtils.test.js src/components/universe/workflowEventBridge.test.js` -> `16 passed`

Closed outcomes:
1. stream event dedupe memory is now bounded
2. empty or telemetry-only stream updates no longer trigger projection reload
3. safe known event batches can converge snapshot locally before projection fallback

Recommended bundled regression before `RSV2-3`:
1. `npm --prefix frontend run test -- src/context/AuthContext.test.jsx src/hooks/useGalaxyGate.test.js src/components/universe/useUniverseRuntimeSync.test.js src/components/universe/runtimeProjectionPatch.test.js src/components/universe/runtimeSyncUtils.test.js src/components/universe/workflowEventBridge.test.js`

Next implementation slice:
1. `RSV2-3A`: offline indicator + guarded write affordances while disconnected

## 11. RSV2-3 closure evidence

Implemented slices:
1. `RSV2-3A` workspace runtime offline indicator and guarded write behavior for grid/operator actions.
2. `RSV2-3A` shared browser connectivity hook extracted so workspace and app entry use one source.
3. `RSV2-3B` app-level offline continuity notice for session boot, auth entry, and galaxy gate.
4. `RSV2-3B` auth entry flows now surface explicit offline errors instead of vague network failures.
5. `RSV2-3B` galaxy gate create/enter/refresh actions are explicitly locked while offline.

Evidence:
1. `npm --prefix frontend run format:check` -> green
2. `npm --prefix frontend run test -- src/components/universe/runtimeConnectivityState.test.js src/components/universe/WorkspaceSidebar.connectivity.test.jsx src/components/universe/QuickGridOverlay.civilizations.test.jsx src/components/universe/QuickGridOverlay.minerals.test.jsx` -> `26 passed`
3. `npm --prefix frontend run test -- src/hooks/useConnectivityState.test.js src/components/app/appConnectivityNoticeState.test.js src/components/app/AppConnectivityNotice.test.jsx src/components/universe/runtimeConnectivityState.test.js` -> `10 passed`

Closed outcomes:
1. offline/online runtime state is visible inside workspace and reversible without reload
2. operator write actions are blocked explicitly during disconnect instead of failing opaquely
3. auth/session entry surfaces continuity-aware offline messaging instead of looking like broken login
4. galaxy gate no longer offers misleading online-only actions while disconnected

Recommended bundled regression before `RSV2-4`:
1. `npm --prefix frontend run test -- src/context/AuthContext.test.jsx src/hooks/useGalaxyGate.test.js src/hooks/useConnectivityState.test.js src/components/app/appConnectivityNoticeState.test.js src/components/app/AppConnectivityNotice.test.jsx src/components/universe/runtimeConnectivityState.test.js src/components/universe/WorkspaceSidebar.connectivity.test.jsx src/components/universe/QuickGridOverlay.civilizations.test.jsx src/components/universe/QuickGridOverlay.minerals.test.jsx`

Next implementation slice:
1. `RSV2-4A`: normalization hot-path split and lightweight performance budget helper, covered by focused tests only

## 12. RSV2-4 closure evidence

Implemented slices:
1. `RSV2-4A` snapshot normalization split into small slice helpers instead of one all-in-one branch in `dataverseApi`.
2. `RSV2-4A` lightweight snapshot normalization budget classifier added for heavy payload detection.
3. `RSV2-4B` heavy snapshot normalization signal added to runtime sync path as operator-readable perf hint.
4. `RSV2-4B` heavy normalization signal deduped inside runtime sync to avoid repetitive noise.

Evidence:
1. `npm --prefix frontend run format:check` -> green
2. `npm --prefix frontend run test -- src/lib/snapshotNormalization.test.js src/lib/snapshotNormalizationBudget.test.js src/lib/dataverseApi.test.js` -> `30 passed`
3. `npm --prefix frontend run test -- src/components/universe/runtimeNormalizationSignal.test.js src/lib/snapshotNormalizationBudget.test.js src/components/universe/useUniverseRuntimeSync.test.js src/components/universe/runtimeSyncUtils.test.js` -> `15 passed`

Closed outcomes:
1. normalization hot path is now split into smaller helpers and ready for future worker/off-main-thread migration
2. heavy snapshot payloads have an explicit budget classifier instead of implicit guesswork
3. runtime sync can surface operator-readable heavy normalization signals without widening global state

Recommended bundled focused regression for full RSV2 closure:
1. `npm --prefix frontend run format:check`
2. `npm --prefix frontend run test -- src/context/AuthContext.test.jsx src/hooks/useGalaxyGate.test.js src/hooks/useConnectivityState.test.js src/components/app/appConnectivityNoticeState.test.js src/components/app/AppConnectivityNotice.test.jsx src/components/universe/runtimeConnectivityState.test.js src/components/universe/WorkspaceSidebar.connectivity.test.jsx src/components/universe/QuickGridOverlay.civilizations.test.jsx src/components/universe/QuickGridOverlay.minerals.test.jsx src/lib/snapshotNormalization.test.js src/lib/snapshotNormalizationBudget.test.js src/lib/dataverseApi.test.js src/components/universe/runtimeNormalizationSignal.test.js src/components/universe/useUniverseRuntimeSync.test.js src/components/universe/runtimeSyncUtils.test.js src/components/universe/workflowEventBridge.test.js`

Bundled long-gate closure evidence:
1. `npm --prefix frontend run test:e2e:workspace-starlock` -> `1 passed`
2. `npm --prefix frontend run test:e2e:planet-civilization-mineral-workflow` -> `1 passed`
3. `npm --prefix frontend run test:e2e -- e2e/staging/planet-civilization-lf.matrix.placeholder.spec.mjs` -> `1 passed`
4. `npm --prefix frontend run test:e2e:planet-moon-preview` -> `1 passed`
5. `npm --prefix frontend run test -- src/components/universe/QuickGridOverlay.minerals.test.jsx src/components/universe/QuickGridOverlay.civilizations.test.jsx src/lib/archiveWorkflowGuard.test.js` -> `21 passed`
6. Closure source: `docs/contracts/p2-test-stability-report-2026-03-10.md`

Closed outcomes:
1. `RSV2-1..RSV2-4` are implementation-complete and backed by the bundled staging/unit rerun.
2. Runtime hardening closure is synchronized with the recorded FE stability evidence from 2026-03-10.
3. The next FE refactor entry point moves back to the UX rework roadmap, starting with Slice 9 `Promote Review Surface`.

Next implementation slice:
1. Slice 9 `Promote Review Surface` in `docs/contracts/ux-rework-blueprint-v1.md`
