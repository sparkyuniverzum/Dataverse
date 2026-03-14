export const LAB_SNAPSHOT_VERSION = 1;
export const LAB_VIEW_MODES = ["debug", "cinematic", "performance_safe"];
export const LAB_SCENE_IDS = ["star_core_interior_core", "star_core_exterior"];

const INTERIOR_PHASES = [
  "star_core_interior_entry",
  "constitution_select",
  "policy_lock_ready",
  "policy_lock_transition",
  "first_orbit_ready",
];
const INTERIOR_CONSTITUTIONS = ["rust", "rovnovaha", "straz", "archiv"];
const INTERIOR_CAMERA_PROFILES = ["entry", "focus", "orbit", "locked"];
const INTERIOR_MOTION_PROFILES = ["full", "reduced", "frozen"];
const EXTERIOR_LOCK_STATES = ["unlocked", "locked", "stabilizing"];
const EXTERIOR_CAMERA_PROFILES = ["wide", "focus", "approach"];

export class LabConfigError extends Error {
  constructor(message) {
    super(message);
    this.name = "LabConfigError";
  }
}

function isPlainObject(value) {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function assertPlainObject(value, message) {
  if (!isPlainObject(value)) {
    throw new LabConfigError(message);
  }
}

function clampUnit(value) {
  const numeric = Number(value);
  if (!Number.isFinite(numeric)) return 0;
  return Math.max(0, Math.min(1, numeric));
}

function parseEnum(value, allowed, fallback, message) {
  const normalized = String(value || "")
    .trim()
    .toLowerCase();
  if (!normalized) return fallback;
  if (allowed.includes(normalized)) return normalized;
  throw new LabConfigError(message);
}

function parseOptionalEnum(value, allowed, fallback, message) {
  if (value === null) return null;
  if (typeof value === "undefined") return fallback;
  return parseEnum(value, allowed, fallback, message);
}

function parseBoolean(value, fallback = false) {
  if (typeof value === "boolean") return value;
  return fallback;
}

function parseOverrides(value, allowedKeys = []) {
  if (!isPlainObject(value)) return Object.fromEntries(allowedKeys.map((key) => [key, {}]));
  return Object.fromEntries(
    allowedKeys.map((key) => {
      const candidate = value[key];
      return [key, isPlainObject(candidate) ? { ...candidate } : {}];
    })
  );
}

export function createDefaultInteriorSceneConfig() {
  return {
    presetVersion: 1,
    phase: "constitution_select",
    constitutionProfile: null,
    cameraProfile: "focus",
    motionProfile: "full",
    telemetryProfile: {
      pulseStrength: 0.34,
      domainIntensity: 0.22,
      eventDensity: 0.16,
      planetActivity: 0.1,
    },
    debugProfile: {
      helpers: false,
      axes: false,
      grid: false,
      bounds: false,
      perfOverlay: false,
    },
    overrides: {
      lighting: {},
      postfx: {},
      chamber: {},
    },
  };
}

export function createDefaultExteriorSceneConfig() {
  return {
    presetVersion: 1,
    lockState: "unlocked",
    cameraProfile: "wide",
    motionProfile: "full",
    debugProfile: {
      helpers: false,
      axes: false,
      grid: false,
      bounds: false,
      perfOverlay: false,
    },
    overrides: {
      lighting: {},
      postfx: {},
      halo: {},
    },
  };
}

export function createDefaultLabSnapshot() {
  return {
    version: LAB_SNAPSHOT_VERSION,
    selectedSceneId: "star_core_interior_core",
    viewMode: "cinematic",
    scenes: {
      star_core_interior_core: createDefaultInteriorSceneConfig(),
      star_core_exterior: createDefaultExteriorSceneConfig(),
    },
  };
}

export function parseInteriorSceneConfig(input) {
  const fallback = createDefaultInteriorSceneConfig();
  if (typeof input === "undefined") return fallback;
  assertPlainObject(input, "Interior scene config musi byt objekt.");

  const telemetryProfile = isPlainObject(input.telemetryProfile) ? input.telemetryProfile : {};
  const debugProfile = isPlainObject(input.debugProfile) ? input.debugProfile : {};

  return {
    presetVersion: Math.max(1, Number(input.presetVersion) || fallback.presetVersion),
    phase: parseEnum(input.phase, INTERIOR_PHASES, fallback.phase, "Neplatna interior phase."),
    constitutionProfile: parseOptionalEnum(
      input.constitutionProfile,
      INTERIOR_CONSTITUTIONS,
      fallback.constitutionProfile,
      "Neplatny constitution profile."
    ),
    cameraProfile: parseEnum(
      input.cameraProfile,
      INTERIOR_CAMERA_PROFILES,
      fallback.cameraProfile,
      "Neplatny interior camera profile."
    ),
    motionProfile: parseEnum(
      input.motionProfile,
      INTERIOR_MOTION_PROFILES,
      fallback.motionProfile,
      "Neplatny interior motion profile."
    ),
    telemetryProfile: {
      pulseStrength: clampUnit(telemetryProfile.pulseStrength ?? fallback.telemetryProfile.pulseStrength),
      domainIntensity: clampUnit(telemetryProfile.domainIntensity ?? fallback.telemetryProfile.domainIntensity),
      eventDensity: clampUnit(telemetryProfile.eventDensity ?? fallback.telemetryProfile.eventDensity),
      planetActivity: clampUnit(telemetryProfile.planetActivity ?? fallback.telemetryProfile.planetActivity),
    },
    debugProfile: {
      helpers: parseBoolean(debugProfile.helpers, fallback.debugProfile.helpers),
      axes: parseBoolean(debugProfile.axes, fallback.debugProfile.axes),
      grid: parseBoolean(debugProfile.grid, fallback.debugProfile.grid),
      bounds: parseBoolean(debugProfile.bounds, fallback.debugProfile.bounds),
      perfOverlay: parseBoolean(debugProfile.perfOverlay, fallback.debugProfile.perfOverlay),
    },
    overrides: parseOverrides(input.overrides, ["lighting", "postfx", "chamber"]),
  };
}

export function parseExteriorSceneConfig(input) {
  const fallback = createDefaultExteriorSceneConfig();
  if (typeof input === "undefined") return fallback;
  assertPlainObject(input, "Exterior scene config musi byt objekt.");

  const debugProfile = isPlainObject(input.debugProfile) ? input.debugProfile : {};

  return {
    presetVersion: Math.max(1, Number(input.presetVersion) || fallback.presetVersion),
    lockState: parseEnum(input.lockState, EXTERIOR_LOCK_STATES, fallback.lockState, "Neplatny exterior lock state."),
    cameraProfile: parseEnum(
      input.cameraProfile,
      EXTERIOR_CAMERA_PROFILES,
      fallback.cameraProfile,
      "Neplatny exterior camera profile."
    ),
    motionProfile: parseEnum(
      input.motionProfile,
      INTERIOR_MOTION_PROFILES,
      fallback.motionProfile,
      "Neplatny exterior motion profile."
    ),
    debugProfile: {
      helpers: parseBoolean(debugProfile.helpers, fallback.debugProfile.helpers),
      axes: parseBoolean(debugProfile.axes, fallback.debugProfile.axes),
      grid: parseBoolean(debugProfile.grid, fallback.debugProfile.grid),
      bounds: parseBoolean(debugProfile.bounds, fallback.debugProfile.bounds),
      perfOverlay: parseBoolean(debugProfile.perfOverlay, fallback.debugProfile.perfOverlay),
    },
    overrides: parseOverrides(input.overrides, ["lighting", "postfx", "halo"]),
  };
}

export function parseLabSnapshot(input) {
  assertPlainObject(input, "Lab snapshot musi byt objekt.");
  const scenes = isPlainObject(input.scenes) ? input.scenes : {};

  return {
    version: Math.max(1, Number(input.version) || LAB_SNAPSHOT_VERSION),
    selectedSceneId: parseEnum(input.selectedSceneId, LAB_SCENE_IDS, "star_core_interior_core", "Neplatne scene id."),
    viewMode: parseEnum(input.viewMode, LAB_VIEW_MODES, "cinematic", "Neplatny view mode."),
    scenes: {
      star_core_interior_core: parseInteriorSceneConfig(scenes.star_core_interior_core),
      star_core_exterior: parseExteriorSceneConfig(scenes.star_core_exterior),
    },
  };
}

export function parseLabSnapshotText(text) {
  try {
    return parseLabSnapshot(JSON.parse(String(text || "")));
  } catch (error) {
    if (error instanceof LabConfigError) throw error;
    throw new LabConfigError("Import presetu neni validni JSON.");
  }
}

export function stringifyLabSnapshot(snapshot) {
  return JSON.stringify(parseLabSnapshot(snapshot), null, 2);
}
