# FE R3F Lab v1

Stav: aktivni priprava + navrh (povolena oddelena cesta mimo obecny FE stop stav)
Datum: 2026-03-14
Vlastnik: FE architektura + UX governance + user-agent governance

## 1. Co se zmenilo

- [x] 2026-03-14 Byl zapsan pripraveny navrh izolovaneho `R3F Lab` prostredi pro budouci FE obnovu.
- [x] 2026-03-14 Byl urcen minimalni scope `v1`, red lines, architektura a file plan.
- [x] 2026-03-14 Byla zapsana reuse mapa pro pripravene archivni helpery souvisejici s R3F harness vrstvou.
- [x] 2026-03-14 Bylo explicitne potvrzeno, ze tento dokument neni povoleni k implementaci a respektuje aktivni pozastaveni FE vyvoje.
- [x] 2026-03-14 Byla zapsana explicitni vyjimka, ze `R3F Lab` je povolena oddelena dev-only cesta mimo obecny FE stop stav.

## 2. Proc to vzniklo

`Star Core interior` ukazal, ze soucasny FE nema dostatecne levne a disciplinovane misto pro:

1. izolovane R3F experimenty,
2. ladeni svetel, kamery a postprocessingu bez zasahu do produktoveho flow,
3. opakovatelne porovnani presetu po refreshi,
4. rychlou diagnostiku vykonu a interakci.

Bez tohoto mezikroku hrozi:

1. dalsi drahe iterace primo v `UniverseWorkspace`,
2. michani produktoveho runtime a experimentu,
3. znovuvznik paralelni FE truth vrstvy,
4. ztrata reprodukovatelnosti mezi jednotlivymi pokusy.

## 3. Priprava

Tato cast je zavazna priprava pro pripadne budouci znovuotevreni.

### 3.1 Zavazne podminky

1. `R3F Lab` je interni dev-only nastroj, ne nova produktova surface.
2. `R3F Lab` je explicitne povolena oddelena vyjimka z obecneho FE stop stavu podle `D-008`.
3. `R3F Lab` musi byt `config-driven`; nesmi serializovat raw `three.js` objekty ani React refy.
4. Produkcni scene komponenty nesmi dostat primou zavislost na debug GUI knihovne.
5. `R3F Lab` nesmi vytvaret druhy zdroj pravdy pro `Galaxy Space` nebo `Star Core`.
6. Tato vyjimka neotvira `Blok 3` ani zadny jiny produktovy FE blok.

### 3.2 Mimo scope

V `v1` je mimo scope:

1. verejna nebo produkcni route dostupna bez guardu,
2. timeline scrubbing,
3. hot-swapping modelu a textur za behu,
4. backend napojeni nebo zapis do canonical runtime stavu,
5. plna scena-orchestrace s komplexnimi scenari,
6. automaticky `GPU leak detector` s ambici presnych VRAM cisel,
7. navrat dalsiho `Star Core interior` redesignu pres Lab sam o sobe.

### 3.3 Dukaz dokonceni pripravy

Za dokonceni pripravy se pocita:

1. existuje aktivni navrhovy dokument pro `R3F Lab v1`,
2. jsou explicitne zapsane red lines, architektura a minimalni file plan,
3. je zapsano, ktere archivni helpery jsou `OK` a ktere `NOK` pro pozdejsi reuse,
4. je jasne, ze prvni implementace ma byt dev-only harness, ne dalsi produktovy blok.

### 3.4 Co se za dokonceni nepocita

Za dokonceni se nepocita:

1. obecny napad bez file planu,
2. implicitni souhlas s implementaci,
3. prepsani `UniverseWorkspace` do dalsi experimentalni vetve,
4. pridani `Leva` nebo jine GUI knihovny bez predchoziho harness kontraktu,
5. tvrzeni, ze Lab sam vyresi produktovou kvalitu interieru hvezdy.

### 3.5 Evidence

Evidence byla ziskana lokalnim ctenim runtime a archivu:

1. prikaz `rg -n "@react-three|Canvas|OrbitControls|EffectComposer|Bloom|Perf|leva|tweakpane|zustand" frontend/src frontend/package.json`
   vysledek: aktivni runtime uz pouziva `@react-three/fiber`, `@react-three/drei`, `@react-three/postprocessing` a ma `zustand`; `Leva` ani `r3f-perf` zatim v projektu nejsou.
2. prikaz `sed -n '1,260p' frontend/src/components/universe/UniverseCanvas.jsx`
   vysledek: exterior scene je dnes primo svazana s produkcnim workspace a neni vhodna jako experiment harness.
