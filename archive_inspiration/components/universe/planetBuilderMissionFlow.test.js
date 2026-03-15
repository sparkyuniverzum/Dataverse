import { describe, expect, it } from "vitest";

import { PLANET_BUILDER_STATE, resolvePlanetBuilderState } from "./planetBuilderFlow";

describe("planet builder mission flow", () => {
  it("keeps deterministic sequence from star lock gate to converged workspace", () => {
    const timeline = [
      {
        key: "star-lock-required",
        input: {
          stageZeroActive: true,
          stageZeroRequiresStarLock: true,
          stageZeroFlow: "intro",
          runtimeError: "",
        },
        expected: PLANET_BUILDER_STATE.STAR_LOCKED_REQUIRED,
      },
      {
        key: "blueprint-open",
        input: {
          stageZeroActive: true,
          stageZeroRequiresStarLock: false,
          stageZeroFlow: "blueprint",
          runtimeError: "",
        },
        expected: PLANET_BUILDER_STATE.BLUEPRINT_OPEN,
      },
      {
        key: "dragging",
        input: {
          stageZeroActive: true,
          stageZeroFlow: "building",
          stageZeroDragging: true,
          runtimeError: "",
        },
        expected: PLANET_BUILDER_STATE.DRAGGING_PLANET,
      },
      {
        key: "planet-placed",
        input: {
          stageZeroActive: true,
          stageZeroCreating: true,
          runtimeError: "",
        },
        expected: PLANET_BUILDER_STATE.PLANET_PLACED,
      },
      {
        key: "builder-open",
        input: {
          stageZeroActive: true,
          stageZeroFlow: "complete",
          stageZeroSetupOpen: true,
          stageZeroPresetSelected: false,
          runtimeError: "",
        },
        expected: PLANET_BUILDER_STATE.BUILDER_OPEN,
      },
      {
        key: "capability-assembling",
        input: {
          stageZeroActive: true,
          stageZeroFlow: "complete",
          stageZeroSetupOpen: true,
          stageZeroPresetSelected: true,
          stageZeroCompletedSteps: 2,
          stageZeroAllSchemaStepsDone: false,
          runtimeError: "",
        },
        expected: PLANET_BUILDER_STATE.CAPABILITY_ASSEMBLING,
      },
      {
        key: "preview-ready",
        input: {
          stageZeroActive: true,
          stageZeroFlow: "complete",
          stageZeroSetupOpen: true,
          stageZeroPresetSelected: true,
          stageZeroCompletedSteps: 3,
          stageZeroAllSchemaStepsDone: true,
          runtimeError: "",
        },
        expected: PLANET_BUILDER_STATE.PREVIEW_READY,
      },
      {
        key: "committing",
        input: {
          stageZeroActive: true,
          stageZeroFlow: "complete",
          stageZeroSetupOpen: true,
          stageZeroPresetSelected: true,
          stageZeroCompletedSteps: 3,
          stageZeroAllSchemaStepsDone: true,
          stageZeroCommitBusy: true,
          runtimeError: "",
        },
        expected: PLANET_BUILDER_STATE.COMMITTING,
      },
      {
        key: "converged",
        input: {
          stageZeroActive: false,
          quickGridOpen: true,
          runtimeError: "",
        },
        expected: PLANET_BUILDER_STATE.CONVERGED,
      },
    ];

    const resolved = timeline.map((entry) => ({
      key: entry.key,
      state: resolvePlanetBuilderState(entry.input),
      expected: entry.expected,
    }));

    resolved.forEach((entry) => {
      expect(entry.state).toBe(entry.expected);
    });
    expect(resolved.map((entry) => entry.state)).toEqual([
      PLANET_BUILDER_STATE.STAR_LOCKED_REQUIRED,
      PLANET_BUILDER_STATE.BLUEPRINT_OPEN,
      PLANET_BUILDER_STATE.DRAGGING_PLANET,
      PLANET_BUILDER_STATE.PLANET_PLACED,
      PLANET_BUILDER_STATE.BUILDER_OPEN,
      PLANET_BUILDER_STATE.CAPABILITY_ASSEMBLING,
      PLANET_BUILDER_STATE.PREVIEW_READY,
      PLANET_BUILDER_STATE.COMMITTING,
      PLANET_BUILDER_STATE.CONVERGED,
    ]);
  });
});
