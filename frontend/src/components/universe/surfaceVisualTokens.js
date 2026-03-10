export const SURFACE_TONE = Object.freeze({
  PROMOTE: "promote",
  GOVERNANCE: "governance",
  RECOVERY: "recovery",
});

const TONE_MAP = Object.freeze({
  [SURFACE_TONE.PROMOTE]: {
    panelBorder: "1px solid rgba(255, 204, 138, 0.34)",
    panelBackground:
      "linear-gradient(180deg, rgba(15, 19, 33, 0.94), rgba(9, 15, 28, 0.98)), radial-gradient(circle at top right, rgba(255, 176, 86, 0.24), transparent 42%)",
    panelColor: "#fff2de",
    panelShadow: "0 28px 80px rgba(0, 0, 0, 0.46), 0 0 42px rgba(255, 166, 77, 0.22)",
    ghostBorder: "1px solid rgba(255, 211, 167, 0.22)",
    ghostBackground: "rgba(20, 26, 39, 0.92)",
    ghostColor: "#fff4e3",
    primaryBorder: "1px solid rgba(255, 208, 124, 0.5)",
    primaryBackground: "linear-gradient(120deg, #ffb45f, #ffe09d)",
    primaryColor: "#352008",
  },
  [SURFACE_TONE.GOVERNANCE]: {
    panelBorder: "1px solid rgba(120, 208, 244, 0.34)",
    panelBackground: "linear-gradient(170deg, rgba(8, 18, 34, 0.92), rgba(4, 9, 18, 0.9))",
    panelColor: "#def7ff",
    panelShadow: "0 0 36px rgba(22, 116, 164, 0.34)",
    ghostBorder: "1px solid rgba(122, 191, 221, 0.28)",
    ghostBackground: "rgba(7, 16, 31, 0.92)",
    ghostColor: "#d6f4ff",
    primaryBorder: "1px solid rgba(114, 219, 252, 0.48)",
    primaryBackground: "linear-gradient(120deg, #36bde8, #7ee4ff)",
    primaryColor: "#07263b",
  },
  [SURFACE_TONE.RECOVERY]: {
    panelBorder: "1px solid rgba(255, 169, 196, 0.28)",
    panelBackground:
      "linear-gradient(180deg, rgba(28, 13, 26, 0.95), rgba(12, 10, 21, 0.98)), radial-gradient(circle at top right, rgba(255, 122, 172, 0.18), transparent 44%)",
    panelColor: "#ffe7f0",
    panelShadow: "0 28px 80px rgba(0, 0, 0, 0.48), 0 0 42px rgba(255, 121, 177, 0.16)",
    ghostBorder: "1px solid rgba(255, 204, 226, 0.22)",
    ghostBackground: "rgba(28, 18, 33, 0.92)",
    ghostColor: "#ffe7f0",
    primaryBorder: "1px solid rgba(255, 175, 203, 0.5)",
    primaryBackground: "linear-gradient(120deg, #ff8eb7, #ffd0e1)",
    primaryColor: "#3d1227",
  },
});

function resolveTone(tone) {
  return TONE_MAP[tone] || TONE_MAP[SURFACE_TONE.GOVERNANCE];
}

export function createFloatingDrawerStyle(tone) {
  const token = resolveTone(tone);
  return {
    position: "fixed",
    top: 18,
    right: 18,
    zIndex: 64,
    width: "min(420px, calc(100vw - 24px))",
    borderRadius: 18,
    border: token.panelBorder,
    background: token.panelBackground,
    color: token.panelColor,
    boxShadow: token.panelShadow,
    backdropFilter: "blur(18px)",
    padding: 16,
    display: "grid",
    gap: 12,
  };
}

export function createGhostButtonStyle(tone, overrides = {}) {
  const token = resolveTone(tone);
  return {
    border: token.ghostBorder,
    background: token.ghostBackground,
    color: token.ghostColor,
    borderRadius: 10,
    padding: "9px 12px",
    cursor: "pointer",
    ...overrides,
  };
}

export function createPrimaryButtonStyle(tone, overrides = {}) {
  const token = resolveTone(tone);
  return {
    border: token.primaryBorder,
    background: token.primaryBackground,
    color: token.primaryColor,
    borderRadius: 10,
    padding: "9px 12px",
    fontWeight: 700,
    cursor: "pointer",
    ...overrides,
  };
}

export function createPanelCardStyle({ border, background, padding = "10px 11px", gap = 6 } = {}) {
  return {
    borderRadius: 12,
    border,
    background,
    padding,
    display: "grid",
    gap,
  };
}
