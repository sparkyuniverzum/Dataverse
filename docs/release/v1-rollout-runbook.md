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
git tag -a v1.0.0 -m "DataVerse V1 release"
git push origin v1.0.0
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
