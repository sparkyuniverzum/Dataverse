import { describe, expect, it } from "vitest";

import { PLANET_BUILDER_STATE } from "./planetBuilderFlow";
import { createPlanetBuilderWizardHarness, PLANET_BUILDER_WIZARD_ACTION } from "./planetBuilderWizardHarness";

describe("planetBuilderWizardHarness", () => {
  it("runs interactive mission from star lock to converged", () => {
    const wizard = createPlanetBuilderWizardHarness({ starLocked: false, schemaStepsTotal: 3 });

    expect(wizard.snapshot().currentState).toBe(PLANET_BUILDER_STATE.STAR_LOCKED_REQUIRED);

    const blockedOpen = wizard.dispatch(PLANET_BUILDER_WIZARD_ACTION.OPEN_BLUEPRINT);
    expect(blockedOpen.allowed).toBe(false);
    expect(blockedOpen.reason).toBe("star_lock_required");

    expect(wizard.dispatch(PLANET_BUILDER_WIZARD_ACTION.LOCK_STAR).allowed).toBe(true);
    expect(wizard.dispatch(PLANET_BUILDER_WIZARD_ACTION.OPEN_BLUEPRINT).allowed).toBe(true);
    expect(wizard.dispatch(PLANET_BUILDER_WIZARD_ACTION.START_DRAG_PLANET).allowed).toBe(true);
    expect(wizard.dispatch(PLANET_BUILDER_WIZARD_ACTION.DROP_PLANET).allowed).toBe(true);
    expect(wizard.dispatch(PLANET_BUILDER_WIZARD_ACTION.OPEN_SETUP).allowed).toBe(true);
    expect(wizard.dispatch(PLANET_BUILDER_WIZARD_ACTION.SELECT_PRESET).allowed).toBe(true);
    expect(wizard.dispatch(PLANET_BUILDER_WIZARD_ACTION.ASSEMBLE_SCHEMA_STEP).allowed).toBe(true);
    expect(wizard.dispatch(PLANET_BUILDER_WIZARD_ACTION.ASSEMBLE_SCHEMA_STEP).allowed).toBe(true);
    expect(wizard.dispatch(PLANET_BUILDER_WIZARD_ACTION.ASSEMBLE_SCHEMA_STEP).allowed).toBe(true);

    const beforeCommit = wizard.snapshot();
    expect(beforeCommit.currentState).toBe(PLANET_BUILDER_STATE.PREVIEW_READY);
    expect(beforeCommit.schemaComplete).toBe(true);

    expect(wizard.dispatch(PLANET_BUILDER_WIZARD_ACTION.COMMIT_PRESET).allowed).toBe(true);
    expect(wizard.dispatch(PLANET_BUILDER_WIZARD_ACTION.COMMIT_SUCCESS).allowed).toBe(true);

    const final = wizard.snapshot();
    expect(final.currentState).toBe(PLANET_BUILDER_STATE.CONVERGED);
    expect(final.history.length).toBeGreaterThanOrEqual(12);
  });

  it("blocks commit while schema is incomplete", () => {
    const wizard = createPlanetBuilderWizardHarness({ starLocked: true, schemaStepsTotal: 3 });

    wizard.dispatch(PLANET_BUILDER_WIZARD_ACTION.OPEN_BLUEPRINT);
    wizard.dispatch(PLANET_BUILDER_WIZARD_ACTION.START_DRAG_PLANET);
    wizard.dispatch(PLANET_BUILDER_WIZARD_ACTION.DROP_PLANET);
    wizard.dispatch(PLANET_BUILDER_WIZARD_ACTION.OPEN_SETUP);
    wizard.dispatch(PLANET_BUILDER_WIZARD_ACTION.SELECT_PRESET);
    wizard.dispatch(PLANET_BUILDER_WIZARD_ACTION.ASSEMBLE_SCHEMA_STEP);

    const blockedCommit = wizard.dispatch(PLANET_BUILDER_WIZARD_ACTION.COMMIT_PRESET);
    expect(blockedCommit.allowed).toBe(false);
    expect(blockedCommit.reason).toBe("schema_incomplete");
    expect(wizard.snapshot().currentState).toBe(PLANET_BUILDER_STATE.CAPABILITY_ASSEMBLING);
  });

  it("recovers to last valid state after recoverable error", () => {
    const wizard = createPlanetBuilderWizardHarness({ starLocked: true, schemaStepsTotal: 3 });

    wizard.dispatch(PLANET_BUILDER_WIZARD_ACTION.OPEN_BLUEPRINT);
    wizard.dispatch(PLANET_BUILDER_WIZARD_ACTION.START_DRAG_PLANET);
    wizard.dispatch(PLANET_BUILDER_WIZARD_ACTION.DROP_PLANET);
    wizard.dispatch(PLANET_BUILDER_WIZARD_ACTION.OPEN_SETUP);
    wizard.dispatch(PLANET_BUILDER_WIZARD_ACTION.SELECT_PRESET);
    wizard.dispatch(PLANET_BUILDER_WIZARD_ACTION.ASSEMBLE_SCHEMA_STEP);

    const beforeError = wizard.snapshot();
    expect(beforeError.currentState).toBe(PLANET_BUILDER_STATE.CAPABILITY_ASSEMBLING);

    wizard.dispatch(PLANET_BUILDER_WIZARD_ACTION.RAISE_RECOVERABLE_ERROR);
    expect(wizard.snapshot().currentState).toBe(PLANET_BUILDER_STATE.ERROR_RECOVERABLE);

    const blockedAction = wizard.dispatch(PLANET_BUILDER_WIZARD_ACTION.ASSEMBLE_SCHEMA_STEP);
    expect(blockedAction.allowed).toBe(false);
    expect(blockedAction.reason).toBe("recover_required");

    const recovered = wizard.dispatch(PLANET_BUILDER_WIZARD_ACTION.RECOVER_ERROR);
    expect(recovered.allowed).toBe(true);
    expect(wizard.snapshot().currentState).toBe(PLANET_BUILDER_STATE.CAPABILITY_ASSEMBLING);
  });
});
