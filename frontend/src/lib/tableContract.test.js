import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";

import { buildSnapshotUrl, buildTablesUrl } from "./dataverseApi";
import {
  SNAPSHOT_ASTEROID_TABLE_BE_FIELDS,
  SNAPSHOT_BOND_TABLE_BE_FIELDS,
  TABLE_BOND_BE_FIELDS,
  TABLE_CONTRACT_DOC,
  TABLE_CONTRACT_SCOPE,
  TABLE_CONTRACT_VERSION,
  TABLE_MEMBER_BE_FIELDS,
  TABLE_ROW_BE_FIELDS,
  TABLE_SECTOR_BE_FIELDS,
  TABLES_RESPONSE_BE_FIELDS,
  tableContractDiff,
} from "./tableContract";

function routeSignatureFromUrl(urlText, method = "GET") {
  const url = new URL(urlText);
  return `${method.toUpperCase()} ${url.pathname}`;
}

describe("table contract FE freeze gate", () => {
  it("matches frozen table contract envelope and doc markers", () => {
    const docPath = fileURLToPath(new URL("../../../docs/P0-core/contracts/table-contract-v1.md", import.meta.url));
    const contractDoc = readFileSync(docPath, "utf-8");

    expect(TABLE_CONTRACT_VERSION).toBe("1.0.0");
    expect(TABLE_CONTRACT_SCOPE).toBe("table-contract-v1");
    expect(TABLE_CONTRACT_DOC).toBe("docs/P0-core/contracts/table-contract-v1.md");
    expect(contractDoc).toContain("## `/universe/snapshot` table fields");
    expect(contractDoc).toContain("## `/universe/tables` aggregate contract");
    expect(contractDoc).toContain("## Sector projection rules");
  });

  it("keeps read-model route mapping stable for table projection", () => {
    const snapshotUrl = buildSnapshotUrl("http://127.0.0.1:8000", null, "g-1");
    const tablesUrl = buildTablesUrl("http://127.0.0.1:8000", null, "g-1");

    expect(routeSignatureFromUrl(snapshotUrl)).toBe("GET /universe/snapshot");
    expect(routeSignatureFromUrl(tablesUrl)).toBe("GET /universe/tables");
  });

  it("keeps frozen BE field inventories for snapshot/tables/table-rows", () => {
    expect(SNAPSHOT_ASTEROID_TABLE_BE_FIELDS).toEqual(["table_id", "table_name"]);
    expect(SNAPSHOT_BOND_TABLE_BE_FIELDS).toEqual([
      "source_table_id",
      "source_table_name",
      "target_table_id",
      "target_table_name",
    ]);
    expect(TABLES_RESPONSE_BE_FIELDS).toEqual(["tables"]);
    expect(TABLE_ROW_BE_FIELDS).toEqual([
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
    expect(TABLE_MEMBER_BE_FIELDS).toEqual(["id", "value", "created_at"]);
    expect(TABLE_BOND_BE_FIELDS).toEqual([
      "id",
      "source_id",
      "target_id",
      "type",
      "directional",
      "flow_direction",
      "peer_table_id",
      "peer_table_name",
    ]);
    expect(TABLE_SECTOR_BE_FIELDS).toEqual(["center", "size", "mode", "grid_plate"]);
  });

  it("uses only BE-defined table contract fields in FE gate", () => {
    const report = tableContractDiff();
    expect(report.snapshot_asteroid_table.missing_in_fe).toEqual([]);
    expect(report.snapshot_asteroid_table.extra_in_fe).toEqual([]);
    expect(report.snapshot_bond_table.missing_in_fe).toEqual([]);
    expect(report.snapshot_bond_table.extra_in_fe).toEqual([]);
    expect(report.tables_response.missing_in_fe).toEqual([]);
    expect(report.tables_response.extra_in_fe).toEqual([]);
    expect(report.table_row.missing_in_fe).toEqual([]);
    expect(report.table_row.extra_in_fe).toEqual([]);
    expect(report.table_member.missing_in_fe).toEqual([]);
    expect(report.table_member.extra_in_fe).toEqual([]);
    expect(report.table_bond.missing_in_fe).toEqual([]);
    expect(report.table_bond.extra_in_fe).toEqual([]);
    expect(report.table_sector.missing_in_fe).toEqual([]);
    expect(report.table_sector.extra_in_fe).toEqual([]);
  });
});
