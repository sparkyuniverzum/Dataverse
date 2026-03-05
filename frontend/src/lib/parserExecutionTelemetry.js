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
  last_error: "",
  last_error_at: null,
});

function toNonNegativeInt(value, fallback = 0) {
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) return fallback;
  return Math.max(0, Math.floor(parsed));
}

function normalizeActionKey(rawAction) {
  const normalized = String(rawAction || "").trim().toUpperCase();
  if (normalized === "LINK") return ACTION_KEYS.LINK;
  if (normalized === "INGEST") return ACTION_KEYS.INGEST;
  if (normalized === "EXTINGUISH") return ACTION_KEYS.EXTINGUISH;
  return ACTION_KEYS.OTHER;
}

export function createParserTelemetrySnapshot(raw = EMPTY_PARSER_TELEMETRY) {
  const source = raw && typeof raw === "object" ? raw : EMPTY_PARSER_TELEMETRY;
  const byActionSource = source.by_action && typeof source.by_action === "object" ? source.by_action : {};
  const byAction = {
    link: toNonNegativeInt(byActionSource.link),
    ingest: toNonNegativeInt(byActionSource.ingest),
    extinguish: toNonNegativeInt(byActionSource.extinguish),
    other: toNonNegativeInt(byActionSource.other),
  };

  return {
    attempts: toNonNegativeInt(source.attempts),
    parser_success: toNonNegativeInt(source.parser_success),
    parser_failed: toNonNegativeInt(source.parser_failed),
    fallback_used: toNonNegativeInt(source.fallback_used),
    fallback_success: toNonNegativeInt(source.fallback_success),
    fallback_failed: toNonNegativeInt(source.fallback_failed),
    by_action: byAction,
    last_error: String(source.last_error || "").trim(),
    last_error_at: typeof source.last_error_at === "string" && source.last_error_at.trim() ? source.last_error_at : null,
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
  } = {}
) {
  const snapshot = createParserTelemetrySnapshot(current);
  const actionKey = normalizeActionKey(action);
  const next = {
    ...snapshot,
    by_action: { ...snapshot.by_action },
    attempts: snapshot.attempts + 1,
  };

  next.by_action[actionKey] = toNonNegativeInt(next.by_action[actionKey]) + 1;
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

