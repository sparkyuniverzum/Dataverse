import { describe, expect, it } from "vitest";

import {
  buildContractViolationMessage,
  CONTRACT_VIOLATION_DETAIL_BE_FIELDS,
  CONTRACT_VIOLATION_DETAIL_FE_USED_FIELDS,
  explainabilityContractDiff,
  isContractViolationDetail,
  normalizeContractViolationDetail,
} from "./workspaceContractExplainability";

describe("workspaceContractExplainability", () => {
  it("keeps frozen BE/FE field inventory for contract explainability payload", () => {
    expect(CONTRACT_VIOLATION_DETAIL_BE_FIELDS).toEqual([
      "code",
      "message",
      "table_name",
      "reason",
      "mineral_key",
      "actual_value",
      "expected_type",
      "operator",
      "expected_value",
      "rule_id",
      "source",
      "capability_key",
      "capability_id",
    ]);
    expect(CONTRACT_VIOLATION_DETAIL_FE_USED_FIELDS).toEqual([
      "code",
      "table_name",
      "reason",
      "mineral_key",
      "actual_value",
      "expected_type",
      "operator",
      "expected_value",
      "rule_id",
      "source",
      "capability_key",
    ]);

    const report = explainabilityContractDiff();
    expect(report.extra_in_fe).toEqual([]);
  });

  it("normalizes contract violation detail from api error envelope", () => {
    const normalized = normalizeContractViolationDetail({
      detail: {
        code: "TABLE_CONTRACT_VIOLATION",
        table_name: "Finance > Cashflow",
        reason: "validator_failed",
        mineral_key: "state",
        actual_value: "archived",
        operator: "==",
        expected_value: "active",
        rule_id: "state-guard",
        source: "moon_capability",
        capability_key: "cashflow.validation",
        capability_id: "11111111-1111-1111-1111-111111111111",
      },
    });
    expect(normalized.code).toBe("TABLE_CONTRACT_VIOLATION");
    expect(normalized.table_name).toBe("Finance > Cashflow");
    expect(normalized.reason).toBe("validator_failed");
    expect(normalized.mineral_key).toBe("state");
    expect(normalized.actual_value).toBe("archived");
    expect(normalized.rule_id).toBe("state-guard");
    expect(normalized.capability_key).toBe("cashflow.validation");
    expect(normalized.capability_id).toBe("11111111-1111-1111-1111-111111111111");
    expect(isContractViolationDetail({ detail: normalized })).toBe(true);
  });

  it("builds deterministic operator-facing message for contract violations", () => {
    const message = buildContractViolationMessage(
      {
        detail: {
          code: "TABLE_CONTRACT_VIOLATION",
          table_name: "Finance > Cashflow",
          reason: "validator_failed",
          mineral_key: "state",
          actual_value: "archived",
          operator: "==",
          expected_value: "active",
          rule_id: "state-guard",
          source: "moon_capability",
          capability_key: "cashflow.validation",
        },
      },
      { fallbackMessage: "Fallback" }
    );
    expect(message).toContain("Kontrakt [Finance > Cashflow]");
    expect(message).toContain("validator kontraktu selhal");
    expect(message).toContain("nerost=state");
    expect(message).toContain("hodnota=archived");
    expect(message).toContain("podminka=== active");
    expect(message).toContain("rule_id=state-guard");
    expect(message).toContain("capability=cashflow.validation");
  });

  it("falls back for non-contract errors", () => {
    const message = buildContractViolationMessage(
      {
        detail: {
          code: "OCC_CONFLICT",
        },
      },
      { fallbackMessage: "Kolize soubezne zmeny." }
    );
    expect(message).toBe("Kolize soubezne zmeny.");
    expect(isContractViolationDetail({ detail: { code: "OCC_CONFLICT" } })).toBe(false);
  });
});
