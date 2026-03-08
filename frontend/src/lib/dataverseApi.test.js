import { describe, expect, it } from "vitest";

import {
  apiErrorFromResponse,
  bondSemanticsFromType,
  buildAsteroidExtinguishUrl,
  buildBondExtinguishUrl,
  buildOccConflictMessage,
  buildGalaxyExtinguishUrl,
  buildGalaxyEventsStreamUrl,
  buildStarCoreDomainMetricsUrl,
  buildPlanetExtinguishUrl,
  buildStarCorePhysicsProfileUrl,
  buildStarCorePlanetPhysicsUrl,
  buildStarCorePolicyLockUrl,
  buildStarCorePolicyUrl,
  buildStarCorePulseUrl,
  buildStarCoreRuntimeUrl,
  buildImportJobErrorsUrl,
  buildImportJobUrl,
  buildImportRunUrl,
  buildBranchesUrl,
  buildBranchPromoteUrl,
  buildGalaxyOnboardingUrl,
  buildParserPayload,
  buildTableContractUrl,
  buildTaskBatchPayload,
  buildCivilizationMutatePayload,
  buildCivilizationMineralMutatePayload,
  buildMoonCreateUrl,
  buildMoonDetailUrl,
  buildMoonExtinguishUrl,
  buildMoonListUrl,
  buildMoonMineralMutateUrl,
  buildMoonMutateUrl,
  buildCivilizationCreateUrl,
  buildCivilizationDetailUrl,
  buildCivilizationExtinguishUrl,
  buildCivilizationListUrl,
  buildCivilizationMineralMutateUrl,
  buildCivilizationMutateUrl,
  buildSnapshotExportUrl,
  buildSnapshotUrl,
  buildTablesExportUrl,
  isOccConflictError,
  normalizeBondType,
  normalizeApiErrorPayload,
  normalizeSnapshot,
  toAsOfIso,
} from "./dataverseApi";

describe("buildParserPayload", () => {
  it("builds unified payload for parser contract", () => {
    expect(buildParserPayload("  Pavel + Audi  ")).toEqual({
      query: "Pavel + Audi",
      parser_version: "v2",
    });
  });

  it("includes branch_id when provided", () => {
    expect(buildParserPayload("A + B", "g-1", "br-1")).toEqual({
      query: "A + B",
      parser_version: "v2",
      galaxy_id: "g-1",
      branch_id: "br-1",
    });
  });
});

describe("buildTaskBatchPayload", () => {
  it("builds payload with mode, tasks and scope", () => {
    expect(
      buildTaskBatchPayload({
        mode: "preview",
        tasks: [{ action: "UPDATE_ASTEROID", params: { asteroid_id: "a-1", metadata: { cena: "100" } } }],
        galaxyId: "g-1",
        branchId: "br-1",
      })
    ).toEqual({
      mode: "preview",
      tasks: [{ action: "UPDATE_ASTEROID", params: { asteroid_id: "a-1", metadata: { cena: "100" } } }],
      galaxy_id: "g-1",
      branch_id: "br-1",
    });
  });
});

describe("normalizeSnapshot", () => {
  it("filters deleted asteroids and bonds with deleted endpoints", () => {
    const snapshot = {
      asteroids: [
        { id: "a1", value: "A", is_deleted: false },
        { id: "a2", value: "B", is_deleted: true },
        { id: "a3", value: "C", is_deleted: false },
      ],
      bonds: [
        { id: "b1", source_id: "a1", target_id: "a3", is_deleted: false },
        { id: "b2", source_id: "a1", target_id: "a2", is_deleted: false },
        { id: "b3", source_id: "a1", target_id: "a3", is_deleted: true },
      ],
    };

    const result = normalizeSnapshot(snapshot);
    expect(result.asteroids.map((asteroid) => asteroid.id)).toEqual(["a1", "a3"]);
    expect(result.bonds.map((bond) => bond.id)).toEqual(["b1"]);
  });

  it("keeps civilization/mineral payload fields required by workspace UI", () => {
    const snapshot = {
      asteroids: [
        {
          id: "m1",
          value: "Moon-1",
          table_id: "t-1",
          table_name: "Finance > Cashflow",
          metadata: { amount: 1500, type: "income" },
          calculated_values: { tax: 300 },
          current_event_seq: 9,
          is_deleted: false,
        },
      ],
      bonds: [],
    };
    const result = normalizeSnapshot(snapshot);
    expect(result.asteroids).toHaveLength(1);
    const row = result.asteroids[0];
    expect(row.id).toBe("m1");
    expect(row.table_id).toBe("t-1");
    expect(row.table_name).toBe("Finance > Cashflow");
    expect(row.metadata.amount).toBe(1500);
    expect(row.calculated_values.tax).toBe(300);
    expect(row.current_event_seq).toBe(9);
  });
});

