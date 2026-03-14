# FE Blok 1 implementacni dokument v1

Stav: splneno (vykonavaci dokument uzavreneho Bloku 1)
Datum: 2026-03-12
Vlastnik: FE architektura + Produktove UX + user-agent governance

Nahrazeno dalsim aktivnim krokem:

1. `docs/P0-core/contracts/aktivni/fe/fe-vykonavaci-dokument-galaxy-space-workspace-v1CZ.md` (`Blok 2`)

## 1. Vztah k ridicim dokumentum

Tento dokument vykonava:

1. `docs/P0-core/contracts/aktivni/fe/fe-vykonavaci-dokument-galaxy-space-workspace-v1CZ.md`
2. `docs/P0-core/contracts/splneno/fe/fe-kamera-radar-interaction-detail-v1CZ.md`
3. `docs/P0-core/contracts/aktivni/fe/fe-master-spec-hlavni-pracovni-prostor-galaxie-v1CZ.md`
4. `docs/P0-core/contracts/aktivni/fe/fe-be-fe-projekcni-mapa-hlavni-pracovni-prostor-v1CZ.md`
5. `docs/P0-core/contracts/aktivni/fe/fe-be-pravda-a-data-guard-v1CZ.md`

Tento dokument uz neni brainstorming.

Je to posledni priprava pred kodem `Bloku 1`.

## 2. Ucel bloku

Zavest prvni skutecny `Galaxy Space` interaction baseline:

1. volny pohyb kamerou v hlavnim prostoru,
2. `selection` objektu,
3. plynuly `approach`,
4. navrat pres `Esc`,
5. lehky radar/minimapa baseline.

## 3. Presny scope Bloku 1

### 3.1 Stav A: `space_idle`

Implementovat:

1. hlavni prostor galaxie s orientacni hvezdou,
2. volny pohled a pohyb bez hard-locku na hvezdu,
3. radar se zakladnim anchor obsahem,
4. operator position / look direction signal.

### 3.2 Stav B: `object_selected`

Implementovat:

1. vyber objektu `single click`,
2. zvyrazneni objektu ve scene,
3. zvyrazneni objektu v radaru,
4. jemny HUD signal vyberu bez tezkeho panelu.

### 3.3 Stav C: `approach_active`

Implementovat:

1. `double click` jako plynuly approach,
2. zastaveni v citelne vzdalenosti od objektu,
3. zachovani horizontu a prostorove reference,
4. `Esc` navrat o uroven vys.

## 4. Mimo scope

V tomto bloku je zakazane implementovat:

1. `Star Core interior`,
2. `Constitution Select`,
3. `Policy Lock`,
4. `command bar`,
5. `grid`,
6. `builder commit flow`,
7. onboarding cinematic.

## 5. Aktivni soubory pro Blok 1

Ocekavane aktivni zmeny se maji soustredit jen sem:

1. `frontend/src/components/universe/UniverseWorkspace.jsx`
2. `frontend/src/components/universe/UniverseCanvas.jsx`
3. `frontend/src/components/universe/` nove male helper/model moduly pro kameru a radar
4. odpovidajici focused testy v `frontend/src/components/universe/`

Preferovane nove soubory:

1. `galaxyNavigationStateModel.js`
2. `galaxyNavigationStateModel.test.js`
3. `galaxyRadarModel.js`
4. `galaxyRadarModel.test.js`
5. `galaxySelectionHud.jsx`
6. `galaxySelectionHud.test.jsx`

Pravidlo:

1. nerozsirovat zbytecne `UniverseWorkspace.jsx`,
2. kamera a selection state musi byt oddeleny od renderu,
3. radar model musi byt oddeleny od scene.

## 6. Stavovy model

Blok 1 ma explicitne rozlisovat:

1. `space_idle`
2. `object_selected`
3. `approach_active`

Minimalni rozhodovaci pravidla:

1. `single click` prepina `space_idle -> object_selected`,
2. `double click` na vybrany objekt prepina `object_selected -> approach_active`,
3. `Esc` vraci `approach_active -> object_selected` nebo `object_selected -> space_idle`,
4. approach nesmi otevrit dalsi interakcni vrstvu,
5. radar musi zrcadlit stejny `selection focus` jako scena.

