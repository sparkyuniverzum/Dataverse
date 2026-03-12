# Backend MVP pokračování v1

Stav: splneno (BE MVP implementacni scope uzavren)
Datum: 2026-03-11 (založení), 2026-03-12 (formální uzavření)
Vlastník: Core BE architektura

## 1. Co se změnilo

- [x] 2026-03-11 Založen oficiální navazující plán BE po cleanup auditu.
- [x] 2026-03-11 Nastavena priorita P0-1: `asteroid naming cleanup`.
- [x] 2026-03-11 Přidán realizační checklist, DoD podmínky a sekce gate evidence.

## 2. Proč to vzniklo

Po porovnání backendu s `backend-mvp-requirements-from-canonical-ux-ontology-v1CZ.md` zůstaly konkrétní mezery:

1. interní terminologický dluh `asteroid*`,
2. nejednotné idempotency pokrytí mutačních endpointů,
3. parser fallback politika a branch lifecycle dočištění.

Nejvyšší priorita je terminologická čistota runtime kódu, aby ontologie byla konzistentní napříč BE vrstvami.

## 3. Prioritní pořadí implementace

1. `P0-1` Asteroid naming cleanup (nejvyšší priorita).
2. `P0-2` Idempotency hardening mutačních endpointů mimo atomic wrapper.
3. `P1-1` Parser fallback policy hardening (v2/v1 fallback governance).
4. `P1-2` Branch lifecycle closure (`close` semantics a explicitní surface).

## 4. P0-1 Asteroid naming cleanup (priorita 1)

## 4.1 Cíl

Odstranit interní `asteroid*` názvosloví z backend runtime kódu a nahradit ho kanonickou terminologií:

- `civilization` pro row entitu,
- `moon` pro capability kontext.

## 4.2 Rozsah

Primární scope:

1. `app/api/mappers/*`
2. `app/api/routers/universe.py`
3. `app/services/universe/*`
4. `app/services/task_executor/*`
5. `app/services/star_core_service.py`
6. další runtime moduly v `app/`, kde se `asteroid*` vyskytuje.

Sekundární scope:

1. související testy v `tests/`, pokud referencují přejmenované symboly,
2. interní log/telemetry klíče, pokud nesou `asteroid*` název.

## 4.3 Mimo scope

1. veřejné API změny (namespace zůstává dle kanonického kontraktu),
2. nový feature vývoj,
3. FE refaktor (mimo BE blok).

## 4.4 Realizační checklist

- [x] 2026-03-11 `P0-1.1` Přemapovat mapper názvy a pomocné funkce z `asteroid*` na `civilization*`.
- [x] 2026-03-11 `P0-1.2` Přemapovat lokální proměnné/collection názvy v `universe` projekci.
- [x] 2026-03-11 `P0-1.3` Přemapovat `task_executor` result field naming (`selected/extinguished_*`) na civilization terminologii.
- [x] 2026-03-11 `P0-1.4` Přemapovat star-core interní mapování domén bez `asteroid*` identifikátorů.
- [x] 2026-03-11 `P0-1.5` Ověřit a upravit související testy/importy po přejmenování.
- [x] 2026-03-11 `P0-1.6` Ověřit, že v `app/` nezůstaly runtime `asteroid*` tokeny (kromě explicitně povolených výjimek, pokud budou schváleny).

## 4.5 DoD podmínky (P0-1)

P0-1 je hotové pouze pokud platí vše:

1. V runtime BE kódu (`app/`) není aktivní `asteroid*` terminologie pro row entitu.
2. Žádná přejmenovací změna neporuší kanonické endpointy (`/civilizations*`, capability surface).
3. Integrace stále drží soft-delete/OCC/idempotency behavior beze změny semantics.
4. Cílené testy relevantní k přejmenovaným modulům projdou.
5. Evidence je zapsána v tomto dokumentu v části `Evidence gate`.

## 4.6 Evidence gate (P0-1)

Stav:

- [x] 2026-03-11 Gate splněno

Povinné ověřovací příkazy:

```bash
cd /mnt/c/Projekty/Dataverse
rg -n "\\basteroid\\b|\\basteroids\\b|ASTEROID" app
PYTHONPATH=. pytest -q tests/test_task_executor_service_stage2.py -rs
PYTHONPATH=. pytest -q tests/test_universe_projection_errors.py -rs
PYTHONPATH=. pytest -q tests/test_api_integration.py -k "civilization or moons or star_core" -rs
```

