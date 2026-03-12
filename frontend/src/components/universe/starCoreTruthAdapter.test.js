import { describe, expect, it } from "vitest";

import { adaptStarCoreTruth } from "./starCoreTruthAdapter.js";

describe("starCoreTruthAdapter", () => {
  it("normalizes BE truth into FE-ready shape", () => {
    const truth = adaptStarCoreTruth({
      galaxy: { id: "g-1", name: "My Galaxy" },
      connectivity: { isOnline: true, isOffline: false },
      policyPayload: {
        profile_key: "sentinel",
        law_preset: "integrity_first",
        lock_status: "LOCKED",
        policy_version: "2",
        can_edit_core_laws: true,
      },
      physicsProfilePayload: {
        galaxy_id: "g-1",
        profile_key: "archive",
        profile_version: "3",
        lock_status: "locked",
        coefficients: { a: "0.12", b: 0.7 },
      },
      runtimePayload: {
        as_of_event_seq: 42,
        events_count: 18,
        writes_per_minute: 12,
      },
      pulsePayload: {
        sampled_count: 5,
        events: [{ event_type: "policy.lock" }],
      },
      domainMetricsPayload: {
        total_events_count: 18,
        domains: [{ domain_name: "governance", status: "stable" }],
      },
    });

    expect(truth.galaxy.name).toBe("My Galaxy");
    expect(truth.policy.profile_key).toBe("SENTINEL");
    expect(truth.policy.can_edit_core_laws).toBe(false);
    expect(truth.physicsProfile.profile_key).toBe("ARCHIVE");
    expect(truth.profileMeta.label).toBe("Sentinel Core");
    expect(truth.physicalProfileMeta.label).toBe("Archive Physics");
    expect(truth.halo.coefficientCount).toBe(2);
    expect(truth.runtime.writes_per_minute).toBe(12);
    expect(truth.pulse.sampled_count).toBe(5);
    expect(truth.domainMetrics.domains).toHaveLength(1);
  });

  it("returns null when galaxy is missing", () => {
    expect(adaptStarCoreTruth({ galaxy: null })).toBeNull();
  });
});