## 7. Vazba na backend pravdu

Pro Blok 1 je povinna tato pravda:

1. `GET /galaxies`
2. `GET /branches`
3. `GET /galaxies/{galaxy_id}/star-core/policy`
4. `GET /galaxies/{galaxy_id}/star-core/physics/profile`
5. `GET /universe/tables`
6. summary feedy pro radar fallback dle `fe-be-fe-projekcni-mapa-hlavni-pracovni-prostor-v1CZ.md`

Implementacni pravidla:

1. radar nesmi kreslit objekty, ktere nemaji oporu v payloadu,
2. hvezda a scope signal nesmi lhat o branch ani o galaxy identite,
3. kdyz detail planety neni jeste pripraveny, musi radar pouzit summary fallback, ne domnely detail.

## 8. Pripraveny kod z archivu

Pro tento blok je pripraveny kod:

1. `frontend/src/_inspiration_reset_20260312/components/universe/UniverseCanvas.jsx`
2. `frontend/src/_inspiration_reset_20260312/components/universe/cameraPilotMath.js`
3. `frontend/src/_inspiration_reset_20260312/components/universe/previewAccessibility.js`

V tomto bloku se skutecne maji vratit:

1. `UniverseCanvas.jsx` nebo jeho spatial jadro,
2. `cameraPilotMath.js`
3. podle potreby `previewAccessibility.js`

V tomto bloku se zatim nemaji vratit:

1. `QuickGridOverlay.jsx`
2. `useCommandBarController.js`
3. `planetBuilderFlow.js`
4. `visualBuilderStateMachine.js`

## 9. Konkretni implementacni kroky

Poradi implementace:

1. vytvorit `galaxyNavigationStateModel` jako cisty resolver pro `idle/selected/approach`,
2. vratit spatialni `UniverseCanvas` jadro s volnym pohybem,
3. pridat `single click` selection a `double click` approach,
4. pridat `Esc` navrat,
5. vytvorit `galaxyRadarModel`,
6. pridat lehky radar render,
7. pridat jemny selection HUD signal,
8. pridat screenshot-ready stavy,
9. pridat focused testy.

## 10. Focused gate

### 10.1 Focused testy

Minimalni pozadovane focused testy:

1. `galaxyNavigationStateModel.test.js`
2. `galaxyRadarModel.test.js`
3. focused render test `space_idle`
4. focused render test `object_selected`
5. focused render test `approach_active`
6. focused test pro `Esc return`

### 10.2 Screenshot gate

Povinne screenshoty:

1. `space_idle`
2. `object_selected`
3. `approach_active`

### 10.3 Prisnejsi nez MVP

Blok se nesmi uzavrit, pokud:

1. kamera pusobi stale jako "hero render" misto pracovniho prostoru,
2. approach konci prilis blizko a rozbije orientaci,
3. radar neni citelny nebo neodpovida scene,
4. zmena je viditelna hlavne textove a ne prostorove.

## 11. Co se nepocita jako completion

1. parallax bez realne navigace,
2. vyber objektu bez citelneho radaru,
3. zoom bez kontrolovaneho navratu,
4. screenshot jednoho hezkeho stavu bez interakcni logiky.

## 12. Evidence

Minimalni dukaz:

```bash
cd /mnt/c/Projekty/Dataverse
sed -n '1,260p' docs/P0-core/contracts/aktivni/fe/fe-vykonavaci-dokument-galaxy-space-workspace-v1CZ.md
sed -n '1,260p' docs/P0-core/contracts/splneno/fe/fe-kamera-radar-interaction-detail-v1CZ.md
sed -n '1,260p' docs/P0-core/contracts/aktivni/fe/fe-master-spec-hlavni-pracovni-prostor-galaxie-v1CZ.md
sed -n '1,260p' frontend/src/_inspiration_reset_20260312/components/universe/UniverseCanvas.jsx
sed -n '1,260p' frontend/src/_inspiration_reset_20260312/components/universe/cameraPilotMath.js
```

## 13. Co zustava otevrene

- [x] 2026-03-12 Kamera, selection/approach i radar baseline byly vyhodnoceny jako dostatecne pro otevreni `Bloku 2`.
