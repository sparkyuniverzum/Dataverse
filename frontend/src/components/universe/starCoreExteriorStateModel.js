function normalizeState(value) {
  return String(value || "").trim();
}

export function resolveStarCoreExteriorState({ model = null, navigationModel = null } = {}) {
  const modelState = normalizeState(model?.state);
  const selectedObjectId = normalizeState(navigationModel?.selectedObjectId);
  const approachTargetId = normalizeState(navigationModel?.approachTargetId);
  const selected = selectedObjectId === "star-core";
  const approached = approachTargetId === "star-core";
  const unavailable = modelState === "data_unavailable";
  const loading = modelState === "loading";
  const unlocked = modelState === "star_core_unlocked";
  const locked = modelState === "star_core_locked_ready";

  let mode = "star_core_exterior_idle";
  if (approached) {
    mode = "star_core_exterior_approach";
  } else if (selected) {
    mode = "star_core_exterior_selected";
  }

  return {
    mode,
    selected,
    approached,
    unavailable,
    loading,
    unlocked,
    locked,
    lockVisualState: unavailable ? "unavailable" : loading ? "stabilizing" : unlocked ? "unlocked" : "locked",
  };
}
