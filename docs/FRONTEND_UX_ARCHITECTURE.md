# DataVerse Frontend UX Architecture (Level 0-3)

## Cíl
- Jednoznačná hierarchie: `Landing -> Galaxie -> Planety (tabulky) -> Asteroidy (řádky) -> Buňky (metadata)`.
- Maximální 3D workspace: 3D canvas je primární plocha; HUD je plovoucí, přesouvatelný, minimalizovatelný.
- Běžné akce bez psaní: drag-link vazby, pravé tlačítko myši (context menu), fallback grid pro rychlou editaci.

## Komponentová struktura
- `App.jsx`
  - orchestruje Level 0/1/2-3 a auth flow.
- `components/screens/LandingDashboard.jsx`
  - Level 0, čistě 2D login/register.
- `components/screens/GalaxySelectorScreen.jsx`
  - Level 1, výběr a správa galaxií.
- `components/universe/UniverseWorkspace.jsx`
  - Level 2+3, integrace dat, panelů a 3D scény.
- `components/universe/UniverseCanvas.jsx`
  - R3F render planet/asteroidů, bond linek, drag-link preview.
- `components/universe/CameraPilot.jsx`
  - plynulé přelety kamery mezi přehledem a lokálním fokusem.
- `components/ui/FloatingPanel.jsx`
  - draggable/resizable/collapsible HUD panely.
- `components/ui/ContextMenu.jsx`
  - pravé tlačítko nad uzlem (Focus/Edit/Soft Delete).

## State management (Zustand)
- `store/useUniverseStore.js`
  - `level`, `selectedGalaxyId`, `selectedTableId`, `selectedAsteroidId`
  - `camera` (target/pozice/min/max distance)
  - `panels` (Command/Inspector/Grid)
  - `contextMenu`
  - `linkDraft` (source -> pointer)

## Planet <-> Grid sync contract (runtime)
- Grid rows must be derived only from the same source cycle as selected Planet:
  - `GET /universe/snapshot`
  - `GET /universe/tables`
- SSE stream (`/galaxies/{galaxy_id}/events/stream`) is convergence trigger:
  - on `update`, refresh both projection endpoints in one cycle
  - keep `last_event_seq` cursor per selected galaxy/branch
- Write flow:
  - optimistic local pending state for row/link mutation
  - authoritative reconcile after write response and post-stream refresh
  - on OCC conflict (`409`) clear pending mark, show deterministic conflict toast, reload projections
- Selection resilience:
  - selected `table_id` survives refresh if still present
  - if missing (extinguished/scope change), fallback to first table and reset selected row
- Quick Grid and 3D Planet view must consume the same in-memory projection objects (no separate fetch models).

## Layout engine
- `lib/hierarchy_layout.js`
  - Planety (`tableNodes`): d3-force s odpuzováním + kolizemi + centeringem + table-link přitažlivostí.
  - Asteroidy (`asteroidNodes`): samostatná simulace jen uvnitř vybrané planety (cluster/orbit), čímž se tabulky navzájem nemíchají.
  - Výstup: stabilní pozice + čitelné clustery.

## UX pravidla
- Soft Delete only: kontext akce „Zhasnout" volá PATCH endpoint, bez hard delete.
- Historický mód (`as_of`) zamyká zápisy.
- Grid fallback vysvětluje tabulkový model:
  - Planeta = tabulka
  - Asteroid = řádek
  - Metadata = buňky

## FE DoD for perfect sync
- No stale rows after write + stream converge.
- No phantom rows after soft extinguish.
- No duplicate rows after reconnect/reload.
- Grid sort/filter state remains stable after incremental updates.
- Selected Planet badge shows `contract_version` and does not allow schema-blind edits.

## Drag & Drop Bonding
- L2 (Souhvezdi/Entity):
  - `LMB click` = vstup do vybrane Planety.
  - `RMB click` = kontext menu (focus/back).
- L3 (Mesice):
  - `LMB click` = fokus na Mesic.
  - `RMB click` = kontext menu (focus/edit/soft delete).
  - `RMB drag` nebo `Shift + LMB drag` z Mesice spusti `linkDraft`.
- Pohyb: `pointerMove` aktualizuje cílový bod linky.
- Konec:
  - drop na jiný uzel => `POST /bonds/link`
  - drop mimo cíl => cancel

## Kamera
- Level 2: auto-framing celé galaxie/planet.
- Level 3: fokus na vybranou planetu.
- Asteroid fokus: detailní orbit kolem instance.
