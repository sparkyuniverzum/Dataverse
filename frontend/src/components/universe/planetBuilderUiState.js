import { PLANET_BUILDER_STATE, resolvePlanetBuilderRecoveryState } from "./planetBuilderFlow";
import { resolveStageZeroVisibility } from "./stageZeroVisibility";

const SETUP_PANEL_STATES = new Set([
  PLANET_BUILDER_STATE.BUILDER_OPEN,
  PLANET_BUILDER_STATE.CAPABILITY_ASSEMBLING,
  PLANET_BUILDER_STATE.PREVIEW_READY,
  PLANET_BUILDER_STATE.COMMITTING,
]);

const BLUEPRINT_PANEL_STATES = new Set([PLANET_BUILDER_STATE.BLUEPRINT_OPEN, PLANET_BUILDER_STATE.DRAGGING_PLANET]);

const BASE_OFFSET = [0, 0, 0];
const SETUP_OFFSET = [140, 0, 0];

function isKnownState(state) {
  return Object.values(PLANET_BUILDER_STATE).includes(String(state || ""));
}

function normalizeState(state) {
  const key = String(state || "").trim();
  if (isKnownState(key)) return key;
  return PLANET_BUILDER_STATE.IDLE;
}

function resolveEffectiveState(currentState, recoveryState) {
  if (currentState !== PLANET_BUILDER_STATE.ERROR_RECOVERABLE) return currentState;
  return resolvePlanetBuilderRecoveryState({
    currentState,
    lastValidState: recoveryState,
  });
}

function deriveFlowByState(effectiveState) {
  if (effectiveState === PLANET_BUILDER_STATE.IDLE) return "intro";
  if (
    effectiveState === PLANET_BUILDER_STATE.BLUEPRINT_OPEN ||
    effectiveState === PLANET_BUILDER_STATE.DRAGGING_PLANET
  ) {
    return "blueprint";
  }
  if (effectiveState === PLANET_BUILDER_STATE.PLANET_PLACED) return "building";
  return "complete";
}

function collectInvariantViolations({ stageZeroActive, setupPanelOpen, legacyStageZeroActive, legacySetupOpen } = {}) {
  const violations = [];
  if (typeof legacySetupOpen === "boolean" && legacySetupOpen !== setupPanelOpen) {
    violations.push("setup_panel_state_mismatch");
  }
  if (typeof legacyStageZeroActive === "boolean" && legacyStageZeroActive !== stageZeroActive) {
    violations.push("stage_zero_active_mismatch");
  }
  return violations;
}

export function resolvePlanetBuilderUiState({
  planetBuilderState = PLANET_BUILDER_STATE.IDLE,
  recoveryState = PLANET_BUILDER_STATE.IDLE,
  stageZeroCreating = false,
  stageZeroDropMode = false,
  stageZeroCommitBusy = false,
  selectedTableId = "",
  selectedAsteroidId = "",
  stageZeroPresetSelected = false,
  hasPlanets = false,
  legacyStageZeroActive,
  legacySetupOpen,
} = {}) {
  const currentState = normalizeState(planetBuilderState);
  const effectiveState = resolveEffectiveState(currentState, recoveryState);
  const stageZeroActive = currentState !== PLANET_BUILDER_STATE.CONVERGED;
  const stageZeroRequiresStarLock = currentState === PLANET_BUILDER_STATE.STAR_LOCKED_REQUIRED;
  const setupPanelOpen = stageZeroActive && SETUP_PANEL_STATES.has(effectiveState);
  const stageZeroBuilderOpen = stageZeroActive && BLUEPRINT_PANEL_STATES.has(effectiveState);
  const resolvedCreating = Boolean(stageZeroCreating || effectiveState === PLANET_BUILDER_STATE.PLANET_PLACED);
  const resolvedDropMode = Boolean(stageZeroDropMode || effectiveState === PLANET_BUILDER_STATE.DRAGGING_PLANET);
  const visibility = resolveStageZeroVisibility({
    stageZeroActive,
    stageZeroRequiresStarLock,
    stageZeroFlow: deriveFlowByState(effectiveState),
    stageZeroSetupOpen: setupPanelOpen,
    stageZeroBuilderOpen,
    stageZeroDropMode: resolvedDropMode,
    stageZeroCreating: resolvedCreating,
  });
  const shouldLockSidebarFromSetup = visibility.setupPanel && !hasPlanets;
  const workspaceInteractionLocked =
    stageZeroActive &&
    (visibility.canvasInteractionLocked ||
      shouldLockSidebarFromSetup ||
      visibility.blueprintPanel ||
      stageZeroCommitBusy);
  const builderTargetEnabled = setupPanelOpen && stageZeroPresetSelected;
  const cameraFocusOffset = setupPanelOpen && selectedTableId && !selectedAsteroidId ? SETUP_OFFSET : BASE_OFFSET;
  const invariantViolations = collectInvariantViolations({
    stageZeroActive,
    setupPanelOpen,
    legacyStageZeroActive,
    legacySetupOpen,
  });

  return {
    state: currentState,
    effectiveState,
    stageZeroActive,
    setupPanelOpen,
    builderTargetEnabled,
    visibility,
    shouldLockSidebarFromSetup,
    workspaceInteractionLocked,
    cameraFocusOffset,
    invariantViolations,
  };
}