describe("time machine helpers", () => {
  it("converts datetime-local to ISO and builds as_of snapshot URL", () => {
    const iso = toAsOfIso("2026-02-27T21:05");
    expect(iso).toContain("2026-02-27T");

    const url = buildSnapshotUrl("http://127.0.0.1:8000", iso, "g-1", "br-1");
    expect(url).toContain("/universe/snapshot");
    expect(url).toContain("as_of=");
    expect(url).toContain("galaxy_id=g-1");
    expect(url).toContain("branch_id=br-1");
  });
});

describe("events stream url", () => {
  it("builds stream URL with cursor and polling controls", () => {
    const url = buildGalaxyEventsStreamUrl("http://127.0.0.1:8000", "galaxy-42", {
      lastEventSeq: 19,
      pollMs: 900,
      heartbeatSec: 12,
    });
    expect(url).toContain("/galaxies/galaxy-42/events/stream");
    expect(url).toContain("last_event_seq=19");
    expect(url).toContain("poll_ms=900");
    expect(url).toContain("heartbeat_sec=12");
  });
});

describe("star core urls", () => {
  it("builds runtime, pulse and domain metrics urls", () => {
    const runtimeUrl = buildStarCoreRuntimeUrl("http://127.0.0.1:8000", "g-42", {
      branchId: "br-9",
      windowEvents: 90,
    });
    expect(runtimeUrl).toContain("/galaxies/g-42/star-core/runtime");
    expect(runtimeUrl).toContain("branch_id=br-9");
    expect(runtimeUrl).toContain("window_events=90");

    const pulseUrl = buildStarCorePulseUrl("http://127.0.0.1:8000", "g-42", {
      afterEventSeq: 123,
      limit: 48,
    });
    expect(pulseUrl).toContain("/galaxies/g-42/star-core/pulse");
    expect(pulseUrl).toContain("after_event_seq=123");
    expect(pulseUrl).toContain("limit=48");

    const domainsUrl = buildStarCoreDomainMetricsUrl("http://127.0.0.1:8000", "g-42", {
      windowEvents: 300,
    });
    expect(domainsUrl).toContain("/galaxies/g-42/star-core/metrics/domains");
    expect(domainsUrl).toContain("window_events=300");

    const policyUrl = buildStarCorePolicyUrl("http://127.0.0.1:8000", "g-42");
    expect(policyUrl).toBe("http://127.0.0.1:8000/galaxies/g-42/star-core/policy");

    const lockUrl = buildStarCorePolicyLockUrl("http://127.0.0.1:8000", "g-42");
    expect(lockUrl).toBe("http://127.0.0.1:8000/galaxies/g-42/star-core/policy/lock");

    const profileUrl = buildStarCorePhysicsProfileUrl("http://127.0.0.1:8000", "g-42");
    expect(profileUrl).toBe("http://127.0.0.1:8000/galaxies/g-42/star-core/physics/profile");

    const planetsUrl = buildStarCorePlanetPhysicsUrl("http://127.0.0.1:8000", "g-42", {
      afterEventSeq: 200,
      limit: 500,
      branchId: "br-7",
    });
    expect(planetsUrl).toContain("/galaxies/g-42/star-core/physics/planets");
    expect(planetsUrl).toContain("after_event_seq=200");
    expect(planetsUrl).toContain("limit=500");
    expect(planetsUrl).toContain("branch_id=br-7");
  });
});

