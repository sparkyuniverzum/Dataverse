# FE archivni technical inventory a reuse map v1

Stav: aktivni (zavazny technicky podklad pro FE-R1+)
Datum: 2026-03-12
Vlastnik: FE architektura + user-agent governance

## 1. Co se zmenilo

- [x] 2026-03-12 Byl proveden technicky inventory archivu `frontend/src/_inspiration_reset_20260312/` mimo user-visible vrstvu.
- [x] 2026-03-12 Byl zapsan reuse plan: co chceme pouzit, kam se to hodi a v jakem FE bloku se to ma vracet.
- [x] 2026-03-12 Byla oddelena kategorie `pripraveny kod` od kategorie `archivni produktove surface`.
- [x] 2026-03-12 Byla zapsana testova dukazni sada, ktera zustava v archivu jako reference pro budouci focused validace.

## 2. Proc se to zmenilo

Po auditu davek A-D bylo jasne, ze archiv neobsahuje jen nevyhovujici UI kompozici, ale i kvalitni technicke stavebnice:

1. kontrakty,
2. helpery,
3. controllery,
4. synchronizacni utility,
5. testove dukazy.

Bez tohoto inventory by hrozilo:

1. zbytecne prepisovani kvalitni logiky od nuly,
2. nejasne rozhodovani, co se ma vratit a kdy,
3. chaoticke vraceni kodu bez vazby na FE-R1 az FE-R4 plan.

## 3. Rozsah inventory

Technicky inventory pokryva:

1. `frontend/src/_inspiration_reset_20260312/hooks/`
2. `frontend/src/_inspiration_reset_20260312/store/`
3. helper/contract/controller soubory v `frontend/src/_inspiration_reset_20260312/components/universe/`
4. archivni testy jako dukazni a referencni sadu

Mimo scope tohoto dokumentu jsou:

1. produktove UI navrhy,
2. screenshotove hodnoceni surface,
3. prime rozhodovani o nove first-view kompozici

To uz bylo reseno v davkach A-D a navazujicim FE-R1 navrhu.

## 4. Zasada pouziti

Tento dokument neznamena, ze se archived kod ma vratit mechanicky.

Plati:

1. nejdriv priprava,
2. potom navrh,
3. potom implementace,
4. a az v implementaci je dovolene vratit konkretni pripraveny helper nebo controller.

Kazdy navrat z archivu musi byt:

1. vazany na konkretni FE blok,
2. zdovodneny user-visible nebo technickym prinosem,
3. potvrzen focused testem odpovidajicim danemu bloku.

## 5. Reuse mapa: chceme pouzit

### 5.1 Star Core a governance zaklad

Status:

1. `POUZIT`

Pripraveny kod:

1. `frontend/src/_inspiration_reset_20260312/components/universe/starContract.js`
2. `frontend/src/_inspiration_reset_20260312/components/universe/lawResolver.js`
3. `frontend/src/_inspiration_reset_20260312/components/universe/governanceModeContract.js`
4. `frontend/src/_inspiration_reset_20260312/components/universe/planetPhysicsParity.js`
5. `frontend/src/_inspiration_reset_20260312/components/universe/stageZeroVisibility.js`

Kam se hodi:

1. normalizace a klasifikace dat pro `Star Core first`,
2. preklad backend payloadu do FE governance modelu,
3. fyzikalni a policy signal pro prvni autoritativni akci,
4. budouci kontrola, zda je bezpecne prejit od hvezdy k dalsim objektum

Kdy aplikovat:

1. `FE-R1`, jakmile novy first-view koncept potrebuje realna `Star Core` data
2. `FE-R2`, pokud se governance lock promita do dalsich workspace stavovych prechodu

Dukaz:

1. `frontend/src/_inspiration_reset_20260312/components/universe/starContract.test.js`
2. `frontend/src/_inspiration_reset_20260312/components/universe/lawResolver.test.js`
3. `frontend/src/_inspiration_reset_20260312/components/universe/governanceModeContract.test.js`
4. `frontend/src/_inspiration_reset_20260312/components/universe/planetPhysicsParity.test.js`
5. `frontend/src/_inspiration_reset_20260312/components/universe/stageZeroVisibility.test.js`

### 5.2 Runtime sync a projekcni jadro

Status:

1. `POUZIT`

Pripraveny kod:

