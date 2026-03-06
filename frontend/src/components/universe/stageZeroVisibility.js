function toBool(value) {
  return Boolean(value);
}

function normalizeFlow(flow) {
  return String(flow || "")
    .trim()
    .toLowerCase();
}

export function resolveStageZeroVisibility({
  stageZeroActive = false,
  stageZeroRequiresStarLock = false,
  stageZeroFlow = "",
  stageZeroSetupOpen = false,
  stageZeroBuilderOpen = false,
  stageZeroDropMode = false,
  stageZeroCreating = false,
} = {}) {
  const active = toBool(stageZeroActive);
  if (!active) {
    return {
      starLockGate: false,
      introGate: false,
      blueprintPanel: false,
      setupPanel: false,
      creatingBanner: false,
      missionPanel: false,
      dropZone: false,
      canvasInteractionLocked: false,
    };
  }

  const starLockGate = toBool(stageZeroRequiresStarLock);
  const introGate = !starLockGate && !toBool(stageZeroSetupOpen) && normalizeFlow(stageZeroFlow) === "intro";
  const setupPanel = !starLockGate && toBool(stageZeroSetupOpen);
  const blueprintPanel = !starLockGate && !introGate && !setupPanel && toBool(stageZeroBuilderOpen);
  const creatingBanner = !starLockGate && toBool(stageZeroCreating);
  const missionPanel = !starLockGate && !introGate;
  const dropZone = !starLockGate && !introGate && toBool(stageZeroDropMode || stageZeroCreating);
  const canvasInteractionLocked = starLockGate || introGate || creatingBanner;

  return {
    starLockGate,
    introGate,
    blueprintPanel,
    setupPanel,
    creatingBanner,
    missionPanel,
    dropZone,
    canvasInteractionLocked,
  };
}
