# FE runtime a dokumentacni mapa v1

Stav: aktivni (audit souladu FE runtime a aktivni dokumentace)
Datum: 2026-03-13
Vlastnik: FE architektura + user-agent governance

## 1. Co se zmenilo

- [x] 2026-03-13 Aktivni FE dokumentace byla srovnana s realnym runtime stavem.
- [x] 2026-03-13 Bylo explicitne potvrzeno, ze `Blok 4` je jen `planet topology and orbit baseline`.
- [x] 2026-03-13 Uz splnene FE slice dokumenty `Bloku 1`, `Bloku 2` a detail `kamera/radar` byly presunuty do `docs/P0-core/contracts/splneno/fe/`.

## 2. Proc to vzniklo

Aktivni FE dokumentace se rozutekla do tri ruznych vrstev:

1. kanonicka pravda pro dnesni runtime,
2. splnene slice, ktere uz mely byt jen dukaz,
3. budouci vrstvy (`command bar`, `grid`, builder, onboarding), ktere v runtime jeste nejsou.

Bez tohoto auditu hrozilo, ze:

1. `aktivni/fe` bude pusobit, jako by vsechny dokumenty mely stejny status,
2. `Blok 4` natece do dalsich vrstev jen proto, ze helpery uz existuji v kodu,
3. dalsi prace se bude opirat o sum, ne o realny runtime.

## 3. Overena runtime pravda k 2026-03-13

### 3.1 Co je v kodu skutecne zapojene

1. `Galaxy Space` navigation a `Star Core exterior` jsou aktivni runtime baseline.
2. `Star Core interior` je oddeleny screen mimo `UniverseCanvas`.
3. `Constitution Select -> Policy Lock -> first_orbit_ready` baseline uz jede pres canonical endpointy.
4. Planetarni topologie je uz zapojena do `UniverseCanvas` a radaru pres `tableRows` a fallback `orbit sloty`.

Evidence:

1. `frontend/src/components/universe/UniverseWorkspace.jsx`
   - `buildGalaxySpaceObjects({ starModel, tableRows, planetPhysicsPayload })` je zapojene do workspace modelu.
   - `interiorScreenState` ridi samostatny `StarCoreInteriorScreen`, ne render uvnitr canvasu.
2. `frontend/src/components/universe/UniverseCanvas.jsx`
   - `PlanetNode` umi `single click` vyber a `double click` approach pro planetu nebo slot.
3. `frontend/src/components/universe/galaxyRadarModel.js`
   - radar bere vsechny `spaceObjects`, tedy i planety/sloty.
4. `frontend/src/components/universe/UniverseWorkspace.test.jsx`
   - testy potvrzuji otevreni samostatneho interior screen a canonical lock flow.

### 3.2 Co v aktivnim runtime zatim neni

1. `command bar`
2. `grid`
3. builder system jako user-visible vrstva
4. onboarding mise / cinematic wrapper
5. `Nexus / Galaxy Selector` jako aktivni authenticated runtime surface

Pravidlo:

1. existence helperu, kontraktu nebo draft dokumentu sama o sobe neznamena, ze je dana vrstva soucast aktivniho FE runtime.

## 4. Aktivni FE dokumenty podle role

### 4.1 Kanonicka pravda pro dnesni runtime

1. `docs/P0-core/governance/fe-collaboration-single-source-of-truth-v2CZ.md`
2. `docs/P0-core/contracts/aktivni/fe/fe-runtime-a-dokumentacni-mapa-v1CZ.md`
3. `docs/P0-core/contracts/aktivni/fe/fe-master-spec-hlavni-pracovni-prostor-galaxie-v1CZ.md`
4. `docs/P0-core/contracts/aktivni/fe/fe-vykonavaci-dokument-galaxy-space-workspace-v1CZ.md`
5. `docs/P0-core/contracts/aktivni/fe/fe-be-fe-projekcni-mapa-hlavni-pracovni-prostor-v1CZ.md`
6. `docs/P0-core/contracts/aktivni/fe/fe-be-pravda-a-data-guard-v1CZ.md`

### 4.2 Aktivni implementacni slice, ktere jeste drzi runtime relevanci

1. `docs/P0-core/contracts/aktivni/fe/fe-blok-3-implementacni-dokument-v1CZ.md`
2. `docs/P0-core/contracts/aktivni/fe/fe-blok-3a-star-core-interior-screen-implementacni-dokument-v1CZ.md`
3. `docs/P0-core/contracts/aktivni/fe/fe-blok-3b-ritual-chamber-implementacni-mapa-v1CZ.md`
4. `docs/P0-core/contracts/aktivni/fe/fe-blok-4-implementacni-dokument-v1CZ.md`

### 4.3 Aktivni podklad, ale ne dnesni runtime coverage

1. `docs/P0-core/contracts/aktivni/fe/fe-builder-system-galaxy-space-workspace-v1CZ.md`
2. `docs/P0-core/contracts/aktivni/fe/command-lexicon-cz-v1CZ.md`
3. `docs/P0-core/contracts/aktivni/fe/parser-alias-learning-and-event-preview-v1CZ.md`
4. `docs/P0-core/contracts/aktivni/fe/fe-vision-v2-spatial-galaxy-entry-v1CZ.md`
5. `docs/P0-core/contracts/aktivni/ux/ux-operation-layer-grid-command-v1CZ.md`
6. `docs/P0-core/contracts/aktivni/ux/ux-onboarding-story-missions-v1CZ.md`

Pravidlo:

1. tyto dokumenty zustavaji aktivnim smerem, ale nesmi byt citene jako dukaz, ze je vrstva uz dorucena v runtime.

### 4.4 Historicky dukaz

1. `docs/P0-core/contracts/splneno/fe/fe-kamera-radar-interaction-detail-v1CZ.md`
2. `docs/P0-core/contracts/splneno/fe/fe-blok-1-implementacni-dokument-v1CZ.md`
3. `docs/P0-core/contracts/splneno/fe/fe-blok-2-implementacni-dokument-v1CZ.md`

## 5. Zavazny vyklad `Bloku 4`

Od 2026-03-13 plati bez vyjimky:

1. `Blok 4` = jen `planet topology and orbit baseline`.
2. `Blok 4` smi resit pouze planety, orbit sloty, jejich vyber, approach a radarovou/navaznou projekci.
3. `Blok 4` nesmi otevrit `grid`, `command bar`, builder, onboarding ani dalsi power-user surface.
4. To, ze uz v kodu existuji helpery nebo podpurne modely pro dalsi vrstvy, neni duvod tyto vrstvy do `Bloku 4` potichu vratit.

## 6. Evidence

```bash
cd /mnt/c/Projekty/Dataverse
nl -ba frontend/src/components/universe/UniverseWorkspace.jsx | sed -n '269,420p'
nl -ba frontend/src/components/universe/UniverseCanvas.jsx | sed -n '139,260p'
nl -ba frontend/src/components/universe/galaxyRadarModel.js | sed -n '1,120p'
nl -ba frontend/src/components/universe/UniverseWorkspace.test.jsx | sed -n '245,435p'
```

Overeny vysledek:

1. `UniverseWorkspace.jsx` drzi `interiorScreenState`, `spaceObjects` a `buildGalaxySpaceObjects(...)`.
2. `UniverseCanvas.jsx` renderuje `PlanetNode` s `single click` vyberem a `double click` approach.
3. `galaxyRadarModel.js` sklada marker mapu ze vsech `spaceObjects`.
4. `UniverseWorkspace.test.jsx` potvrzuje oddeleny `StarCoreInteriorScreen` i canonical lock flow.
