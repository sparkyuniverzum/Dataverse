import { describe, expect, it } from "vitest";

import {
  createCenteredShellLayout,
  createFloatingDrawerLayout,
  createHudRailLayout,
  createFullscreenOverlayLayout,
  SURFACE_LAYER,
  SURFACE_LAYOUT,
} from "./surfaceLayoutTokens";

describe("surfaceLayoutTokens", () => {
  it("creates a clamped hud rail layout with consistent sidebar layer", () => {
    expect(createHudRailLayout()).toEqual({
      position: "fixed",
      right: SURFACE_LAYOUT.hudInset,
      top: SURFACE_LAYOUT.hudInset,
      zIndex: SURFACE_LAYER.sidebar,
      width: "min(360px, calc(100vw - 24px))",
      maxHeight: "calc(100vh - 24px)",
      overflow: "auto",
    });
  });

  it("creates drawer and centered shell layouts from one layout scale", () => {
    expect(createFloatingDrawerLayout()).toEqual({
      position: "fixed",
      right: SURFACE_LAYOUT.drawerInset,
      top: SURFACE_LAYOUT.drawerInset,
      zIndex: SURFACE_LAYER.drawer,
      width: "min(420px, calc(100vw - 36px))",
      maxHeight: "calc(100vh - 36px)",
      overflow: "auto",
    });
    expect(createFullscreenOverlayLayout()).toMatchObject({
      position: "fixed",
      inset: 0,
      zIndex: SURFACE_LAYER.governanceOverlay,
      display: "grid",
      placeItems: "center",
    });
    expect(createCenteredShellLayout()).toEqual({
      width: "min(1180px, 100%)",
      maxHeight: "calc(100vh - 48px)",
      overflow: "auto",
    });
  });
});