1. `frontend/src/_inspiration_reset_20260312/components/universe/runtimeSyncUtils.js`
2. `frontend/src/_inspiration_reset_20260312/components/universe/runtimeDeltaSync.js`
3. `frontend/src/_inspiration_reset_20260312/components/universe/runtimeProjectionPatch.js`
4. `frontend/src/_inspiration_reset_20260312/components/universe/runtimeNormalizationSignal.js`
5. `frontend/src/_inspiration_reset_20260312/components/universe/useUniverseRuntimeSync.js`
6. `frontend/src/_inspiration_reset_20260312/components/universe/runtimeConnectivityState.js`

Kam se hodi:

1. SSE parsing a buffer handling,
2. dedupe delta streamu,
3. bezpecne obnovovani projekce,
4. signalizace normalization driftu,
5. online/offline guardraily pro workspace

Kdy aplikovat:

1. `FE-R2`, az novy workspace prestane byt jen staticke pozadi a zacne cist runtime
2. `FE-R3`, pokud bude potreba plna stream orchestrace a connectivity behavior

Dukaz:

1. `frontend/src/_inspiration_reset_20260312/components/universe/runtimeSyncUtils.test.js`
2. `frontend/src/_inspiration_reset_20260312/components/universe/runtimeNormalizationSignal.test.js`
3. `frontend/src/_inspiration_reset_20260312/components/universe/runtimeProjectionPatch.test.js`
4. `frontend/src/_inspiration_reset_20260312/components/universe/runtimeConnectivityState.test.js`
5. `frontend/src/_inspiration_reset_20260312/components/universe/useUniverseRuntimeSync.test.js`

### 5.3 Workspace stav, scope a lokalni persistence

Status:

1. `POUZIT`

Pripraveny kod:

1. `frontend/src/_inspiration_reset_20260312/components/universe/workspaceStateContract.js`
2. `frontend/src/_inspiration_reset_20260312/components/universe/workspaceUiPersistence.js`
3. `frontend/src/_inspiration_reset_20260312/components/universe/branchVisibilityContract.js`
4. `frontend/src/_inspiration_reset_20260312/components/universe/selectionContextContract.js`
5. `frontend/src/_inspiration_reset_20260312/components/universe/selectionInspectorContract.js`
6. `frontend/src/_inspiration_reset_20260312/components/universe/workspaceFormatters.js`
7. `frontend/src/_inspiration_reset_20260312/store/useUniverseStore.js`

Kam se hodi:

1. scope/mode/sync model noveho workspace,
2. selection a context-menu logika,
3. branch viditelnost a pozdejsi multi-scope prace,
4. lokalni ulozeni UI preferenci,
5. formatovani labelu a grid dat,
6. maly store pro jednoduchy scope stav

Kdy aplikovat:

1. `FE-R1`, pokud first-view bude potrebovat explicitni scope/sync signal
2. `FE-R2`, pri prvni skutecne interakci a selection modelu
3. `FE-R3`, pri navratu branch/scope utility

Dukaz:

1. `frontend/src/_inspiration_reset_20260312/components/universe/workspaceStateContract.test.js`
2. `frontend/src/_inspiration_reset_20260312/components/universe/workspaceUiPersistence.test.js`
3. `frontend/src/_inspiration_reset_20260312/components/universe/branchVisibilityContract.test.js`
4. `frontend/src/_inspiration_reset_20260312/components/universe/selectionContextContract.test.js`
5. `frontend/src/_inspiration_reset_20260312/components/universe/selectionInspectorContract.test.js`
6. `frontend/src/_inspiration_reset_20260312/components/universe/workspaceFormatters.test.js`

### 5.4 Operation layer jadro

Status:

1. `POUZIT`

Pripraveny kod:

1. `frontend/src/_inspiration_reset_20260312/components/universe/commandBarContract.js`
2. `frontend/src/_inspiration_reset_20260312/components/universe/parserComposerContract.js`
3. `frontend/src/_inspiration_reset_20260312/components/universe/quickGridWorkflowRail.js`
4. `frontend/src/_inspiration_reset_20260312/components/universe/civilizationLifecycle.js`
5. `frontend/src/_inspiration_reset_20260312/components/universe/civilizationInspectorModel.js`
6. `frontend/src/_inspiration_reset_20260312/components/universe/moonWriteDefaults.js`
7. `frontend/src/_inspiration_reset_20260312/components/universe/rowWriteUtils.js`
8. `frontend/src/_inspiration_reset_20260312/components/universe/useCommandBarController.js`
9. `frontend/src/_inspiration_reset_20260312/components/universe/useMoonCrudController.js`
10. `frontend/src/_inspiration_reset_20260312/components/universe/useBondDraftController.js`
11. `frontend/src/_inspiration_reset_20260312/components/universe/workflowEventBridge.js`

