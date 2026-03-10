# Planet/Civilization Logical Flow DoD v1

Status: archived (merged into `docs/contracts/planet-civilization-delivery-canonical-v1.md`)
Date: 2026-03-07
Owner: Core BE/FE architecture
Depends on: `docs/contracts/planet-moon-dod-v3.md`, `docs/contracts/planet-moon-preview-layer-p6-backlog-v1.md`, `docs/contracts/civilization-mineral-contract-v2.md`, `docs/contracts/api-v1.md`, `docs/FRONTEND_UX_ARCHITECTURE.md`, `docs/contracts/planet-civilization-logical-flow-wave0-execution-v1.md`, `docs/contracts/planet-civilization-glossary-v1.md`, `docs/contracts/planet-civilization-ux-intent-v1.md`

Merged into:
- `docs/contracts/planet-civilization-delivery-canonical-v1.md`

## 1. Purpose

Define full Definition of Done for the logical interaction layer that users operate directly:
- moon discoverability and moon operations,
- clear Planet/Civilization/Mineral semantics,
- deterministic visual builder logic for links,
- multi-planet workflow and cross-planet law checks.

This document also defines the mandatory readiness gate before implementation starts.

## 2. Scope and non-goals

In scope:
1. UX logic and information architecture for Planet -> Moon -> Civilization -> Mineral -> Bond.
2. Runtime API/read-model requirements needed by FE logic.
3. Test gates and staging evidence needed for closure.

Not in scope:
1. Visual rebranding or major 3D art redesign.
2. Replacing existing event model or soft-delete policy.
3. Infra migration unrelated to this layer.

## 3. Current baseline and known gaps

Baseline constraints to close:
1. Moon nodes are currently rendered only in focused planet level (`level >= 3`), reducing discoverability from global context.
2. Moon layout is built only for the selected planet, so users cannot inspect moon availability before entering planet focus.
3. UI semantics do not explain the difference between `civilization` (entity lifecycle) and `mineral` (typed atomic value) in one explicit place.
4. Bond creation flow exists, but explainability and pre-commit law checks are not presented as one operator-grade step contract.
5. Multi-planet relation workflow exists at API level but has no explicit guided UX contract for compatibility checks.

## 4. Canonical ontology freeze (must stay stable)

1. Planet = data carrier and contract boundary.
2. Moon = capability operator attached to planet contract.
3. Civilization = runtime row lifecycle entity.
4. Mineral = typed atomic value owned by civilization.
5. Bond = directional relation object between civilizations.

Invariant:
`Moon capability != Civilization row`, while moon logic and mineral validity are tightly coupled in runtime behavior.

## 5. Start gate (must be green before implementation)

Status legend:
- `GREEN`: ready and approved.
- `OPEN`: missing artifact/decision.

### 5.1 Product and domain readiness

- [x] `SG-LF-01` Vocabulary freeze approved (Planet/Moon/Civilization/Mineral/Bond glossary with examples). Done 2026-03-07; evidence: `docs/contracts/planet-civilization-glossary-v1.md`.
- [x] `SG-LF-02` UX intent freeze approved (discoverability + inspectability + explainability). Done 2026-03-07; evidence: `docs/contracts/planet-civilization-ux-intent-v1.md`.
- [x] `SG-LF-03` Success metrics agreed (time-to-first-moon-open, bond create success rate, explainability usage rate). Done 2026-03-07; evidence: metrics section in `docs/contracts/planet-civilization-ux-intent-v1.md`.

### 5.2 Backend readiness

