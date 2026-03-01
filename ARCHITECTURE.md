# DataVerse Architecture

Aktualizace: 2026-02-28  
Stav dokumentu: odpovídá aktuální implementaci v repozitáři.

## 1. Cíl systému

DataVerse je grafově orientovaný datový systém, který nahrazuje tabulkový mindset:

- `Asteroid` = datová entita (dříve atom).
- `Bond` = vazba mezi entitami.
- `Galaxy` = tenant/workspace uživatele.
- Zdroj pravdy je neměnný event log (`events`), nikoliv přímý mutable stav.

## 2. Neměnné zákony

1. `HARD DELETE` je zakázán.
2. Odstraňování se děje pouze soft-delete událostmi (`ASTEROID_SOFT_DELETED`, `BOND_SOFT_DELETED`) nebo `deleted_at` u user/galaxy.
3. Snapshot je projekce nad event logem, ne primární zapisovatelný model.
4. Všechny zápisy parser tasků běží atomicky v jedné DB transakci.

## 3. Runtime topologie

- Frontend: React + React Three Fiber (`frontend/`)
- Backend API: FastAPI (`app/main.py`)
- DB: PostgreSQL 16
- Migrace: Alembic (`alembic/`)
- Orchestrace: Docker Compose (`db`, `migrate`, `api`)

## 4. Datový model

### Primární tabulky

- `users`
  - `id`, `email`, `hashed_password`, `created_at`, `is_active`, `deleted_at`
- `galaxies`
  - `id`, `name`, `owner_id`, `created_at`, `deleted_at`
- `events` (immutable event store)
  - `id`, `user_id`, `galaxy_id`, `entity_id`, `event_type`, `payload` (JSONB), `timestamp`

### Legacy/read-model tabulky

- `atoms`, `bonds` jsou v modelu stále přítomné kvůli kompatibilitě, ale aktivní zápisový tok běží přes `events`.

### Ochrana proti hard delete

- DB triggery (`prevent_hard_delete`) jsou zavedené pro historické tabulky + event-store tabulky, takže fyzický `DELETE` je blokovaný i na DB vrstvě.

## 5. Event Sourcing

### Event typy používané executorem

- `ASTEROID_CREATED`
- `METADATA_UPDATED`
- `BOND_FORMED`
- `ASTEROID_SOFT_DELETED`
- `BOND_SOFT_DELETED`

### Zápisový tok

1. API přijme command (nebo explicitní endpoint ingest/link/extinguish).
2. Parser vytvoří `AtomicTask[]`.
3. `TaskExecutorService` zpracuje tasky sekvenčně.
4. Každá změna je append do `events` přes `EventStoreService.append_event(...)`.
5. Žádné přímé `INSERT/UPDATE/DELETE` do asteroid read-modelu.

### Čtecí tok (projekce)

`UniverseService.project_state(...)`:

1. Ověří přístup uživatele k galaxii.
2. Načte eventy `ORDER BY timestamp,id` (volitelně `as_of`).
3. Složí aktuální stav asteroidů a bondů aplikací eventů.
4. Filtruje soft-deleted entity.
5. Nad aktivním stavem provede:
   - `calc_service.evaluate_universe(...)`
   - `guardian_service.evaluate_guardians(...)`
6. Vrátí snapshot pro frontend.

## 6. Parser a task model

Parser (`app/services/parser_service.py`) podporuje:

- Vytváření vazeb:
  - `A + B` -> `INGEST`, `INGEST`, `LINK(type=RELATION)`
  - `A : Typ` -> `INGEST`, `INGEST`, `LINK(type=TYPE)`
- Triple-shot:
  - `Ukaž : Cíl @ podmínka` -> `SELECT`
- Soft delete příkazy:
  - `Zhasni : X`, `Smaž : X`, `Delete : X` -> `DELETE`
- Vzorce:
  - `Spočítej : Projekt.celkem = SUM(cena)` -> `SET_FORMULA`
- Guardiany:
  - `Hlídej : Projekt.celkem > 1000 -> pulse` -> `ADD_GUARDIAN`
- Human-friendly metadata:
  - `Firma (obor: IT, score=9)`

