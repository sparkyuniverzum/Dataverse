import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";

import {
  STAR_CONTRACT_FIELD_CLASSIFICATION,
  STAR_DOMAIN_BE_FIELDS,
  STAR_DOMAIN_FE_USED_FIELDS,
  STAR_FIELD_CLASS,
  STAR_PHYSICS_PROFILE_BE_FIELDS,
  STAR_PHYSICS_PROFILE_FE_USED_FIELDS,
  STAR_PLANET_PHYSICS_ITEM_BE_FIELDS,
  STAR_PLANET_PHYSICS_ITEM_FE_USED_FIELDS,
  STAR_POLICY_BE_FIELDS,
  STAR_POLICY_FE_USED_FIELDS,
  STAR_PULSE_EVENT_BE_FIELDS,
  STAR_PULSE_FE_USED_FIELDS,
  STAR_RUNTIME_BE_FIELDS,
  STAR_RUNTIME_FE_USED_FIELDS,
  getStarContractClassificationReport,
  getStarPhysicsContractUsageDiff,
  getStarContractUsageDiff,
  normalizeStarDomains,
  normalizeStarPhysicsProfile,
  normalizeStarPlanetPhysicsPayload,
  normalizeStarPolicy,
  normalizeStarPulsePayload,
  normalizeStarRuntime,
} from "./starContract";

describe("starContract normalization", () => {
  it("normalizes policy with safe defaults", () => {
    const normalized = normalizeStarPolicy({
      profile_key: "flux",
      lock_status: "locked",
      policy_version: 0,
      can_edit_core_laws: true,
    });
    expect(normalized.profile_key).toBe("FLUX");
    expect(normalized.lock_status).toBe("locked");
    expect(normalized.policy_version).toBe(1);
    expect(normalized.can_edit_core_laws).toBe(false);
    expect(normalized.deletion_mode).toBe("soft_delete");
  });

  it("normalizes runtime and domains", () => {
    const runtime = normalizeStarRuntime({
      writes_per_minute: "6.5",
      events_count: "12",
      as_of_event_seq: "7",
    });
    expect(runtime.writes_per_minute).toBe(6.5);
    expect(runtime.events_count).toBe(12);
    expect(runtime.as_of_event_seq).toBe(7);

    const domains = normalizeStarDomains([
      { domain_name: "Finance", activity_intensity: 2.4, status: "green" },
    ]);
    expect(domains[0].domain_name).toBe("Finance");
    expect(domains[0].activity_intensity).toBe(1);
    expect(domains[0].status).toBe("GREEN");
  });

  it("normalizes pulse payload", () => {
    const pulse = normalizeStarPulsePayload({
      last_event_seq: 11,
      events: [{ entity_id: "a-1", intensity: 1.7, visual_hint: "", event_seq: 11 }],
    });
    expect(pulse.last_event_seq).toBe(11);
    expect(pulse.events[0].entity_id).toBe("a-1");
    expect(pulse.events[0].intensity).toBe(1.5);
    expect(pulse.events[0].visual_hint).toBe("orbital_pulse");
  });

  it("normalizes star physics profile and per-planet runtime payload", () => {
    const profile = normalizeStarPhysicsProfile({
      profile_key: "forge",
      profile_version: "2",
      lock_status: "LOCKED",
      coefficients: { a: "0.1", b: 0.22 },
    });
    expect(profile.profile_key).toBe("FORGE");
    expect(profile.profile_version).toBe(2);
    expect(profile.lock_status).toBe("locked");
    expect(profile.coefficients.a).toBe(0.1);
    expect(profile.coefficients.b).toBe(0.22);

    const runtime = normalizeStarPlanetPhysicsPayload({
      as_of_event_seq: "9",
      items: [
        {
          table_id: "table-1",
          phase: "active",
          metrics: { activity: 2, stress: -1, health: 0.8, rows: 11 },
          visual: { size_factor: 2.8, luminosity: 1.9, pulse_rate: 3.7 },
          source_event_seq: "7",
        },
      ],
    });
    expect(runtime.as_of_event_seq).toBe(9);
    expect(runtime.items).toHaveLength(1);
    expect(runtime.items[0].phase).toBe("ACTIVE");
    expect(runtime.items[0].metrics.activity).toBe(1);
    expect(runtime.items[0].metrics.stress).toBe(0);
    expect(runtime.items[0].visual.size_factor).toBe(2.8);
    expect(runtime.items[0].visual.luminosity).toBe(1);
  });
});

