# FE-R1 audit archivu: Davka C operation a utility vrstvy v1

Stav: aktivni (auditni rozhodnuti pro FE reset davku C)
Datum: 2026-03-12
Vlastnik: Produktove UX + FE architektura + user-agent governance

## 1. Ucel

Tento dokument uzavira `Davka C: Operation a utility vrstvy` nad archivem `frontend/src/_inspiration_reset_20260312/components/universe/`.

Cil:

1. oddelit budouci operacni hodnotu od legacy utility sumu,
2. rozhodnout, co ma potencial pro dalsi faze po FE-R1,
3. pripravit podklad pro pozdejsi definitivni odstraneni `NOK` polozek po schvalene davce.

## 2. Scope davky C

Auditovane polozky:

1. `frontend/src/_inspiration_reset_20260312/components/universe/QuickGridOverlay.jsx`
2. `frontend/src/_inspiration_reset_20260312/components/universe/ParserComposerModal.jsx`
3. `frontend/src/_inspiration_reset_20260312/components/universe/BondBuilderPanel.jsx`
4. `frontend/src/_inspiration_reset_20260312/components/universe/WorkspaceContextMenu.jsx`
5. `frontend/src/_inspiration_reset_20260312/components/universe/RecoveryModeDrawer.jsx`
6. `frontend/src/_inspiration_reset_20260312/components/universe/PromoteReviewDrawer.jsx`
7. `frontend/src/_inspiration_reset_20260312/components/universe/commandBarContract.js`
8. `frontend/src/_inspiration_reset_20260312/components/universe/draftRailContract.js`
9. `frontend/src/_inspiration_reset_20260312/components/universe/quickGridWorkflowRail.js`
10. `frontend/src/_inspiration_reset_20260312/components/universe/operatingCenterUxContract.js`

## 3. Zavazne podminky prevzate z ridicich dokumentu

Tato davka byla hodnocena proti temto podminkam:

1. FE-R1 je porad `Star Core first`, ne operation-first start.
2. `OK` pro davku C neznamena „vratit hned“, ale „ma budoucí hodnotu pro pozdejsi fazi“.
3. Utility vrstva nesmi znovu rozbit first-view hierarchii.
4. Vse, co se neda obhajit jako jasna pozdejsi operator value, musi dostat `NOK`.

Zdroj:

1. `docs/P0-core/contracts/fe-reset-ramec-v1CZ.md`
2. `docs/P0-core/contracts/fe-r1-priprava-audit-archivu-v1CZ.md`
3. `docs/P0-core/governance/human-agent-alignment-protocol-v1.md`

## 4. Verdikty

### 4.1 Polozka

`frontend/src/_inspiration_reset_20260312/components/universe/QuickGridOverlay.jsx`

Status:

`mix: OK operacni jadro / NOK prehustena kompozice`

Proc:

`OK`:

1. Overlay drzel realnou operator value: planeta, civilizace a nerosty v jedne pracovni vrstve.
2. Workflow rail a composer pattern ukazovaly dobry smer pro guided operation.
3. Batch fronty, kontraktove guardy a workflow log mely smysl jako pozdejsi odborny pracovni mod.

`NOK`:

1. V archived stavu byl overlay prilis siroky a obsahove prehusteny.
2. Planet composer, schema composer, civilization composer, batch panely, mineral composer, lifecycle a workflow log byly slozene do jednoho masivniho surface.
3. Jako jeden overlay uz to nebyla rychla pracovni vrstva, ale vse-v-jednom operator console.
4. Tohle nesmi byt vraceno jako celek.

Co prevzit:

1. princip samostatne operation vrstvy oddelene od 3D sceny,
2. guided workflow rail s dalsim krokem,
3. kontraktove guardy a preview-orientovany zapis,
4. rozdeleni na planety, civilizace a nerosty jako jasne pracovni domeny.

Co odstranit:

1. archived mega-overlay jako hotovy kus,
2. zvyklost vrstvit do jednoho panelu vsechny composery, batche a logy najednou,
3. predstavu, ze operator value roste s hustotou jedne plochy.

Dukaz:

1. [QuickGridOverlay.jsx](/mnt/c/Projekty/Dataverse/frontend/src/_inspiration_reset_20260312/components/universe/QuickGridOverlay.jsx#L1421)
2. [QuickGridOverlay.jsx](/mnt/c/Projekty/Dataverse/frontend/src/_inspiration_reset_20260312/components/universe/QuickGridOverlay.jsx#L1473)
3. [QuickGridOverlay.jsx](/mnt/c/Projekty/Dataverse/frontend/src/_inspiration_reset_20260312/components/universe/QuickGridOverlay.jsx#L1572)
4. [QuickGridOverlay.jsx](/mnt/c/Projekty/Dataverse/frontend/src/_inspiration_reset_20260312/components/universe/QuickGridOverlay.jsx#L1794)
5. [QuickGridOverlay.jsx](/mnt/c/Projekty/Dataverse/frontend/src/_inspiration_reset_20260312/components/universe/QuickGridOverlay.jsx#L2098)
6. [QuickGridOverlay.jsx](/mnt/c/Projekty/Dataverse/frontend/src/_inspiration_reset_20260312/components/universe/QuickGridOverlay.jsx#L2589)

### 4.2 Polozka

`frontend/src/_inspiration_reset_20260312/components/universe/ParserComposerModal.jsx`

Status:

`OK`

Proc:

1. Modal jasne oddeloval prikaz, preview a execute.
2. Umoznoval backend preview bez zapisu a daval operatorovi predem dopad i ambiguity hints.
3. To je disciplinovany a obhajitelny pattern pro budoucí command vrstvu.

Co prevzit:

1. `preview before execute`,
2. ambiguity hints a explicitni resolve flow,
3. modalni command surface misto trvaleho panelu.

Co odstranit:

1. Nic okamzite.
2. Ma zustat jen jako inspiracni pattern pro pozdejsi operation layer, ne pro FE-R1 first-view.

Dukaz:

1. [ParserComposerModal.jsx](/mnt/c/Projekty/Dataverse/frontend/src/_inspiration_reset_20260312/components/universe/ParserComposerModal.jsx#L15)
2. [ParserComposerModal.jsx](/mnt/c/Projekty/Dataverse/frontend/src/_inspiration_reset_20260312/components/universe/ParserComposerModal.jsx#L116)
3. [ParserComposerModal.jsx](/mnt/c/Projekty/Dataverse/frontend/src/_inspiration_reset_20260312/components/universe/ParserComposerModal.jsx#L154)

### 4.3 Polozka

`frontend/src/_inspiration_reset_20260312/components/universe/BondBuilderPanel.jsx`

Status:

`mix: OK preview disciplina / NOK jako dalsi trvaly rail`

Proc:

`OK`:

1. Preview pred commitem a reasons seznam byly kvalitni write-safety pattern.
2. Byla tam explicitni sekvence source -> target -> type -> preview -> commit.

`NOK`:

1. Jako trvale otevreny floating panel pridaval dalsi konkurencni utility surface.
2. Pro FE-R1 ani FE-R2 neni duvod vracet bond builder jako defaultni pritomnou vrstvu.
3. Je to vhodne spis jako pozdejsi specializovany mod, ne jako soucast staleho layoutu.

Co prevzit:

1. pre-commit validation,
2. jasnou sekvenci tvorby vazby,
3. preview reasons jako safety pattern.

Co odstranit:

1. archived floating panel jako trvale pritomny layout element,
2. predstavu, ze vazba musi mit vlastni permanentni rail od zacatku.

Dukaz:

1. [BondBuilderPanel.jsx](/mnt/c/Projekty/Dataverse/frontend/src/_inspiration_reset_20260312/components/universe/BondBuilderPanel.jsx#L76)
2. [BondBuilderPanel.jsx](/mnt/c/Projekty/Dataverse/frontend/src/_inspiration_reset_20260312/components/universe/BondBuilderPanel.jsx#L180)
3. [BondBuilderPanel.jsx](/mnt/c/Projekty/Dataverse/frontend/src/_inspiration_reset_20260312/components/universe/BondBuilderPanel.jsx#L226)

### 4.4 Polozka

`frontend/src/_inspiration_reset_20260312/components/universe/WorkspaceContextMenu.jsx`

Status:

`OK`

Proc:

1. Je to lehka sekundarni utilita navazana na kontext.
2. Nezabira first-view hierarchii, protoze se zobrazuje jen kdyz je potreba.
3. To je lepsi pattern nez dalsi permanentni panel.

Co prevzit:

1. kontextove akce „jen kdyz jsou relevantni“,
2. lehkou lokalni menu vrstvu misto dalsiho trvaleho railu.

Co odstranit:

1. Nic okamzite.
2. Jen nevracet puvodni copy a strukturu bez noveho navrhu.

Dukaz:

1. [WorkspaceContextMenu.jsx](/mnt/c/Projekty/Dataverse/frontend/src/_inspiration_reset_20260312/components/universe/WorkspaceContextMenu.jsx#L11)
2. [WorkspaceContextMenu.jsx](/mnt/c/Projekty/Dataverse/frontend/src/_inspiration_reset_20260312/components/universe/WorkspaceContextMenu.jsx#L39)

### 4.5 Polozka

`frontend/src/_inspiration_reset_20260312/components/universe/RecoveryModeDrawer.jsx`

Status:

`OK pro pozdejsi fazi`

Proc:

1. Recovery byl soustreden do jedne opravne vrstvy a nerozsypany po cele obrazovce.
2. To je dobry pattern pro degradovany stav.
3. Zaroven to neni surface pro first-view ani pro FE-R1.

Co prevzit:

1. centralizaci recovery problemu do jedne vrstvy,
2. jasne CTA pro navrh opravy.

Co odstranit:

1. Nic okamzite.
2. Jen nevracet recovery drawer pred potvrzenim jadra workspace.

Dukaz:

1. [RecoveryModeDrawer.jsx](/mnt/c/Projekty/Dataverse/frontend/src/_inspiration_reset_20260312/components/universe/RecoveryModeDrawer.jsx#L18)
2. [RecoveryModeDrawer.jsx](/mnt/c/Projekty/Dataverse/frontend/src/_inspiration_reset_20260312/components/universe/RecoveryModeDrawer.jsx#L56)

### 4.6 Polozka

`frontend/src/_inspiration_reset_20260312/components/universe/PromoteReviewDrawer.jsx`

Status:

`OK pro pozdejsi fazi`

Proc:

1. Promote review mel jasne oddelenou review modalitu.
2. Checklist pred potvrzenim transferu je produktove obhajitelny.
3. Opet je to ale pozdejsi operator flow, ne first-view nebo early FE-R1 vec.

Co prevzit:

1. explicitni review pred potvrzenim branch promote,
2. checklist-driven potvrzovaci drawer.

Co odstranit:

1. Nic okamzite.
2. Jen nevracet promote review do early reset smeru.

Dukaz:

1. [PromoteReviewDrawer.jsx](/mnt/c/Projekty/Dataverse/frontend/src/_inspiration_reset_20260312/components/universe/PromoteReviewDrawer.jsx#L18)
2. [PromoteReviewDrawer.jsx](/mnt/c/Projekty/Dataverse/frontend/src/_inspiration_reset_20260312/components/universe/PromoteReviewDrawer.jsx#L43)

### 4.7 Polozka

`frontend/src/_inspiration_reset_20260312/components/universe/commandBarContract.js`

Status:

`OK`

Proc:

1. Kontrakt drzel jednoduchou a obhajitelnou logiku: preview, execute, ambiguity hints, rebind na planetu.
2. Je to uzitecny domenovy helper, ne user-facing clutter.

Co prevzit:

1. inferenci akce,
2. ambiguity hints,
3. rebind na aktivni planetu jako explicitni guard.

Co odstranit:

1. Nic okamzite.

Dukaz:

1. [commandBarContract.js](/mnt/c/Projekty/Dataverse/frontend/src/_inspiration_reset_20260312/components/universe/commandBarContract.js#L1)
2. [commandBarContract.js](/mnt/c/Projekty/Dataverse/frontend/src/_inspiration_reset_20260312/components/universe/commandBarContract.js#L31)
3. [commandBarContract.js](/mnt/c/Projekty/Dataverse/frontend/src/_inspiration_reset_20260312/components/universe/commandBarContract.js#L98)

### 4.8 Polozka

`frontend/src/_inspiration_reset_20260312/components/universe/draftRailContract.js`

Status:

`mix`

Proc:

`OK`:

1. Stav konceptualizoval preview/execute/bond busy stavy rozumne.

`NOK`:

1. Sam pojem `draft rail` uz vedl k udrzovani trvalych pomocnych railu.
2. V novem smeru nechceme znovu predpokladat, ze kazda draft logika potrebuje rail.

Co prevzit:

1. jen stavovy model pro command/bond draft,
2. ne samotny rail jako layout pattern.

Co odstranit:

1. terminologii a architektonicky predpoklad trvalych draft railu v early FE smeru.

Dukaz:

1. [draftRailContract.js](/mnt/c/Projekty/Dataverse/frontend/src/_inspiration_reset_20260312/components/universe/draftRailContract.js#L7)
2. [draftRailContract.js](/mnt/c/Projekty/Dataverse/frontend/src/_inspiration_reset_20260312/components/universe/draftRailContract.js#L57)

### 4.9 Polozka

`frontend/src/_inspiration_reset_20260312/components/universe/quickGridWorkflowRail.js`

Status:

`OK`

Proc:

1. Je to mala, disciplinovana pomocna logika „co je dalsi krok“.
2. To odpovida tomu, co chceme i po resetu: guidance bez dalsiho velkeho panelu.

Co prevzit:

1. jednoduchou next-action logiku,
2. guidance bez zbytecneho textoveho balastu.

Co odstranit:

1. Nic okamzite.

Dukaz:

1. [quickGridWorkflowRail.js](/mnt/c/Projekty/Dataverse/frontend/src/_inspiration_reset_20260312/components/universe/quickGridWorkflowRail.js#L1)

### 4.10 Polozka

`frontend/src/_inspiration_reset_20260312/components/universe/operatingCenterUxContract.js`

Status:

`mix`

Proc:

`OK`:

1. Pojmenovani modalu `promote`, `recovery`, `governance` a jejich copy smer bylo uzitecne.
2. Oddeleni presentation mode podle aktivniho drawer/modu bylo obhajitelne.

`NOK`:

1. Samotny kontrakt porad pocital s tim, ze operating center je kombinace vice modalit a railu uz v aktivnim workspace.
2. Po resetu chceme nejdriv postavit jadro, ne presentation orchestration pro mnoho support surface.

Co prevzit:

1. surface copy naming pro pozdejsi modu,
2. presentation mode switching az v pozdejsi fazi.

Co odstranit:

1. early zavislost na multi-surface operating-center orchestration.

Dukaz:

1. [operatingCenterUxContract.js](/mnt/c/Projekty/Dataverse/frontend/src/_inspiration_reset_20260312/components/universe/operatingCenterUxContract.js#L1)
2. [operatingCenterUxContract.js](/mnt/c/Projekty/Dataverse/frontend/src/_inspiration_reset_20260312/components/universe/operatingCenterUxContract.js#L20)

## 5. Souhrn davky C

`OK`:

1. command preview/execute modal s ambiguity hints,
2. lehka kontextova menu vrstva,
3. recovery/promote drawers jako pozdejsi specializovane modu,
4. workflow next-action logika,
5. domenove command helpery a kontraktove guardy.

`mix`:

1. `QuickGridOverlay` jako cenny operation zaklad, ale ne jako hotovy archived mega-panel,
2. `BondBuilderPanel` jako validacni pattern, ale ne jako trvaly floating rail,
3. `draftRailContract` a `operatingCenterUxContract` jako zdroj logiky, ne layout pravdy.

`NOK`:

1. vse-v-jednom utility hustota archived operation vrstvy,
2. predstava, ze kazdy pokrocily workflow potrebuje vlastni stale pritomny panel nebo rail.

## 6. Co z davky C plyne pro FE-R1 navrh

FE-R1 ma byt porad cisty a bez operation clutteru.

Pro dalsi faze z davky C plati:

1. operation vrstva ma vzniknout jako samostatny, disciplinovany mod,
2. command system ma stat na preview-before-execute,
3. guidance ma byt kratka a akcni,
4. specializovane workflow maji byt modalni nebo kontextove, ne trvale rozprostřene po scene.

FE-R1 nema opakovat:

1. mega-overlay s mnoha composery najednou,
2. permanentni floating utility panely bez vyzadani,
3. predstavu, ze operator value se musi projevit hned na first-view.

## 7. Otevrene po davce C

1. Davka C jeste nema schvalene definitivni mazani `NOK` polozek; to ma probehnout po odsouhlaseni davky.
2. Dalsi krok je `Davka D: Pokrocile workflow a builder vrstvy`.
3. Po davkach A+B+C uz je silny podklad pro strict FE-R1 navrh, ale builder/guided workflow audit jeste muze odhalit, co nesmime omylem vratit do governance-first startu.

## 8. Evidence

Pouzite prikazy:

```bash
cd /mnt/c/Projekty/Dataverse
sed -n '1,760p' frontend/src/_inspiration_reset_20260312/components/universe/QuickGridOverlay.jsx
sed -n '1,260p' frontend/src/_inspiration_reset_20260312/components/universe/ParserComposerModal.jsx
sed -n '1,260p' frontend/src/_inspiration_reset_20260312/components/universe/BondBuilderPanel.jsx
sed -n '1,260p' frontend/src/_inspiration_reset_20260312/components/universe/WorkspaceContextMenu.jsx
sed -n '1,260p' frontend/src/_inspiration_reset_20260312/components/universe/RecoveryModeDrawer.jsx
sed -n '1,260p' frontend/src/_inspiration_reset_20260312/components/universe/PromoteReviewDrawer.jsx
sed -n '1,260p' frontend/src/_inspiration_reset_20260312/components/universe/commandBarContract.js
sed -n '1,220p' frontend/src/_inspiration_reset_20260312/components/universe/draftRailContract.js
sed -n '1,220p' frontend/src/_inspiration_reset_20260312/components/universe/quickGridWorkflowRail.js
sed -n '1,260p' frontend/src/_inspiration_reset_20260312/components/universe/operatingCenterUxContract.js
rg -n "PLANET COMPOSER|CIVILIZATION COMPOSER|MINERAL COMPOSER|WORKFLOW LOG|COMMAND BAR|BOND BUILDER" frontend/src/_inspiration_reset_20260312/components/universe/QuickGridOverlay.jsx frontend/src/_inspiration_reset_20260312/components/universe/ParserComposerModal.jsx frontend/src/_inspiration_reset_20260312/components/universe/BondBuilderPanel.jsx
```

Vysledek:

1. `QuickGridOverlay.jsx` byl potvrzen jako silny operation zdroj, ale s prehustenou archived kompozici.
2. `ParserComposerModal.jsx` byl potvrzen jako kvalitni command preview pattern.
3. `BondBuilderPanel.jsx` potvrdil hodnotu pre-commit validace, ale ne trvaleho railu.
4. `RecoveryModeDrawer.jsx` a `PromoteReviewDrawer.jsx` byly potvrzeny jako pozdejsi specializovane workflow modu.
