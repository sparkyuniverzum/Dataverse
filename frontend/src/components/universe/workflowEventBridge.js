function makeEventId(prefix) {
  const safePrefix = String(prefix || "runtime")
    .trim()
    .toLowerCase();
  return `${safePrefix}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

export function createRuntimeWorkflowEvent({ action = "RUNTIME", message = "", tone = "info", meta = null } = {}) {
  const normalizedMessage = String(message || "").trim();
  if (!normalizedMessage) return null;
  return {
    id: makeEventId(action),
    action: String(action || "RUNTIME")
      .trim()
      .toUpperCase(),
    message: normalizedMessage,
    tone: String(tone || "info")
      .trim()
      .toLowerCase(),
    at: Date.now(),
    source: "RUNTIME",
    meta: meta && typeof meta === "object" ? meta : null,
  };
}

export function buildMoonImpactLoadEvent({ planetLabel = "" } = {}) {
  return createRuntimeWorkflowEvent({
    action: "MOON_IMPACT_LOAD",
    message: `Moon impact nacitam pro planetu ${String(planetLabel || "n/a")}.`,
    tone: "info",
  });
}

export function buildMoonImpactReadyEvent({ planetLabel = "", payload = null } = {}) {
  const items = Array.isArray(payload?.items) ? payload.items : [];
  const rulesCount = items.length;
  const violations = items.reduce((sum, item) => sum + (Number(item?.active_violations_count || 0) || 0), 0);
  return createRuntimeWorkflowEvent({
    action: "MOON_IMPACT_READY",
    message: `Moon impact ready pro ${String(planetLabel || "n/a")}: rules ${rulesCount}, violations ${violations}.`,
    tone: violations > 0 ? "warn" : "ok",
    meta: { rulesCount, violations },
  });
}

export function buildMoonImpactErrorEvent({ planetLabel = "", errorMessage = "" } = {}) {
  return createRuntimeWorkflowEvent({
    action: "MOON_IMPACT_ERROR",
    message: `Moon impact error pro ${String(planetLabel || "n/a")}: ${String(errorMessage || "n/a")}.`,
    tone: "error",
  });
}

export function buildGuidedRepairSuggestedEvent({ suggestion = null } = {}) {
  const repairId = String(suggestion?.repair_id || suggestion?.id || "").trim();
  const strategy = String(suggestion?.strategy_key || "n/a").trim();
  const mineral = String(suggestion?.mineral_key || "n/a").trim();
  return createRuntimeWorkflowEvent({
    action: "REPAIR_SUGGESTED",
    message: `Guided repair navrzen: ${mineral} (${strategy})${repairId ? ` #${repairId}` : ""}.`,
    tone: "warn",
    meta: { repairId, strategy, mineral },
  });
}

export function buildGuidedRepairApplyOkEvent({ suggestion = null } = {}) {
  const repairId = String(suggestion?.repair_id || suggestion?.id || "").trim();
  const strategy = String(suggestion?.strategy_key || "n/a").trim();
  return createRuntimeWorkflowEvent({
    action: "REPAIR_APPLY_OK",
    message: `Guided repair aplikovan (${strategy})${repairId ? ` #${repairId}` : ""}.`,
    tone: "ok",
    meta: { repairId, strategy },
  });
}

export function buildGuidedRepairApplyFailEvent({ suggestion = null, errorMessage = "" } = {}) {
  const repairId = String(suggestion?.repair_id || suggestion?.id || "").trim();
  const strategy = String(suggestion?.strategy_key || "n/a").trim();
  return createRuntimeWorkflowEvent({
    action: "REPAIR_APPLY_FAIL",
    message: `Guided repair selhal (${strategy})${repairId ? ` #${repairId}` : ""}: ${String(errorMessage || "n/a")}.`,
    tone: "error",
    meta: { repairId, strategy },
  });
}
