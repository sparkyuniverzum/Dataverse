# Kontrakt: FE Reset Rámec (Clean Slate)

| Metadata | Hodnota |
| :--- | :--- |
| **Status** | AKTIVNÍ |
| **Verze** | 2.0 |
| **Vlastník** | Frontend Architektura / UX Design |
| **Poslední změna** | 2026-03-15 |

## 1. Účel Kontraktu
Tento dokument definuje závazný rámec pro restart Frontendové části systému. Předchozí implementace byla vyhodnocena jako provozně nevyhovující. Reset stanovuje novou výchozí linii (Baseline), odděluje aktivní kód od inspirativního archivu a definuje fáze postupné obnovy systému (FE-R0 až FE-R4).

## 2. Definice Aktivního FE (Baseline)
Po resetu tvoří aktivní a produkčně připravený Frontend pouze:
- **Auth Experience**: Login flow a vstupní dashboard.
- **Minimalist Shell**: Základní kontejner aplikace (`App.jsx`, `WorkspaceShell.jsx`).
- **Clean Workspace**: Čistá vesmírná plocha bez legacy panelů, gridů a onboarding prvků.
- **Connectivity Guard**: Systém pro hlídání stavu spojení a integrity dat.

## 3. Fáze Obnovy (Roadmap FE-R)
1. **FE-R0: Clean Foundation**: Odstranění provozního balastu, potvrzení čisté báze.
2. **FE-R1: New First-View**: Návrh primárního vizuálního vjemu a první autoritativní akce.
3. **FE-R2: Core Interaction Skeleton**: Implementace základní interakční kostry nad novým konceptem.
4. **FE-R3: Guided Operation Layer**: Definice a obnova operační vrstvy (příkazy, grid).
5. **FE-R4: Advanced Workflows**: Návrat komplexních flow (onboarding, governance, timeline).

## 4. Správa Archivu (Inspirace)
Původní kód byl přesunut do `frontend/src/_inspiration_reset_20260312/`. Pro práci s archivem platí:
- **Zákaz mechanické integrace**: Žádný soubor nesmí být vrácen bez nového návrhu a zdůvodnění.
- **Auditní povinnost**: Každý návrat musí být zaznamenán v sekci "Připravený kód z archivu" v implementačním plánu.
- **Status NOK**: Komponenty označené jako nevyhovující v rámci auditu musí být definitivně odstraněny.

## 5. Hard-stop Pravidla
- [ ] Zákaz opravování starého runtime kódu (vše se staví znovu nad čistou bází).
- [ ] Zákaz přidávání paralelních surface bez jasné hierarchie "First-view".
- [ ] Zákaz obnovy operační vrstvy před schválením "First-view" konceptu.
- [ ] Povinnost doložit funkční testy pro každý modul vrácený z archivu.

## 6. Akceptační kritéria (Hard Gates)
- [ ] Build aplikace (`npm run build`) proběhne bez chyb nad čistou bází.
- [ ] Testovací baseline (`App.test.jsx`, `UniverseWorkspace.test.jsx`) je 100% zelená.
- [ ] `Technický Inventář a Reuse Mapa` je synchronizována s aktuální fází obnovy.
- [ ] Veškerý aktivní kód dodržuje standardy v2.0 (metadata, dokumentace, typy).
