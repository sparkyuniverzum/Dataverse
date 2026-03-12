# FE Blok 3a Star Core Interior Screen implementacni dokument v1

Stav: aktivni
Datum: 2026-03-12
Vlastnik: FE architektura + Produktove UX + BE truth governance

## 0. Pre-implementation kontrakt

### 0.1 Zavazne podminky prevzate z ridicich dokumentu

Pro tento blok plati jako hard gate:

1. `Star Core interior` je samostatna pracovni obrazovka, ne dalsi zoom uvnitr `Galaxy Space`.
2. `Galaxy Space` zustava hlavni pracovni prostor a nesmi se s interierem prat o pozornost.
3. FE nesmi vymyslet lokalni workflow truth; canonical workflow faze vraci backend `GET /galaxies/{galaxy_id}/star-core/interior`.
4. Tento blok nesmi predbihat do builderu, gridu ani onboarding replay.
5. Pro UX-first blok nestaci technicke oddeleni; musi byt viditelne, ze operator vstoupil do jine pracovni vrstvy.

### 0.2 Co aktualni runtime porusuje

Aktualni FE runtime jeste drzi interior uvnitr stejne render vrstvy:

1. Dukaz:
   - prikaz `rg -n "StarCoreInterior|interiorModel\\.isOpen|policy_lock_transition|first_orbit_ready" frontend/src/components/universe/UniverseCanvas.jsx`
   - vysledek: `interiorModel.isOpen` ridi kameru v `UniverseCanvas` a `StarCoreInterior` je renderovan uvnitr tohotez canvasu na radcich `218`, `462` a okolnich stavech.
2. Dukaz:
   - prikaz `rg -n "UniverseCanvas|interiorUiState|closeStarCoreInteriorUi|resolveStarCoreInteriorModel" frontend/src/components/universe/UniverseWorkspace.jsx`
   - vysledek: `UniverseWorkspace.jsx` drzi `interiorUiState`, pocita `resolveStarCoreInteriorModel` a stale renderuje `UniverseCanvas` jako host pro interior na radcich `184`, `275`, `490`, `517`.

Z toho plyne:

1. aktualni produkt stale pusobi jako dalsi zoom v jednom prostoru,
2. navrat z interieru jeste neni kontrakt samostatne obrazovky,
3. dalsi implementace se musi nejdriv oddelit screen architekturou.

### 0.3 Co bude prijatelny dukaz dokonceni

Za prijatelny dukaz pro tento blok se pocita jen kombinace:

1. samostatny `StarCoreInteriorScreen` shell renderovany mimo `UniverseCanvas`,
2. prechod `Galaxy Space -> interior screen` s reduced-motion variantou,
3. jednoznacny return contract `interior screen -> Galaxy Space`,
4. focused testy pro shell model, transition a return contract,
5. screenshoty nebo explicitni first-view porovnani dokazujici oddelenou pracovni vrstvu.

### 0.4 Co se za dokonceni pocitat nebude

Za dokonceni se nepocita:

1. dalsi camera polish uvnitr `UniverseCanvas`,
2. overlay nebo modal, ktery jen prekryje `Galaxy Space`,
3. lokalni FE workflow stav, ktery by nahrazoval `interior_phase`,
4. priprava builderu, gridu nebo onboarding replay,
5. architektura-only refactor bez viditelne zmeny vstupu a navratu.

## 1. Ucel bloku

Otevrit implementaci `Bloku 3` pres mensi a auditovatelnou davku:

1. postavit `StarCoreInteriorScreen` shell,
2. definovat prechod z `Galaxy Space`,
3. definovat navrat z interieru zpet do `Galaxy Space`,
4. pripravit bezpecny podklad pro dalsi blok s `Constitution Select` a `Policy Lock`.

Tento blok zamerne neresi plny interior obsah.

Resi pouze architekturu vstupu, vystupu a oddeleni pracovnich vrstev.

## 2. Vztah k aktivnim dokumentum

Tento dokument vykonava:

1. `docs/P0-core/contracts/aktivni/core/new-thread-context-packet-v1CZ.md`
2. `docs/P0-core/contracts/aktivni/fe/fe-blok-3-implementacni-dokument-v1CZ.md`
3. `docs/P0-core/contracts/aktivni/fe/fe-blok-3-return-packet-v1CZ.md`
4. `docs/P0-core/contracts/aktivni/fe/fe-vykonavaci-dokument-galaxy-space-workspace-v1CZ.md`
5. `docs/P0-core/contracts/aktivni/fe/fe-be-pravda-a-data-guard-v1CZ.md`
6. `docs/P0-core/contracts/aktivni/be/be-star-core-interior-endpoint-contract-v1CZ.md`

