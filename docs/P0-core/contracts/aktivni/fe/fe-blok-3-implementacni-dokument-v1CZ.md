# FE Blok 3 implementacni dokument v1

Stav: aktivni (navrat na zacatek `Bloku 3`)
Datum: 2026-03-12
Vlastnik: FE architektura + Produktove UX + user-agent governance

## 0. Redesign a duvod

Pri runtime overeni `Bloku 3` se potvrdilo:

1. produktovy smer je spravny,
2. `Star Core interior` je dulezita vrstva zkusenosti,
3. ale neni to jen dalsi zoom uvnitr stejne `Galaxy Space` sceny.

Dosavadni prototyp ukazal dve pravdy:

1. BE orchestration baseline uz existuje a je pripravena,
2. interior uvnitr stejneho canvasu rozbija fokus, framing i ontologii prostoru.

Proto je od ted zavazne:

1. `Galaxy Space` zustava hlavni pracovni prostor,
2. `Star Core interior` bude samostatna pracovni obrazovka,
3. spatial transition muze byt plynuly a diegeticky, ale cil uz neni zustat v tomtez canvasu,
4. `Constitution Select`, `Policy Lock` a `first_orbit_ready` se budou odehravat na samostatne interior screen.

## 1. Vztah k ridicim dokumentum

Tento dokument vykonava:

1. `docs/P0-core/contracts/aktivni/fe/fe-vykonavaci-dokument-galaxy-space-workspace-v1CZ.md`
2. `docs/P0-core/contracts/aktivni/fe/fe-vision-v2-spatial-galaxy-entry-v1CZ.md`
3. `docs/P0-core/contracts/aktivni/fe/fe-master-spec-hlavni-pracovni-prostor-galaxie-v1CZ.md`
4. `docs/P0-core/contracts/aktivni/fe/fe-be-fe-projekcni-mapa-hlavni-pracovni-prostor-v1CZ.md`
5. `docs/P0-core/contracts/aktivni/fe/fe-be-pravda-a-data-guard-v1CZ.md`
6. `docs/P0-core/contracts/aktivni/fe/fe-builder-system-galaxy-space-workspace-v1CZ.md`
7. `docs/P0-core/contracts/aktivni/be/be-star-core-interior-endpoint-contract-v1CZ.md`
8. `docs/P0-core/contracts/splneno/be/be-star-core-interior-implementacni-dokument-v1CZ.md`

Provadeci pravidlo:

1. aktivni source of truth pro dalsi FE praci je znovu jen tento dokument,
2. vsechny navazne FE dokumenty za zacatkem `Bloku 3` byly vyradene jako chybny smer,
3. dalsi FE navrh nebo implementace se musi znovu otevrit odsud, ne z pozdejsich odboceni.

## 2. Ucel bloku

Dodat skutecny governance-first vstup do nitra hvezdy jako samostatnou interior screen:

1. `double click` z exterioru spusti `approach + entry transition`,
2. transition prevede operatora na samostatnou `Star Core interior screen`,
3. uvnitr vznikne `Constitution Select`,
4. volba ustavy se vysvetli dusledkem, ne formularem,
5. `Policy Lock` se potvrdi jako fyzicky dej,
6. po potvrzeni se operator vrati ven do `Galaxy Space` se signalem `First Orbit`.

## 3. Presny scope Bloku 3

### 3.1 Stav A: `star_core_interior_entry`

Implementovat:

1. plynuly vstup z `star_core_exterior_approach` do samostatne `Star Core interior screen`,
2. jasny prechod mezi `Galaxy Space` a interior screen,
3. interior jako samostatny prostor, ne dalsi overlay uvnitr puvodni sceny,
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
4. zadny formularovy panel ani admin checklist,
5. cele rozlozeni uz patri interior screen, ne zbytku `Galaxy Space`.

### 3.3 Stav C: `policy_lock_ready`

Implementovat:

