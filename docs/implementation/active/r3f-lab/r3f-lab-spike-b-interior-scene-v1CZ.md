# Rozdělaná mise: Spike B - Realizace interiéru jádra v R3F Labu

| Metadata | Hodnota |
| :--- | :--- |
| **Status** | V REALIZACI |
| **Verze** | 1.1 |
| **Vlastník** | FE Architektura / Agent |
| **Zahájeno** | 2026-03-15 |

## 1. Cíl mise
V izolovaném prostředí `R3F Lab` vyvinout finální vizuální a matematický model **interiéru hvězdy (Star Core Interior)**. Tato mise řeší zablokovaný vývoj Bloku 3 tím, že odděluje komplexní R3F operace od produkčního runtime.

## 2. Plánované kroky (Akční plán)

### 2.1 Zpřesnění Geometrie a Struktury
- Nahradit placeholder modely reálnou strukturou:
    - **Reactor Core**: Centrální energetické těleso s vrstvenou geometrií.
    - **Governance Astrolabe**: Systém prstenců (mechanické ramena), které vizualizují stav uzamčení politik.
- Implementace hloubky scény (pokročilé hvězdné pole a mlhoviny).

### 2.2 Pokročilé Materiály a Shadery
- Nasadit emise a materiály reagující na barvy ústav (Constitution colors):
    - **Růst**: Agresivní červená, vysoká frekvence pulsů.
    - **Rovnováha**: Uklidňující modrá (Origin), stabilní rytmus.
    - **Stráž**: Zářivá zeleno-žlutá, pevná struktura.
    - **Archiv**: Tlumená šedá/bílá, nízká energie.
- Plynulé přechody mezi stavy pomocí `lerp` funkcí.

### 2.3 Interakční simulace (Policy Lock)
- Implementace vizuální odezvy na commandy:
    - **Vstup (Entry)**: Efekt nárazu energie a postupné stabilizace.
    - **Policy Lock**: Dramatické ztuhnutí prstenců, zvýšení jasu jádra a následné "vychladnutí" do stabilního stavu.

### 2.4 Hardening Adaptéru
- Rozšíření `starCoreInteriorLabAdapter.js` o parametry pro:
    - Rychlost rotace jednotlivých os.
    - Intenzitu ambientního šumu.
    - Bloom a post-processing parametry pro Lab renderer.

## 3. Očekávaný Dopad a Přínos
- **Technické odblokování**: Vyřešení prostorové dezorientace (framing) interiéru.
- **Vzorová komponenta**: Vznikne čistá 3D scéna, která bude později přenesena do `StarCoreInteriorScreen.jsx` bez nutnosti dalšího ladění.
- **Verifikace Kontraktu**: Potvrzení, že BE `InteriorReadModel` v2.0 poskytuje všechna potřebná data pro špičkový vizuální zážitek.

## 4. Akceptační kritéria (Hard Gates)
- [ ] Lab scéna `star_core_interior_core` zobrazuje komplexní mechaniku prstenců.
- [ ] Změna ústavy v presetu plynule přebarví celou scénu bez artefaktů.
- [ ] Simulace `Policy Lock` vyvolá jasně rozpoznatelnou vizuální sekvenci.
- [ ] Komponenta scény zůstává nezávislá na vnějším světě (všechna data jdou přes adaptér).

---
*Poznámka: Tato mise probíhá v plné izolaci v `src/lab/r3f`. Jakýkoliv průsak do produktu mimo povolené cesty je zakázán.*