describe("io urls", () => {
  it("builds import and export URLs", () => {
    expect(buildImportRunUrl("http://127.0.0.1:8000")).toBe("http://127.0.0.1:8000/io/imports");
    expect(buildImportJobUrl("http://127.0.0.1:8000", "job-42")).toBe("http://127.0.0.1:8000/io/imports/job-42");
    expect(buildImportJobErrorsUrl("http://127.0.0.1:8000", "job-42")).toBe(
      "http://127.0.0.1:8000/io/imports/job-42/errors"
    );

    const snapshotUrl = buildSnapshotExportUrl("http://127.0.0.1:8000", {
      galaxyId: "g-1",
      branchId: "br-1",
      asOfIso: "2026-03-01T10:00:00Z",
    });
    expect(snapshotUrl).toContain("/io/exports/snapshot");
    expect(snapshotUrl).toContain("format=csv");
    expect(snapshotUrl).toContain("galaxy_id=g-1");
    expect(snapshotUrl).toContain("branch_id=br-1");
    expect(snapshotUrl).toContain("as_of=2026-03-01T10%3A00%3A00Z");

    const tablesUrl = buildTablesExportUrl("http://127.0.0.1:8000", {
      galaxyId: "g-2",
      branchId: "br-2",
      format: "csv",
    });
    expect(tablesUrl).toContain("/io/exports/tables");
    expect(tablesUrl).toContain("format=csv");
    expect(tablesUrl).toContain("galaxy_id=g-2");
    expect(tablesUrl).toContain("branch_id=br-2");
  });

  it("builds table contract URL with optional galaxy scope", () => {
    const scoped = buildTableContractUrl("http://127.0.0.1:8000", "table-1", "g-5");
    expect(scoped).toBe("http://127.0.0.1:8000/contracts/table-1?galaxy_id=g-5");

    const plain = buildTableContractUrl("http://127.0.0.1:8000", "table-2");
    expect(plain).toBe("http://127.0.0.1:8000/contracts/table-2");
  });

  it("builds branches and onboarding URLs", () => {
    const scopedBranches = buildBranchesUrl("http://127.0.0.1:8000", "g-42");
    expect(scopedBranches).toBe("http://127.0.0.1:8000/branches?galaxy_id=g-42");

    const plainBranches = buildBranchesUrl("http://127.0.0.1:8000");
    expect(plainBranches).toBe("http://127.0.0.1:8000/branches");

    const promoteScoped = buildBranchPromoteUrl("http://127.0.0.1:8000", "br-1", "g-42");
    expect(promoteScoped).toBe("http://127.0.0.1:8000/branches/br-1/promote?galaxy_id=g-42");

    const promotePlain = buildBranchPromoteUrl("http://127.0.0.1:8000", "br-2");
    expect(promotePlain).toBe("http://127.0.0.1:8000/branches/br-2/promote");

    const onboardingUrl = buildGalaxyOnboardingUrl("http://127.0.0.1:8000", "g-42");
    expect(onboardingUrl).toBe("http://127.0.0.1:8000/galaxies/g-42/onboarding");
  });

  it("builds first-class moon and civilization CRUD URLs", () => {
    const moonList = buildMoonListUrl("http://127.0.0.1:8000", {
      galaxyId: "g-5",
      planetId: "table-1",
      branchId: "br-2",
    });
    expect(moonList).toBe("http://127.0.0.1:8000/moons?galaxy_id=g-5&planet_id=table-1&branch_id=br-2");

    const moonDetail = buildMoonDetailUrl("http://127.0.0.1:8000", "moon-7", {
      galaxyId: "g-5",
      branchId: "br-2",
    });
    expect(moonDetail).toBe("http://127.0.0.1:8000/moons/moon-7?galaxy_id=g-5&branch_id=br-2");

    expect(buildMoonCreateUrl("http://127.0.0.1:8000")).toBe("http://127.0.0.1:8000/moons");
    expect(buildMoonMutateUrl("http://127.0.0.1:8000", "moon-7")).toBe("http://127.0.0.1:8000/moons/moon-7/mutate");
    expect(buildMoonMineralMutateUrl("http://127.0.0.1:8000", "moon-7", "amount")).toBe(
      "http://127.0.0.1:8000/moons/moon-7/minerals/amount"
    );
    expect(buildMoonExtinguishUrl("http://127.0.0.1:8000", "moon-7")).toBe(
      "http://127.0.0.1:8000/moons/moon-7/extinguish"
    );

    const civilizationList = buildCivilizationListUrl("http://127.0.0.1:8000", {
      galaxyId: "g-5",
      planetId: "table-1",
      branchId: "br-2",
    });
    expect(civilizationList).toBe("http://127.0.0.1:8000/civilizations?galaxy_id=g-5&planet_id=table-1&branch_id=br-2");

    const civilizationDetail = buildCivilizationDetailUrl("http://127.0.0.1:8000", "civilization-7", {
      galaxyId: "g-5",
      branchId: "br-2",
    });
    expect(civilizationDetail).toBe("http://127.0.0.1:8000/civilizations/civilization-7?galaxy_id=g-5&branch_id=br-2");

    expect(buildCivilizationCreateUrl("http://127.0.0.1:8000")).toBe("http://127.0.0.1:8000/civilizations");
    expect(buildCivilizationMutateUrl("http://127.0.0.1:8000", "civilization-7")).toBe(
      "http://127.0.0.1:8000/civilizations/civilization-7/mutate"
    );
    expect(buildCivilizationMineralMutateUrl("http://127.0.0.1:8000", "civilization-7", "amount")).toBe(
      "http://127.0.0.1:8000/civilizations/civilization-7/minerals/amount"
    );
    expect(buildCivilizationExtinguishUrl("http://127.0.0.1:8000", "civilization-7")).toBe(
      "http://127.0.0.1:8000/civilizations/civilization-7/extinguish"
    );
  });

  it("builds soft-delete extinguish URLs for protected entity groups", () => {
    const asteroidUrl = buildAsteroidExtinguishUrl("http://127.0.0.1:8000", "a-1", {
      galaxyId: "g-5",
      expectedEventSeq: 7,
    });
    expect(asteroidUrl).toBe("http://127.0.0.1:8000/asteroids/a-1/extinguish?galaxy_id=g-5&expected_event_seq=7");

    const bondUrl = buildBondExtinguishUrl("http://127.0.0.1:8000", "b-1", {
      galaxyId: "g-5",
      expectedEventSeq: 2,
    });
    expect(bondUrl).toBe("http://127.0.0.1:8000/bonds/b-1/extinguish?galaxy_id=g-5&expected_event_seq=2");

    const planetUrl = buildPlanetExtinguishUrl("http://127.0.0.1:8000", "table-1", {
      galaxyId: "g-5",
      branchId: "br-3",
    });
    expect(planetUrl).toBe("http://127.0.0.1:8000/planets/table-1/extinguish?galaxy_id=g-5&branch_id=br-3");

    const galaxyUrl = buildGalaxyExtinguishUrl("http://127.0.0.1:8000", "g-5");
    expect(galaxyUrl).toBe("http://127.0.0.1:8000/galaxies/g-5/extinguish");
  });
});

