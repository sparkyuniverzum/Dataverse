# FE-BE Active Runtime Baseline v1

Stav: aktivni
Datum: 2026-03-16
Vlastnik: FE integrace
Rozsah: aktivni backend truth, kterou FE potrebuje znat bez cteni backend kodu

## 1. Ucel

Toto je kanonicky packet pro FE praci.

Ma odpovedet bez backend spelunkingu na:

1. jake endpointy jsou aktivni pro aktualni FE runtime,
2. jaka pole FE opravdu pouziva,
3. jaka je scope/idempotency pravda,
4. kdy FE musi prestat a chtit BE zmenu.

## 2. Globalni runtime pravidla

1. Vsechny FE-visible endpointy jsou scope-aware podle `user`.
2. Aktivni scope je `galaxy_id`; cast surface je navic `branch_id` aware.
3. Write endpointy pouzivaji idempotency tam, kde FE provadi workflow mutaci.
4. Main timeline je `branch_id = null`.
5. `BE je autorita pravdy`; FE smi data adaptovat, ne vymyslet.

## 3. Aktivni FE bootstrap pravda

### 3.1 Auth a vstup

`frontend/src/context/AuthContext.jsx` dnes pocita s timto:

1. `POST /auth/login`
2. `POST /auth/register`
3. `POST /auth/refresh`
4. `POST /auth/logout`
5. `GET /auth/me`
6. `GET /galaxies`

Pouziti:

1. `GET /galaxies` vraci seznam galaxii a FE bere prvni jako `defaultGalaxy`.
2. `apiFetch` automaticky pridava bearer token a pri `401` zkousi refresh session.

## 4. Aktivni workspace read surface

### 4.1 Star Core read endpointy

Pro aktivni workspace shell FE pouziva:

1. `GET /galaxies/{galaxy_id}/star-core/policy`
2. `GET /galaxies/{galaxy_id}/star-core/physics/profile`
3. `GET /galaxies/{galaxy_id}/star-core/interior`
4. `GET /galaxies/{galaxy_id}/star-core/runtime`
5. `GET /galaxies/{galaxy_id}/star-core/pulse`
6. `GET /galaxies/{galaxy_id}/star-core/domain-metrics`
7. `GET /galaxies/{galaxy_id}/star-core/planet-physics`

FE dnes aktivne pouziva tato pole:

`policy`

1. `profile_key`
2. `law_preset`
3. `profile_mode`
4. `lock_status`
5. `policy_version`
6. `can_edit_core_laws`
7. implicitne governance booleans typu `no_hard_delete`, `occ_enforced`, `idempotency_supported`, `branch_scope_supported`

`physics/profile`

1. `profile_key`
2. `profile_version`
3. `lock_status`
4. `locked_at`
5. `coefficients`

`interior`

1. `interior_phase`
2. `available_constitutions[]`
3. `selected_constitution_id`
4. `recommended_constitution_id`
5. `lock_ready`
6. `lock_blockers[]`
7. `lock_transition_state`
8. `first_orbit_ready`
9. `next_action`
10. `explainability`
11. `source_truth`

`runtime`

1. `as_of_event_seq`
2. `events_count`
3. `writes_per_minute`

`pulse`

1. `last_event_seq`
2. `sampled_count`
3. `event_types[]`
4. `events[]`

`domain-metrics`

1. `total_events_count`
2. `updated_at`
3. `domains[]`

`planet-physics`

1. `as_of_event_seq`
2. `items[]`
3. per item: `table_id`, `phase`, `metrics`, `visual`, `source_event_seq`, `engine_version`

### 4.2 Workspace entity read endpointy

FE dnes bere prostorovy/runtime stav primarne z:

1. `GET /universe/tables`
2. fallback `GET /galaxies/{galaxy_id}/planets`

Sekundarne je aktivni obecna canonical cesta:

1. `GET /universe/snapshot`

`/universe/tables` vraci FE-useful truth:

1. `table_id`
2. `galaxy_id`
3. `name`
4. `constellation_name`
5. `planet_name`
6. `archetype`
7. `contract_version`
8. `schema_fields[]`
9. `formula_fields[]`
10. `members[]`
11. `internal_bonds[]`
12. `external_bonds[]`
13. `sector`

`/universe/snapshot` vraci canonical runtime entity truth:

1. `civilizations[]`
2. `bonds[]`

Pouzivana civilization pole:

1. `id`
2. `value`
3. `table_id`
4. `table_name`
5. `constellation_name`
6. `planet_name`
7. `metadata`
8. `calculated_values`
9. `calc_errors`
10. `error_count`
11. `circular_fields_count`
12. `active_alerts`
13. `physics`
14. `facts`
15. `created_at`
16. `current_event_seq`

Pouzivana bond pole:

1. `id`
2. `source_civilization_id`
3. `target_civilization_id`
4. `type`
5. `physics`
6. `directional`
7. `flow_direction`
8. zdrojove/cilove table a planet identifikatory
9. `current_event_seq`

### 4.3 Branch scope

Branch-aware surface:

1. `/branches`
2. `/branches/{branch_id}/promote`
3. `/branches/{branch_id}/close`
4. `/universe/snapshot?branch_id=...`
5. `/universe/tables?branch_id=...`
6. star-core runtime telemetry endpointy umi branch query variantu, kde je to vystaveno v URL builderu

FE ma pocitat s tim, ze:

1. branch je volitelna vrstva nad galaxii,
2. main timeline je bez branch id,
3. promote je merge/propis vetve zpet do main timeline.

## 5. Aktivni workspace write surface

### 5.1 Star Core mutace

Aktivne pouzivane FE write endpointy:

1. `POST /galaxies/{galaxy_id}/star-core/interior/entry/start`
2. `POST /galaxies/{galaxy_id}/star-core/interior/constitution/select`
3. `POST /galaxies/{galaxy_id}/star-core/policy/lock`

FE pravidla:

1. vsechny tri endpointy posilaji `idempotency_key`,
2. FE nesmi lokalne tvrdit, ze lock/select probehl, dokud neprijde server response,
3. po `policy/lock` FE reloaduje workspace truth z canonical read endpointu.

Request payloady:

`entry/start`

1. `idempotency_key`

`constitution/select`

1. `constitution_id`
2. `idempotency_key`

`policy/lock`

1. `profile_key`
2. `lock_after_apply`
3. `physical_profile_key`
4. `physical_profile_version`
5. `idempotency_key`

Response truth:

1. vsechny tri endpointy vraci `StarCoreInteriorPublic`,
2. FE ma response brat jako nove canonical interior truth.

### 5.2 Parser a task executor surface

Aktivni canonical write pipeline pro editor/command vrstvu:

1. `POST /parser/plan`
2. `POST /parser/execute`
3. `POST /tasks/execute-batch`

Pravidla:

1. parser je scope-aware (`galaxy_id`, `branch_id`),
2. task batch umi `preview` i `commit`,
3. FE ma pred realnou mutaci preferovat preview/plan flow,
4. mutacni akce jsou OCC/idempotency sensitive.

## 6. Scope, OCC a idempotency pravidla pro FE

1. `galaxy_id` je pro produktovy runtime povazovano za povinnou provozni identitu.
2. Kde endpoint bere `idempotency_key`, FE ji ma posilat.
3. FE musi pocitat s `409 OCC_CONFLICT`.
4. Pri OCC konfliktu je spravne chovani:
   - obnovit canonical data,
   - ukazat operatorovi konflikt,
   - nepretlacit lokalni stav jako uspesny zapis.

## 7. Kdy FE nesmi improvizovat

FE se musi zastavit a chtit BE nebo dokumentacni update, kdyz:

1. potrebuje nove pole, ktere neni v tomto packetu,
2. semantika stavajiciho pole neni jednoznacna,
3. endpoint vraci jiny shape nez packet,
4. FE potrebuje novy workflow stav, ktery backend dnes explicitne nevraci.

## 8. Kdy je nutny update tohoto packetu

Vzdy kdyz se meni:

1. aktivni FE endpoint surface,
2. pouzita response pole,
3. idempotency/OCC pravidla,
4. branch/scope chovani,
5. FE adaptery zacnou brat nova backend pole jako `USE_NOW`.

## 9. Pracovni zkratka pro nove FE vlakno

Pred normalni FE implementaci staci precist:

1. [AGENTS.md](/mnt/c/Projekty/Dataverse/AGENTS.md)
2. [docs/governance/fe-operating-baseline-v1CZ.md](/mnt/c/Projekty/Dataverse/docs/governance/fe-operating-baseline-v1CZ.md)
3. [docs/contracts/fe/fe-be-active-runtime-baseline-v1CZ.md](/mnt/c/Projekty/Dataverse/docs/contracts/fe/fe-be-active-runtime-baseline-v1CZ.md)

Pokud tohle nestaci, je to signal pro update packetu, ne pro tiche backend dohledavani.
