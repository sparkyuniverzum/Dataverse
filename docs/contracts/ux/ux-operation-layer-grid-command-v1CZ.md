# Kontrakt: Operační Vrstva (Grid & Command Bar)

| Metadata | Hodnota |
| :--- | :--- |
| **Status** | AKTIVNÍ |
| **Verze** | 2.0 |
| **Vlastník** | UX Design Architektura |
| **Poslední změna** | 2026-03-15 |

## 1. Účel Kontraktu
Tento dokument definuje parametry operační vrstvy, která je zodpovědná za exekuci příkazů a přímou manipulaci s daty. Cílem je zajistit, aby `Grid` i `Command Bar` pracovaly s identickým modelem pravdy (Backend Parser v2) a poskytovaly uživateli bezpečnou cestu k mutaci dat skrze náhledy a validace.

## 2. Technická Specifikace (Parser & Executor)

### 2.1 Parser v2 Intenty
Kanonická vrstva, na kterou musí FE překládat všechny operace:
- `UPSERT_NODE`, `ASSIGN_ATTRIBUTE`
- `CREATE_LINK`, `FLOW`
- `EXTINGUISH_NODE`
- `SELECT_NODES`, `SET_FORMULA`, `ADD_GUARDIAN`

### 2.2 Bridge & Execution Actions
Každý intent se mapuje na exekuční akci: `INGEST`, `UPDATE_CIVILIZATION`, `LINK`, `DELETE`, `SET_FORMULA`. Smíšené selektory nebo nejednoznačné mutace bez explicitního targetu jsou zakázány.

## 3. Funkční Pravidla

### 3.1 Grid (Data Productivity)
- **Inline Validace**: Okamžitá typová kontrola při editaci v buňce.
- **Repair Lane**: Dedikovaný pruh pro zobrazení konfliktů (OCC, validace), který nezakrývá data.
- **Batch Processing**: Podpora hromadných změn s jedním finálním commitem (`Draft` -> `Preview` -> `Commit`).

### 3.2 Command Bar (Interaction Efficiency)
- **Guided & Intent Entry**: Podpora klikatelných čipů pro začátečníky i textového vstupu pro experty.
- **Plan Preview**: Povinné zobrazení seznamu atomic tasků, které příkaz vyvolá, včetně varování před destruktivními akcemi.
- **Scope Lock**: Vždy viditelná indikace aktuálního scope (`Galaxy`, `Branch`), ve kterém se příkaz vykoná.

## 4. Akceptační kritéria (Hard Gates)
- [ ] Dokumentace povelů ve FE plně odpovídá schopnostem Backend Parseru.
- [ ] Každá mutace z Command Baru vyžaduje explicitní potvrzení uživatelem po zobrazení `Plan Preview`.
- [ ] Systém neumožňuje odeslat příkaz bez validního `parser_token`.
- [ ] Chybové hlášky z parseru jsou přeloženy do lidsky srozumitelné češtiny s návrhem dalšího kroku.
- [ ] Rychlost editace v Gridu je srovnatelná s nativními tabulkovými editory (latence zápisu < 200ms).

## 5. Ukázka Parser Payloadu
```json
{
  "command": "nastav civ_01.populace na 5000",
  "context": {
    "galaxy_id": "uuid",
    "branch_id": "main"
  },
  "intent": "ASSIGN_ATTRIBUTE",
  "expected_event_seq": 1024
}
```
