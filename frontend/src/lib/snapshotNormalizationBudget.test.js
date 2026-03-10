import { describe, expect, it } from "vitest";

import {
  estimateSnapshotNormalizationLoad,
  evaluateSnapshotNormalizationBudget,
  SNAPSHOT_NORMALIZATION_BASELINE,
} from "./snapshotNormalizationBudget";

describe("snapshotNormalizationBudget", () => {
  it("estimates asteroid and bond counts across aliases", () => {
    const estimate = estimateSnapshotNormalizationLoad({
      civilizations: [{ id: "c-1" }, { id: "c-2" }],
      relations: [{ id: "r-1" }],
    });

    expect(estimate).toEqual({
      asteroids: 2,
      bonds: 1,
      entities: 3,
    });
  });

  it("passes baseline for moderate snapshot size", () => {
    const result = evaluateSnapshotNormalizationBudget({
      asteroids: new Array(1200).fill({}),
      bonds: new Array(1400).fill({}),
    });

    expect(result.pass).toBe(true);
    expect(result.limits.maxEntities).toBe(SNAPSHOT_NORMALIZATION_BASELINE.maxEntities);
  });

  it("returns explicit violations for oversized payloads", () => {
    const result = evaluateSnapshotNormalizationBudget({
      asteroids: new Array(3200).fill({}),
      bonds: new Array(5400).fill({}),
    });

    expect(result.pass).toBe(false);
    expect(result.violations.some((entry) => entry.startsWith("asteroids:"))).toBe(true);
    expect(result.violations.some((entry) => entry.startsWith("bonds:"))).toBe(true);
    expect(result.violations.some((entry) => entry.startsWith("entities:"))).toBe(true);
  });
});
