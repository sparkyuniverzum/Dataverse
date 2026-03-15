export const SURFACE_LAYOUT = Object.freeze({
  hudInset: 12,
  drawerInset: 18,
  railWidth: "360px",
  drawerWidth: "420px",
  centeredShellWidth: "1180px",
});

export const SURFACE_LAYER = Object.freeze({
  missionPanel: 58,
  blueprintPanel: 59,
  overlayGate: 60,
  banner: 61,
  commandBar: 62,
  sidebar: 63,
  drawer: 64,
  governanceOverlay: 84,
});

function createViewportClamp(inset) {
  return `calc(100vw - ${inset * 2}px)`;
}

export function createHudRailLayout({
  side = "right",
  inset = SURFACE_LAYOUT.hudInset,
  top = SURFACE_LAYOUT.hudInset,
  width = SURFACE_LAYOUT.railWidth,
  zIndex = SURFACE_LAYER.sidebar,
} = {}) {
  return {
    position: "fixed",
    [side]: inset,
    top,
    zIndex,
    width: `min(${width}, ${createViewportClamp(inset)})`,
    maxHeight: `calc(100vh - ${top + inset}px)`,
    overflow: "auto",
  };
}

export function createFloatingDrawerLayout({
  side = "right",
  inset = SURFACE_LAYOUT.drawerInset,
  top = SURFACE_LAYOUT.drawerInset,
  width = SURFACE_LAYOUT.drawerWidth,
  zIndex = SURFACE_LAYER.drawer,
} = {}) {
  return {
    position: "fixed",
    [side]: inset,
    top,
    zIndex,
    width: `min(${width}, ${createViewportClamp(inset)})`,
    maxHeight: `calc(100vh - ${top + inset}px)`,
    overflow: "auto",
  };
}

export function createFullscreenOverlayLayout({
  zIndex = SURFACE_LAYER.governanceOverlay,
  padding = "24px 16px",
} = {}) {
  return {
    position: "fixed",
    inset: 0,
    zIndex,
    display: "grid",
    placeItems: "center",
    padding,
  };
}

export function createCenteredShellLayout({ width = SURFACE_LAYOUT.centeredShellWidth, viewportPadding = 48 } = {}) {
  return {
    width: `min(${width}, 100%)`,
    maxHeight: `calc(100vh - ${viewportPadding}px)`,
    overflow: "auto",
  };
}
