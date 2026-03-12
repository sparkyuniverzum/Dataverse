# FE master spec hlavni pracovni prostor galaxie v1

Stav: aktivni (nadrazeny workspace master spec)
Datum: 2026-03-12
Vlastnik: Produktove UX + FE architektura + BE truth governance

## 1. Co se zmenilo

- [x] 2026-03-12 Byl zaveden novy nadrazeny master spec pro hlavni pracovni prostor galaxie.
- [x] 2026-03-12 Byla oddelena `onboarding / cinematic first 30 seconds` vrstva od definice hlavniho workspace.
- [x] 2026-03-12 Byla zavedena nova definice fokusu, kamery a pohybu v galaxii.
- [x] 2026-03-12 Bylo urceno, ze `Star Core` je centralni governance uzel uvnitr workspace, ne cely workspace.

## 2. Proc se to zmenilo

Dosavadni FE smer prilis zuzil hlavni pracovni prostor na hvezdu.

To je produktove spatne, protoze:

1. uzivatel nebude pracovat jen `na hvezde`,
2. bude se pohybovat celou galaxii,
3. hvezda, planety, mesice a vazby musi byt soucast jednoho navigovatelneho prostoru,
4. `first 30 seconds` se maji resit jako onboarding/cinematic vrstva, ne jako definice staleho workspace.

Proto je od ted zavazne:

1. onboarding a cinematic vstup jsou samostatna vision vrstva,
2. hlavni workspace se navrhuje jako plnohodnotny `Galaxy Space Workspace`,
3. `Star Core` je prvni kriticky cil uvnitr tohoto prostoru, ne jeho nahrada.

## 3. Zavazny princip

Plati:

1. Hlavni pracovni prostor produktu je `prostor galaxie`.
2. `Nexus / Galaxy Selector` neni hlavni workspace; je to vstupni brana.
3. `Star Core` je centralni governance anchor uvnitr workspace.
4. Kamera v hlavnim workspace nesmi byt defaultne zamknuta na hvezdu.
5. Uzivatel se v galaxii musi chovat jako operator v pohybujici se lodi, ne jako ctenar staticke karty.

## 4. Hlavni definice prostoru

### 4.1 Co je hlavni pracovni prostor

Hlavnim pracovnim prostorem je jedna navigovatelna galaxie:

1. galaxie je hranice operacniho prostoru,
2. hvezda je centralni orientacni a governance bod,
3. planety jsou kontejnery datove prace,
4. mesice jsou capability vrstva nad planetami,
5. vazby jsou viditelne vztahy mezi entitami,
6. vetve meni tonalitu a scope prostoru.

### 4.2 Co hlavni pracovni prostor neni

Neni to:

1. login obrazovka,
2. `Nexus / Galaxy Selector`,
3. fullscreen modal `Star Core`,
4. panelovy desktop se sidebary,
5. staticky canvas bez volne navigace.

## 5. Chovani uzivatele v prostoru

Uzivatel se v galaxii chova jako operator v rakete:

1. leti prostorem,
2. orientuje se podle hvezdy, planet, vazeb a minimapy,
3. vybira objekty,
4. priblizuje se k nim,
5. vstupuje do jejich interakcni vrstvy,
6. vraci se zpet o uroven vys.

## 6. Nova definice fokusu

`focus` uz nesmi znamenat jen zamceni kamery na hvezdu.

Musi se rozlisovat:

### 6.1 `navigation focus`

Kam se uzivatel diva nebo leti.

### 6.2 `selection focus`

Ktery objekt je aktualne vybran:

1. hvezda,
2. planeta,
3. mesic,
4. vazba.

### 6.3 `interaction focus`

Do jake vrstvy objektu uzivatel vstoupil:

1. `Star Core`,
2. planeta,
3. capability vrstva,
4. vazba.

Pravidla:

1. `single click` vybere,
2. `double click` priblizi nebo vstoupi,
3. `Esc` vrati o uroven vys,
4. vyber objektu nesmi rozbit volnost prostoru.

## 7. Kamera

### 7.1 Vychozi rezim

Vychozi rezim hlavniho workspace je `free navigation`.

To znamena:

1. kamera neni tvrde privazana ke hvezde,
2. hvezda zustava orientacni kotva prostoru,
3. uzivatel muze letet mezi objekty,
4. priblizeni k objektu je plynule, ne agresivni auto-zoom.

### 7.2 Chovani kamery

Minimalni model:

1. mys meni smer pohledu / jemny parallax,
2. drag meni orientaci v prostoru,
3. wheel meni vzdalenost,
4. `double click` na objekt spusti `approach`,
5. `Esc` vraci o uroven vys,
6. `reduced motion` pouzije kratsi, mekci prechod.

### 7.3 Zakazane chovani

