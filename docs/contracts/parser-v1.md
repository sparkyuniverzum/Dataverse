# DataVerse Parser Contract v1

Status: frozen from current implementation (`app/services/parser_service.py`)
Date: 2026-03-01

## Output model
- Diagnostic API (`parse_with_diagnostics`) returns `ParseResult`:
- `tasks: list[AtomicTask]`
- `errors: list[str]`
- Compatibility API (`parse`) returns only `list[AtomicTask]` and drops diagnostics.

## Deterministic parse order
Input is normalized by `text.strip()`.

Pre-checks:
- Empty input => `errors=["Command is empty."]` (`parse(...)` returns `[]`).
- Unbalanced parentheses => `errors=["Unbalanced parentheses in command."]`.
- Missing `:` after known colon-verbs => `errors=["Missing ':' after command verb '<verb>'."]`.

Strategy order:
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

4. `spoj` command (explicit relation builder)
- Syntax: `Spoj : A, B` or `Spoj : A + B [+ C ...]`.
- Requires at least 2 operands.
- Emits `INGEST` for each operand, then sequential `LINK(type="RELATION")` edges (`A-B`, `B-C`, ...).

5. Triple-shot command
- Syntax: `<verb> : <target> [@ <condition>]`
- Verb map:
- `ukaz/ukaž/najdi/show/find -> SELECT`
- `smaz/smaž/zhasni/delete -> EXTINGUISH`
- Output params: `{ target_asteroid, condition? }`
- `spoj` is not handled by triple-shot map; it has dedicated parser stage above.

After strategy stage:
- Mixed top-level operators (`+` and `:` in one command) => error.
- Top-level `+` chain => sequential `RELATION` links.
- Top-level `:` chain => sequential `TYPE` links.
- Fallback => single `INGEST`.

## Metadata in parentheses
Token syntax:
- `Name (key: value, key2 = value2)`

Rules:
- Metadata block is parsed only for top-level trailing `( ... )`.
- Pair separators inside metadata: comma.
- Key/value separator: `:` or `=`.
- Keys/values are trimmed.
- Values stay as strings in parser output (coercion is only used for guardian threshold).
- For chain links, if either side has metadata, parser attaches link metadata:
- `metadata.source_asteroid` and `metadata.target_asteroid`.

Examples:
- `Firma (obor: IT) + Produkt (cena: 500)`
- `A : B : C` => `INGEST(A), INGEST(B), INGEST(C), LINK(TYPE), LINK(TYPE)`
- `Spoj : A + B + C` => `INGEST(A), INGEST(B), INGEST(C), LINK(RELATION), LINK(RELATION)`

## Task semantics expected by executor
- `INGEST`: upsert-like find/create asteroid by exact `value`.
- `LINK`: create bond (or return existing same relation). For `RELATION`, pair is canonicalized as undirected (`A-B == B-A`).
- `SELECT`: local selection over projected active asteroids.
- `DELETE`/`EXTINGUISH`: soft-delete asteroid + connected bonds.
- `SET_FORMULA`: patch asteroid metadata with formula string.
- `ADD_GUARDIAN`: append guardian rule to metadata `_guardians`.
