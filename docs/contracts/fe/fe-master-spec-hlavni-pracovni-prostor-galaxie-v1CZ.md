# Kontrakt: Master Specifikace Galaxy Workspace

| Metadata | Hodnota |
| :--- | :--- |
| **Status** | AKTIVNÍ |
| **Verze** | 2.0 |
| **Vlastník** | Frontend Architektura |
| **Poslední změna** | 2026-03-15 |

## 1. Účel Kontraktu
Tento dokument definuje standardy a funkční rámec pro hlavní pracovní prostor (Galaxy Space Workspace). Cílem je sjednotit chování kamery, navigace, HUDu a operačních nástrojů (Grid, Command Bar) tak, aby uživatel vnímal systém jako konzistentní navigovatelný prostor, nikoliv jako sadu statických panelů.

## 2. Funkční Specifikace (Navigace a Fokus)

### 2.1 Kamera a Pohyb
- **Free Navigation**: Výchozí režim bez tvrdého zámku na centrální objekty.
- **Approach & Orbit**: Plynulé přiblížení k objektu (Double Click) s přechodem do jeho interakční vrstvy.
- **Escape Path**: Klávesa `Esc` vrací uživatele o úroveň výš (Fokus: Objekt -> Galaxie).

### 2.2 Režimy Fokusu
- **Navigation Focus**: Směr pohledu a pozice v prostoru.
- **Selection Focus**: Aktuálně vybraný objekt (Hvězda, Planeta, Vazba).
- **Interaction Focus**: Aktivní pracovní vrstva (např. Grid otevřený nad Planetou).

## 3. Komponenty Workspace

### 3.1 Diegetický HUD a Radar
- Minimalistické rozhraní ("skleněný design").
- Radar poskytuje signály o hustotě a integritě prostoru bez nutnosti přímé vizuální kontroly vzdálených objektů.

### 3.2 Command Bar (Operation Entry)
- Klávesová zkratka `Ctrl/Cmd+K`.
- Podpora režimů `Guided`, `Slash` a `Intent text`.
- Vždy vyžaduje `Plan Preview` před exekucí mutace.

### 3.3 Grid (Data Engine)
- Kanonický editor pro řádková data (Civilizations).
- Otevírá se kontextově nad vybraným objektem.
- Musí být plně synchronizován se 3D scénou a backendovým kontraktem.

## 4. Akceptační kritéria (Hard Gates)
- [ ] Kamera nesmí být permanentně uzamčena na Hvězdu (vyjma Onboardingu).
- [ ] Každý mutační tok prochází fázemi `Draft` -> `Preview` -> `Commit`.
- [ ] Změna v Gridu se deterministicky projeví ve 3D scéně (a naopak).
- [ ] Jsou dodrženy performance limity pro interakci (Selection feedback < 120ms).
- [ ] Reduced motion režim zachovává plnou funkčnost všech přechodů.

## 5. Technické Parametry (Kamera)
```typescript
interface CameraConfig {
  mode: 'free' | 'approach' | 'orbit';
  fov: number; // default 60
  near: 0.1;
  far: 10000;
  interpolation: 'smooth' | 'instant'; // based on user settings
}
```
