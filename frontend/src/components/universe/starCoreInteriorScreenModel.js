export const STAR_CORE_INTERIOR_REDUCED_MOTION_DURATION_MS = 40;
export const STAR_CORE_INTERIOR_ENTRY_DURATION_MS = 760;
export const STAR_CORE_INTERIOR_LOCK_TRANSITION_DURATION_MS = 420;
export const STAR_CORE_INTERIOR_RETURN_DURATION_MS = 280;

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
  const transitionDurationMs = reducedMotion
    ? STAR_CORE_INTERIOR_REDUCED_MOTION_DURATION_MS
    : stage === "entering"
      ? STAR_CORE_INTERIOR_ENTRY_DURATION_MS
      : stage === "returning"
        ? STAR_CORE_INTERIOR_RETURN_DURATION_MS
        : 420;
  return {
    stage,
    isVisible: stage !== "closed",
    isEntering: stage === "entering",
    isActive: stage === "active",
    isReturning: stage === "returning",
    transitionDurationMs,
  };
}
