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
