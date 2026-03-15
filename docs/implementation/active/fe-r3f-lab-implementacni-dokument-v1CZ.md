# FE R3F Lab implementacni dokument v1

Stav: aktivni (vykonavaci dokument pro povolenou oddelenou dev-only cestu)
Datum: 2026-03-14
Vlastnik: FE architektura + UX governance + user-agent governance

## 1. Vztah k ridicim dokumentum

Tento dokument vykonava:

1. `docs/P0-core/contracts/aktivni/fe/fe-r3f-lab-v1CZ.md`
2. `docs/P0-core/contracts/aktivni/core/decision-log-v1CZ.md`
3. `docs/P0-core/governance/fe-collaboration-single-source-of-truth-v2CZ.md`
4. `docs/P0-core/contracts/aktivni/fe/fe-archivni-technical-inventory-a-reuse-map-v1CZ.md`
5. `docs/P0-core/contracts/aktivni/fe/r3f-lab/r3f-lab-implementacni-mapa-v1CZ.md`

Tento dokument uz neni brainstorming.

Je to implementacni podklad pro prvni omezeny blok `R3F Lab v1`.

Tento dokument je povoleny jako oddelena vyjimka mimo obecny FE stop stav.

Tento dokument je jen prvni implementacni cast cele planovane cesty `R3F Lab`.

## 2. Ucel bloku

Otevrit minimalni dev-only `R3F Lab` harness, ktery:

1. oddeli R3F experiment od produktoveho runtime,
2. umozni opakovatelne ladeni pres serializovany preset,
3. poskytne lehkou diagnostiku renderu a interakci,
4. neotevre druhy paralelni workspace ani druhou FE truth vrstvu.

Tento blok je povolen proto, ze `R3F Lab` je povazovan za klicovy enablement bod pro dalsi realizaci projektu.

Blok ma dodat jen prvni provozuschopny zaklad.

Nema dodat cely `Lab` ekosystem.

## 3. Presny scope implementacniho bloku

### 3.1 Faze 0: Harness contract

Implementovat:

1. dev-only vstupni guard pro `R3F Lab`,
2. `labConfigSchema` pro validni serializovany preset,
3. `labSceneRegistry` s explicitnim seznamem podporovanych scen,
4. jednoduchy `labPresetStore` + `labPersistence`,
5. oddeleni semantic preset vrstvy od scene adapteru.

### 3.2 Faze 1: Minimalni vizualni sandbox

Implementovat:

1. `R3FLabEntry`,
2. `R3FLabShell`,
3. `LabCanvas`,
4. placeholder scene surface uvnitr `LabCanvas` pro overeni shellu a renderer baseline,
5. prepInace `debug / cinematic / performance-safe`,
6. zakladni event log,
7. zakladni `renderer.info` a frame timing signal.

### 3.3 Prvni scena

V tomto bloku se ma skutecne otevrit jen:

1. `star_core_interior_core`

V uvodnim start bloku je dovolene otevrit jen placeholder povrch navazany na `star_core_interior_core` id.

Konkretni doménovy adapter a render scena patri az do `Spike B`.

Volitelna druha scena je az dalsi krok:

1. `star_core_exterior`

Pravidlo:

1. prvni blok se ma dokazat uzavrit i s jedinou skutecne fungujici scenou,
2. druha scena nema byt neplanovany dodatek, ale soucast navazneho spike planu cele cesty,
3. pokud by druha scena hrozila rozsirenim prvniho bloku, zustane mimo tento blok, ale ne mimo cely plan.

## 4. Mimo scope

V tomto bloku je zakazane implementovat:

1. `Leva` nebo jinou externi GUI knihovnu,
2. timeline scrubbing,
3. scenario runner,
4. asset hot-swap,
5. backend napojeni a zapis do canonical runtime truth,
6. integraci do `UniverseWorkspace`,
7. redesign `Star Core interior` produktu,
8. druhy produktovy shell nebo novou verejnou navigaci aplikace,
9. rozsirit blok o vice nez `Faze 0 + Faze 1`.
10. vykladat tento blok jako obnoveni obecneho produktoveho FE vyvoje.

## 5. Aktivni soubory pro tento blok

Ocekavane aktivni zmeny se maji soustredit jen sem:

1. `frontend/src/App.jsx`
2. `frontend/src/main.jsx`
3. novy scope `frontend/src/lab/r3f/`
4. focused testy v `frontend/src/lab/r3f/__tests__/`

Preferovane nove soubory:

1. `frontend/src/lab/r3f/R3FLabEntry.jsx`
2. `frontend/src/lab/r3f/R3FLabShell.jsx`
3. `frontend/src/lab/r3f/LabCanvas.jsx`
4. `frontend/src/lab/r3f/labConfigSchema.js`
5. `frontend/src/lab/r3f/labSceneRegistry.js`
6. `frontend/src/lab/r3f/labPresetStore.js`
7. `frontend/src/lab/r3f/labPersistence.js`
8. `frontend/src/lab/r3f/labDiagnosticsModel.js`
9. `frontend/src/lab/r3f/adapters/starCoreInteriorLabAdapter.js`
10. `frontend/src/lab/r3f/scenes/StarCoreInteriorCoreLabScene.jsx`
11. `frontend/src/lab/r3f/__tests__/labConfigSchema.test.js`
12. `frontend/src/lab/r3f/__tests__/labSceneRegistry.test.js`
13. `frontend/src/lab/r3f/__tests__/labPresetStore.test.js`
14. `frontend/src/lab/r3f/__tests__/R3FLabShell.test.jsx`
15. `frontend/src/lab/r3f/__tests__/R3FLabEntry.test.jsx`

Pravidlo:

1. `UniverseWorkspace.jsx` a `StarCoreInteriorScreen.jsx` se v tomto bloku nesmi rozsirovat o experiment orchestration,
2. dotyk `App.jsx` a `main.jsx` ma byt omezen jen na dev-only vstupni vetveni,
3. `LabCanvas` nesmi narust do monolitu nesouciho shell, store a scene registry v jednom souboru.

## 6. Stavovy model

Blok ma explicitne rozlisovat:

1. `lab_closed`
2. `lab_booting`
3. `lab_ready`
4. `lab_invalid_preset`

Minimalni rozhodovaci pravidla:

1. bez `import.meta.env.DEV` se `R3F Lab` nesmi otevrit,
2. soft aktivace je `?lab=r3f` nebo `localStorage["dv:lab"] = "r3f"`,
3. nevalidni preset nesmi shodit shell; musi prejit do `lab_invalid_preset`,
4. `lab_ready` smi existovat i bez externi GUI vrstvy,
5. scene registry musi byt jediny povoleny zdroj seznamu scen.

## 7. Vazba na runtime pravdu

Pro tento blok neni povinna backend pravda.

Plati:

1. `R3F Lab v1` je dev-only harness,
2. scena se v prvnim bloku krmi presetem a adapterem,
3. pokud adapter vyuzije existujici FE visual modely, musi to byt bez zavedeni nove business truth vrstvy,
4. zadna interni hodnota z Labu se nesmi tvarit jako canonical runtime stav produktu.

## 8. Pripraveny kod z archivu

Pro tento blok je pripraveny kod:

1. `frontend/src/_inspiration_reset_20260312/store/useUniverseStore.js`
2. `frontend/src/_inspiration_reset_20260312/components/universe/scene/performanceBudget.js`
3. `frontend/src/_inspiration_reset_20260312/components/universe/CameraPilot.jsx`

V tomto bloku se skutecne ma vratit:

1. architektonicky pattern maleho `zustand` store z `useUniverseStore.js`
2. lehke budget warning utility inspirovane `performanceBudget.js`
3. pattern oddelene kamerove logiky inspirovany `CameraPilot.jsx`

V tomto bloku se zatim nema vracet:

1. archivni `UniverseCanvas.jsx`
2. stare panelove dashboardy a setup shelly
3. historicke UI surface z archivu
4. jakakoli starsi scena svazana s obsolete terminologii nebo produktovou kompozici

## 9. Konkretni implementacni kroky

Poradi implementace:

