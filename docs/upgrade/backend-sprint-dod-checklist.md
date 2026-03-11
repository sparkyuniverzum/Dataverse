# Backend Sprint DoD Checklist

Date: 2026-03-03
Owner: BE sprint
Status legend: `[ ] not done` / `[x] done`

## Verification snapshot (aktualni stav)
- `PYTHONPATH=. pytest -q tests/test_parser2_lexer.py tests/test_parser2_ast.py tests/test_parser2_planner.py tests/test_parser2_bridge.py` -> `51 passed`
- `PYTHONPATH=. pytest -q tests/test_task_executor_service_stage2.py` -> `9 passed`
- `PYTHONPATH=. pytest -q tests/test_galaxy_scope_service.py tests/test_auth_service.py` -> `6 passed`
- `PYTHONPATH=. pytest -q tests/test_calc_engine_service.py tests/test_physics_engine_service.py tests/test_universe_projection_errors.py` -> `9 passed`
- `PYTHONPATH=. pytest -q tests/test_io_service_error_model.py` -> `4 passed`
- `DATAVERSE_API_BASE=http://127.0.0.1:8000 PYTHONPATH=. pytest -q tests/test_api_integration.py` -> `64 passed`
- `DATAVERSE_API_BASE=http://127.0.0.1:8000 PYTHONPATH=. pytest -q tests/test_parser2_lexer.py tests/test_parser2_ast.py tests/test_parser2_planner.py tests/test_parser2_bridge.py tests/test_task_executor_service_stage2.py tests/test_io_service_error_model.py tests/test_calc_engine_service.py tests/test_physics_engine_service.py tests/test_universe_projection_errors.py tests/test_api_integration.py tests/test_galaxy_scope_service.py tests/test_auth_service.py tests/test_read_model_projector.py` -> `146 passed, 1 warning`
- Executor preload benchmark (`_load_initial_context_state`, UPDATE_ASTEROID, partial scope, reps=20): p50 `1.644ms` (size=1), `1.705ms` (size=101), `1.670ms` (size=301)
- Endpoint benchmark (`PATCH /asteroids/{id}/mutate`, reps=30): p50 `13.21ms` (size=1), `15.39ms` (size=101), `12.52ms` (size=301)
- `rg -n "HTTP_422_UNPROCESSABLE_ENTITY" app tests` -> `no matches`

## 1) Funkcni scope

### 1.1 Parser2 pipeline je bez regrese
- [x] `lexer -> ast -> planner -> bridge` produkuje validni `AtomicTask` pro podporovane prikazy.
- [x] Neobjevuje se regresni chovani v canonical parser testech.
- [x] Osetreni chyb parseru vraci stabilni a citelny error model.

Overeni:
- `PYTHONPATH=. pytest -q tests/test_parser2_lexer.py tests/test_parser2_ast.py tests/test_parser2_planner.py tests/test_parser2_bridge.py`

Evidence:
- Test run ID / log:
- Datum:
- Reviewer:

### 1.2 Task Executor je atomicky, deterministicky, idempotentni
- [x] Batch se provede transakcne (all-or-nothing).
- [x] Pri stejnych vstupech nevznikaji divergentni vysledky.
- [x] OCC guard (`expected_event_seq`) je vynuceny na write operacich.

Overeni:
- `PYTHONPATH=. pytest -q tests/test_task_executor_service_stage2.py`
- `PYTHONPATH=. pytest -q tests/test_api_integration.py -k \"expected_event_seq or execute_tasks_rollback\"`

Evidence:
- Test run ID / log:
- Datum:
- Reviewer:

### 1.3 Table contracts jsou plne vynuceny
- [x] `required_fields` blokuje chybejici povinna pole.
- [x] `field_types` validuje typy.
- [x] `validators` vraci contract violation pro neplatne hodnoty.
- [x] `unique_rules` funguje konzistentne i pri partial preloadu (s fallback hydrataci).

Overeni:
- `PYTHONPATH=. pytest -q tests/test_api_integration.py -k \"table_contract\"`

Evidence:
- Test run ID / log:
- Datum:
- Reviewer:

