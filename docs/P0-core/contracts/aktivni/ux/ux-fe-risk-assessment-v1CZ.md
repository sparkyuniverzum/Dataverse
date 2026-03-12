# UX FE rizikova analyza v1

Stav: aktivni (FE/UX guardrails)
Datum: 2026-03-11
Vlastnik: FE architektura + UX inzenyrstvi

## 1. Ucel

Tento dokument doplnuje:

1. `ux-ia-navigation-architecture-v1CZ.md`,
2. `ux-journeys-and-visual-language-v1CZ.md`,
3. `ux-fe-component-behavior-contract-v1CZ.md`.

Cil je explicitne pojmenovat nejvetsi implementacni rizika FE/UX a zavest tvrde guardraily, ktere zabrani regresim v:

1. vykonu,
2. citelnosti,
3. ovladatelnosti,
4. ontologicke konzistenci.

## 2. Co se zmenilo

- [x] 2026-03-11 Sjednocen styl dokumentu na stejny format jako ostatni aktivni CZ kontrakty.
- [x] 2026-03-11 Opraveny metadata stitky na `Stav/Datum/Vlastnik`.
- [x] 2026-03-11 Rizika doplnena o meritelne guardraily a gate kriteria.
- [x] 2026-03-11 Sjednocena terminologie s kanonickou ontologii (`civilization` row, `moon` capability).
- [x] 2026-03-11 Doplneni vlastniku rizik (`R1-R5`) na uroven role + modul.
- [x] 2026-03-11 Doplneni test mappingu (`R1-R5`) na konkretni test soubory.
- [x] 2026-03-11 Zpresneni viewport limitu a prekryvnych limitu pro `R2/R4`.

## 3. Proc se to zmenilo

Puvodni verze mela spravny zamer, ale byla nekonzistentni vuci aktivnim dokumentum:

1. mixovala CZ/EN metadata styl,
2. nemela jednotny kontraktovy format,
3. cast mitigaci nebyla meritelna jako gate.

## 4. Kriticka rizika a guardraily

## 4.1 Riziko R1: Peklo synchronizace stavu (`State Sync Hell`)

Zdroj rizika:
`Scene Layer` a `Operation Layer` musi byt synchronni v interpretaci, ale technicky oddelene v update smyckach.

Hrozba:
Pokud je 3D render navazan primo na kazdy mikro-update v gridu, rozbije se plynulost a latence operaci.

Povinny guardrail:

1. Oddelit update smycky pro 2D UI a 3D scenu.
2. Do 3D propagovat davkove nebo stavove update (`previewed`, `committed`), ne kazdy stisk klavesy.
3. Zachovat cilovy limit `selection feedback < 100 ms`.

Vlastnik rizika:

1. Role: FE runtime owner (Universe workspace).
2. Moduly: `useUniverseRuntimeSync.js`, `runtimeProjectionPatch.js`, `runtimeSyncUtils.js`, `scene/performanceBudget.js`.

Test mapping:

1. `frontend/src/components/universe/useUniverseRuntimeSync.test.js`
2. `frontend/src/components/universe/runtimeProjectionPatch.test.js`
3. `frontend/src/components/universe/runtimeSyncUtils.test.js`
4. `frontend/src/components/universe/scene/performanceBudget.test.js`

## 4.2 Riziko R2: Kognitivni pretizeni workspace

Zdroj rizika:
Soucasne vykresleni 3D sceny, HUD, command baru, gridu a inspectoru.

Hrozba:
Ztrata hierarchie vrstev a degradace operating-center efektu.

Povinny guardrail:

1. `Operation Layer` ma prioritu pri konfliktu prostoru.
2. Grid/inspector nesmi dlouhodobe prekryt centralni kontext bez moznosti rychleho navratu.
3. HUD copy musi byt strucny a akcne orientovany.
4. Pri viewportu `>=1366px` musi zustat ve scene viditelna centralni focus zona alespon `40%` sirky workspace.
5. Pri viewportu `1024-1365px` nesmi operacni panely prekrocit `70%` sirky workspace.

Vlastnik rizika:

1. Role: FE UX owner (workspace composition).
2. Moduly: `UniverseWorkspace.jsx`, `WorkspaceSidebar.jsx`, `QuickGridOverlay.jsx`, `surfaceLayoutTokens.js`.

Test mapping:

1. `frontend/src/components/universe/surfaceLayoutTokens.test.js`
2. `frontend/src/components/universe/workspaceContract.test.js`
3. `frontend/src/components/universe/operatingCenterUxContract.test.js`
4. `frontend/src/components/universe/WorkspaceSidebar.connectivity.test.jsx`

## 4.3 Riziko R3: Unava z animaci (`Animation Fatigue`) ve Star Core

Zdroj rizika:
Opakovany vstup do `Star Core` s kamerovym prechodem.

Hrozba:
Power-user workflow degraduje kvuli opakovanym nepreskocitelnym prechodum.

Povinny guardrail:

1. Prechod musi byt vzdy preskocitelny.
2. Rezim `Reduce Motion` musi mit plnou funkcni paritu.
3. Pri opakovanych vstupech je preferovany okamzity prechod bez dlouhe animace.

