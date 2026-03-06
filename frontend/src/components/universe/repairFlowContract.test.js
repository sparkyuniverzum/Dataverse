import { describe, expect, it } from "vitest";

import {
  buildGuidedRepairAuditRecord,
  buildGuidedRepairMessage,
  buildGuidedRepairMutationRequest,
  resolveGuidedRepairSuggestion,
} from "./repairFlowContract";

describe("repairFlowContract", () => {
  it("builds deterministic suggestion for required fields", () => {
    const error = {
      detail: {
        code: "TABLE_CONTRACT_VIOLATION",
        table_name: "Finance > Cashflow",
        reason: "required_missing",
        mineral_key: "entity_id",
        expected_type: "text",
        source: "contract",
      },
    };
    const first = resolveGuidedRepairSuggestion(error, {
      operation: "create",
      civilizationId: "civ-1",
    });
    const second = resolveGuidedRepairSuggestion(error, {
      operation: "create",
      civilizationId: "civ-1",
    });

    expect(first).toBeTruthy();
    expect(second).toBeTruthy();
    expect(first).toEqual(second);
    expect(first.id).toMatch(/^repair-[0-9a-f]{8}$/);
    expect(first.idempotency_key).toBe(`repair-civ-1-${first.fingerprint}`);
    expect(first.suggested_typed_value).toBe("auto-repair");
  });

  it("coerces type mismatch into deterministic typed patch", () => {
    const suggestion = resolveGuidedRepairSuggestion(
      {
        detail: {
          code: "TABLE_CONTRACT_VIOLATION",
          table_name: "Finance > Cashflow",
          reason: "type_mismatch",
          mineral_key: "amount",
          actual_value: "abc",
          expected_type: "number",
          source: "contract",
        },
      },
      { operation: "mutate", civilizationId: "civ-2" }
    );

    expect(suggestion).toBeTruthy();
    expect(suggestion.strategy_key).toBe("coerce_type");
    expect(suggestion.suggested_typed_value).toBe(0);
  });

  it("uses validator target when provided", () => {
    const suggestion = resolveGuidedRepairSuggestion(
      {
        detail: {
          code: "TABLE_CONTRACT_VIOLATION",
          table_name: "Finance > Cashflow",
          reason: "validator_failed",
          mineral_key: "state",
          actual_value: "archived",
          expected_type: "text",
          operator: "==",
          expected_value: "active",
          source: "moon_capability",
          capability_key: "cashflow.lifecycle",
        },
      },
      { operation: "mutate", civilizationId: "civ-3" }
    );

    expect(suggestion).toBeTruthy();
    expect(suggestion.strategy_key).toBe("align_validator");
    expect(suggestion.suggested_typed_value).toBe("active");
    expect(buildGuidedRepairMessage(suggestion)).toContain("state -> active");
  });

  it("builds idempotent mutation request and auditable records", () => {
    const suggestion = resolveGuidedRepairSuggestion(
      {
        detail: {
          code: "TABLE_CONTRACT_VIOLATION",
          table_name: "Finance > Cashflow",
          reason: "required_missing",
          mineral_key: "entity_id",
          expected_type: "text",
          source: "contract",
        },
      },
      { operation: "mutate", civilizationId: "civ-9" }
    );
    const requestOne = buildGuidedRepairMutationRequest(suggestion, {
      galaxyId: "g-1",
      expectedEventSeq: 7,
    });
    const requestTwo = buildGuidedRepairMutationRequest(suggestion, {
      galaxyId: "g-1",
      expectedEventSeq: 7,
    });
    expect(requestOne).toEqual(requestTwo);
    expect(requestOne.payload.idempotency_key).toBe(suggestion.idempotency_key);
    expect(requestOne.payload.minerals).toEqual({ entity_id: "auto-repair" });
    expect(requestOne.payload.expected_event_seq).toBe(7);

    const planned = buildGuidedRepairAuditRecord(suggestion, {
      stage: "planned",
      occurredAtIso: "2026-03-06T10:00:00.000Z",
    });
    const applied = buildGuidedRepairAuditRecord(suggestion, {
      stage: "applied",
      occurredAtIso: "2026-03-06T10:01:00.000Z",
    });
    expect(planned.repair_id).toBe(applied.repair_id);
    expect(planned.idempotency_key).toBe(applied.idempotency_key);
    expect(planned.stage).toBe("planned");
    expect(applied.stage).toBe("applied");
  });

  it("returns null for unsupported violations", () => {
    const suggestion = resolveGuidedRepairSuggestion(
      {
        detail: {
          code: "TABLE_CONTRACT_VIOLATION",
          reason: "forbidden_branch",
          mineral_key: "state",
        },
      },
      { civilizationId: "civ-x" }
    );
    expect(suggestion).toBeNull();
  });
});
