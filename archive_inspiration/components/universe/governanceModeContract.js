function normalizeText(value) {
  return String(value || "").trim();
}

export function resolveGovernanceModeModel({ phase = "", locked = false, error = "" } = {}) {
  const normalizedPhase = normalizeText(phase).toLowerCase();
  const isLocked = Boolean(locked);
  const hasError = Boolean(normalizeText(error));
  const open =
    normalizedPhase === "star_heart_dashboard_open" ||
    normalizedPhase === "apply_profile" ||
    normalizedPhase === "locked";
  const focusActive = normalizedPhase === "star_focused" || open;
  const mode = open ? "governance" : focusActive ? "governance_focus" : "workspace";

  return {
    open,
    focusActive,
    mode,
    cinematicMode: open ? "governance_mode" : focusActive ? "governance_focus" : "default",
    phase: normalizedPhase || "idle",
    locked: isLocked,
    hasError,
    launcherLabel: open ? "Governance mode otevren" : "Vstoupit do Star Core governance",
    summaryLabel: isLocked ? "Governance lock aktivni" : "Governance draft aktivni",
    canOpen: !open,
    canClose: open,
  };
}
