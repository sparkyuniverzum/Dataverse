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
});