- [x] `SG-LF-04` Canonical route policy confirmed (`/civilizations*` primary, `/moons*` compatibility alias only). Done 2026-03-07; evidence: `docs/contracts/api-v1.md`, `docs/contracts/civilization-mineral-contract-v2.md`.
- [x] `SG-LF-05` Error envelope freeze approved (`rule_id`, `capability_id`, `mineral_key`, `expected_constraint`, `repair_hint`). Done 2026-03-07; evidence: `docs/contracts/api-v1.md`, `docs/contracts/civilization-mineral-contract-v2.md`, `frontend/src/components/universe/workspaceContractExplainability.js`.
- [x] `SG-LF-06` Read-model contract decided for visual builder context (single payload source for planet+moons+civilizations+bonds). Done 2026-03-07; evidence: `docs/contracts/visual-builder-context-contract-v1.md`.
- [x] `SG-LF-07` Pre-commit bond validation endpoint decided (`validate/preview` behavior and failure taxonomy). Done 2026-03-07; evidence: `docs/contracts/bond-preview-validate-contract-v1.md`.
- [x] `SG-LF-08` Moon-impact query decided (which moon/rule affects which minerals/civilizations). Done 2026-03-07; evidence: `docs/contracts/moon-impact-contract-v1.md`.

### 5.3 Frontend readiness

- [x] `SG-LF-09` State machine spec approved (states, transitions, guards, recover actions). Done 2026-03-07; evidence: `docs/contracts/visual-builder-state-machine-v1.md`.
- [x] `SG-LF-10` Inspector IA approved (`Planet Inspector`, `Moon Inspector`, `Civilization Inspector`, `Bond Inspector`). Done 2026-03-07; evidence: `docs/contracts/inspector-ia-contract-v1.md`.
- [x] `SG-LF-11` Persistence scope approved (selected planet/moon/civilization and safe resume behavior). Done 2026-03-07; evidence: `docs/contracts/visual-builder-state-machine-v1.md`.
- [x] `SG-LF-12` Feature flag plan approved for incremental rollout (`moon_discovery_v1`, `bond_builder_v1`, `cross_planet_guard_v1`). Done 2026-03-07; evidence: `docs/release/planet-civilization-feature-flag-rollout-v1.md`.

### 5.4 QA and operations readiness

- [x] `SG-LF-13` Test matrix skeleton committed (BE integration + FE unit + FE e2e staging). Done 2026-03-07; evidence: `docs/contracts/planet-civilization-test-matrix-v1.md`, `tests/test_planet_civilization_lf_matrix_placeholder.py`, `frontend/src/components/universe/planetCivilizationMatrix.placeholder.test.js`, `frontend/e2e/staging/planet-civilization-lf.matrix.placeholder.spec.mjs`.
- [x] `SG-LF-14` Two-planet deterministic fixtures prepared (compatible and incompatible bond scenarios). Done 2026-03-07; evidence: `tests/fixtures/planet_civilization/`.
- [x] `SG-LF-15` Telemetry schema approved (`moon_opened`, `moon_rule_failed`, `bond_preview_rejected`, `cross_planet_blocked`). Done 2026-03-07; evidence: `docs/contracts/planet-civilization-telemetry-v1.md`.
- [x] `SG-LF-16` Release rollback policy approved (flag-level rollback without schema rollback). Done 2026-03-07; evidence: `docs/release/planet-civilization-logical-flow-rollback-v1.md`, `docs/release/v1-rollout-runbook.md`.

Start condition:
- Implementation begins only when `SG-LF-01` .. `SG-LF-16` are `GREEN`.
- All `SG-LF-01` .. `SG-LF-16` are `GREEN` as of 2026-03-07.

## 6. Definition of Done (closure gate)

### 6.1 LF-01 Moon discoverability and inspection

DoD:
1. Every focused planet exposes visible, clickable moon orbit nodes with deterministic hit targets.
2. Users can open Moon Inspector in one click and see purpose, active rules, impacted civilizations, and impacted minerals.
3. Moon metadata is available without opening grid first.

Target gates:
- FE component test for orbit visibility and clickability.
- FE e2e staging test for `planet select -> moon open -> moon inspector`.

### 6.2 LF-02 Civilization vs Mineral semantic clarity

DoD:
1. UI presents explicit semantic legend and contextual hints.
2. Civilization detail separates lifecycle state from mineral validity.
3. Mineral edits show type semantics and rule-based validation outcomes.

Target gates:
- FE unit test for legend and detail semantics.
- FE integration test for mineral edit feedback mapping.

### 6.3 LF-03 Mineral workflow closure

