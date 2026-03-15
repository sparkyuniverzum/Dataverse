# Kontrakt: UX Journeys a Visual Language

| Metadata | Hodnota |
| :--- | :--- |
| **Status** | AKTIVNÍ |
| **Verze** | 2.0 |
| **Vlastník** | Produktové UX / FE Design Systém |
| **Poslední změna** | 2026-03-15 |

## 1. Účel Kontraktu
Tento dokument definuje kritické uživatelské cesty (User Journeys) a vizuální jazyk systému. Cílem je zajistit špičkový prostorový zážitek ("wow moment") při zachování operátorské rychlosti a srozumitelnosti. Dokument stanovuje závazná pravidla pro "Cinematic Shell + Operational Core" přístup.

## 2. Klíčové User Journeys (Release Baseline)
- **J1: Nexus & Výběr Galaxie**: Jasné určení scope před vstupem do workspace.
- **J2: Seamless Transition**: Plynulý fly-through do workspace bez generic loading obrazovek.
- **J3: Star Core Policy Lock**: Pochopení governance gate (Constitution Select) před stavbou planet.
- **J4: Star Core Dive**: Přechod do interiéru hvězdy pro pokročilé governance operace.
- **J5: Planet & Civilization**: Rychlé vytvoření kontejnerů a zápis dat (Row CRUD) v rámci Gridu.
- **J6: Moon Capability**: Připojení modulů a vizualizace jejich dopadu na planetární kontrakt.
- **J7: Bond & Extinguish**: Intuitivní propojování civilizací a bezpečná archivace (Ghost state).

## 3. Visual Language System
- **Ontologie v Prostoru**:
    - `Star`: Governance kotva.
    - `Planet`: Strukturální kontejner.
    - `Moon`: Capability modul.
    - `Civilization`: Datový uzel (Row).
    - `Bond`: Sémantická vazba.
- **Materiály**: Volumetrická hloubka, translucent glass pro HUD, vysoká hustota dat v Gridu.
- **Barevná Sémantika**: Modrá (Stable), Amber (Warning/Gate), Červená (Error/Repair), Tónový posun (Branch).

## 4. Interaction Gramatika
- **Motion**: Vysvětluje změnu stavu nebo scope, nesmí rušit operátora při opakovaných úkonech.
- **Feedback**: Okamžitá odezva do 200 ms (p95).
- **Zákazy**: Žádné cinematic animace u běžných datových editací, žádné neprůhledné modaly zakrývající kontext.

## 5. Akceptační kritéria (Hard Gates)
- [ ] Prvních 30 sekund interakce jasně komunikuje aktivní scope, mode a další akci.
- [ ] Všechny kritické journeys (J1-J7) jsou podloženy "before/after" screenshoty.
- [ ] Systém nabízí `Repair Hint` pro každý blokující stav nebo chybu.
- [ ] Režim `Reduced Motion` zachovává 100% funkční paritu bez informační ztráty.
- [ ] Přechod z Nexusu do Workspace je plynulý a přeskočitelný (Skip transition).

## 6. Kvalitativní Standardy
- **Technical Completion**: Focused testy pro kritické komponenty a stavy journey.
- **User-Visible Completion**: Walkthrough ukázka pro klíčové operace.
- **Documentation Completion**: Aktualizace navazujících rizik a kontraktů.
