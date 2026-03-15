import { describe, expect, it } from "vitest";

import {
  normalizePhase,
  phaseFromLegacyStatus,
  phaseSeverity,
  resolveLinkPhaseVisual,
  resolveMoonPhaseVisual,
  resolvePlanetPhaseVisual,
} from "./physicsSystem";

describe("physicsSystem", () => {
  it("normalizes phases and legacy statuses", () => {
    expect(normalizePhase("active")).toBe("ACTIVE");
    expect(normalizePhase("green")).toBe("CALM");
    expect(phaseFromLegacyStatus("RED")).toBe("CRITICAL");
    expect(phaseSeverity("CRITICAL")).toBeGreaterThan(phaseSeverity("ACTIVE"));
  });

  it("produces deterministic planet and moon visuals from shared rules", () => {
    const planet = resolvePlanetPhaseVisual({
      phase: "CORRODING",
      corrosionLevel: 0.7,
      crackIntensity: 0.55,
      hue: 0.1,
      saturation: 0.8,
    });
    expect(planet.phase).toBe("CORRODING");
    expect(planet.crackOpacity).toBeGreaterThan(0.4);

    const moon = resolveMoonPhaseVisual({
      phase: "CORRODING",
      corrosionLevel: 0.7,
      crackIntensity: 0.55,
      hue: 0.1,
      saturation: 0.8,
    });
    expect(moon.phase).toBe("CORRODING");
    expect(moon.crackOpacity).toBeLessThanOrEqual(planet.crackOpacity);
  });

  it("maps link visuals from phase and corrosion consistently", () => {
    const link = resolveLinkPhaseVisual({
      sourcePhase: "ACTIVE",
      targetPhase: "CRITICAL",
      sourceCorrosionLevel: 0.2,
      targetCorrosionLevel: 0.8,
      flow: 0.7,
      stress: 0.6,
    });
    expect(link.dominantPhase).toBe("CRITICAL");
    expect(link.widthMultiplier).toBeGreaterThan(1);
    expect(link.speedMultiplier).toBeGreaterThan(1);
    expect(link.opacityMultiplier).toBeGreaterThan(0.8);
  });
});
