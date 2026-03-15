import { describe, expect, it } from "vitest";

import {
  buildVisualBuilderTransitionMessage,
  evaluateBondFlowTransition,
  resolveNavigationState,
  resolveVisualBuilderState,
  VISUAL_BUILDER_BOND_STATE,
  VISUAL_BUILDER_EVENT,
  VISUAL_BUILDER_NAV_STATE,
} from "./visualBuilderStateMachine";

describe("visualBuilderStateMachine", () => {
  it("resolves navigation states deterministically", () => {
    expect(resolveNavigationState({})).toBe(VISUAL_BUILDER_NAV_STATE.NAV_UNIVERSE);
    expect(resolveNavigationState({ selectedTableId: "table-1" })).toBe(VISUAL_BUILDER_NAV_STATE.NAV_PLANET_FOCUSED);
    expect(resolveNavigationState({ selectedTableId: "table-1", selectedAsteroidId: "moon-1" })).toBe(
      VISUAL_BUILDER_NAV_STATE.NAV_MOON_FOCUSED
    );
    expect(resolveNavigationState({ selectedTableId: "table-1", quickGridOpen: true })).toBe(
      VISUAL_BUILDER_NAV_STATE.NAV_GRID_OPEN
    );
  });

  it("applies state priority: error > syncing > bond > navigation", () => {
    expect(
      resolveVisualBuilderState({
        runtimeError: "boom",
        loading: true,
        navigationState: VISUAL_BUILDER_NAV_STATE.NAV_PLANET_FOCUSED,
        bondState: VISUAL_BUILDER_BOND_STATE.BOND_DRAFT_TARGET,
      })
    ).toBe("ERROR_RECOVERABLE");

    expect(
      resolveVisualBuilderState({
        loading: true,
        navigationState: VISUAL_BUILDER_NAV_STATE.NAV_PLANET_FOCUSED,
        bondState: VISUAL_BUILDER_BOND_STATE.BOND_DRAFT_TARGET,
      })
    ).toBe("SYNCING");

    expect(
      resolveVisualBuilderState({
        loading: false,
        navigationState: VISUAL_BUILDER_NAV_STATE.NAV_PLANET_FOCUSED,
        bondState: VISUAL_BUILDER_BOND_STATE.BOND_DRAFT_TARGET,
      })
    ).toBe(VISUAL_BUILDER_BOND_STATE.BOND_DRAFT_TARGET);
  });

  it("guards bond flow transitions and recovery semantics", () => {
    const start = evaluateBondFlowTransition({
      state: VISUAL_BUILDER_BOND_STATE.BOND_IDLE,
      event: VISUAL_BUILDER_EVENT.START_BOND_DRAFT,
      payload: { sourceId: "s-1" },
    });
    expect(start.allowed).toBe(true);
    expect(start.next_state).toBe(VISUAL_BUILDER_BOND_STATE.BOND_DRAFT_SOURCE);

    const sameEndpoint = evaluateBondFlowTransition({
      state: start.next_state,
      event: VISUAL_BUILDER_EVENT.SELECT_BOND_TARGET,
      payload: { sourceId: "s-1", targetId: "s-1" },
    });
    expect(sameEndpoint.allowed).toBe(false);
    expect(sameEndpoint.reason).toBe("same_endpoint");
    expect(buildVisualBuilderTransitionMessage(sameEndpoint)).toContain("Source a target");

    const target = evaluateBondFlowTransition({
      state: start.next_state,
      event: VISUAL_BUILDER_EVENT.SELECT_BOND_TARGET,
      payload: { sourceId: "s-1", targetId: "t-1" },
    });
    expect(target.allowed).toBe(true);
    expect(target.next_state).toBe(VISUAL_BUILDER_BOND_STATE.BOND_DRAFT_TARGET);

    const preview = evaluateBondFlowTransition({
      state: target.next_state,
      event: VISUAL_BUILDER_EVENT.REQUEST_BOND_PREVIEW,
      payload: { sourceId: "s-1", targetId: "t-1", type: "RELATION" },
    });
    expect(preview.allowed).toBe(true);
    expect(preview.next_state).toBe(VISUAL_BUILDER_BOND_STATE.BOND_PREVIEW);

    const blocked = evaluateBondFlowTransition({
      state: preview.next_state,
      event: VISUAL_BUILDER_EVENT.APPLY_BOND_PREVIEW_RESULT,
      payload: { previewDecision: "REJECT", previewBlocking: true },
    });
    expect(blocked.allowed).toBe(true);
    expect(blocked.next_state).toBe(VISUAL_BUILDER_BOND_STATE.BOND_BLOCKED);

    const commitDenied = evaluateBondFlowTransition({
      state: preview.next_state,
      event: VISUAL_BUILDER_EVENT.CONFIRM_BOND_COMMIT,
      payload: { previewDecision: "REJECT", previewBlocking: true },
    });
    expect(commitDenied.allowed).toBe(false);
    expect(commitDenied.reason).toBe("preview_not_committable");

    const commitAllowed = evaluateBondFlowTransition({
      state: preview.next_state,
      event: VISUAL_BUILDER_EVENT.CONFIRM_BOND_COMMIT,
      payload: { previewDecision: "ALLOW", previewBlocking: false },
    });
    expect(commitAllowed.allowed).toBe(true);
    expect(commitAllowed.next_state).toBe(VISUAL_BUILDER_BOND_STATE.BOND_COMMITTING);
  });
});
