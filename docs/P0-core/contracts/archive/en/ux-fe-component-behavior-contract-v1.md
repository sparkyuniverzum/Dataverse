# UX FE Component Behavior Contract v1

Status: archived historical mirror (inactive reference)
Date: 2026-03-11
Owner: FE architecture + UX engineering

## 1. Purpose

Define component-level behavior contracts so FE implementation is:

1. visually premium,
2. operationally fast,
3. testable and deterministic.

## 2. Component topology

## 2.1 Scene layer components

1. `UniverseCanvas`:
   - renders star/planet/civilization/bond spatial model,
   - supports selection and context focus,
   - never performs canonical data mutation directly.
2. `SpatialLabels`:
   - diegetic labels/metrics near entities,
   - strictly read-only overlays.

## 2.2 HUD layer components

1. `GlobalStatusHUD`:
   - scope badge (`MAIN`/`BRANCH`),
   - mode badge,
   - core status and warning state.
2. `CommandBar`:
   - primary command prompts and quick actions,
   - keyboard-first parity.
3. `ContextDrawers`:
   - promote/recovery/governance contextual workflows,
   - no takeover of core row authoring.

## 2.3 Operation layer components

1. `QuickGridOverlay`:
   - canonical row/mineral authoring surface,
   - commit/preview/repair execution controls.
2. `WorkspaceSidebar`:
   - scope summary and contextual insight,
   - not canonical editing surface for complex row mutations.
3. `InspectorPanels`:
   - selected entity details and traceability.

## 3. Canonical behavior rules

1. Canonical row writes must target `/civilizations*`.
2. Moon interactions must target capability/contract surfaces, never row CRUD namespace.
3. Scene selection updates operation context, not vice versa by side effect.
4. Every write action must surface OCC/idempotency failures as repairable events.
5. Extinguished entities remain visible as historical ghost state when filter allows.

## 4. State model per component class

## 4.1 Shared state states

1. `idle`
2. `loading`
3. `ready`
4. `warning`
5. `error`
6. `recovering`

## 4.2 Write operation states

1. `draft`
2. `previewed`
3. `committing`
4. `committed`
5. `blocked`
6. `repair_required`

Rule:
No silent failure. `blocked` and `repair_required` must include reason and action.

## 5. Interaction contracts

## 5.1 Selection and focus

1. Scene click updates selected entity and focus context.
2. Sidebar and grid selection stay synchronized.
3. Focus loss must never discard unsaved draft silently.

## 5.2 Mutation flow

1. User initiates mutation in operation layer.
2. Request payload includes scope + OCC expectations where required.
3. Response updates workflow log and visual state.
4. Scene reflects mutation asynchronously but deterministically.

## 5.3 Moon capability attach flow

1. Enter capability mode at planet scope.
2. Drag/drop moon module only to valid capability slot targets.
3. Invalid target drop returns module to inventory with explicit feedback.
4. Commit applies contract effects and updates dependent row behavior indicators.

## 5.4 Bond link flow

1. Source civilization selection.
2. Target civilization selection with live validity preview.
3. Commit or reject with structured reason.
4. Extinguish keeps historical relation trace.

## 6. Error and recovery behavior

1. OCC conflict:
   - show current vs expected sequence,
   - offer refresh + retry path.
2. Validation failure:
   - show offending mineral/field and rule reason,
   - offer guided repair action.
3. Scope mismatch:
   - show branch/main context mismatch explicitly.
4. Network/runtime failure:
   - show resilient retry options with idempotency-safe guidance.

## 7. Telemetry contract

Must emit structured events for:

1. mode enter/exit,
2. selection changes,
3. mutation preview/commit/fail/recover,
4. OCC conflicts and conflict resolution path,
5. capability attach/commit actions,
6. bond preview/create/extinguish actions.

Telemetry events must include:

1. `galaxy_id`,
2. `branch_id` (nullable),
3. `entity_type`,
4. `entity_id`,
5. `action`,
6. `result`,
7. `latency_ms`.

## 8. Performance budgets

1. selection feedback: under 100 ms,
2. command feedback (acknowledgement): under 200 ms,
3. drawer open/close: under 250 ms,
4. standard micro-transition: 150-400 ms,
5. repeated row edits must not trigger full scene re-layout.

## 9. Accessibility and control contracts

1. All critical actions keyboard reachable.
2. Focus order deterministic in HUD and operation layer.
3. Reduced motion preserves all functions.
4. Color is never the only source of state meaning.

## 10. Testability requirements

1. Every core behavior has test-id stable anchors.
2. Component contracts map to focused unit/integration tests.
3. Critical journeys map to narrow smoke scenarios without mandatory long cinematic paths.
4. No behavior depends on non-deterministic animation timing.

## 11. Forbidden implementation shortcuts

1. Parallel hidden mutation paths to bypass canonical APIs.
2. 3D-only editing flow without grid fallback parity.
3. Silent alias fallback to removed endpoints.
4. Temporary untyped error swallowing in mutation/recovery flows.