3. prikaz `sed -n '1,220p' frontend/src/components/universe/starCoreInteriorScene3d.jsx`
   vysledek: interior 3D scena uz existuje jako samostatna render vrstva a je vhodna jako prvni kandidat pro izolovany lab adapter.
4. prikaz `sed -n '1,220p' frontend/src/_inspiration_reset_20260312/store/useUniverseStore.js`
   vysledek: archiv obsahuje maly `zustand` store pattern vhodny jako reference pro jednoduchy lab store.
5. prikaz `sed -n '1,220p' frontend/src/_inspiration_reset_20260312/components/universe/scene/performanceBudget.js`
   vysledek: archiv obsahuje lehky vykonnostni guard, ktery lze pozdeji adaptovat pro lab budget warningy.
6. prikaz `sed -n '1,220p' frontend/src/_inspiration_reset_20260312/components/universe/CameraPilot.jsx`
   vysledek: archiv obsahuje oddelenou kamerovou logiku; to potvrzuje, ze camera orchestrace ma jit mimo hlavni scene komponentu.
7. prikaz `rg -n "react-router|BrowserRouter|Routes|Route" frontend/src`
   vysledek: projekt dnes nema standardni app router; `Lab` proto v `v1` nesmi vynucovat zavedeni plne routing vrstvy jen kvuli sandboxu.

## 4. Navrh

### 4.1 Hlavni rozhodnuti

1. `R3F Lab v1` bude izolovany interni harness pro vizualni a interakcni experimenty nad existujicimi R3F scenami.
2. Vstup do Labu ma byt v `v1` resen dev-only entry bodem, ne zavedenim nove produktove navigace.
3. `R3F Lab v1` ma nejdriv obslouzit maximalne dve scene:
   - `star_core_exterior`
   - `star_core_interior_core`
4. `R3F Lab v1` ma pracovat s typed `scene config` objektem a presetem, ne s mutovanim scene refs ad hoc.
5. `Leva` nebo jina GUI vrstva je az druha vrstva nad hotovym harness kontraktem.

### 4.2 Scope `v1`

`R3F Lab v1` ma po budouci implementaci dodat jen toto minimum:

1. dev-only vstup do sandboxu,
2. jednotny `LabCanvas` s kontrolovanymi render defaulty,
3. registr scen s prepnutim mezi 1-2 lab scenami,
4. JSON preset import/export a rehydrataci po refreshi,
5. globalni prepinace `debug / cinematic / performance-safe`,
6. zakladni diagnosticky panel:
   - `renderer.info`
   - FPS signal nebo jednoduchy frame timing
   - event log interakci

### 4.3 Red lines

V `R3F Lab v1` je zakazane:

1. pridat do produkcnich komponent primy `useControls` import,
2. vyrobit novy paralelni workspace nebo druhy `UniverseWorkspace`,
3. drzet samostatnou business truth vrstvu vedle canonical FE/BE kontraktu,
4. zavadet plny app router jen kvuli Labu,
5. tahat do `v1` timeline sequencer, asset hot-swap a komplexni scenario runner,
6. serializovat `three.js` instance, materialy nebo geometrie primo do persistence,
7. maskovat lifecycle chyby pravidlem "`visible = false` je vzdy spravne reseni",
8. vytvorit monolit typu `ProfessionalLab.jsx`, ktery nese canvas, store, scenar, export i debug panel najednou.

### 4.4 Architektura `v1`

Navrhovane vrstvy:

1. `lab entry`
   - dev-only aktivace pres explicitni guard
   - bez zavedeni verejne produktove navigace
2. `lab shell`
   - vyber sceny
   - prepinace rezimu
   - preset toolbar
   - event log panel
3. `LabCanvas`
   - jednotne `Canvas` defaulty
   - dpr guard
   - svetla, tone mapping, shadows policy
   - volitelne helpery a postprocessing prepinace
4. `scene registry`
   - mapuje `scene_id -> renderer + default preset + schema`
5. `scene adapter`
   - prevadi `LabSceneConfig` do props existujici scene nebo male lab wrapper sceny
6. `lab preset store`
   - lokalni persistence
   - export/import JSON
   - reset na default
7. `diagnostic adapters`
   - `renderer.info`
   - jednoduchy frame timing
   - event log

Pravidlo architektury:

1. produkcni 3D komponenty maji zustat znovupouzitelne bez vedomi o tom, ze existuje Lab,
2. debug GUI vrstva smi mluvit jen s `lab store` nebo `scene adapterem`,
3. persistence smi ukladat jen validni `scene config`.