1. permanentni star lock,
2. agresivni auto-zoom do objektu bez kontroly,
3. zoom, ktery znici orientaci v prostoru,
4. fullscreen objekt bez moznosti navratu.

## 8. Povinne vrstvy hlavniho workspace

### 8.1 3D prostor galaxie

Musi obsahovat:

1. hvezdu,
2. planety nebo jejich sloty/orbity,
3. mesice/capability signaly,
4. vazby,
5. branch tonalitu,
6. prostorovou hloubku.

### 8.2 Lecky HUD

HUD ma byt lehky a skleneny.

Smí drzet jen:

1. scope,
2. sync,
3. vyber objektu,
4. kratky command affordance,
5. minimapu/radar.

### 8.3 Minimapa / radar

Minimapa je povinna soucast budouciho skalovani.

Minimalni obsah:

1. hvezda jako dominantni bod,
2. planety jako body,
3. vybrany objekt jako zvyrazneny marker,
4. smer pohledu / pozice operatora,
5. zakladni signal hustoty prostoru.

Nesmí se zmenit v tezky admin panel.

### 8.4 Command bar

`Command bar` je povinna operation vrstva hlavniho workspace, ale nesmi dominovat scene.

Pravidla:

1. otvira se kontextove nebo pres `Ctrl/Cmd+K`,
2. podporuje `Guided`, `Slash` a `Intent text` rezim podle `ux-operation-layer-grid-command-v1CZ.md`,
3. kazdy mutacni prikaz musi projit `Plan preview`,
4. command bar musi vzdy respektovat aktualni `selection focus` a `branch scope`,
5. nesmi se zmenit v permanentni top rail s tezkych workflow shell.

### 8.5 Grid

`Grid` je canonical presna editacni vrstva pro vybranou planetu a je povinny partner 3D prostoru.

Pravidla:

1. scena je prostor a orientace, grid je rychly editor dat,
2. grid se otevira z `selection focus` nebo z command CTA, ne jako permanentni sidebar,
3. grid musi zustat synchronizovany s vybranou planetou a pripadne `civilization`,
4. kazdy kriticky row write flow musi jit dokoncit ciste pres grid,
5. grid nesmi rozbit volny pohyb galaxii; je to vrstva nad workspace, ne jeho nahrada.

### 8.6 Builder system

Builder neni jeden panel.

Je to koordinace tri pracovnich vrstev:

1. `space navigation` pro vyber a approach,
2. `command bar` pro zamer, preview a commit affordance,
3. `grid` pro presny editor a detailni potvrzeni reality.

## 9. Prostorovy vyznam objektu

### 9.1 Hvezda

Hvezda je:

1. orientacni anchor,
2. governance autorita,
3. vstup do `Star Core`,
4. vizualne nejsilnejsi objekt galaxie.

Ale neni to cely workspace.

### 9.2 Planety

Planety jsou:

1. pracovni kontejnery,
2. nosice kontraktu a fyzikalniho profilu,
3. mista, kde zije datova prace.

Musí umet menit:

1. velikost,
2. luminositu,
3. puls,
4. vizualni zdravi,
5. korozni / anomali signal.

### 9.3 Mesice

Mesice jsou capability signaly navazane na planety.

Nemaji se chovat jako row runtime.

Maji byt ctene jako:

1. modul,
2. schopnost,
3. pravidlova nebo vypocetni vrstva.

### 9.4 Vazby

Vazby musi byt citelne jako fyzicke spojnice.

Maji mit:

1. typ,
2. smerovost,
3. intenzitu,
4. signal stability nebo rizika.

## 10. Vizualni fyzika a barevny jazyk

### 10.1 Hvezda

1. `draft/unlocked` = vyssi nestabilita, teplejsi signal, zivejsi puls,
2. `locked` = klidnejsi jadro, studenejsi governance signal,
3. vstup do jadra = zmenseni okolniho sumu, ne rozpad orientace.

### 10.2 Planety

Planeta musi promitat backend fyziku:

1. `size_factor` -> velikost planety,
2. `luminosity` -> svit,
3. `pulse_rate` -> rytmus pulzu,
4. `hue` a `saturation` -> tonalita,
5. `corrosion_level` a `crack_intensity` -> degradace.

### 10.3 Extinguished stav

Nic nesmi `hard delete` zmizet.

Vyhasly objekt ma byt:

1. ztlumeny,
2. pruhlednejsi,
3. duchovy / archivni,
4. stale dohledatelny jako historie prostoru.

### 10.4 Branch tonalita

Branch scope se ma casem projevit tonalitou prostoru:

1. `main` timeline = stabilni produkcni tonalita,
2. branch = zretelne odlisena atmosfera,
3. ale bez rozbiti citelnosti objektu.

## 11. Oddeleni onboarding vrstvy

Prvnich `30 vterin` se od ted neresi jako definice hlavniho workspace.

