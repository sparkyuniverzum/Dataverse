export function buildPlanetBuilderConsistencyMessage({
  violations = [],
  state = "",
  effectiveState = "",
  source = "planet-builder",
} = {}) {
  const normalizedViolations = (Array.isArray(violations) ? violations : [])
    .map((item) => String(item || "").trim())
    .filter(Boolean);
  if (!normalizedViolations.length) return "";
  const activeState = String(state || "").trim() || "unknown";
  const activeEffectiveState = String(effectiveState || "").trim() || activeState;
  return `[${String(source || "planet-builder")}] consistency violation: ${normalizedViolations.join(", ")} | state=${activeState} | effective_state=${activeEffectiveState}`;
}

export function shouldWarnPlanetBuilderConsistency({ violations = [] } = {}) {
  return Array.isArray(violations) && violations.length > 0;
}
