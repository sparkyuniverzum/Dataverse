import { describe, expect, it } from "vitest";

import { buildRuntimeNormalizationSignal } from "./runtimeNormalizationSignal";

describe("runtimeNormalizationSignal", () => {
  it("returns null for moderate snapshot payloads", () => {
    const signal = buildRuntimeNormalizationSignal(
      {
        asteroids: new Array(200).fill({}),
        bonds: new Array(300).fill({}),
      },
      { scopeKey: "g-1:main" }
    );

    expect(signal).toBeNull();
  });

  it("returns operator-readable signal for heavy snapshot payloads", () => {
    const signal = buildRuntimeNormalizationSignal(
      {
        asteroids: new Array(3200).fill({}),
        bonds: new Array(5400).fill({}),
      },
      { scopeKey: "g-1:main" }
    );

    expect(signal).toMatchObject({
      event: "runtime",
      eventType: "PERF_SIGNAL",
      code: "HEAVY_SNAPSHOT_NORMALIZATION",
    });
    expect(signal.message).toContain("Heavy snapshot normalization payload detected");
    expect(signal.message).toContain("asteroids=3200");
    expect(signal.message).toContain("bonds=5400");
  });
});