describe("starContract BE->FE usage diff", () => {
  it("returns deterministic diff object", () => {
    const diff = getStarContractUsageDiff();
    expect(Array.isArray(diff.policy.unused_from_be)).toBe(true);
    expect(Array.isArray(diff.policy.missing_in_be)).toBe(true);
    expect(diff.policy.missing_in_be).toEqual([]);
    expect(diff.runtime.missing_in_be).toEqual([]);
    expect(diff.domains.missing_in_be).toEqual([]);
    expect(diff.pulse_event.missing_in_be).toEqual([]);
  });

  it("has complete and valid classification coverage", () => {
    const report = getStarContractClassificationReport();
    for (const section of ["policy", "runtime", "domains", "pulse_event"]) {
      expect(report[section].unclassified).toEqual([]);
      expect(report[section].orphan_class_entries).toEqual([]);
      expect(report[section].invalid_class_entries).toEqual([]);
      expect(report[section].use_now_not_in_fe_used).toEqual([]);
      expect(report[section].fe_used_not_use_now).toEqual([]);
    }
  });

  it("matches frozen baseline v1", () => {
    const baselinePath = fileURLToPath(new URL("../../../../docs/star-contract-baseline-v1.json", import.meta.url));
    const baseline = JSON.parse(readFileSync(baselinePath, "utf-8"));
    expect(baseline.version).toBe("v1");
    expect(baseline.source_of_truth.policy.be_fields).toEqual(STAR_POLICY_BE_FIELDS);
    expect(baseline.source_of_truth.policy.fe_used_fields).toEqual(STAR_POLICY_FE_USED_FIELDS);
    expect(baseline.source_of_truth.runtime.be_fields).toEqual(STAR_RUNTIME_BE_FIELDS);
    expect(baseline.source_of_truth.runtime.fe_used_fields).toEqual(STAR_RUNTIME_FE_USED_FIELDS);
    expect(baseline.source_of_truth.domains.be_fields).toEqual(STAR_DOMAIN_BE_FIELDS);
    expect(baseline.source_of_truth.domains.fe_used_fields).toEqual(STAR_DOMAIN_FE_USED_FIELDS);
    expect(baseline.source_of_truth.pulse_event.be_fields).toEqual(STAR_PULSE_EVENT_BE_FIELDS);
    expect(baseline.source_of_truth.pulse_event.fe_used_fields).toEqual(STAR_PULSE_FE_USED_FIELDS);
    expect(baseline.diff).toEqual(getStarContractUsageDiff());
    expect(baseline.classification.classes).toEqual(STAR_FIELD_CLASS);
    expect(baseline.classification.by_section).toEqual(STAR_CONTRACT_FIELD_CLASSIFICATION);
    expect(baseline.classification.report).toEqual(getStarContractClassificationReport());
  });

  it("matches frozen star physics baseline v2", () => {
    const baselinePath = fileURLToPath(new URL("../../../../docs/star-physics-contract-baseline-v2.json", import.meta.url));
    const baseline = JSON.parse(readFileSync(baselinePath, "utf-8"));
    expect(baseline.version).toBe("v2");
    expect(baseline.source_of_truth.physics_profile.be_fields).toEqual(STAR_PHYSICS_PROFILE_BE_FIELDS);
    expect(baseline.source_of_truth.physics_profile.fe_used_fields).toEqual(STAR_PHYSICS_PROFILE_FE_USED_FIELDS);
    expect(baseline.source_of_truth.planet_physics_item.be_fields).toEqual(STAR_PLANET_PHYSICS_ITEM_BE_FIELDS);
    expect(baseline.source_of_truth.planet_physics_item.fe_used_fields).toEqual(STAR_PLANET_PHYSICS_ITEM_FE_USED_FIELDS);
    expect(baseline.diff).toEqual(getStarPhysicsContractUsageDiff());
  });
});
