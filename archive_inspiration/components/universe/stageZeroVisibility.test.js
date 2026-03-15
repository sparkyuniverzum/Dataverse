import { describe, expect, it } from "vitest";

import { resolveStageZeroVisibility } from "./stageZeroVisibility";

describe("stageZeroVisibility", () => {
  it("prioritizes star-lock gate over all other overlays", () => {
    const visibility = resolveStageZeroVisibility({
      stageZeroActive: true,
      stageZeroRequiresStarLock: true,
      stageZeroFlow: "intro",
      stageZeroSetupOpen: true,
      stageZeroBuilderOpen: true,
      stageZeroDropMode: true,
      stageZeroCreating: true,
    });

    expect(visibility.starLockGate).toBe(true);
    expect(visibility.introGate).toBe(false);
    expect(visibility.blueprintPanel).toBe(false);
    expect(visibility.setupPanel).toBe(false);
    expect(visibility.dropZone).toBe(false);
    expect(visibility.missionPanel).toBe(false);
    expect(visibility.canvasInteractionLocked).toBe(true);
  });

  it("shows intro gate as only initial blocker before blueprint", () => {
    const visibility = resolveStageZeroVisibility({
      stageZeroActive: true,
      stageZeroRequiresStarLock: false,
      stageZeroFlow: "intro",
      stageZeroSetupOpen: false,
      stageZeroBuilderOpen: false,
      stageZeroDropMode: false,
      stageZeroCreating: false,
    });

    expect(visibility.introGate).toBe(true);
    expect(visibility.blueprintPanel).toBe(false);
    expect(visibility.missionPanel).toBe(false);
    expect(visibility.canvasInteractionLocked).toBe(true);
  });

  it("keeps blueprint/drop/missions in sync during drag stage", () => {
    const visibility = resolveStageZeroVisibility({
      stageZeroActive: true,
      stageZeroFlow: "blueprint",
      stageZeroBuilderOpen: true,
      stageZeroDropMode: true,
      stageZeroCreating: false,
    });

    expect(visibility.blueprintPanel).toBe(true);
    expect(visibility.dropZone).toBe(true);
    expect(visibility.missionPanel).toBe(true);
    expect(visibility.canvasInteractionLocked).toBe(false);
  });

  it("switches to setup panel and keeps mission visible", () => {
    const visibility = resolveStageZeroVisibility({
      stageZeroActive: true,
      stageZeroFlow: "complete",
      stageZeroSetupOpen: true,
      stageZeroBuilderOpen: false,
    });

    expect(visibility.setupPanel).toBe(true);
    expect(visibility.blueprintPanel).toBe(false);
    expect(visibility.missionPanel).toBe(true);
    expect(visibility.introGate).toBe(false);
  });

  it("returns fully hidden state outside stage zero", () => {
    const visibility = resolveStageZeroVisibility({
      stageZeroActive: false,
      stageZeroRequiresStarLock: false,
      stageZeroFlow: "intro",
    });

    expect(visibility).toEqual({
      starLockGate: false,
      introGate: false,
      blueprintPanel: false,
      setupPanel: false,
      creatingBanner: false,
      missionPanel: false,
      dropZone: false,
      canvasInteractionLocked: false,
    });
  });
});