describe("civilization/moon payload builders", () => {
  it("builds civilization mutate payload with all fields", () => {
    const payload = buildCivilizationMutatePayload({
      label: "New Civ",
      minerals: { amount: 100 },
      planetId: "p-1",
      expectedEventSeq: 10.5,
      idempotencyKey: "key-1",
      galaxyId: "g-1",
      branchId: "br-1",
    });
    expect(payload).toEqual({
      label: "New Civ",
      minerals: { amount: 100 },
      planet_id: "p-1",
      expected_event_seq: 10,
      idempotency_key: "key-1",
      galaxy_id: "g-1",
      branch_id: "br-1",
    });
  });

  it("builds civilization mutate payload with only a subset of fields", () => {
    const payload = buildCivilizationMutatePayload({
      label: "Only Label",
      expectedEventSeq: 0,
    });
    expect(payload).toEqual({
      label: "Only Label",
      expected_event_seq: 0,
    });
  });

  it("builds mineral mutate payload for update", () => {
    const payload = buildCivilizationMineralMutatePayload({
      typedValue: "some_value",
      expectedEventSeq: 5,
      idempotencyKey: "key-2",
      galaxyId: "g-1",
    });
    expect(payload).toEqual({
      typed_value: "some_value",
      expected_event_seq: 5,
      idempotency_key: "key-2",
      galaxy_id: "g-1",
    });
  });

  it("builds mineral mutate payload for removal", () => {
    const payload = buildCivilizationMineralMutatePayload({ remove: true, expectedEventSeq: 6 });
    expect(payload).toEqual({ remove: true, expected_event_seq: 6 });
  });
});

describe("api error helpers", () => {
  it("normalizes OCC conflict payload", () => {
    const normalized = normalizeApiErrorPayload(
      {
        detail: {
          code: "OCC_CONFLICT",
          message: "OCC conflict for asteroid mutate",
          context: "asteroid mutate",
          expected_event_seq: 2,
          current_event_seq: 3,
        },
      },
      { status: 409, fallbackMessage: "Mutate failed" }
    );
    expect(normalized.status).toBe(409);
    expect(normalized.code).toBe("OCC_CONFLICT");
    expect(normalized.message).toContain("OCC conflict");
  });

  it("creates ApiError from response and detects OCC conflict", async () => {
    const response = new Response(
      JSON.stringify({
        detail: {
          code: "OCC_CONFLICT",
          message: "OCC conflict for source link",
          context: "source link",
          expected_event_seq: 5,
          current_event_seq: 7,
        },
      }),
      { status: 409, headers: { "Content-Type": "application/json" } }
    );
    const error = await apiErrorFromResponse(response, "Link failed");
    expect(error.name).toBe("ApiError");
    expect(error.status).toBe(409);
    expect(isOccConflictError(error)).toBe(true);
    expect(buildOccConflictMessage(error, "vytvoreni vazby")).toContain("Data byla obnovena");
  });
});

describe("bond semantics helpers", () => {
  it("normalizes aliases to canonical bond type", () => {
    expect(normalizeBondType("formula")).toBe("FLOW");
    expect(normalizeBondType(" rel ")).toBe("RELATION");
    expect(normalizeBondType("guardian")).toBe("GUARDIAN");
  });

  it("returns directional flags for normalized bond type", () => {
    expect(bondSemanticsFromType("RELATION")).toEqual({
      type: "RELATION",
      directional: false,
      flow_direction: "bidirectional",
    });
    expect(bondSemanticsFromType("FLOW")).toEqual({
      type: "FLOW",
      directional: true,
      flow_direction: "source_to_target",
    });
  });
});
