function normalize(values) {
  return [
    ...new Set((Array.isArray(values) ? values : []).map((item) => String(item || "").trim()).filter(Boolean)),
  ].sort();
}

function diff(required, provided) {
  const be = new Set(normalize(required));
  const fe = new Set(normalize(provided));
  return {
    missing_in_fe: [...be].filter((item) => !fe.has(item)).sort(),
    extra_in_fe: [...fe].filter((item) => !be.has(item)).sort(),
  };
}

export const TABLE_CONTRACT_VERSION = "1.0.0";
export const TABLE_CONTRACT_SCOPE = "table-contract-v1";
export const TABLE_CONTRACT_DOC = "docs/P0-core/contracts/table-contract-v1.md";

export const SNAPSHOT_ASTEROID_TABLE_BE_FIELDS = Object.freeze(["table_id", "table_name"]);
export const SNAPSHOT_ASTEROID_TABLE_FE_USED_FIELDS = Object.freeze(["table_id", "table_name"]);

export const SNAPSHOT_BOND_TABLE_BE_FIELDS = Object.freeze([
  "source_table_id",
  "source_table_name",
  "target_table_id",
  "target_table_name",
]);
export const SNAPSHOT_BOND_TABLE_FE_USED_FIELDS = Object.freeze([
  "source_table_id",
  "source_table_name",
  "target_table_id",
  "target_table_name",
]);

export const TABLES_RESPONSE_BE_FIELDS = Object.freeze(["tables"]);
export const TABLES_RESPONSE_FE_USED_FIELDS = Object.freeze(["tables"]);

export const TABLE_ROW_BE_FIELDS = Object.freeze([
  "table_id",
  "galaxy_id",
  "name",
  "constellation_name",
  "planet_name",
  "archetype",
  "contract_version",
  "schema_fields",
  "formula_fields",
  "members",
  "internal_bonds",
  "external_bonds",
  "sector",
]);

export const TABLE_ROW_FE_USED_FIELDS = Object.freeze([
  "table_id",
  "galaxy_id",
  "name",
  "constellation_name",
  "planet_name",
  "archetype",
  "contract_version",
  "schema_fields",
  "formula_fields",
  "members",
  "internal_bonds",
  "external_bonds",
  "sector",
]);

export const TABLE_MEMBER_BE_FIELDS = Object.freeze(["id", "value", "created_at"]);
export const TABLE_MEMBER_FE_USED_FIELDS = Object.freeze(["id", "value", "created_at"]);

export const TABLE_BOND_BE_FIELDS = Object.freeze([
  "id",
  "source_id",
  "target_id",
  "type",
  "directional",
  "flow_direction",
  "peer_table_id",
  "peer_table_name",
]);
export const TABLE_BOND_FE_USED_FIELDS = Object.freeze([
  "id",
  "source_id",
  "target_id",
  "type",
  "directional",
  "flow_direction",
  "peer_table_id",
  "peer_table_name",
]);

export const TABLE_SECTOR_BE_FIELDS = Object.freeze(["center", "size", "mode", "grid_plate"]);
export const TABLE_SECTOR_FE_USED_FIELDS = Object.freeze(["center", "size", "mode", "grid_plate"]);

export function tableContractDiff() {
  return {
    snapshot_asteroid_table: diff(SNAPSHOT_ASTEROID_TABLE_BE_FIELDS, SNAPSHOT_ASTEROID_TABLE_FE_USED_FIELDS),
    snapshot_bond_table: diff(SNAPSHOT_BOND_TABLE_BE_FIELDS, SNAPSHOT_BOND_TABLE_FE_USED_FIELDS),
    tables_response: diff(TABLES_RESPONSE_BE_FIELDS, TABLES_RESPONSE_FE_USED_FIELDS),
    table_row: diff(TABLE_ROW_BE_FIELDS, TABLE_ROW_FE_USED_FIELDS),
    table_member: diff(TABLE_MEMBER_BE_FIELDS, TABLE_MEMBER_FE_USED_FIELDS),
    table_bond: diff(TABLE_BOND_BE_FIELDS, TABLE_BOND_FE_USED_FIELDS),
    table_sector: diff(TABLE_SECTOR_BE_FIELDS, TABLE_SECTOR_FE_USED_FIELDS),
  };
}
