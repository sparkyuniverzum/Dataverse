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
    const truth = adaptStarCoreInteriorTruth(
      {
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
        source_truth: {
          policy_lock_status: "draft",
          policy_version: 3,
          profile_key: "ORIGIN",
          law_preset: "balanced",
          physical_profile_key: "BALANCE",
          physical_profile_version: 1,
        },
      },
      {
        runtimePayload: {
          as_of_event_seq: 91,
          events_count: 41,
          writes_per_minute: 22.5,
        },
        pulsePayload: {
          last_event_seq: 91,
          sampled_count: 3,
          event_types: ["table_update"],
          events: [{ intensity: 0.66 }],
        },
        domainMetricsPayload: {
          total_events_count: 41,
          domains: [{ domain_name: "governance", status: "stable", events_count: 11, activity_intensity: 0.42 }],
        },
        planetPhysicsPayload: {
          as_of_event_seq: 90,
          items: [
            { phase: "CALM", metrics: { activity: 0.12, stress: 0.18, health: 0.91 } },
            { phase: "ACTIVE", metrics: { activity: 0.6, stress: 0.48, health: 0.74 } },
          ],
        },
      }
    );
    expect(truth.selectedConstitutionId).toBe("rovnovaha");
    expect(truth.availableConstitutions[0].tonePrimary).toBe("#7ee8ff");
    expect(truth.availableConstitutions[0].pulseHint).toBe("steady");
    expect(truth.explainability.headline).toBe("Hotovo");
    expect(truth.telemetry.runtime.writesPerMinute).toBe(22.5);
    expect(truth.telemetry.domains.items[0].domainName).toBe("governance");
    expect(truth.telemetry.planetPhysics.itemCount).toBe(2);
    expect(truth.governanceSignal.policyVersion).toBe(3);
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

  it("keeps previous telemetry when constitution select response contains only workflow payload", () => {
    const initial = adaptStarCoreInteriorTruth(
      { interior_phase: "constitution_select" },
      {
        runtimePayload: { writes_per_minute: 14.7, events_count: 8 },
      }
    );
    const updated = adaptStarCoreInteriorTruth(
      {
        interior_phase: "policy_lock_ready",
        selected_constitution_id: "rovnovaha",
      },
      {
        fallbackTelemetry: initial.telemetry,
      }
    );
    expect(updated.telemetry.runtime.writesPerMinute).toBe(14.7);
    expect(updated.telemetry.runtime.eventsCount).toBe(8);
  });
});
