import { describe, expect, it } from "vitest";

import {
  CIVILIZATION_SNAPSHOT_ASTEROID_BE_FIELDS,
  CIVILIZATION_SNAPSHOT_ASTEROID_FE_USED_FIELDS,
  GALAXY_WORKSPACE_BE_FIELDS,
  GALAXY_WORKSPACE_FE_USED_FIELDS,
  MINERAL_FACT_BE_FIELDS,
  MINERAL_FACT_FE_USED_FIELDS,
  MOON_SUMMARY_BE_FIELDS,
  MOON_SUMMARY_FE_USED_FIELDS,
  workspaceContractDiff,
} from "./workspaceContract";

describe("workspaceContract baselines", () => {
  it("keeps frozen BE field inventories for workspace/civilization/moon/mineral", () => {
    expect(GALAXY_WORKSPACE_BE_FIELDS).toEqual(["id", "name", "owner_id", "created_at", "deleted_at"]);
    expect(CIVILIZATION_SNAPSHOT_ASTEROID_BE_FIELDS).toEqual([
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
    expect(MOON_SUMMARY_BE_FIELDS).toEqual([
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
    expect(MINERAL_FACT_BE_FIELDS).toEqual([
      "key",
      "typed_value",
      "value_type",
      "source",
      "status",
      "unit",
      "readonly",
      "errors",
    ]);
  });

  it("uses only BE-defined fields in FE contracts", () => {
    const report = workspaceContractDiff();
    expect(report.galaxy_workspace.extra_in_fe).toEqual([]);
    expect(report.civilization_snapshot_asteroid.extra_in_fe).toEqual([]);
    expect(report.moon_summary.extra_in_fe).toEqual([]);
    expect(report.mineral_fact.extra_in_fe).toEqual([]);
  });

  it("keeps mandatory FE-used fields for runtime workspace operations", () => {
    expect(GALAXY_WORKSPACE_FE_USED_FIELDS).toEqual(["id", "name"]);
    expect(CIVILIZATION_SNAPSHOT_ASTEROID_FE_USED_FIELDS).toEqual([
      "id",
      "value",
      "table_id",
      "table_name",
      "metadata",
      "calculated_values",
      "current_event_seq",
      "physics",
    ]);
    expect(MOON_SUMMARY_FE_USED_FIELDS).toEqual([
      "asteroid_id",
      "label",
      "table_id",
      "table_name",
      "constellation_name",
      "planet_name",
      "status",
    ]);
    expect(MINERAL_FACT_FE_USED_FIELDS).toEqual(["key", "typed_value", "value_type", "source", "status", "errors"]);
  });
});