Executor (`app/services/task_executor_service.py`) řeší:

- idempotent ingest dle hodnoty,
- linkování mezi context asteroidy nebo explicitními ID,
- metadata update přes event `METADATA_UPDATED`,
- soft delete asteroidu + automatické soft delete navázaných bondů.

## 7. Výpočetní engine

`app/services/calc_service.py`:

- Rekurzivní vyhodnocení formulek `=SUM/AVG/MIN/MAX/COUNT(field)`.
- Prochází graf přes adjacency list bondů.
- Detekce cyklu přes `visited_set` -> `#CIRC!`.
- Memoizace výsledků pro výkon.
- Výpočet je pouze in-memory nad snapshotem (DB zůstává beze změn).

## 8. Guardian engine

`app/services/guardian_service.py`:

- Čte pravidla z `metadata._guardians`.
- Podporované operátory: `>`, `<`, `==`, `>=`, `<=`.
- Porovnává proti `calculated_values`.
- Zapisuje aktivní vizuální signály do `active_alerts` (např. `color_red`, `pulse`, `hide`) pro frontend.

## 9. API surface (aktuální)

### Auth

- `POST /auth/register`
- `POST /auth/login`
- `GET /auth/me`
- `PATCH /auth/me/extinguish`

### Galaxies

- `GET /galaxies`
- `POST /galaxies`
- `PATCH /galaxies/{galaxy_id}/extinguish`

### Domain write

- `POST /asteroids/ingest`
- `PATCH /asteroids/{asteroid_id}/extinguish`
- `POST /bonds/link`
- `POST /parser/execute`

### Domain read

- `GET /universe/snapshot?galaxy_id=&as_of=`
- `GET /universe/tables?galaxy_id=&as_of=`

## 10. Multi-tenancy a security

- JWT (`python-jose`) v `Authorization: Bearer <token>`.
- Hesla hashována přes `passlib[bcrypt]`.
- Každý event nese `user_id` + `galaxy_id`.
- Snapshot i execute jsou striktně scopeované na přihlášeného uživatele.
- Přístup do cizí galaxie vrací `403`.

## 11. Frontend architektura

### Moduly

- `frontend/src/context/AuthContext.jsx`
  - login/register/logout, token persistence, `/auth/me` validace, unauthorized handling.
- `frontend/src/lib/dataverseApi.js`
  - API helpery, auth injection, URL builders pro snapshot/tables.
- `frontend/src/lib/layout_service.js`
  - sektorový layout kategorií s anti-overlap pravidly.
- `frontend/src/App.jsx`
  - 3D scéna, command center, smart asistence, flow audit, time machine, galaxy selector.

### 3D a UX principy

- R3F + Drei + postprocessing bloom.
- Force simulation (`d3-force-3d`) + sektorová stabilizace layoutem.
- Audit mode/highlight flow, tooltipy, holografický detail panel.
- Historický mód (`as_of`) je read-only (command execution je blokován v UI).

## 12. Transakce a konzistence

- API používá `transactional_context(session)`:
  - `session.begin()` pokud není transakce aktivní,
  - `session.begin_nested()` pokud už aktivní je.
- `TaskExecutorService.execute_tasks(..., manage_transaction=False)` očekává aktivní transakci z API vrstvy.
- Cíl: celé zpracování parser commandu je atomické.

## 13. Build, migrace, testy

- Docker:
  - `db` -> PostgreSQL
  - `migrate` -> `alembic upgrade head`
  - `api` -> uvicorn
- Alembic revize:
  - `20260227_0001_init_atoms_bonds`
  - `20260228_0002_event_store`
  - `20260228_0003_multi_tenancy_auth`
- Backend testy:
  - parser, calc, guardian, integrační API
- Frontend testy:
  - API helper + layout service

## 14. Důležité poznámky pro další vývoj

1. Nové write use-casy implementovat jako nové event typy + projektor v `UniverseService`, ne přímým update tabulek.
2. Zachovat soft-delete invariant i při nových entitách (účty, galaxie, asteroidy, bondy).
3. Udržovat kompatibilitu snapshot kontraktů (`/universe/snapshot`, `/universe/tables`) kvůli 3D klientovi.
