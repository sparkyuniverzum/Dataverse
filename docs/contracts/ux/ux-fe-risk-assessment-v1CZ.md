# Kontrakt: UX/FE Riziková Analýza a Guardraily

| Metadata | Hodnota |
| :--- | :--- |
| **Status** | AKTIVNÍ |
| **Verze** | 2.0 |
| **Vlastník** | FE Architektura / UX Inženýrství |
| **Poslední změna** | 2026-03-15 |

## 1. Účel Kontraktu
Tento dokument definuje kritická implementační rizika na pomezí Frontendového vývoje a UX designu. Stanovuje závazné technické mantinely (guardraily), které brání degradaci výkonu, čitelnosti a ovladatelnosti systému. Dokument slouží jako doplňkový filtr pro akceptační testy (Hard Gates) všech FE modulů.

## 2. Kritická Rizika a Mitigace

### 2.1 R1: Synchronizace Scény a Operací (State Sync Hell)
- **Hrozba**: Vysoká latence při vazbě 3D renderu na každý mikro-update v gridu.
- **Guardrail**: Oddělené update smyčky pro UI a 3D scénu. Propagace pouze stavových změn (`previewed`, `committed`). Limit pro selection feedback < 100 ms.
- **Vlastník**: FE Runtime Owner.

### 2.2 R2: Kognitivní Přetížení Workspace
- **Hrozba**: Ztráta vizuální hierarchie při souběhu HUD, Gridu a 3D scény.
- **Guardrail**: Priorita operační vrstvy při konfliktu. Při šířce >= 1366px musí zůstat min. 40% plochy pro centrální focus zónu scény.
- **Vlastník**: FE UX Owner.

### 2.3 R3: Únava z Animací (Animation Fatigue)
- **Hrozba**: Zpomalení power-user workflow kvůli neustálým kamerovým přechodům.
- **Guardrail**: Přechody musí být přeskočitelné. Režim `Reduced Motion` s plnou funkční paritou. Preferovány okamžité skoky při opakovaných akcích.
- **Vlastník**: FE Interaction Owner.

### 2.4 R4: Responzivita a Viewport Limity
- **Hrozba**: Nepoužitelnost operační vrstvy na menších displejích.
- **Guardrail**: Pod 1024px automatický přepon do `Operation-first` režimu. Pod 768px zákaz souběžného renderingu plné 3D scény a komplexního gridu.
- **Vlastník**: FE Layout Owner.

### 2.5 R5: Ontologický Drift (Sémantika)
- **Hrozba**: Matení uživatele nekonzistentními termíny (např. záměna role měsíce a civilizace).
- **Guardrail**: Striktní mapování: `Civilization` = Row (Data), `Moon` = Capability (Module). Výhradně technická čeština.
- **Vlastník**: FE Domain Semantics Owner.

## 3. Akceptační kritéria (Hard Gates)
- [ ] Všechna rizika R1-R5 mají přiřazené funkční testy (např. `performanceBudget.test.js`).
- [ ] Implementace dodržuje definované limity šířky panelů pro různé viewporty.
- [ ] Každá nová mutace v UI copy prochází kontrolou sémantické konzistence.
- [ ] Systém plynule reaguje na změnu `Reduced Motion` v nastavení OS/prohlížeče.

## 4. Testovací Mapování
- **R1 (Sync)**: `useUniverseRuntimeSync.test.js`, `runtimeProjectionPatch.test.js`.
- **R2 (Layout)**: `surfaceLayoutTokens.test.js`, `operatingCenterUxContract.test.js`.
- **R3 (Motion)**: `CameraPilot.test.jsx`, `starContract.test.js`.
- **R4 (Viewport)**: `accessibilityPreview.test.jsx`, `workspaceContractExplainability.test.js`.
- **R5 (Semantics)**: `QuickGridOverlay.civilizations.test.jsx`, `workspaceFormatters.test.js`.