Vlastnik rizika:

1. Role: FE interaction owner (governance/star-core flow).
2. Moduly: `GovernanceModeSurface.jsx`, `StarHeartDashboard.jsx`, `CameraPilot.jsx`.

Test mapping:

1. `frontend/src/components/universe/governanceModeContract.test.js`
2. `frontend/src/components/universe/starContract.test.js`
3. `frontend/src/components/universe/CameraPilot.test.jsx`

## 4.4 Riziko R4: Degradace na mensich viewports

Zdroj rizika:
Soucasne naroky na 3D i operacni vrstvu.

Hrozba:
Na mensich displejich se stane necitelnou bud scena, nebo grid.

Povinny guardrail:

1. Definovat tvrdy breakpoint pro workspace layout.
2. Pod breakpointem preferovat pouzitelnost `Operation Layer` pred efektem 3D.
3. Zachovat dostupnost hlavnich CRUD akci bez horizontalniho boje s layoutem.
4. Pri viewportu `<1024px` prepnout workspace do kompaktniho rezimu (operation-first, scena v kontextovem nahledu).
5. Pri viewportu `<768px` nesmi byt povinny soubezny rendering plne 3D scene a plneho gridu v jednom layout kroku.

Vlastnik rizika:

1. Role: FE layout/system owner.
2. Moduly: `surfaceLayoutTokens.js`, `UniverseWorkspace.jsx`, `previewAccessibility.js`.

Test mapping:

1. `frontend/src/components/universe/surfaceLayoutTokens.test.js`
2. `frontend/src/components/universe/accessibilityPreview.test.jsx`
3. `frontend/src/components/universe/workspaceContractExplainability.test.js`

## 4.5 Riziko R5: Ontologicky drift v UI copy a interakcich

Zdroj rizika:
Nejednotne pouzivani terminu nebo nespravne mapovani entit na interakcni surface.

Hrozba:
Mateni uzivatele a poruseni kanonickeho modelu pri zamene roli (`moon` jako row, `civilization` jako capability).

Povinny guardrail:

1. Row mutace vedou kanonicky pres `/civilizations*`.
2. `moon` je v UI i logice capability vrstva nad planetou/tabulkou.
3. Vsechny nove texty v UI maji byt cesky a uzivatelsky srozumitelne.

Vlastnik rizika:

1. Role: FE domain semantics owner.
2. Moduly: `QuickGridOverlay.jsx`, `planetCivilizationMatrix.placeholder.test.js` (kontrakt), `workspaceFormatters.js`.

Test mapping:

1. `frontend/src/components/universe/QuickGridOverlay.civilizations.test.jsx`
2. `frontend/src/components/universe/QuickGridOverlay.minerals.test.jsx`
3. `frontend/src/components/universe/planetCivilizationMatrix.placeholder.test.js`
4. `frontend/src/components/universe/workspaceFormatters.test.js`

## 5. Gate kriteria

Blok je splnen pouze pokud plati soucasne:

1. FE interakce drzi ontologii (`civilization` row, `moon` capability).
2. Neexistuje povinna dlouha animace v opakovanych workflow.
3. Na mensim viewportu je zachovana pouzitelnost operacni vrstvy.
4. Kriticke akce maji rychlou a citelnou zpetnou vazbu.
5. Pri viewportu `>=1366px` zustava centralni focus zona scene min. `40%` sirky.
6. Pri viewportu `1024-1365px` operacni panely neprekroci `70%` sirky.
7. Pri viewportu `<1024px` je aktivni operation-first layout.
8. Kazde riziko `R1-R5` ma prirazeny vlastnik a minimalne jeden test.

## 6. Evidence

Povinna kontrola konzistence dokumentace:

```bash
cd /mnt/c/Projekty/Dataverse
rg -n "^(Status|Date|Owner|Scope):" docs/P0-core/contracts/aktivni/ux/ux-fe-risk-assessment-v1CZ.md
rg -n "^Vlastnik rizika:|^Test mapping:" docs/P0-core/contracts/aktivni/ux/ux-fe-risk-assessment-v1CZ.md
```

Ocekavani:

1. Vystup je prazdny (metadata stitky jsou sjednocene na CZ).
2. Dokument obsahuje 5 bloku `Vlastnik rizika` a 5 bloku `Test mapping`.

Doporucene focused FE testy pro tento dokumentacni gate:

```bash
cd /mnt/c/Projekty/Dataverse
npm --prefix frontend run test -- \
  src/components/universe/useUniverseRuntimeSync.test.js \
  src/components/universe/runtimeProjectionPatch.test.js \
  src/components/universe/scene/performanceBudget.test.js \
  src/components/universe/surfaceLayoutTokens.test.js \
  src/components/universe/governanceModeContract.test.js \
  src/components/universe/starContract.test.js \
  src/components/universe/QuickGridOverlay.civilizations.test.jsx \
  src/components/universe/planetCivilizationMatrix.placeholder.test.js
```

## 7. Otevrene polozky

- [x] 2026-03-11 Doplnen vlastnik a test mapping pro `R1-R5`.
- [ ] Po dalsi FE iteraci potvrdit limity `R2/R4` i praktickym viewport smoke checkem.
