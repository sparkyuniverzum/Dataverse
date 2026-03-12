export const GALAXY_NAVIGATION_STATE = Object.freeze({
  SPACE_IDLE: "space_idle",
  OBJECT_SELECTED: "object_selected",
  APPROACH_ACTIVE: "approach_active",
});

function normalizeId(value) {
  return String(value || "").trim();
}

function buildIdSet(spaceObjects) {
  return new Set(
    (Array.isArray(spaceObjects) ? spaceObjects : []).map((item) => normalizeId(item?.id)).filter(Boolean)
  );
}

export function createInitialGalaxyNavigationState() {
  return {
    mode: GALAXY_NAVIGATION_STATE.SPACE_IDLE,
    selectedObjectId: "",
    approachTargetId: "",
  };
}

export function selectGalaxyObject(currentState, objectId) {
  const selectedObjectId = normalizeId(objectId);
  if (!selectedObjectId) return createInitialGalaxyNavigationState();
  return {
    mode: GALAXY_NAVIGATION_STATE.OBJECT_SELECTED,
    selectedObjectId,
    approachTargetId: "",
  };
}

export function beginGalaxyApproach(currentState, objectId = "") {
  const currentSelectedObjectId = normalizeId(currentState?.selectedObjectId);
  const resolvedTargetId = normalizeId(objectId || currentSelectedObjectId);
  if (!resolvedTargetId) return createInitialGalaxyNavigationState();
  return {
    mode: GALAXY_NAVIGATION_STATE.APPROACH_ACTIVE,
    selectedObjectId: resolvedTargetId,
    approachTargetId: resolvedTargetId,
  };
}

export function clearGalaxySelection() {
  return createInitialGalaxyNavigationState();
}

export function resolveGalaxyEscape(currentState) {
  const mode = String(currentState?.mode || GALAXY_NAVIGATION_STATE.SPACE_IDLE).trim();
  const selectedObjectId = normalizeId(currentState?.selectedObjectId);

  if (mode === GALAXY_NAVIGATION_STATE.APPROACH_ACTIVE && selectedObjectId) {
    return {
      mode: GALAXY_NAVIGATION_STATE.OBJECT_SELECTED,
      selectedObjectId,
      approachTargetId: "",
    };
  }

  if (mode === GALAXY_NAVIGATION_STATE.OBJECT_SELECTED) {
    return createInitialGalaxyNavigationState();
  }

  return createInitialGalaxyNavigationState();
}

export function resolveGalaxyNavigationModel({ navigationState = null, spaceObjects = [] } = {}) {
  const objects = Array.isArray(spaceObjects) ? spaceObjects : [];
  const ids = buildIdSet(objects);
  const rawMode = String(navigationState?.mode || GALAXY_NAVIGATION_STATE.SPACE_IDLE).trim();
  const selectedObjectId = normalizeId(navigationState?.selectedObjectId);
  const approachTargetId = normalizeId(navigationState?.approachTargetId);
  const mode = Object.values(GALAXY_NAVIGATION_STATE).includes(rawMode) ? rawMode : GALAXY_NAVIGATION_STATE.SPACE_IDLE;

  const effectiveSelectedObjectId = ids.has(selectedObjectId) ? selectedObjectId : "";
  const effectiveApproachTargetId = ids.has(approachTargetId) ? approachTargetId : "";
  const selectedObject = objects.find((item) => normalizeId(item?.id) === effectiveSelectedObjectId) || null;
  const approachTarget = objects.find((item) => normalizeId(item?.id) === effectiveApproachTargetId) || null;
  const effectiveMode =
    mode === GALAXY_NAVIGATION_STATE.APPROACH_ACTIVE && !approachTarget
      ? effectiveSelectedObjectId
        ? GALAXY_NAVIGATION_STATE.OBJECT_SELECTED
        : GALAXY_NAVIGATION_STATE.SPACE_IDLE
      : mode === GALAXY_NAVIGATION_STATE.OBJECT_SELECTED && !selectedObject
        ? GALAXY_NAVIGATION_STATE.SPACE_IDLE
        : mode;

  return {
    mode: effectiveMode,
    selectedObjectId: effectiveSelectedObjectId,
    approachTargetId: effectiveMode === GALAXY_NAVIGATION_STATE.APPROACH_ACTIVE ? effectiveApproachTargetId : "",
    selectedObject,
    approachTarget,
    hasSelection: Boolean(selectedObject),
    isApproachActive: effectiveMode === GALAXY_NAVIGATION_STATE.APPROACH_ACTIVE && Boolean(approachTarget),
  };
}
