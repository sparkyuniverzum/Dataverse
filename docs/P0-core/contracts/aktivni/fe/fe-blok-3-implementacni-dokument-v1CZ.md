# FE Blok 3 implementacni dokument v1

Stav: aktivni s BE blockerem (FE smer potvrzen, dalsi krok je canonical BE orchestration)
Datum: 2026-03-12
Vlastnik: FE architektura + Produktove UX + user-agent governance

## 0. Odchylka a duvod

Pri prvnim runtime otevreni `Bloku 3` se potvrdilo:

1. FE produktovy smer je spravny,
2. spatial interier `Star Core` a `Constitution Select` jsou relevantni casti zkusenosti,
3. ale dalsi postup nelze dokoncit jen na FE, protoze dnes chybi canonical BE orchestration vrstva pro interier hvezdy.

FE prototype ukazal spravnou vizi, ale odhalil mezeru v odpovednosti:

1. BE dnes vraci `state truth`,
2. FE ale pro `Blok 3` potrebuje i `workflow truth`,
3. a tu dnes backend explicitne nevraci ani neplanuje.

Proto je od ted zavazne:

1. povazovat FE implementaci `Bloku 3` za objevny prototype, ne za canonical finalni smer,
2. nejdriv zalozit BE orchestration contract,
3. teprve potom dokoncit runtime FE.

## 1. Vztah k ridicim dokumentum

Tento dokument vykonava:

1. `docs/P0-core/contracts/aktivni/fe/fe-vykonavaci-dokument-galaxy-space-workspace-v1CZ.md`
2. `docs/P0-core/contracts/aktivni/fe/fe-vision-v2-spatial-galaxy-entry-v1CZ.md`
3. `docs/P0-core/contracts/aktivni/fe/fe-master-spec-hlavni-pracovni-prostor-galaxie-v1CZ.md`
4. `docs/P0-core/contracts/aktivni/fe/fe-be-fe-projekcni-mapa-hlavni-pracovni-prostor-v1CZ.md`
5. `docs/P0-core/contracts/aktivni/fe/fe-be-pravda-a-data-guard-v1CZ.md`
6. `docs/P0-core/contracts/aktivni/fe/fe-builder-system-galaxy-space-workspace-v1CZ.md`

Tento dokument uz neni brainstorming.

Je to posledni priprava pred kodem `Bloku 3`.

## 2. Ucel bloku

Dodelat skutecny governance-first vstup do nitra hvezdy:

1. dvojklik z exterioru otevre interier `Star Core`,
2. uvnitr hvezdy vznikne `Constitution Select`,
3. volba ustavy se vysvetli dusledkem, ne formularem,
4. `Policy Lock` se potvrdi jako fyzicky dej,
5. po potvrzeni se uzivatel vrati ven do prostoru se signalem `First Orbit`.

## 3. Presny scope Bloku 3

### 3.1 Stav A: `star_core_interior_entry`

Implementovat:

1. plynuly vstup z `star_core_exterior_approach` do interieru,
2. zachovani orientace a moznosti navratu,
3. interier jako prostor, ne panel,
4. reduced-motion varianta se stejnou vyznamovou sekvenci.

### 3.2 Stav B: `constitution_select`

Implementovat:

1. ctyri nadcasove rezimy vesmiru:
   - `Rust`
   - `Rovnovaha`
   - `Straz`
   - `Archiv`
2. vysvetleni rezimu pres dusledky:
   - puls hvezdy
   - tonalita prstence
   - hustota energie
   - kratka veta o dusledku
3. selection fokus na zvolenou ustavu,
4. zadny formulářovy panel ani admin checklist.

### 3.3 Stav C: `policy_lock_ready`

Implementovat:

1. command affordance pro potvrzeni ustavy,
2. jen jeden primarni krok `Potvrdit ustavu a uzamknout politiky`,
3. explainability proc je lock potrebny pred planetami,
4. stale bez otevreni planetarniho builderu.

### 3.4 Stav D: `policy_lock_transition`

Implementovat:

1. fyzicky `lock-in` prstence,
2. zmenu z tepleho `UNLOCKED` do chladneho `LOCKED`,
3. zklidneni hvezdy,
4. navrat ven do `Star Core exterior` se zjevnou zmenou stavu.

