import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";

import {
  MOON_CONTRACT_DOC,
  MOON_CONTRACT_DOC_MARKERS,
  MOON_CONTRACT_SCOPE,
  MOON_CONTRACT_VERSION,
  MOON_CREATE_REQUEST_BE_FIELDS,
  MOON_CREATE_REQUEST_FE_USED_FIELDS,
  MOON_ENDPOINT_FE_USED_SIGNATURES,
  MOON_ENDPOINT_SIGNATURES,
  MOON_EXTINGUISH_RESPONSE_BE_FIELDS,
  MOON_EXTINGUISH_RESPONSE_FE_USED_FIELDS,
  MOON_LIST_RESPONSE_BE_FIELDS,
  MOON_LIST_RESPONSE_FE_USED_FIELDS,
  MOON_MUTATE_REQUEST_BE_FIELDS,
  MOON_MUTATE_REQUEST_FE_USED_FIELDS,
  MOON_ROW_PUBLIC_BE_FIELDS,
  MOON_ROW_PUBLIC_FE_USED_FIELDS,
  moonContractDiff,
} from "./moonContract";

describe("moonContract FE freeze gate", () => {
  it("matches frozen moon baseline and keeps FE inventories aligned", () => {
    const baselinePath = fileURLToPath(new URL("../../../docs/moon-contract-baseline-v1.json", import.meta.url));
    const baseline = JSON.parse(readFileSync(baselinePath, "utf-8"));
    const source = baseline.source_of_truth;

    expect(MOON_CONTRACT_VERSION).toBe("1.0.0");
    expect(MOON_CONTRACT_SCOPE).toBe("moon-contract-v1");
    expect(MOON_CONTRACT_DOC).toBe("docs/contracts/moon-contract-v1.md");
    expect(baseline.version).toBe(MOON_CONTRACT_VERSION);
    expect(baseline.scope).toBe(MOON_CONTRACT_SCOPE);
    expect(baseline.contract_doc).toBe(MOON_CONTRACT_DOC);

    expect(source.moon_create_request.be_fields).toEqual(MOON_CREATE_REQUEST_BE_FIELDS);
    expect(source.moon_mutate_request.be_fields).toEqual(MOON_MUTATE_REQUEST_BE_FIELDS);
    expect(source.moon_row_public.be_fields).toEqual(MOON_ROW_PUBLIC_BE_FIELDS);
    expect(source.moon_list_response.be_fields).toEqual(MOON_LIST_RESPONSE_BE_FIELDS);
    expect(source.moon_extinguish_response.be_fields).toEqual(MOON_EXTINGUISH_RESPONSE_BE_FIELDS);
    expect(source.moon_endpoints).toEqual(MOON_ENDPOINT_SIGNATURES);
    expect(source.contract_doc_markers).toEqual(MOON_CONTRACT_DOC_MARKERS);
  });

  it("uses only BE-defined moon fields and endpoint signatures", () => {
    const report = moonContractDiff();
    expect(report.moon_create_request.extra_in_fe).toEqual([]);
    expect(report.moon_mutate_request.extra_in_fe).toEqual([]);
    expect(report.moon_row_public.extra_in_fe).toEqual([]);
    expect(report.moon_list_response.extra_in_fe).toEqual([]);
    expect(report.moon_extinguish_response.extra_in_fe).toEqual([]);
    expect(report.moon_endpoints.extra_in_fe).toEqual([]);
    expect(report.moon_endpoints.missing_in_fe).toEqual([]);
  });

  it("keeps mandatory FE-used moon contract fields stable", () => {
    expect(MOON_CREATE_REQUEST_FE_USED_FIELDS).toEqual([
      "planet_id",
      "label",
      "minerals",
      "idempotency_key",
      "galaxy_id",
      "branch_id",
    ]);
    expect(MOON_MUTATE_REQUEST_FE_USED_FIELDS).toEqual([
      "label",
      "minerals",
      "planet_id",
      "expected_event_seq",
      "idempotency_key",
      "galaxy_id",
      "branch_id",
    ]);
    expect(MOON_ROW_PUBLIC_FE_USED_FIELDS).toEqual([
      "moon_id",
      "label",
      "planet_id",
      "constellation_name",
      "planet_name",
      "created_at",
      "current_event_seq",
      "active_alerts",
      "facts",
    ]);
    expect(MOON_LIST_RESPONSE_FE_USED_FIELDS).toEqual(["items"]);
    expect(MOON_EXTINGUISH_RESPONSE_FE_USED_FIELDS).toEqual([
      "moon_id",
      "label",
      "planet_id",
      "constellation_name",
      "planet_name",
      "is_deleted",
      "deleted_at",
      "current_event_seq",
    ]);
    expect(MOON_ENDPOINT_FE_USED_SIGNATURES).toEqual([
      "GET /moons",
      "GET /moons/{moon_id}",
      "POST /moons",
      "PATCH /moons/{moon_id}/mutate",
      "PATCH /moons/{moon_id}/extinguish",
    ]);
  });
});

