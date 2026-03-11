# UX IA & Navigation Architecture v1

Status: active (UX architecture baseline)
Date: 2026-03-11
Owner: Product UX + FE architecture

## 1. Purpose

Define information architecture and navigation model for Dataverse so that:

1. product feels like an operating center,
2. main work zone remains primary,
3. cinematic 3D layer amplifies orientation and trust, not operator latency.

## 2. Canonical architecture principle

Dataverse UX is split into three layers:

1. `Scene Layer` (3D universe): spatial ontology, context, branch atmosphere, impact visibility.
2. `HUD Layer` (glass overlays): compact status, mode, alerts, command prompts.
3. `Operation Layer` (grid/command): primary authoring and mutation execution surface.

Rule:
If scene and operation conflict, operation wins.

## 3. Information architecture

## 3.1 Top-level spaces

1. `Nexus` (Galaxy selector + entry shell)
2. `Galaxy Workspace` (main operational center)
3. `Star Core` (governance/control plane)
4. `Planet Focus` (planet-level data and capabilities)
5. `Timeline/Branch` context (scope overlay, not separate app)

## 3.2 Entity ownership in IA

1. Galaxy owns workspace and branch scope.
2. Star/Star Core owns governance and runtime health.
3. Planet owns table/contract container.
4. Moon is capability over planet/table contract.
5. Civilization is canonical row runtime entity.
6. Mineral is typed value in civilization row.
7. Bond is relation between civilizations.

## 4. Navigation model

## 4.1 Global navigation (always available)

1. Galaxy switcher.
2. Scope badge (`MAIN` or `BRANCH:<name>`).
3. Mode badge (`NORMAL`, `PROMOTE`, `RECOVERY`, `GOVERNANCE`).
4. Critical system status (Star Core pulse and warnings).

## 4.2 Workspace navigation

1. Scene-driven selection:
   - select Star/Planet/Civilization/Bond in 3D.
2. Operation-driven execution:
   - create/mutate/extinguish and mineral edits in grid/command layer.
3. Context drawers:
   - right-side contextual drawers for promote/recovery/governance reviews.

## 4.3 Star Core navigation

1. Enter via explicit action (`Open Star Core`).
2. Dive transition allowed, but skippable.
3. Exit always returns user to prior workspace context and selection.

## 5. Mode transitions

## 5.1 Allowed workspace modes

1. `NORMAL` - everyday data operations.
2. `PROMOTE_REVIEW` - branch review and promote.
3. `RECOVERY_REVIEW` - repair/conflict/retry workflows.
4. `GOVERNANCE` - Star Core and policy actions.

## 5.2 Transition rules

1. Mode switch must update badge + HUD within 200 ms.
2. Cinematic shift is explanatory, not decorative.
3. Transition animation budget: 150-400 ms (except optional onboarding sequences).
4. Every mode has explicit exit action and return point.

## 6. Main work zone priority

1. Grid/command operation area is always visible in operational flows.
2. 3D scene never hides critical commit/repair controls.
3. Sidebars/drawers may provide context but cannot become primary editor for row CRUD.

## 7. Cinematic system boundaries

## 7.1 Where cinematic is mandatory

1. First onboarding entry (`Nexus -> Galaxy Workspace`).
2. Star ignition and first governance lock confirmation.
3. Optional Star Core dive transitions.

## 7.2 Where cinematic is restricted

1. Repeated CRUD cycles (create/edit mineral/mutate/extinguish).
2. Rapid iteration workflows in grid.
3. Recovery loops requiring fast retries.

## 7.3 Accessibility and control

1. `Reduce Motion` setting disables non-essential transitions.
2. `Skip Cinematic` action available for all long transitions.
3. Keyboard parity for all critical actions.

## 8. Branch atmospheric dimension

1. Branch context may alter global tone/light subtly.
2. Atmosphere must never be the only branch indicator.
3. Explicit textual branch badge is mandatory.
4. `MAIN` and `BRANCH` state must be distinguishable in grayscale accessibility mode.

## 9. IA quality gates

1. Main work zone first paint under 1.5 s on target environment.
2. No critical journey step may require hidden/non-discoverable navigation.
3. Every context switch must preserve or intentionally reset selection (explicitly shown).
4. No entity may be edited via wrong ontology surface:
   - no moon-as-row editing,
   - no star-core-as-row editor.

## 10. Out of scope

1. Final visual skin/tokens.
2. Detailed per-component props/state contracts.
3. Full journey scripts and acceptance tests.
