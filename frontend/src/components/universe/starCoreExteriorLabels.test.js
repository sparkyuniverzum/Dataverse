import { describe, expect, it } from "vitest";

import { resolveStarCoreExteriorLabels } from "./starCoreExteriorLabels.js";

describe("starCoreExteriorLabels", () => {
  it("builds readable locked exterior labels", () => {
    const labels = resolveStarCoreExteriorLabels({
      model: {
        ringLabels: [
          { key: "GOVERNANCE", value: "LOCKED" },
          { key: "STATUS", value: "POLICY_READY" },
          { key: "PULSE", value: "STABLE" },
        ],
      },
      exteriorState: { locked: true, approached: false, selected: false },
      visualModel: { labelColor: "#eefcff", descriptorColor: "#9aefff" },
    });

    expect(labels).toHaveLength(4);
    expect(labels[0].text).toBe("GOVERNANCE: LOCKED");
    expect(labels[3].text).toContain("ORIENTAČNÍ KOTVA");
    expect(labels[0].size).toBeLessThan(0.2);
  });

  it("changes descriptor for approach", () => {
    const labels = resolveStarCoreExteriorLabels({
      model: {
        ringLabels: [
          { key: "GOVERNANCE", value: "UNLOCKED" },
          { key: "PHYSICS_PROFILE", value: "BALANCE" },
          { key: "PULSE", value: "STABILIZING" },
        ],
      },
      exteriorState: { unlocked: true, approached: true, selected: true },
      visualModel: { labelColor: "#fff0cf", descriptorColor: "#ffd398" },
    });

    expect(labels[3].text).toContain("GOVERNANCE ORBITA");
  });
});
