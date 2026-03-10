import { describe, expect, it } from "vitest";

import {
  buildPlanetBuilderConsistencyMessage,
  shouldWarnPlanetBuilderConsistency,
} from "./planetBuilderConsistencyGuard";

describe("planetBuilderConsistencyGuard", () => {
  it("returns false for empty violations", () => {
    expect(shouldWarnPlanetBuilderConsistency({ violations: [] })).toBe(false);
    expect(buildPlanetBuilderConsistencyMessage({ violations: [] })).toBe("");
  });

  it("formats operator-readable warning message", () => {
    const message = buildPlanetBuilderConsistencyMessage({
      violations: ["setup_panel_state_mismatch", "stage_zero_active_mismatch"],
      state: "ErrorRecoverable",
      effectiveState: "CapabilityAssembling",
    });

    expect(shouldWarnPlanetBuilderConsistency({ violations: ["setup_panel_state_mismatch"] })).toBe(true);
    expect(message).toContain("setup_panel_state_mismatch");
    expect(message).toContain("stage_zero_active_mismatch");
    expect(message).toContain("state=ErrorRecoverable");
    expect(message).toContain("effective_state=CapabilityAssembling");
  });
});