### 1.4 Calc/Physics read-path parita je zachovana
- [x] Main timeline snapshot (`branch_id=None`, `as_of=None`) bere vypocty z `calc_state_rm` a fyziku z `physics_state_rm`.
- [x] Pri neuplnem RM coverage existuje funkcni fallback bez rozpadu API.
- [x] Branch/as_of timeline zustava kompatibilni (event replay path).

Overeni:
- `PYTHONPATH=. pytest -q tests/test_calc_engine_service.py tests/test_physics_engine_service.py tests/test_universe_projection_errors.py`
- `PYTHONPATH=. pytest -q tests/test_api_integration.py -k \"snapshot and calc\"`

Evidence:
- Test run ID / log:
- Datum:
- Reviewer:

### 1.5 Hard delete se nikde nepouziva
- [x] Mazani asteroidu a bonds probiha pouze jako soft delete event.
- [x] Read model nepusti smazane entity do aktivniho snapshotu.

Overeni:
- `PYTHONPATH=. pytest -q tests/test_api_integration.py -k \"extinguish or delete\"`

Evidence:
- Test run ID / log:
- Datum:
- Reviewer:

## 2) Vykon a skalovani

### 2.1 Partial preload je vychozi pro ID-only batch
- [x] Executor nepouziva full preload pro UUID-targeted akce.
- [x] Pokryte akce: `LINK`, `UPDATE_ASTEROID`, `UPDATE_BOND`, `EXTINGUISH_BOND`, `SET_FORMULA`, `ADD_GUARDIAN`, explicit `DELETE/EXTINGUISH`, ingest-only batch.
- [x] Full preload zustava jen pro fuzzy/selectory a branch timeline.

Overeni:
- `PYTHONPATH=. pytest -q tests/test_task_executor_service_stage2.py`

Evidence:
- Test run ID / log:
- Datum:
- Reviewer:

### 2.2 Unique rules fallback neporusi korektnost
- [x] Pri `unique_rules` se partial kontext hydratuje na full scope pred validaci.
- [x] Bez `unique_rules` se full hydration zbytecne nepouziva.

Overeni:
- `PYTHONPATH=. pytest -q tests/test_api_integration.py -k \"table_contract\"`

Evidence:
- Test run ID / log:
- Datum:
- Reviewer:

### 2.3 Latence write pathu je stabilni
- [x] ID-only batch latence neroste linearne s velikosti galaxie.
- [x] Nebyl zaveden novy O(N) preload krok na kriticke ceste.

Overeni:
- `PYTHONPATH=. pytest -q tests/test_task_executor_service_stage2.py`
- Profiling/bench log (manual):

Evidence:
- Benchmark report:
  - `_load_initial_context_state` (executor preload): p50 ~`1.6-1.7ms` pro velikosti galaxie `1 -> 301`
  - `PATCH /asteroids/{id}/mutate` (end-to-end): p50 ~`13-15ms` pro velikosti galaxie `1 -> 301`
- Datum:
- Reviewer:

## 3) Konzistence a konkurence

### 3.1 OCC ochrany jsou konzistentni
- [x] `expected_event_seq` vraci konflikt pri stale write.
- [x] OCC je aplikovano na asteroid i bond write operace.

Overeni:
- `PYTHONPATH=. pytest -q tests/test_api_integration.py -k \"expected_event_seq\"`

Evidence:
- Test run ID / log:
- Datum:
- Reviewer:

### 3.2 Event log a read model zustavaji konzistentni
- [x] Po uspechu batch write jsou zmeny reflektovane ve snapshotu.
- [x] Pri rollback scenari write nevznikne parcialni stav.

Overeni:
- `PYTHONPATH=. pytest -q tests/test_api_integration.py -k \"execute_tasks_rollback or snapshot\"`

Evidence:
- Test run ID / log:
- Datum:
- Reviewer:

## 4) API a chybovy model

### 4.1 Import/CSV vraci typovane row-level chyby
- [x] Chyby jsou klasifikovane (`ROW_INPUT_INVALID`, `ROW_CONTRACT_VIOLATION`, apod.).
- [x] Strict/lenient rezim ma predvidatelne chovani.

Overeni:
- `PYTHONPATH=. pytest -q tests/test_api_integration.py -k \"csv_import\"`

Evidence:
- Test run ID / log:
- Datum:
- Reviewer:

### 4.2 422 status je sjednoceny
- [x] V app/tests neni pouzivan deprecated `HTTP_422_UNPROCESSABLE_ENTITY`.

Overeni:
- `rg -n \"HTTP_422_UNPROCESSABLE_ENTITY\" app tests`

Evidence:
- Command output:
- Datum:
- Reviewer:

### 4.3 API response shape je stabilni
- [x] Snapshot/contracts/task endpointy drzi kompatibilni payload.
- [x] Refaktor nevyvolal breaking zmenu bez migracniho planu.

Overeni:
- `PYTHONPATH=. pytest -q tests/test_api_integration.py`

Evidence:
- Test run ID / log:
- Datum:
- Reviewer:

## 5) Architektura a servisni parita

### 5.1 Galaxy scope resolver je sjednoceny
- [x] Auth + Cosmos pouzivaji jeden sdileny resolver.
- [x] Access policy nema duplikovanou implementaci.

Overeni:
- `PYTHONPATH=. pytest -q tests/test_galaxy_scope_service.py tests/test_auth_service.py`

Evidence:
- Test run ID / log:
- Datum:
- Reviewer:

### 5.2 Parser neni brzden slabsi sluzbou
- [x] Task executor, Universe, Import, Auth/Cosmos jsou na kompatibilni technicke urovni.
- [x] Audit ma zapsane hlavni mezery a navazne stage.

Overeni:
- Kontrola auditu: `docs/upgrade/service-maturity-matrix-v1.md`

Evidence:
- Reviewer note:
- Datum:
- Reviewer:

## 6) Testy (quality gate)

### 6.1 Cileny regresni balicek je zeleny
- [x] Parser, executor, IO error model, calc/physics, universe errors, API integrace jsou green.

Overeni:
- `PYTHONPATH=. pytest -q tests/test_parser2_lexer.py tests/test_parser2_ast.py tests/test_parser2_planner.py tests/test_parser2_bridge.py tests/test_task_executor_service_stage2.py tests/test_io_service_error_model.py tests/test_calc_engine_service.py tests/test_physics_engine_service.py tests/test_universe_projection_errors.py tests/test_api_integration.py tests/test_galaxy_scope_service.py tests/test_auth_service.py`

Evidence:
- Test run ID / log:
- Datum:
- Reviewer:

### 6.2 Nove testy kryji nove rizikove body
- [x] Partial preload planner ma testy.
- [x] Lazy lookup pro ingest ma test.
- [x] Contract/CSV klasifikace ma testy.

Overeni:
- `PYTHONPATH=. pytest -q tests/test_task_executor_service_stage2.py tests/test_api_integration.py -k \"table_contract or csv_import\"`

Evidence:
- Test run ID / log:
- Datum:
- Reviewer:

## 7) Dokumentace a handover

### 7.1 Sprint dokumentace je aktualni
- [x] Audit obsahuje stav stage a rozhodnuti.
- [x] DoD checklist je kompletni a pouzitelny pro sign-off.

Overeni:
- Kontrola souboru: `docs/upgrade/service-maturity-matrix-v1.md`
- Kontrola souboru: `docs/upgrade/backend-sprint-dod-checklist.md`

Evidence:
- Reviewer note:
- Datum:
- Reviewer:

### 7.2 Otevrene body jsou transparentni
- [x] Zbyvajici scope je explicitne popsany (co je hotove vs. co jde do dalsiho sprintu).
- [x] Rizika a predpoklady jsou zapsane.

Overeni:
- Audit section: findings/backlog/open items

Evidence:
- Reviewer note:
- Datum:
- Reviewer:

## 8) Release readiness

### 8.1 Worktree a commit pripravenost
- [x] Refaktor zmen je zkontrolovany po souborech.
- [x] Nejsou nechtane side-effect zmeny mimo sprint scope.

Overeni:
- `git status --short`
- `git diff --stat`

Evidence:
- Command output:
- Datum:
- Reviewer:

### 8.2 Nasaditelnost bez workaroundu
- [x] API startuje a hlavni endpointy odpovidaji.
- [x] Neni potreba rucni hotfix po deploy.

Overeni:
- Smoke run (lokal/CI):
- `/health`, `/universe/snapshot`, write smoke endpoint

Evidence:
- Smoke log:
- Datum:
- Reviewer:
