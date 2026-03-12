# DataVerse Backend Skeleton

FastAPI + PostgreSQL + Alembic kostra podle `DataVerse_Master_Plan.md`.

## 1. Rychlý start přes Docker

1. `cp .env.example .env`
2. `docker compose up --build`

Co se stane:

- spustí se PostgreSQL (`db`)
- proběhne migrace (`migrate`: `alembic upgrade head`)
- spustí se API (`api`) na `http://localhost:8000`

## 2. Spuštění migrací samostatně (Docker)

1. `docker compose up -d db`
2. `docker compose run --rm migrate`
3. `docker compose run --rm --entrypoint alembic migrate current` (ověření aktuální revize)

## 3. Lokální spuštění bez Dockeru

1. `./.venv/bin/pip install -r requirements.txt`
2. `export DATABASE_URL=postgresql+asyncpg://dataverse:dataverse@localhost:55432/dataverse`
3. `./.venv/bin/alembic upgrade head`
4. `./.venv/bin/uvicorn app.main:app --reload`

Pokud už máš na hostu obsazený port `55432`, změň `POSTGRES_PORT` v `.env`.

## 4. Makefile zkratky

- `make up` spustí vše v Dockeru
- `make migrate` spustí pouze migraci v Dockeru
- `make migrate-status` vypíše aktuální Alembic revizi v Dockeru
- `make migrate-check` provede `upgrade head` + `current` v Dockeru
- `make migrate-local` spustí migraci lokálně
- `make run-local` spustí API lokálně
- `make wait-api` čeká na dostupnost API (`/openapi.json`)

## 5. Poznámka k mazání dat

V souladu s Master Planem jsou `HARD DELETE` operace blokované DB triggery (`prevent_hard_delete`).

## 6. ParserService (atomické tasky)

Endpoint: `POST /parser/execute`

Request:

```json
{"text":"Pavel Novák : Zaměstnanec"}
```

Parser kontrakt:

- akceptuje `query` nebo `text`
- pokud pošleš obě hodnoty, musí být shodné
- jinak endpoint vrátí `422`

Parser vrací seznam `tasks` (`INGEST`, `LINK`, `SELECT`, `EXTINGUISH`) a ty jsou provedeny přes `TaskExecutorService` (event-store write path) v jedné DB transakci.

Při chybě se transakce rollbackne (nic se trvale nezapíše).

### Frontend rollout flags (parser-only)

Ve frontendu lze postupne vypinat fallback endpointy po akcich:

- `VITE_PARSER_ONLY_LINK=true`
- `VITE_PARSER_ONLY_INGEST=true`
- `VITE_PARSER_ONLY_EXTINGUISH=true`

Pokud je flag zapnuty, akce selze primo na parser chybe (bez fallbacku). Pokud je vypnuty, zustava rezim parser-first + fallback.

Staging default:

- pri buildu v `MODE=staging` je automaticky zapnuty pouze `LINK` parser-only
- `INGEST` a `EXTINGUISH` zustavaji parser-first + fallback
- explicitni `VITE_PARSER_ONLY_*` ma vzdy prednost pred defaultem

## 7. Universe Snapshot (3D frontend)

Endpoint: `GET /universe/snapshot`

Vrací aktuální aktivní vesmír:

- pouze `atoms` s `is_deleted = false`
- pouze `bonds` s `is_deleted = false` (a s aktivními endpoint atomy)

Time Machine:

- endpoint přijímá volitelný query parametr `as_of` (`datetime`)
- při `as_of` vrací vesmír tak, jak existoval v čase T:
  - `created_at <= as_of`
  - `deleted_at IS NULL` nebo `deleted_at > as_of`
  - stejné časové pravidlo platí pro bond i oba jeho atomy

Frontend:

- overlay obsahuje Time Machine input (`datetime-local`)
- při výběru času se snapshot načte přes `GET /universe/snapshot?as_of=...`
- v historickém módu je Command Bar uzamčen (EXECUTE disabled)
- tlačítko `Zpet do soucasnosti` vrátí live režim

## 8. Testy

Backend:

1. `./.venv/bin/pip install -r requirements-dev.txt`
2. Unit testy: `./.venv/bin/pytest -q tests/test_parser_service.py tests/test_calc_service.py`
3. Integrační testy: `./.venv/bin/pytest -q tests/test_api_integration.py`

Frontend (unit testy helper logiky):

1. `cd frontend`
2. `npm ci`
3. `npm test`
4. `npm run lint`
5. `npm run format:check`

Frontend format/lint stack:

- `npm run lint` (ESLint)
- `npm run lint:fix` (ESLint autofix)
- `npm run format` (Prettier write)
- `npm run format:check` (Prettier check)

Makefile shortcut:

- `make test-backend-unit`
- `make test-backend-integration`
- `make test-backend`
- `make test-frontend`
- `make test-contracts`
- `make test`
- `make staging-parser-rollout-smoke` (overi staging rollout parser-only rezimu)
- `make parser-full-smoke` (v1+v2 parser unit/contract + parser API integration subset)

Ops smoke (docker + migrace + API + contract/reliability subset):

- `make ops-smoke`

Release hardening gate:

- `make v1-release-gate`
- `make v1-release-full`

Backend quality gate (parser-level rigor):

- `make be-gate` (quick, local pre-commit)
- `make be-gate-strict` (includes full API integration suite)
- runbook: `docs/P0-core/release/backend-quality-gate.md`

Python format/lint stack (Ruff + pre-commit):

- `make fmt-py` (auto-fix lint + format)
- `make quality-py` (format check + lint check)
- `make precommit-install` (install git hooks)
- `make precommit-run` (run all hooks manually)

Direct commands:

- `./.venv/bin/ruff check --fix .`
- `./.venv/bin/ruff format .`
- `./.venv/bin/ruff format --check .`
- `./.venv/bin/ruff check .`

## 9. CI

Repo obsahuje workflow:

- `.github/workflows/ci.yml`

Pipeline běží:

- backend: migrace + unit + integrační smoke
- backend style gate: `ruff format --check` + `ruff check`
- frontend style gate: `eslint` + `prettier --check`
- frontend: test + build

## 10. Agent/CLI workflow setup

Pro efektivni lokalni FE/BE+e2e smycku pouzij:

1. `./scripts/dev_agent_setup.sh --apply`
2. `source ~/.bashrc`
3. `./scripts/dev_fast_check.sh unit` (rychly FE gate)
4. `./scripts/dev_fast_check.sh staging` (staging smoke sada)

Detaily a slash-command workflow:

- `docs/P1-exec/README.md`
- `docs/P1-exec/plans/documentation-purpose-priority-map-2026-03-11.md`
