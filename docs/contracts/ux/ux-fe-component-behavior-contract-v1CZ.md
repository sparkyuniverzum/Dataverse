# Kontrakt: Behaviorální Kontrakt Komponent

| Metadata | Hodnota |
| :--- | :--- |
| **Status** | AKTIVNÍ |
| **Verze** | 2.0 |
| **Vlastník** | UX Design Architektura |
| **Poslední změna** | 2026-03-15 |

## 1. Účel Kontraktu
Tento dokument definuje závazné chování Frontendových komponent systému Dataverse. Cílem je zajistit deterministické uživatelské rozhraní, které správně reflektuje backendovou pravdu, dodržuje výkonnostní limity a poskytuje jasnou odezvu při mutacích a chybových stavech.

## 2. Funkční Specifikace (Topologie a Stavy)

### 2.1 Komponentová Topologie
- **Scene Layer**: `UniverseCanvas`, `SpatialLabels`. Zodpovídá za vizualizaci a výběr, nikdy neprovádí přímou mutaci dat.
- **HUD Layer**: `GlobalStatusHUD`, `CommandBar`. Zajišťuje globální přehled, scope indikaci a vstup pro příkazy.
- **Operation Layer**: `QuickGridOverlay`, `InspectorPanels`. Kanonické rozhraní pro editaci řádků (Civilizations) a vazeb.

### 2.2 Stavový Model Operací
Všechny komponenty operující s daty musí implementovat tyto stavy:
1. `idle`: Klidový stav.
2. `draft`: Lokální změna neodeslaná na server.
3. `previewing`: Čekání na validaci/plán od backendu.
4. `committing`: Probíhající zápis.
5. `committed`: Úspěšné potvrzení.
6. `repair_required`: Zablokovaná operace vyžadující zásah (OCC konflikt, validace).

## 3. Interakční Pravidla
- **Selection Synchronicity**: Výběr ve 3D scéně, Gridu a Sidebaru musí být v každém okamžiku synchronní.
- **No Silent Failures**: Každé selhání zápisu musí být doprovázeno vysvětlením (Explainability) a cestou k nápravě (Repair Path).
- **Focus Integrity**: Ztráta fokusu nesmí vést k tichému zahození neuloženého draftu bez varování uživatele.
- **Asynchronní Reflexe**: Scéna reflektuje změny asynchronně, ale deterministicky na základě eventů z backendu.

## 4. Akceptační kritéria (Hard Gates)
- [ ] Všechny kritické akce jsou dosažitelné pomocí klávesnice (Keyboard reachability).
- [ ] Latence vizuální odezvy na výběr nepřekračuje 120ms (p95).
- [ ] Každá mutace využívá kanonické API endpointy (`/civilizations*`, `/bonds*`).
- [ ] Chybové stavy (OCC, Network) obsahují explicitní tlačítko "Retry" nebo "Repair".
- [ ] Telemetrické eventy jsou emitovány pro každý úspěšný i neúspěšný commit.

## 5. Výkonnostní Budget
| Interakce | Budget (p75) | Budget (p95) |
| :--- | :--- | :--- |
| Selection Feedback | 80 ms | 120 ms |
| Command Ack | 180 ms | 300 ms |
| Drawer Open/Close | 220 ms | 320 ms |
