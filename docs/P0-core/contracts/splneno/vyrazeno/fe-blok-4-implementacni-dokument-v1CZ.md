# FE Blok 4 implementacni dokument v1

Stav: aktivni (priprava dalsiho runtime rezu po docasnem pozastaveni `Bloku 3`)
Datum: 2026-03-13
Vlastnik: FE architektura + Produktove UX + user-agent governance

## 0. Otevreni bloku a duvod

`Blok 4` se otevírá jako řízený navazující FE řez v situaci, kdy:

1. `Blok 3` ma aktivni smer a dokumentaci,
2. `Star Core interior` je ale docasne pozastaven kvuli externi priprave authored hero objektu,
3. FE vyvoj se proto nesmi zablokovat na jednom visual hero assetu,
4. dalsi produktove smysluplny a backend-ready rez je `Planet topology and orbit baseline`.
5. Od 2026-03-13 plati zavazne zuzeni: `Blok 4` = jen planetarni topologie a nic vic.

Pravidlo:

1. toto neni zruseni `Bloku 3`,
2. toto je kontrolovana vyjimka v poradi bloků,
3. po dodani externiho interieroveho assetu se `Blok 3` vrati do aktivni implementace,
4. `Blok 4` mezitim rozsiruje hlavni `Galaxy Space Workspace` o skutecnou planetarni pracovni topologii.
5. zadny `grid`, `command bar`, builder ani dalsi operation vrstva se timto blokem neotevira.

## 1. Vztah k ridicim dokumentum

Tento dokument vykonava:

1. `docs/P0-core/governance/fe-collaboration-single-source-of-truth-v2CZ.md`
2. `docs/P0-core/contracts/aktivni/fe/fe-vykonavaci-dokument-galaxy-space-workspace-v1CZ.md`
3. `docs/P0-core/contracts/aktivni/fe/fe-master-spec-hlavni-pracovni-prostor-galaxie-v1CZ.md`
4. `docs/P0-core/contracts/aktivni/fe/fe-be-fe-projekcni-mapa-hlavni-pracovni-prostor-v1CZ.md`
5. `docs/P0-core/contracts/aktivni/fe/fe-be-pravda-a-data-guard-v1CZ.md`
6. `docs/P0-core/contracts/aktivni/fe/fe-builder-system-galaxy-space-workspace-v1CZ.md`
7. `docs/P0-core/contracts/aktivni/ux/ux-journeys-and-visual-language-v1CZ.md`

Provadeci pravidlo:

1. `Blok 4` zustava soucast hlavniho `Galaxy Space`,
2. nesmi se zmenit v builder shell ani v detail planety,
3. ma pripravit teren pro navazujici `grid open from planet context`,
4. nema znovu vratit panelovy FE smer.

## 2. Ucel bloku

Dodat prvni skutecnou planetarni topologii uvnitr hlavniho pracovního prostoru galaxie:

1. promítnout vice planet do prostoru podle backend truth,
2. navazat jejich pozici, velikost a stav na realna data,
3. udelat z planety citelny pracovni objekt, ne dekorativni bod,
4. udrzet `Star Core` jako governance kotvu, ale ne jediny nosic cele sceny,
5. dorucit jen topologii, selection a approach bez otevreni dalsich user-visible vrstev.

Trust-repair pravidlo:

1. kdyz backend vrati prazdne `tableRows`, `Blok 4` nesmi selhat do prazdne sceny,
2. v takovem pripade FE vykresli `orbit sloty` nebo `latentni planetarni mista`,
3. tyto sloty nejsou planety a nesmi se tak tvarit,
4. jakmile existuji realne planety z backendu, sloty ustupuji realnym objektum.

## 3. Presny scope Bloku 4

### 3.1 Stav A: `planet_topology_idle`

Implementovat:

1. vice planet nebo orbit slotu v prostoru,
2. vazbu na `sector.center` a `sector.size`,
3. citelne rozlozeni v galaxii bez shluknuti do jednoho bodu,
4. lehkou, ale realnou orientaci pres `constellation` nebo obdobny prostorovy vzor.

Pravidlo:

1. kdyz nejsou planety, scéna ukaze `empty planetary topology`,
2. kdyz planety existuji, scena ukaze `active planetary topology`.

### 3.2 Stav B: `planet_topology_selected`

Implementovat:

1. citelny vyber planety bez otevreni panelu,
2. diegeticke zvyrazneni vybrane planety,
3. zachovani volneho prostoru kolem ni,
4. radar/minimapa a scena musi drzet stejny selection focus.

### 3.3 Stav C: `planet_topology_approach`

Implementovat:

1. priblizeni k planete bez ztraty orientace,
2. citelny rozdil mezi vzdalenym pozorovanim a pracovnim priblizenim,
3. pripraveny prah pro budouci otevreni `grid` kontextu,
4. stale bez otevreni datoveho editoru v tomto bloku.

## 4. Mimo scope

V tomto bloku je zakazane implementovat:

1. `Star Core interior`,
2. `command bar baseline`,
3. otevreni `grid`,
4. editaci `civilization`,
5. capability / `moon` detail,
6. bond builder,
7. onboarding cinematic.
8. jakoukoliv dalsi user-visible operation vrstvu nad ramec topologie.

## 5. Aktivni soubory pro Blok 4

Ocekavane aktivni zmeny se maji soustredit sem:

1. `frontend/src/components/universe/UniverseWorkspace.jsx`
2. `frontend/src/components/universe/UniverseCanvas.jsx`
3. male helper/model moduly pro planetarni topologii
4. odpovidajici focused testy v `frontend/src/components/universe/`

Preferovane nove soubory:

1. `planetTopologyStateModel.js`
2. `planetTopologyStateModel.test.js`
3. `planetTopologyVisualModel.js`
4. `planetTopologyVisualModel.test.js`
5. `planetTopologyLabels.js`
6. `planetTopologyLabels.test.js`

Pravidlo:

1. nerozsirovat `UniverseWorkspace.jsx` o nahromadenou projekcni logiku,
2. topologii, selection stav a vizualni projekci oddelit do helperů,
3. nepouzit jeden velky monolitni planet render helper.

## 6. Stavovy model

Blok 4 ma explicitne rozlisovat:

1. `planet_topology_idle`
2. `planet_topology_selected`
3. `planet_topology_approach`

Minimalni rozhodovaci pravidla:

1. `space_idle` zustava nadradzeny workspace stav,
2. `single click` na planetu prepina do `planet_topology_selected`,
3. `double click` na vybranou planetu prepina do `planet_topology_approach`,
4. `Esc` vraci `approach -> selected -> free space`,
5. tento blok jeste neotevira `grid_open`.

## 7. Vazba na backend pravdu

Pro `Blok 4` je povinna tato pravda:

1. `GET /universe/tables`
2. summary/runtime feedy pouzivane v `fe-be-fe-projekcni-mapa-hlavni-pracovni-prostor-v1CZ.md`
3. aktivni planetarni physics/runtime derivace potvrzene v FE projekcni mape

Implementacni pravidla:

1. `sector.center` urcuje prostorovou pozici,
2. `sector.size` urcuje rozsah nebo radialni vahy v prostoru,
3. `constellation_name` smi ovlivnit seskupeni nebo orientacni logiku,
4. runtime/physics data smi ridit jen odvozene vizualni chovani:
   - velikost,
   - jas,
   - puls,
   - stabilitu,
   - degradaci,
5. kdyz payload chybi nebo je neurcity, FE nesmi vymyslet finalni zdravy stav planety.

## 8. Pripraveny kod z archivu

Pro tento blok je pripraveny kod:

1. `frontend/src/_inspiration_reset_20260312/components/universe/planetPhysicsParity.js`
2. `frontend/src/_inspiration_reset_20260312/components/universe/runtimeProjectionPatch.js`
3. `frontend/src/_inspiration_reset_20260312/components/universe/runtimeDeltaSync.js`

V tomto bloku se skutecne maji vratit nebo rozumne zrecyklovat:

1. `planetPhysicsParity.js`
2. `runtimeProjectionPatch.js`
3. `runtimeDeltaSync.js`