### 4.5 Doporucene implementacni poradi po obnoveni FE

1. `Faze 0`: schema + registry + dev guard,
2. `Faze 1`: `LabCanvas` + `LabShell` + jedna scena,
3. `Faze 2`: preset persistence + JSON export/import,
4. `Faze 3`: diagnostika a vykonnostni warningy,
5. `Faze 4`: volitelna GUI vrstva typu `Leva`,
6. `Faze 5`: teprve potom scenare a pokrocile sekvencovani.

### 4.6 Pripraveny kod z archivu

Aktivni reuse reference pro tento dokument:

1. `docs/P0-core/contracts/aktivni/fe/fe-archivni-technical-inventory-a-reuse-map-v1CZ.md`

Archivni verdict:

1. `OK`: `frontend/src/_inspiration_reset_20260312/store/useUniverseStore.js`
   proc: reference pro maly izolovany `zustand` store bez produktoveho balastu
   co prevzit: pattern maleho lab store, ne puvodni names a level semantiku
2. `OK`: `frontend/src/_inspiration_reset_20260312/components/universe/scene/performanceBudget.js`
   proc: lehky vykonnostni guard a warning logika
   co prevzit: odhadove budget utility a warning pattern, ne puvodni domenu planet/moon
3. `OK`: `frontend/src/_inspiration_reset_20260312/components/universe/CameraPilot.jsx`
   proc: potvrzuje spravny smer oddeleni kamerove logiky od scene komponent
   co prevzit: architektonicky pattern a pripadne male damping helpery, ne historickou asteroid terminologii
4. `NOK`: archivni plne `UniverseCanvas` surface
   proc: je to produktova surface z jineho smeru, ne izolovany lab harness
   co odstranit z uvah: navrat celeho archivniho canvas shellu jako lab zakladu
5. `NOK`: stare panelove a dashboard surface moduly
   proc: nepatri do dev-only R3F harness vrstvy
   co odstranit z uvah: jakykoli navrat starsich FE panelu jako ovladaciho UI pro Lab

### 4.7 Minimalni file plan

Minimalni navrh noveho scope po pripadnem schvaleni implementace:

1. `frontend/src/lab/r3f/R3FLabEntry.jsx`
2. `frontend/src/lab/r3f/R3FLabShell.jsx`
3. `frontend/src/lab/r3f/LabCanvas.jsx`
4. `frontend/src/lab/r3f/labSceneRegistry.js`
5. `frontend/src/lab/r3f/labConfigSchema.js`
6. `frontend/src/lab/r3f/labPresetStore.js`
7. `frontend/src/lab/r3f/labPersistence.js`
8. `frontend/src/lab/r3f/labDiagnosticsModel.js`
9. `frontend/src/lab/r3f/scenes/StarCoreExteriorLabScene.jsx`
10. `frontend/src/lab/r3f/scenes/StarCoreInteriorCoreLabScene.jsx`
11. `frontend/src/lab/r3f/adapters/starCoreExteriorLabAdapter.js`
12. `frontend/src/lab/r3f/adapters/starCoreInteriorLabAdapter.js`
13. `frontend/src/lab/r3f/__tests__/labConfigSchema.test.js`
14. `frontend/src/lab/r3f/__tests__/labPresetStore.test.js`
15. `frontend/src/lab/r3f/__tests__/labSceneRegistry.test.js`

Dotcene aktivni soubory az pri implementaci:

1. `frontend/src/App.jsx`
2. `frontend/src/main.jsx`

Pravidlo:

1. dotyk `App.jsx` nebo `main.jsx` ma byt jen pro dev guard a vstupni vetveni,
2. `UniverseWorkspace.jsx` a `StarCoreInteriorScreen.jsx` se v prvni lab implementaci nesmi znovu rozsirovat o experiment orchestration.

## 5. Rozhodnute architektonicke volby `v1`

Tato sekce uzavira drive otevrene body a zapisuje zvolenou variantu.

### 5.1 Dev guard

Profesionalni varianta:

1. hard gate pres `import.meta.env.DEV`,
2. explicitni rucni aktivace,
3. zadna verejna produkcni route bez guardu.

Netradicni silnejsi varianta:

1. hard gate pres `import.meta.env.DEV`,
2. aktivace pres query parametr nebo persistovany `localStorage` flag,
3. stejna bezpecnost, ale lepsi ergonomie pro opakovane ladeni a refresh.

Zvolene reseni pro `v1`:

1. hybridni guard,
2. hard gate je vzdy `import.meta.env.DEV`,
3. soft aktivace je `?lab=r3f` nebo `localStorage["dv:lab"] = "r3f"`,
4. bez splneni obou podminek se `R3F Lab` nesmi otevrit.

### 5.2 Ovládaci panel `v1`

Profesionalni varianta:

1. vlastni lehky panel,
2. bez externi GUI knihovny v prvnim bloku,
3. nejdriv harness kontrakt, az potom bohatsi ovladani.

Netradicni silnejsi varianta:

1. interni schema-driven panel generovany z `labConfigSchema`,
2. bez prime zavislosti produkcnich scen na `Leva`,
3. panel zustava flexibilni a zaroven nedela vendor lock do GUI vrstvy.

Zvolene reseni pro `v1`:

1. interni schema-driven panel,
2. `Leva` ani jina externi GUI knihovna se v `v1` nezavadi,
3. pripadna externi GUI vrstva je az navazna volitelna faze nad hotovym harness kontraktem.

### 5.3 `renderer.info` a diagnostika

Profesionalni varianta:

1. raw panel s `renderer.info` jako volitelna cast shellu,
2. pri potrebe si ho operator otevre,
3. jinak nerusi lab plochu.

Netradicni silnejsi varianta:

1. sber `renderer.info` je povinny vzdy,
2. raw panel muze byt sbaleny,
3. shell stale zobrazuje aktivni warningy z metrik a frame budgetu.

Zvolene reseni pro `v1`:

1. metriky z `renderer.info` a zakladni frame timing se musi sbirat vzdy,
2. raw diagnosticky panel je volitelny a defaultne sbaleny,
3. shell musi vzdy umet zobrazit aspon lehke warning badge pro:
   - rust poctu geometrii,
   - rust poctu textur,
   - drift poctu programu,
   - riziko frame budgetu.

### 5.4 Preset schema boundary pro `star_core_interior_core`

Profesionalni varianta:

1. preset serializuje jen stabilni, typed vstupy sceny,
2. neuklada refy, geometry state ani raw material objekty,
3. vnitrni render config zustava internim detailem adapteru.

Netradicni silnejsi varianta:

1. dvouvrstvy model,
2. verejny preset je semanticky,
3. adapter tento preset kompiluje do low-level render konfigurace,
4. render internals se mohou menit bez rozbiti preset compatibility.

Zvolene reseni pro `v1`:

1. pouzije se dvouvrstvy model `semantic preset -> adapter -> render config`,
2. verejny preset pro `star_core_interior_core` ma drzet jen tuto hranici:
   - `scene_id`
   - `preset_version`
   - `phase`
   - `constitution_profile`
   - `camera_profile`
   - `motion_profile`
   - `telemetry_profile`
   - `debug_profile`
   - `overrides`
3. `phase` musi byt omezeno na:
   - `star_core_interior_entry`
   - `constitution_select`
   - `policy_lock_ready`
   - `policy_lock_transition`
   - `first_orbit_ready`
4. `constitution_profile` musi byt omezeno na:
   - `rust`
   - `rovnovaha`
   - `straz`
   - `archiv`
   - `null`
5. `overrides` smi v `v1` zasahovat jen do domén:
   - `lighting`
   - `postfx`
   - `chamber`
6. zadna jina low-level render data se nesmi ukladat jako verejny preset contract.

### 5.5 Duvod uzavreni techto bodu

1. `R3F Lab v1` ma byt dlouhodobe udrzitelny interni harness, ne jednorazova ladici hracka,
2. zvolene varianty drzi bezpecnost, ergonomii i budouci rozsiritelnost bez vendor locku,
3. nejdriv se stabilizuje harness contract a preset boundary, teprve potom lze rozumne otevirat GUI a sequencer vrstvy.

## 6. Navaznost po tomto rozhodnuti

Tento dokument uz v teto chvili uzavira ctyri drive otevrene body:

1. dev guard,
2. panel `v1`,
3. `renderer.info` baseline,
4. preset schema boundary pro `star_core_interior_core`.

Tento dokument nezavadi zadnou novou extra gate nad ramec uz existujiciho FE stop stavu a projektovych pravidel.

Pro budouci navaznost plati jen:

1. pripadny implementacni dokument ma vychazet z techto uz rozhodnutych voleb,
2. implementace ma zustat v mezich `Faze 0` a `Faze 1`, pokud nebude pozdeji rozhodnuto jinak,
3. ma zustat zachovana sekce `Pripraveny kod z archivu`,
4. `R3F Lab` ma zustat dev-only internim harness nastrojem.
