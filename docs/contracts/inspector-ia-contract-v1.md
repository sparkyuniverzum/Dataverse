# Inspector IA Contract v1

Status: approved target (Wave 0 readiness)
Date: 2026-03-07
Owner: UX + FE architecture
Depends on: `docs/contracts/visual-builder-context-contract-v1.md`, `docs/contracts/visual-builder-state-machine-v1.md`, `docs/contracts/planet-civilization-domain-canonical-v1.md`, `frontend/src/components/universe/WorkspaceSidebar.jsx`

## 1. Purpose

Define information architecture for inspector layer:
1. Planet Inspector
2. Moon Inspector
3. Civilization Inspector
4. Bond Inspector

Goal: users can always see what is selected, why it matters, and what action is available next.

## 2. Global inspector invariants

1. Exactly one primary inspector context is active at a time.
2. Inspector content binds to IDs from `WorkspaceContextV1`.
3. Every inspector must include:
   - identity block,
   - health/status block,
   - explainability block,
   - available actions block.
4. Inspector overlays must not block mandatory recover actions.

## 3. Planet Inspector

Required fields:
1. `planet_id`, `planet_name`, `constellation_name`
2. `archetype`, `contract_version`
3. `moons_count`, `civilizations_count`
4. `internal_bonds_count`, `external_bonds_count`
5. physics preview: `phase`, `corrosion_level`, `crack_intensity`, `pulse_factor`

Required actions:
1. `open_grid`
2. `focus_moons`
3. `open_builder` (if applicable)

## 4. Moon Inspector

Required fields:
1. `moon_id`, `label`, `planet_id`
2. `state`, `health_score`, `violation_count`, `last_violation_at`
3. capability context: `capability_id`, `capability_key`, `rule_id` (when available)
4. impact summary: civilizations and minerals affected

Required actions:
1. `open_impacted_civilizations`
2. `show_violation_samples`
3. `open_repair_flow` (when violations exist)

## 5. Civilization Inspector

Required fields:
1. `civilization_id`, `label`, `planet_id`
2. `state`, `health_score`, `violation_count`, `current_event_seq`
3. `facts[]` list with `key`, `typed_value`, `value_type`, `status`, `errors[]`
4. selected mineral explainability (`expected_constraint`, `repair_hint`) when invalid

Required actions:
1. `edit_mineral`
2. `apply_guided_repair`
3. `extinguish_civilization` (soft-delete)
4. `start_bond_draft`

## 6. Bond Inspector

Required fields:
1. `bond_id`
2. `source_civilization_id`, `target_civilization_id`
3. `source_planet_id`, `target_planet_id`
4. `type`, `directional`, `flow_direction`
5. `current_event_seq`, `is_deleted`
6. latest preview decision and reject reasons (if in draft path)

Required actions:
1. `mutate_bond_type`
2. `extinguish_bond`
3. `open_source`
4. `open_target`

## 7. Entry points and precedence

Entry priority:
1. active bond draft/preview -> Bond Inspector
2. selected civilization -> Civilization Inspector
3. selected moon -> Moon Inspector
4. selected planet -> Planet Inspector
5. none selected -> compact workspace summary

## 8. Data-source contract

Primary source:
1. `WorkspaceContextV1` for identity and summary fields.

Detail fetches (optional):
1. civilization detail: `GET /civilizations/{id}`
2. moon impact: `GET /planets/{planet_id}/moon-impact`
3. bond preview: `POST /bonds/validate`

Rule:
1. detail fetches may enrich active inspector only; they must not replace context IDs.

## 9. Accessibility and interaction contract

1. Inspector focus order is keyboard reachable.
2. Critical status text uses `aria-live="polite"` for selection changes.
3. In reduced-motion mode, inspector state changes remain explicit via text and badges.

## 10. DoD for this contract

1. Contract is approved and linked from Wave 0 plan (`W0-LF-10`).
2. Required field inventory is mapped to `WorkspaceContextV1` and known detail endpoints.
3. FE implementation keeps one active inspector precedence rule without ambiguity.
