import { describe, expect, it } from "vitest";

import {
  STAGE_ZERO_CASHFLOW_STEPS,
  buildStageZeroCameraMicroNudgeKey,
  buildStageZeroFieldTypes,
  buildStageZeroRequiredFields,
  buildStageZeroSchemaPreview,
  createStageZeroSchemaDraft,
  isStageZeroStepUnlocked,
  resolveStageZeroPlanetVisualBoost,
  summarizeStageZeroSchemaDraft,
} from "./stageZeroBuilder";

describe("stage zero builder", () => {
  it("creates empty schema draft from step definitions", () => {
    const draft = createStageZeroSchemaDraft();
    expect(Object.keys(draft)).toEqual(STAGE_ZERO_CASHFLOW_STEPS.map((item) => item.key));
    expect(Object.values(draft)).toEqual([false, false, false]);
  });

  it("summarizes progress and next step", () => {
    const summary = summarizeStageZeroSchemaDraft({
      transactionName: true,
      amount: false,
      transactionType: false,
    });
    expect(summary.completed).toBe(1);
    expect(summary.total).toBe(3);
    expect(summary.ratio).toBeCloseTo(1 / 3, 4);
    expect(summary.allDone).toBe(false);
    expect(summary.nextStepKey).toBe("amount");
  });

  it("unlocks schema steps progressively", () => {
    const draft = {
      transactionName: true,
      amount: false,
      transactionType: false,
    };
    expect(isStageZeroStepUnlocked(0, draft)).toBe(true);
    expect(isStageZeroStepUnlocked(1, draft)).toBe(true);
    expect(isStageZeroStepUnlocked(2, draft)).toBe(false);
  });

  it("builds preview rows and schema contract fields", () => {
    const preview = buildStageZeroSchemaPreview({
      transactionName: true,
      amount: true,
      transactionType: false,
    });
    expect(preview[0]).toMatchObject({ label: "transaction_name", done: true, type: "text" });
    expect(preview[2]).toMatchObject({ label: "transaction_type", done: false, type: "enum(INCOME|EXPENSE)" });
    expect(buildStageZeroRequiredFields()).toEqual(["transaction_name", "amount", "transaction_type"]);
    expect(buildStageZeroFieldTypes()).toEqual({
      value: "string",
      transaction_name: "string",
      amount: "number",
      transaction_type: "string",
    });
  });

  it("maps progress to visual boost for immediate planet feedback", () => {
    const boost = resolveStageZeroPlanetVisualBoost({
      transactionName: true,
      amount: true,
      transactionType: false,
    });
    expect(boost.completed).toBe(2);
    expect(boost.ratio).toBeCloseTo(2 / 3, 4);
    expect(boost.radiusFactorBoost).toBeGreaterThan(1);
    expect(boost.emissiveBoost).toBeGreaterThan(0);
    expect(boost.previewMoonCount).toBe(2);
  });

  it("builds camera micro nudge key only for active stage0 setup", () => {
    expect(
      buildStageZeroCameraMicroNudgeKey({
        setupOpen: false,
        presetSelected: true,
        tableId: "table-1",
        completed: 1,
      })
    ).toBe("");
    expect(
      buildStageZeroCameraMicroNudgeKey({
        setupOpen: true,
        presetSelected: false,
        tableId: "table-1",
        completed: 1,
      })
    ).toBe("");
    expect(
      buildStageZeroCameraMicroNudgeKey({
        setupOpen: true,
        presetSelected: true,
        tableId: "",
        completed: 1,
      })
    ).toBe("");
    expect(
      buildStageZeroCameraMicroNudgeKey({
        setupOpen: true,
        presetSelected: true,
        tableId: "table-1",
        completed: 1,
      })
    ).toBe("stage0:table-1:1");
  });

  it("generates deterministic nudge sequence for lego progress 0->1->2->3", () => {
    const base = {
      setupOpen: true,
      presetSelected: true,
      tableId: "planet-42",
    };
    const keys = [0, 1, 2, 3].map((completed) =>
      buildStageZeroCameraMicroNudgeKey({
        ...base,
        completed,
      })
    );
    expect(keys).toEqual(["stage0:planet-42:0", "stage0:planet-42:1", "stage0:planet-42:2", "stage0:planet-42:3"]);
    expect(new Set(keys).size).toBe(4);
  });
});
