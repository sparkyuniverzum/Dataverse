import {
  buildGuidedRepairApplyFailEvent,
  buildGuidedRepairApplyOkEvent,
  buildGuidedRepairSuggestedEvent,
  buildMoonImpactErrorEvent,
  buildMoonImpactLoadEvent,
  buildMoonImpactReadyEvent,
} from "./workflowEventBridge";
import { describe, expect, it } from "vitest";

describe("workflowEventBridge", () => {
  it("builds moon-impact events with stable action names", () => {
    const load = buildMoonImpactLoadEvent({ planetLabel: "Core > Planet" });
    const ready = buildMoonImpactReadyEvent({
      planetLabel: "Core > Planet",
      payload: { items: [{ active_violations_count: 1 }, { active_violations_count: 0 }] },
    });
    const error = buildMoonImpactErrorEvent({ planetLabel: "Core > Planet", errorMessage: "timeout" });

    expect(load.action).toBe("MOON_IMPACT_LOAD");
    expect(ready.action).toBe("MOON_IMPACT_READY");
    expect(ready.message).toContain("rules 2");
    expect(ready.message).toContain("violations 1");
    expect(error.action).toBe("MOON_IMPACT_ERROR");
    expect(error.tone).toBe("error");
  });

  it("builds guided-repair events with explicit apply outcome", () => {
    const suggestion = {
      id: "repair-123",
      strategy_key: "auto",
      mineral_key: "state",
    };
    const planned = buildGuidedRepairSuggestedEvent({ suggestion });
    const applied = buildGuidedRepairApplyOkEvent({ suggestion });
    const failed = buildGuidedRepairApplyFailEvent({ suggestion, errorMessage: "conflict" });

    expect(planned.action).toBe("REPAIR_SUGGESTED");
    expect(planned.message).toContain("state");
    expect(applied.action).toBe("REPAIR_APPLY_OK");
    expect(applied.tone).toBe("ok");
    expect(failed.action).toBe("REPAIR_APPLY_FAIL");
    expect(failed.message).toContain("conflict");
  });
});
