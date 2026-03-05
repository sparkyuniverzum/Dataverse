import { describe, expect, it } from "vitest";

import {
  apiErrorFromResponse,
  bondSemanticsFromType,
  buildOccConflictMessage,
  buildGalaxyEventsStreamUrl,
  buildStarCoreDomainMetricsUrl,
  buildStarCorePolicyLockUrl,
  buildStarCorePolicyUrl,
  buildStarCorePulseUrl,
  buildStarCoreRuntimeUrl,
  buildImportJobErrorsUrl,
  buildImportJobUrl,
  buildImportRunUrl,
  buildParserPayload,
  buildTableContractUrl,
  buildTaskBatchPayload,
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
        { id: "a3", value: "C", is_deleted: false }
      ],
      bonds: [
        { id: "b1", source_id: "a1", target_id: "a3", is_deleted: false },
        { id: "b2", source_id: "a1", target_id: "a2", is_deleted: false },
        { id: "b3", source_id: "a1", target_id: "a3", is_deleted: true }
      ]
    };

    const result = normalizeSnapshot(snapshot);
    expect(result.asteroids.map((asteroid) => asteroid.id)).toEqual(["a1", "a3"]);
    expect(result.bonds.map((bond) => bond.id)).toEqual(["b1"]);
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
  });
});

describe("io urls", () => {
  it("builds import and export URLs", () => {
    expect(buildImportRunUrl("http://127.0.0.1:8000")).toBe("http://127.0.0.1:8000/io/imports");
    expect(buildImportJobUrl("http://127.0.0.1:8000", "job-42")).toBe("http://127.0.0.1:8000/io/imports/job-42");
    expect(buildImportJobErrorsUrl("http://127.0.0.1:8000", "job-42")).toBe("http://127.0.0.1:8000/io/imports/job-42/errors");

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

    const tablesUrl = buildTablesExportUrl("http://127.0.0.1:8000", { galaxyId: "g-2", branchId: "br-2", format: "csv" });
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
