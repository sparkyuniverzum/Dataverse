function normalize(fields) {
  return [
    ...new Set((Array.isArray(fields) ? fields : []).map((item) => String(item || "").trim()).filter(Boolean)),
  ].sort();
}

function diff(beFields, feFields) {
  const be = new Set(normalize(beFields));
  const fe = new Set(normalize(feFields));
  return {
    missing_in_fe: [...be].filter((field) => !fe.has(field)).sort(),
    extra_in_fe: [...fe].filter((field) => !be.has(field)).sort(),
  };
}

export const GALAXY_WORKSPACE_BE_FIELDS = Object.freeze(["id", "name", "owner_id", "created_at", "deleted_at"]);

export const GALAXY_WORKSPACE_FE_USED_FIELDS = Object.freeze(["id", "name"]);

export const CIVILIZATION_SNAPSHOT_ASTEROID_BE_FIELDS = Object.freeze([
  "id",
  "value",
  "table_id",
  "table_name",
  "constellation_name",
  "planet_name",
  "metadata",
  "calculated_values",
  "calc_errors",
  "error_count",
  "circular_fields_count",
  "active_alerts",
  "physics",
  "facts",
  "created_at",
  "current_event_seq",
]);

export const CIVILIZATION_SNAPSHOT_ASTEROID_FE_USED_FIELDS = Object.freeze([
  "id",
  "value",
  "table_id",
  "table_name",
  "metadata",
  "calculated_values",
  "current_event_seq",
  "physics",
]);

export const MOON_SUMMARY_BE_FIELDS = Object.freeze([
  "asteroid_id",
  "label",
  "table_id",
  "table_name",
  "constellation_name",
  "planet_name",
  "metadata_fields_count",
  "calculated_fields_count",
  "guardian_rules_count",
  "active_alerts_count",
  "circular_fields_count",
  "quality_score",
  "status",
  "created_at",
]);

export const MOON_SUMMARY_FE_USED_FIELDS = Object.freeze([
  "asteroid_id",
  "label",
  "table_id",
  "table_name",
  "constellation_name",
  "planet_name",
  "status",
]);

export const MINERAL_FACT_BE_FIELDS = Object.freeze([
  "key",
  "typed_value",
  "value_type",
  "source",
  "status",
  "unit",
  "readonly",
  "errors",
]);

export const MINERAL_FACT_FE_USED_FIELDS = Object.freeze([
  "key",
  "typed_value",
  "value_type",
  "source",
  "status",
  "errors",
]);

export function workspaceContractDiff() {
  return {
    galaxy_workspace: diff(GALAXY_WORKSPACE_BE_FIELDS, GALAXY_WORKSPACE_FE_USED_FIELDS),
    civilization_snapshot_asteroid: diff(
      CIVILIZATION_SNAPSHOT_ASTEROID_BE_FIELDS,
      CIVILIZATION_SNAPSHOT_ASTEROID_FE_USED_FIELDS
    ),
    moon_summary: diff(MOON_SUMMARY_BE_FIELDS, MOON_SUMMARY_FE_USED_FIELDS),
    mineral_fact: diff(MINERAL_FACT_BE_FIELDS, MINERAL_FACT_FE_USED_FIELDS),
  };
}
