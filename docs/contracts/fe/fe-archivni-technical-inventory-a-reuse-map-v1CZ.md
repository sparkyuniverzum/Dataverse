# Kontrakt: Technický Inventář a Reuse Mapa (Archiv)

| Metadata | Hodnota |
| :--- | :--- |
| **Status** | AKTIVNÍ |
| **Verze** | 2.0 |
| **Vlastník** | Frontend Architektura |
| **Poslední změna** | 2026-03-15 |

## 1. Účel Kontraktu
Tento dokument definuje závazný technický inventář archivu `frontend/src/_inspiration_reset_20260312/` a stanovuje pravidla pro znovupoužití (reuse) kvalitních technických stavebnic v rámci nových FE fází (FE-R1 až FE-R4). Cílem je zamezit duplicitnímu vývoji a zajistit kontinuitu technické logiky.

## 2. Rozsah Inventáře (Scope)
Technický inventář pokrývá výhradně:
- **Hooks**: `frontend/src/_inspiration_reset_20260312/hooks/`
- **Store**: `frontend/src/_inspiration_reset_20260312/store/`
- **Utility**: Helpery, kontrakty a controllery v `components/universe/`.
- **Důkazní sada**: Archivní testy sloužící jako referenční validace.

*Poznámka: Produktové UI návrhy a historické surface jsou mimo scope a nebudou mechanicky vraceny.*

## 3. Pravidla Znovupoužití (Reuse Policy)
Každý návrat kódu z archivu musí splňovat:
1. **Vazba na Milník**: Musí být explicitně spojen s konkrétním blokem (FE-R1 až FE-R4).
2. **Technický Přínos**: Zdůvodnění návratu (např. úspora času, ověřená logika).
3. **Testovací Krytí**: Návrat helperu/controlleru je kompletní pouze s jeho funkčním testem.
4. **Zákaz Mechanického Kopírování**: Kód musí být integrován do nové architektury, nikoliv jen slepě vložen.

## 4. Reuse Mapa (Klíčové Moduly)

### 4.1 Star Core a Governance
- **Status**: POUŽÍT (FE-R1+)
- **Kód**: `starContract.js`, `lawResolver.js`, `governanceModeContract.js`.
- **Účel**: Překlad backend payloadu do FE governance modelu, fyzikální signály pro autoritativní akce.

### 4.2 Runtime Sync a Projekční Jádro
- **Status**: POUŽÍT (FE-R2+)
- **Kód**: `runtimeSyncUtils.js`, `runtimeDeltaSync.js`, `useUniverseRuntimeSync.js`.
- **Účel**: SSE parsing, deduplikace delta streamu, konektivita workspace.

### 4.3 Workspace State a Persistence
- **Status**: POUŽÍT (FE-R1/R2+)
- **Kód**: `workspaceStateContract.js`, `workspaceUiPersistence.js`, `useUniverseStore.js`.
- **Účel**: Scope management, výběr objektů (selection context), lokální uložení preferencí.

### 4.4 Operation Layer Jádro
- **Status**: POUŽÍT (FE-R3+)
- **Kód**: `commandBarContract.js`, `parserComposerContract.js`, `civilizationLifecycle.js`.
- **Účel**: Preview příkazů, validace zápisů, workflow event bridge.

### 4.5 Recovery a Safety
- **Status**: POUŽÍT (FE-R3+)
- **Kód**: `workspaceContractExplainability.js`, `contractViolationRecovery.js`.
- **Účel**: Vysvětlitelné chyby kontraktu, opravné toky (repair flows).

## 5. Akceptační kritéria (Hard Gates)
- [ ] Každý vrácený soubor má odpovídající test v nové testovací sadě.
- [ ] Vrácená logika odpovídá standardům v2.0 (typy, dokumentace).
- [ ] Sekce "Připravený kód z archivu" je přítomna v každém novém implementačním plánu.
- [ ] Historické surface (JSX komponenty) byly bezpečně odstraněny z aktivní cesty.

## 6. Archivní Testovací Sada
Archiv zůstává referenčním zdrojem pro:
- **Kontrakty Operací**: `commandBarContract.test.js`, `parserComposerContract.test.js`.
- **Governance**: `starContract.test.js`, `lawResolver.test.js`.
- **Runtime**: `runtimeSyncUtils.test.js`, `runtimeNormalizationSignal.test.js`.
