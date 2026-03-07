import { describe, expect, it } from "vitest";

import { computeBounds, resolveCameraTarget, resolveControlDistanceLimits } from "./cameraPilotMath";

describe("cameraPilotMath", () => {
  it("returns default bounds for empty input", () => {
    const bounds = computeBounds([]);
    expect(bounds.center).toEqual([0, 0, 0]);
    expect(bounds.radius).toBe(140);
  });

  it("computes deterministic bounds for positions", () => {
    const bounds = computeBounds([
      [10, 0, -10],
      [30, 40, 20],
      [-10, 15, 5],
    ]);
    expect(bounds.center).toEqual([10, 20, 5]);
    expect(bounds.radius).toBe(80);
  });

  it("returns null target while selection is unresolved", () => {
    const target = resolveCameraTarget({
      unresolvedSelection: true,
      selectedTableNode: { position: [10, 0, 0], radius: 20 },
    });
    expect(target).toBeNull();
  });

  it("uses star dive target when active", () => {
    const target = resolveCameraTarget({
      starDiveActive: true,
      selectedTableNode: { position: [10, 0, 0], radius: 20 },
    });
    expect(target).toEqual({
      center: [0, 0, 0],
      distance: 20,
    });
  });

  it("applies focus offset for selected planet target", () => {
    const target = resolveCameraTarget({
      selectedTableNode: { position: [100, 20, 8], radius: 10 },
      focusOffset: [12, -5, 4],
    });
    expect(target).toEqual({
      center: [112, 15, 12],
      distance: 228,
    });
  });

  it("falls back to workspace bounds when nothing is selected", () => {
    const target = resolveCameraTarget({
      fallback: { center: [12, 7, -6], radius: 90 },
    });
    expect(target?.center).toEqual([12, 7, -6]);
    expect(target?.distance).toBeCloseTo(252, 6);
  });

  it("resolves strict star dive control limits", () => {
    const limits = resolveControlDistanceLimits({
      starDiveActive: true,
      targetDistance: 600,
      cameraState: { minDistance: 88, maxDistance: 999 },
    });
    expect(limits).toEqual({
      minDistance: 4,
      maxDistance: 96,
    });
  });

  it("resolves bounded default control limits", () => {
    const limits = resolveControlDistanceLimits({
      targetDistance: 200,
      cameraState: { minDistance: 12, maxDistance: 450 },
    });
    expect(limits).toEqual({
      minDistance: 44,
      maxDistance: 1400,
    });
  });
});
