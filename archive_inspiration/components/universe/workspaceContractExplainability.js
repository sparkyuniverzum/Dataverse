function normalizeFieldList(fields) {
  return [
    ...new Set((Array.isArray(fields) ? fields : []).map((item) => String(item || "").trim()).filter(Boolean)),
  ].sort();
}

function diff(beFields, feFields) {
  const be = new Set(normalizeFieldList(beFields));
  const fe = new Set(normalizeFieldList(feFields));
  return {
    missing_in_fe: [...be].filter((field) => !fe.has(field)).sort(),
    extra_in_fe: [...fe].filter((field) => !be.has(field)).sort(),
  };
}

function toObject(value) {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  return value;
}

function toText(value, fallback = "") {
  const normalized = String(value ?? "").trim();
  return normalized || fallback;
}

function normalizeCode(value) {
  return toText(value).toUpperCase();
}

function normalizeReason(value) {
  return toText(value).toLowerCase();
}

function normalizeScalar(value) {
  if (value === null || value === undefined) return null;
  if (typeof value === "string") return value.trim();
  if (typeof value === "number" || typeof value === "boolean") return value;
  if (Array.isArray(value) || typeof value === "object") return value;
  return String(value);
}

function normalizeExpectedConstraint(value) {
  const source = toObject(value);
  if (!source) return null;
  const normalized = {};
  const type = toText(source.type);
  const operator = toText(source.operator);
  if (type) normalized.type = type;
  if (operator) normalized.operator = operator;
  if (Object.prototype.hasOwnProperty.call(source, "value")) {
    normalized.value = normalizeScalar(source.value);
  }
  if (Object.prototype.hasOwnProperty.call(source, "required")) {
    normalized.required = Boolean(source.required);
  }
  if (Object.prototype.hasOwnProperty.call(source, "non_empty")) {
    normalized.non_empty = Boolean(source.non_empty);
  }
  return Object.keys(normalized).length > 0 ? normalized : null;
}

function buildFallbackExpectedConstraint({ expectedType, operator, expectedValue }) {
  const normalized = {};
  if (expectedType) normalized.type = expectedType;
  if (operator) normalized.operator = operator;
  if (expectedValue !== null) normalized.value = expectedValue;
  return Object.keys(normalized).length > 0 ? normalized : null;
}

function extractDetail(input) {
  const source = toObject(input);
  if (!source) return {};
  const nested = toObject(source.detail);
  return nested || source;
}

function formatActualValue(value) {
  if (value === null || value === undefined) return "n/a";
  if (typeof value === "string") return value;
  if (typeof value === "number" || typeof value === "boolean") return String(value);
  try {
    return JSON.stringify(value);
  } catch {
    return String(value);
  }
}

function reasonLabel(reason) {
  const lookup = {
    required_missing: "chybi povinny nerost",
    required_empty: "povinny nerost je prazdny",
    type_mismatch: "typ nerostu neodpovida kontraktu",
    validator_failed: "validator kontraktu selhal",
    unique_conflict: "unikatni pravidlo uz existuje",
  };
  return lookup[reason] || "poruseni kontraktu";
}

export const CONTRACT_VIOLATION_DETAIL_BE_FIELDS = Object.freeze([
  "code",
  "message",
  "table_name",
  "reason",
  "mineral_key",
  "actual_value",
  "expected_type",
  "operator",
  "expected_value",
  "expected_constraint",
  "repair_hint",
  "rule_id",
  "source",
  "capability_key",
  "capability_id",
]);

export const CONTRACT_VIOLATION_DETAIL_FE_USED_FIELDS = Object.freeze([
  "code",
  "table_name",
  "reason",
  "mineral_key",
  "actual_value",
  "expected_type",
  "operator",
  "expected_value",
  "expected_constraint",
  "repair_hint",
  "rule_id",
  "source",
  "capability_key",
]);

export function explainabilityContractDiff() {
  return diff(CONTRACT_VIOLATION_DETAIL_BE_FIELDS, CONTRACT_VIOLATION_DETAIL_FE_USED_FIELDS);
}

export function normalizeContractViolationDetail(input) {
  const detail = extractDetail(input);
  const payloadConstraint = normalizeExpectedConstraint(detail.expected_constraint);
  let expectedType = toText(detail.expected_type);
  let operator = toText(detail.operator);
  let expectedValue = normalizeScalar(detail.expected_value);
  if (!expectedType && payloadConstraint?.type) expectedType = toText(payloadConstraint.type);
  if (!operator && payloadConstraint?.operator) operator = toText(payloadConstraint.operator);
  if (expectedValue === null && payloadConstraint && Object.prototype.hasOwnProperty.call(payloadConstraint, "value")) {
    expectedValue = normalizeScalar(payloadConstraint.value);
  }
  const expectedConstraint =
    payloadConstraint ||
    buildFallbackExpectedConstraint({
      expectedType,
      operator,
      expectedValue,
    });
  return {
    code: normalizeCode(detail.code),
    message: toText(detail.message),
    table_name: toText(detail.table_name),
    reason: normalizeReason(detail.reason),
    mineral_key: toText(detail.mineral_key),
    actual_value: normalizeScalar(detail.actual_value),
    expected_type: expectedType,
    operator,
    expected_value: expectedValue,
    expected_constraint: expectedConstraint,
    repair_hint: toText(detail.repair_hint),
    rule_id: toText(detail.rule_id),
    source: normalizeReason(detail.source),
    capability_key: toText(detail.capability_key),
    capability_id: toText(detail.capability_id),
  };
}

export function isContractViolationDetail(input) {
  const detail = normalizeContractViolationDetail(input);
  return detail.code === "TABLE_CONTRACT_VIOLATION";
}

export function buildContractViolationMessage(input, { fallbackMessage = "Operace selhala." } = {}) {
  const detail = normalizeContractViolationDetail(input);
  if (detail.code !== "TABLE_CONTRACT_VIOLATION") {
    return fallbackMessage;
  }

  const parts = [`Kontrakt [${detail.table_name || "n/a"}]: ${reasonLabel(detail.reason)}`];
  if (detail.mineral_key) parts.push(`nerost=${detail.mineral_key}`);
  if (detail.actual_value !== null) parts.push(`hodnota=${formatActualValue(detail.actual_value)}`);
  if (detail.expected_type) parts.push(`typ=${detail.expected_type}`);
  if (detail.operator) {
    const operatorPart =
      detail.expected_value !== null
        ? `${detail.operator} ${formatActualValue(detail.expected_value)}`
        : detail.operator;
    parts.push(`podminka=${operatorPart}`);
  } else if (detail.expected_constraint?.required) {
    parts.push(`podminka=required`);
  }
  if (detail.rule_id) parts.push(`rule_id=${detail.rule_id}`);
  if (detail.repair_hint) parts.push(`oprava=${detail.repair_hint}`);
  if (detail.source === "moon_capability" && detail.capability_key) {
    parts.push(`capability=${detail.capability_key}`);
  }
  return parts.join(" | ");
}
