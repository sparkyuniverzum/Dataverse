import { describe, expect, it } from "vitest";

import {
  buildPlanetBuilderTransitionMessage,
  evaluatePlanetBuilderTransition,
  buildPlanetBuilderNarrative,
  buildPlanetBuilderStepChecklist,
  PLANET_BUILDER_ACTION,
  PLANET_BUILDER_STATE,
  resolvePlanetBuilderRecoveryState,
  resolvePlanetBuilderState,
} from "./planetBuilderFlow";

describe("planetBuilderFlow", () => {
  it("requires star lock before builder", () => {
    const state = resolvePlanetBuilderState({
      stageZeroActive: true,
      stageZeroRequiresStarLock: true,
      stageZeroFlow: "intro",
    });
    expect(state).toBe(PLANET_BUILDER_STATE.STAR_LOCKED_REQUIRED);
  });

  it("maps drag-and-drop journey deterministically", () => {
    expect(
      resolvePlanetBuilderState({
        stageZeroActive: true,
        stageZeroFlow: "blueprint",
      })
    ).toBe(PLANET_BUILDER_STATE.BLUEPRINT_OPEN);

    expect(
      resolvePlanetBuilderState({
        stageZeroActive: true,
        stageZeroFlow: "blueprint",
        stageZeroDragging: true,
      })
    ).toBe(PLANET_BUILDER_STATE.DRAGGING_PLANET);

    expect(
      resolvePlanetBuilderState({
        stageZeroActive: true,
        stageZeroCreating: true,
      })
    ).toBe(PLANET_BUILDER_STATE.PLANET_PLACED);
  });

  it("enters assembly and preview states based on schema progress", () => {
    expect(
      resolvePlanetBuilderState({
        stageZeroActive: true,
        stageZeroSetupOpen: true,
        stageZeroPresetSelected: false,
      })
    ).toBe(PLANET_BUILDER_STATE.BUILDER_OPEN);

    expect(
      resolvePlanetBuilderState({
        stageZeroActive: true,
        stageZeroSetupOpen: true,
        stageZeroPresetSelected: true,
        stageZeroCompletedSteps: 1,
        stageZeroAllSchemaStepsDone: false,
      })
    ).toBe(PLANET_BUILDER_STATE.CAPABILITY_ASSEMBLING);

    expect(
      resolvePlanetBuilderState({
        stageZeroActive: true,
        stageZeroSetupOpen: true,
        stageZeroPresetSelected: true,
        stageZeroCompletedSteps: 3,
        stageZeroAllSchemaStepsDone: true,
      })
    ).toBe(PLANET_BUILDER_STATE.PREVIEW_READY);
  });

  it("moves to committing and converged", () => {
    expect(
      resolvePlanetBuilderState({
        stageZeroActive: true,
        stageZeroCommitBusy: true,
        stageZeroSetupOpen: true,
      })
    ).toBe(PLANET_BUILDER_STATE.COMMITTING);

    expect(
      resolvePlanetBuilderState({
        stageZeroActive: false,
      })
    ).toBe(PLANET_BUILDER_STATE.CONVERGED);
  });

  it("keeps recoverable error state over active stage zero", () => {
    const state = resolvePlanetBuilderState({
      stageZeroActive: true,
      stageZeroFlow: "blueprint",
      runtimeError: "Table contract violation",
    });
    expect(state).toBe(PLANET_BUILDER_STATE.ERROR_RECOVERABLE);
  });

  it("provides narrative and checklist contract for active state", () => {
    const narrative = buildPlanetBuilderNarrative(PLANET_BUILDER_STATE.CAPABILITY_ASSEMBLING);
    expect(narrative.title).toContain("Lego");
    expect(narrative.why).toContain("nerosty");

    const checklist = buildPlanetBuilderStepChecklist(PLANET_BUILDER_STATE.PREVIEW_READY);
    expect(checklist).toHaveLength(8);
    expect(checklist.filter((item) => item.done).length).toBe(5);
    expect(checklist.find((item) => item.active)?.label).toBe("Preview");
  });

  it("enforces deterministic transition guards", () => {
    const commitBlocked = evaluatePlanetBuilderTransition({
      state: PLANET_BUILDER_STATE.CAPABILITY_ASSEMBLING,
      action: PLANET_BUILDER_ACTION.COMMIT_PRESET,
      context: { schemaComplete: false, starLocked: true },
    });
    expect(commitBlocked.allowed).toBe(false);
    expect(commitBlocked.reason).toBe("schema_incomplete");
    expect(buildPlanetBuilderTransitionMessage(commitBlocked)).toContain("Schema neni kompletni");

    const commitAllowed = evaluatePlanetBuilderTransition({
      state: PLANET_BUILDER_STATE.PREVIEW_READY,
      action: PLANET_BUILDER_ACTION.COMMIT_PRESET,
      context: { schemaComplete: true, starLocked: true },
    });
    expect(commitAllowed.allowed).toBe(true);
    expect(commitAllowed.next_state).toBe(PLANET_BUILDER_STATE.COMMITTING);
  });

  it("resolves recoverable state to the last valid step", () => {
    expect(
      resolvePlanetBuilderRecoveryState({
        currentState: PLANET_BUILDER_STATE.ERROR_RECOVERABLE,
        lastValidState: PLANET_BUILDER_STATE.CAPABILITY_ASSEMBLING,
      })
    ).toBe(PLANET_BUILDER_STATE.CAPABILITY_ASSEMBLING);

    expect(
      resolvePlanetBuilderRecoveryState({
        currentState: PLANET_BUILDER_STATE.ERROR_RECOVERABLE,
        lastValidState: "",
      })
    ).toBe(PLANET_BUILDER_STATE.BLUEPRINT_OPEN);
  });
});
