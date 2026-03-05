import { describe, expect, it } from "vitest";

import {
  BRANCH_GATE_FE_USED_FIELDS,
  BRANCH_PUBLIC_BE_FIELDS,
  GALAXY_GATE_FE_USED_FIELDS,
  GALAXY_PUBLIC_BE_FIELDS,
  ONBOARDING_GATE_FE_USED_FIELDS,
  ONBOARDING_PUBLIC_BE_FIELDS,
  normalizeGalaxyList,
  normalizeGalaxyPublic,
  normalizeBranchList,
  normalizeOnboardingPublic,
  workspaceScopeContractDiff,
} from "./workspaceScopeContract";

describe("workspaceScopeContract baselines", () => {
  it("keeps frozen BE field inventories for galaxy/branch/onboarding", () => {
    expect(GALAXY_PUBLIC_BE_FIELDS).toEqual(["id", "name", "owner_id", "created_at", "deleted_at"]);
    expect(BRANCH_PUBLIC_BE_FIELDS).toEqual([
      "id",
      "galaxy_id",
      "name",
      "base_event_id",
      "created_by",
      "created_at",
      "deleted_at",
    ]);
    expect(ONBOARDING_PUBLIC_BE_FIELDS).toEqual([
      "user_id",
      "galaxy_id",
      "mode",
      "current_stage_key",
      "current_stage_order",
      "started_at",
      "stage_started_at",
      "completed_at",
      "updated_at",
      "can_advance",
      "advance_blockers",
      "capabilities",
      "machine",
      "metrics",
      "stages",
    ]);
  });

  it("uses only BE-defined fields in FE contracts", () => {
    const report = workspaceScopeContractDiff();
    expect(report.galaxy.extra_in_fe).toEqual([]);
    expect(report.branch.extra_in_fe).toEqual([]);
    expect(report.onboarding.extra_in_fe).toEqual([]);
  });

  it("keeps mandatory FE used fields stable for app flow", () => {
    expect(GALAXY_GATE_FE_USED_FIELDS).toEqual(["id", "name", "deleted_at"]);
    expect(BRANCH_GATE_FE_USED_FIELDS).toEqual(["id", "galaxy_id", "name", "deleted_at"]);
    expect(ONBOARDING_GATE_FE_USED_FIELDS).toEqual([
      "galaxy_id",
      "mode",
      "current_stage_key",
      "can_advance",
      "advance_blockers",
      "machine",
    ]);
  });
});

describe("workspaceScopeContract normalization", () => {
  it("normalizes galaxy payloads and drops invalid entries", () => {
    const normalized = normalizeGalaxyList([
      {
        id: "g-1",
        name: "Ops",
        owner_id: "u-1",
        created_at: "2026-03-05T10:00:00Z",
        deleted_at: null,
      },
      {
        id: "",
        name: "Broken",
      },
    ]);
    expect(normalized).toHaveLength(1);
    expect(normalized[0]).toEqual({
      id: "g-1",
      name: "Ops",
      owner_id: "u-1",
      created_at: "2026-03-05T10:00:00Z",
      deleted_at: null,
    });
  });

  it("normalizes single galaxy payload for auth/default galaxy flow", () => {
    expect(
      normalizeGalaxyPublic({
        id: "g-2",
        name: "Finance",
      })
    ).toEqual({
      id: "g-2",
      name: "Finance",
      owner_id: "",
      created_at: null,
      deleted_at: null,
    });
  });

  it("normalizes branch list payload", () => {
    const branches = normalizeBranchList([
      {
        id: "br-1",
        galaxy_id: "g-1",
        name: "Mainline branch",
        base_event_id: "ev-1",
        created_by: "u-1",
        created_at: "2026-03-05T10:00:00Z",
        deleted_at: null,
      },
      { id: "", galaxy_id: "g-1", name: "Broken" },
    ]);
    expect(branches).toHaveLength(1);
    expect(branches[0].name).toBe("Mainline branch");
    expect(branches[0].id).toBe("br-1");
    expect(branches[0].galaxy_id).toBe("g-1");
  });

  it("normalizes onboarding payload to stable machine shape", () => {
    const onboarding = normalizeOnboardingPublic({
      user_id: "u-2",
      galaxy_id: "g-2",
      mode: "guided",
      current_stage_key: "planet_workbench",
      current_stage_order: 2,
      can_advance: true,
      machine: {
        step: "schema",
        intro_ack: true,
        planet_dropped: true,
      },
      advance_blockers: ["missing_schema"],
      capabilities: ["planet_create"],
    });
    expect(onboarding).not.toBeNull();
    expect(onboarding.galaxy_id).toBe("g-2");
    expect(onboarding.current_stage_key).toBe("planet_workbench");
    expect(onboarding.machine.step).toBe("schema");
    expect(onboarding.machine.schema_confirmed).toBe(false);
    expect(onboarding.advance_blockers).toEqual(["missing_schema"]);
  });
});
