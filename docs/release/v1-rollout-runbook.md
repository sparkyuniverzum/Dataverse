# DataVerse V1 Rollout Runbook

Date: 2026-02-28

## 1. Preconditions
- Release branch is frozen.
- `make v1-release-gate` passed.
- CI is green.

## 2. Build + migrate + start (Docker)
1. `cp .env.example .env`
2. `docker compose down -v`
3. `docker compose up -d --build api`
4. `make wait-api`
5. `make migrate-status`

Expected:
- API reachable on `http://127.0.0.1:8000/openapi.json`
- Alembic current points to head revision

## 3. Smoke validation
1. `make test-contracts`
2. `make ops-smoke`

Expected:
- Contract tests green
- Rollback/idempotence smoke green

## 4. Tagging
Use annotated tag after successful gate and smoke:

```bash
git tag -a v1.0.1 -m "DataVerse V1 release"
git push origin v1.0.1
```

## 5. Rollback strategy
If release validation fails:
1. Stop stack: `docker compose down`
2. Restore previous known-good image/tag.
3. Re-run migration status and smoke checks.
4. Keep event log intact (no data wipe in production rollback).

## 6. Operational checks after rollout
- `/openapi.json` reachable
- `/auth/login` and `/auth/me` working with JWT
- `/universe/snapshot` + `/universe/tables` return consistent table projection
- Parser commands:
  - `Ukaž : ...`
  - `Spočítej : ...`
  - `Hlídej : ...`
  - `Delete : ...`

## 7. Release closure
- Update changelog/release notes
- Link artifacts:
  - gate logs
  - CI run URL
  - tag SHA

## 8. Recorded V1 closeout
- Closeout date: 2026-03-02
- Gate: `make v1-release-full` passed
- Release tag: `v1.0.1`
- Release SHA: `89f4f17`

## 9. Logical flow feature-flag operations (2026-03-07)

For Planet/Civilization logical-flow rollout and rollback procedures, use:
- `docs/release/planet-civilization-feature-flag-rollout-v1.md`
- `docs/release/planet-civilization-logical-flow-rollback-v1.md`

Operational rule:
1. Execute phase promotions only after promotion-gate checks are green.
2. On incident, apply flag rollback first (before broader release rollback).

## 10. UI-WF-4 Operator Runbook Note (2026-03-10)

Scope:
- Planet + Civilization + Mineral + Moon runtime workflow in workspace UI.

Standard operator flow:
1. Login and wait for workspace readiness (`workspace root` or `stage0/setup` visible).
2. Open grid from sidebar (`Otevrit grid`) or complete Stage0 first-planet flow if grid is locked.
3. Create/select civilization row.
4. Apply mineral write from mineral composer (`Nerost/sloupec` + value + `Ulozit nerost`).
5. Apply lifecycle/archive action only from explicit civilization composer mode.
6. Confirm operation result in workflow feedback and workflow log.

Quick validation set (during active implementation):
1. `npm --prefix frontend run format:check`
2. `npm --prefix frontend run test -- src/lib/workspaceEntryGate.test.js src/lib/archiveWorkflowGuard.test.js`
3. `npm --prefix frontend run test -- src/components/universe/workflowEventBridge.test.js src/components/universe/QuickGridOverlay.civilizations.test.jsx`

Bundled staging gate (after multiple blocks):
1. `npm --prefix frontend run test:e2e:workspace-starlock`
2. `npm --prefix frontend run test:e2e:planet-civilization-mineral-workflow`
3. `npm --prefix frontend run test:e2e -- e2e/staging/planet-civilization-lf.matrix.placeholder.spec.mjs`
4. `npm --prefix frontend run test:e2e:planet-moon-preview`

Release hardening gate:
1. `pytest -q tests/test_api_integration.py`

Immediate triage:
1. If workspace entry hangs or black-screen appears:
   - inspect `frontend/test-results/*/trace.zip` and search for `pageerror`.
   - if `Cannot access ... before initialization` appears, treat as FE runtime crash and fix before retries.
2. If write feedback shows contract/lifecycle block:
   - capture exact feedback text from `quick-grid-write-feedback`.
   - verify selected row and composer mode; retry only after explicit state correction.
3. If e2e step timeout repeats:
   - inspect helper logic in `frontend/e2e/staging/workspace-flow.helpers.mjs` before increasing timeouts.
