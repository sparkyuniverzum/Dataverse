# Planet/Civilization Domain Canonical v1

Status: active (canonical merged source)
Date: 2026-03-10
Owner: Core BE/FE architecture
Merged sources:
- `docs/contracts/planet-civilization-glossary-v1.md`
- `docs/contracts/planet-civilization-ux-intent-v1.md`
- `docs/contracts/planet-civilization-moon-mineral-workflow-v1.md`
- `docs/contracts/civilization-mineral-contract-v2.md`

## 1. What changed

This document merges the domain-level contract into one canonical source:
1. Terminology (`planet/moon/civilization/mineral/bond`).
2. UX intent (discoverability, inspectability, explainability).
3. Runtime workflow (planet -> civilization -> mineral -> archive).
4. Civilization/mineral normative gate closure (`CMV2-01..CMV2-10`).

## 2. Why it changed

Previous domain semantics were split across multiple closed files. This canonical document reduces lookup ambiguity and keeps one normative entry point for implementation and audits.

## 3. Canonical decisions

1. `civilization` is canonical runtime term; `moon` is UX alias only.
2. Planet lifecycle, civilization lifecycle, and mineral lifecycle converge through one deterministic workflow.
3. Soft-delete only; no hard-delete behavior.
4. Explainability (`rule_id`, `expected_constraint`, `repair_hint`) is mandatory for blocked writes.
5. `CMV2-01..CMV2-10` remain the closure gate set for civilization/mineral scope.

## 4. Evidence

1. `npm --prefix frontend run test:e2e:planet-civilization-mineral-workflow` -> `1 passed`
2. `npm --prefix frontend run test:e2e:planet-moon-preview` -> `1 passed`
3. `npm --prefix frontend run test:e2e:workspace-starlock` -> `1 passed`
4. `PYTHONPATH=. pytest -q tests/test_api_integration.py -rs` -> `99 passed, 1 skipped` (expected skip in environment)

## 5. Remaining open items

1. [x] 2026-03-10: no blocking open items in domain closure scope; follow-up work moves to new versioned docs only.
