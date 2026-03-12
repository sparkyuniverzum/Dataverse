# FE Blok 3b Ritual Chamber implementacni mapa v1

Stav: aktivni (oficialni provadeci mapa pro user-visible cast `Bloku 3`)
Datum: 2026-03-12
Vlastnik: FE architektura + Produktove UX + user-agent governance

Navazuje na:

1. `docs/P0-core/contracts/aktivni/fe/fe-blok-3a-star-core-interior-screen-implementacni-dokument-v1CZ.md`
2. `docs/P0-core/contracts/aktivni/fe/fe-star-core-interior-ritual-chamber-v1CZ.md`

## 0. Pre-implementation kontrakt

### 0.1 Zavazne podminky prevzate z ridicich dokumentu

Pro tento blok plati jako hard gate:

1. `Star Core interior` zustava samostatna pracovni obrazovka mimo `UniverseCanvas`.
2. `Blok 3b` je prvni user-visible produktovy rez interieru po oddeleni shellu z `Bloku 3a`.
3. Hlavni informacni nosic je prostor, svetlo, jadro, orbit a pohyb.
4. Dashboard, formular, karta nebo panelova kompozice jsou v tomto bloku zakazane.
5. FE nesmi drzet canonical workflow truth mimo backend contract `interior_phase`.
6. `constitution_select`, `policy_lock_ready`, `policy_lock_transition` a `first_orbit_ready` se musi cist z canonical backend pravdy.
7. `work first` plati dale, ale `wow` se musi projevit primarne ve vizualni projekci a fyzicke citelnosti stavu.

### 0.2 Co aktualni runtime porusuje nebo jeste nedorucuje

Aktualni runtime ma uz oddeleny interier screen, ale stale jeste nema oficialne uzavrenou implementacni mapu pro:

1. centralni `Ritual Chamber` kompozici,
2. orbitalni volbu ustavy bez karet,
3. fyzicky citelny `policy lock`,
4. `first_orbit_ready` jako vznik nove drahy,
5. formalni gate, ktera zablokuje dalsi sklouznuti do paneloveho smeru.

### 0.3 Co bude prijatelny dukaz dokonceni

Za prijatelny dukaz pro `Blok 3b` se pocita jen kombinace:

1. runtime implementace podle teto mapy,
2. screenshoty vsech ctyr hlavnich stavu interieru,
3. focused testy pro visual model, render stavy a reduced-motion,
4. explicitni before/after porovnani proti panelovemu smeru,
5. potvrzeni, ze canonical backend faze zustaly autoritou.

### 0.4 Co se za dokonceni pocitat nebude

Za dokonceni se nepocita:

1. preusporadani panelu bez zmeny hlavni kompozice,
2. hezci gradient za boxy,
3. 3D dekorace kolem textoveho layoutu,
4. `lock` stale citelny jako CTA v panelu,
5. `first_orbit_ready` jako report nebo summary sekce.

## 1. Ucel bloku

Prevest schvaleny smer `Ritual Chamber` do konkretni aktivni implementace interieru hvezdy.

Blok ma dorucit:

1. centralni ritualni komoru jako hlavni operacni vrstvu,
2. `constitution_select` jako orbitalni volbu rezimu prostoru,
3. `policy_lock_ready` jako fyzicky citelne sevreni governance prstence,
4. `policy_lock_transition` jako vaznou stabilizacni udalost,
5. `first_orbit_ready` jako zrozeni prvni drahy,
6. silnou user-visible odlisnost od paneloveho smeru.

## 2. Vztah k aktivnim dokumentum

Tento dokument vykonava:

1. `docs/P0-core/contracts/aktivni/core/decision-log-v1CZ.md`
2. `docs/P0-core/contracts/aktivni/core/context-handoff-v1CZ.md`
3. `docs/P0-core/contracts/aktivni/core/new-thread-context-packet-v1CZ.md`
4. `docs/P0-core/contracts/aktivni/fe/fe-vykonavaci-dokument-galaxy-space-workspace-v1CZ.md`
5. `docs/P0-core/contracts/aktivni/fe/fe-blok-3-implementacni-dokument-v1CZ.md`
6. `docs/P0-core/contracts/aktivni/fe/fe-blok-3a-star-core-interior-screen-implementacni-dokument-v1CZ.md`
7. `docs/P0-core/contracts/aktivni/fe/fe-star-core-interior-ritual-chamber-v1CZ.md`
8. `docs/P0-core/contracts/aktivni/fe/fe-be-pravda-a-data-guard-v1CZ.md`
9. `docs/P0-core/contracts/aktivni/ux/ux-fe-component-behavior-contract-v1CZ.md`

Pravidlo:

1. `Blok 3a` zustava architektonicky shell a transition kontrakt,
2. `Blok 3b` je oficialni implementacni mapa pro obsah a vizualni interakci interieru,
3. bez souladu s timto dokumentem se `Blok 3` nesmi prezentovat jako user-visible uzavreny.

## 3. Presny scope Bloku 3b

Implementovat se ma jen:

