function normalizeSignatures(values) {
  return [
    ...new Set((Array.isArray(values) ? values : []).map((item) => String(item || "").trim()).filter(Boolean)),
  ].sort();
}

export const API_V1_CONTRACT_VERSION = "1.0.0";
export const API_V1_CONTRACT_SCOPE = "fe-active-runtime-surface";
export const API_V1_CONTRACT_DOC = "docs/contracts/fe/fe-be-active-runtime-baseline-v1CZ.md";

export const API_V1_AUTH_SESSION_SIGNATURES = Object.freeze([
  "DELETE /auth/me",
  "PATCH /auth/me",
  "POST /auth/forgot-password",
  "GET /auth/me",
  "POST /auth/login",
  "POST /auth/logout",
  "POST /auth/refresh",
  "POST /auth/register",
  "POST /auth/reset-password",
]);

export const API_V1_FE_HELPER_SIGNATURES = Object.freeze([
  "GET /galaxies/{galaxy_id}/planets",
  "GET /galaxies/{galaxy_id}/star-core/metrics/domains",
  "GET /galaxies/{galaxy_id}/star-core/interior",
  "GET /galaxies/{galaxy_id}/star-core/physics/planets",
  "GET /galaxies/{galaxy_id}/star-core/physics/profile",
  "GET /galaxies/{galaxy_id}/star-core/policy",
  "GET /galaxies/{galaxy_id}/star-core/pulse",
  "GET /galaxies/{galaxy_id}/star-core/runtime",
  "GET /universe/snapshot",
  "GET /universe/tables",
  "POST /galaxies/{galaxy_id}/star-core/interior/constitution/select",
  "POST /galaxies/{galaxy_id}/star-core/interior/entry/start",
  "POST /galaxies/{galaxy_id}/star-core/policy/lock",
]);

export const API_V1_FE_LITERAL_SIGNATURES = Object.freeze([
  "GET /galaxies",
  "POST /galaxies",
  "POST /parser/plan",
  "POST /tasks/execute-batch",
]);

export const API_V1_FE_ENDPOINT_SIGNATURES = Object.freeze(
  normalizeSignatures([
    ...API_V1_AUTH_SESSION_SIGNATURES,
    ...API_V1_FE_HELPER_SIGNATURES,
    ...API_V1_FE_LITERAL_SIGNATURES,
  ])
);

export const API_V1_SOFT_DELETE_SIGNATURES = Object.freeze([]);

export const API_V1_SOFT_DELETE_ROUTE_PREFIXES = Object.freeze([]);

export function apiV1ContractDiff({ openApiSignatures = [], feSignatures = API_V1_FE_ENDPOINT_SIGNATURES } = {}) {
  const openApi = new Set(normalizeSignatures(openApiSignatures));
  const fe = normalizeSignatures(feSignatures);
  return {
    fe_not_in_openapi: fe.filter((signature) => !openApi.has(signature)),
    openapi_not_used_by_fe: [...openApi].filter((signature) => !fe.includes(signature)).sort(),
  };
}
