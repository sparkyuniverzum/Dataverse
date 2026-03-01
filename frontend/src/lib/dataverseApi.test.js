import { describe, expect, it } from "vitest";

import {
  buildGalaxyEventsStreamUrl,
  buildImportJobErrorsUrl,
  buildImportJobUrl,
  buildImportRunUrl,
  buildParserPayload,
  buildSnapshotExportUrl,
  buildSnapshotUrl,
  buildTablesExportUrl,
  normalizeSnapshot,
  toAsOfIso,
} from "./dataverseApi";

describe("buildParserPayload", () => {
  it("builds unified payload for parser contract", () => {
    expect(buildParserPayload("  Pavel + Audi  ")).toEqual({
      query: "Pavel + Audi",
      text: "Pavel + Audi"
    });
  });

  it("includes branch_id when provided", () => {
    expect(buildParserPayload("A + B", "g-1", "br-1")).toEqual({
      query: "A + B",
      text: "A + B",
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
});
