export const API_BASE = String(import.meta.env.VITE_API_BASE_URL || "http://127.0.0.1:8000");

let tokenProvider = () => null;
let unauthorizedHandler = async () => false;

export function configureApiAuth({ getToken, onUnauthorized } = {}) {
  tokenProvider = typeof getToken === "function" ? getToken : () => null;
  unauthorizedHandler = typeof onUnauthorized === "function" ? onUnauthorized : async () => false;
}

function shouldHandleUnauthorized(url) {
  const asText = String(url || "");
  return (
    !asText.includes("/auth/login") &&
    !asText.includes("/auth/register") &&
    !asText.includes("/auth/refresh") &&
    !asText.includes("/auth/logout")
  );
}

export async function apiFetch(input, init = {}) {
  const headers = new Headers(init.headers || {});
  const token = tokenProvider?.();
  if (token && !headers.has("Authorization")) {
    headers.set("Authorization", `Bearer ${token}`);
  }

  const response = await fetch(input, { ...init, headers });
  if (response.status === 401 && shouldHandleUnauthorized(input)) {
    try {
      const recovered = await unauthorizedHandler?.({ input, init, response });
      if (recovered) {
        const retryHeaders = new Headers(init.headers || {});
        const retriedToken = tokenProvider?.();
        if (retriedToken && !retryHeaders.has("Authorization")) {
          retryHeaders.set("Authorization", `Bearer ${retriedToken}`);
        }
        return fetch(input, { ...init, headers: retryHeaders });
      }
    } catch {
      // noop
    }
  }
  return response;
}

export function normalizeApiErrorPayload(payload, { status = 0, fallbackMessage = "Request failed" } = {}) {
  const detail = payload && typeof payload === "object" ? payload.detail : null;
  const detailObject = detail && typeof detail === "object" && !Array.isArray(detail) ? detail : null;
  const detailText = typeof detail === "string" ? detail.trim() : "";
  const codeRaw = detailObject?.code ?? (payload && typeof payload === "object" ? payload.code : null);
  const code = typeof codeRaw === "string" && codeRaw.trim() ? codeRaw.trim() : null;

  let message = "";
  if (typeof detailObject?.message === "string" && detailObject.message.trim()) {
    message = detailObject.message.trim();
  } else if (detailText) {
    message = detailText;
  } else if (payload && typeof payload === "object" && typeof payload.message === "string" && payload.message.trim()) {
    message = payload.message.trim();
  }
  if (!message) {
    message = `${fallbackMessage}: ${status || "unknown"}`;
  }

  return {
    status: Number(status || 0),
    code,
    message,
    detail: detailObject || detail || null,
    payload,
  };
}

async function readResponsePayload(response) {
  try {
    const text = await response.text();
    if (!text) return null;
    return JSON.parse(text);
  } catch {
    return null;
  }
}

export async function apiErrorFromResponse(response, fallbackMessage = "Request failed") {
  const payload = await readResponsePayload(response);
  const normalized = normalizeApiErrorPayload(payload, { status: response?.status || 0, fallbackMessage });
  const error = new Error(normalized.message);
  error.name = "ApiError";
  error.status = normalized.status;
  error.code = normalized.code;
  error.detail = normalized.detail;
  error.payload = normalized.payload;
  return error;
}

export function isOccConflictError(error) {
  if (!error || Number(error.status) !== 409) return false;
  const code = String(error.code || error?.detail?.code || "")
    .trim()
    .toUpperCase();
  return code === "OCC_CONFLICT";
}

export function buildOccConflictMessage(error, actionLabel = "zapis") {
  const detail = error?.detail && typeof error.detail === "object" ? error.detail : {};
  const context = typeof detail.context === "string" && detail.context.trim() ? detail.context.trim() : actionLabel;
  const expected = Number.isInteger(detail.expected_event_seq) ? detail.expected_event_seq : null;
  const current = Number.isInteger(detail.current_event_seq) ? detail.current_event_seq : null;
  const expectedText = expected === null ? "?" : String(expected);
  const currentText = current === null ? "?" : String(current);
  return `Kolize souběžné změny (${context}). Data byla obnovena; zkontroluj aktuální stav a akci zopakuj (expected=${expectedText}, current=${currentText}).`;
}

