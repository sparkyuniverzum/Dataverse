export function normalizeLifecycleStateFromRow(row) {
  if (!row || typeof row !== "object") return "UNKNOWN";
  const archived = row.is_deleted === true;
  const raw = String(
    row.state || row.metadata?.state || row.metadata?.status || (archived ? "ARCHIVED" : "ACTIVE")
  ).trim();
  const normalized = raw.toUpperCase();
  if (!normalized) return archived ? "ARCHIVED" : "UNKNOWN";
  return normalized;
}

export function canTransitionLifecycle(fromState, toState) {
  const from = String(fromState || "UNKNOWN").toUpperCase();
  const to = String(toState || "").toUpperCase();
  if (!to || from === to) return false;
  const allowed = {
    DRAFT: new Set(["ACTIVE", "ARCHIVED"]),
    ACTIVE: new Set(["ARCHIVED"]),
    ANOMALY: new Set(["ACTIVE", "ARCHIVED"]),
    UNKNOWN: new Set(["ACTIVE", "ARCHIVED"]),
    ARCHIVED: new Set([]),
  };
  return Boolean(allowed[from]?.has(to));
}

export function explainLifecycleGuard({ row, targetState, operation = "transition" }) {
  const fromState = normalizeLifecycleStateFromRow(row);
  const target = String(targetState || "").toUpperCase();
  if (operation === "mutate" && fromState === "ARCHIVED") {
    return {
      allowed: false,
      reason: "archived_readonly",
      message: "Archivovana civilizace je read-only. Nejdriv ji aktivuj lifecycle transition.",
      fromState,
      targetState: target || null,
    };
  }
  if (operation === "archive") {
    if (fromState === "ARCHIVED") {
      return {
        allowed: false,
        reason: "already_archived",
        message: "Civilizace uz je archivovana.",
        fromState,
        targetState: "ARCHIVED",
      };
    }
    return {
      allowed: true,
      reason: "ok",
      message: "",
      fromState,
      targetState: "ARCHIVED",
    };
  }
  if (operation === "transition") {
    const allowed = canTransitionLifecycle(fromState, target);
    return {
      allowed,
      reason: allowed ? "ok" : "invalid_transition",
      message: allowed ? "" : `Lifecycle transition ${fromState} -> ${target} neni povolena.`,
      fromState,
      targetState: target || null,
    };
  }
  return {
    allowed: true,
    reason: "ok",
    message: "",
    fromState,
    targetState: target || null,
  };
}
