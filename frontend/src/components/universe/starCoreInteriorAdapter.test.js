import { describe, expect, it } from "vitest";

import {
  adaptStarCoreInteriorTruth,
  beginStarCoreInteriorUi,
  beginStarCorePolicyLockUi,
  resolveStarCoreInteriorEntryComplete,
  resolveStarCoreInteriorModel,
  resolveStarCorePolicyLockUiFailure,
  resolveStarCorePolicyLockUiSuccess,
} from "./starCoreInteriorAdapter.js";

describe("starCoreInteriorAdapter", () => {
  it("normalizes backend payload to FE-safe truth", () => {
    const truth = adaptStarCoreInteriorTruth({
      interior_phase: "policy_lock_ready",
      selected_constitution_id: "rovnovaha",
      available_constitutions: [
        {
          constitution_id: "rovnovaha",
          title_cz: "Rovnováha",
          summary_cz: "Stabilní režim.",
          pulse_hint: "steady",
          visual_tone: "balanced_blue",
          profile_key: "ORIGIN",
          law_preset: "balanced",
          physical_profile_key: "BALANCE",
          physical_profile_version: 1,
          recommended: true,
          lock_allowed: true,
        },
      ],
      lock_ready: true,
      explainability: { headline_cz: "Hotovo", body_cz: "Můžeš pokračovat." },
    });
    expect(truth.selectedConstitutionId).toBe("rovnovaha");
    expect(truth.availableConstitutions[0].tonePrimary).toBe("#7ee8ff");
    expect(truth.availableConstitutions[0].pulseHint).toBe("steady");
    expect(truth.explainability.headline).toBe("Hotovo");
  });

  it("uses backend phase after entry animation finishes", () => {
    const model = resolveStarCoreInteriorModel({
      interiorTruth: adaptStarCoreInteriorTruth({ interior_phase: "constitution_select" }),
      uiState: resolveStarCoreInteriorEntryComplete(beginStarCoreInteriorUi()),
    });
    expect(model.phase).toBe("constitution_select");
  });

  it("keeps transient lock phase only while request is pending", () => {
    const pending = beginStarCorePolicyLockUi(beginStarCoreInteriorUi());
    const model = resolveStarCoreInteriorModel({
      interiorTruth: adaptStarCoreInteriorTruth({ interior_phase: "policy_lock_ready", lock_ready: true }),
      uiState: pending,
    });
    expect(model.phase).toBe("policy_lock_transition");

    const success = resolveStarCorePolicyLockUiSuccess(pending);
    const nextModel = resolveStarCoreInteriorModel({
      interiorTruth: adaptStarCoreInteriorTruth({ interior_phase: "first_orbit_ready", first_orbit_ready: true }),
      uiState: success,
    });
    expect(nextModel.phase).toBe("first_orbit_ready");
  });

  it("preserves recoverable error on backend-driven ready phase", () => {
    const model = resolveStarCoreInteriorModel({
      interiorTruth: adaptStarCoreInteriorTruth({ interior_phase: "policy_lock_ready", lock_ready: true }),
      uiState: resolveStarCorePolicyLockUiFailure(beginStarCoreInteriorUi(), "Lock failed"),
    });
    expect(model.phase).toBe("policy_lock_ready");
    expect(model.errorMessage).toBe("Lock failed");
  });
});
