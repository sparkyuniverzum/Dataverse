function truncateValue(value, max = 48) {
  if (value === null) return "null";
  if (typeof value === "undefined") return "undefined";
  const asText =
    typeof value === "string"
      ? value
      : typeof value === "number" || typeof value === "boolean"
        ? String(value)
        : JSON.stringify(value);
  if (asText.length <= max) return asText;
  return `${asText.slice(0, max - 1)}…`;
}

export function deriveCivilizationInspectorModel(selectedCivilization, moonImpact = null, selectedCivilizationId = "") {
  if (!selectedCivilization || typeof selectedCivilization !== "object") {
    return {
      state: "UNKNOWN",
      violationCount: 0,
      impactedMinerals: [],
      activeRules: [],
      healthScore: "n/a",
      eventSeq: "n/a",
      archived: false,
    };
  }

  const impactItems = Array.isArray(moonImpact?.items) ? moonImpact.items : [];
  const selectedId = String(selectedCivilizationId || selectedCivilization?.id || "").trim();
  const archived = selectedCivilization.is_deleted === true;
  const state = String(selectedCivilization.state || (archived ? "ARCHIVED" : "ACTIVE")).toUpperCase();
  const healthScore = Number.isFinite(Number(selectedCivilization.health_score))
    ? Number(selectedCivilization.health_score)
    : "n/a";
  const eventSeq = Number.isFinite(Number(selectedCivilization.current_event_seq))
    ? Number(selectedCivilization.current_event_seq)
    : "n/a";

  if (impactItems.length) {
    const filtered = selectedId
      ? impactItems.filter((item) =>
          Array.isArray(item?.impacted_civilization_ids)
            ? item.impacted_civilization_ids.some((civilizationId) => String(civilizationId) === selectedId)
            : false
        )
      : [];
    const relevant = filtered.length ? filtered : impactItems;
    const impactedMinerals = [];
    const activeRules = [];
    let violationCount = 0;
    relevant.forEach((item) => {
      const mineralKey = String(item?.mineral_key || "").trim();
      if (mineralKey) {
        impactedMinerals.push(mineralKey);
      }
      const ruleId = String(item?.rule_id || "").trim();
      if (ruleId) {
        activeRules.push(ruleId);
      }
      const itemViolations = Number(item?.active_violations_count);
      if (Number.isFinite(itemViolations)) {
        violationCount += Math.max(0, Math.floor(itemViolations));
      }
    });
    return {
      state,
      violationCount,
      impactedMinerals: [...new Set(impactedMinerals)].slice(0, 6),
      activeRules: [...new Set(activeRules)].slice(0, 4),
      healthScore,
      eventSeq,
      archived,
    };
  }

  const facts = Array.isArray(selectedCivilization.facts) ? selectedCivilization.facts : [];
  const metadata =
    selectedCivilization.metadata &&
    typeof selectedCivilization.metadata === "object" &&
    !Array.isArray(selectedCivilization.metadata)
      ? selectedCivilization.metadata
      : {};
  const explicitViolationCount = Number.isFinite(Number(selectedCivilization.violation_count))
    ? Number(selectedCivilization.violation_count)
    : null;
  const impactedMinerals = [];
  const activeRules = [];
  let derivedViolations = 0;

  facts.forEach((fact) => {
    const mineralKey = String(fact?.key || "").trim();
    const errors = Array.isArray(fact?.errors) ? fact.errors : [];
    const isInvalid = String(fact?.status || "").toLowerCase() === "invalid" || errors.length > 0;
    if (isInvalid && mineralKey) {
      impactedMinerals.push(`${mineralKey}:${truncateValue(fact?.typed_value)}`);
      derivedViolations += Math.max(1, errors.length);
    }
    errors.forEach((error) => {
      const ruleId = String(error?.rule_id || error?.code || "").trim();
      if (ruleId) {
        activeRules.push(ruleId);
      }
    });
  });

  if (!impactedMinerals.length) {
    Object.keys(metadata)
      .slice(0, 4)
      .forEach((key) => {
        impactedMinerals.push(`${key}:${truncateValue(metadata[key])}`);
      });
  }

  return {
    state,
    violationCount: explicitViolationCount === null ? derivedViolations : explicitViolationCount,
    impactedMinerals: [...new Set(impactedMinerals)].slice(0, 6),
    activeRules: [...new Set(activeRules)].slice(0, 4),
    healthScore,
    eventSeq,
    archived,
  };
}
