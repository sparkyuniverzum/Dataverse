import { describe, expect, it } from "vitest";

import { buildMergedTableContractPayload } from "./tableContractMerge";

describe("tableContractMerge", () => {
  it("preserves existing contract blocks and appends composer fields", () => {
    const payload = buildMergedTableContractPayload({
      galaxyId: "g-1",
      existingContract: {
        required_fields: ["label", "state"],
        field_types: { label: "string", state: "string", amount: "number" },
        unique_rules: [{ keys: ["label"] }],
        validators: [{ field: "amount", kind: "min", args: { value: 0 } }],
        auto_semantics: [{ key: "state", strategy: "enum_normalize" }],
        formula_registry: [{ field: "celkem", expression: "=SUM(amount)" }],
        physics_rulebook: { rules: [{ kind: "drift" }], defaults: { dampening: 0.2 } },
      },
      composerFields: [
        { fieldKey: "amount", fieldType: "number" },
        { fieldKey: "category", fieldType: "string" },
      ],
    });

    expect(payload.galaxy_id).toBe("g-1");
    expect(payload.required_fields).toEqual(["label", "state", "amount", "category"]);
    expect(payload.field_types).toMatchObject({
      label: "string",
      state: "string",
      amount: "number",
      category: "string",
      value: "string",
    });
    expect(payload.unique_rules).toHaveLength(1);
    expect(payload.validators).toHaveLength(1);
    expect(payload.auto_semantics).toHaveLength(1);
    expect(payload.formula_registry).toHaveLength(1);
    expect(payload.physics_rulebook).toEqual({ rules: [{ kind: "drift" }], defaults: { dampening: 0.2 } });
  });
});