Pravidlo:

1. pokud je rozpor mezi starsim FE prototypem a timto dokumentem, plati tento dokument a aktivni BE contract,
2. `Blok 3a` je implementacni podblok `Bloku 3`, ne paralelni smer.

## 3. Presny scope Bloku 3a

Implementovat se ma jen:

1. novy `StarCoreInteriorScreen.jsx` jako samostatny screen shell,
2. novy `starCoreInteriorScreenModel.js` pro UI-only screen stav,
3. transition kontrakt z `Galaxy Space` do interior screen,
4. return kontrakt z interior screen do `Galaxy Space`,
5. tenke napojeni na existujici `starCoreInteriorAdapter.js`,
6. focused testy pro shell, transition a return.

## 4. Mimo scope

V tomto bloku je zakazane implementovat:

1. finalni `Constitution Select` surface,
2. `policy_lock_ready` command affordance jako finalni produkcni interakci,
3. `policy_lock_transition` efekty uvnitr finalniho obsahu,
4. builder planety,
5. `grid`,
6. onboarding replay,
7. lokalni FE workflow truth mimo BE contract.

Poznamka:

1. tento blok smi pouzit placeholder obsah interior shellu jen pro potvrzeni architektury, ne jako finalni UX `Bloku 3`.

## 5. Screen shell kontrakt

`StarCoreInteriorScreen` musi splnit:

1. je renderovan mimo `UniverseCanvas`,
2. po otevreni prevezme vizualni dominanci a `Galaxy Space` zustane jen jako opoustena predchozi vrstva nebo odchozi frame,
3. ma vlastni header, body a return affordance,
4. ma vlastni surface tokeny a copy pro samostatnou pracovni vrstvu,
5. reduced-motion rezim zkrati animaci, ale nezmeni poradi vyznamu,
6. umi zobrazit stavy `entering`, `active`, `returning`.

Minimalni shell obsah:

1. titulek vrstvy `Srdce hvezdy`,
2. kratky podtitulek vysvetlujici, ze jde o governance interier,
3. oblast pro budouci `Constitution Select`,
4. navratovy prikaz `Zpet do Galaxy Space`.

## 6. Transition kontrakt

Vstup do interieru musi fungovat takto:

1. operator provede `double click` na `Star Core` ve stavu exterior approach,
2. `Galaxy Space` dokonci kratkou `approach + entry` sekvenci,
3. pote se `UniverseCanvas` odpoji jako primarni aktivni vrstva,
4. otevre se `StarCoreInteriorScreen` ve stavu `entering`,
5. po dokonceni transition se screen prepne do `active`.

Pravidla transition:

1. `double click` zustava jediny vstupni trigger,
2. nesmi vzniknout druhy potvrzovaci klik pred otevrenim screen,
3. `Esc` je povoleno jen pokud jeste nebezi nevratna command sekvence,
4. reduced-motion varianta preskoci dlouhou animaci, ale stale ukaze zmenu vrstvy,
5. transition nesmi byt implementovana jako dalsi zoom uvnitr 3D scene.

## 7. Return contract

Navrat z interieru musi byt explicitni a predikovatelny:

1. `StarCoreInteriorScreen` poskytuje `onReturnToSpace`,
2. return zavre screen pres stav `returning`,
3. po dokonceni return se operator vrati do `Galaxy Space`,
4. `Galaxy Space` obnovi focus na `Star Core`,
5. kamera po navratu neudela novy necekany zoom nebo preskok,
6. dokud neni potvrzen `policy lock`, navrat je bezpecny a reverzibilni.

Minimalni FE kontrakt po navratu:

1. zustava zachovana backend pravda nactena pred vstupem nebo refreshnuta canonical read modelem,
2. FE neoznaci `first_orbit_ready`, pokud to nevrati backend,
3. `GalaxySelectionHud` po navratu ukazuje stejny nebo aktualizovany `Star Core` stav bez lokalniho fake posunu.

## 8. BE truth a FE local guard

Canonical pravda pro tento blok zustava:

1. `GET /galaxies/{galaxy_id}/star-core/interior`
2. `POST /galaxies/{galaxy_id}/star-core/interior/constitution/select`
3. `POST /galaxies/{galaxy_id}/star-core/policy/lock`

FE lokalne smi drzet jen:

1. jestli je interior screen otevreny,
2. jestli je screen v `entering`, `active` nebo `returning`,
3. recoverable UI chybu navazanou na transition nebo navrat,
4. reduced-motion preferenci.

FE lokalne nesmi drzet jako finalni workflow pravdu:

1. `interior_phase`,
2. `lock_ready`,
3. `lock_transition_state`,
4. `first_orbit_ready`.

## 9. Pripraveny kod z archivu

Aktivni reuse mapa:

1. `docs/P0-core/contracts/aktivni/fe/fe-archivni-technical-inventory-a-reuse-map-v1CZ.md`

Porada nad archivem pro tento blok:

1. `OK` `starContract.js`
   - proc: normalizace `Star Core` truth a naming je uz overena.
   - co prevzit: pouze helper logiku pro stav hvezdy, pokud bude potreba pri navratu do exterioru.
2. `OK` `lawResolver.js`
   - proc: navazuje na BE constitution/policy data bez tvorby nove surface.
   - co prevzit: jen mapovani explainability nebo tonalit, pokud to bude potreba pro shell placeholder.
3. `OK` `previewAccessibility.js`
   - proc: muze pomoci s reduced-motion a citelnou fallback vrstvou.
   - co prevzit: jen pomocne a11y utility.
4. `NOK` `GovernanceModeSurface.jsx`
   - proc: vratilo by stary produktovy surface a porusilo reset.
   - co odstranit: nevracet do aktivni cesty ani po castech v tomto bloku.
5. `NOK` `QuickGridOverlay.jsx`
   - proc: je mimo scope a tahlo by blok do grid workflow.
   - co odstranit: zadna aktivace v `Bloku 3a`.
6. `NOK` `PlanetBuilderWizardHarnessPanel.jsx`
   - proc: predbiha builder.
   - co odstranit: nulove reuse v tomto bloku.

V tomto bloku se skutecne maji pouzit nebo pripravit:

1. existujici `starCoreInteriorAdapter.js`
2. novy `starCoreInteriorScreenModel.js`
3. pripadne male helpery pro transition a return contract

## 10. Aktivni soubory pro implementaci

Ocekavane zmeny se maji soustredit jen sem:

1. `frontend/src/components/universe/UniverseWorkspace.jsx`
2. `frontend/src/components/universe/UniverseCanvas.jsx`
3. `frontend/src/components/universe/GalaxySelectionHud.jsx`
4. novy `frontend/src/components/universe/StarCoreInteriorScreen.jsx`
5. novy `frontend/src/components/universe/starCoreInteriorScreenModel.js`
6. `frontend/src/components/universe/starCoreInteriorAdapter.js`
7. focused testy v `frontend/src/components/universe/`

## 11. Implementacni kroky

Poradi implementace:

1. oddelit `StarCoreInteriorScreen` od `UniverseCanvas`,
2. vytvorit `starCoreInteriorScreenModel` pro shell a return stavy,
3. prevest vstup `double click -> entry` na screen transition,
4. pridat jasny `return contract`,
5. upravit `GalaxySelectionHud`, aby respektoval oddelenou screen vrstvu,
6. ponechat `Constitution Select` jen jako pripraveny slot, ne finalni workflow surface,
7. pridat focused testy a screenshot-ready stavy.

## 12. Focused gate

### 12.1 Focused testy

Minimalni focused sada:

1. `StarCoreInteriorScreen.test.jsx`
2. `starCoreInteriorScreenModel.test.js`
3. test, ze `double click` na hvezdu otevira screen misto interior zoomu v canvasu,
4. test, ze `onReturnToSpace` vraci operatora do `Galaxy Space`,
5. test reduced-motion varianty transition.

### 12.2 Screenshot gate

Povinne screenshoty:

1. `star_core_exterior_before_entry`
2. `star_core_interior_screen_entering`
3. `star_core_interior_screen_active`
4. `star_core_interior_screen_returning`
5. `star_core_exterior_after_return`

### 12.3 Completion slovnik

Pro tento blok se completion hlasi po kategoriich:

1. `technical completion`
   - `StarCoreInteriorScreen` existuje jako samostatna obrazovka a focused testy jsou pripraveny.
2. `user-visible completion`
   - operator vidi odlisnou pracovni vrstvu pri vstupu i navratu.
3. `documentation completion`
   - tento dokument a navazne FE aktivni dokumenty ukazuji `Blok 3a` jako aktualni provadeci krok.
4. `gate completion`
   - screenshoty a focused validace potvrdi, ze interior uz neni jen dalsi zoom v jednom canvasu.

## 13. Otevrene navazani po tomto bloku

Po uzavreni `Bloku 3a` ma navazovat:

1. `Blok 3b` finalni obsah `Constitution Select` uvnitr hotoveho shellu,
2. `Blok 3c` canonical `Policy Lock` command a `first_orbit_ready`,
3. teprve potom navazujici priprava na `Blok 4`.
