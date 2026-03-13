export function resolvePlanetTopologyState({ navigationModel = null, objectId = "" } = {}) {
  const targetId = String(objectId || "").trim();
  const selectedObjectId = String(navigationModel?.selectedObjectId || "").trim();
  const approachTargetId = String(navigationModel?.approachTargetId || "").trim();

  const selected = Boolean(targetId) && targetId === selectedObjectId;
  const approached = Boolean(targetId) && targetId === approachTargetId;

  return {
    selected,
    approached,
    emphasis: approached ? "approached" : selected ? "selected" : "idle",
  };
}
