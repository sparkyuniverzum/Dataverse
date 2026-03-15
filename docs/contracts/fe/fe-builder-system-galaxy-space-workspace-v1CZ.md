# Kontrakt: FE Builder System (Galaxy Space Workspace)

| Metadata | Hodnota |
| :--- | :--- |
| **Status** | AKTIVNÍ |
| **Verze** | 2.0 |
| **Vlastník** | Produktové UX / FE Architektura |
| **Poslední změna** | 2026-03-15 |

## 1. Účel Kontraktu
Tento dokument definuje architekturu a chování Builder systému uvnitř hlavního pracovního prostoru galaxie. Builder není izolovaný modul, ale integrovaný systém vrstev zajišťující interakci s prostorem, příkazy a přesnou editaci dat při zachování backendové pravdy.

## 2. Vrstvy Builder Systému
Builder se skládá ze tří kooperujících vrstev:
- **Space Layer**: Diegetická orientace, volný pohyb, výběr objektů a přiblížení (approach).
- **Command Layer**: Záměr uživatele vyjádřený skrze `Command Bar`, parser `Plan preview` a vysvětlitelnost akce.
- **Precision Layer**: Datový grid jako kanonický editor reality pro přesnou editaci planet, civilizací a vazeb.

## 3. Závazná Pravidla Interakce
- **Single Click**: Výběr objektu (Selection).
- **Double Click**: Vstup do interakční vrstvy objektu (Approach/Focus).
- **Ctrl/Cmd+K**: Aktivace `Command Bar` s kontextovým záměrem.
- **Grid Access**: Grid se otevírá pouze pro specifické datové operace, není výchozím zobrazením.
- **Escape**: Návrat o úroveň výše v hierarchii prostoru/interakce.

## 4. Role Command Bar a Gridu
### 4.1 Command Bar (Vstup Záměru)
- Musí nést `scope lock` (kontext vybraného objektu).
- Povinně zobrazuje `Plan preview` před provedením mutace.
- Nesmí obcházet kanonické API cesty.

### 4.2 Grid (Editor Reality)
- Slouží k rychlé a přesné editaci tabulkových dat.
- Musí být striktně synchronizován s vizuální scénou.
- Row a Bond zápisy musí být dokončitelné čistě v rámci gridu.

## 5. Stavový Model (Finite State Machine)
Builder systém se řídí jednotným stavovým modelem:
`space_idle` -> `object_selected` -> `approach_active` -> `command_draft` -> `preview_ready` -> `commit_in_progress` -> `converged`.
*Chyby v jakékoliv fázi vedou do stavu `error_recoverable`, kde zůstává poslední validní krok zachován.*

## 6. Akceptační kritéria (Hard Gates)
- [ ] Builder nevyužívá paralelní stav reality (vždy se opírá o backend snapshot/read-model).
- [ ] Každá mutace (Planet, Civilization, Bond) prochází přes `Plan preview`.
- [ ] UI neblokuje prostor galaxie fullscreen modaly (zachování prostorového kontextu).
- [ ] Přechod mezi Scénou a Gridem je plynulý a zachovává integritu výběru (Selection).
- [ ] Všechny zápisy využívají kanonické endpointy (`/planets`, `/civilizations`, `/bonds`).

## 7. Připravený kód z archivu (Reuse)
- **Logika**: `planetBuilderFlow.js`, `visualBuilderStateMachine.js`, `selectionContextContract.js`.
- **Kontrakty**: `commandBarContract.js`, `gridCanvasTruthContract.js`.
- **Zákaz**: Nevracet původní `stage-zero` shell a fixní sidebary.
