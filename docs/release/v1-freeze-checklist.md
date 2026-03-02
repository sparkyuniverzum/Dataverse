# DataVerse V1 Freeze Checklist

Date: 2026-02-28  
Owner: Core Architecture

## Scope freeze
- [x] API contracts are frozen and reviewed:
  - `docs/contracts/api-v1.md`
  - `docs/contracts/parser-v1.md`
  - `docs/contracts/table-contract-v1.md`
- [x] Upgrade roadmap reflects implemented state:
  - `docs/upgrade/v1.md`
- [x] No new features are merged after freeze start.

## Backend readiness
- [x] `make migrate-check` passes.
- [x] `make test-backend-unit` passes.
- [x] `make test-contracts` passes.
- [x] `make test-backend-integration` passes.
- [x] Multi-tenant isolation still enforced (`403` on foreign galaxy).
- [x] No hard delete pattern introduced (`DELETE FROM`, `session.delete`).

## Frontend readiness
- [x] `cd frontend && npm ci && npm test` passes.
- [x] `cd frontend && npm run build` passes.
- [x] Command bar modes show deterministic readiness before execute.
- [x] Time machine lock still blocks writes in historical mode.
- [x] Default camera shows full active universe after load.

## Ops readiness
- [x] `.env.example` is up to date.
- [x] `scripts/wait_for_http.sh` works against local API.
- [x] `make ops-smoke` passes.
- [x] CI-equivalent local gate passed (`make v1-release-full`) and workflow config exists (`.github/workflows/ci.yml`).

## Release evidence
- [x] Attach command outputs for:
  - `make v1-release-gate`
  - `make v1-release-full`
- [x] Record release tag and commit SHA.
- [x] Archive runbook used for rollout.

## Post-release exit criteria
- [x] API health endpoint reachable.
- [x] Snapshot and tables endpoints respond for active galaxy.
- [x] Parser execute path works for local focus and API commands.
- [x] No critical regressions in first smoke session.

## Recorded artifacts
- Release tag: `v1.0.1`
- Release SHA: `89f4f17`
- Gate executed: `make v1-release-full` (2026-03-02)
