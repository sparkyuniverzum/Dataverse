# FE implementacni poradi a definice Slice 1 v1

Stav: splneno (historicka stopa puvodniho FE smeru nahrazena resetem 2026-03-12)
Datum: 2026-03-12
Vlastnik: Produktove UX + FE architektura + user-agent governance

## 0. Status 2026-03-12

Tento dokument uz neni aktivnim vykonavacim planem pro FE.

Od 2026-03-12 je aktivni:

- `docs/P0-core/contracts/aktivni/fe/fe-reset-ramec-v1CZ.md`

Duvod:

1. aktivni authenticated FE runtime byl resetovan na minimalisticky zaklad,
2. puvodni slice poradi predpokladalo pokracovani nad legacy workspace stromem,
3. tento predpoklad uz po FE resetu neplati.

Tento soubor zustava zachovan pouze jako:

1. historicka stopa puvodniho FE planu,
2. auditovatelný zapis pred-reset rozhodnuti,
3. neaktivni reference pro srovnani.

## 1. Ucel

Prevest aktivni FE/UX kontrakty do jednoho zavazneho implementacniho poradi, aby:

1. FE vyvoj zacinal spravnym zakladem,
2. `Slice 1` mel presny a auditovatelny scope,
3. wow efekt nevznikal na ukor operacni citelnosti,
4. completion tvrzeni byla vazana na stejny dukazni standard jako ostatni aktivni kontrakty.

## 2. Proc tento dokument vznika

Aktivni FE kontrakty uz definuji:

1. IA a hierarchii vrstev,
2. journey quality gate,
3. komponentovy behavior kontrakt,
4. operation vrstvu,
5. onboarding misi,
6. FE rizika a guardraily.

Co ale dosud chybelo:

1. jedno zavazne poradi FE sliceu,
2. presna definice prvniho implementacniho bloku,
3. explicitni hard-stop pravidla pro to, co se nesmi preskocit,
4. jednotna DoD sada pro `Slice 1`.

Bez tohoto dokumentu hrozi, ze FE implementace zacne lokalnim polishem nebo "wow" vrstvou driv, nez bude stabilni first-view operating-center zaklad.

## 3. Zavazne vstupni principy

Tento dokument je odvozen z:

1. `docs/P0-core/governance/human-agent-alignment-protocol-v1.md`
2. `docs/P0-core/contracts/aktivni/ux/ux-ia-navigation-architecture-v1CZ.md`
3. `docs/P0-core/contracts/aktivni/ux/ux-journeys-and-visual-language-v1CZ.md`
4. `docs/P0-core/contracts/aktivni/ux/ux-fe-component-behavior-contract-v1CZ.md`
5. `docs/P0-core/contracts/aktivni/ux/ux-operation-layer-grid-command-v1CZ.md`
6. `docs/P0-core/contracts/aktivni/ux/ux-fe-risk-assessment-v1CZ.md`
7. `docs/P0-core/contracts/aktivni/ux/ux-onboarding-story-missions-v1CZ.md`

Zavazne principy:

1. `Operation Layer` je primarni autorska a exekucni plocha.
2. `Scene Layer` a `HUD Layer` posiluji orientaci a duveru, nesmi ale schovavat hlavni operacni zonu.
3. Prvni dojem a prvnich 30 s maji vyssi prioritu nez interni refaktor.
4. Onboarding nesmi maskovat slaby workspace zaklad.
5. `technical completion`, `user-visible completion`, `documentation completion` a `gate completion` musi byt vzdy oddelene.

## 4. Zavazne FE implementacni poradi

## 4.1 Slice 0: FE execution order + gate map

Cil:
Zafixovat poradi FE implementace, hard-stop pravidla a dukazni standard.

Vystup:

1. tento dokument,
2. mapovani navaznych kontraktu na jednotlive slice,
3. explicitni definice `Slice 1`.

