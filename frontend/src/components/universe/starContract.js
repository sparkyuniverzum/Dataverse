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

export function normalizeStarPhysicsHalo(physicsProfile) {
  const safeProfile = normalizeStarPhysicsProfile(physicsProfile);
  const coefficientCount = Object.keys(safeProfile.coefficients).length;
  const intensity = clamp(0.28 + coefficientCount * 0.035, 0.28, 0.62);
  const orbitOpacity = clamp(0.3 + safeProfile.profile_version * 0.08, 0.3, 0.82);
  return {
    coefficientCount,
    intensity,
    orbitOpacity,
  };
}
