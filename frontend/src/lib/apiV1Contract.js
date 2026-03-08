function normalizeSignatures(values) {
  return [
    ...new Set((Array.isArray(values) ? values : []).map((item) => String(item || "").trim()).filter(Boolean)),
  ].sort();
}

export const API_V1_CONTRACT_VERSION = "1.0.0";
export const API_V1_CONTRACT_SCOPE = "api-v1-openapi-freeze";
export const API_V1_CONTRACT_DOC = "docs/contracts/api-v1.md";

export const API_V1_AUTH_SESSION_SIGNATURES = Object.freeze([
  "GET /auth/me",
  "POST /auth/login",
  "POST /auth/logout",
  "POST /auth/refresh",
  "POST /auth/register",
]);

export const API_V1_FE_HELPER_SIGNATURES = Object.freeze([
  "GET /branches",
  "GET /civilizations",
  "GET /civilizations/{civilization_id}",
  "GET /contracts/{table_id}",
  "GET /galaxies/{galaxy_id}/bonds",
  "GET /galaxies/{galaxy_id}/events/stream",
  "GET /galaxies/{galaxy_id}/moons",
  "GET /galaxies/{galaxy_id}/onboarding",
  "GET /galaxies/{galaxy_id}/planets",
  "GET /galaxies/{galaxy_id}/star-core/metrics/domains",
  "GET /galaxies/{galaxy_id}/star-core/physics/planets",
  "GET /galaxies/{galaxy_id}/star-core/physics/profile",
  "GET /galaxies/{galaxy_id}/star-core/policy",
  "GET /galaxies/{galaxy_id}/star-core/pulse",
  "GET /galaxies/{galaxy_id}/star-core/runtime",
  "GET /io/exports/snapshot",
  "GET /io/exports/tables",
  "GET /io/imports/{job_id}",
  "GET /io/imports/{job_id}/errors",
  "GET /moons",
  "GET /moons/{moon_id}",
  "GET /presets/catalog",
  "GET /universe/snapshot",
  "GET /universe/tables",
  "PATCH /asteroids/{asteroid_id}/extinguish",
  "PATCH /bonds/{bond_id}/extinguish",
  "PATCH /civilizations/{civilization_id}/extinguish",
  "PATCH /civilizations/{civilization_id}/mutate",
  "PATCH /galaxies/{galaxy_id}/extinguish",
  "PATCH /moons/{moon_id}/extinguish",
  "PATCH /moons/{moon_id}/mutate",
  "PATCH /planets/{table_id}/extinguish",
  "POST /galaxies/{galaxy_id}/star-core/policy/lock",
  "POST /io/imports",
  "POST /presets/apply",
  "POST /civilizations",
  "POST /moons",
]);

export const API_V1_FE_LITERAL_SIGNATURES = Object.freeze([
  "GET /galaxies",
  "PATCH /asteroids/{asteroid_id}/mutate",
  "POST /asteroids/ingest",
  "POST /bonds/link",
  "POST /contracts/{table_id}",
  "POST /galaxies",
  "POST /parser/plan",
  "POST /parser/execute",
  "POST /planets",
  "POST /tasks/execute-batch",
]);

export const API_V1_FE_ENDPOINT_SIGNATURES = Object.freeze(
  normalizeSignatures([
    ...API_V1_AUTH_SESSION_SIGNATURES,
    ...API_V1_FE_HELPER_SIGNATURES,
    ...API_V1_FE_LITERAL_SIGNATURES,
  ])
);

export const API_V1_SOFT_DELETE_SIGNATURES = Object.freeze([
  "PATCH /asteroids/{asteroid_id}/extinguish",
  "PATCH /bonds/{bond_id}/extinguish",
  "PATCH /civilizations/{civilization_id}/extinguish",
  "PATCH /galaxies/{galaxy_id}/extinguish",
  "PATCH /moons/{moon_id}/extinguish",
  "PATCH /planets/{table_id}/extinguish",
]);

export const API_V1_SOFT_DELETE_ROUTE_PREFIXES = Object.freeze([
  "/asteroids",
  "/bonds",
  "/civilizations",
  "/galaxies",
  "/moons",
  "/planets",
]);

export function apiV1ContractDiff({ openApiSignatures = [], feSignatures = API_V1_FE_ENDPOINT_SIGNATURES } = {}) {
  const openApi = new Set(normalizeSignatures(openApiSignatures));
  const fe = normalizeSignatures(feSignatures);
  return {
    fe_not_in_openapi: fe.filter((signature) => !openApi.has(signature)),
    openapi_not_used_by_fe: [...openApi].filter((signature) => !fe.includes(signature)).sort(),
  };
}
