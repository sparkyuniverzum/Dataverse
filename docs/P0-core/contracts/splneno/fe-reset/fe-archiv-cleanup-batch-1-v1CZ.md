# FE archiv cleanup batch 1 v1

Stav: splneno (provedeny cleanup batch 1)
Datum: 2026-03-12
Vlastnik: FE architektura + user-agent governance

## 1. Co se zmenilo

- [x] 2026-03-12 Byl smazan jisty archived produktovy odpad z `frontend/src/_inspiration_reset_20260312/`.
- [x] 2026-03-12 Byly smazany mrtve archived testy primo zavisle na odstranene surface.
- [x] 2026-03-12 Byl doplnen zapis, ze `cleanup batch 1` nezasahl pripraveny helper/contract/controller kod.

## 2. Proc se to zmenilo

Po davkach A-D a po technickem inventory uz bylo rozhodnuti dostatecne jasne:

1. nektere archived surface byly `NOK` bez dalsi obhajitelne hodnoty,
2. drzely v archivu zbytecny vizualni a souborovy balast,
3. zhorsovaly cistotu dalsi pripravy pro FE-R1.

Proto bylo spravne odstranit je hned, misto dalsiho pasivniho skladovani.

## 3. Definitivne odstranene soubory

Smazane archived product surface:

1. `frontend/src/_inspiration_reset_20260312/components/GalaxyGateScreen.jsx`
2. `frontend/src/_inspiration_reset_20260312/components/WorkspaceShell.jsx`
3. `frontend/src/_inspiration_reset_20260312/components/universe/UniverseWorkspace.jsx`
4. `frontend/src/_inspiration_reset_20260312/components/universe/WorkspaceSidebar.jsx`
5. `frontend/src/_inspiration_reset_20260312/components/universe/StageZeroSetupPanel.jsx`
6. `frontend/src/_inspiration_reset_20260312/components/universe/StageZeroSetupPanelContext.js`
7. `frontend/src/_inspiration_reset_20260312/components/universe/BondBuilderPanel.jsx`

Smazane mrtve archived testy a placeholder dukazy:

1. `frontend/src/_inspiration_reset_20260312/components/universe/WorkspaceSidebar.connectivity.test.jsx`
2. `frontend/src/_inspiration_reset_20260312/components/universe/StageZeroSetupPanel.preview.test.jsx`
3. `frontend/src/_inspiration_reset_20260312/components/universe/planetCivilizationMatrix.placeholder.test.js`

## 4. Co zustava zachovano

Zustava zachovano:

1. helpery,
2. kontrakty,
3. controllery,
4. runtime sync utility,
5. builder state-machine logika,
6. archived focused testy, ktere potvrzuji pripraveny kod,
7. scenicka a governance inspirace, ktera jeste nebyla schvalena k odstraneni

To je dulezite, protoze `cleanup batch 1` neni necitlive hromadne mazani archivu.

## 5. Co bylo zamerne ponechano pro dalsi rozhodnuti

Ponechane k dalsimu zvazeni:

1. `frontend/src/_inspiration_reset_20260312/components/universe/UniverseCanvas.jsx`
2. `frontend/src/_inspiration_reset_20260312/components/universe/StarHeartDashboard.jsx`
3. `frontend/src/_inspiration_reset_20260312/components/universe/GovernanceModeSurface.jsx`
4. `frontend/src/_inspiration_reset_20260312/components/universe/CameraPilot.jsx`
5. `frontend/src/_inspiration_reset_20260312/components/universe/LinkHoverTooltip.jsx`
6. `frontend/src/_inspiration_reset_20260312/components/universe/PlanetBuilderWizardHarnessPanel.jsx`
7. `frontend/src/_inspiration_reset_20260312/components/PlanetBuilderSmokeScreen.jsx`
8. `frontend/src/_inspiration_reset_20260312/screens/GalaxySelector3D.jsx`

Tyto soubory nejsou v `cleanup batch 1` oznacene jako pripraveny kod, ale ani jako okamzity odpad.

## 6. Vztah k reuse mape

`Cleanup batch 1` potvrzuje:

1. reuse mapa ve `docs/P0-core/contracts/aktivni/fe/fe-archivni-technical-inventory-a-reuse-map-v1CZ.md` zustava platna,
2. smazane surface nepatri do sekce `Pripraveny kod z archivu`,
3. technicke helpery a jejich archived testy zustavaji nedotcene.

## 7. Evidence

Minimalni dukaz tohoto cleanup bloku:

```bash
cd /mnt/c/Projekty/Dataverse
git diff -- docs/P0-core/README.md docs/P0-core/contracts/aktivni/fe/fe-archivni-technical-inventory-a-reuse-map-v1CZ.md docs/P0-core/contracts/aktivni/fe/fe-r1-priprava-audit-archivu-v1CZ.md docs/P0-core/contracts/splneno/fe-reset/fe-archiv-cleanup-batch-1-v1CZ.md frontend/src/_inspiration_reset_20260312/components/WorkspaceShell.jsx frontend/src/_inspiration_reset_20260312/components/GalaxyGateScreen.jsx frontend/src/_inspiration_reset_20260312/components/universe/UniverseWorkspace.jsx frontend/src/_inspiration_reset_20260312/components/universe/WorkspaceSidebar.jsx frontend/src/_inspiration_reset_20260312/components/universe/StageZeroSetupPanel.jsx frontend/src/_inspiration_reset_20260312/components/universe/BondBuilderPanel.jsx
git status --short docs/P0-core/README.md docs/P0-core/contracts/aktivni/fe/fe-archivni-technical-inventory-a-reuse-map-v1CZ.md docs/P0-core/contracts/aktivni/fe/fe-r1-priprava-audit-archivu-v1CZ.md docs/P0-core/contracts/splneno/fe-reset/fe-archiv-cleanup-batch-1-v1CZ.md frontend/src/_inspiration_reset_20260312/components frontend/src/_inspiration_reset_20260312/components/universe
```

Vysledek:

- [x] 2026-03-12 Produktovy archived odpad z `cleanup batch 1` byl odstraneny.
- [x] 2026-03-12 Pripraveny helper/contract/controller kod zustal zachovan.

## 8. Co zustava otevrene

- [ ] Rozhodnout `cleanup batch 2` pro dalsi archived surface, ktere nejsou pripraveny kod, ale zatim nebyly definitivne oznacene k odstraneni.
- [ ] Po FE-R1 navrhu pouzit reuse mapu a zapisovat do implementacnich dokumentu sekci `Pripraveny kod z archivu`.
