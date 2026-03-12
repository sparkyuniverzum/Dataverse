# FE vykonavaci dokument Galaxy Space Workspace v1

Stav: aktivni (zavazny pracovni rozpad FE do bloku a gate)
Datum: 2026-03-12
Vlastnik: Produktove UX + FE architektura + BE truth governance

## 1. Co se zmenilo

- [x] 2026-03-12 Cely FE smer `Galaxy Space Workspace` byl rozdelen do logickych pracovnich bloku.
- [x] 2026-03-12 Pro kazdy blok byly zavedeny prisnejsi gate nez bezne MVP.
- [x] 2026-03-12 Bylo urceno zavazne poradi zavislosti mezi bloky.

## 2. Proc to vzniklo

Dosavadni FE smer mel uz dobrou vizi, ale chybel mu tvrdy vykonavaci rozpad.

To je nebezpecne, protoze bez nej:

1. se mohou michat onboarding, workspace a builder vrstvy,
2. se snadno sklouzne k vizualnimu experimentu bez produktoveho zakladu,
3. nelze poctive rict, co je pripraveno pro kod a co jeste ne,
4. gate zustavaji prilis mekke a "mvp tolerantni".

Proto je od ted zavazne:

1. pracovat po blocich,
2. mezi bloky nepredbihat,
3. dalsi blok neotevrit, dokud predchozi nema splnene gate.

## 3. Ridici dokumenty

Tento dokument vykonava:

1. `docs/P0-core/contracts/aktivni/fe/fe-master-spec-hlavni-pracovni-prostor-galaxie-v1CZ.md`
2. `docs/P0-core/contracts/aktivni/fe/fe-be-fe-projekcni-mapa-hlavni-pracovni-prostor-v1CZ.md`
3. `docs/P0-core/contracts/aktivni/fe/fe-builder-system-galaxy-space-workspace-v1CZ.md`
4. `docs/P0-core/contracts/aktivni/fe/fe-vision-v2-spatial-galaxy-entry-v1CZ.md`
5. `docs/P0-core/contracts/aktivni/fe/fe-be-pravda-a-data-guard-v1CZ.md`
6. `docs/P0-core/contracts/aktivni/ux/ux-operation-layer-grid-command-v1CZ.md`

## 4. Globalni hard gate pro vsechny bloky

Kazdy blok musi splnit vsechny body niz.

Nestaci splnit jen cast.

### 4.1 BE truth gate

1. Kazdy vizualni nebo interakcni prvek musi byt navazany na konkretni `payload source`.
2. Kazda nova FE vrstva musi mit uvedeny `guard helper` nebo kontrakt.
3. FE nesmi simulovat finalni stav bez odpovidajici BE pravdy.

### 4.2 User-visible gate

1. Zmena musi byt viditelna na first view nebo v primarnim flow daneho bloku.
2. Nesmime uzavrit blok, pokud je rozdil hlavne interní nebo textovy.
3. Kazdy blok musi mit screenshot dukaz nebo ekvivalentni vizualni porovnani.

### 4.3 Interaction gate

1. Chovani musi byt citelne bez vysvetlovani zdrojoveho kodu.
2. V jednom stavu nesmi existovat dve konkurencni primarni akce.
3. Kamera, vyber a vstup do objektu nesmi uzivatele dezorientovat.

### 4.4 Cleanup gate

1. Pokud novy blok nahradi starsi dokument nebo smer, musi byt starsi vec vyradena nebo presunuta.
2. Pokud se vraci archived kod, musi byt presne urceno co se vraci a co zustava odpadem.
3. Po kazdem bloku musi byt jasne, co je aktivni pravda.

### 4.5 Focused test gate

1. Musi existovat focused testy pro novou stavovou logiku nebo adaptery.
2. Testy musi odpovidat scope bloku, ne vedlejsim oblastem.
3. Bez focused testu nelze tvrdit `technical completion`.

### 4.6 UX-first gate

1. Rozhodnuti se posuzuji podle operating-center kvality, ne podle technicke pohodlnosti.
2. Pokud je vysledek "funguje to, ale nevypada to jako produkt", blok neni uzavren.
3. `wow` nesmi prebít `work first`, ale `work first` nesmi sklouznout do suroveho utilitarismu.

## 5. Zavazne poradi bloku

Poradi je linearni:

1. `Blok 1` -> `Blok 2` -> `Blok 3` -> `Blok 4` -> `Blok 5` -> `Blok 6` -> `Blok 7` -> `Blok 8`

Pravidlo:

1. dalsi blok se otvira az po zavreni gate predchoziho bloku,
2. vyjimka vyzaduje explicitni schvaleni uzivatele,
3. onboarding `Blok 8` je zamerne az na konci, ne na zacatku.

## 6. Blok 1: Galaxy Space navigation baseline

### 6.1 Ucel

Zavest hlavni prostor galaxie jako volne navigovatelny workspace.

### 6.2 Scope

1. `free navigation` kamera,
2. `selection focus`,
3. `approach` na objekt,
4. minimalni radar / minimapa baseline,
5. orientace operatora v prostoru.

### 6.3 Mimo scope

