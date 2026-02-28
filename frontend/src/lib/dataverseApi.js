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

export function buildParserPayload(command, galaxyId = null) {
  const trimmed = typeof command === "string" ? command.trim() : "";
  const payload = {
    query: trimmed,
    text: trimmed
  };
  if (galaxyId) {
    payload.galaxy_id = galaxyId;
  }
  return payload;
}

export function toAsOfIso(value) {
  if (!value) return null;
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return null;
  return date.toISOString();
}

export function buildSnapshotUrl(apiBase, asOfIso = null, galaxyId = null) {
  const url = new URL(`${apiBase}/universe/snapshot`);
  if (asOfIso) {
    url.searchParams.set("as_of", asOfIso);
  }
  if (galaxyId) {
    url.searchParams.set("galaxy_id", galaxyId);
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