1. `constitution_select` jako orbitalni prostorovy vyber,
2. `policy_lock_ready` jako centralni ritualni affordance,
3. `policy_lock_transition` jako disciplinovany fyzicky prechod,
4. `first_orbit_ready` jako nova draha a potvrzena dalsi vrstva prostoru,
5. nove male visual/model helpery pro projekci `Ritual Chamber`,
6. focused testy odpovidajici teto kompozici.

## 4. Mimo scope

V tomto bloku je zakazane implementovat:

1. builder planety,
2. `grid`,
3. command bar jako obecnou power-user vrstvu,
4. onboarding replay,
5. navrat paneloveho help surface,
6. dalsi paralelni interaction vrstvu vedle ritualni komory.

## 5. Aktivni soubory pro implementaci

Ocekavane aktivni zmeny se maji soustredit jen sem:

1. `frontend/src/components/universe/StarCoreInteriorScreen.jsx`
2. `frontend/src/components/universe/StarCoreInteriorScreen.test.jsx`
3. `frontend/src/components/universe/starCoreInteriorScreenModel.js`
4. `frontend/src/components/universe/starCoreInteriorScreenModel.test.js`
5. `frontend/src/components/universe/starCoreInteriorAdapter.js`
6. `frontend/src/components/universe/starCoreInteriorAdapter.test.js`
7. novy maly visual helper pro `Ritual Chamber`
8. pouze pokud to bude nutne, tenke zmeny v `UniverseWorkspace.jsx`

Preferovane nove soubory:

1. `starCoreInteriorVisualModel.js`
2. `starCoreInteriorVisualModel.test.js`

Pravidlo:

1. nerozsirovat zbytecne `UniverseWorkspace.jsx`,
2. canonical truth zustava v adapteru,
3. visual projection se ma oddelit do maleho helperu,
4. `StarCoreInteriorScreen.jsx` nema bobtnat o backend normalizaci.

## 6. Stavovy model

`Blok 3b` ma explicitne rozlisovat tyto stavy:

1. `constitution_select`
2. `policy_lock_ready`
3. `policy_lock_transition`
4. `first_orbit_ready`

Minimalni rozhodovaci pravidla:

1. `constitution_select` je faze vice moznosti a ziveho porovnani prostoru,
2. `policy_lock_ready` ma jednu dominantni akci,
3. `policy_lock_transition` je nevratny mezistav po potvrzeni locku,
4. `first_orbit_ready` je klidnejsi potvrzena faze s novou drahou,
5. `Esc` nesmi prerusit `policy_lock_transition`,
6. FE nesmi lokalne vymyslet dalsi finalni workflow stavy.

## 7. Vazba na backend pravdu

Pro `Blok 3b` je povinna tato pravda:

1. `GET /galaxies/{galaxy_id}/star-core/interior`
2. `POST /galaxies/{galaxy_id}/star-core/interior/constitution/select`
3. `POST /galaxies/{galaxy_id}/star-core/policy/lock`
4. `GET /galaxies/{galaxy_id}/star-core/policy`
5. `GET /galaxies/{galaxy_id}/star-core/physics/profile`

Implementacni pravidla:

1. `interior_phase` je jediny canonical zdroj workflow faze,
2. `selected_constitution_id` je jediny canonical zdroj potvrzene volby,
3. `available_constitutions` ridi, ktere orbitalni proudy se mohou zobrazit jako aktivni volba,
4. `first_orbit_ready` se nesmi optimisticly zobrazit bez backend potvrzeni,
5. `next_action` a explainability se smi pouzit jako doprovodny signal, ne jako nahrada prostorove logiky.

## 8. Ritual Chamber implementacni mapa

### 8.1 Stav A: `constitution_select`

Implementovat:

1. centralni jadro jako dominantni fokus,
2. ctyri ustavni proudy rozlozene orbitalne kolem jadra,
3. kazdy proud meni:
   - tonalitu,
   - rytmus,
   - hustotu energie,
   - tvar prstence,
   - fokus svetla v komore.
4. vyber ustavy se ma cist pres prostor a pohyb, ne pres seznam karet,
5. text ma byt jen diegeticky doprovod.

Zakazano:

1. seznam karet,
2. sekce `summary`,
3. levy obsah + pravy box,
4. dlouhy explanatory odstavec jako hlavni fokus.

### 8.2 Stav B: `policy_lock_ready`

Implementovat:

1. zklidneni prostoru po volbe,
2. jeden dominantni lock fokus ve stredu komory,
3. governance prstenec pripraveny na sevreni,
4. jasne citelny dalsi krok bez dalsich konkurencnich akci.

Zakazano:

1. lock jako bezny button panel,
2. vice CTA najednou,
3. oddeleni lock akce do dalsi boxove sekce.

### 8.3 Stav C: `policy_lock_transition`

Implementovat:

1. fyzicke sevreni prstence,
2. zmenu energetickeho rezimu komory,
3. disciplinovany a autoritativni motion,
4. udrzeni focusu na centru bez textoveho prebijeni.

Zakazano:

1. efekty bez vazby na stav,
2. konfety nebo nahodna explozivni show,
3. prerusitelny nebo nejasny lock mezistav.