### 3.5 Stav E: `first_orbit_ready`

Implementovat:

1. po locku vznik prvni obezne drahy,
2. signal dalsiho kroku,
3. navazani na budouci `Blok 4`,
4. bez otevreni builderu nebo gridu v tomhle bloku.

## 4. Mimo scope

V tomto bloku je zakazane implementovat:

1. plny builder workflow planety,
2. `grid`,
3. `command bar` jako obecny power-user mod,
4. editaci `civilization`,
5. capability / `moon` detail,
6. onboarding replay,
7. logout / návrat do selectoru galaxií.

## 5. Aktivni soubory pro Blok 3

Ocekavane aktivni zmeny se maji soustredit jen sem:

1. `frontend/src/components/universe/UniverseWorkspace.jsx`
2. `frontend/src/components/universe/UniverseCanvas.jsx`
3. `frontend/src/components/universe/GalaxySelectionHud.jsx`
4. nove male helper/model moduly pro `Star Core interior`
5. odpovidajici focused testy v `frontend/src/components/universe/`

Preferovane nove soubory:

1. `starCoreInteriorStateModel.js`
2. `starCoreInteriorStateModel.test.js`
3. `starCoreConstitutionModel.js`
4. `starCoreConstitutionModel.test.js`
5. `starCoreLockTransitionModel.js`
6. `starCoreLockTransitionModel.test.js`

Pravidlo:

1. interier nesmi prerust v monolitickou kartu v `UniverseWorkspace.jsx`,
2. volba ustavy musi byt oddelena od render vrstvy,
3. lock transition logika musi byt oddelena od HUD copy.

## 6. Stavovy model

Blok 3 ma explicitne rozlisovat:

1. `star_core_interior_entry`
2. `constitution_select`
3. `policy_lock_ready`
4. `policy_lock_transition`
5. `first_orbit_ready`

Minimalni rozhodovaci pravidla:

1. `double click` z exterior approach prepina do `star_core_interior_entry`,
2. z entry se plynule prejde do `constitution_select`,
3. teprve po zvoleni ustavy se odemkne `policy_lock_ready`,
4. `Esc` vraci z interieru ven, pokud jeste neprobiha lock transition,
5. po potvrzeni locku se vyjde ven do exterioru a vygeneruje se `first_orbit_ready`.

## 7. Vazba na backend pravdu

Pro Blok 3 je povinna tato pravda:

1. `GET /galaxies/{galaxy_id}/star-core/policy`
2. `GET /galaxies/{galaxy_id}/star-core/physics/profile`
3. `GET /galaxies/{galaxy_id}/star-core/runtime`
4. `GET /galaxies/{galaxy_id}/star-core/pulse`
5. `GET /galaxies/{galaxy_id}/star-core/domain-metrics`
6. `POST /galaxies/{galaxy_id}/star-core/policy/lock`

Navic je od ted povinny navazujici BE contract:

1. `docs/P0-core/contracts/aktivni/be/be-star-core-interior-orchestration-zadani-v1CZ.md`

Implementacni pravidla:

1. `law_preset`, `profile_key`, `profile_mode` a `can_edit_core_laws` musi ridit nabidku `Constitution Select`,
2. FE nesmi pred lockem kreslit `LOCKED`,
3. `Policy Lock` musi jit pres canonical endpoint, zadny lokalni fake commit,
4. pri chybe locku musi zustat stav obnovitelny a vysvetleny,
5. `First Orbit` se zobrazi jen po realnem potvrzeni locku.
6. FE nesmi byt finalni autorita workflow fazi interieru.
7. Pokud BE orchestration vrstva neni pripravena, FE muze slouzit jen jako exploracni prototype a blok se nesmi uzavrit.

## 8. Pripraveny kod z archivu

Pro tento blok je pripraveny kod:

1. `frontend/src/_inspiration_reset_20260312/components/universe/starContract.js`
2. `frontend/src/_inspiration_reset_20260312/components/universe/lawResolver.js`
3. `frontend/src/_inspiration_reset_20260312/components/universe/previewAccessibility.js`
4. `frontend/src/_inspiration_reset_20260312/components/universe/starCoreTruthAdapter.js`
5. `frontend/src/_inspiration_reset_20260312/components/universe/planetPhysicsParity.js`

