const EVENT_CATALOG = Object.freeze(
  new Set([
    "moon_opened",
    "moon_rule_failed",
    "bond_preview_allowed",
    "bond_preview_rejected",
    "bond_preview_warned",
    "cross_planet_blocked",
    "guided_repair_applied",
    "guided_repair_failed",
  ])
);

function toNullableString(value) {
  if (value === null || value === undefined) return null;
  const text = String(value).trim();
  return text || null;
}

function nowIso() {
  return new Date().toISOString();
}

function sanitizeEventPayload(eventName, payload = {}) {
  const source = payload && typeof payload === "object" ? payload : {};
  if (eventName === "moon_rule_failed") {
    return {
      rule_id: toNullableString(source.rule_id),
      capability_id: toNullableString(source.capability_id),
      mineral_key: toNullableString(source.mineral_key),
      expected_constraint: source.expected_constraint ?? null,
    };
  }
  if (eventName === "bond_preview_rejected") {
    return {
      reject_codes: Array.isArray(source.reject_codes) ? source.reject_codes.map((item) => String(item)) : [],
      blocking_count: Number.isFinite(Number(source.blocking_count)) ? Math.max(0, Number(source.blocking_count)) : 0,
      cross_planet: Boolean(source.cross_planet),
    };
  }
  if (eventName === "cross_planet_blocked") {
    return {
      source_planet_id: toNullableString(source.source_planet_id),
      target_planet_id: toNullableString(source.target_planet_id),
      reason_code: toNullableString(source.reason_code),
    };
  }
  if (eventName === "guided_repair_applied" || eventName === "guided_repair_failed") {
    return {
      strategy_key: toNullableString(source.strategy_key),
      repair_id: toNullableString(source.repair_id),
      result: eventName === "guided_repair_applied" ? "applied" : "failed",
    };
  }
  return source;
}

function isValidBase(base) {
  return Boolean(base?.event_name && base?.occurred_at && base?.galaxy_id);
}

export function createWorkspaceTelemetryEvent({
  eventName,
  galaxyId,
  branchId = null,
  planetId = null,
  civilizationId = null,
  moonId = null,
  bondId = null,
  clientVersion = "dev-local",
  flagPhase = "unknown",
  payload = {},
} = {}) {
  const normalizedEventName = String(eventName || "").trim();
  if (!EVENT_CATALOG.has(normalizedEventName)) {
    return null;
  }

  const event = {
    event_name: normalizedEventName,
    occurred_at: nowIso(),
    galaxy_id: toNullableString(galaxyId),
    branch_id: toNullableString(branchId),
    planet_id: toNullableString(planetId),
    civilization_id: toNullableString(civilizationId),
    moon_id: toNullableString(moonId),
    bond_id: toNullableString(bondId),
    client_version: toNullableString(clientVersion) || "dev-local",
    flag_phase: toNullableString(flagPhase) || "unknown",
    payload: sanitizeEventPayload(normalizedEventName, payload),
  };

  if (!isValidBase(event)) {
    return null;
  }
  return event;
}

export function emitWorkspaceTelemetry(event, sink = null) {
  if (!event || typeof event !== "object") return false;
  if (typeof sink === "function") {
    sink(event);
    return true;
  }
  if (typeof window !== "undefined") {
    const previous = Array.isArray(window.__DATAVERSE_TELEMETRY_EVENTS__) ? window.__DATAVERSE_TELEMETRY_EVENTS__ : [];
    window.__DATAVERSE_TELEMETRY_EVENTS__ = [...previous, event].slice(-300);
    return true;
  }
  return false;
}

export function getWorkspaceTelemetryCatalog() {
  return Array.from(EVENT_CATALOG.values());
}
