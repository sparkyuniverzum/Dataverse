import { describe, expect, it } from "vitest";

import { LAW_MATRIX_V1, resolveEntityLaws, resolveLinkLaws, resolveStarCoreProfile } from "./lawResolver";

describe("lawResolver", () => {
  it("resolves planet laws with bounded values", () => {
    const result = resolveEntityLaws({
      kind: "planet",
      basePhysics: { pulseFactor: 1, emissiveBoost: 0 },
      domainMetric: { activity_intensity: 0.8, status: "YELLOW", quality_score: 83 },
      pulse: { intensity: 1.2 },
    });

    expect(result.v1.status).toBe("YELLOW");
    expect(result.v1.quality_score).toBe(83);
    expect(result.physics.stress).toBeGreaterThanOrEqual(0);
    expect(result.physics.stress).toBeLessThanOrEqual(1);
    expect(result.physics.pulseFactor).toBeGreaterThanOrEqual(LAW_MATRIX_V1.planet.pulseFactorClamp[0]);
    expect(result.physics.pulseFactor).toBeLessThanOrEqual(LAW_MATRIX_V1.planet.pulseFactorClamp[1]);
  });

  it("resolves moon laws with pulse impact", () => {
    const lowPulse = resolveEntityLaws({
      kind: "moon",
      domainMetric: { activity_intensity: 0.2, status: "GREEN", quality_score: 96 },
      pulse: { intensity: 0.1 },
    });
    const highPulse = resolveEntityLaws({
      kind: "moon",
      domainMetric: { activity_intensity: 0.2, status: "GREEN", quality_score: 96 },
      pulse: { intensity: 1.4 },
    });
    expect(highPulse.physics.pulseFactor).toBeGreaterThan(lowPulse.physics.pulseFactor);
    expect(highPulse.physics.emissiveBoost).toBeGreaterThan(lowPulse.physics.emissiveBoost);
  });

  it("resolves table link flow from domains and link pulse", () => {
    const result = resolveLinkLaws({
      kind: "table",
      sourceDomainMetric: { activity_intensity: 0.9 },
      targetDomainMetric: { activity_intensity: 0.1 },
      linkPulse: { intensity: 0.4 },
    });
    expect(result.flow).toBeGreaterThan(0);
    expect(result.speedFactor).toBeGreaterThan(1);
    expect(result.widthFactor).toBeGreaterThan(1);
  });

  it("resolves moon link flow from source/target/link pulses", () => {
    const passive = resolveLinkLaws({
      kind: "moon",
      sourceDomainMetric: { activity_intensity: 0.2 },
      targetDomainMetric: { activity_intensity: 0.2 },
    });
    const active = resolveLinkLaws({
      kind: "moon",
      sourceDomainMetric: { activity_intensity: 0.2 },
      targetDomainMetric: { activity_intensity: 0.2 },
      sourcePulse: { intensity: 1.0 },
      targetPulse: { intensity: 1.0 },
      linkPulse: { intensity: 1.0 },
    });
    expect(active.flow).toBeGreaterThan(passive.flow);
  });

  it("resolves star core profile as single-star topology with profile preset", () => {
    const stable = resolveStarCoreProfile({
      starRuntime: { writes_per_minute: 0.6, events_count: 8 },
      starDomains: [{ activity_intensity: 0.2, alerted_moons_count: 0, circular_fields_count: 0 }],
    });
    expect(stable.topologyMode).toBe("single_star_per_galaxy");
    expect(stable.profile.key).toBe("ARCHIVE");
    expect(stable.recommendedLawPreset).toBe("low_activity");

    const stressed = resolveStarCoreProfile({
      starRuntime: { writes_per_minute: 6, events_count: 80 },
      starDomains: [{ activity_intensity: 0.5, alerted_moons_count: 2, circular_fields_count: 1 }],
    });
    expect(stressed.profile.key).toBe("SENTINEL");
    expect(stressed.recommendedLawPreset).toBe("integrity_first");
  });

  it("respects locked policy profile over runtime auto-detection", () => {
    const locked = resolveStarCoreProfile({
      starRuntime: { writes_per_minute: 14, events_count: 220 },
      starDomains: [{ activity_intensity: 0.84, alerted_moons_count: 0, circular_fields_count: 0 }],
      starPolicy: { lock_status: "locked", profile_key: "ARCHIVE", law_preset: "low_activity" },
    });

    expect(locked.profile.key).toBe("ARCHIVE");
    expect(locked.profileMode).toBe("locked");
    expect(locked.isLocked).toBe(true);
    expect(locked.canEditCoreLaws).toBe(false);
  });
});