const BOND_TYPE_ALIASES = {
  RELATION: "RELATION",
  REL: "RELATION",
  LINK: "RELATION",
  EDGE: "RELATION",
  BOND: "RELATION",
  TYPE: "TYPE",
  TYP: "TYPE",
  FLOW: "FLOW",
  DATAFLOW: "FLOW",
  DATA_FLOW: "FLOW",
  FORMULA: "FLOW",
  GUARDIAN: "GUARDIAN",
  GUARD: "GUARDIAN",
  WATCH: "GUARDIAN",
};

export function normalizeBondType(rawType) {
  const normalized = String(rawType || "")
    .trim()
    .toUpperCase()
    .replaceAll("-", "_")
    .replaceAll(" ", "_");
  if (!normalized) return "RELATION";
  return BOND_TYPE_ALIASES[normalized] || normalized;
}

export function bondSemanticsFromType(rawType) {
  const type = normalizeBondType(rawType);
  const directional = type !== "RELATION";
  return {
    type,
    directional,
    flow_direction: directional ? "source_to_target" : "bidirectional",
  };
}

export function buildParserPayload(command, galaxyId = null, branchId = null) {
  const trimmed = typeof command === "string" ? command.trim() : "";
  const payload = {
    query: trimmed,
    parser_version: "v2",
  };
  if (galaxyId) {
    payload.galaxy_id = galaxyId;
  }
  if (branchId) {
    payload.branch_id = branchId;
  }
  return payload;
}

export function buildTaskBatchPayload({
  tasks,
  mode = "commit",
  galaxyId = null,
  branchId = null,
  idempotencyKey = null,
} = {}) {
  const payload = {
    mode: String(mode || "commit").toLowerCase(),
    tasks: Array.isArray(tasks) ? tasks : [],
  };
  if (galaxyId) {
    payload.galaxy_id = galaxyId;
  }
  if (branchId) {
    payload.branch_id = branchId;
  }
  if (idempotencyKey) {
    payload.idempotency_key = idempotencyKey;
  }
  return payload;
}

export function toAsOfIso(value) {
  if (!value) return null;
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return null;
  return date.toISOString();
}

export function buildSnapshotUrl(apiBase, asOfIso = null, galaxyId = null, branchId = null) {
  const url = new URL(`${apiBase}/universe/snapshot`);
  if (asOfIso) {
    url.searchParams.set("as_of", asOfIso);
  }
  if (galaxyId) {
    url.searchParams.set("galaxy_id", galaxyId);
  }
  if (branchId) {
    url.searchParams.set("branch_id", branchId);
  }
  return url.toString();
}

export function buildTablesUrl(apiBase, asOfIso = null, galaxyId = null, branchId = null) {
  const url = new URL(`${apiBase}/universe/tables`);
  if (asOfIso) {
    url.searchParams.set("as_of", asOfIso);
  }
  if (galaxyId) {
    url.searchParams.set("galaxy_id", galaxyId);
  }
  if (branchId) {
    url.searchParams.set("branch_id", branchId);
  }
  return url.toString();
}

export function buildTableContractUrl(apiBase, tableId, galaxyId = null) {
  const url = new URL(`${apiBase}/contracts/${tableId}`);
  if (galaxyId) {
    url.searchParams.set("galaxy_id", String(galaxyId));
  }
  return url.toString();
}

export function buildBranchesUrl(apiBase, galaxyId = null) {
  const url = new URL(`${apiBase}/branches`);
  if (galaxyId) {
    url.searchParams.set("galaxy_id", String(galaxyId));
  }
  return url.toString();
}

export function buildGalaxyOnboardingUrl(apiBase, galaxyId) {
  return `${apiBase}/galaxies/${galaxyId}/onboarding`;
}

export function buildGalaxyPlanetsUrl(apiBase, galaxyId, asOfIso = null, branchId = null) {
  const url = new URL(`${apiBase}/galaxies/${galaxyId}/planets`);
  if (asOfIso) {
    url.searchParams.set("as_of", asOfIso);
  }
  if (branchId) {
    url.searchParams.set("branch_id", branchId);
  }
  return url.toString();
}

export function buildGalaxyMoonsUrl(apiBase, galaxyId, asOfIso = null, branchId = null) {
  const url = new URL(`${apiBase}/galaxies/${galaxyId}/moons`);
  if (asOfIso) {
    url.searchParams.set("as_of", asOfIso);
  }
  if (branchId) {
    url.searchParams.set("branch_id", branchId);
  }
  return url.toString();
}

