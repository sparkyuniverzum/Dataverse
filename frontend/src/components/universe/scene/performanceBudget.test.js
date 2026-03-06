import { describe, expect, it } from "vitest";

import {
  PREVIEW_PERFORMANCE_BASELINE,
  estimatePreviewWorkUnits,
  evaluatePreviewPerformanceBudget,
} from "./performanceBudget";

describe("performanceBudget", () => {
  it("keeps representative workspace load under baseline budget", () => {
    const result = evaluatePreviewPerformanceBudget({
      planetCount: 24,
      moonCount: 320,
      tableLinkCount: 56,
      moonLinkCount: 420,
      reducedMotion: false,
    });

    expect(result.pass).toBe(true);
    expect(result.estimate.estimatedFrameMs).toBeLessThanOrEqual(PREVIEW_PERFORMANCE_BASELINE.frameBudgetMs);
  });

  it("shows reduced-motion profile lowers estimated frame cost for high moon count", () => {
    const fullMotion = estimatePreviewWorkUnits({
      planetCount: 50,
      moonCount: 1000,
      tableLinkCount: 120,
      moonLinkCount: 1400,
      reducedMotion: false,
    });
    const reducedMotion = estimatePreviewWorkUnits({
      planetCount: 50,
      moonCount: 1000,
      tableLinkCount: 120,
      moonLinkCount: 1400,
      reducedMotion: true,
    });

    expect(reducedMotion.workUnits).toBeLessThan(fullMotion.workUnits);
    expect(reducedMotion.estimatedFrameMs).toBeLessThan(fullMotion.estimatedFrameMs);
  });

  it("fails budget with explicit violation reasons on overload", () => {
    const overloaded = evaluatePreviewPerformanceBudget(
      {
        planetCount: 320,
        moonCount: 4000,
        tableLinkCount: 1100,
        moonLinkCount: 5200,
        reducedMotion: false,
      },
      {
        observedFrameP95Ms: 58,
      }
    );

    expect(overloaded.pass).toBe(false);
    expect(overloaded.violations.some((entry) => entry.startsWith("nodes:"))).toBe(true);
    expect(overloaded.violations.some((entry) => entry.startsWith("links:"))).toBe(true);
    expect(overloaded.violations.some((entry) => entry.startsWith("estimated_frame_ms:"))).toBe(true);
    expect(overloaded.violations.some((entry) => entry.startsWith("observed_frame_p95_ms:"))).toBe(true);
  });
});
