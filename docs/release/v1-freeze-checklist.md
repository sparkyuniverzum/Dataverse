# DataVerse V1 Freeze Checklist

Date: 2026-02-28  
Owner: Core Architecture

## Scope freeze
- [ ] API contracts are frozen and reviewed:
  - `docs/contracts/api-v1.md`
  - `docs/contracts/parser-v1.md`
  - `docs/contracts/table-contract-v1.md`
- [ ] Upgrade roadmap reflects implemented state:
  - `docs/upgrade/v1.md`
- [ ] No new features are merged after freeze start.

## Backend readiness
- [ ] `make migrate-check` passes.
- [ ] `make test-backend-unit` passes.
- [ ] `make test-contracts` passes.
- [ ] `make test-backend-integration` passes.
- [ ] Multi-tenant isolation still enforced (`403` on foreign galaxy).
- [ ] No hard delete pattern introduced (`DELETE FROM`, `session.delete`).

## Frontend readiness
- [ ] `cd frontend && npm ci && npm test` passes.
- [ ] `cd frontend && npm run build` passes.
- [ ] Command bar modes show deterministic readiness before execute.
- [ ] Time machine lock still blocks writes in historical mode.
- [ ] Default camera shows full active universe after load.

## Ops readiness
- [ ] `.env.example` is up to date.
- [ ] `scripts/wait_for_http.sh` works against local API.
- [ ] `make ops-smoke` passes.
- [ ] CI workflow green (`.github/workflows/ci.yml`).

## Release evidence
- [ ] Attach command outputs for:
  - `make v1-release-gate`
  - `make v1-release-full`
- [ ] Record release tag and commit SHA.
- [ ] Archive runbook used for rollout.

## Post-release exit criteria
- [ ] API health endpoint reachable.
- [ ] Snapshot and tables endpoints respond for active galaxy.
- [ ] Parser execute path works for local focus and API commands.
- [ ] No critical regressions in first smoke session.
