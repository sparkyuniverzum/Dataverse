import { describe, expect, it } from "vitest";

import { resolveStarCoreExteriorVisualModel } from "./starCoreExteriorVisualModel.js";

describe("starCoreExteriorVisualModel", () => {
  it("creates warm unlocked exterior visuals", () => {
    const visual = resolveStarCoreExteriorVisualModel({
      model: {
        visual: { haloIntensity: 0.4, orbitOpacity: 0.4, runtimeTempo: 0.3, pulseIntensity: 0.4, domainDensity: 0.2 },
      },
      exteriorState: { unlocked: true, approached: false, selected: false },
    });

    expect(visual.governanceRingColor).toBe("#ffb04f");
    expect(visual.governanceRingOpacity).toBeGreaterThan(0.85);
    expect(visual.approachDistance).toBeLessThan(6.6);
  });

  it("creates cool locked exterior visuals", () => {
    const visual = resolveStarCoreExteriorVisualModel({
      model: {
        visual: { haloIntensity: 0.52, orbitOpacity: 0.72, runtimeTempo: 0.5, pulseIntensity: 0.2, domainDensity: 0.4 },
      },
      exteriorState: { locked: true, approached: false, selected: true },
    });

    expect(visual.governanceRingColor).toBe("#7ee8ff");
    expect(visual.orbitCueOpacity).toBeGreaterThan(0.28);
  });

  it("creates unavailable exterior fallback", () => {
    const visual = resolveStarCoreExteriorVisualModel({
      model: { visual: {} },
      exteriorState: { unavailable: true, approached: false, selected: false },
    });

    expect(visual.governanceRingColor).toBe("#ffb36a");
    expect(visual.orbitCueOpacity).toBe(0);
  });
});
