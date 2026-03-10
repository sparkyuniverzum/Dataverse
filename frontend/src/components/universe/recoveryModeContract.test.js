import { describe, expect, it } from "vitest";

import { resolveRecoveryModeModel } from "./recoveryModeContract";

describe("recoveryModeContract", () => {
  it("stays closed and inactive without recovery signals", () => {
    const model = resolveRecoveryModeModel();

    expect(model.hasAttention).toBe(false);
    expect(model.canOpen).toBe(false);
    expect(model.cinematicMode).toBe("default");
  });

  it("builds guided repair recovery state", () => {
    const model = resolveRecoveryModeModel({
      open: true,
      repairSuggestion: {
        civilization_id: "c-1",
        mineral_key: "state",
        suggested_raw_value: "active",
      },
      repairAuditCount: 2,
    });

    expect(model.open).toBe(true);
    expect(model.hasRepairSuggestion).toBe(true);
    expect(model.summary).toContain("state");
    expect(model.auditLabel).toContain("2");
    expect(model.cinematicMode).toBe("recovery_mode");
  });
});
