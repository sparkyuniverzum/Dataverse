# BE Star Core Interior implementacni dokument v1

Stav: splneno jako BE closure gate pro FE Blok 3
Datum: 2026-03-12
Vlastnik: BE architektura + FE/UX governance + user-agent alignment

## 1. Vztah k ridicim dokumentum

Tento dokument vykonava:

1. [be-star-core-interior-orchestration-zadani-v1CZ.md](/mnt/c/Projekty/Dataverse/docs/P0-core/contracts/aktivni/be/be-star-core-interior-orchestration-zadani-v1CZ.md)
2. [be-star-core-interior-endpoint-contract-v1CZ.md](/mnt/c/Projekty/Dataverse/docs/P0-core/contracts/aktivni/be/be-star-core-interior-endpoint-contract-v1CZ.md)
3. [fe-blok-3-implementacni-dokument-v1CZ.md](/mnt/c/Projekty/Dataverse/docs/P0-core/contracts/aktivni/fe/fe-blok-3-implementacni-dokument-v1CZ.md)

Tento dokument uz neni navrh.

Je to vykonavaci BE plan pred kodem.

## 2. Ucel

Dodat canonical backend orchestration vrstvu pro `Star Core interior`, aby FE `Bloku 3`:

1. necetl workflow z lokalniho prototype modelu,
2. neskladal `policy_lock_ready` sam,
3. dostal stabilni read model a command surface,
4. promital backend pravdu i v interierove operator journey.

## 3. Presny scope

### 3.1 V scope

V tomto bloku je povinne dodat:

1. nova Pydantic schema pro `GET /galaxies/{galaxy_id}/star-core/interior`
2. nova Pydantic schema pro `POST /galaxies/{galaxy_id}/star-core/interior/constitution/select`
3. canonical server-side constitution catalog
4. query/read model pro `star-core interior`
5. command pro constitution select
6. napojeni `policy/lock` na selected constitution orchestration truth
7. focused BE tests a integration tests

### 3.2 Mimo scope

V tomto bloku je zakazane resit:

1. FE spatial render a HUD copy
2. onboarding replay
3. planet builder
4. `grid`
5. `command bar` mimo explicitni `Policy Lock` flow
6. logout nebo galaxy selector navrat
7. zmenu canonical `policy/lock` endpointu na jinou URL

## 4. Aktivni BE soubory

Ocekavane zmeny se maji soustredit jen sem:

1. `app/schema_models/star_core.py`
2. `app/services/star_core_service.py`
3. `app/domains/star_core/queries.py`
4. `app/domains/star_core/commands.py`
5. `app/api/routers/galaxies/star_core.py`
6. podle potreby `app/api/mappers/public.py`
7. focused testy v `tests/`

Pravidlo:

1. nezavadet paralelni workaround service mimo `star_core`,
2. neschovavat workflow pravdu jen do routeru,
3. read-model skladani ma byt explicitni a dohledatelne.

## 5. Implementacni rozpad

### 5.1 Krok A: `schema_models`

Pridat nove public/request schema do `app/schema_models/star_core.py`.

Minimalni nova schema:

1. `StarCoreConstitutionOptionPublic`
2. `StarCoreInteriorNextActionPublic`
3. `StarCoreInteriorExplainabilityPublic`
4. `StarCoreInteriorSourceTruthPublic`
5. `StarCoreInteriorPublic`
6. `StarCoreInteriorConstitutionSelectRequest`

Minimalni field set:

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

Hard rule:

1. allowed values pro `interior_phase` a `lock_transition_state` musi byt explicitne vypsane v dokumentaci nebo jako enum/validator logika,
2. schema nesmi nutit FE domyslet chybejici workflow pole.

### 5.2 Krok B: `constitution catalog`

V `app/services/star_core_service.py` zavest canonical katalog:

1. `rust`
2. `rovnovaha`
3. `straz`
4. `archiv`

Kazda polozka musi drzet:

1. `constitution_id`
2. `title_cz`
3. `summary_cz`
4. `profile_key`
5. `law_preset`
6. `physical_profile_key`
7. `physical_profile_version`
8. `visual_tone`
9. `pulse_hint`

Hard rule:

1. tenhle katalog je canonical pravda,
2. FE exploratory model nesmi zustat zdrojem mapovani.

### 5.3 Krok C: `queries`

Do `app/domains/star_core/queries.py` pridat read query:

1. `get_interior(...)`

Do `app/services/star_core_service.py` pridat odpovidajici service metodu:

1. `get_interior(...)`

Read model musi skladat:

1. `policy`
2. `physics/profile`
3. `runtime`
4. `pulse`
5. `domain metrics`
6. vybranou ustavu z canonical orchestration truth

Minimalni server-side rozhodnuti:

1. `interior_phase`
2. `lock_ready`
3. `lock_blockers[]`
4. `next_action`
5. `recommended_constitution_id`
6. `first_orbit_ready`

### 5.4 Krok D: `commands`

Do `app/domains/star_core/commands.py` pridat explicitni command planner/executor pro:

1. `select_interior_constitution(...)`

Do `app/services/star_core_service.py` pridat service metodu:

1. `select_interior_constitution(...)`

Minimalni behavior:

1. validovat `constitution_id`
2. odmitnout select po canonical `locked` stavu
3. podporit `idempotency_key`
4. vratit aktualizovany interior read model nebo dost dat pro jeho slozeni

### 5.5 Krok E: `router`

Do `app/api/routers/galaxies/star_core.py` pridat:

1. `GET /galaxies/{galaxy_id}/star-core/interior`
2. `POST /galaxies/{galaxy_id}/star-core/interior/constitution/select`

Pravidla:

1. `GET` jde pres `get_read_session`
2. `POST` jde pres `get_session`
3. `POST` ma pouzit stejny idempotency/replay pattern jako existujici `policy/lock`
4. router nesmi sam vynalezti workflow pravdu; jen vola domain/service vrstvu

### 5.6 Krok F: `policy/lock napojeni`

Existujici `POST /galaxies/{galaxy_id}/star-core/policy/lock` zustava.

Je potreba doplnit:

1. server-side kontrolu souladu payloadu s `selected_constitution_id`
2. canonical `code` pri rozporu
3. navazne prepocitani `interior` read modelu po locku

Minimalni canonical chyby:

1. `STAR_CORE_CONSTITUTION_INVALID`
2. `STAR_CORE_CONSTITUTION_NOT_ALLOWED`
3. `STAR_CORE_POLICY_ALREADY_LOCKED`
4. `STAR_CORE_INTERIOR_NOT_AVAILABLE`
5. `STAR_CORE_LOCK_SELECTION_MISMATCH`

### 5.7 Krok G: `public mapper`

Pokud bude potreba, doplnit do `app/api/mappers/public.py` mappery pro:

1. `StarCoreInteriorPublic`
2. constitution option
3. explainability payload

Pravidlo:

1. mapper nesmi zahodit workflow pole, ktera FE potrebuje k rozliseni fazi.

## 6. Navrzeny endpoint kontrakt

### 6.1 `GET /galaxies/{galaxy_id}/star-core/interior`

Vraci:

1. `StarCoreInteriorPublic`

Minimalni odpoved:

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

### 6.2 `POST /galaxies/{galaxy_id}/star-core/interior/constitution/select`

Request:

1. `constitution_id`
2. `idempotency_key`

Response:

1. `StarCoreInteriorPublic`

### 6.3 `POST /galaxies/{galaxy_id}/star-core/policy/lock`

Request shape zustava.

Navic se vyzaduje:

1. server-side overeni souladu s selected constitution,
2. odliseni `request_accepted` vs `locked`,
3. navazna dostupnost `first_orbit_ready` pres `GET /star-core/interior`.

## 7. Stavove a chybove pravidlo

### 7.1 Povolene `interior_phase`

1. `star_core_interior_entry`
2. `constitution_select`
3. `policy_lock_ready`
4. `policy_lock_transition`
5. `first_orbit_ready`

### 7.2 Povolene `lock_transition_state`

1. `idle`
2. `request_accepted`
3. `locked`
4. `failed`

### 7.3 Chybove minimum

Kazda workflow chyba ma vratit:

1. `code`
2. `message`
3. `context`
4. `galaxy_id`
5. workflow-specific detail pokud je potreba

## 8. Focused test gate

### 8.1 Schema a unit testy

Minimalni focused testy:

1. schema/public model test pro `StarCoreInteriorPublic`
2. unit test canonical constitution mapy
3. unit test `lock_ready` rozhodnuti
4. unit test `selection mismatch` chyby

### 8.2 Router/integration testy

Minimalni integration testy v `tests/test_api_integration.py`:

1. `GET /star-core/interior` vraci canonical shape
2. `POST /star-core/interior/constitution/select` nastavi vyber a vrati `policy_lock_ready`
3. `policy/lock` po validni selected constitution vrati `locked`
4. `GET /star-core/interior` po locku vrati `first_orbit_ready`
5. `constitution/select` replay s `idempotency_key` je stabilni
6. `policy/lock` pri selection mismatch vrati canonical chybu

### 8.3 Routing wiring gate

Do `tests/test_db_read_write_routing_wiring.py` doplnit:

1. `GET /galaxies/{galaxy_id}/star-core/interior` je `read`
2. `POST /galaxies/{galaxy_id}/star-core/interior/constitution/select` je `write`

## 9. Prisny gate

Blok se nesmi uzavrit, pokud:

1. `StarCoreInteriorPublic` neni stabilni a uplny
2. constitution catalog neni canonical na BE
3. FE by stale musel drzet finalni vyber ustavy jako jedinou pravdu
4. `policy/lock` neumi odhalit mismatch proti selected constitution
5. `GET /star-core/interior` nevrati `first_orbit_ready` po uspesnem locku
6. integration testy neprokazuji cely flow `select -> lock -> read ready`

## 10. Co je dalsi spravny krok

1. `Krok A` az `Krok F` jsou pro prvni canonical vrstvu hotove.
2. Focused BE gate byla potvrzena.
3. FE se muze vratit k `Bloku 3` a nahradit exploracni workflow novou BE pravdou.
4. Dalsi BE rozsireni uz patri jen do navazujicich bloků nebo hardeningu.

## 11. Evidence uzavreni

- [x] 2026-03-12 `Krok A + B` implementovan: `schema_models` + canonical constitution catalog.
- [x] 2026-03-12 `PYTHONPATH=. pytest -q tests/test_star_core_service.py` probehl green.
- [x] 2026-03-12 `Krok C + D` implementovan: `get_interior(...)` + `constitution/select` v domene.
- [x] 2026-03-12 Focused doménové testy pro `Star Core interior` probehly green.
- [x] 2026-03-12 `Krok E` implementovan: `GET /star-core/interior` + `POST /star-core/interior/constitution/select`.
- [x] 2026-03-12 Routing wiring a focused integration gate probehly green.
- [x] 2026-03-12 `Krok F` implementovan: `policy/lock` respektuje selected constitution a vraci canonical `STAR_CORE_LOCK_SELECTION_MISMATCH`.
- [x] 2026-03-12 Focused gate `PYTHONPATH=. pytest -q tests/test_star_core_service.py tests/test_api_integration.py -k "star_core_policy_lock_rejects_selection_mismatch_and_sets_first_orbit_ready or validate_policy_lock_selection"` probehl green.
