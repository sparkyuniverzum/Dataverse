export const PREVIEW_BASE_BACKGROUND_COLOR = "#050d18";

export const PREVIEW_SEVERITY_COLOR_MAP = Object.freeze({
  info: "#b9f4ff",
  success: "#b8ffd8",
  warn: "#ffd7a5",
  critical: "#ffb8c8",
});

function toText(value, fallback = "") {
  const normalized = String(value ?? "").trim();
  return normalized || fallback;
}

function normalizeHex(hex) {
  const raw = toText(hex);
  if (!raw) return "";
  if (/^#[0-9a-f]{6}$/i.test(raw)) return raw.toLowerCase();
  if (/^#[0-9a-f]{3}$/i.test(raw)) {
    const r = raw[1];
    const g = raw[2];
    const b = raw[3];
    return `#${r}${r}${g}${g}${b}${b}`.toLowerCase();
  }
  return "";
}

function hexToRgb(hex) {
  const normalized = normalizeHex(hex);
  if (!normalized) return null;
  const r = Number.parseInt(normalized.slice(1, 3), 16);
  const g = Number.parseInt(normalized.slice(3, 5), 16);
  const b = Number.parseInt(normalized.slice(5, 7), 16);
  if (![r, g, b].every(Number.isFinite)) return null;
  return { r, g, b };
}

function srgbToLinear(channel) {
  const value = channel / 255;
  if (value <= 0.03928) return value / 12.92;
  return ((value + 0.055) / 1.055) ** 2.4;
}

function relativeLuminance(rgb) {
  if (!rgb) return 0;
  const r = srgbToLinear(rgb.r);
  const g = srgbToLinear(rgb.g);
  const b = srgbToLinear(rgb.b);
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

function normalizeSeverity(value) {
  const normalized = toText(value, "info").toLowerCase();
  if (normalized in PREVIEW_SEVERITY_COLOR_MAP) return normalized;
  return "info";
}

function resolveMediaQuery(matchMediaFn) {
  if (typeof matchMediaFn === "function") return matchMediaFn;
  if (typeof window !== "undefined" && typeof window.matchMedia === "function") return window.matchMedia.bind(window);
  return null;
}

function isInteractiveTarget(target) {
  if (!target || typeof target !== "object") return false;
  const tagName = toText(target.tagName).toUpperCase();
  if (["INPUT", "TEXTAREA", "SELECT", "OPTION", "BUTTON"].includes(tagName)) return true;
  if (target.isContentEditable) return true;
  return false;
}

export function resolvePreviewSeverityColor(severity) {
  return PREVIEW_SEVERITY_COLOR_MAP[normalizeSeverity(severity)] || PREVIEW_SEVERITY_COLOR_MAP.info;
}

export function contrastRatio(foregroundHex, backgroundHex = PREVIEW_BASE_BACKGROUND_COLOR) {
  const fg = hexToRgb(foregroundHex);
  const bg = hexToRgb(backgroundHex);
  if (!fg || !bg) return 1;
  const l1 = relativeLuminance(fg);
  const l2 = relativeLuminance(bg);
  const lighter = Math.max(l1, l2);
  const darker = Math.min(l1, l2);
  return (lighter + 0.05) / (darker + 0.05);
}

export function buildPreviewContrastReport({ background = PREVIEW_BASE_BACKGROUND_COLOR, minRatio = 4.5 } = {}) {
  const entries = Object.keys(PREVIEW_SEVERITY_COLOR_MAP).map((severity) => {
    const color = resolvePreviewSeverityColor(severity);
    const ratio = contrastRatio(color, background);
    return {
      severity,
      color,
      ratio,
      pass: ratio >= minRatio,
    };
  });
  const pass = entries.every((item) => item.pass);
  return {
    background,
    minRatio,
    pass,
    entries,
  };
}

export function readReducedMotionPreference({ matchMediaFn } = {}) {
  const query = resolveMediaQuery(matchMediaFn);
  if (!query) return false;
  try {
    return Boolean(query("(prefers-reduced-motion: reduce)")?.matches);
  } catch {
    return false;
  }
}

export function observeReducedMotionPreference(onChange, { matchMediaFn } = {}) {
  const queryFn = resolveMediaQuery(matchMediaFn);
  if (typeof onChange !== "function" || !queryFn) {
    return () => {};
  }
  let mediaQueryList;
  try {
    mediaQueryList = queryFn("(prefers-reduced-motion: reduce)");
  } catch {
    return () => {};
  }
  if (!mediaQueryList) {
    return () => {};
  }

  const notify = () => onChange(Boolean(mediaQueryList.matches));
  notify();

  if (typeof mediaQueryList.addEventListener === "function") {
    mediaQueryList.addEventListener("change", notify);
    return () => mediaQueryList.removeEventListener("change", notify);
  }

  if (typeof mediaQueryList.addListener === "function") {
    mediaQueryList.addListener(notify);
    return () => mediaQueryList.removeListener(notify);
  }

  return () => {};
}

export function resolveWorkspaceKeyboardAction(eventLike, context = {}) {
  const key = toText(eventLike?.key).toLowerCase();
  if (!key) return "";
  if (eventLike?.metaKey || eventLike?.ctrlKey || eventLike?.altKey) return "";
  if (isInteractiveTarget(eventLike?.target)) return "";

  const canOpenGrid = Boolean(context?.canOpenGrid);
  const canOpenStarHeart = Boolean(context?.canOpenStarHeart);
  const quickGridOpen = Boolean(context?.quickGridOpen);
  const starHeartOpen = Boolean(context?.starHeartOpen);
  const stageZeroSetupOpen = Boolean(context?.stageZeroSetupOpen);

  if (key === "escape") {
    if (quickGridOpen) return "close_quick_grid";
    if (starHeartOpen) return "close_star_heart";
    if (stageZeroSetupOpen) return "close_stage_zero_setup";
    return "";
  }
  if (key === "g") {
    if (!quickGridOpen && canOpenGrid) return "open_grid";
    return "";
  }
  if (key === "h") {
    if (!starHeartOpen && canOpenStarHeart) return "open_star_heart";
    return "";
  }
  return "";
}
