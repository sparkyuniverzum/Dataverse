function normalizeText(value) {
  return String(value || "").trim();
}

export function buildBranchTimelineSummary({ mode = "", promotedEventsCount = null, createdBranchId = "" } = {}) {
  const normalizedMode = normalizeText(mode).toLowerCase();
  if (normalizedMode === "promote") {
    const count = Number(promotedEventsCount);
    return Number.isFinite(count)
      ? `Branch byl promotnut (${Math.max(0, Math.floor(count))} eventů).`
      : "Branch byl promotnut do main timeline.";
  }
  if (normalizedMode === "create") {
    return normalizeText(createdBranchId) ? "Branch byl vytvořen a aktivován." : "Branch byl vytvořen.";
  }
  return "";
}

export function mapBackendStreamEventToTimelineEntry(eventItem) {
  const id = normalizeText(eventItem?.id);
  if (!id) return null;
  const eventType = normalizeText(eventItem?.eventType || eventItem?.event || "UPDATE").toUpperCase();
  const code = normalizeText(eventItem?.code);
  const cursor =
    eventItem?.cursor === null || typeof eventItem?.cursor === "undefined" ? "n/a" : String(eventItem.cursor);
  const message = normalizeText(eventItem?.message);
  const summary = `[cursor ${cursor}] ${eventType}${code ? `/${code}` : ""}${message ? ` ${message}` : ""}`;
  const tone = code.includes("ERROR") ? "error" : code.includes("CONFLICT") ? "warn" : "info";
  return {
    id,
    action: "BE_STREAM",
    tone,
    message: summary,
    toast: false,
  };
}

export function mapRuntimeWorkflowEventToTimelineEntry(eventItem) {
  const id = normalizeText(eventItem?.id);
  const message = normalizeText(eventItem?.message);
  if (!id || !message) return null;
  return {
    id,
    action: normalizeText(eventItem?.action || "RUNTIME").toUpperCase(),
    tone: normalizeText(eventItem?.tone || "info").toLowerCase() || "info",
    message,
    toast: false,
  };
}

export function filterTimelineEntries(entries, { filter = "ALL", query = "" } = {}) {
  const normalizedFilter = normalizeText(filter).toUpperCase() || "ALL";
  const normalizedQuery = normalizeText(query).toLowerCase();
  const source = Array.isArray(entries) ? entries : [];
  return source.filter((item) => {
    const action = normalizeText(item?.action).toUpperCase();
    const tone = normalizeText(item?.tone).toLowerCase();
    const message = normalizeText(item?.message).toLowerCase();
    if (normalizedFilter === "BE_STREAM" && action !== "BE_STREAM") return false;
    if (normalizedFilter === "IMPACT_REPAIR" && !(action.startsWith("MOON_IMPACT") || action.startsWith("REPAIR_"))) {
      return false;
    }
    if (normalizedFilter === "UI" && action === "BE_STREAM") return false;
    if (normalizedFilter === "ERROR" && tone !== "error") return false;
    if (!normalizedQuery) return true;
    return action.toLowerCase().includes(normalizedQuery) || message.includes(normalizedQuery);
  });
}
