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
- `docs/P0-core/release/planet-civilization-operations-canonical-v1.md`

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

## 11. Runtime Hardening Ops Note (PRH-3/PRH-4 closeout, 2026-03-10)

### 11.1 Graceful shutdown
Runtime při shutdownu dělá:
1. stop intake (nové requesty dostanou `503 SERVICE_SHUTTING_DOWN`)
2. drain in-flight task executoru
3. one-shot outbox flush
4. dispose DB poolů

Operátor kontroluje:
1. že během restartu nejsou dlouhé visící requesty
2. že po startu je API dostupné a outbox status je `ready/idle` bez chyb

### 11.2 Outbox operator flow
Run-once endpoint:
1. `POST /star-core/outbox/run-once`
2. sleduj `state`, `run_count`, `published/failed/dead_lettered`

Status endpoint:
1. `GET /star-core/outbox/status`
2. při incidentu zkontroluj poslední summary a rozhodni:
   - repeat run-once
   - investigate dead-letter queue

### 11.3 Tracing / correlation
Runtime propaguje:
1. `X-Trace-Id`
2. `X-Correlation-Id`

Zdroj trace ID:
1. `x-trace-id` / `x-request-id`
2. fallback `traceparent`
3. fallback interní generated id

Pro log korelaci:
1. hledej `trace_id` + `correlation_id` v JSON logu
2. outbox/operator/runner logy musí nést stejné hodnoty v rámci jednoho runu

OTel environment matrix (aktuální stack):

| `DATAVERSE_OTEL_ENABLED` | OTel SDK installed | Runtime behavior |
| --- | --- | --- |
| `0` / `false` / unset | n/a | OTel bootstrap disabled, request trace/correlation continues via middleware + JSON logs |
| `1` / `true` | `no` | Safe fallback: app logs `OpenTelemetry disabled: sdk/api not installed.` and continues |
| `1` / `true` | `yes` | Tracer provider is configured (`service.name=dataverse-api`) and spans can be attached |

Exporter strategy:
1. Current app bootstrap configures tracer provider only (no in-app exporter wiring).
2. Deployment may attach exporter via environment/instrumentation layer; if missing, fallback mode remains operational.
3. Operational minimum is preserved by mandatory `trace_id/correlation_id` propagation in headers + JSON logs.

Operator quick check:
1. start API with `DATAVERSE_OTEL_ENABLED=1`
2. verify startup log:
   - either `OpenTelemetry tracer provider configured.`
   - or fallback `OpenTelemetry disabled: sdk/api not installed.`
3. call one runtime endpoint and verify `X-Trace-Id` + `X-Correlation-Id` response headers

### 11.4 DB read/write routing
Pravidlo:
1. read-heavy GET endpointy používají read session
2. mutace (POST/PATCH/DELETE) používají write session

Operátor při incidentu replik:
1. dočasně přepni na single-DB mode (`DATABASE_READ_URL` unset)
2. ověř základní gate:
   - `pytest -q tests/test_db_router.py tests/test_db_read_write_routing_wiring.py`
