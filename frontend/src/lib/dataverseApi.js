export const API_BASE = "http://127.0.0.1:8000";

let tokenProvider = () => null;
let unauthorizedHandler = () => {};

export function configureApiAuth({ getToken, onUnauthorized } = {}) {
  tokenProvider = typeof getToken === "function" ? getToken : () => null;
  unauthorizedHandler = typeof onUnauthorized === "function" ? onUnauthorized : () => {};
}

function shouldHandleUnauthorized(url) {
  const asText = String(url || "");
  return !asText.includes("/auth/login") && !asText.includes("/auth/register");
}

export async function apiFetch(input, init = {}) {
  const headers = new Headers(init.headers || {});
  const token = tokenProvider?.();
  if (token && !headers.has("Authorization")) {
    headers.set("Authorization", `Bearer ${token}`);
  }

  const response = await fetch(input, { ...init, headers });
  if (response.status === 401 && shouldHandleUnauthorized(input)) {
    unauthorizedHandler?.();
  }
  return response;
}

export function buildParserPayload(command, galaxyId = null, branchId = null) {
  const trimmed = typeof command === "string" ? command.trim() : "";
  const payload = {
    query: trimmed,
    text: trimmed,
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

export function buildGalaxyEventsStreamUrl(apiBase, galaxyId, { branchId = null, lastEventSeq = null, pollMs = 1200, heartbeatSec = 15 } = {}) {
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

export function buildImportRunUrl(apiBase) {
  return `${apiBase}/io/imports`;
}

export function buildImportJobUrl(apiBase, jobId) {
  return `${apiBase}/io/imports/${jobId}`;
}

export function buildImportJobErrorsUrl(apiBase, jobId) {
  return `${apiBase}/io/imports/${jobId}/errors`;
}

export function buildSnapshotExportUrl(apiBase, { format = "csv", galaxyId = null, branchId = null, asOfIso = null } = {}) {
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

export function buildTablesExportUrl(apiBase, { format = "csv", galaxyId = null, branchId = null, asOfIso = null } = {}) {
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
  const asteroidSource = Array.isArray(data?.asteroids)
    ? data.asteroids
    : Array.isArray(data?.atoms)
      ? data.atoms
      : [];
  const asteroids = asteroidSource.filter((asteroid) => asteroid?.is_deleted !== true);
  const asteroidIdSet = new Set(asteroids.map((asteroid) => asteroid.id));
  const bonds = Array.isArray(data?.bonds)
    ? data.bonds.filter(
        (bond) =>
          bond?.is_deleted !== true && asteroidIdSet.has(bond.source_id) && asteroidIdSet.has(bond.target_id)
      )
    : [];

  return { asteroids, bonds };
}
