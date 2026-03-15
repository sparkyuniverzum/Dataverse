# Kontrakt: Český Komandový Lexikon (DVC-CZ)

| Metadata | Hodnota |
| :--- | :--- |
| **Status** | AKTIVNÍ |
| **Verze** | 2.0 |
| **Vlastník** | Frontend Architektura |
| **Poslední změna** | 2026-03-15 |

## 1. Účel Kontraktu
Tento dokument definuje kanonický český slovník povelů pro systémový `Grid` a `Command Bar`. Cílem je zajistit jazykovou konzistenci mezi uživatelským rozhraním (nápověda, našeptávač) a exekučním parserem, eliminovat nejednoznačné interpretace a zajistit vysokou naučitelnost systému.

## 2. Funkční Specifikace (Kanonické Povely)

### 2.1 Operace s entitami (Rows/Minerals)
- `vytvor civilizaci <nazev>` -> `UPSERT_NODE`
- `nastav <cil>.<pole> na <hodnota>` -> `ASSIGN_ATTRIBUTE`
- `zhasni <cil>` -> `EXTINGUISH_NODE` (destruktivní operace)
- `vyber <cil> kde <podminka>` -> `SELECT_NODES`

### 2.2 Relace a logika (Bonds/Guardians)
- `propoj <zdroj> s <cil> jako <typ>` -> `CREATE_LINK`
- `tok <zdroj> -> <cil>` -> `FLOW` (směrová vazba)
- `vzorec <cil>.<pole> = <funkce>(<zdroj>)` -> `SET_FORMULA`
- `strazce <cil>.<pole> <op> <prahovka> -> <akce>` -> `ADD_GUARDIAN`

### 2.3 Hromadné zpracování
- `davka { <prikaz_1>; <prikaz_2>; ... }` -> `BULK_EXECUTION`

## 3. Pravidla (Terminologie a Aliasy)
- **Kanonická Ontologie**: Musí být dodržována terminologie (např. `civilizace` pro řádek, `měsíc` pro capability).
- **Zákaz synonym**: Je zakázáno používat neoficiální termíny (např. `asteroid`).
- **Správa Aliasů**: Aliasy smí zkracovat povel, ale nesmí měnit jeho sémantiku ani kolidovat s rezervovanými slovy.
- **Parser Parity**: Lexikon nesmí obsahovat povely, které nejsou podporovány v aktuální verzi parseru (`v2` s fallbackem na `v1`).

## 4. Akceptační kritéria (Hard Gates)
- [ ] Každý kanonický povel má validní mapování na Parser Intent a Bridge Action.
- [ ] FE nápověda čerpá data výhradně z tohoto source-of-truth kontraktu.
- [ ] Neznámý nebo nevalidní povel vrací strukturovanou chybu s návrhem opravy.
- [ ] Jakákoliv mutační operace vyžaduje `Plan Preview` před finálním potvrzením.

## 5. Mapování na Intenty
```json
{
  "commands": [
    { "phrase": "vytvor civilizaci", "intent": "UPSERT_NODE", "bridge": "INGEST" },
    { "phrase": "nastav", "intent": "ASSIGN_ATTRIBUTE", "bridge": "UPDATE_CIVILIZATION" },
    { "phrase": "propoj", "intent": "CREATE_LINK", "bridge": "LINK" }
  ]
}
```
