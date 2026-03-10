import { describe, expect, it } from "vitest";

import {
  createFloatingDrawerStyle,
  createGhostButtonStyle,
  createPrimaryButtonStyle,
  SURFACE_TONE,
} from "./surfaceVisualTokens";

describe("surfaceVisualTokens", () => {
  it("builds distinct floating drawer styles per tone", () => {
    const promote = createFloatingDrawerStyle(SURFACE_TONE.PROMOTE);
    const recovery = createFloatingDrawerStyle(SURFACE_TONE.RECOVERY);

    expect(promote.background).not.toBe(recovery.background);
    expect(promote.border).not.toBe(recovery.border);
  });

  it("builds button variants from tone tokens", () => {
    const ghost = createGhostButtonStyle(SURFACE_TONE.GOVERNANCE);
    const primary = createPrimaryButtonStyle(SURFACE_TONE.GOVERNANCE);

    expect(ghost.background).toContain("rgba");
    expect(primary.background).toContain("linear-gradient");
  });
});