Kritérium splnění:

1. `rg` výstup pro runtime `app/` je prázdný, nebo obsahuje pouze předem schválené výjimky.
2. Cílené testy neobsahují nové regrese po přejmenování.

Evidence (doplnit po implementaci):

- [x] 2026-03-11 `P0-1.5`: `rg -n "asteroid_to_domain|civilization_to_domain|_build_entity_domain_maps|_resolve_event_domains" tests app -g"*.py"` neukázal žádný test/import odkazující na starý interní symbol po přejmenování.
- [x] 2026-03-11 `P0-1.6`: `rg -n "\\basteroid\\b|\\basteroids\\b|ASTEROID" app -g"*.py"` vrací prázdný výstup (bez výjimek).
- [x] 2026-03-11 `P0-1.1/P0-1.2/P0-1.3`: `rg -n "active_asteroids|ProjectedAsteroid|UniverseAsteroidSnapshot|selected_asteroids|target_asteroid|source_asteroid|UPDATE_ASTEROID" app tests -g"*.py"` vrací prázdný výstup.
- [x] 2026-03-11 Command output vložen / odkazován (`rg` čistý + cílené pytest sady: parser/task-batch/star-core/api green).
- [x] 2026-03-11 Datum a autor uzavření zapsán (uživatel + agent).

## 5. Navazující bloky (po P0-1)

## 5.1 P0-2 Idempotency hardening

- [x] 2026-03-11 `P0-2.1` Branch command surface (`create/promote/close`) sjednocen na `run_scoped_idempotent`.
- [x] 2026-03-11 `P0-2.2a` `POST /contracts/{table_id}` převeden na `run_scoped_idempotent`.
- [x] 2026-03-11 `P0-2.2b1` `PATCH /galaxies/{galaxy_id}/extinguish` převeden na `run_scoped_idempotent`.
- [x] 2026-03-11 `P0-2.2b2` `PATCH /galaxies/{galaxy_id}/onboarding` převeden na `run_scoped_idempotent`.
- [x] 2026-03-11 `P0-2.2b3` `POST /galaxies/{galaxy_id}/star-core/policy/lock` a `POST /galaxies/{galaxy_id}/star-core/physics/profile/migrate` převedeny na `run_scoped_idempotent`.
- [x] 2026-03-11 `P0-2.2c` `POST /io/imports`, `POST /galaxies`, `POST /star-core/outbox/run-once` převedeny na `run_scoped_idempotent`.
- [x] 2026-03-11 Sjednotit mutační endpointy na konzistentní scoped idempotency policy napříč runtime API vrstvou (`app/api/routers/*`).

Evidence (P0-2.1):

- [x] 2026-03-11 Branch create payload obsahuje `idempotency_key`.
- [x] 2026-03-11 Přidány API regrese:
  - `test_branch_create_replays_with_idempotency_key`
  - `test_branch_promote_replays_with_idempotency_key`
  - `test_branch_close_is_idempotent_and_hides_branch_scope` (s `idempotency_key`)
- [x] 2026-03-11 `ruff check app/api/routers/branches.py app/schema_models/branch_contracts.py tests/test_api_integration.py` -> `All checks passed!`
- [x] 2026-03-11 `python -m py_compile app/api/routers/branches.py app/schema_models/branch_contracts.py tests/test_api_integration.py` -> `OK`

Evidence (P0-2.2a):

- [x] 2026-03-11 `TableContractUpsertRequest` rozšířen o `idempotency_key`.
- [x] 2026-03-11 `POST /contracts/{table_id}` používá `run_scoped_idempotent` (`endpoint_key=POST:/contracts/{table_id}`).
- [x] 2026-03-11 Přidána API regrese `test_table_contract_upsert_replays_with_idempotency_key` (replay + payload mismatch guard).
- [x] 2026-03-11 `ruff check app/api/routers/contracts.py app/schema_models/branch_contracts.py tests/test_api_integration.py` -> `All checks passed!`
- [x] 2026-03-11 `python -m py_compile app/api/routers/contracts.py app/schema_models/branch_contracts.py tests/test_api_integration.py` -> `OK`

Evidence (P0-2.2b1/b2/b3):

