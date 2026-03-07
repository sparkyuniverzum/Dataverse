# Planet/Civilization UX Intent v1

Status: active (frozen for Wave 0)
Date: 2026-03-07
Owner: UX Lead + FE Lead
Depends on: `docs/contracts/planet-civilization-glossary-v1.md`, `docs/contracts/visual-builder-state-machine-v1.md`, `docs/contracts/inspector-ia-contract-v1.md`, `docs/contracts/planet-civilization-telemetry-v1.md`

## 1. Purpose

Freeze user-intent contract for the logical layer so implementation stays deterministic:
1. discoverability (moon access and capability visibility),
2. inspectability (clear Planet/Moon/Civilization/Mineral meaning),
3. explainability (deterministic reasons for reject/fail outcomes).

## 2. UX intent principles

1. Discoverability first:
- from a selected planet, moon capabilities must be visible and openable in one operator action.

2. Inspectability without ambiguity:
- inspectors must clearly separate:
  - entity lifecycle (`Civilization`)
  - typed value validity (`Mineral`)
  - governing law source (`Moon`).

3. Explainability before commit:
- any blocked action (mineral write, bond preview, cross-planet relation) must show exact reason and recover hint before write.

4. Deterministic workflow:
- visual builder always follows one state machine, with recover action for every invalid transition.

## 3. Required UX scenarios (approval checklist)

### 3.1 Discover moon capability from planet

Flow:
1. Select planet.
2. Open moon orbit node.
3. Open moon inspector.
4. See affected civilization count and mineral keys.

Acceptance:
- [x] one-click path to moon inspector.
- [x] moon impact context visible without opening grid first.

### 3.2 Understand Civilization vs Mineral

Flow:
1. Open civilization inspector.
2. Read lifecycle state and health.
3. Open mineral detail/edit panel.
4. Read value type, status, and validation reason.

Acceptance:
- [x] lifecycle state and mineral validity are shown in separate sections.
- [x] mineral type semantics (`KRYSTAL|IZOTOP|CHRONON|MOST`) are explicitly labeled.

### 3.3 Bond draft with explainability

Flow:
1. Select source civilization and target civilization.
2. Draft bond and run preview.
3. If rejected, read blocking law and repair suggestion.
4. Apply fix and retry preview.

Acceptance:
- [x] preview reject reason is shown before commit.
- [x] bond inspector shows direction, status, and governing rule context.

### 3.4 Cross-planet compatibility guard

Flow:
1. Add/select second planet.
2. Attempt cross-planet bond preview.
3. Receive allow/reject with explicit law compatibility result.

Acceptance:
- [x] incompatible operations are blocked pre-commit.
- [x] compatibility rationale is visible in operator language.

## 4. Success metrics (SG-LF-03 freeze)

Metric IDs and thresholds:

| Metric ID | Name | Definition | Target threshold |
|---|---|---|---|
| `LF-M01` | time_to_first_moon_open_p95 | Time from first `planet_selected` to first successful `moon_opened` in session. | `<= 45s` (p95) |
| `LF-M02` | moon_inspector_open_rate | Share of sessions with planet selection where moon inspector is opened at least once. | `>= 70%` |
| `LF-M03` | civilization_mineral_semantic_clarity | Share of inspected civilization sessions where mineral detail is opened after civilization inspector (proxy for clear distinction). | `>= 60%` |
| `LF-M04` | bond_preview_success_rate | Successful bond previews / all bond preview attempts. | `>= 85%` |
| `LF-M05` | explainability_usage_rate | Share of rejected previews/writes where explainability panel is opened. | `>= 80%` |
| `LF-M06` | cross_planet_block_reason_coverage | Share of cross-planet blocks that include explicit `rule_id` + `expected_constraint` + `repair_hint`. | `100%` |

Telemetry dependency:
- metric computation uses `moon_opened`, `moon_rule_failed`, `bond_preview_rejected`, `cross_planet_blocked` plus builder context events defined in `docs/contracts/planet-civilization-telemetry-v1.md`.

## 5. Non-goals

1. This contract does not define final visual styling.
2. This contract does not replace backend law definitions.
3. This contract does not relax existing OCC/idempotency constraints.

## 6. Approval record

Checklist:
- [x] UX lead approved scenarios and acceptance points.
- [x] FE lead approved state-machine consistency with intent.
- [x] Product approved metric IDs and thresholds.
- [x] Analytics approved telemetry measurability.

Approval date:
- 2026-03-07
