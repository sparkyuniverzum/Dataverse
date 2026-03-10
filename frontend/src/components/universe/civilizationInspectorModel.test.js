import { describe, expect, it } from "vitest";

import { deriveCivilizationInspectorModel } from "./civilizationInspectorModel";

describe("deriveCivilizationInspectorModel", () => {
  it("returns fallback model for missing civilization", () => {
    const model = deriveCivilizationInspectorModel(null);
    expect(model.state).toBe("UNKNOWN");
    expect(model.violationCount).toBe(0);
    expect(model.impactedMinerals).toEqual([]);
    expect(model.activeRules).toEqual([]);
  });

  it("derives impacted minerals and active rules from facts when moon impact is missing", () => {
    const model = deriveCivilizationInspectorModel({
      id: "moon-1",
      state: "ANOMALY",
      health_score: 52,
      current_event_seq: 11,
      facts: [
        {
          key: "amount",
          typed_value: -5,
          status: "invalid",
          errors: [{ rule_id: "amount-positive" }],
        },
      ],
      metadata: { category: "ops" },
    });
    expect(model.state).toBe("ANOMALY");
    expect(model.healthScore).toBe(52);
    expect(model.eventSeq).toBe(11);
    expect(model.impactedMinerals.join(" ")).toContain("amount");
    expect(model.activeRules).toContain("amount-positive");
    expect(model.violationCount).toBeGreaterThan(0);
  });

  it("prefers moon-impact payload when present", () => {
    const model = deriveCivilizationInspectorModel(
      { id: "moon-1", state: "ACTIVE", violation_count: 0 },
      {
        items: [
          {
            rule_id: "state-must-be-active",
            mineral_key: "state",
            active_violations_count: 2,
            impacted_civilization_ids: ["moon-1"],
          },
          {
            rule_id: "amount-positive",
            mineral_key: "amount",
            active_violations_count: 4,
            impacted_civilization_ids: ["moon-2"],
          },
        ],
      },
      "moon-1"
    );
    expect(model.violationCount).toBe(2);
    expect(model.impactedMinerals).toContain("state");
    expect(model.activeRules).toContain("state-must-be-active");
    expect(model.activeRules).not.toContain("amount-positive");
  });
});