- [x] 2026-03-11 `OnboardingUpdateRequest`, `StarCoreProfileApplyRequest`, `StarCorePhysicsProfileMigrateRequest` rozšířeny o `idempotency_key`.
- [x] 2026-03-11 Přidány API regrese:
  - `test_galaxy_extinguish_replays_with_idempotency_key`
  - `test_onboarding_update_replays_with_idempotency_key`
  - `test_star_core_policy_lock_replays_with_idempotency_key`
- [x] 2026-03-11 `ruff check app/api/routers/galaxies/core.py app/api/routers/galaxies/onboarding.py app/api/routers/galaxies/star_core.py app/schema_models/auth_onboarding.py app/schema_models/star_core.py tests/test_api_integration.py` -> `All checks passed!`
- [x] 2026-03-11 `python -m py_compile app/api/routers/galaxies/core.py app/api/routers/galaxies/onboarding.py app/api/routers/galaxies/star_core.py app/schema_models/auth_onboarding.py app/schema_models/star_core.py tests/test_api_integration.py` -> `OK`

Evidence (P0-2.2c):

- [x] 2026-03-11 `GalaxyCreateRequest`, `ImportRun` form input (`idempotency_key`) a `StarCoreOutboxRunOnceRequest` podporují idempotency replay.
- [x] 2026-03-11 Přidány API regrese:
  - `test_create_galaxy_replays_with_idempotency_key`
  - `test_io_import_commit_replays_with_idempotency_key`
  - `test_star_core_outbox_run_once_replays_with_idempotency_key`
- [x] 2026-03-11 `rg -n "transactional_context\\(" app/api/routers -g"*.py"` -> prázdný výstup (write cesty sjednocené přes scoped idempotency wrappery).
- [x] 2026-03-11 `ruff check app/api/routers/galaxies/core.py app/api/routers/io.py app/api/routers/galaxies/star_core.py app/schema_models/auth_onboarding.py app/schema_models/star_core.py tests/test_api_integration.py` -> `All checks passed!`
- [x] 2026-03-11 `python -m py_compile app/api/routers/galaxies/core.py app/api/routers/io.py app/api/routers/galaxies/star_core.py app/schema_models/auth_onboarding.py app/schema_models/star_core.py tests/test_api_integration.py` -> `OK`

## 5.2 P1-1 Parser fallback policy

- [x] 2026-03-11 Zpřesnit fallback governance (`v2 -> v1`) a explicitní policy režimy.
- [x] 2026-03-11 Zachovat auditovatelný log důvod fallbacku.

Evidence:

- [x] 2026-03-11 Implementovány explicitní režimy `DATAVERSE_PARSER_V2_FALLBACK_POLICY` (`disabled`, `auto_unpinned`, `always`) + legacy kompatibilita `DATAVERSE_PARSER_V2_FALLBACK_TO_V1`.
- [x] 2026-03-11 `ruff check app/infrastructure/runtime/parser2/runtime_flags.py app/infrastructure/runtime/parser/command_service.py app/core/parser2/runtime_flags.py app/core/parser2/__init__.py app/infrastructure/runtime/parser2/__init__.py tests/test_parser2_runtime_flags.py tests/test_parser_command_service.py` -> `All checks passed!`
- [x] 2026-03-11 `PYTHONPATH=. pytest -q tests/test_parser2_runtime_flags.py tests/test_parser_command_service.py -rs` -> `9 passed`.

## 5.3 P1-2 Branch lifecycle closure

- [x] 2026-03-11 Zafixovat explicitní closure surface/semantiku větve.
- [x] 2026-03-11 Udržet deterministický promote/close behavior bez vedlejších branch leaků.

Evidence:

- [x] 2026-03-11 Přidán explicitní endpoint `POST /branches/{branch_id}/close` (idempotentní soft-close).
- [x] 2026-03-11 `promote` na zavřené větvi vrací explicitní `409` (`Branch is closed and cannot be promoted`) místo nejednoznačného `404`.
- [x] 2026-03-11 `ruff check app/api/routers/branches.py app/domains/branches/commands.py app/domains/branches/__init__.py app/services/cosmos/service_branches.py app/schema_models/branch_contracts.py tests/test_domain_professional_setup.py tests/test_api_integration.py` -> `All checks passed!`
- [x] 2026-03-11 `PYTHONPATH=. pytest -q tests/test_domain_professional_setup.py::test_branches_domain_professional_setup -rs` -> `1 passed`.
- [x] 2026-03-11 Přidány API regrese:
  - `test_branch_close_is_idempotent_and_hides_branch_scope`
  - `test_branch_promote_rejects_closed_branch`

