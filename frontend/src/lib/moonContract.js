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

function normalizeEndpointSignatures(values) {
  return [
    ...new Set((Array.isArray(values) ? values : []).map((item) => String(item || "").trim()).filter(Boolean)),
  ].sort();
}

function endpointDiff(beSignatures, feSignatures) {
  const be = new Set(normalizeEndpointSignatures(beSignatures));
  const fe = new Set(normalizeEndpointSignatures(feSignatures));
  return {
    missing_in_fe: [...be].filter((item) => !fe.has(item)).sort(),
    extra_in_fe: [...fe].filter((item) => !be.has(item)).sort(),
  };
}

export const MOON_CONTRACT_VERSION = "1.0.0";
export const MOON_CONTRACT_SCOPE = "moon-contract-v1";
export const MOON_CONTRACT_DOC = "docs/P0-core/contracts/moon-contract-v1.md";

export const MOON_CREATE_REQUEST_BE_FIELDS = Object.freeze([
  "planet_id",
  "label",
  "minerals",
  "idempotency_key",
  "galaxy_id",
  "branch_id",
]);

export const MOON_CREATE_REQUEST_FE_USED_FIELDS = Object.freeze([
  "planet_id",
  "label",
  "minerals",
  "idempotency_key",
  "galaxy_id",
  "branch_id",
]);

export const MOON_MUTATE_REQUEST_BE_FIELDS = Object.freeze([
  "label",
  "minerals",
  "planet_id",
  "expected_event_seq",
  "idempotency_key",
  "galaxy_id",
  "branch_id",
]);

export const MOON_MUTATE_REQUEST_FE_USED_FIELDS = Object.freeze([
  "label",
  "minerals",
  "planet_id",
  "expected_event_seq",
  "idempotency_key",
  "galaxy_id",
  "branch_id",
]);

export const MOON_ROW_PUBLIC_BE_FIELDS = Object.freeze([
  "moon_id",
  "label",
  "planet_id",
  "constellation_name",
  "planet_name",
  "created_at",
  "current_event_seq",
  "state",
  "health_score",
  "violation_count",
  "last_violation_at",
  "active_alerts",
  "facts",
]);

export const MOON_ROW_PUBLIC_FE_USED_FIELDS = Object.freeze([
  "moon_id",
  "label",
  "planet_id",
  "constellation_name",
  "planet_name",
  "created_at",
  "current_event_seq",
  "state",
  "health_score",
  "violation_count",
  "last_violation_at",
  "active_alerts",
  "facts",
]);

export const MOON_LIST_RESPONSE_BE_FIELDS = Object.freeze(["items"]);
export const MOON_LIST_RESPONSE_FE_USED_FIELDS = Object.freeze(["items"]);

export const MOON_EXTINGUISH_RESPONSE_BE_FIELDS = Object.freeze([
  "moon_id",
  "label",
  "planet_id",
  "constellation_name",
  "planet_name",
  "is_deleted",
  "deleted_at",
  "current_event_seq",
]);

export const MOON_EXTINGUISH_RESPONSE_FE_USED_FIELDS = Object.freeze([
  "moon_id",
  "label",
  "planet_id",
  "constellation_name",
  "planet_name",
  "is_deleted",
  "deleted_at",
  "current_event_seq",
]);

export const MOON_ENDPOINT_SIGNATURES = Object.freeze([
  "GET /moons",
  "GET /moons/{moon_id}",
  "POST /moons",
  "PATCH /moons/{moon_id}/mutate",
  "PATCH /moons/{moon_id}/extinguish",
]);

export const MOON_ENDPOINT_FE_USED_SIGNATURES = Object.freeze([
  "GET /moons",
  "GET /moons/{moon_id}",
  "POST /moons",
  "PATCH /moons/{moon_id}/mutate",
  "PATCH /moons/{moon_id}/extinguish",
]);

export const MOON_CONTRACT_DOC_MARKERS = Object.freeze([
  "## 5. API path mapping",
  "GET /moons",
  "POST /moons",
  "PATCH /moons/{moon_id}/mutate",
  "PATCH /moons/{moon_id}/extinguish",
]);

export function moonContractDiff() {
  return {
    moon_create_request: diff(MOON_CREATE_REQUEST_BE_FIELDS, MOON_CREATE_REQUEST_FE_USED_FIELDS),
    moon_mutate_request: diff(MOON_MUTATE_REQUEST_BE_FIELDS, MOON_MUTATE_REQUEST_FE_USED_FIELDS),
    moon_row_public: diff(MOON_ROW_PUBLIC_BE_FIELDS, MOON_ROW_PUBLIC_FE_USED_FIELDS),
    moon_list_response: diff(MOON_LIST_RESPONSE_BE_FIELDS, MOON_LIST_RESPONSE_FE_USED_FIELDS),
    moon_extinguish_response: diff(MOON_EXTINGUISH_RESPONSE_BE_FIELDS, MOON_EXTINGUISH_RESPONSE_FE_USED_FIELDS),
    moon_endpoints: endpointDiff(MOON_ENDPOINT_SIGNATURES, MOON_ENDPOINT_FE_USED_SIGNATURES),
  };
}
