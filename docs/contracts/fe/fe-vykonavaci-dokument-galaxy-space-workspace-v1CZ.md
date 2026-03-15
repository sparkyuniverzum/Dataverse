# Kontrakt: FE Vykonávací Dokument (Galaxy Space Workspace)

| Metadata | Hodnota |
| :--- | :--- |
| **Status** | AKTIVNÍ |
| **Verze** | 2.0 |
| **Vlastník** | Frontend Architektura / UX Design |
| **Poslední změna** | 2026-03-15 |

## 1. Účel Kontraktu
Tento dokument definuje závazný rozpad Frontendového vývoje do logických bloků (FE-R) a stanovuje přísná akceptační kritéria (Hard Gates) pro každý z nich. Cílem je zajistit lineární postup vývoje, kde každý krok staví na ověřeném a stabilním základě bez míchání zodpovědností.

## 2. Globální Akceptační Kritéria (Hard Gates)
Každý implementační blok musí splnit:
- **BE Truth Gate**: Každý prvek je napojen na reálný `payload source`. Zákaz simulace bez backendové pravdy.
- **User-Visible Gate**: Změna musí být vizuálně patrná v primárním flow. Vyžadován screenshot důkaz.
- **Interaction Gate**: Intuitivní ovládání (kamera, výběr) bez nutnosti studia zdrojového kódu.
- **Cleanup Gate**: Odstranění nebo archivace nahrazených dokumentů a starých implementací.
- **Focused Test Gate**: 100% zelené testy pro novou stavovou logiku a adaptéry.
- **UX-First Gate**: Priorita "Working Center" kvality – funkčnost musí být doprovázena produktovou estetikou.

## 3. Přehled Implementačních Bloků

### 3.1 Blok 1: Navigation Baseline (Dokončeno)
- **Cíl**: Volně navigovatelný prostor galaxie.
- **Scope**: Volná kamera, Selection focus, Approach na objekt, Radar baseline.
- **Status**: UZAVŘENO (2026-03-12).

### 3.2 Blok 2: Star Core Exterior (Dokončeno)
- **Cíl**: Hvězda jako centrální governance anchor v prostoru.
- **Scope**: Vizuál hvězdy, diegetické prstence, labely v prostoru, stavy `LOCKED/UNLOCKED`.
- **Status**: UZAVŘENO (2026-03-12).

### 3.3 Blok 3: Star Core Interior & Policy
- **Cíl**: Samostatná pracovní obrazovka interiéru hvězdy pro governance operace.
- **Scope**: Transition do interiéru, `Constitution Select`, `Policy Lock`, orbitální signalizace.
- **Status**: V REALIZACI (RE-DESIGN na interior screen).

## 4. Akceptační kritéria (Hard Gates)
- [ ] Důkazní screenshoty jsou přiloženy ke každému uzavřenému bloku.
- [ ] Implementace bloků probíhá lineárně (zákaz přebíhání bez uzavření předchozího gate).
- [ ] Veškerý nový kód v rámci bloku dodržuje standardy v2.0.
- [ ] Pro každý blok je definován "Mimo scope" seznam pro zamezení feature-creepu.

## 5. Odchylky a Rizika
Byla potvrzena riziková odchylka v Bloku 3: Interior hvězdy vyžaduje dedikovanou orchestration vrstvu na backendu (Workflow Truth) a samostatnou obrazovku, nikoliv jen hlubší zoom v galaxii. FE práce na Bloku 3 se řídí samostatným implementačním dokumentem.
