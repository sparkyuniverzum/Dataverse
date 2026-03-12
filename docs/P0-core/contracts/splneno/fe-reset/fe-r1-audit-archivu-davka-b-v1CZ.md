# FE-R1 audit archivu: Davka B universe layout a dominantni surface v1

Stav: splneno (auditni rozhodnuti pro FE reset davku B)
Datum: 2026-03-12
Vlastnik: Produktove UX + FE architektura + user-agent governance

## 1. Ucel

Tento dokument uzavira `Davka B: Universe layout a dominantni surface` nad archivem `frontend/src/_inspiration_reset_20260312/components/universe/`.

Cil:

1. oddelit silne jadro puvodniho workspace od pretezene kompozice,
2. pojmenovat, co podporovalo jednu autoritativni primarni akci,
3. pripravit podklad pro navrh noveho FE-R1 bez vraceni stareho layout chaosu.

## 2. Scope davky B

Auditovane polozky:

1. `frontend/src/_inspiration_reset_20260312/components/universe/UniverseWorkspace.jsx`
2. `frontend/src/_inspiration_reset_20260312/components/universe/UniverseCanvas.jsx`
3. `frontend/src/_inspiration_reset_20260312/components/universe/WorkspaceSidebar.jsx`
4. `frontend/src/_inspiration_reset_20260312/components/universe/GovernanceModeSurface.jsx`
5. `frontend/src/_inspiration_reset_20260312/components/universe/StarHeartDashboard.jsx`

## 3. Zavazne podminky prevzate z ridicich dokumentu

Tato davka byla hodnocena proti temto podminkam:

1. `Star Core first` je jediny spravny start noveho workspace.
2. First-view musi mit jednu autoritativni dominantni surface.
3. `OK` muze dostat jen to, co ma realny user-visible prinos a neposkozuje hierarchii.
4. `NOK` musi dostat vse, co rozbija prvni dojem soubehem vice ridicich panelu.

Zdroj:

1. `docs/P0-core/contracts/aktivni/fe/fe-reset-ramec-v1CZ.md`
2. `docs/P0-core/contracts/aktivni/fe/fe-r1-priprava-audit-archivu-v1CZ.md`
3. `docs/P0-core/governance/human-agent-alignment-protocol-v1.md`

## 4. Verdikty

### 4.1 Polozka

`frontend/src/_inspiration_reset_20260312/components/universe/UniverseCanvas.jsx`

Status:

`OK`

Proc:

1. Canvas drzel silny atmosfericky zaklad: tmu, hloubku, hvezdne pole a centralni hvezdu.
2. `SourceCoreStar` sedel v centru sceny a prirozene vytvarel autoritativni fokus.
3. Vizualni scena nesla wow efekt sama o sobe, bez nutnosti dalsiho utility obalu.

Co prevzit:

1. centralni vesmirnou plochu jako hlavni first-view medium,
2. hvezdne pole, svetelny fokus a hloubku prostoru,
3. hvezdu jako prirozeny centralni anchor noveho workspace.

Co odstranit:

1. Nic z tohoto souboru se nema vracet slepe.
2. Prevzit se ma princip sceny, ne cele archived API a interakcni hustota.

Dukaz:

1. [UniverseCanvas.jsx](/mnt/c/Projekty/Dataverse/frontend/src/_inspiration_reset_20260312/components/universe/UniverseCanvas.jsx#L161)
2. [UniverseCanvas.jsx](/mnt/c/Projekty/Dataverse/frontend/src/_inspiration_reset_20260312/components/universe/UniverseCanvas.jsx#L192)
3. [UniverseCanvas.jsx](/mnt/c/Projekty/Dataverse/frontend/src/_inspiration_reset_20260312/components/universe/UniverseCanvas.jsx#L193)

### 4.2 Polozka

`frontend/src/_inspiration_reset_20260312/components/universe/UniverseWorkspace.jsx`

Status:

`mix: OK governance gate / NOK celkova kompozice`

Proc:

`OK`:

1. `stage0-star-lock-gate` byl obsahove spravny a vedl presne na `Star Core first`.
2. Centrovana gate karta s jednim CTA mela spravnou hierarchickou logiku.
3. V okamziku, kdy byla sama dominantni, davala first-view dobry smer.

`NOK`:

1. Soubor skladal prilis mnoho soubeznych surface do jedne obrazovky.
2. Vedle canvasu a governance gate soucasne existovaly command bar, intro gate, blueprint panel, mission panel, sidebar, drawers, grid a dalsi modalni vrstvy.
3. Tato skladba rozbila jednu autoritativni first-view hierarchii a vytvorila operacni sum.
4. `UniverseWorkspace` se zmenil z dominantni sceny na orchestrator vseho najednou.

Co prevzit:

1. ideu centralni governance gate pro zamceni prvnich zakonu,
2. pravidlo, ze prvni blocker ma byt vizualne uprostred sceny a ne schovany v railu.

Co odstranit:

1. archived kompozicni pattern mnoha soubeznych surface v jednom first-view,
2. soubezne pouziti `command bar + mission panel + sidebar + drawers + overlay gate` jako vychoziho layoutu,
3. `intro gate` s prvni planetou jako paralelni dominantni vstup proti `Star Core first`.

Dukaz:

1. [UniverseWorkspace.jsx](/mnt/c/Projekty/Dataverse/frontend/src/_inspiration_reset_20260312/components/universe/UniverseWorkspace.jsx#L2486)
2. [UniverseWorkspace.jsx](/mnt/c/Projekty/Dataverse/frontend/src/_inspiration_reset_20260312/components/universe/UniverseWorkspace.jsx#L2601)
3. [UniverseWorkspace.jsx](/mnt/c/Projekty/Dataverse/frontend/src/_inspiration_reset_20260312/components/universe/UniverseWorkspace.jsx#L2707)
4. [UniverseWorkspace.jsx](/mnt/c/Projekty/Dataverse/frontend/src/_inspiration_reset_20260312/components/universe/UniverseWorkspace.jsx#L2769)
5. [UniverseWorkspace.jsx](/mnt/c/Projekty/Dataverse/frontend/src/_inspiration_reset_20260312/components/universe/UniverseWorkspace.jsx#L2842)
6. [UniverseWorkspace.jsx](/mnt/c/Projekty/Dataverse/frontend/src/_inspiration_reset_20260312/components/universe/UniverseWorkspace.jsx#L2951)
7. [UniverseWorkspace.jsx](/mnt/c/Projekty/Dataverse/frontend/src/_inspiration_reset_20260312/components/universe/UniverseWorkspace.jsx#L3069)
8. [UniverseWorkspace.jsx](/mnt/c/Projekty/Dataverse/frontend/src/_inspiration_reset_20260312/components/universe/UniverseWorkspace.jsx#L3091)

### 4.3 Polozka

`frontend/src/_inspiration_reset_20260312/components/universe/WorkspaceSidebar.jsx`

Status:

`NOK` pro first-view hierarchii

Proc:

1. Sidebar na sebe tahal prilis mnoho utility a administrativni agendy hned v prvnim pohledu.
2. Branches, time travel, compare, create branch, promote, connectivity, builder state, star heart CTA, planeta selector, civilization orbit a dalsi bloky se vrstvily do jednoho railu.
3. Tento rail byl prilis husty na to, aby mohl vedle centralni sceny zustat sekundarni.
4. Pro FE-R1 je to zly pattern: pomocna vrstva se tvari jako hlavni ridici konzole.

Co prevzit:

1. Nic jako first-view layout.
2. Jen vedomi, ze neco jako sidebar muze existovat pozdeji pro utility faze, ale ne jako primarni start.

Co odstranit:

1. archived predstavu pravostraneho all-in-one railu jako vychoziho layoutu,
2. first-view zavislost na utility side panelu,
3. administrativni shluk v jednom railu.

Dukaz:

1. [WorkspaceSidebar.jsx](/mnt/c/Projekty/Dataverse/frontend/src/_inspiration_reset_20260312/components/universe/WorkspaceSidebar.jsx#L151)
2. [WorkspaceSidebar.jsx](/mnt/c/Projekty/Dataverse/frontend/src/_inspiration_reset_20260312/components/universe/WorkspaceSidebar.jsx#L169)
3. [WorkspaceSidebar.jsx](/mnt/c/Projekty/Dataverse/frontend/src/_inspiration_reset_20260312/components/universe/WorkspaceSidebar.jsx#L202)
4. [WorkspaceSidebar.jsx](/mnt/c/Projekty/Dataverse/frontend/src/_inspiration_reset_20260312/components/universe/WorkspaceSidebar.jsx#L281)
5. [WorkspaceSidebar.jsx](/mnt/c/Projekty/Dataverse/frontend/src/_inspiration_reset_20260312/components/universe/WorkspaceSidebar.jsx#L363)
6. [WorkspaceSidebar.jsx](/mnt/c/Projekty/Dataverse/frontend/src/_inspiration_reset_20260312/components/universe/WorkspaceSidebar.jsx#L400)
7. [WorkspaceSidebar.jsx](/mnt/c/Projekty/Dataverse/frontend/src/_inspiration_reset_20260312/components/universe/WorkspaceSidebar.jsx#L439)
8. [WorkspaceSidebar.jsx](/mnt/c/Projekty/Dataverse/frontend/src/_inspiration_reset_20260312/components/universe/WorkspaceSidebar.jsx#L549)

### 4.4 Polozka

`frontend/src/_inspiration_reset_20260312/components/universe/GovernanceModeSurface.jsx`

Status:

`OK`

Proc:

1. Governance surface mela spravnou produktovou roli: kdyz je aktivni, vytlaci okoli a soustredi pozornost na jediny rezim.
2. Je to cista wrapper vrstva pro fullscreen governance modalitu, ne dalsi rail.
3. To je v souladu s `Star Core first`, pokud se pouzije disciplinovane.

Co prevzit:

1. princip plnoscreen governance modu,
2. modalni prepnuti do rezimu „ted resim jen srdce hvezdy“.

Co odstranit:

1. Nic okamzite.
2. Zachovat jen jako inspiracni pattern, ne jako hotovy archived runtime kus.

Dukaz:

1. [GovernanceModeSurface.jsx](/mnt/c/Projekty/Dataverse/frontend/src/_inspiration_reset_20260312/components/universe/GovernanceModeSurface.jsx#L17)
2. [GovernanceModeSurface.jsx](/mnt/c/Projekty/Dataverse/frontend/src/_inspiration_reset_20260312/components/universe/GovernanceModeSurface.jsx#L25)

### 4.5 Polozka

`frontend/src/_inspiration_reset_20260312/components/universe/StarHeartDashboard.jsx`

Status:

`mix: OK fokus / NOK datova hustota pro prvni dojem`

Proc:

`OK`:

1. Fullscreen overlay a centrovana shell karta podporovaly pocit, ze uzivatel vstoupil do autoritativniho jadra galaxie.
2. Vizuálně to bylo presvedcivejsi nez rail nebo maly drawer.
3. Jako pozdejsi governance workspace ma ten pattern hodnotu.

`NOK`:

1. Pro prvni dojem byl dashboard uz prilis datove hutny.
2. Aktivita, ustava, parser reliability, profily a dalsi karty vytvarely z prvni governance akce tezky expertni dashboard.
3. To je vhodne spis az po potvrzeni prvniho jednoducheho kroku, ne jako uplne prvni experience.

Co prevzit:

1. fullscreen governance rezim,
2. centrovanou shell architekturu,
3. pocit „vstupu do srdce hvezdy“ jako samostatne modalni udalosti.

Co odstranit:

1. predstavu, ze prvni governance krok musi otevrit rozsahly datovy dashboard,
2. parser/telemetry a dalsi hluboke operacni statistiky z prvniho first-view toku.

Dukaz:

1. [StarHeartDashboard.jsx](/mnt/c/Projekty/Dataverse/frontend/src/_inspiration_reset_20260312/components/universe/StarHeartDashboard.jsx#L182)
2. [StarHeartDashboard.jsx](/mnt/c/Projekty/Dataverse/frontend/src/_inspiration_reset_20260312/components/universe/StarHeartDashboard.jsx#L200)
3. [StarHeartDashboard.jsx](/mnt/c/Projekty/Dataverse/frontend/src/_inspiration_reset_20260312/components/universe/StarHeartDashboard.jsx#L219)
4. [StarHeartDashboard.jsx](/mnt/c/Projekty/Dataverse/frontend/src/_inspiration_reset_20260312/components/universe/StarHeartDashboard.jsx#L284)

## 5. Souhrn davky B

`OK`:

1. centralni canvas a scena s hvezdnym prostorem,
2. hvezda jako prirozeny vizualni anchor,
3. centralni governance gate pro `Star Core first`,
4. fullscreen governance modalita misto railu.

`NOK`:

1. archived `UniverseWorkspace` jako celkova first-view kompozice,
2. soubezne vrstveni command baru, mission panelu, blueprint panelu, sidebaru, drawers a gridu,
3. `WorkspaceSidebar` jako defaultni utility rail hned pri vstupu,
4. prvni governance krok prevedeny do prilis hustého expertniho dashboardu.

## 6. Co z davky B plyne pro FE-R1 navrh

FE-R1 ma stavet na tomto:

1. scena ano, ale jen s jednou autoritativni aktivni surface,
2. hvezda ma byt centrum pozornosti i duvodu dalsi akce,
3. governance-first ma zacit jednoduseji nez archived dashboard,
4. utility vrstvy se musi vratit az pozdeji a po jedne.

FE-R1 nema opakovat:

1. pravy rail jako implicitni vychozi konzoli,
2. levostranny mission/command stack soubezne s dalsimi dominantnimi panely,
3. konkurencni gate pro prvni planetu vedle governance-first logiky,
4. orchestrator vseho v jednom first-view monolitu.

## 7. Otevrene po davce B

1. Davka B jeste nema schvalene definitivni mazani `NOK` souboru; to ma probehnout po odsouhlaseni davky.
2. Dalsi krok je `Davka C: Operation a utility vrstvy`.
3. Po davkach A+B uz je dost podkladu pro prisny FE-R1 navrh, ale predtim je jeste vhodne auditovat utility vrstvu, aby se do navrhu nepropašovaly stare rail patterns.

## 8. Evidence

Pouzite prikazy:

```bash
cd /mnt/c/Projekty/Dataverse
sed -n '1,320p' frontend/src/_inspiration_reset_20260312/components/universe/UniverseWorkspace.jsx
sed -n '2460,3115p' frontend/src/_inspiration_reset_20260312/components/universe/UniverseWorkspace.jsx
sed -n '1,260p' frontend/src/_inspiration_reset_20260312/components/universe/UniverseCanvas.jsx
sed -n '1,560p' frontend/src/_inspiration_reset_20260312/components/universe/WorkspaceSidebar.jsx
sed -n '1,300p' frontend/src/_inspiration_reset_20260312/components/universe/GovernanceModeSurface.jsx
sed -n '1,300p' frontend/src/_inspiration_reset_20260312/components/universe/StarHeartDashboard.jsx
rg -n "UniverseCanvas|WorkspaceSidebar|GovernanceModeSurface|QuickGridOverlay|stage0-star-lock-gate|stage0-intro-gate|stage0-blueprint-panel|stage0-mission-panel" frontend/src/_inspiration_reset_20260312/components/universe/UniverseWorkspace.jsx
```

Vysledek:

1. `UniverseCanvas.jsx` byl potvrzen jako silne vizualni jadro.
2. `UniverseWorkspace.jsx` byl potvrzen jako pretezena kompozice s vice soupericimi surface.
3. `WorkspaceSidebar.jsx` byl potvrzen jako utility rail nevhodny pro first-view.
4. `GovernanceModeSurface.jsx` a `StarHeartDashboard.jsx` potvrdily hodnotu fullscreen governance modu, ale ne hustého prvniho dashboardu.
