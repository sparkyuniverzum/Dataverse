# BE Star Core Interior Orchestration zadani v1

Stav: aktivni
Datum: 2026-03-12
Vlastnik: BE architektura + FE/UX governance + user-agent alignment

## 1. Proc to vzniklo

Pri prvnim runtime otevreni FE `Bloku 3` se potvrdilo:

1. FE dokaze navrhnout produktovy flow interieru hvezdy,
2. ale dnes by musel drzet cast workflow pravdy sam,
3. a to je v rozporu s pravidlem `BE is source of truth`.

Backend dnes umi:

1. `policy truth`,
2. `physics truth`,
3. `runtime truth`,
4. `pulse truth`,
5. `domain metrics truth`,
6. canonical `POST /galaxies/{galaxy_id}/star-core/policy/lock`.

Backend dnes jeste neumi jako first-class orchestration:

1. `star_core_interior_entry`,
2. `constitution_select`,
3. `policy_lock_ready`,
4. `policy_lock_transition`,
5. `first_orbit_ready`.

To je mezera, kterou musi zavrit prave tento blok.

## 2. Ucel

Zalozit canonical backend orchestration vrstvu pro interier `Star Core`, aby FE:

1. nepouzival vlastni finalni workflow autoritu,
2. neimprovizoval kolem stavu interieru,
3. promital backend pravdu nejen ve fyzice, ale i v operator journey.

## 3. Scope zadani

### 3.1 Domain workflow truth

Backend ma zavest explicitni orchestration model pro:

1. `star_core_interior_entry`
2. `constitution_select`
3. `policy_lock_ready`
4. `policy_lock_transition`
5. `first_orbit_ready`

Tyto faze nemusi nutne vsechny existovat jako samostatne DB tabulky, ale musi existovat jako canonical runtime contract.

### 3.2 Constitution contract

Backend ma first-class potvrdit a dokumentovat ctyri canonical rezimy:

1. `Rust`
2. `Rovnovaha`
3. `Straz`
4. `Archiv`

Pro kazdy rezim musi byt canonical mapovani na:

1. `profile_key`
2. `law_preset`
3. `physical_profile_key`
4. `physical_profile_version`
5. navazujici vysvetlujici metadata pro FE

Pravidlo:

1. FE uz nesmi hadat mapovani sam,
2. FE smi jen cist a promitat canonical mapu z BE.

### 3.3 Lock readiness

Backend musi umet rozhodnout a vratit:

1. jestli je `Policy Lock` povolen,
2. proc je nebo neni povolen,
3. jestli chybi volba ustavy,
4. jestli je stav konfliktni nebo uz zamceny,
5. jaky dalsi krok ma operátor udelat.

### 3.4 Lock transition truth

Backend musi definovat, co je canonical potvrzeni lock transition:

1. co je jen `request accepted`,
2. co je `policy locked`,
3. kdy se smi oznacit `first_orbit_ready`,
4. jak se ma chovat retry/idempotency,
5. jak se ma vratit explainability pri chybe.

## 4. Ocekavany BE vystup pro FE

Minimalni canonical contract ma dat FE:

1. `interior_phase`
2. `available_constitutions[]`
3. `selected_constitution` nebo `recommended_constitution`
4. `lock_ready`
5. `lock_blockers[]`
6. `lock_transition_state`
7. `first_orbit_ready`
8. `next_action`
9. `explainability`

To muze byt:

1. novy endpoint,
2. rozsireni existujicich `star-core` payloadu,
3. nebo kombinace `query + command`,

ale vysledek musi byt pro FE jednoznacny a stabilni.

## 5. Kandidatni endpointy / contract surface

Minimalni pracovni varianty:

1. `GET /galaxies/{galaxy_id}/star-core/interior`
2. `POST /galaxies/{galaxy_id}/star-core/interior/constitution/select`
3. `POST /galaxies/{galaxy_id}/star-core/policy/lock`

Alternativne:

1. zachovat existujici `policy/lock`,
2. ale pridat `GET /star-core/interior` jako orchestration read model,
3. a `POST /star-core/interior/constitution/select` jako explicitni command pred lockem.

Zakaz:

1. neresit to jen implicitne ve FE kombinovanim `policy + physics + runtime`,
2. nechat FE domyslet `policy_lock_ready` bez BE potvrzeni.

## 6. Vazba na FE

Tento dokument je blocker / dependency pro:

1. `docs/P0-core/contracts/aktivni/fe/fe-blok-3-implementacni-dokument-v1CZ.md`
2. `docs/P0-core/contracts/aktivni/fe/fe-vykonavaci-dokument-galaxy-space-workspace-v1CZ.md`

FE se ma po schvaleni tohoto BE zadani vratit a:

1. nahradit exploracni FE workflow canonical BE orchestration pravdou,
2. znovu otevrit `Blok 3`,
3. az pak ho dokoncit screenshot a UX gate.

## 7. Pripraveny kod a existujici pravda

Jako zdroj pro BE navrh uz existuje:

1. `app/api/routers/galaxies/star_core.py`
2. `app/schema_models/star_core.py`
3. `app/services/star_core_service.py`
4. `frontend/src/components/universe/lawResolver.js`
5. `frontend/src/components/universe/starContract.js`
6. exploracni FE modely:
   - `frontend/src/components/universe/starCoreConstitutionModel.js`
   - `frontend/src/components/universe/starCoreInteriorStateModel.js`
   - `frontend/src/components/universe/starCoreLockTransitionModel.js`

Pravidlo:

1. FE modely nejsou canonical autorita,
2. ale jsou legitimni vstup jako objevny prototype pro BE zadani.

## 8. Prisny gate

Tento BE blok se nesmi uzavrit, pokud:

1. neni explicitne urcena canonical contract surface pro interier,
2. neni explicitne urcena canonical mapa 4 ustav,
3. FE by stale musel drzet `constitution_select` nebo `policy_lock_ready` jako vlastni pravdu,
4. lock transition nema jasne rozliseni `request / accepted / locked / first_orbit_ready`,
5. chyby a explainability nejsou vratne do FE bez domysleni.

## 9. Duvod, proc je to prisnejsi nez MVP

Klasicke MVP by reklo:

1. FE si zvoli preset,
2. posle `policy/lock`,
3. po uspechu ukaze dalsi krok.

To je tady nedostatecne, protoze:

1. Dataverse stavi na tom, ze FE promita backend pravdu,
2. `Star Core` je governance autorita, ne jen vizualni krok,
3. `Constitution Select` je soucast domenoveho workflow, ne jen lokalni UI rozhodnuti.

## 10. Co je dalsi spravny krok

1. schvalit tento dokument jako canonical BE zadani,
2. navrhnout konkretni endpoint/model surface v `be-star-core-interior-endpoint-contract-v1CZ.md`,
3. teprve potom upravit FE `Blok 3`.
