import { describe, expect, it } from "vitest";

import { resolveStarCoreExteriorState } from "./starCoreExteriorStateModel.js";

describe("starCoreExteriorStateModel", () => {
  it("keeps idle exterior state for free space", () => {
    const state = resolveStarCoreExteriorState({
      model: { state: "star_core_locked_ready" },
      navigationModel: { selectedObjectId: "", approachTargetId: "" },
    });

    expect(state.mode).toBe("star_core_exterior_idle");
    expect(state.lockVisualState).toBe("locked");
  });

  it("marks selected star core exterior", () => {
    const state = resolveStarCoreExteriorState({
      model: { state: "star_core_unlocked" },
      navigationModel: { selectedObjectId: "star-core", approachTargetId: "" },
    });

    expect(state.mode).toBe("star_core_exterior_selected");
    expect(state.unlocked).toBe(true);
  });

  it("marks approach exterior state", () => {
    const state = resolveStarCoreExteriorState({
      model: { state: "loading" },
      navigationModel: { selectedObjectId: "star-core", approachTargetId: "star-core" },
    });

    expect(state.mode).toBe("star_core_exterior_approach");
    expect(state.loading).toBe(true);
    expect(state.lockVisualState).toBe("stabilizing");
  });
});
