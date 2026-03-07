# Planet/Civilization Logical Flow Wave 0 Execution v1

Status: active
Date: 2026-03-07
Owner: Core BE/FE architecture
Depends on: `docs/contracts/planet-civilization-logical-flow-dod-v1.md`, `docs/contracts/civilization-mineral-contract-v2.md`, `docs/contracts/api-v1.md`, `docs/contracts/planet-moon-preview-layer-p6-backlog-v1.md`

## 1. Purpose

Convert approved Wave 0 scope (`SG-LF-01` .. `SG-LF-16`) into executable work packages with:
1. concrete deliverables,
2. owner role,
3. estimate,
4. acceptance evidence.

## 2. Planning assumptions

1. Governance approval for starting Wave 0 was given on 2026-03-07.
2. `/civilizations*` stays canonical; `/moons*` remains compatibility alias only.
3. No implementation of Wave 1 (`LF-01..LF-03`) starts before all Wave 0 items are green.

## 3. Work packages

Status legend:
- `OPEN`: not started.
- `IN_PROGRESS`: active work.
- `GREEN`: accepted and evidence attached.

| WP ID | SG Gate | Scope | Owner role | Estimate | Depends on | Deliverable(s) | Acceptance evidence | Status |
|---|---|---|---|---|---|---|---|---|
| `W0-LF-01` | `SG-LF-01` | Vocabulary freeze for Planet/Moon/Civilization/Mineral/Bond with examples | Product + Domain Lead | 0.5 d | none | `docs/contracts/planet-civilization-glossary-v1.md` | glossary reviewed by BE+FE; terms used consistently in DoD docs | OPEN |
| `W0-LF-02` | `SG-LF-02` | UX intent freeze (discoverability, inspectability, explainability) | UX Lead + FE Lead | 0.75 d | `W0-LF-01` | `docs/contracts/planet-civilization-ux-intent-v1.md` | signed UX intent checklist with scenarios | OPEN |
| `W0-LF-03` | `SG-LF-03` | Success metrics definition and target thresholds | Product + Analytics | 0.5 d | `W0-LF-02` | metrics section in `docs/contracts/planet-civilization-ux-intent-v1.md` | metrics IDs and thresholds approved | OPEN |
| `W0-LF-04` | `SG-LF-04` | Canonical route policy closure (`/civilizations*` primary) | BE Lead | 0.5 d | none | update `docs/contracts/api-v1.md` + alias policy note in `docs/contracts/civilization-mineral-contract-v2.md` | contract diff reviewed; parity rule explicit | OPEN |
| `W0-LF-05` | `SG-LF-05` | Error envelope freeze for contract violations | BE Lead + FE Lead | 0.75 d | `W0-LF-04` | `docs/contracts/api-v1.md` error envelope section + FE mapping note | payload keys frozen (`rule_id`, `capability_id`, `mineral_key`, `expected_constraint`, `repair_hint`) | OPEN |
| `W0-LF-06` | `SG-LF-06` | Read-model contract for Visual Builder context | BE Lead | 1 d | `W0-LF-04` | `docs/contracts/visual-builder-context-contract-v1.md` | contract includes planet+moon+civilization+bond context in one payload shape | OPEN |
| `W0-LF-07` | `SG-LF-07` | Bond pre-commit validate/preview endpoint contract | BE Lead | 1 d | `W0-LF-05` | `docs/contracts/bond-preview-validate-contract-v1.md` | request/response taxonomy with reject reasons approved | OPEN |
| `W0-LF-08` | `SG-LF-08` | Moon-impact query contract (rule -> mineral/civilization impact) | BE Lead | 1 d | `W0-LF-05`, `W0-LF-06` | `docs/contracts/moon-impact-contract-v1.md` | impact payload contract approved by BE+FE | OPEN |
| `W0-LF-09` | `SG-LF-09` | State machine spec for visual builder (states/events/guards/recover) | FE Lead | 1 d | `W0-LF-06`, `W0-LF-07` | `docs/contracts/visual-builder-state-machine-v1.md` | transition matrix has no ambiguous paths | OPEN |
| `W0-LF-10` | `SG-LF-10` | Inspector IA freeze (Planet/Moon/Civilization/Bond inspectors) | UX Lead + FE Lead | 0.75 d | `W0-LF-02`, `W0-LF-09` | `docs/contracts/inspector-ia-contract-v1.md` | IA review signed; required fields mapped to contracts | OPEN |
| `W0-LF-11` | `SG-LF-11` | Persistence scope and resume safety contract | FE Lead | 0.5 d | `W0-LF-09` | addendum in `docs/contracts/visual-builder-state-machine-v1.md` | persistence keys + invalid-state recovery rules approved | OPEN |
| `W0-LF-12` | `SG-LF-12` | Feature flag rollout plan (`moon_discovery_v1`, `bond_builder_v1`, `cross_planet_guard_v1`) | FE Lead + Release Owner | 0.5 d | `W0-LF-09` | `docs/release/planet-civilization-feature-flag-rollout-v1.md` | progressive rollout matrix and rollback switch validated | OPEN |
| `W0-LF-13` | `SG-LF-13` | Test matrix skeleton (BE integration, FE unit, FE e2e staging) | QA Lead | 1 d | `W0-LF-06`, `W0-LF-07`, `W0-LF-09` | `docs/contracts/planet-civilization-test-matrix-v1.md` + placeholder tests | matrix covers `LF-01..LF-08` mapping | OPEN |
| `W0-LF-14` | `SG-LF-14` | Deterministic two-planet fixtures for compatibility cases | BE Lead + QA Lead | 1 d | `W0-LF-13` | fixtures in `tests/fixtures/planet_civilization/` + usage doc | fixtures generate stable compatible/incompatible bond cases | OPEN |
| `W0-LF-15` | `SG-LF-15` | Telemetry schema freeze for new UX flows | FE Lead + Analytics | 0.75 d | `W0-LF-03`, `W0-LF-10` | `docs/contracts/planet-civilization-telemetry-v1.md` | event names and payload fields approved | OPEN |
| `W0-LF-16` | `SG-LF-16` | Release rollback policy for flags and runtime behavior | Release Owner + BE Lead + FE Lead | 0.5 d | `W0-LF-12`, `W0-LF-15` | addendum in `docs/release/v1-rollout-runbook.md` | rollback drill checklist and owner on-call chain approved | OPEN |

