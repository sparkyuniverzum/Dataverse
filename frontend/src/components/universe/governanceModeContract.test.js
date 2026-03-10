import { describe, expect, it } from "vitest";

import { resolveGovernanceModeModel } from "./governanceModeContract";

describe("governanceModeContract", () => {
  it("keeps workspace mode when governance surface is closed", () => {
    const model = resolveGovernanceModeModel({ phase: "idle", locked: false });

    expect(model.open).toBe(false);
    expect(model.focusActive).toBe(false);
    expect(model.mode).toBe("workspace");
    expect(model.cinematicMode).toBe("default");
  });

  it("opens governance mode for locked state", () => {
    const model = resolveGovernanceModeModel({ phase: "locked", locked: true });

    expect(model.open).toBe(true);
    expect(model.canClose).toBe(true);
    expect(model.cinematicMode).toBe("governance_mode");
    expect(model.summaryLabel).toContain("lock");
  });
});
