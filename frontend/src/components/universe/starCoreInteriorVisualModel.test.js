import { describe, expect, it } from "vitest";

import { resolveStarCoreInteriorVisualModel } from "./starCoreInteriorVisualModel.js";

describe("starCoreInteriorVisualModel", () => {
  it("projects constitution select into ritual chamber visuals", () => {
    const model = resolveStarCoreInteriorVisualModel({
      interiorModel: {
        phase: "constitution_select",
        availableConstitutions: [{ id: "rovnovaha" }],
        explainability: { headline: "Vyber rezim jadra", body: "Body" },
      },
      selectedConstitution: {
        id: "rovnovaha",
        tonePrimary: "#7ee8ff",
        toneSecondary: "#82ffd4",
      },
      screenModel: { isEntering: false, isReturning: false },
    });

    expect(model.showSelectionOrbit).toBe(true);
    expect(model.showLockRing).toBe(false);
    expect(model.phaseCopy.title).toBe("Vyber rezim jadra");
  });

  it("shows lock ring during policy lock transition", () => {
    const model = resolveStarCoreInteriorVisualModel({
      interiorModel: {
        phase: "policy_lock_transition",
        explainability: { headline: "Prstenec se uzamyka", body: "Body" },
      },
      selectedConstitution: null,
      screenModel: { isEntering: false, isReturning: false },
    });

    expect(model.showLockRing).toBe(true);
    expect(model.lockRingScale).toBe(0.92);
    expect(model.showFirstOrbit).toBe(false);
  });

  it("shows first orbit outcome only after canonical confirmation", () => {
    const model = resolveStarCoreInteriorVisualModel({
      interiorModel: {
        phase: "first_orbit_ready",
        explainability: { headline: "", body: "" },
      },
      selectedConstitution: null,
      screenModel: { isEntering: false, isReturning: false },
    });

    expect(model.showFirstOrbit).toBe(true);
    expect(model.showSelectionOrbit).toBe(false);
    expect(model.phaseCopy.eyebrow).toBe("FIRST ORBIT READY");
  });

  it("reduces chamber opacity during entering and returning transitions", () => {
    const enteringModel = resolveStarCoreInteriorVisualModel({
      interiorModel: { phase: "constitution_select", explainability: {} },
      selectedConstitution: null,
      screenModel: { isEntering: true, isReturning: false },
    });
    const returningModel = resolveStarCoreInteriorVisualModel({
      interiorModel: { phase: "constitution_select", explainability: {} },
      selectedConstitution: null,
      screenModel: { isEntering: false, isReturning: true },
    });

    expect(enteringModel.chamberOpacity).toBe(0.78);
    expect(returningModel.chamberOpacity).toBe(0.78);
  });

  it("projects backend telemetry into live ritual signals", () => {
    const model = resolveStarCoreInteriorVisualModel({
      interiorModel: {
        phase: "policy_lock_ready",
        explainability: {},
        telemetry: {
          runtime: { writesPerMinute: 48 },
          pulse: { sampledCount: 5, peakIntensity: 0.72, eventTypes: ["table_update", "policy_lock"] },
          domains: {
            items: [
              { domainName: "governance", status: "stable", activityIntensity: 0.5 },
              { domainName: "physics", status: "degraded", activityIntensity: 0.71 },
            ],
          },
          planetPhysics: {
            itemCount: 5,
            activeCount: 3,
            criticalCount: 1,
            phaseCounts: [{ phase: "ACTIVE", count: 3 }],
          },
        },
      },
      selectedConstitution: null,
      screenModel: { isEntering: false, isReturning: false },
    });

    expect(model.runtimeTempo).toBeGreaterThan(0);
    expect(model.pulseStrength).toBeGreaterThan(0.4);
    expect(model.domainSegments).toHaveLength(2);
    expect(model.pulseBeacons).toHaveLength(2);
    expect(model.planetaryNodes).toHaveLength(1);
    expect(model.eventHaloCount).toBeGreaterThanOrEqual(4);
    expect(model.shellGlowOpacity).toBeGreaterThan(0.2);
  });
});
