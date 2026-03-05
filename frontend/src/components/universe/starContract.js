export const STAR_POLICY_BE_FIELDS = Object.freeze([
  "profile_key",
  "law_preset",
  "profile_mode",
  "no_hard_delete",
  "deletion_mode",
  "occ_enforced",
  "idempotency_supported",
  "branch_scope_supported",
  "lock_status",
  "policy_version",
  "locked_at",
  "can_edit_core_laws",
]);

export const STAR_RUNTIME_BE_FIELDS = Object.freeze([
  "as_of_event_seq",
  "events_count",
  "writes_per_minute",
]);

export const STAR_DOMAIN_BE_FIELDS = Object.freeze([
  "domain_name",
  "status",
  "events_count",
  "activity_intensity",
]);

export const STAR_PULSE_EVENT_BE_FIELDS = Object.freeze([
  "event_seq",
  "event_type",
  "entity_id",
  "visual_hint",
  "intensity",
]);

export const STAR_PHYSICS_PROFILE_BE_FIELDS = Object.freeze([
  "galaxy_id",
  "profile_key",
  "profile_version",
  "lock_status",
  "locked_at",
  "coefficients",
]);

export const STAR_PLANET_PHYSICS_ITEM_BE_FIELDS = Object.freeze([
  "table_id",
  "phase",
  "metrics",
  "visual",
  "source_event_seq",
  "engine_version",
]);

export const STAR_PHYSICS_PROFILE_FE_USED_FIELDS = Object.freeze([
  "galaxy_id",
  "profile_key",
  "profile_version",
  "lock_status",
  "locked_at",
  "coefficients",
]);

export const STAR_PLANET_PHYSICS_ITEM_FE_USED_FIELDS = Object.freeze([
  "table_id",
  "phase",
  "metrics",
  "visual",
  "source_event_seq",
  "engine_version",
]);

// This list intentionally tracks fields directly consumed by FE logic.
export const STAR_POLICY_FE_USED_FIELDS = Object.freeze([
  "profile_key",
  "law_preset",
  "profile_mode",
  "no_hard_delete",
  "deletion_mode",
  "occ_enforced",
  "idempotency_supported",
  "branch_scope_supported",
  "lock_status",
  "policy_version",
  "locked_at",
  "can_edit_core_laws",
]);

export const STAR_RUNTIME_FE_USED_FIELDS = Object.freeze([
  "as_of_event_seq",
  "events_count",
  "writes_per_minute",
]);

export const STAR_DOMAIN_FE_USED_FIELDS = Object.freeze([
  "domain_name",
  "events_count",
  "status",
  "activity_intensity",
]);

export const STAR_PULSE_FE_USED_FIELDS = Object.freeze([
  "event_seq",
  "event_type",
  "entity_id",
  "visual_hint",
  "intensity",
]);

export const STAR_FIELD_CLASS = Object.freeze({
  USE_NOW: "USE_NOW",
  RESERVED: "RESERVED",
  DROP_CANDIDATE: "DROP_CANDIDATE",
});

export const STAR_CONTRACT_FIELD_CLASSIFICATION = Object.freeze({
  policy: Object.freeze({
    profile_key: STAR_FIELD_CLASS.USE_NOW,
    law_preset: STAR_FIELD_CLASS.USE_NOW,
    profile_mode: STAR_FIELD_CLASS.USE_NOW,
    no_hard_delete: STAR_FIELD_CLASS.USE_NOW,
    deletion_mode: STAR_FIELD_CLASS.USE_NOW,
    occ_enforced: STAR_FIELD_CLASS.USE_NOW,
    idempotency_supported: STAR_FIELD_CLASS.USE_NOW,
    branch_scope_supported: STAR_FIELD_CLASS.USE_NOW,
    lock_status: STAR_FIELD_CLASS.USE_NOW,
    policy_version: STAR_FIELD_CLASS.USE_NOW,
    locked_at: STAR_FIELD_CLASS.USE_NOW,
    can_edit_core_laws: STAR_FIELD_CLASS.USE_NOW,
  }),
  runtime: Object.freeze({
    as_of_event_seq: STAR_FIELD_CLASS.USE_NOW,
    events_count: STAR_FIELD_CLASS.USE_NOW,
    writes_per_minute: STAR_FIELD_CLASS.USE_NOW,
  }),
  domains: Object.freeze({
    domain_name: STAR_FIELD_CLASS.USE_NOW,
    status: STAR_FIELD_CLASS.USE_NOW,
    events_count: STAR_FIELD_CLASS.USE_NOW,
    activity_intensity: STAR_FIELD_CLASS.USE_NOW,
  }),
  pulse_event: Object.freeze({
    event_seq: STAR_FIELD_CLASS.USE_NOW,
    event_type: STAR_FIELD_CLASS.USE_NOW,
    entity_id: STAR_FIELD_CLASS.USE_NOW,
    visual_hint: STAR_FIELD_CLASS.USE_NOW,
    intensity: STAR_FIELD_CLASS.USE_NOW,
  }),
});

function toFiniteNumber(value, fallback = 0) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
}