export function buildMoonListUrl(apiBase, { galaxyId = null, planetId = null, branchId = null } = {}) {
  const url = new URL(`${apiBase}/moons`);
  if (galaxyId) {
    url.searchParams.set("galaxy_id", String(galaxyId));
  }
  if (planetId) {
    url.searchParams.set("planet_id", String(planetId));
  }
  if (branchId) {
    url.searchParams.set("branch_id", String(branchId));
  }
  return url.toString();
}

export function buildMoonDetailUrl(apiBase, moonId, { galaxyId = null, branchId = null } = {}) {
  const url = new URL(`${apiBase}/moons/${moonId}`);
  if (galaxyId) {
    url.searchParams.set("galaxy_id", String(galaxyId));
  }
  if (branchId) {
    url.searchParams.set("branch_id", String(branchId));
  }
  return url.toString();
}

export function buildMoonCreateUrl(apiBase) {
  return `${apiBase}/moons`;
}

export function buildMoonMutateUrl(apiBase, moonId) {
  return `${apiBase}/moons/${moonId}/mutate`;
}

export function buildMoonMineralMutateUrl(apiBase, moonId, mineralKey) {
  return `${apiBase}/moons/${moonId}/minerals/${encodeURIComponent(String(mineralKey || "").trim())}`;
}

export function buildMoonExtinguishUrl(apiBase, moonId, { expectedEventSeq } = {}) {
  if (expectedEventSeq == null || !Number.isFinite(expectedEventSeq) || Number(expectedEventSeq) < 0) {
    throw new Error("expectedEventSeq is required and must be a non-negative number for extinguish operations");
  }
  const url = new URL(`${apiBase}/moons/${moonId}/extinguish`);
  url.searchParams.set("expected_event_seq", String(Math.floor(Number(expectedEventSeq))));
  return url.toString();
}

export function buildCivilizationListUrl(apiBase, { galaxyId = null, planetId = null, branchId = null } = {}) {
  const url = new URL(`${apiBase}/civilizations`);
  if (galaxyId) {
    url.searchParams.set("galaxy_id", String(galaxyId));
  }
  if (planetId) {
    url.searchParams.set("planet_id", String(planetId));
  }
  if (branchId) {
    url.searchParams.set("branch_id", String(branchId));
  }
  return url.toString();
}

export function buildCivilizationDetailUrl(apiBase, civilizationId, { galaxyId = null, branchId = null } = {}) {
  const url = new URL(`${apiBase}/civilizations/${civilizationId}`);
  if (galaxyId) {
    url.searchParams.set("galaxy_id", String(galaxyId));
  }
  if (branchId) {
    url.searchParams.set("branch_id", String(branchId));
  }
  return url.toString();
}

export function buildCivilizationCreateUrl(apiBase) {
  return `${apiBase}/civilizations`;
}

export function buildCivilizationMutateUrl(apiBase, civilizationId) {
  return `${apiBase}/civilizations/${civilizationId}/mutate`;
}

export function buildCivilizationMineralMutateUrl(apiBase, civilizationId, mineralKey) {
  return `${apiBase}/civilizations/${civilizationId}/minerals/${encodeURIComponent(String(mineralKey || "").trim())}`;
}

export function buildCivilizationExtinguishUrl(apiBase, civilizationId, { expectedEventSeq } = {}) {
  if (expectedEventSeq == null || !Number.isFinite(expectedEventSeq) || Number(expectedEventSeq) < 0) {
    throw new Error("expectedEventSeq is required and must be a non-negative number for extinguish operations");
  }
  const url = new URL(`${apiBase}/civilizations/${civilizationId}/extinguish`);
  url.searchParams.set("expected_event_seq", String(Math.floor(Number(expectedEventSeq))));
  return url.toString();
}

export function buildAsteroidExtinguishUrl(apiBase, asteroidId, { galaxyId = null, expectedEventSeq } = {}) {
  if (expectedEventSeq == null || !Number.isFinite(expectedEventSeq) || Number(expectedEventSeq) < 0) {
    throw new Error("expectedEventSeq is required and must be a non-negative number for extinguish operations");
  }
  const url = new URL(`${apiBase}/asteroids/${asteroidId}/extinguish`);
  if (galaxyId) {
    url.searchParams.set("galaxy_id", String(galaxyId));
  }
  url.searchParams.set("expected_event_seq", String(Math.floor(Number(expectedEventSeq))));
  return url.toString();
}