V tomto bloku se skutecne maji vratit nebo dale pouzit:

1. `starContract.js`
2. `lawResolver.js`
3. `previewAccessibility.js`
4. existujici `starCoreTruthAdapter.js`
5. podle potreby `planetPhysicsParity.js` pro navazani `First Orbit`

V tomto bloku se zatim nemaji vratit:

1. `QuickGridOverlay.jsx`
2. `useCommandBarController.js`
3. `planetBuilderFlow.js`
4. `visualBuilderStateMachine.js`
5. `ParserComposerModal.jsx`

## 9. Konkretni implementacni kroky

Poradi implementace:

1. vytvorit `starCoreInteriorStateModel`,
2. vytvorit `starCoreConstitutionModel` s mapou 4 rezimu,
3. navazat interior render do `UniverseCanvas.jsx`,
4. pridat `double click -> interior entry`,
5. pridat vyber ustavy,
6. pridat `policy_lock_ready` affordance,
7. napojit canonical `policy/lock` request,
8. dodelat `lock transition`,
9. vygenerovat `first_orbit_ready`,
10. pridat focused testy a screenshot-ready stavy.

## 10. Focused gate

### 10.1 Focused testy

Minimalni pozadovane focused testy:

1. `starCoreInteriorStateModel.test.js`
2. `starCoreConstitutionModel.test.js`
3. `starCoreLockTransitionModel.test.js`
4. focused render test `constitution_select`
5. focused render test `policy_lock_ready`
6. focused render test `policy_lock_transition`
7. focused render test `first_orbit_ready`
8. focused test pro lock failure/recoverable state

### 10.2 Screenshot gate

Povinne screenshoty:

1. `star_core_interior_entry`
2. `constitution_select`
3. `policy_lock_ready`
4. `policy_lock_transition`
5. `first_orbit_ready`

### 10.3 Prisnejsi nez MVP

Blok se nesmi uzavrit, pokud:

1. `Constitution Select` pusobi jako formular nebo tabulka,
2. `Policy Lock` je jen tlacitko s textem bez fyzickeho vyznamu,
3. po locku nevznikne prostorovy signal dalsiho kroku,
4. interier rozbije orientaci a uzivatel se citi ztraceny,
5. `work first` se ztrati pod efektem,
6. reduced-motion varianta zmeni vyznam sekvence.

## 11. Co se nepocita jako completion

1. dalsi glow bez skutecne volby ustavy,
2. fake lock bez canonical backend potvrzeni,
3. centralni textova karta uvnitr hvezdy,
4. skryty modal misto prostoroveho interieru,
5. orbit po locku, ktery nevyplyva z realneho potvrzeni stavu.

## 12. Evidence

Minimalni dukaz:

```bash
cd /mnt/c/Projekty/Dataverse
sed -n '140,240p' docs/P0-core/contracts/aktivni/fe/fe-vykonavaci-dokument-galaxy-space-workspace-v1CZ.md
sed -n '1,260p' docs/P0-core/contracts/aktivni/fe/fe-vision-v2-spatial-galaxy-entry-v1CZ.md
sed -n '1,260p' docs/P0-core/contracts/aktivni/fe/fe-master-spec-hlavni-pracovni-prostor-galaxie-v1CZ.md
sed -n '1,260p' docs/P0-core/contracts/aktivni/fe/fe-be-fe-projekcni-mapa-hlavni-pracovni-prostor-v1CZ.md
sed -n '1,260p' docs/P0-core/contracts/aktivni/fe/fe-builder-system-galaxy-space-workspace-v1CZ.md
```

## 13. Co zustava otevrene

- [x] 2026-03-12 FE prototype potvrdil, ze `Constitution Select` a `Policy Lock` patri do produktu.
- [ ] 2026-03-12 Chybi canonical BE orchestration contract pro workflow faze interieru.
- [ ] 2026-03-12 Dalsi runtime FE postup je blokovan dokumentem `docs/P0-core/contracts/aktivni/be/be-star-core-interior-orchestration-zadani-v1CZ.md`.
- [ ] Otevrit implementaci `Bloku 3` v runtime.
- [ ] Po dokonceni `Bloku 3` rozhodnout, jestli je `First Orbit` uz dostatecny vstup pro `Blok 4: Planet topology and orbit baseline`.
