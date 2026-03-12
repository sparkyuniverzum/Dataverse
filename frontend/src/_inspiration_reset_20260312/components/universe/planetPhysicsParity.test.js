import { describe, expect, it } from "vitest";

import {
  resolveMoonParentRuntimePhysics,
  resolvePlanetAuthoritativePhysics,
  resolveTableRuntimeLayoutPhysics,
} from "./planetPhysicsParity";

describe("planetPhysicsParity", () => {
  it("keeps BE-authoritative planet metrics even for zero values", () => {
    const runtime = {
      phase: "corroding",
      metrics: { health: 1, stress: 0, corrosion: 0, rows: 0 },
      visual: {
        size_factor: 1,
        pulse_rate: 0,
        luminosity: 0,
        corrosion_level: 0,
        crack_intensity: 0,
        hue: 0,
        saturation: 0,
      },
    };
    const authoritative = resolvePlanetAuthoritativePhysics(runtime, {
      fallbackPhysics: { stress: 0.91, pulseFactor: 2.2, emissiveBoost: 0.8 },
    });
    expect(authoritative.status).toBe("CORRODING");
    expect(authoritative.physics.stress).toBe(0);
    expect(authoritative.physics.radiusFactor).toBe(1);
    expect(authoritative.physics.pulseFactor).toBe(0.82);
    expect(authoritative.physics.emissiveBoost).toBe(0);
    expect(authoritative.physics.corrosionLevel).toBe(0);
    expect(authoritative.physics.hue).toBe(0);
    expect(authoritative.physics.saturation).toBe(0);
  });

  it("prioritizes visual corrosion over metric corrosion", () => {
    const runtime = {
      phase: "active",
      metrics: { health: 0.9, stress: 0.2, corrosion: 0.95 },
      visual: { corrosion_level: 0.15, luminosity: 0.55, pulse_rate: 1.1, size_factor: 1.2 },
    };
    const authoritative = resolvePlanetAuthoritativePhysics(runtime);
    expect(authoritative.physics.corrosionLevel).toBe(0.15);
  });

  it("computes deterministic table layout mass/radius from runtime payload", () => {
    const layoutPhysics = resolveTableRuntimeLayoutPhysics({
      metrics: { stress: 0.5, rows: 99 },
      visual: { size_factor: 2 },
    });
    expect(layoutPhysics).toEqual({
      radiusFactor: 2,
      massFactor: 1.615,
    });
  });

  it("maps moon parent runtime values directly from selected planet runtime", () => {
    const parent = resolveMoonParentRuntimePhysics({
      phase: "critical",
      metrics: { corrosion: 0.6 },
      visual: { corrosion_level: 0.2, crack_intensity: 0.4, hue: 0.33, saturation: 0.22 },
    });
    expect(parent).toEqual({
      parentPhase: "CRITICAL",
      parentCorrosion: 0.2,
      parentCrack: 0.4,
      parentHue: 0.33,
      parentSaturation: 0.22,
    });
  });

  it("guards helper behavior against zero-fallback drift regressions", () => {
    const runtime = {
      phase: "active",
      metrics: { stress: 0, corrosion: 0, rows: 0 },
      visual: {
        size_factor: 0,
        pulse_rate: 0,
        luminosity: 0,
        corrosion_level: 0,
        crack_intensity: 0,
        hue: 0,
        saturation: 0,
      },
    };
    const authoritative = resolvePlanetAuthoritativePhysics(runtime, {
      fallbackPhysics: {
        radiusFactor: 9,
        pulseFactor: 9,
        emissiveBoost: 9,
        corrosionLevel: 9,
        crackIntensity: 9,
        hue: 9,
        saturation: 9,
      },
    });

    expect(authoritative.physics.radiusFactor).toBe(0);
    expect(authoritative.physics.pulseFactor).toBe(0);
    expect(authoritative.physics.emissiveBoost).toBe(0);
    expect(authoritative.physics.corrosionLevel).toBe(0);
    expect(authoritative.physics.crackIntensity).toBe(0);
    expect(authoritative.physics.hue).toBe(0);
    expect(authoritative.physics.saturation).toBe(0);
  });
});