Kam se hodi:

1. command preview before execute,
2. parser explainability,
3. canonical write guardy pro `civilization`,
4. lifecycle omezeni a OCC-ready mutace,
5. vazbovy draft jako samostatna logicka vrstva,
6. workflow event timeline mezi UI a runtime

Kdy aplikovat:

1. `FE-R3`, az bude potvrzeny novy operation layer
2. `FE-R4`, pokud se vrati slozitejsi parser a bond flow

Dukaz:

1. `frontend/src/_inspiration_reset_20260312/components/universe/commandBarContract.test.js`
2. `frontend/src/_inspiration_reset_20260312/components/universe/parserComposerContract.test.js`
3. `frontend/src/_inspiration_reset_20260312/components/universe/civilizationLifecycle.test.js`
4. `frontend/src/_inspiration_reset_20260312/components/universe/civilizationInspectorModel.test.js`
5. `frontend/src/_inspiration_reset_20260312/components/universe/moonWriteDefaults.test.js`
6. `frontend/src/_inspiration_reset_20260312/components/universe/rowWriteUtils.test.js`
7. `frontend/src/_inspiration_reset_20260312/components/universe/workflowEventBridge.test.js`

### 5.5 Recovery, explainability a contract safety

Status:

1. `POUZIT`

Pripraveny kod:

1. `frontend/src/_inspiration_reset_20260312/components/universe/workspaceContract.js`
2. `frontend/src/_inspiration_reset_20260312/components/universe/workspaceContractExplainability.js`
3. `frontend/src/_inspiration_reset_20260312/components/universe/contractViolationRecovery.js`
4. `frontend/src/_inspiration_reset_20260312/components/universe/repairFlowContract.js`
5. `frontend/src/_inspiration_reset_20260312/components/universe/tableContractMerge.js`
6. `frontend/src/_inspiration_reset_20260312/components/universe/projectionConvergenceGate.js`
7. `frontend/src/_inspiration_reset_20260312/components/universe/promoteReviewContract.js`
8. `frontend/src/_inspiration_reset_20260312/components/universe/recoveryModeContract.js`
9. `frontend/src/_inspiration_reset_20260312/components/universe/compareTimeTravelContract.js`
10. `frontend/src/_inspiration_reset_20260312/components/universe/timelineRewriteContract.js`

Kam se hodi:

1. vysvetlitelne kontraktove chyby,
2. guided repair navrhy,
3. merge a convergence kontroly,
4. branch review a promote explainability,
5. timeline a time-travel kontrakty pro pozdejsi expert workflow

Kdy aplikovat:

1. `FE-R3`, pokud nova operation vrstva bude potrebovat recovery a explainability baseline
2. `FE-R4`, pro branch/review/compare workflow

Dukaz:

1. `frontend/src/_inspiration_reset_20260312/components/universe/workspaceContract.test.js`
2. `frontend/src/_inspiration_reset_20260312/components/universe/workspaceContractExplainability.test.js`
3. `frontend/src/_inspiration_reset_20260312/components/universe/contractViolationRecovery.test.js`
4. `frontend/src/_inspiration_reset_20260312/components/universe/repairFlowContract.test.js`
5. `frontend/src/_inspiration_reset_20260312/components/universe/tableContractMerge.test.js`
6. `frontend/src/_inspiration_reset_20260312/components/universe/projectionConvergenceGate.test.js`
7. `frontend/src/_inspiration_reset_20260312/components/universe/promoteReviewContract.test.js`
8. `frontend/src/_inspiration_reset_20260312/components/universe/recoveryModeContract.test.js`
9. `frontend/src/_inspiration_reset_20260312/components/universe/compareTimeTravelContract.test.js`
10. `frontend/src/_inspiration_reset_20260312/components/universe/timelineRewriteContract.test.js`

### 5.6 Scene, motion a vizualni utility

Status:

1. `POUZIT OPATRNE`

Pripraveny kod:

1. `frontend/src/_inspiration_reset_20260312/components/universe/cameraPilotMath.js`
2. `frontend/src/_inspiration_reset_20260312/components/universe/surfaceLayoutTokens.js`
3. `frontend/src/_inspiration_reset_20260312/components/universe/surfaceVisualTokens.js`
4. `frontend/src/_inspiration_reset_20260312/components/universe/previewAccessibility.js`
5. `frontend/src/_inspiration_reset_20260312/components/universe/scene/performanceBudget.js`
6. `frontend/src/_inspiration_reset_20260312/components/universe/scene/physicsSystem.js`
7. `frontend/src/_inspiration_reset_20260312/components/universe/scene/sceneMath.js`
8. `frontend/src/_inspiration_reset_20260312/components/universe/scene/sceneStyling.js`
9. `frontend/src/_inspiration_reset_20260312/components/universe/scene/clusters.js`

Kam se hodi:

1. layout tokeny a vrstveni surface,
2. reduced-motion a contrast guardraily,
3. camera a scene matematika,
4. vykonnostni rozpocet pro pohybovou nebo preview vrstvu,
5. fyzikalni vizualizace planet a vazeb

Kdy aplikovat:

1. `FE-R1`, pouze pokud novy first-view potrebuje minimalni layout tokeny nebo accessibility guard
2. `FE-R2`, pokud se vrati camera/scene interakce
3. `FE-R3`, pokud operation layer dostane preview motion vrstvu

Dukaz:

1. `frontend/src/_inspiration_reset_20260312/components/universe/cameraPilotMath.test.js`
2. `frontend/src/_inspiration_reset_20260312/components/universe/surfaceLayoutTokens.test.js`
3. `frontend/src/_inspiration_reset_20260312/components/universe/surfaceVisualTokens.test.js`
4. `frontend/src/_inspiration_reset_20260312/components/universe/accessibilityPreview.test.jsx`
5. `frontend/src/_inspiration_reset_20260312/components/universe/scene/performanceBudget.test.js`
6. `frontend/src/_inspiration_reset_20260312/components/universe/scene/physicsSystem.test.js`

### 5.7 Builder a state-machine logika pro pozdeji

Status:

1. `ZVAZIT POZDEJI`

Pripraveny kod:

1. `frontend/src/_inspiration_reset_20260312/components/universe/planetBuilderFlow.js`
2. `frontend/src/_inspiration_reset_20260312/components/universe/planetBuilderUiState.js`
3. `frontend/src/_inspiration_reset_20260312/components/universe/planetBuilderConsistencyGuard.js`
4. `frontend/src/_inspiration_reset_20260312/components/universe/planetBuilderWizardHarness.js`
5. `frontend/src/_inspiration_reset_20260312/components/universe/visualBuilderStateMachine.js`
6. `frontend/src/_inspiration_reset_20260312/components/universe/stageZeroCommitPreview.js`
7. `frontend/src/_inspiration_reset_20260312/components/universe/stageZeroBuilder.js`
8. `frontend/src/_inspiration_reset_20260312/components/universe/stageZeroUtils.js`

Kam se hodi:

1. pokud se pozdeji vrati vicekrokove rizene flow,
2. jako logicka kostra bez navratu puvodniho builder-first UI,
3. pro kontrolu prechodu, checklistu a pre-commit preview

Kdy aplikovat:

1. ne v `FE-R1`
2. ne v `FE-R2`
3. nejdrive v `FE-R4`, pokud bude skutecne schvalene vicekrokove workflow

Dukaz:

1. `frontend/src/_inspiration_reset_20260312/components/universe/planetBuilderFlow.test.js`
2. `frontend/src/_inspiration_reset_20260312/components/universe/planetBuilderUiState.test.js`
3. `frontend/src/_inspiration_reset_20260312/components/universe/planetBuilderConsistencyGuard.test.js`
4. `frontend/src/_inspiration_reset_20260312/components/universe/planetBuilderWizardHarness.test.js`
5. `frontend/src/_inspiration_reset_20260312/components/universe/visualBuilderStateMachine.test.js`
6. `frontend/src/_inspiration_reset_20260312/components/universe/stageZeroCommitPreview.test.js`
7. `frontend/src/_inspiration_reset_20260312/components/universe/stageZeroBuilder.test.js`
8. `frontend/src/_inspiration_reset_20260312/components/universe/stageZeroUtils.test.js`

### 5.8 Entry gate helpery

Status:

1. `NEPOUZIVAT PRO FE-R1`
2. `ZVAZIT POZDEJI`, jen pokud se vedome vrati galaxy gate flow

Pripraveny kod:

1. `frontend/src/_inspiration_reset_20260312/hooks/galaxyGateStorage.js`
2. `frontend/src/_inspiration_reset_20260312/hooks/useGalaxyGate.js`

Kam se hodi:

1. pouze pokud by se vratil samostatny authenticated vyber galaxie pred workspace

Kdy aplikovat:

1. mimo aktualni FE reset plan
2. az po samostatnem rozhodnuti, ze se galaxy gate vraci

Dukaz:

1. `frontend/src/_inspiration_reset_20260312/hooks/useGalaxyGate.test.js`

## 6. Co nechceme vracet jako implementacni zdroj

Nasledujici soubory nejsou `pripraveny kod` pro navrat do aktivni cesty:

1. `frontend/src/_inspiration_reset_20260312/components/GalaxyGateScreen.jsx`
2. `frontend/src/_inspiration_reset_20260312/components/WorkspaceShell.jsx`
3. `frontend/src/_inspiration_reset_20260312/components/universe/UniverseWorkspace.jsx`
4. `frontend/src/_inspiration_reset_20260312/components/universe/WorkspaceSidebar.jsx`
5. `frontend/src/_inspiration_reset_20260312/components/universe/StageZeroSetupPanel.jsx`
6. `frontend/src/_inspiration_reset_20260312/components/universe/BondBuilderPanel.jsx`
7. `frontend/src/_inspiration_reset_20260312/components/universe/StarHeartDashboard.jsx` jako puvodni plna dashboard surface

Tyto soubory jsou:

1. historicke produktove surface,
2. auditovane v davkach A-D,
3. nevhodne pro prime vraceni do nove architektury.

## 7. Archivni testy jako dukazni sada

Archiv obsahuje rozsahlou testovou banku. Ta se nema vratit do aktivniho test suite mechanicky, ale zustava jako pripraveny dukazni zdroj.

Silne referencni sady:

1. operation kontrakty:
   - `commandBarContract.test.js`
   - `parserComposerContract.test.js`
   - `civilizationLifecycle.test.js`
   - `rowWriteUtils.test.js`
2. governance a star:
   - `starContract.test.js`
   - `lawResolver.test.js`
   - `governanceModeContract.test.js`
   - `planetPhysicsParity.test.js`
3. runtime sync:
   - `runtimeSyncUtils.test.js`
   - `runtimeProjectionPatch.test.js`
   - `runtimeNormalizationSignal.test.js`
   - `useUniverseRuntimeSync.test.js`
4. workspace model:
   - `workspaceStateContract.test.js`
   - `selectionContextContract.test.js`
   - `selectionInspectorContract.test.js`
   - `workspaceUiPersistence.test.js`
5. builder safety:
   - `planetBuilderFlow.test.js`
   - `visualBuilderStateMachine.test.js`
   - `stageZeroCommitPreview.test.js`

Pravidlo:

1. kdyz se vraci helper z archivu, ma se vratit i jeho focused test nebo jeho nova aktualizovana obdoba,
2. bez focused testu se navrat helperu nepovazuje za uzavreny.

## 8. Povinna poznamka v dalsich implementacnich dokumentech

Kazdy dalsi aktivni FE implementacni dokument musi obsahovat sekci:

1. `Pripraveny kod z archivu`

Tato sekce musi rict:

1. ktere konkretni archived helpery nebo controllery jsou pripraveny,
2. zda se v danem bloku skutecne pouziji,
3. proc se pouziji prave ted,
4. jaky focused test je potvrdi.

## 9. Evidence

Minimalni dukaz tohoto inventory:

```bash
cd /mnt/c/Projekty/Dataverse
rg --files frontend/src/_inspiration_reset_20260312
rg -n "^export (function|const|default)|^export default|^export \\{" frontend/src/_inspiration_reset_20260312 -g '!**/*.css'
find frontend/src/_inspiration_reset_20260312 -type f \\( -name '*test.js' -o -name '*test.jsx' \\) | sort
```

Vysledek:

- [x] 2026-03-12 Archiv byl pro technicke stavebnice inventarizovan.
- [x] 2026-03-12 Reuse mapa rozdeluje prepared code podle FE-R1 az FE-R4.
- [x] 2026-03-12 Archivni testy byly zapsany jako dukazni sada pro budouci navrat helperu.

## 10. Co zustava otevrene

- [ ] Po navrhu `FE-R1` doplnit do konkretni implementacni dokumentace sekci `Pripraveny kod z archivu` s odkazem na relevantni helpery z tohoto dokumentu.
- [ ] Po schvaleni konkretni implementacni davky provest uklid `NOK` archived surface po schvalenych davkach, ne jednim necitlivym mazanim.