Total estimate (serial): `11.0 d`
Total estimate (parallel plan): `4.0-5.0 d` (3 parallel tracks)

## 4. Execution order

1. Contract track (BE/API): `W0-LF-04` -> `W0-LF-05` -> `W0-LF-06` -> `W0-LF-07` -> `W0-LF-08`
2. UX/FE logic track: `W0-LF-01` -> `W0-LF-02` -> `W0-LF-09` -> `W0-LF-10` -> `W0-LF-11` -> `W0-LF-12`
3. QA/Ops track: `W0-LF-03` -> `W0-LF-13` -> `W0-LF-14` -> `W0-LF-15` -> `W0-LF-16`

Critical gate for Wave 1 start:
1. `W0-LF-06`, `W0-LF-07`, `W0-LF-09`, `W0-LF-13` must be `GREEN`.
2. No LF implementation PR may merge unless linked to one `W0-LF-*` artifact.

## 5. Evidence and reporting contract

For each `W0-LF-*` closure, required update points:
1. Mark item `GREEN` in this document.
2. Sync status in `docs/contracts/planet-civilization-logical-flow-dod-v1.md` (`SG-LF-*` checklist).
3. Add execution note in `docs/contracts/planet-moon-preview-layer-p6-backlog-v1.md` section `Logical flow extension`.
4. Record summary in `docs/release/v1-release-notes.md` addendum.

## 6. Wave 0 exit criteria

1. `W0-LF-01` .. `W0-LF-16` are `GREEN`.
2. `SG-LF-01` .. `SG-LF-16` are `GREEN` in DoD source.
3. Wave 1 kickoff decision is documented with date and owner in this file.