DoD:
1. Mineral operations support `upsert`, `repair`, `remove_soft` with deterministic UI feedback.
2. Violation payload is shown with operator-grade explainability.
3. Civilization health state updates deterministically from mineral validity.

Target gates:
- `CMV2-08`, `CMV2-09`, `CMV2-10` remain green.
- New FE e2e scenario for invalid mineral -> anomaly -> repair.

### 6.4 LF-04 Bond builder deterministic flow

DoD:
1. Bond creation is guided by explicit draft flow: source -> target -> type -> preview -> commit.
2. Pre-commit validation exposes exact reject reason and blocking law.
3. Bond inspector shows direction, status, and linked rule context.

Target gates:
- BE integration gate for bond preview/validation envelope.
- FE e2e staging gate for bond draft + reject + successful commit flow.

### 6.5 LF-05 Visual builder state machine

DoD:
1. Builder has one canonical runtime state machine with deterministic guards.
2. Invalid transitions never mutate data and always return recover action.
3. Rapid interaction changes keep state consistency (no orphan draft states).

Target gates:
- FE unit tests for transition guard matrix.
- FE e2e stress scenario with rapid state changes.

### 6.6 LF-06 Multi-planet onboarding and laws

DoD:
1. Second planet creation flow is guided and shows compatibility profile.
2. Cross-planet bond attempt runs compatibility checks before write.
3. Incompatible cross-planet operations are blocked with explicit reasons.

Target gates:
- BE integration gate for cross-planet compatibility failure taxonomy.
- FE e2e staging for `planet A + planet B + cross-planet bond preview`.

### 6.7 LF-07 Convergence and replay parity

DoD:
1. Live write path and replay path converge to same planet/moon/civilization/bond state.
2. Snapshot/tables/grid/3D remain semantically aligned for selected event sequence.
3. Resume flow restores valid state only and rejects stale invalid drafts.

Target gates:
- Existing P6 convergence gates remain green.
- New replay parity regression for multi-planet + bonds.

### 6.8 LF-08 Accessibility and performance parity

DoD:
1. Core actions are keyboard reachable (planet focus, moon open, bond draft, mineral save).
2. Reduced-motion mode preserves state semantics without heavy animation dependence.
3. High moon/high bond load stays within explicit frame budget.

Target gates:
- Existing P6 accessibility/performance gates remain green.
- New combined load scenario with multi-planet and active bond draft.

## 7. Required implementation artifacts

Before closing this layer, repository must include:
1. Contract addendum for visual builder state machine (states, events, guards).
2. Contract addendum for bond preview/validate API.
3. Contract addendum for moon-impact read model.
4. FE test suite additions for moon discoverability + semantic legend + bond draft explainability.
5. BE integration tests for cross-planet compatibility and reject reason taxonomy.
6. Staging smoke scripts for:
   - moon inspection flow,
   - mineral anomaly-repair flow,
   - cross-planet bond preview flow.

## 8. Execution waves

### 8.1 Wave 0 - readiness closure

Scope:
- `SG-LF-01` .. `SG-LF-16`
- execution backlog: `docs/contracts/planet-civilization-logical-flow-wave0-execution-v1.md`

Exit:
- implementation start approval.

### 8.2 Wave 1 - discoverability and semantics

Scope:
- `LF-01`, `LF-02`, `LF-03`

Exit:
- user can discover moon functionality and understands civilization/mineral model.

### 8.3 Wave 2 - builder and bonds

Scope:
- `LF-04`, `LF-05`

Exit:
- deterministic bond builder and guarded state machine.

### 8.4 Wave 3 - multi-planet and parity

Scope:
- `LF-06`, `LF-07`, `LF-08`

Exit:
- multi-planet laws and convergence parity are validated in staging.

## 9. Final closure criteria

1. All start gates (`SG-LF-*`) are `GREEN`.
2. All DoD blocks (`LF-01` .. `LF-08`) are `GREEN`.
3. Evidence is synced in:
   - `docs/contracts/planet-moon-preview-layer-p6-backlog-v1.md`
   - `docs/contracts/planet-moon-dod-v3.md`
   - `docs/release/v1-release-notes.md`
