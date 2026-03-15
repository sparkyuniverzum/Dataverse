# Kontrakt: UX Informační Architektura a Navigace

| Metadata | Hodnota |
| :--- | :--- |
| **Status** | AKTIVNÍ |
| **Verze** | 2.0 (Profesionální Revize) |
| **Vlastník** | Produktové UX / FE Architektura |
| **Poslední změna** | 2026-03-15 |

## 1. Účel Kontraktu
Definovat navigační model a informační strukturu Dataverse tak, aby systém působil jako koherentní operační centrum. Kontrakt zajišťuje, že vizuální (3D) vrstva podporuje orientaci uživatele a neomezuje efektivitu práce s daty.

## 2. Vrstvy Systému (Layer Stack)
Dataverse UX se skládá ze tří vertikálních vrstev:
1. **Scene Layer (3D Space)**: Prostorová ontologie, kontext, atmosféra a vizuální dopad změn.
2. **HUD Layer (Interface Overlay)**: Skleněné panely, stavové badge, alerty a příkazová řádka.
3. **Operation Layer (Execution Core)**: Primární pracovní oblast pro manipulaci s daty (grid, command panely).

**Zlaté pravidlo**: V případě konfliktu mezi vizuální scénou a operací má vždy prioritu operace.

## 3. Navigační Model (Spaces)

### 3.1 Hlavní prostory
- **Nexus**: Výběr galaxie a vstupní bod.
- **Galaxy Workspace**: Primární operační prostor pro správu dat.
- **Star Core**: Governance a control plane (ústava, politika).
- **Planet Focus**: Detailní pohled na strukturu a schopnosti (capabilities).

### 3.2 Globální indikátory (vždy viditelné)
- **Scope Badge**: `MAIN` vs `BRANCH:<name>`.
- **Mode Indicator**: `NORMAL`, `PROMOTE`, `RECOVERY`, `GOVERNANCE`.
- **System Health**: Indikace stavu hvězdy a kritických varování.

## 4. Režimy Práce (Modes)
Systém striktně rozlišuje pracovní kontexty:
- **NORMAL**: Běžná manipulace s daty.
- **PROMOTE_REVIEW**: Schvalovací procesy mezi větvemi.
- **RECOVERY_REVIEW**: Řešení konfliktů a chybových stavů.
- **GOVERNANCE**: Konfigurace základních pravidel vesmíru.

## 5. Výkonnostní a Kvalitativní Cíle (Quality Gates)
- **Odezva HUD**: Přepnutí režimu musí být indikováno do 200 ms.
- **Rychlost operací**: 3D scéna nesmí blokovat kritické commit/repair akce.
- **Přístupnost**: Režim "Reduce Motion" vypíná nepodstatné spatial transitions.
- **Klávesová parita**: Všechny kritické akce v Workspace a Star Core musí být ovladatelné z klávesnice.

## 6. Akceptační kritéria (Hard Gates)
- [ ] Žádná entita není editována mimo svou ontologickou vrstvu (např. Star Core není editován jako datový řádek).
- [ ] Každý context switch jasně deklaruje, zda zachovává nebo resetuje aktuální výběr (selection).
- [ ] Čas k první možné akci (Time-to-first-actionable-edit) je <= 3.0 s (p75).
- [ ] Explicitní textový indikátor větve (Branch Badge) je přítomen a čitelný i v grayscale režimu.