export function buildBondExtinguishUrl(apiBase, bondId, { galaxyId = null, expectedEventSeq } = {}) {
  if (expectedEventSeq == null || !Number.isFinite(expectedEventSeq) || Number(expectedEventSeq) < 0) {
    throw new Error("expectedEventSeq is required and must be a non-negative number for extinguish operations");
  }
  const url = new URL(`${apiBase}/bonds/${bondId}/extinguish`);
  if (galaxyId) {
    url.searchParams.set("galaxy_id", String(galaxyId));
  }
  url.searchParams.set("expected_event_seq", String(Math.floor(Number(expectedEventSeq))));
  return url.toString();
}

export function buildPlanetExtinguishUrl(
  apiBase,
  tableId,
  { galaxyId = null, branchId = null, expectedEventSeq } = {}
) {
  if (expectedEventSeq == null || !Number.isFinite(expectedEventSeq) || Number(expectedEventSeq) < 0) {
    throw new Error("expectedEventSeq is required and must be a non-negative number for extinguish operations");
  }
  const url = new URL(`${apiBase}/planets/${tableId}/extinguish`);
  if (galaxyId) {
    url.searchParams.set("galaxy_id", String(galaxyId));
  }
  if (branchId) {
    url.searchParams.set("branch_id", String(branchId));
  }
  url.searchParams.set("expected_event_seq", String(Math.floor(Number(expectedEventSeq))));
  return url.toString();
}

export function buildGalaxyExtinguishUrl(apiBase, galaxyId, { expectedEventSeq } = {}) {
  if (expectedEventSeq == null || !Number.isFinite(expectedEventSeq) || Number(expectedEventSeq) < 0) {
    throw new Error("expectedEventSeq is required and must be a non-negative number for extinguish operations");
  }
  const url = new URL(`${apiBase}/galaxies/${galaxyId}/extinguish`);
  url.searchParams.set("expected_event_seq", String(Math.floor(Number(expectedEventSeq))));
  return url.toString();
}

export function buildGalaxyBondsUrl(apiBase, galaxyId, asOfIso = null, branchId = null) {
  const url = new URL(`${apiBase}/galaxies/${galaxyId}/bonds`);
  if (asOfIso) {
    url.searchParams.set("as_of", asOfIso);
  }
  if (branchId) {
    url.searchParams.set("branch_id", branchId);
  }
  return url.toString();
}

export function buildGalaxyEventsStreamUrl(
  apiBase,
  galaxyId,
  { branchId = null, lastEventSeq = null, pollMs = 1200, heartbeatSec = 15 } = {}
) {
  const url = new URL(`${apiBase}/galaxies/${galaxyId}/events/stream`);
  if (branchId) {
    url.searchParams.set("branch_id", String(branchId));
  }
  if (Number.isFinite(lastEventSeq) && Number(lastEventSeq) >= 0) {
    url.searchParams.set("last_event_seq", String(Math.floor(Number(lastEventSeq))));
  }
  if (Number.isFinite(pollMs)) {
    url.searchParams.set("poll_ms", String(Math.max(300, Math.floor(Number(pollMs)))));
  }
  if (Number.isFinite(heartbeatSec)) {
    url.searchParams.set("heartbeat_sec", String(Math.max(5, Math.floor(Number(heartbeatSec)))));
  }
  return url.toString();
}

export function buildStarCoreRuntimeUrl(apiBase, galaxyId, { branchId = null, windowEvents = 120 } = {}) {
  const url = new URL(`${apiBase}/galaxies/${galaxyId}/star-core/runtime`);
  if (branchId) {
    url.searchParams.set("branch_id", String(branchId));
  }
  if (Number.isFinite(windowEvents)) {
    url.searchParams.set("window_events", String(Math.max(16, Math.min(256, Math.floor(Number(windowEvents))))));
  }
  return url.toString();
}

export function buildStarCorePolicyUrl(apiBase, galaxyId) {
  return `${apiBase}/galaxies/${galaxyId}/star-core/policy`;
}

export function buildStarCorePolicyLockUrl(apiBase, galaxyId) {
  return `${apiBase}/galaxies/${galaxyId}/star-core/policy/lock`;
}

