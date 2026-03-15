import { describe, expect, it } from "vitest";

import { PLANET_BUILDER_STATE } from "./planetBuilderFlow";
import { resolvePlanetBuilderUiState } from "./planetBuilderUiState";

describe("resolvePlanetBuilderUiState", () => {
  it("derives intro gate from FSM idle state and reports setup mismatch invariant", () => {
    const ui = resolvePlanetBuilderUiState({
      planetBuilderState: PLANET_BUILDER_STATE.IDLE,
      legacyStageZeroActive: true,
      legacySetupOpen: true,
    });

    expect(ui.visibility.introGate).toBe(true);
    expect(ui.visibility.setupPanel).toBe(false);
    expect(ui.invariantViolations).toContain("setup_panel_state_mismatch");
  });

  it("derives setup panel and camera focus for preview-ready state", () => {
    const ui = resolvePlanetBuilderUiState({
      planetBuilderState: PLANET_BUILDER_STATE.PREVIEW_READY,
      selectedTableId: "table-1",
      stageZeroPresetSelected: true,
      hasPlanets: false,
    });

    expect(ui.setupPanelOpen).toBe(true);
    expect(ui.builderTargetEnabled).toBe(true);
    expect(ui.shouldLockSidebarFromSetup).toBe(true);
    expect(ui.cameraFocusOffset).toEqual([140, 0, 0]);
  });

  it("uses recovery state for error-recoverable render mapping", () => {
    const ui = resolvePlanetBuilderUiState({
      planetBuilderState: PLANET_BUILDER_STATE.ERROR_RECOVERABLE,
      recoveryState: PLANET_BUILDER_STATE.CAPABILITY_ASSEMBLING,
      selectedTableId: "table-1",
      stageZeroPresetSelected: true,
    });

    expect(ui.effectiveState).toBe(PLANET_BUILDER_STATE.CAPABILITY_ASSEMBLING);
    expect(ui.visibility.setupPanel).toBe(true);
    expect(ui.visibility.missionPanel).toBe(true);
    expect(ui.visibility.introGate).toBe(false);
  });

  it("locks workspace interactions in blueprint and creating phases", () => {
    const blueprintUi = resolvePlanetBuilderUiState({
      planetBuilderState: PLANET_BUILDER_STATE.BLUEPRINT_OPEN,
    });
    const creatingUi = resolvePlanetBuilderUiState({
      planetBuilderState: PLANET_BUILDER_STATE.PLANET_PLACED,
    });

    expect(blueprintUi.visibility.blueprintPanel).toBe(true);
    expect(blueprintUi.workspaceInteractionLocked).toBe(true);
    expect(creatingUi.visibility.creatingBanner).toBe(true);
    expect(creatingUi.workspaceInteractionLocked).toBe(true);
  });

  it("keeps drop-zone hidden when FSM is intro even if legacy drag flags leak in", () => {
    const ui = resolvePlanetBuilderUiState({
      planetBuilderState: PLANET_BUILDER_STATE.IDLE,
      stageZeroDropMode: true,
      stageZeroCreating: true,
    });

    expect(ui.visibility.introGate).toBe(true);
    expect(ui.visibility.dropZone).toBe(false);
  });
});
