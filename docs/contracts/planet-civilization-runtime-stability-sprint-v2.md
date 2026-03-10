# Planet/Civilization Runtime Stability Sprint v2

Status: active
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
   - `npm --prefix frontend run test -- src/context/AuthContext.test.jsx src/lib/useGalaxyGate.test.js`
2. `RSV2-2`
   - `npm --prefix frontend run test -- src/lib/useUniverseRuntimeSync.test.js src/components/universe/workflowEventBridge.test.js`
3. `RSV2-3`
   - `npm --prefix frontend run test -- src/context/AuthContext.test.jsx src/components/universe/QuickGridOverlay.civilizations.test.jsx`
4. `RSV2-4`
   - `npm --prefix frontend run test -- src/components/universe/scene/physicsSystem.test.js src/components/universe/scene/performanceBudget.test.js`

Bundled long gates (after multi-block bundle, not per block):
1. `npm --prefix frontend run test:e2e:workspace-starlock`
2. `npm --prefix frontend run test:e2e:planet-civilization-mineral-workflow`
3. `npm --prefix frontend run test:e2e -- e2e/staging/planet-civilization-lf.matrix.placeholder.spec.mjs`
4. `PYTHONPATH=. pytest -q tests/test_api_integration.py -rs`

## 7. Remaining open items

1. [ ] `RSV2-1` auth/session patch set merged with focused tests green.
2. [ ] `RSV2-2` stream delta + bounded dedupe merged with focused tests green.
3. [ ] `RSV2-3` offline continuity patch merged with focused tests green.
4. [ ] `RSV2-4` performance slice merged with focused tests green.
5. [ ] bundled long gates rerun green after `RSV2-1..RSV2-4`.
