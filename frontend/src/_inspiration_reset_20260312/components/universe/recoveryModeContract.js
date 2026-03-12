function normalizeText(value) {
  return String(value || "").trim();
}

export function resolveRecoveryModeModel({
  runtimeError = "",
  runtimeConnectivity = null,
  repairSuggestion = null,
  repairApplyBusy = false,
  repairAuditCount = 0,
  open = false,
} = {}) {
  const error = normalizeText(runtimeError);
  const hasRuntimeError = Boolean(error);
  const connectivity = runtimeConnectivity && typeof runtimeConnectivity === "object" ? runtimeConnectivity : {};
  const connectivityMessage = normalizeText(connectivity.sidebarMessage);
  const connectivityBlocked = connectivity.writeBlocked === true;
  const suggestion = repairSuggestion && typeof repairSuggestion === "object" ? repairSuggestion : null;
  const hasRepairSuggestion = Boolean(suggestion?.civilization_id && suggestion?.mineral_key);
  const hasAttention = Boolean(error || connectivityBlocked || hasRepairSuggestion || repairApplyBusy);

  return {
    open: Boolean(open),
    hasAttention,
    hasRuntimeError,
    hasConnectivityIssue: connectivityBlocked,
    hasRepairSuggestion,
    repairApplyBusy: Boolean(repairApplyBusy),
    canOpen: hasAttention,
    canClose: Boolean(open),
    cinematicMode: open ? "recovery_mode" : "default",
    title: hasRepairSuggestion ? "Recovery Mode: Guided Repair" : "Recovery Mode",
    summary: hasRuntimeError
      ? error
      : hasRepairSuggestion
        ? `Navrh opravy: ${suggestion.mineral_key} -> ${suggestion.suggested_raw_value}`
        : connectivityMessage || "Recovery mode je pripraven.",
    auditLabel: `repair audit ${Math.max(0, Number(repairAuditCount) || 0)}`,
    repairSuggestion: suggestion,
    connectivityMessage,
  };
}
