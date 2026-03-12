const DEFAULT_STREAM_DEDUPE_LIMIT = 512;

const PROJECTION_EVENT_PREFIXES = Object.freeze([
  "ASTEROID_",
  "BOND_",
  "METADATA_",
  "CIVILIZATION_",
  "MOON_",
  "PLANET_",
  "TABLE_",
  "CONTRACT_",
  "BRANCH_",
]);

const TELEMETRY_ONLY_EVENT_PREFIXES = Object.freeze(["STAR_", "POLICY_", "PHYSICS_"]);

function normalizeEventType(value) {
  return String(value || "")
    .trim()
    .toUpperCase();
}

function eventMatchesAnyPrefix(eventType, prefixes) {
  return prefixes.some((prefix) => eventType.startsWith(prefix));
}

export function createBoundedStreamDedupe(limit = DEFAULT_STREAM_DEDUPE_LIMIT) {
  const safeLimit = Math.max(1, Math.floor(Number(limit) || DEFAULT_STREAM_DEDUPE_LIMIT));
  const keys = new Map();

  return {
    remember(key) {
      const safeKey = String(key || "").trim();
      if (!safeKey) return false;
      if (keys.has(safeKey)) {
        return false;
      }
      keys.set(safeKey, true);
      while (keys.size > safeLimit) {
        const oldestKey = keys.keys().next().value;
        keys.delete(oldestKey);
      }
      return true;
    },
    clear() {
      keys.clear();
    },
    size() {
      return keys.size;
    },
  };
}

export function classifyRuntimeDeltaFrame(frame, cursorDecision) {
  const shouldRefresh = Boolean(cursorDecision?.shouldRefresh);
  if (!shouldRefresh) {
    return {
      shouldRefreshProjection: false,
      shouldRefreshTelemetry: false,
      shouldRequestPulse: false,
      reason: "no_refresh_event",
    };
  }

  const payload = frame?.data && typeof frame.data === "object" ? frame.data : {};
  const events = Array.isArray(payload.events) ? payload.events : [];
  const eventsCount = Number(payload.events_count || events.length || 0);

  if (eventsCount <= 0) {
    return {
      shouldRefreshProjection: false,
      shouldRefreshTelemetry: false,
      shouldRequestPulse: false,
      reason: "empty_update_batch",
    };
  }

  const eventTypes = events.map((item) => normalizeEventType(item?.event_type || item?.type)).filter(Boolean);
  if (eventTypes.length === 0) {
    return {
      shouldRefreshProjection: true,
      shouldRefreshTelemetry: true,
      shouldRequestPulse: true,
      reason: "unknown_batch_shape",
    };
  }

  if (eventTypes.every((eventType) => eventMatchesAnyPrefix(eventType, TELEMETRY_ONLY_EVENT_PREFIXES))) {
    return {
      shouldRefreshProjection: false,
      shouldRefreshTelemetry: true,
      shouldRequestPulse: true,
      reason: "telemetry_only_batch",
    };
  }

  if (eventTypes.some((eventType) => eventMatchesAnyPrefix(eventType, PROJECTION_EVENT_PREFIXES))) {
    return {
      shouldRefreshProjection: true,
      shouldRefreshTelemetry: true,
      shouldRequestPulse: true,
      reason: "projection_batch",
    };
  }

  return {
    shouldRefreshProjection: true,
    shouldRefreshTelemetry: true,
    shouldRequestPulse: true,
    reason: "fallback_refresh_batch",
  };
}