### 8.4 Stav D: `first_orbit_ready`

Implementovat:

1. novou stabilni drahu jako hlavni vysledek,
2. klidnejsi potvrzenou komoru po locku,
3. jasny signal, ze governance zaklad je uzamcen a prostor muze navazat prvni orbitou,
4. navratovy prikaz zpet do `Galaxy Space`.

Zakazano:

1. report nebo metriky jako hlavni obsah,
2. dashboard se sekcemi `signal`, `summary`, `canonical status`,
3. degradovat orbitu na maly dekorativni detail.

## 9. Pripraveny kod z archivu

Aktivni reuse mapa:

1. `docs/P0-core/contracts/aktivni/fe/fe-archivni-technical-inventory-a-reuse-map-v1CZ.md`

Pro tento blok je pripraveny kod:

1. `starContract.js`
2. `lawResolver.js`
3. `previewAccessibility.js`
4. `starCoreInteriorAdapter.js`
5. `starCoreTruthAdapter.js`

V tomto bloku se skutecne maji pouzit:

1. `lawResolver.js`
2. `previewAccessibility.js`
3. existujici `starCoreInteriorAdapter.js`
4. novy `starCoreInteriorVisualModel.js`

V tomto bloku se zatim nemaji vratit:

1. `QuickGridOverlay.jsx`
2. `useCommandBarController.js`
3. `GovernanceModeSurface.jsx`
4. jakykoli archivni dashboard nebo setup panel

## 10. Konkretni implementacni kroky

Poradi implementace:

1. vytvorit `starCoreInteriorVisualModel` pro mapovani canonical faze do ritualni kompozice,
2. refaktorovat `StarCoreInteriorScreen.jsx` tak, aby hlavni kompozice byla centralni jadro + orbitalni vrstva,
3. odstranit panelove primarni sekce ze screen hlavni hierarchie,
4. propsat `constitution_select` jako orbitalni volbu,
5. propsat `policy_lock_ready` jako centralni ritualni affordance,
6. propsat `policy_lock_transition` jako disciplinovany fyzicky prechod,
7. propsat `first_orbit_ready` jako vznik nove drahy,
8. dodelat reduced-motion variantu,
9. pridat focused testy a screenshot-ready stavy.

## 11. Ofiko gate pro Blok 3b

### 11.1 Technical completion

1. `StarCoreInteriorScreen.jsx` je user-visible vrstva, ne backend normalizer.
2. Canonical workflow truth zustava v `starCoreInteriorAdapter.js`.
3. Visual projection je oddelena do maleho helperu nebo jasne ohranicene vrstvy.
4. Reduced-motion ma explicitni coverage.

### 11.2 User-visible completion

1. Interior se cte jako ritualni komora, ne dashboard.
2. Hlavni fokus je jadro a orbitalni vrstva.
3. `Constitution Select` je citelny bez karet a tabulek.
4. `Policy Lock` pusobi jako fyzicky akt uzamceni.
5. `First Orbit Ready` je viditelny jako nova draha a dalsi krok prostoru.

### 11.3 Documentation completion

1. Tento dokument zustava navazany z `Bloku 3` a `Bloku 3a`.
2. `Pripraveny kod z archivu` je explicitne zapsany.
3. Je uvedeno, co je `OK` a co je `NOK`.

### 11.4 Gate completion

1. focused testy pro visual model,
2. focused render test `constitution_select`,
3. focused render test `policy_lock_ready`,
4. focused render test `policy_lock_transition`,
5. focused render test `first_orbit_ready`,
6. focused test reduced-motion,
7. screenshoty vsech ctyr stavu,
8. explicitni before/after porovnani proti panelovemu smeru.

## 12. Co se nepocita jako completion

1. glow-heavy redesign bez zmeny kompozice,
2. jen prebarveni paneloveho layoutu,
3. textova explainability jako hlavni interakce,
4. `lock` stale skryty v boxovem CTA,
5. `first_orbit_ready` bez zretelne nove drahy.

## 13. Evidence

Minimalni dukaz:

```bash
cd /mnt/c/Projekty/Dataverse
sed -n '1,260p' docs/P0-core/contracts/aktivni/fe/fe-star-core-interior-ritual-chamber-v1CZ.md
sed -n '1,260p' docs/P0-core/contracts/aktivni/fe/fe-blok-3b-ritual-chamber-implementacni-mapa-v1CZ.md
sed -n '1,260p' docs/P0-core/contracts/aktivni/fe/fe-blok-3a-star-core-interior-screen-implementacni-dokument-v1CZ.md
```

Vysledek:

- [x] 2026-03-12 Byl zapsan oficialni provadeci krok `Blok 3b`.
- [x] 2026-03-12 `Ritual Chamber` ma uz nejen smer, ale i explicitni implementacni mapu a ofiko gate.

## 14. Co zustava otevrene

- [ ] Dodat runtime implementaci `Bloku 3b`.
- [ ] Dodat screenshot gate a before/after porovnani proti panelovemu smeru.
- [ ] Dodat focused test gate odpovidajici ritualni komore.
