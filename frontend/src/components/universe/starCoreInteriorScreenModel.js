export function createInitialStarCoreInteriorScreenState() {
  return {
    stage: "closed",
  };
}

export function openStarCoreInteriorScreen() {
  return {
    stage: "active",
  };
}

export function closeStarCoreInteriorScreen() {
  return createInitialStarCoreInteriorScreenState();
}

export function resolveStarCoreInteriorScreenModel({ screenState = null } = {}) {
  const stage = String(screenState?.stage || "closed").trim() || "closed";
  return {
    stage,
    isVisible: stage !== "closed",
    isActive: stage === "active",
  };
}