Resi se v samostatne onboarding vrstve:

1. cinematic uvod,
2. `Nexus`,
3. fly-through,
4. prvni navadeni.

Master spec tohoto dokumentu popisuje:

1. jak funguje hlavni prostor po vstupu,
2. ne jak vypada onboarding showreel.

## 12. Vazba na backend pravdu

Tento master spec se zavazne opira o:

1. `docs/P0-core/contracts/aktivni/fe/fe-be-pravda-a-data-guard-v1CZ.md`
2. navaznou `BE -> FE` projekcni mapu pro workspace.
3. `docs/P0-core/contracts/aktivni/fe/fe-vykonavaci-dokument-galaxy-space-workspace-v1CZ.md`

Pravidlo:

1. vizual, pohyb i stav prostoru se odvozuji z BE payloadu,
2. FE nesmi prostor domyslet bez kontraktoveho guardu,
3. tam, kde BE data chybi, musi FE rict, ze je to `unknown`, `stabilizing` nebo `unavailable`.

## 13. Pripraveny kod z archivu

Pro budouci implementacni bloky tohoto workspace jsou pripravene hlavne:

1. `frontend/src/_inspiration_reset_20260312/components/universe/UniverseCanvas.jsx`
2. `frontend/src/_inspiration_reset_20260312/components/universe/cameraPilotMath.js`
3. `frontend/src/_inspiration_reset_20260312/components/universe/previewAccessibility.js`
4. `frontend/src/_inspiration_reset_20260312/components/universe/starContract.js`
5. `frontend/src/_inspiration_reset_20260312/components/universe/lawResolver.js`
6. `frontend/src/_inspiration_reset_20260312/components/universe/planetPhysicsParity.js`
7. `frontend/src/_inspiration_reset_20260312/components/universe/runtimeNormalizationSignal.js`
8. `frontend/src/_inspiration_reset_20260312/components/universe/runtimeDeltaSync.js`
9. `frontend/src/_inspiration_reset_20260312/components/universe/runtimeProjectionPatch.js`
10. `frontend/src/_inspiration_reset_20260312/components/universe/useUniverseRuntimeSync.js`
11. `frontend/src/_inspiration_reset_20260312/components/universe/commandBarContract.js`
12. `frontend/src/_inspiration_reset_20260312/components/universe/useCommandBarController.js`
13. `frontend/src/_inspiration_reset_20260312/components/universe/QuickGridOverlay.jsx`
14. `frontend/src/_inspiration_reset_20260312/components/universe/gridCanvasTruthContract.js`
15. `frontend/src/_inspiration_reset_20260312/components/universe/selectionContextContract.js`
16. `frontend/src/_inspiration_reset_20260312/components/universe/planetBuilderFlow.js`
17. `frontend/src/_inspiration_reset_20260312/components/universe/visualBuilderStateMachine.js`
18. `frontend/src/lib/builderParserCommand.js`

Tyto moduly se maji vracet postupne podle dalsich implementacnich rezu, ne najednou.

## 14. Evidence

Minimalni dukaz pro tento dokument:

```bash
cd /mnt/c/Projekty/Dataverse
sed -n '1,240p' app/api/routers/galaxies/core.py
sed -n '1,240p' app/api/routers/galaxies/dashboard.py
sed -n '1,240p' app/api/routers/universe.py
sed -n '1,260p' app/api/routers/branches.py
sed -n '1,260p' app/schema_models/star_core.py
sed -n '1,260p' app/schema_models/universe.py
sed -n '1,260p' app/schema_models/dashboard.py
sed -n '1,260p' app/schema_models/moon_capabilities.py
```

Vysledek:

- [x] 2026-03-12 Bylo potvrzeno, ze BE uz poskytuje galaxii, branch scope, `Star Core`, universe snapshot, planets dashboard, moons dashboard a bonds dashboard.
- [x] 2026-03-12 Bylo potvrzeno, ze BE uz poskytuje planet physics metriky a vizualni derivace.
- [x] 2026-03-12 Bylo potvrzeno, ze capability vrstva je vedena jako `moon capability`, ne jako row runtime.
- [x] 2026-03-12 Bylo potvrzeno, ze archiv obsahuje pouzitelne kontrakty pro `command bar`, `grid` a builder state orchestration bez nutnosti vratit puvodni shell balast.

## 15. Co zustava otevrene

- [x] 2026-03-12 Zavazny vykonavaci dokument `Galaxy Space Workspace v1` byl zapsan.
- [x] 2026-03-12 Aktivni builder system pro `Galaxy Space Workspace` byl zapsan v samostatnem dokumentu.
- [x] 2026-03-12 Detailni `BE -> FE` projekcni mapa pro vsechny povinne vrstvy workspace byla zapsana.
- [ ] Teprve potom rozdelit implementaci na proveditelne FE rezy.
