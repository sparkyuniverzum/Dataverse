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

## Drag & Drop Bonding
- Začátek: `pointerDown` na uzlu vytvoří `linkDraft`.
- Pohyb: `pointerMove` aktualizuje cílový bod linky.
- Konec:
  - drop na jiný uzel => `POST /bonds/link`
  - drop mimo cíl => cancel

## Kamera
- Level 2: auto-framing celé galaxie/planet.
- Level 3: fokus na vybranou planetu.
- Asteroid fokus: detailní orbit kolem instance.