1. command affordance pro potvrzeni ustavy,
2. jen jeden primarni krok `Potvrdit ustavu a uzamknout politiky`,
3. explainability proc je lock potrebny pred planetami,
4. stale bez otevreni planetarniho builderu,
5. command affordance je soucast interior screen, ne plovoucim prvkem nad `Galaxy Space`.

### 3.4 Stav D: `policy_lock_transition`

Implementovat:

1. fyzicky `lock-in` prstence,
2. zmenu z tepleho `UNLOCKED` do chladneho `LOCKED`,
3. zklidneni hvezdy,
4. navrat ven do `Star Core exterior` se zjevnou zmenou stavu,
5. zadny "zaseknuty mezistav" uvnitr puvodniho canvasu.

### 3.5 Stav E: `first_orbit_ready`

Implementovat:

1. po locku vznik prvni obezne drahy,
2. signal dalsiho kroku,
3. signal dalsiho kroku bez otevreni dalsiho FE bloku,
4. bez otevreni builderu nebo gridu v tomhle bloku,
5. interior screen se po potvrzeni uzavira a operator je vracen zpet do `Galaxy Space`.

## 4. Mimo scope

V tomto bloku je zakazane implementovat:

1. plny builder workflow planety,
2. `grid`,
3. `command bar` jako obecny power-user mod,
4. editaci `civilization`,
5. capability / `moon` detail,
6. onboarding replay,
7. logout / navrat do selectoru galaxii,
8. drzet `Galaxy Space` a `Star Core interior` jako rovnocenne aktivni vrstvy v jednom canvasu.

## 5. Aktivni soubory pro Blok 3

Ocekavane aktivni zmeny se maji soustredit jen sem:

1. `frontend/src/components/universe/UniverseWorkspace.jsx`
2. `frontend/src/components/universe/UniverseCanvas.jsx`
3. `frontend/src/components/universe/GalaxySelectionHud.jsx`
4. novy samostatny screen komponent pro `Star Core interior`
5. nove male helper/adapter moduly pro `Star Core interior`
6. odpovidajici focused testy v `frontend/src/components/universe/`

Preferovane nove soubory:

1. `StarCoreInteriorScreen.jsx`
2. `StarCoreInteriorScreen.test.jsx`
3. `starCoreInteriorAdapter.js`
4. `starCoreInteriorAdapter.test.js`
5. `starCoreInteriorScreenModel.js`
6. `starCoreInteriorScreenModel.test.js`

Pravidlo:

1. interier nesmi zustat dalsim zanořenym render stavem uvnitr hlavni `Galaxy Space` sceny,
2. `Star Core interior` ma byt samostatna screen surface,
3. volba ustavy musi byt oddelena od render vrstvy,
4. lock transition logika musi byt oddelena od HUD copy.

## 6. Stavovy model

Blok 3 ma explicitne rozlisovat:

1. `star_core_interior_entry`
2. `constitution_select`
3. `policy_lock_ready`
4. `policy_lock_transition`
5. `first_orbit_ready`

Minimalni rozhodovaci pravidla:

1. `double click` z exterioru spousti `approach + entry transition` v jednom kroku,
2. `approach_active` smi existovat jako technicky animacni mezistav, ale ne jako dalsi uzivatelske rozhodnuti,
3. z entry se plynule prejde do `constitution_select`,
4. teprve po zvoleni ustavy se odemkne `policy_lock_ready`,
5. `Esc` vraci z interieru ven, pokud jeste neprobiha lock transition,
6. po potvrzeni locku se vyjde ven do exterioru a vygeneruje se `first_orbit_ready`.

## 7. Vazba na backend pravdu

Pro Blok 3 je povinna tato pravda:

1. `GET /galaxies/{galaxy_id}/star-core/interior`
2. `POST /galaxies/{galaxy_id}/star-core/interior/constitution/select`
3. `POST /galaxies/{galaxy_id}/star-core/policy/lock`
4. `GET /galaxies/{galaxy_id}/star-core/policy`
5. `GET /galaxies/{galaxy_id}/star-core/physics/profile`

