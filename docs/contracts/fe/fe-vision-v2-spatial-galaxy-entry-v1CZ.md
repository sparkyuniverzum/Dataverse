# Kontrakt: Vision - Spatial Galaxy Entry

| Metadata | Hodnota |
| :--- | :--- |
| **Status** | AKTIVNÍ |
| **Verze** | 2.0 |
| **Vlastník** | UX Design Architektura |
| **Poslední změna** | 2026-03-15 |

## 1. Účel Kontraktu
Tento dokument určuje nadřazený směr Frontend Experience pro vstup do galaxie a první interakci se `Star Core`. Cílem je definovat "Spatial Ontology" systému, kde prioritu má prostorové vnímání a diegetické rozhraní před klasickými 2D panely.

## 2. Vizuální Vize (Spatial Ontology)
- **Prostor nad Desktopem**: Galaxie je vnímána jako fyzický prostor. Hvězda je centrálním zdrojem zákonů, kolem které obíhají planety (datové kontejnery).
- **Diegetické UI**: Informace jsou integrovány přímo do světa (např. governance prstence kolem hvězdy), nikoliv pouze v HUD vrstvě.
- **Work First**: Efekty (Glow, Particles) nesmí narušovat srozumitelnost stavu a možnost provádět operace.

## 3. User Journey (Entry Flow)

### 3.1 Seamless Transition
Vstup do galaxie probíhá bez přerušení (žádné statické Loading obrazovky). Kamera plynule proplouvá z výběru galaxie (Nexus) do tmavého prostoru s taktickou mřížkou.

### 3.2 Ignition & Star Core UI
Zrození hvězdy (Ignition) aktivuje diegetický prstenec, který vizualizuje aktuální stav governance:
- `UNLOCKED` (Teplé barvy, nestabilní puls).
- `LOCKED` (Chladná modrá, stabilní jádro).

### 3.3 Constitution Select & Lock-in
Uživatel volí režim vesmíru (Ústavu) nikoliv přes formulář, ale skrze vizuální reprezentaci důsledků (např. změna luminosity při volbě "Růst"). Finální `Policy Lock` je doprovázen fyzickým "zaklapnutím" prstence.

## 4. Akceptační kritéria (Hard Gates)
- [ ] Prvky UI nezakrývají střed hvězdy v kritických fázích onboardingu.
- [ ] `Constitution Select` je povinným krokem před provedením `Policy Lock`.
- [ ] Přechod mezi stavy governance je doprovázen jasným vizuálním signálem (změna barvy/pulsace).
- [ ] Cinematic sekvence je povinná pouze při prvním vstupu; další vstupy jsou pracovní (zkrácené).
- [ ] Reduced motion režim zachovává srozumitelnost ontologie.

## 5. Klíčové Stavy (Vizuální)
| Fáze | Vizuální signál | Tonalita |
| :--- | :--- | :--- |
| Unlocked | Nestabilní puls, částice | Teplá (Žlutá/Oranžová) |
| Locked | Klidné jádro, fixní prstenec | Studená (Modrá/Cyan) |
| Transition | Akcelerace rotace prstence | Neutrální (Bílá) |
