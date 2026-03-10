const ACTION_KEYS = Object.freeze({
  LINK: "link",
  INGEST: "ingest",
  EXTINGUISH: "extinguish",
  OTHER: "other",
});

export const EMPTY_PARSER_TELEMETRY = Object.freeze({
  attempts: 0,
  parser_success: 0,
  parser_failed: 0,
  fallback_used: 0,
  fallback_success: 0,
  fallback_failed: 0,
  by_action: Object.freeze({
    link: 0,
    ingest: 0,
    extinguish: 0,
    other: 0,
  }),
  by_route_family: Object.freeze({
    canonical: 0,
    alias: 0,
    parser: 0,
    unknown: 0,
  }),
  last_error: "",
  last_error_at: null,
});

function toNonNegativeInt(value, fallback = 0) {
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) return fallback;
  return Math.max(0, Math.floor(parsed));
}

function normalizeActionKey(rawAction) {
  const normalized = String(rawAction || "")
    .trim()
    .toUpperCase();
  if (normalized === "LINK") return ACTION_KEYS.LINK;
  if (normalized === "INGEST") return ACTION_KEYS.INGEST;
  if (normalized === "EXTINGUISH") return ACTION_KEYS.EXTINGUISH;
  return ACTION_KEYS.OTHER;
}

function normalizeRouteFamily(rawRouteFamily) {
  const normalized = String(rawRouteFamily || "")
    .trim()
    .toLowerCase();
  if (normalized === "canonical") return "canonical";
  if (normalized === "alias") return "alias";
  if (normalized === "parser") return "parser";
  return "unknown";
}

export function createParserTelemetrySnapshot(raw = EMPTY_PARSER_TELEMETRY) {
  const source = raw && typeof raw === "object" ? raw : EMPTY_PARSER_TELEMETRY;
  const byActionSource = source.by_action && typeof source.by_action === "object" ? source.by_action : {};
  const byRouteFamilySource =
    source.by_route_family && typeof source.by_route_family === "object" ? source.by_route_family : {};
  const byAction = {
    link: toNonNegativeInt(byActionSource.link),
    ingest: toNonNegativeInt(byActionSource.ingest),
    extinguish: toNonNegativeInt(byActionSource.extinguish),
    other: toNonNegativeInt(byActionSource.other),
  };
  const byRouteFamily = {
    canonical: toNonNegativeInt(byRouteFamilySource.canonical),
    alias: toNonNegativeInt(byRouteFamilySource.alias),
    parser: toNonNegativeInt(byRouteFamilySource.parser),
    unknown: toNonNegativeInt(byRouteFamilySource.unknown),
  };

  return {
    attempts: toNonNegativeInt(source.attempts),
    parser_success: toNonNegativeInt(source.parser_success),
    parser_failed: toNonNegativeInt(source.parser_failed),
    fallback_used: toNonNegativeInt(source.fallback_used),
    fallback_success: toNonNegativeInt(source.fallback_success),
    fallback_failed: toNonNegativeInt(source.fallback_failed),
    by_action: byAction,
    by_route_family: byRouteFamily,
    last_error: String(source.last_error || "").trim(),
    last_error_at:
      typeof source.last_error_at === "string" && source.last_error_at.trim() ? source.last_error_at : null,
  };
}

export function recordParserTelemetry(
  current,
  {
    action = "OTHER",
    parserOk = false,
    parserError = null,
    fallbackUsed = false,
    fallbackOk = null,
    routeFamily = "unknown",
  } = {}
) {
  const snapshot = createParserTelemetrySnapshot(current);
  const actionKey = normalizeActionKey(action);
  const routeFamilyKey = normalizeRouteFamily(routeFamily);
  const next = {
    ...snapshot,
    by_action: { ...snapshot.by_action },
    by_route_family: { ...snapshot.by_route_family },
    attempts: snapshot.attempts + 1,
  };

  next.by_action[actionKey] = toNonNegativeInt(next.by_action[actionKey]) + 1;
  next.by_route_family[routeFamilyKey] = toNonNegativeInt(next.by_route_family[routeFamilyKey]) + 1;
  if (parserOk) {
    next.parser_success += 1;
    return next;
  }

  next.parser_failed += 1;
  if (parserError) {
    next.last_error = String(parserError?.message || parserError).trim();
    next.last_error_at = new Date().toISOString();
  }

  if (fallbackUsed) {
    next.fallback_used += 1;
    if (fallbackOk === true) next.fallback_success += 1;
    if (fallbackOk === false) next.fallback_failed += 1;
  }

  return next;
}