function clamp(value, min, max) {
  return Math.max(min, Math.min(max, value));
}

function toStringOr(value, fallback = "") {
  const raw = String(value ?? "").trim();
  return raw || fallback;
}

export function normalizeStarPolicy(payload) {
  const source = payload && typeof payload === "object" ? payload : {};
  const lockStatus = toStringOr(source.lock_status, "draft").toLowerCase();
  return {
    profile_key: toStringOr(source.profile_key, "ORIGIN").toUpperCase(),
    law_preset: toStringOr(source.law_preset, "balanced"),
    profile_mode: toStringOr(source.profile_mode, lockStatus === "locked" ? "locked" : "auto"),
    no_hard_delete: source.no_hard_delete !== false,
    deletion_mode: toStringOr(source.deletion_mode, "soft_delete"),
    occ_enforced: source.occ_enforced !== false,
    idempotency_supported: source.idempotency_supported !== false,
    branch_scope_supported: source.branch_scope_supported !== false,
    lock_status: lockStatus,
    policy_version: Math.max(1, Math.floor(toFiniteNumber(source.policy_version, 1))),
    locked_at: source.locked_at ?? null,
    can_edit_core_laws: lockStatus === "locked" ? false : source.can_edit_core_laws !== false,
  };
}

export function normalizeStarRuntime(payload) {
  const source = payload && typeof payload === "object" ? payload : {};
  const eventsCount = Math.max(0, Math.floor(toFiniteNumber(source.events_count, 0)));
  const writes = Math.max(0, toFiniteNumber(source.writes_per_minute, 0));
  return {
    as_of_event_seq: Math.max(0, Math.floor(toFiniteNumber(source.as_of_event_seq, 0))),
    events_count: eventsCount,
    writes_per_minute: writes,
  };
}

function normalizeDomain(domain) {
  const source = domain && typeof domain === "object" ? domain : {};
  return {
    domain_name: toStringOr(source.domain_name, "Uncategorized"),
    status: toStringOr(source.status, "GREEN").toUpperCase(),
    events_count: Math.max(0, Math.floor(toFiniteNumber(source.events_count, 0))),
    activity_intensity: clamp(toFiniteNumber(source.activity_intensity, 0), 0, 1),
  };
}

export function normalizeStarDomains(payload) {
  const source = Array.isArray(payload) ? payload : [];
  return source.map((domain) => normalizeDomain(domain));
}

function normalizePulseEvent(event) {
  const source = event && typeof event === "object" ? event : {};
  return {
    event_seq: Math.max(0, Math.floor(toFiniteNumber(source.event_seq, 0))),
    event_type: toStringOr(source.event_type, ""),
    entity_id: toStringOr(source.entity_id, ""),
    visual_hint: toStringOr(source.visual_hint, "orbital_pulse"),
    intensity: clamp(toFiniteNumber(source.intensity, 0), 0, 1.5),
  };
}

export function normalizeStarPulsePayload(payload) {
  const source = payload && typeof payload === "object" ? payload : {};
  const events = Array.isArray(source.events) ? source.events.map((event) => normalizePulseEvent(event)) : [];
  return {
    galaxy_id: source.galaxy_id ?? null,
    branch_id: source.branch_id ?? null,
    last_event_seq: Math.max(0, Math.floor(toFiniteNumber(source.last_event_seq, 0))),
    sampled_count: Math.max(0, Math.floor(toFiniteNumber(source.sampled_count, events.length))),
    event_types: Array.isArray(source.event_types) ? source.event_types.map((item) => String(item)) : [],
    events,
  };
}

function normalizePhysicsCoefficients(coefficients) {
  if (!coefficients || typeof coefficients !== "object") return {};
  const out = {};
  Object.entries(coefficients).forEach(([key, value]) => {
    const safeKey = String(key || "").trim();
    if (!safeKey) return;
    out[safeKey] = toFiniteNumber(value, 0);
  });
  return out;
}

function normalizePlanetPhysicsMetrics(metrics) {
  const source = metrics && typeof metrics === "object" ? metrics : {};
  return {
    activity: clamp(toFiniteNumber(source.activity, 0), 0, 1),
    stress: clamp(toFiniteNumber(source.stress, 0), 0, 1),
    health: clamp(toFiniteNumber(source.health, 1), 0, 1),
    inactivity: clamp(toFiniteNumber(source.inactivity, 0), 0, 1),
    corrosion: clamp(toFiniteNumber(source.corrosion, 0), 0, 1),
    rows: Math.max(0, Math.floor(toFiniteNumber(source.rows, 0))),
  };
}

function normalizePlanetPhysicsVisual(visual) {
  const source = visual && typeof visual === "object" ? visual : {};
  return {
    size_factor: clamp(toFiniteNumber(source.size_factor, 1), 0.4, 4),
    luminosity: clamp(toFiniteNumber(source.luminosity, 0), 0, 1),
    pulse_rate: clamp(toFiniteNumber(source.pulse_rate, 0), 0, 5),
    hue: clamp(toFiniteNumber(source.hue, 0), 0, 1),
    saturation: clamp(toFiniteNumber(source.saturation, 0), 0, 1),
    corrosion_level: clamp(toFiniteNumber(source.corrosion_level, 0), 0, 1),
    crack_intensity: clamp(toFiniteNumber(source.crack_intensity, 0), 0, 1),
  };
}