## 4.2 Slice 1: First-view operating center foundation

Cil:
Prvni otevreni `Workspace` musi okamzite pusobit jako operating center a byt akcne citelne bez "kde jsem?" momentu.

Primarni fokus:

1. first-view kompozice,
2. dominance `Operation Layer`,
3. viditelny `scope/mode` stav,
4. jasna hierarchie `Scene Layer` / `HUD Layer` / `Operation Layer`,
5. viewport-ready layout guardrails.

## 4.3 Slice 2: Operation loop

Cil:
Grid + command bar musi byt nejrychlejsi a nejcitelnejsi pracovni vrstva.

Primarni fokus:

1. create/edit/link/extinguish flow,
2. parser preview a explainability,
3. repair hints,
4. command lexikon a backend capability alignment.

## 4.4 Slice 3: Behavior and determinism hardening

Cil:
Stabilizovat latenci, synchronizaci, recovery a parity pravidla po uzavreni zakladniho operation loopu.

Primarni fokus:

1. deterministic feedback,
2. runtime/UI sync,
3. latency budgety,
4. keyboard a reduce-motion parity.

## 4.5 Slice 4: Onboarding

Cil:
Pridat onboarding az na stabilni zaklad first-view a operation loopu.

Primarni fokus:

1. wow vrstva,
2. guided mission,
3. optional curiosity layer,
4. skip-first a non-blocking princip.

## 5. Proc je toto poradi zavazne

1. IA kontrakt vyzaduje, aby `Operation Layer` byl akcne pripraveny uz ve first paint.
2. Journey kontrakt vyzaduje jasny scope, mode a dalsi akci v prvnich 30 s.
3. FE risk dokument dava prioritu `Operation Layer` pri konfliktu prostoru a zakazuje degradovat workspace na mensich viewports.
4. Behavior kontrakt resi determinismus a latency, ale ten ma smysl az nad jasne definovanou first-view a operation strukturou.
5. Onboarding kontrakt explicitne rika, ze onboarding nesmi blokovat core workflow, a proto nesmi byt prvni implementacni zavislosti.

## 6. Presna definice Slice 1

## 6.1 Scope

`Slice 1` pokryva pouze first-view operating-center zaklad ve `Workspace`.

Do scope patri:

1. prvni vizualni hierarchie po otevreni `Workspace`,
2. dominance hlavni pracovni zony (`Operation Layer`) nad sekundarnimi vrstvami,
3. stale viditelna a srozumitelna indikace `scope` a `mode`,
4. jasna navigacni orientace bez skrytych kritickych controls,
5. layout pravidla pro velky, stredni a kompaktni viewport,
6. user-visible odstraneni "kde jsem?" momentu pri vstupu do workspace.

## 6.2 Mimo scope

Do `Slice 1` nepatri:

1. onboarding mise a mission scripting,
2. plny command-system polish a parser-learning behavior,
3. hluboke operation-flow scenare mimo first-view kriticke akce,
4. cinematic-heavy wow sekvence,
5. rozsahle latency hardening prace mimo first-view kriticke body,
6. finalni visual skin celeho produktu.

## 6.3 Zavazne UI vysledky

Po `Slice 1` musi byt okamzite viditelne:

1. kde uzivatel je,
2. v jakem je `scope` (`MAIN` vs `BRANCH`),
3. v jakem je `mode`,
4. jaka je primarni dalsi akce,
5. ze hlavni operacni plocha neni schovana za efektem nebo dekoraci.

## 7. Slice 1 hard-stop gate

`Slice 1` je blokovan a nesmi byt oznacen za uspesny, pokud plati kterakoli z nasledujicich situaci:

1. first view stale schovava nebo degraduje `Operation Layer`,
2. `scope` nebo `mode` neni stale viditelny a srozumitelny,
3. prvni vstup do `Workspace` vyvolava "kde jsem?" moment,
4. kriticka orientace zavisi na skrytem draweru, hover-only prvku nebo nedetekovatelne navigaci,
5. `Scene Layer` vizualne prehlusi primarni operacni plochu,
6. layout porusi guardraily `R2/R4` uz na desktop/strednim viewportu,
7. zmena je prevazne cinematic nebo kosmeticka bez meritelneho user-visible dopadu.

## 8. Slice 1 DoD

## 8.1 Technical completion

`Slice 1` je technicky dokoncen pouze pokud:

1. `Workspace` first-view kompozice je upravena v souladu s IA hierarchii,
2. `scope/mode` indikace jsou konzistentni a stale viditelne,
3. layout ma explicitni pravidla alespon pro `>=1366px`, `1024-1365px`, `<1024px`,
4. kriticke first-view stavy maji focused FE test coverage,
5. zmena nezavadi ontologicky drift (`civilization = row`, `moon = capability`).

## 8.2 User-visible completion

`Slice 1` je user-visible dokoncen pouze pokud:

1. first view pusobi jako operating center, ne jako dekorativni scena,
2. uzivatel do 30 s rozumi scope, mode a dalsi akci,
3. hlavni pracovni plocha je na prvni pohled citelna a akceschopna,
4. existuje explicitni seznam okamzitych viditelnych zmen oproti predchozimu stavu,
5. rozdil je viditelny bez otevirani skrytych rezimu.

## 8.3 Documentation completion

`Slice 1` je dokumentacne dokoncen pouze pokud:

1. zmeny jsou mapovane na IA, journeys a FE risk guardrails,
2. tento dokument zustava konzistentni s navaznymi kontrakty,
3. pripadne nove pending body jsou explicitne zapsane jako otevrene, ne skryte.

## 8.4 Gate completion

`Slice 1` ma gate completion pouze pokud:

1. probehnou focused FE testy pro workspace/layout/scope-mode indikaci,
2. existuje before/after first-view porovnani,
3. existuje explicitni seznam viditelnych zmen v prvnich 30 s,
4. bundled smoke gate je odlozen az po uzavreni navazne FE slice serie, nevyzaduje se v tomto samostatnem bloku.

## 9. Co se nepocita jako dokonceni Slice 1

1. Interni refaktor bez viditelne zmeny first view.
2. Visual polish bez zlepseni orientace a operacni citelnosti.
3. Samotny pass unit testu bez user-visible rozdilu.
4. Dalsi animace nebo atmosfera bez zlepseni hierarchy.
5. Rozsireni command systemu, pokud first-view workspace stale neni jasny.

## 10. Doporucena focused validace pro Slice 1

Minimalni lokalni validace tohoto bloku ma pokryt:

1. `frontend/src/components/universe/workspaceContract.test.js`
2. `frontend/src/components/universe/operatingCenterUxContract.test.js`
3. `frontend/src/components/universe/surfaceLayoutTokens.test.js`
4. `frontend/src/components/universe/WorkspaceSidebar.connectivity.test.jsx`

Pokud se scope dotkne grid overlay nebo scope badge prezentace, doplnit i:

1. `frontend/src/components/universe/QuickGridOverlay.civilizations.test.jsx`

## 11. Navazne kontrakty

1. `docs/P0-core/contracts/aktivni/ux/ux-ia-navigation-architecture-v1CZ.md`
2. `docs/P0-core/contracts/aktivni/ux/ux-journeys-and-visual-language-v1CZ.md`
3. `docs/P0-core/contracts/aktivni/ux/ux-fe-component-behavior-contract-v1CZ.md`
4. `docs/P0-core/contracts/aktivni/ux/ux-operation-layer-grid-command-v1CZ.md`
5. `docs/P0-core/contracts/aktivni/ux/ux-fe-risk-assessment-v1CZ.md`
6. `docs/P0-core/contracts/aktivni/ux/ux-onboarding-story-missions-v1CZ.md`