## 5.4 P1-3 Executor semantic terminology cleanup

- [x] 2026-03-11 Sjednoceny semantic effect kódy row runtime entity z `MOON_*` na `CIVILIZATION_*`.
- [x] 2026-03-11 Upraveny důvodové texty semantic efektů pro row lifecycle (civilization, ne moon).
- [x] 2026-03-11 Sjednoceny i legacy handler větve, aby nevznikala interní terminologická divergence.

Evidence:

- [x] 2026-03-11 `rg -n "MOON_UPSERTED|MOON_UPDATED|MOON_RECLASSIFIED|MOON_EXTINGUISHED" app tests -g"*.py"` -> prázdný výstup.
- [x] 2026-03-11 `PYTHONPATH=. pytest -q tests/test_task_executor_service_stage2.py -rs` -> `17 passed`.
- [x] 2026-03-11 `if python -m py_compile app/services/task_executor/families/ingest_update.py app/services/task_executor/families/extinguish.py app/services/task_executor/service.py app/services/auto_semantics_service.py tests/test_task_executor_service_stage2.py; then echo OK; else echo NOK; fi` -> `OK`.

## 5.5 P1-4 Task-executor dead branch removal

- [x] 2026-03-11 Odstraněna mrtvá `handlers` větev v `app/services/task_executor/handlers/*`.
- [x] 2026-03-11 Odstraněna odpovídající core proxy větev `app/core/task_executor/handlers/*`.
- [x] 2026-03-11 Přidán guard test proti návratu legacy handler modulů.

Evidence:

- [x] 2026-03-11 `rg -n "task_executor\\.handlers|core\\.task_executor\\.handlers|IntentCommandHandler|IngestUpdateHandler|ExtinguishHandler|FormulaGuardianSelectHandler|LinkMutationHandler" app tests -g"*.py"` -> bez runtime referencí, pouze historické self-reexporty před odstraněním.
- [x] 2026-03-11 `PYTHONPATH=. pytest -q tests/test_domain_professional_setup.py::test_task_executor_legacy_handler_branch_removed tests/test_task_executor_service_stage2.py -rs` -> green.
- [x] 2026-03-11 `if python -m py_compile tests/test_domain_professional_setup.py app/services/task_executor/service.py app/services/task_executor/families/ingest_update.py app/services/task_executor/families/extinguish.py; then echo OK; else echo NOK; fi` -> `OK`.

## 6. Pravidlo průběžné kontroly

Po každém bloku:

1. aktualizovat checklist (open -> closed),
2. doplnit command evidence,
3. nezavírat blok bez evidence gate.

## 7. Formální uzavření BE MVP

## 7.1 Co je hotovo

1. Kanonická ontologie backend runtime je sjednocená (`civilization = row`, `moon = capability`) v API, doménách i executor/runtime vrstvách.
2. Idempotency + OCC policy je sjednocená na mutačních write cestách podle kontraktového scope.
3. Parser fallback governance, branch lifecycle closure a terminologický cleanup (`asteroid*` removal) jsou uzavřené.
4. Dead-code cleanup v task executoru je dokončený včetně guard testů proti návratu legacy handler větve.
5. Kontraktové checklisty v tomto plánu jsou uzavřené a podložené command evidencí.

## 7.2 Co je mimo scope

1. FE UX/IA/navigation redesign a visual language.
2. Kompletní FE komponentové behavior detaily a UX journey skripty.
3. Produktová „user-visible completion“ pro experience vrstvu (to je samostatná FE/UX fáze).

## 7.3 Evidence formálního uzavření

- `rg -n "\\[ \\]" docs/P0-core/contracts/splneno/be/backend-mvp-continuation-v1.md` -> prázdný výstup.
- `rg -n "\\[ \\]" docs/P0-core/contracts/splneno/be/backend-mvp-requirements-from-canonical-ux-ontology-v1CZ.md` -> prázdný výstup.

## 7.4 Navazující výkonnostní gate (MVP)

- [x] 2026-03-12 Definován samostatný MVP výkonový gate dokument pro BE:
  - `docs/P0-core/contracts/aktivni/be/backend-mvp-vykonnostni-gate-v1.md`
- [x] 2026-03-12 Výkonový gate je veden jako samostatná aktivní smlouva pro průběžné release/hardening běhy (není blocker historického uzavření implementačního BE MVP scope).