Prvni runtime rez tohoto bloku ma realne vratit:

1. logiku parity z `planetPhysicsParity.js` do aktivniho helperu `planetTopologyVisualModel.js`,
2. bez primeho navratu obsolete `asteroid*` patchingu z `runtimeProjectionPatch.js`,
3. bez primeho navratu `runtimeDeltaSync.js` v tomto prvnim vizualnim rezu.

V tomto bloku se zatim nemaji vracet:

1. `QuickGridOverlay.jsx`
2. `useCommandBarController.js`
3. `visualBuilderStateMachine.js`
4. `planetBuilderFlow.js`
5. zadne stare shell panely.

## 9. Konkretni implementacni kroky

Poradi implementace:

1. vytvorit `planetTopologyStateModel` pro `idle/selected/approach`,
2. vytvorit `planetTopologyVisualModel` pro mapovani backend dat do prostoru,
3. propsat planety do `UniverseCanvas.jsx`,
4. oddelit diegeticke planet labely do helperu,
5. navazat selection a approach chovani bez grid otevreni,
6. propsat focus do workspace a radar/minimapy,
7. dodelat focused testy,
8. pripravit screenshot-ready stavy.

## 10. Focused gate

### 10.1 Focused testy

Minimalni pozadovane focused testy:

1. `planetTopologyStateModel.test.js`
2. `planetTopologyVisualModel.test.js`
3. `planetTopologyLabels.test.js`
4. focused render test `planet_topology_idle`
5. focused render test `planet_topology_selected`
6. focused render test `planet_topology_approach`
7. focused test pro fallback pri chybejicich nebo neuplnych datech

### 10.2 Screenshot gate

Povinne screenshoty:

1. `prazdna galaxie se sloty` nebo `vice planet v prostoru`
2. `vybrany orbit slot` nebo `vybrana planeta`
3. `approach na slot` nebo `approach na planetu`
4. pokud bude dostupna vizualni degradace nebo ruzne fyzikalni profily, i porovnani alespon dvou odlisnych planet

### 10.3 Prisnejsi nez MVP

Blok se nesmi uzavrit, pokud:

1. planety pusobi stale jen jako nahodne svetelne body,
2. vyber planety nebo slotu je citelny jen pres text nebo externi kartu,
3. vice planet nebo slotu neukazuje skutecnou topologii prostoru,
4. visual stavy nemaji vazbu na backend truth,
5. vysledek je jen “vic objektu ve scene”, ale ne pracovni topologie.

## 11. Co se nepocita jako completion

1. dekorativni body bez vazby na `GET /universe/tables`,
2. vetsi pocet objektu bez selection logiky,
3. planety odlisene jen copy nebo badge,
4. dalsi HUD panel misto skutecne prostorove topologie,
5. screenshot jednoho hezkeho uhlu bez realneho `selected/approach` flow.

## 12. Evidence

Minimalni dukaz:

```bash
cd /mnt/c/Projekty/Dataverse
sed -n '220,360p' docs/P0-core/contracts/aktivni/fe/fe-vykonavaci-dokument-galaxy-space-workspace-v1CZ.md
sed -n '1,240p' docs/P0-core/contracts/aktivni/fe/fe-builder-system-galaxy-space-workspace-v1CZ.md
sed -n '700,760p' docs/P0-core/contracts/aktivni/fe/fe-be-fe-projekcni-mapa-hlavni-pracovni-prostor-v1CZ.md
sed -n '1,240p' frontend/src/_inspiration_reset_20260312/components/universe/planetPhysicsParity.js
```

## 13. Co zustava otevrene

- [x] 2026-03-13 `Blok 4` byl oficialne pripraven jako dalsi runtime rez mimo docasne pozastaveny `Blok 3`.
- [ ] Dodat runtime implementaci `Bloku 4`.
- [ ] Dodat screenshot gate `vice planet v prostoru / vybrana planeta / approach`.
- [ ] Dodat focused test gate pro stavovou a vizualni projekci planet.
- [ ] Po uzavreni `Bloku 4` otevrit `grid open from planet context` jako dalsi builder slice.
