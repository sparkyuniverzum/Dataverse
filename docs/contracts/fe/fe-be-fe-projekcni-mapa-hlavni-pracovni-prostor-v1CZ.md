# Kontrakt: Projekční Mapa Workspace (BE-FE)

| Metadata | Hodnota |
| :--- | :--- |
| **Status** | AKTIVNÍ |
| **Verze** | 2.0 |
| **Vlastník** | Frontend Architektura |
| **Poslední změna** | 2026-03-15 |

## 1. Účel Kontraktu
Tento dokument definuje závazné mapování mezi Backendovými datovými zdroji (Read Models) a jejich Frontendu-vlastní projekcí v rámci Galaxy Space Workspace. Cílem je zajistit, aby vizuální reprezentace objektů, HUDu a radarů odpovídala kanonické pravdě uložené na serveru.

## 2. Projekční Vrstvy

### 2.1 Vrstva A: Scope a Kontext
- **Zdroj**: `GET /galaxies`, `GET /branches`
- **Projekce**: Identita aktivní galaxie, přepínání větví, vizuální tonalita prostoru (Atmosphere).
- **Guard**: `workspaceContract.js`, `runtimeNormalizationSignal.js`

### 2.2 Vrstva B: Governance a Hvězda
- **Zdroj**: `GET /star-core/policy`, `GET /star-core/physics/profile`
- **Projekce**: Stav uzamčení (`lock_status`) -> Diegetický prstenec, režim ústavy (`law_preset`) -> Barva a puls hvězdy.
- **Guard**: `starContract.js`, `lawResolver.js`

### 2.3 Vrstva C: Prostorové Objekty
- **Zdroj**: `GET /universe/tables`, `GET /universe/snapshot`
- **Projekce**:
    - `table_id` -> Planeta (prostorový objekt).
    - `sector.center` -> Pozice v prostoru.
    - `members` -> Hustota vizuální aktivity.
    - `bonds` -> Fyzické linky a směrové toky energie.
- **Guard**: `projectionConvergenceGate.js`

### 2.4 Vrstva D: Telemetrie a Dashboardy
- **Zdroj**: `GET /galaxies/{id}/health`, `GET /galaxies/{id}/activity`
- **Projekce**: HUD ukazatele integrity, minimapa, radarové ozvěny (Echoes).

## 3. Pravidla Transformace Dat
- **Povinná Pětice**: Každá runtime surface musí definovat: `payload source`, `použitá pole`, `FE projekci`, `fallback chování` a `guard helper`.
- **Zákaz Optimistického Kreslení**: FE nesmí vizualizovat stavy (např. `LOCKED`), které nejsou explicitně potvrzeny v payloadu.
- **Historická Data**: Entity se statusem `extinguished` nejsou smazány, ale projektovány jako "ghost" (duchové) objekty s nízkou opacitou.

## 4. Akceptační kritéria (Hard Gates)
- [ ] Všechny projekce využívají výhradně definované API endpointy.
- [ ] Existuje validní guard pro každou projekční vrstvu.
- [ ] Neznámá pole nebo chybějící payloady jsou ošetřeny stavem `stabilizing` nebo `unavailable`.
- [ ] Vizuální fyzika (velikost, svit, puls) je lineárně odvozena z backendových koeficientů.

## 5. Příklad Mapování (Planeta)
```typescript
interface PlanetProjection {
  id: string; // from table_id
  position: Vector3; // from sector.center
  visuals: {
    size: number; // derived from size_factor
    hue: number; // derived from physics coefficients
    pulse: number; // derived from pulse_rate
  };
}
```
