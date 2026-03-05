function normalizeFields(values) {
  return [
    ...new Set((Array.isArray(values) ? values : []).map((item) => String(item || "").trim()).filter(Boolean)),
  ].sort();
}

function diff(beFields, feFields) {
  const be = new Set(normalizeFields(beFields));
  const fe = new Set(normalizeFields(feFields));
  return {
    missing_in_fe: [...be].filter((field) => !fe.has(field)).sort(),
    extra_in_fe: [...fe].filter((field) => !be.has(field)).sort(),
  };
}

function asString(value, fallback = "") {
  const text = typeof value === "string" ? value.trim() : String(value || "").trim();
  return text || fallback;
}

function asInteger(value, fallback = 0) {
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) return fallback;
  return Math.trunc(parsed);
}

export const GALAXY_PUBLIC_BE_FIELDS = Object.freeze(["id", "name", "owner_id", "created_at", "deleted_at"]);

export const GALAXY_GATE_FE_USED_FIELDS = Object.freeze(["id", "name", "deleted_at"]);

export const BRANCH_PUBLIC_BE_FIELDS = Object.freeze([
  "id",
  "galaxy_id",
  "name",
  "base_event_id",
  "created_by",
  "created_at",
  "deleted_at",
]);

export const BRANCH_GATE_FE_USED_FIELDS = Object.freeze(["id", "galaxy_id", "name", "deleted_at"]);

export const ONBOARDING_PUBLIC_BE_FIELDS = Object.freeze([
  "user_id",
  "galaxy_id",
  "mode",
  "current_stage_key",
  "current_stage_order",
  "started_at",
  "stage_started_at",
  "completed_at",
  "updated_at",
  "can_advance",
  "advance_blockers",
  "capabilities",
  "machine",
  "metrics",
  "stages",
]);

export const ONBOARDING_GATE_FE_USED_FIELDS = Object.freeze([
  "galaxy_id",
  "mode",
  "current_stage_key",
  "can_advance",
  "advance_blockers",
  "machine",
]);

export function normalizeGalaxyPublic(source) {
  if (!source || typeof source !== "object") return null;
  const id = asString(source.id);
  if (!id) return null;
  return {
    id,
    name: asString(source.name, "Galaxie"),
    owner_id: asString(source.owner_id, ""),
    created_at: source.created_at ?? null,
    deleted_at: source.deleted_at ?? null,
  };
}

export function normalizeGalaxyList(payload) {
  return (Array.isArray(payload) ? payload : []).map((item) => normalizeGalaxyPublic(item)).filter(Boolean);
}

export function normalizeBranchPublic(source) {
  if (!source || typeof source !== "object") return null;
  const id = asString(source.id);
  const galaxyId = asString(source.galaxy_id);
  if (!id || !galaxyId) return null;
  return {
    id,
    galaxy_id: galaxyId,
    name: asString(source.name, "Branch"),
    base_event_id: source.base_event_id ? asString(source.base_event_id) : null,
    created_by: source.created_by ? asString(source.created_by) : null,
    created_at: source.created_at ?? null,
    deleted_at: source.deleted_at ?? null,
  };
}

export function normalizeBranchList(payload) {
  return (Array.isArray(payload) ? payload : []).map((item) => normalizeBranchPublic(item)).filter(Boolean);
}

function normalizeOnboardingMachine(source) {
  const machine = source && typeof source === "object" ? source : {};
  return {
    step: asString(machine.step, "intro"),
    intro_ack: Boolean(machine.intro_ack),
    planet_dropped: Boolean(machine.planet_dropped),
    schema_confirmed: Boolean(machine.schema_confirmed),
    dependencies_confirmed: Boolean(machine.dependencies_confirmed),
    calculations_confirmed: Boolean(machine.calculations_confirmed),
    simulation_confirmed: Boolean(machine.simulation_confirmed),
    completed: Boolean(machine.completed),
  };
}

export function normalizeOnboardingPublic(source) {
  if (!source || typeof source !== "object") return null;
  const galaxyId = asString(source.galaxy_id);
  if (!galaxyId) return null;
  return {
    user_id: asString(source.user_id),
    galaxy_id: galaxyId,
    mode: asString(source.mode, "guided"),
    current_stage_key: asString(source.current_stage_key, "galaxy_bootstrap"),
    current_stage_order: asInteger(source.current_stage_order, 0),
    started_at: source.started_at ?? null,
    stage_started_at: source.stage_started_at ?? null,
    completed_at: source.completed_at ?? null,
    updated_at: source.updated_at ?? null,
    can_advance: Boolean(source.can_advance),
    advance_blockers: Array.isArray(source.advance_blockers)
      ? source.advance_blockers.map((item) => asString(item)).filter(Boolean)
      : [],
    capabilities: Array.isArray(source.capabilities)
      ? source.capabilities.map((item) => asString(item)).filter(Boolean)
      : [],
    machine: normalizeOnboardingMachine(source.machine),
    metrics: source.metrics && typeof source.metrics === "object" ? source.metrics : {},
    stages: Array.isArray(source.stages) ? source.stages : [],
  };
}

export function workspaceScopeContractDiff() {
  return {
    galaxy: diff(GALAXY_PUBLIC_BE_FIELDS, GALAXY_GATE_FE_USED_FIELDS),
    branch: diff(BRANCH_PUBLIC_BE_FIELDS, BRANCH_GATE_FE_USED_FIELDS),
    onboarding: diff(ONBOARDING_PUBLIC_BE_FIELDS, ONBOARDING_GATE_FE_USED_FIELDS),
  };
}