function normalizePlanetPhysicsItem(item) {
  const source = item && typeof item === "object" ? item : {};
  return {
    table_id: toStringOr(source.table_id, ""),
    phase: toStringOr(source.phase, "CALM").toUpperCase(),
    metrics: normalizePlanetPhysicsMetrics(source.metrics),
    visual: normalizePlanetPhysicsVisual(source.visual),
    source_event_seq: Math.max(0, Math.floor(toFiniteNumber(source.source_event_seq, 0))),
    engine_version: toStringOr(source.engine_version, "star-physics-v2-preview"),
  };
}

export function normalizeStarPhysicsProfile(payload) {
  const source = payload && typeof payload === "object" ? payload : {};
  return {
    galaxy_id: source.galaxy_id ?? null,
    profile_key: toStringOr(source.profile_key, "BALANCE").toUpperCase(),
    profile_version: Math.max(1, Math.floor(toFiniteNumber(source.profile_version, 1))),
    lock_status: toStringOr(source.lock_status, "draft").toLowerCase(),
    locked_at: source.locked_at ?? null,
    coefficients: normalizePhysicsCoefficients(source.coefficients),
  };
}

export function normalizeStarPlanetPhysicsPayload(payload) {
  const source = payload && typeof payload === "object" ? payload : {};
  const itemsRaw = Array.isArray(source.items) ? source.items : [];
  const items = itemsRaw.map((item) => normalizePlanetPhysicsItem(item)).filter((item) => Boolean(item.table_id));
  return {
    as_of_event_seq: Math.max(0, Math.floor(toFiniteNumber(source.as_of_event_seq, 0))),
    items,
  };
}

function diff(beFields, usedFields) {
  const beSet = new Set(beFields);
  const usedSet = new Set(usedFields);
  return {
    unused_from_be: beFields.filter((field) => !usedSet.has(field)),
    missing_in_be: usedFields.filter((field) => !beSet.has(field)),
  };
}

function summarizeClassifications(section, beFields, usedFields) {
  const classes = STAR_CONTRACT_FIELD_CLASSIFICATION[section] || {};
  const beSet = new Set(beFields);
  const byClass = {
    [STAR_FIELD_CLASS.USE_NOW]: [],
    [STAR_FIELD_CLASS.RESERVED]: [],
    [STAR_FIELD_CLASS.DROP_CANDIDATE]: [],
  };
  beFields.forEach((field) => {
    const cls = classes[field] || null;
    if (cls && byClass[cls]) byClass[cls].push(field);
  });
  return {
    by_class: byClass,
    unclassified: beFields.filter((field) => !(field in classes)),
    orphan_class_entries: Object.keys(classes).filter((field) => !beSet.has(field)),
    invalid_class_entries: Object.entries(classes)
      .filter(([, cls]) => !Object.values(STAR_FIELD_CLASS).includes(cls))
      .map(([field]) => field),
    use_now_not_in_fe_used: byClass[STAR_FIELD_CLASS.USE_NOW].filter((field) => !usedFields.includes(field)),
    fe_used_not_use_now: usedFields.filter((field) => classes[field] !== STAR_FIELD_CLASS.USE_NOW),
  };
}

export function getStarContractUsageDiff() {
  return {
    policy: diff(STAR_POLICY_BE_FIELDS, STAR_POLICY_FE_USED_FIELDS),
    runtime: diff(STAR_RUNTIME_BE_FIELDS, STAR_RUNTIME_FE_USED_FIELDS),
    domains: diff(STAR_DOMAIN_BE_FIELDS, STAR_DOMAIN_FE_USED_FIELDS),
    pulse_event: diff(STAR_PULSE_EVENT_BE_FIELDS, STAR_PULSE_FE_USED_FIELDS),
  };
}

export function getStarPhysicsContractUsageDiff() {
  return {
    physics_profile: diff(STAR_PHYSICS_PROFILE_BE_FIELDS, STAR_PHYSICS_PROFILE_FE_USED_FIELDS),
    planet_physics_item: diff(STAR_PLANET_PHYSICS_ITEM_BE_FIELDS, STAR_PLANET_PHYSICS_ITEM_FE_USED_FIELDS),
  };
}

export function getStarContractClassificationReport() {
  return {
    policy: summarizeClassifications("policy", STAR_POLICY_BE_FIELDS, STAR_POLICY_FE_USED_FIELDS),
    runtime: summarizeClassifications("runtime", STAR_RUNTIME_BE_FIELDS, STAR_RUNTIME_FE_USED_FIELDS),
    domains: summarizeClassifications("domains", STAR_DOMAIN_BE_FIELDS, STAR_DOMAIN_FE_USED_FIELDS),
    pulse_event: summarizeClassifications("pulse_event", STAR_PULSE_EVENT_BE_FIELDS, STAR_PULSE_FE_USED_FIELDS),
  };
}
