# DataVerse Parser Contract v1

Status: frozen from current implementation (`app/services/parser_service.py`)  
Date: 2026-02-28

## Output model
Parser returns `list[AtomicTask]`:
- `action: string`
- `params: object`

## Deterministic parse order
Input is `text.strip()`. If empty, output is `[]`.

1. Delete command
- Regex: `^(zhasni|smaz|smaž|delete)\s*:\s*(target)$` (case-insensitive).
- Output: `[{ action: "DELETE", params: { target } }]`

2. Guardian command
- Syntax: `Hlídej/Hlidej : Target.field OP threshold -> action`
- Operators: `> >= < <= ==`
- Output action: `ADD_GUARDIAN`
- Threshold is scalar-coerced (`100 000` -> `100000`, `12,5` -> `12.5`).

3. Formula command
- Syntax: `Spocitej/Vypocitej : Target.field = SUM|AVG|MIN|MAX|COUNT(source_attr)`
- Output action: `SET_FORMULA`
- Stored formula format is normalized to `=FUNC(attr)`.

4. Triple-shot command
- Syntax: `<verb> : <target> [@ <condition>]`
- Verb map:
- `ukaz/ukaž/najdi -> SELECT`
- `smaz/smaž/zhasni -> EXTINGUISH`
- `spoj -> LINK`
- Output params for `SELECT`: `{ target_asteroid, condition? }`

5. Plus graph link (`+`)
- Top-level split by `+` (parentheses-safe).
- For each part: emit `INGEST`.
- Then emit `LINK` with `type="RELATION"` between last two ingested entities.

6. Colon type link (`:`)
- Top-level split by first `:` (parentheses-safe).
- Emit `INGEST(left)`, `INGEST(right)`, then `LINK(type="TYPE")`.

7. Fallback
- Emit single `INGEST` from whole input.

## Metadata in parentheses (human-friendly)
Token syntax:
- `Name (key: value, key2 = value2)`

Rules:
- Metadata block is parsed only for top-level trailing `( ... )`.
- Pair separators inside metadata: comma.
- Key/value separator: `:` or `=`.
- Keys/values are trimmed.
- Values stay as strings in parser output (coercion is only used for guardian threshold).

Examples:
- `Firma (obor: IT) + Produkt (cena: 500)`
- `Zamestnanec : Pavel (pozice: reditel, plat = 100 000)`

## Task semantics expected by executor
- `INGEST`: upsert-like find/create asteroid by exact `value`.
- `LINK`: create bond (or return existing same `source,target,type`).
- `SELECT`: local selection over projected active asteroids.
- `DELETE`/`EXTINGUISH`: soft-delete asteroid + connected bonds.
- `SET_FORMULA`: patch asteroid metadata with formula string.
- `ADD_GUARDIAN`: append guardian rule to metadata `_guardians`.

## Known compatibility aliases
- Czech and ASCII variants are accepted for key commands (e.g. `spocitej` and `spočítej`).