1. vstup do `Star Core`,
2. `Constitution Select`,
3. plny `command bar`,
4. grid,
5. builder commit flow,
6. onboarding cinematic.

### 6.4 Pripraveny kod z archivu

1. `UniverseCanvas.jsx`
2. `cameraPilotMath.js`
3. `previewAccessibility.js`

### 6.5 Prisny gate

1. Kamera nesmi byt defaultne zamknuta na hvezdu.
2. Uzivatel musi byt schopen citelne menit smer pohledu a approach.
3. Screenshot `hlavni prostor` musi ukazat navigovatelny workspace, ne jen statickou ilustraci.
4. Musi existovat focused testy pro navigation/selection state.
5. Bez radar baseline se blok neuzavre.

## 7. Blok 2: Spatial Star Core exterior

### 7.1 Ucel

Udelat z hvezdy centralni governance anchor uvnitr prostoru galaxie, ale ne z ni udelat cely workspace.

### 7.2 Scope

1. vizual hvezdy jako nejsilnejsiho objektu,
2. governance prstenec kolem hvezdy,
3. diegeticke labely ctene v prostoru,
4. `UNLOCKED / LOCKED / STABILIZING` jako prostorovy stav.

### 7.3 Mimo scope

1. vstup do jadra,
2. `Constitution Select`,
3. planet builder,
4. grid editace.

### 7.4 Pripraveny kod z archivu

1. `starContract.js`
2. `lawResolver.js`
3. `planetPhysicsParity.js`

### 7.5 Prisny gate

1. Hvezda musi byt citelna i bez pomocne karty.
2. Diegeticke labely musi byt citelne a nesmi se zrcadlit nebo lamat.
3. `LOCKED` a `UNLOCKED` se musi lisit prostorove, ne jen copy.
4. Hvezda nesmi zamknout kameru tak, ze zmizi pocit prostoru galaxie.
5. Screenshot `Star Core exterior` musi byt produktove presvedcivy i bez vysvetleni.

## 8. Blok 3: Star Core interior + Constitution Select + Policy Lock

### 8.1 Ucel

Dodelat skutecne governance-first jadro uvnitr hvezdy.

### 8.2 Scope

1. dvojklik / approach vstup do jadra,
2. `Constitution Select`,
3. `Policy Lock`,
4. fyzicke `lock-in`,
5. navrat ven do prostoru po potvrzeni.

### 8.3 Mimo scope

1. planety jako plna pracovni vrstva,
2. grid,
3. command bar jako plny power-user mod,
4. onboarding replay.

### 8.4 Pripraveny kod z archivu

1. `starContract.js`
2. `lawResolver.js`
3. `previewAccessibility.js`

### 8.5 Prisny gate

1. `Constitution Select` musi byt chytre vysvetleny, ne jako formular.
2. `Policy Lock` nesmi byt jen tlacitko s textem.
3. Po locku musi vzniknout jasny orbitalni signal dalsiho kroku.
4. Musi existovat before/after screenshot `pred lock` a `po lock`.
5. Reduced-motion varianta musi mit stejnou vyznamovou sekvenci.

## 9. Blok 4: Planet topology and orbit baseline

### 9.1 Ucel

Promitnout planety a jejich radialni logiku do hlavniho prostoru galaxie.

### 9.2 Scope

1. planety nebo jejich orbit sloty,
2. `constellation` seskupeni,
3. zakladni vazba na `sector.center`, `sector.size`, `sector.mode`,
4. diegeticke planet labely,
5. vizualni fyzika planety z BE.

### 9.3 Mimo scope

1. detailni row editace,
2. capability detail,
3. bond builder,
4. onboarding.

### 9.4 Pripraveny kod z archivu

1. `planetPhysicsParity.js`
2. `runtimeProjectionPatch.js`
3. `runtimeDeltaSync.js`

### 9.5 Prisny gate

1. Planety nesmi byt jen nahodne dekorativni body.
2. Velikost, svit, puls a degradace musi odpovidat BE polim.
3. Vyber planety musi byt citelny bez otevirani vedlejsiho panelu.
4. Screenshot `vice planet v prostoru` musi potvrdit skutecnou topologii, ne jeden hero objekt.
5. Bez validni vazby na `GET /universe/tables` a `planet-physics-runtime` blok neni uzavren.

## 10. Blok 5: Command bar baseline

### 10.1 Ucel

Zavest `command bar` jako rychly, naucitelny a bezpecny operation vstup.

### 10.2 Scope

1. `Ctrl/Cmd+K`,
2. `Guided`, `Slash`, `Intent text`,
3. `Plan preview`,
4. scope lock,
5. explainability parseru.

### 10.3 Mimo scope

1. plny grid,
2. builder shell,
3. onboarding command tutorial.

### 10.4 Pripraveny kod z archivu

1. `commandBarContract.js`
2. `useCommandBarController.js`
3. `builderParserCommand.js`

### 10.5 Prisny gate