Implementacni pravidla:

1. `law_preset`, `profile_key`, `profile_mode` a `can_edit_core_laws` musi ridit nabidku `Constitution Select`,
2. FE nesmi pred lockem kreslit `LOCKED`,
3. `Policy Lock` musi jit pres canonical endpoint, zadny lokalni fake commit,
4. pri chybe locku musi zustat stav obnovitelny a vysvetleny,
5. `First Orbit` se zobrazi jen po realnem potvrzeni locku,
6. FE nesmi byt finalni autorita workflow fazi interieru,
7. interior screen muze mit jen tenkou lokalni UI vrstvu (`isOpen`, `transition`, recoverable error), ne canonical workflow pravdu,
8. `Galaxy Space` a `Star Core interior` musi byt renderove i mentalne oddelene.

## 8. Pripraveny kod z archivu

Pro tento blok je pripraveny kod:

1. `starContract.js`
2. `lawResolver.js`
3. `previewAccessibility.js`
4. `starCoreTruthAdapter.js`
5. `planetPhysicsParity.js`
V tomto bloku se skutecne maji vratit nebo dale pouzit:

1. `starContract.js`
2. `lawResolver.js`
3. `previewAccessibility.js`
4. existujici `starCoreTruthAdapter.js`
5. existujici `starCoreInteriorAdapter.js`
6. podle potreby `planetPhysicsParity.js` pro navazani `First Orbit`

V tomto bloku se zatim nemaji vratit:

1. `QuickGridOverlay.jsx`
2. `useCommandBarController.js`
3. `planetBuilderFlow.js`
4. `visualBuilderStateMachine.js`
5. `ParserComposerModal.jsx`

## 9. Konkretni implementacni kroky

Poradi implementace:

1. vytvorit `StarCoreInteriorScreen` jako samostatny screen komponent,
2. vytvorit `starCoreInteriorScreenModel`,
3. navazat `double click -> approach + entry transition -> interior screen`,
4. oddelit render `Galaxy Space` a `Star Core interior`,
5. pridat `Constitution Select` na interior screen,
6. pridat `policy_lock_ready` affordance na interior screen,
7. napojit canonical `policy/lock` request,
8. dodelat `lock transition`,
9. po potvrzeni vratit operatora ven do `Galaxy Space`,
10. vygenerovat `first_orbit_ready`,
11. pridat focused testy a screenshot-ready stavy.

## 10. Focused gate

### 10.1 Focused testy

Minimalni pozadovane focused testy:

1. `starCoreInteriorAdapter.test.js`
2. `starCoreInteriorScreenModel.test.js`
3. focused render test `star_core_interior_entry`
4. focused render test `constitution_select`
5. focused render test `policy_lock_ready`
6. focused render test `policy_lock_transition`
7. focused render test `first_orbit_ready`
8. focused test pro lock failure/recoverable state
9. focused test, ze `double click` na hvezdu spousti `approach + entry` v jednom kroku

### 10.2 Screenshot gate

Povinne screenshoty:

1. `star_core_interior_entry`
2. `constitution_select`
3. `policy_lock_ready`
4. `policy_lock_transition`
5. `first_orbit_ready`

### 10.3 UX-first redesign gate

Blok 3 se nesmi uzavrit, pokud plati aspon jeden z bodu:

1. interior stale vypada jako "vic zoomu v tomtez prostoru",
2. `Galaxy Space` a interior screen se stale perou o pozornost,
3. `Constitution Select` stale pusobi jako overlay nad vnejsi scenou,
4. operator nema cit, ze skutecne vstoupil do jine pracovni vrstvy,
5. user-visible vrstva se opira o vyrazeny nebo neaktivni FE dokument mimo tento blok.