export function buildStarCorePhysicsProfileUrl(apiBase, galaxyId) {
  return `${apiBase}/galaxies/${galaxyId}/star-core/physics/profile`;
}

export function buildStarCorePlanetPhysicsUrl(
  apiBase,
  galaxyId,
  { branchId = null, afterEventSeq = null, limit = 200 } = {}
) {
  const url = new URL(`${apiBase}/galaxies/${galaxyId}/star-core/physics/planets`);
  if (branchId) {
    url.searchParams.set("branch_id", String(branchId));
  }
  if (Number.isFinite(afterEventSeq) && Number(afterEventSeq) >= 0) {
    url.searchParams.set("after_event_seq", String(Math.floor(Number(afterEventSeq))));
  }
  if (Number.isFinite(limit)) {
    url.searchParams.set("limit", String(Math.max(1, Math.min(1000, Math.floor(Number(limit))))));
  }
  return url.toString();
}

export function buildStarCorePulseUrl(apiBase, galaxyId, { branchId = null, afterEventSeq = null, limit = 64 } = {}) {
  const url = new URL(`${apiBase}/galaxies/${galaxyId}/star-core/pulse`);
  if (branchId) {
    url.searchParams.set("branch_id", String(branchId));
  }
  if (Number.isFinite(afterEventSeq) && Number(afterEventSeq) >= 0) {
    url.searchParams.set("after_event_seq", String(Math.floor(Number(afterEventSeq))));
  }
  if (Number.isFinite(limit)) {
    url.searchParams.set("limit", String(Math.max(1, Math.min(256, Math.floor(Number(limit))))));
  }
  return url.toString();
}

export function buildStarCoreDomainMetricsUrl(apiBase, galaxyId, { branchId = null, windowEvents = 240 } = {}) {
  const url = new URL(`${apiBase}/galaxies/${galaxyId}/star-core/metrics/domains`);
  if (branchId) {
    url.searchParams.set("branch_id", String(branchId));
  }
  if (Number.isFinite(windowEvents)) {
    url.searchParams.set("window_events", String(Math.max(32, Math.min(512, Math.floor(Number(windowEvents))))));
  }
  return url.toString();
}

export function buildImportRunUrl(apiBase) {
  return `${apiBase}/io/imports`;
}

export function buildImportJobUrl(apiBase, jobId) {
  return `${apiBase}/io/imports/${jobId}`;
}

export function buildImportJobErrorsUrl(apiBase, jobId) {
  return `${apiBase}/io/imports/${jobId}/errors`;
}

export function buildSnapshotExportUrl(
  apiBase,
  { format = "csv", galaxyId = null, branchId = null, asOfIso = null } = {}
) {
  const url = new URL(`${apiBase}/io/exports/snapshot`);
  url.searchParams.set("format", String(format || "csv"));
  if (galaxyId) {
    url.searchParams.set("galaxy_id", galaxyId);
  }
  if (branchId) {
    url.searchParams.set("branch_id", branchId);
  }
  if (asOfIso) {
    url.searchParams.set("as_of", asOfIso);
  }
  return url.toString();
}

export function buildTablesExportUrl(
  apiBase,
  { format = "csv", galaxyId = null, branchId = null, asOfIso = null } = {}
) {
  const url = new URL(`${apiBase}/io/exports/tables`);
  url.searchParams.set("format", String(format || "csv"));
  if (galaxyId) {
    url.searchParams.set("galaxy_id", galaxyId);
  }
  if (branchId) {
    url.searchParams.set("branch_id", branchId);
  }
  if (asOfIso) {
    url.searchParams.set("as_of", asOfIso);
  }
  return url.toString();
}

export function normalizeSnapshot(data) {
  const asteroidSource = Array.isArray(data?.asteroids) ? data.asteroids : Array.isArray(data?.atoms) ? data.atoms : [];
  const asteroids = asteroidSource.filter((asteroid) => asteroid?.is_deleted !== true);
  const asteroidIdSet = new Set(asteroids.map((asteroid) => asteroid.id));
  const bonds = Array.isArray(data?.bonds)
    ? data.bonds.filter(
        (bond) => bond?.is_deleted !== true && asteroidIdSet.has(bond.source_id) && asteroidIdSet.has(bond.target_id)
      )
    : [];

  return { asteroids, bonds };
}
