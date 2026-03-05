import { describe, expect, it } from "vitest";

import { buildStageZeroPlanetName, mapDropPointToPlanetPosition } from "./stageZeroUtils";

describe("stage zero utils", () => {
  it("builds deterministic planet name", () => {
    expect(buildStageZeroPlanetName({ existingCount: 0 })).toBe("Core > Planeta-1");
    expect(buildStageZeroPlanetName({ existingCount: 3, suffix: "abc-123" })).toBe("Core > Planeta-4-abc-123");
  });

  it("maps drop point to bounded visual position", () => {
    const position = mapDropPointToPlanetPosition({ x: 200, y: 100 }, { left: 0, top: 0, width: 400, height: 200 });
    expect(position).toEqual({ x: 0, y: 0, z: 0 });
  });

  it("clamps out-of-viewport points", () => {
    const position = mapDropPointToPlanetPosition({ x: -50, y: 1200 }, { left: 10, top: 20, width: 100, height: 100 });
    expect(position.x).toBe(-210);
    expect(position.y).toBe(-120);
    expect(position.z).toBe(0);
  });
});

