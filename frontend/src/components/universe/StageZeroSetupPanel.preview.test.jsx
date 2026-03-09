/** @vitest-environment jsdom */

import React from "react";
import { cleanup, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";

import { StageZeroSetupPanel } from "./StageZeroSetupPanel";
import { STAGE_ZERO_STREAM_STEPS, buildStageZeroSchemaPreview, createStageZeroSchemaDraft } from "./stageZeroBuilder";

afterEach(() => {
  cleanup();
});

function renderPanel(overrides = {}) {
  const steps = STAGE_ZERO_STREAM_STEPS;
  const schemaDraft = createStageZeroSchemaDraft(steps);
  steps.forEach((step) => {
    schemaDraft[step.key] = true;
  });
  const schemaPreview = buildStageZeroSchemaPreview(schemaDraft, steps);

  render(
    <StageZeroSetupPanel
      stageZeroPlanetName="Core > Planeta-1"
      stageZeroPresetSelected
      stageZeroPresetCatalogLoading={false}
      stageZeroPresetCatalogError=""
      stageZeroPresetCards={[{ key: "personal_cashflow", bundleKey: "personal_cashflow", label: "Cashflow" }]}
      stageZeroPresetBundleKey="personal_cashflow"
      stageZeroAssemblyMode="lego"
      stageZeroSchemaDraft={schemaDraft}
      stageZeroSteps={steps}
      stageZeroDraggedSchemaKey=""
      stageZeroSchemaSummary={{ completed: 3, total: 3, ratio: 1, allDone: true }}
      stageZeroVisualBoost={{ emissiveBoost: 0.56 }}
      stageZeroSchemaPreview={schemaPreview}
      stageZeroAllSchemaStepsDone
      stageZeroCommitDisabledReason=""
      stageZeroCommitError=""
      stageZeroCommitBusy={false}
      stageZeroExistingContract={{
        required_fields: ["value", "label"],
        field_types: { value: "string", label: "string" },
      }}
      onClearCommitError={vi.fn()}
      onSelectPreset={vi.fn()}
      onChangePreset={vi.fn()}
      onSchemaBlockDragStart={vi.fn()}
      onSchemaBlockDragEnd={vi.fn()}
      onSchemaStep={vi.fn()}
      onSchemaBlockDrop={vi.fn()}
      onResetDraggedSchemaKey={vi.fn()}
      onAssemblyModeChange={vi.fn()}
      onCommitPreset={vi.fn()}
      onClose={vi.fn()}
      {...overrides}
    />
  );
}

describe("StageZeroSetupPanel commit preview", () => {
  it("renders final field map and preset estimate note", () => {
    renderPanel();

    const preview = screen.getByTestId("stage0-commit-preview");
    expect(preview.textContent).toContain("COMMIT PREVIEW");
    expect(preview.textContent).toContain("preset commit");
    expect(preview.textContent).toContain("transaction_name:string");
    expect(preview.textContent).toContain("Preview je odhad");
  });

  it("renders recovery card for missing required field and triggers actions", async () => {
    const user = userEvent.setup();
    const onAssemblyModeChange = vi.fn();
    const onClearCommitError = vi.fn();

    renderPanel({
      stageZeroCommitError: "Table contract violation: required field 'state' is missing",
      onAssemblyModeChange,
      onClearCommitError,
    });

    expect(screen.getByTestId("stage0-contract-recovery-card").textContent).toContain("state");

    await user.click(screen.getByTestId("stage0-recovery-open-schema-button"));
    expect(onAssemblyModeChange).toHaveBeenCalledWith("manual");

    await user.click(screen.getByTestId("stage0-recovery-revalidate-button"));
    expect(onClearCommitError).toHaveBeenCalled();
  });
});
