export function createInitialStarCoreInteriorScreenState() {
  return {
    stage: "closed",
  };
}

export function beginStarCoreInteriorScreenEntry() {
  return {
    stage: "entering",
  };
}

export function resolveStarCoreInteriorScreenEntryComplete(currentState) {
  if (String(currentState?.stage || "") !== "entering") {
    return currentState || createInitialStarCoreInteriorScreenState();
  }
  return {
    stage: "active",
  };
}

export function beginStarCoreInteriorScreenReturn() {
  return {
    stage: "returning",
  };
}

export function closeStarCoreInteriorScreen() {
  return createInitialStarCoreInteriorScreenState();
}

export function resolveStarCoreInteriorScreenModel({ screenState = null, reducedMotion = false } = {}) {
  const stage = String(screenState?.stage || "closed").trim() || "closed";
  return {
    stage,
    isVisible: stage !== "closed",
    isEntering: stage === "entering",
    isActive: stage === "active",
    isReturning: stage === "returning",
    transitionDurationMs: reducedMotion ? 40 : stage === "returning" ? 280 : 900,
  };
}