1. Zadny mutacni command nesmi jit bez `Plan preview`.
2. FE command syntax nesmi slibovat nic mimo realnou parser schopnost.
3. Scope, ambiguity a riziko musi byt vysvetleny pred commitem.
4. Command bar nesmi vizualne zabit hlavni prostor.
5. Musi existovat focused testy pro preview, scope a execute flow.

## 11. Blok 6: Grid baseline

### 11.1 Ucel

Zavest `grid` jako canonical presny editor reality pro planetu a `civilization`.

### 11.2 Scope

1. otevreni gridu z planet contextu,
2. grid/canvas sync,
3. row editace,
4. zakladni schema lane,
5. write feedback a convergence signal.

### 11.3 Mimo scope

1. plny visual builder shell,
2. capability builder,
3. pokrocile recovery drawers.

### 11.4 Pripraveny kod z archivu

1. `QuickGridOverlay.jsx`
2. `gridCanvasTruthContract.js`
3. `selectionContextContract.js`

### 11.5 Prisny gate

1. Grid musi byt rychlejsi nebo stejne rychly jako baseline edit flow.
2. Grid musi byt canonical editor pro `/civilizations*`.
3. Otevreni gridu nesmi rozbit selection a orientation v prostoru.
4. Musi byt jasne, kdy je fokus `grid_planet`, `grid_civilization`, `canvas_planet`, `canvas_civilization`.
5. Bez focused testu pro `grid/canvas truth` a write feedback se blok neuzavre.

## 12. Blok 7: Builder baseline

### 12.1 Ucel

Spojit prostor, `command bar` a `grid` do jednoho builder systemu nad canonical write surface.

### 12.2 Scope

1. vytvoreni planety,
2. navazny schema/contract setup,
3. preview pred commitem,
4. konvergence `scene + grid + runtime`,
5. recoverable error stav.

### 12.3 Mimo scope

1. onboarding,
2. plny tutorial,
3. branch-specific workflow variance.

### 12.4 Pripraveny kod z archivu

1. `planetBuilderFlow.js`
2. `planetBuilderUiState.js`
3. `visualBuilderStateMachine.js`
4. `builderParserCommand.js`

### 12.5 Prisny gate

1. Builder nesmi zavest paralelni mutacni cestu mimo `/planets*`, `/civilizations*`, `/bonds*`.
2. Preview a commit musi mit jednu stavovou osu.
3. Po commitu musi byt potvrzena konvergence prostoru i gridu.
4. Recoverable error musi vratit uzivatele do posledniho validniho kroku.
5. Bez screenshotu `pred preview`, `preview`, `po commit konvergenci` blok neni uzavren.

## 13. Blok 8: Onboarding / cinematic wrapper

### 13.1 Ucel

Zabalit hotovy workspace do uvodni vision vrstvy bez rozbiti `work first`.

### 13.2 Scope

1. `Nexus / Galaxy Selector`,
2. fly-through,
3. prvni cinematic vstup,
4. replay volitelny,
5. defaultne vypnout po prvnim pruchodu.

### 13.3 Mimo scope

1. redefinice hlavniho workspace,
2. znovuotevirani builder logiky.

### 13.4 Pripraveny kod z archivu

1. pouze inspirace z archivni scene logiky; zadny stary shell se nevraci automaticky.

### 13.5 Prisny gate

1. Onboarding nesmi maskovat slaby workspace.
2. Musi jit vypnout a zustat vypnuty po prvnim pruchodu.
3. Replay musi byt explicitni volba.
4. Reduced-motion varianta je povinna.
5. Bez hotovych bloku 1-7 se blok 8 neotvira.

## 14. Co se nepocita jako uzavreni bloku

1. helper nebo contract bez viditelneho dopadu,
2. screenshot jedineho hezkeho stavu bez realne interakce,
3. command bez parser preview,
4. grid bez canonical write surface,
5. builder bez potvrzene konvergence,
6. onboarding, ktery nahrazuje chybejici produktovy zaklad.

## 15. Evidence

Minimalni dukaz:

```bash
cd /mnt/c/Projekty/Dataverse
sed -n '1,260p' docs/P0-core/contracts/aktivni/fe/fe-master-spec-hlavni-pracovni-prostor-galaxie-v1CZ.md
sed -n '1,260p' docs/P0-core/contracts/aktivni/fe/fe-be-fe-projekcni-mapa-hlavni-pracovni-prostor-v1CZ.md
sed -n '1,260p' docs/P0-core/contracts/aktivni/fe/fe-builder-system-galaxy-space-workspace-v1CZ.md
sed -n '1,260p' docs/P0-core/contracts/aktivni/ux/ux-operation-layer-grid-command-v1CZ.md
```

Vysledek:

- [x] 2026-03-12 Byla sjednocena aktivni FE pravda pro workspace, builder, command bar a grid.
- [x] 2026-03-12 Byl zaveden zavazny poradi bloků a tvrde gate pro kazdy blok.

## 16. Co zustava otevrene

- [ ] Rozhodnout, zda prvni kodovy rez bude `Blok 1`, nebo jestli jeste pred nim vznikne jemny dokument `kamera/radar interaction detail`.
- [ ] U kazdeho implementacniho bloku navazat screenshot dukaz a focused testy presne podle teto osy.