1. vytvorit `labConfigSchema` a serializacni boundary pro `star_core_interior_core`,
2. vytvorit `labSceneRegistry`,
3. vytvorit `labPersistence` a `labPresetStore`,
4. vytvorit `R3FLabEntry` a dev-only vstupni guard,
5. vytvorit `R3FLabShell`,
6. vytvorit `LabCanvas`,
7. otevrit placeholder renderer surface pro `star_core_interior_core`,
8. doplnit diagnosticky model pro `renderer.info` a frame timing,
9. doplnit focused testy,
10. pripravit screenshot-ready stavy `debug` a `cinematic`,
11. presunout konkretni adapter a render scenu do `Spike B`.

### 9.1 Navazny spike plan cele cesty

Tento dokument otevira jen prvni spike.

Navazna cesta se ma planovat uz ted takto:

1. `Spike A`: `docs/P0-core/contracts/aktivni/fe/r3f-lab/r3f-lab-spike-a-core-shell-v1CZ.md`
2. `Spike B`: `docs/P0-core/contracts/aktivni/fe/r3f-lab/r3f-lab-spike-b-interior-scene-v1CZ.md`
3. `Spike C`: `docs/P0-core/contracts/aktivni/fe/r3f-lab/r3f-lab-spike-c-exterior-scene-v1CZ.md`
4. `Spike D`: `docs/P0-core/contracts/aktivni/fe/r3f-lab/r3f-lab-spike-d-hardening-review-v1CZ.md`

Pravidlo:

1. kazdy spike musi zustat maly, explicitni a samostatne overitelny,
2. dalsi spike se nema vymyslet ad hoc az po kodu, ale ma navazovat na predem zapsanou cestu a samostatny mensi dokument,
3. po dokonceni cele cesty maji probehnout jeste 1-2 samostatne review pruchody robustnosti.

## 10. Focused gate

### 10.1 Focused testy

Minimalni pozadovane focused testy:

1. `labConfigSchema.test.js`
2. `labSceneRegistry.test.js`
3. `labPresetStore.test.js`
4. focused test pro dev guard resolver
5. focused render test `lab_ready` se scenou `star_core_interior_core`
6. focused test pro invalid preset fallback

### 10.2 Screenshot gate

Povinne screenshoty:

1. `star_core_interior_core` v rezimu `debug`
2. `star_core_interior_core` v rezimu `cinematic`
3. shell s viditelnym diagnostickym warning stavem

### 10.3 Prisnejsi nez MVP

Blok se nesmi uzavrit, pokud:

1. `R3F Lab` otevira plnou produktovou surface misto izolovaneho harnessu,
2. schema a persistence zustanou implicitni nebo netyped,
3. scena je primo svazana s GUI knihovnou,
4. `App.jsx` nebo `main.jsx` jsou rozsirovane vic, nez je nutne pro dev-only vetveni,
5. prvni blok sklouzne k sequenceru, scenarum nebo asset hot-swapu.

## 11. Co se nepocita jako completion

1. jen nova route bez schema a persistence boundary,
2. jen `Canvas` wrapper bez shellu a scene registry,
3. debug panel bez validniho preset contractu,
4. interni hracka zavisla na rucne psanem ad hoc state,
5. napojeni `Leva` bez hotoveho harness jadra.

## 12. Evidence

Minimalni dukaz:

```bash
cd /mnt/c/Projekty/Dataverse
sed -n '1,260p' docs/P0-core/contracts/aktivni/fe/fe-r3f-lab-v1CZ.md
sed -n '1,220p' docs/P0-core/contracts/aktivni/core/decision-log-v1CZ.md
sed -n '1,220p' frontend/src/components/universe/starCoreInteriorScene3d.jsx
sed -n '1,220p' frontend/src/_inspiration_reset_20260312/store/useUniverseStore.js
sed -n '1,220p' frontend/src/_inspiration_reset_20260312/components/universe/scene/performanceBudget.js
sed -n '1,220p' frontend/src/_inspiration_reset_20260312/components/universe/CameraPilot.jsx
```

## 13. Co zustava otevrene

- [ ] 2026-03-14 Implementace `R3F Lab v1` jeste neprobehla; tento dokument otevira jen prvni spike `Faze 0 + Faze 1`.
- [x] 2026-03-14 Navazne spiky jsou rozsekane do mensich samostatnych dokumentu podle odpovednosti a slozek.
- [ ] 2026-03-14 Po dokonceni cele cesty musi probehnout jeste 1-2 review pruchody robustnosti.
