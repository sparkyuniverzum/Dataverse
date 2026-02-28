import { describe, expect, it } from "vitest";

import { buildParserPayload, buildSnapshotUrl, normalizeSnapshot, toAsOfIso } from "./dataverseApi";

describe("buildParserPayload", () => {
  it("builds unified payload for parser contract", () => {
    expect(buildParserPayload("  Pavel + Audi  ")).toEqual({
      query: "Pavel + Audi",
      text: "Pavel + Audi"
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

    const url = buildSnapshotUrl("http://127.0.0.1:8000", iso);
    expect(url).toContain("/universe/snapshot");
    expect(url).toContain("as_of=");
  });
});
