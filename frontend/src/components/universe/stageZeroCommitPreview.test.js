import { describe, expect, it } from "vitest";

import { buildStageZeroCommitPreview } from "./stageZeroCommitPreview";

const steps = [
  { key: "a", fieldKey: "transaction_name", fieldType: "string" },
  { key: "b", fieldKey: "amount", fieldType: "number" },
  { key: "c", fieldKey: "state", fieldType: "string" },
];

describe("buildStageZeroCommitPreview", () => {
  it("builds lego preset preview from assembled blocks", () => {
    const preview = buildStageZeroCommitPreview({
      assemblyMode: "lego",
      stageZeroSteps: steps,
      stageZeroSchemaDraft: { a: true, b: true, c: true },
      existingContract: {
        required_fields: ["value", "label"],
        field_types: { value: "string", label: "string", amount: "string" },
      },
    });

    expect(preview.mode).toBe("lego");
    expect(preview.commitKind).toBe("preset_commit");
    expect(preview.estimated).toBe(true);
    expect(preview.composerFields.map((item) => item.fieldKey)).toEqual(["transaction_name", "amount", "state"]);
    expect(preview.delta.addedRequired).toContain("transaction_name");
    expect(preview.delta.addedRequired).toContain("state");
    expect(preview.delta.changedFieldTypes).toEqual([{ fieldKey: "amount", fromType: "string", toType: "number" }]);
  });

  it("builds manual contract preview from manual key/type input", () => {
    const preview = buildStageZeroCommitPreview({
      assemblyMode: "manual",
      stageZeroSteps: steps,
      stageZeroSchemaDraft: { a: true, b: true, c: true },
      manualFields: {
        a: { fieldKey: "name", fieldType: "string" },
        b: { fieldKey: "cash", fieldType: "number" },
        c: { fieldKey: "state", fieldType: "string" },
      },
      existingContract: {
        required_fields: ["value", "state"],
        field_types: { value: "string", state: "string", cash: "number" },
      },
    });

    expect(preview.mode).toBe("manual");
    expect(preview.commitKind).toBe("manual_contract_commit");
    expect(preview.estimated).toBe(false);
    expect(preview.composerFields.map((item) => `${item.fieldKey}:${item.fieldType}`)).toEqual([
      "name:string",
      "cash:number",
      "state:string",
    ]);
    expect(preview.delta.addedRequired).toContain("name");
    expect(preview.summary.fieldTypeChangedCount).toBe(0);
  });
});
