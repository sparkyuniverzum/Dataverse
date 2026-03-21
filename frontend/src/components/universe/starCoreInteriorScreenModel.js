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

export function resolveStarCoreInteriorScreenModel({
  screenState = null,
  interiorTruth = null,
  errorMessage = "",
} = {}) {
  const stage = String(screenState?.stage || "closed").trim() || "closed";
  const truth = interiorTruth && typeof interiorTruth === "object" ? interiorTruth : null;
  return {
    stage,
    isVisible: stage !== "closed",
    isActive: stage === "active",
    interiorPhase: String(truth?.interiorPhase || "").trim(),
    nextActionLabel: String(truth?.nextAction?.label || "").trim(),
    explainabilityHeadline: String(truth?.explainability?.headline || "").trim(),
    explainabilityBody: String(truth?.explainability?.body || "").trim(),
    errorMessage: String(errorMessage || "").trim(),
  };
}
