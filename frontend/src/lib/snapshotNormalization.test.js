import { describe, expect, it } from "vitest";

import {
  normalizeSnapshotAsteroids,
  normalizeSnapshotBonds,
  normalizeSnapshotProjection,
} from "./snapshotNormalization";

describe("snapshotNormalization", () => {
  it("normalizes asteroid aliases into canonical projection rows", () => {
    const asteroids = normalizeSnapshotAsteroids({
      civilizations: [
        {
          civilization_id: "civ-1",
          label: "Modely",
          planet_id: "t-1",
          minerals: { amount: 42, state: "active" },
          is_deleted: false,
        },
      ],
    });

    expect(asteroids).toHaveLength(1);
    expect(asteroids[0]).toMatchObject({
      id: "civ-1",
      value: "Modely",
      table_id: "t-1",
      metadata: { amount: 42, state: "active" },
    });
  });

  it("filters bonds with missing or deleted endpoints", () => {
    const bonds = normalizeSnapshotBonds(
      {
        bonds: [
          { id: "b-1", source_id: "a-1", target_id: "a-2", is_deleted: false },
          { id: "b-2", source_id: "a-1", target_id: "a-3", is_deleted: false },
          { id: "b-3", source_id: "a-1", target_id: "a-2", is_deleted: true },
        ],
      },
      new Set(["a-1", "a-2"])
    );

    expect(bonds.map((item) => item.id)).toEqual(["b-1"]);
  });

  it("builds deterministic normalized projection", () => {
    const input = {
      asteroids: [
        { id: "a-1", value: "A", is_deleted: false },
        { id: "a-2", value: "B", is_deleted: true },
        { id: "a-3", value: "C", is_deleted: false },
      ],
      bonds: [
        { id: "b-1", source_id: "a-1", target_id: "a-3", is_deleted: false },
        { id: "b-2", source_id: "a-1", target_id: "a-2", is_deleted: false },
      ],
    };

    const first = normalizeSnapshotProjection(input);
    const second = normalizeSnapshotProjection({
      asteroids: [...input.asteroids],
      bonds: [...input.bonds],
    });
    expect(first).toEqual(second);
  });
});
