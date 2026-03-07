# Planet/Civilization Glossary v1

Status: active (frozen for Wave 0)
Date: 2026-03-07
Owner: Product + Domain Lead
Depends on: `docs/contracts/civilization-mineral-contract-v2.md`, `docs/contracts/planet-civilization-logical-flow-dod-v1.md`

## 1. Purpose

Freeze one canonical vocabulary for the user-facing logical layer:
`Planet -> Moon -> Civilization -> Mineral -> Bond`.

This glossary is normative for contracts, FE copy, API docs, and tests.

## 2. Canonical terms

| Term | Canonical meaning | Is not | Runtime anchor |
|---|---|---|---|
| `Planet` | Data carrier and contract boundary where civilizations live. | A single data row. | `planet_id`, planet-level law profile |
| `Moon` | Capability operator attached to one planet; defines/executes rules over civilization minerals. | A civilization row/entity. | capability registry, moon impact contract |
| `Civilization` | Lifecycle entity (create/mutate/extinguish) bound to one planet; carries minerals and health state. | A generic table line without history. | `/civilizations*`, event stream, `state`, `health_score` |
| `Mineral` | Typed atomic value owned by one civilization and validated by laws/capabilities. | Only a visual cell. | `facts[]`, `value_type`, validation envelope |
| `Bond` | Directional relation between source civilization and target civilization with rule checks. | Just a UI line with no validation semantics. | bond preview/validate + commit flow |

## 3. Mineral classes (domain language)

1. `KRYSTAL` -> semantic text (`string`)
2. `IZOTOP` -> quantitative value (`number`)
3. `CHRONON` -> temporal value (`datetime`)
4. `MOST` -> typed reference (`reference envelope`)

Rule:
- minerals are validated under planet law and moon capability rules before commit.

## 4. Coupling rules (non-negotiable)

1. `Moon capability` and `Mineral validity` are tightly coupled.
2. `Moon` never replaces `Civilization`; it governs operations on civilization minerals.
3. `Civilization health` is derived from mineral validity and reference integrity.
4. `Bond` operations must run law checks before write (preview/validate first).

## 5. Anti-confusion mapping for UI copy

1. Use `Civilization` when discussing lifecycle state (`ACTIVE|WARNING|ANOMALY|ARCHIVED`).
2. Use `Mineral` when discussing value typing, validation, repair, and removal.
3. Use `Moon` when discussing capability/rule source (`which law blocked this action`).
4. Use `Bond` when discussing relation draft, preview reject reason, and commit.

## 6. Example (operator mental model)

1. User opens `Planet A`.
2. User opens `Moon Inspector` and sees affected mineral keys.
3. User edits `Civilization C1` mineral `age` (`IZOTOP`).
4. Moon rule rejects out-of-range value; violation explains `rule_id`, `expected_constraint`, `repair_hint`.
5. User applies repair; civilization returns from `ANOMALY` to `ACTIVE`.
6. User drafts bond `C1 -> C2`; preview runs cross-planet and capability checks before commit.

## 7. Approval record

Checklist:
- [x] Product approved canonical definitions.
- [x] Domain lead approved coupling rules.
- [x] BE lead confirmed API/contract alignment.
- [x] FE lead confirmed UI/copy alignment.

Approval date:
- 2026-03-07
