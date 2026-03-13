import { describe, expect, it } from "vitest";

import { resolvePlanetTopologyState } from "./planetTopologyStateModel.js";

describe("planetTopologyStateModel", () => {
  it("marks approached planet as dominant emphasis", () => {
    const state = resolvePlanetTopologyState({
      objectId: "t-1",
      navigationModel: {
        selectedObjectId: "t-1",
        approachTargetId: "t-1",
      },
    });

    expect(state.selected).toBe(true);
    expect(state.approached).toBe(true);
    expect(state.emphasis).toBe("approached");
  });

  it("keeps idle planet neutral", () => {
    const state = resolvePlanetTopologyState({
      objectId: "t-2",
      navigationModel: {
        selectedObjectId: "t-1",
        approachTargetId: "",
      },
    });

    expect(state.selected).toBe(false);
    expect(state.approached).toBe(false);
    expect(state.emphasis).toBe("idle");
  });
});
