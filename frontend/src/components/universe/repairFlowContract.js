import { normalizeContractViolationDetail } from "./workspaceContractExplainability";

const SUPPORTED_REASONS = new Set([
  "required_missing",
  "required_empty",
  "type_mismatch",
  "validator_failed",
  "unique_conflict",
]);

function normalizeExpectedType(raw) {
  const value = String(raw || "")
    .trim()
    .toLowerCase();
  if (!value) return "text";
  if (value === "string" || value === "text") return "text";
  if (value === "number" || value === "int" || value === "integer" || value === "float" || value === "double") {
    return "number";
  }
  if (value === "bool" || value === "boolean") return "boolean";
  if (value === "datetime" || value === "timestamp" || value === "date") return "datetime";
  if (value === "json" || value === "dict" || value === "object" || value === "array") return "json";
  return "text";
}

function stableStringify(value) {
  if (value === null || value === undefined) return "null";
  if (typeof value === "string") return JSON.stringify(value);
  if (typeof value === "number" || typeof value === "boolean") return String(value);
  if (Array.isArray(value)) return `[${value.map((item) => stableStringify(item)).join(",")}]`;
  if (typeof value === "object") {
    const keys = Object.keys(value).sort();
    return `{${keys.map((key) => `${JSON.stringify(key)}:${stableStringify(value[key])}`).join(",")}}`;
  }
  return JSON.stringify(String(value));
}

function fnv1a32(input) {
  const text = String(input || "");
  let hash = 0x811c9dc5;
  for (let index = 0; index < text.length; index += 1) {
    hash ^= text.charCodeAt(index);
    hash = Math.imul(hash, 0x01000193);
  }
  return (hash >>> 0).toString(16).padStart(8, "0");
}

function toNumberOrNull(value) {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (typeof value === "string") {
    const parsed = Number(value.trim().replace(",", "."));
    if (Number.isFinite(parsed)) return parsed;
  }
  return null;
}

function toBooleanOrNull(value) {
  if (typeof value === "boolean") return value;
  if (typeof value === "number") {
    if (value === 1) return true;
    if (value === 0) return false;
  }
  if (typeof value === "string") {
    const normalized = value.trim().toLowerCase();
    if (["true", "1", "yes", "y", "on"].includes(normalized)) return true;
    if (["false", "0", "no", "n", "off"].includes(normalized)) return false;
  }
  return null;
}

function toDatetimeIsoOrNull(value) {
  if (typeof value === "string" || typeof value === "number") {
    const date = new Date(value);
    if (!Number.isNaN(date.getTime())) return date.toISOString();
  }
  return null;
}

function coerceToExpectedType(actualValue, expectedType) {
  const type = normalizeExpectedType(expectedType);
  if (type === "number") {
    const numberValue = toNumberOrNull(actualValue);
    return { ok: numberValue !== null, value: numberValue };
  }
  if (type === "boolean") {
    const boolValue = toBooleanOrNull(actualValue);
    return { ok: boolValue !== null, value: boolValue };
  }
  if (type === "datetime") {
    const isoValue = toDatetimeIsoOrNull(actualValue);
    return { ok: Boolean(isoValue), value: isoValue };
  }
  if (type === "json") {
    if (actualValue !== null && typeof actualValue === "object") {
      return { ok: true, value: actualValue };
    }
    if (typeof actualValue === "string") {
      try {
        return { ok: true, value: JSON.parse(actualValue) };
      } catch {
        return { ok: false, value: null };
      }
    }
    return { ok: false, value: null };
  }
  return { ok: true, value: String(actualValue ?? "") };
}

function defaultValueForType(expectedType) {
  const type = normalizeExpectedType(expectedType);
  if (type === "number") return 0;
  if (type === "boolean") return false;
  if (type === "datetime") return "2026-01-01T00:00:00.000Z";
  if (type === "json") return {};
  return "auto-repair";
}

function chooseRepairValue(detail) {
  const expectedType = normalizeExpectedType(detail.expected_type);
  const expectedValue = detail.expected_value;
  if (detail.reason === "required_missing" || detail.reason === "required_empty") {
    return expectedValue === null ? defaultValueForType(expectedType) : expectedValue;
  }
  if (detail.reason === "type_mismatch") {
    const coerced = coerceToExpectedType(detail.actual_value, expectedType);
    if (coerced.ok) return coerced.value;
    if (expectedValue !== null) return expectedValue;
    return defaultValueForType(expectedType);
  }
  if (detail.reason === "validator_failed") {
    if (expectedValue !== null) {
      const coerced = coerceToExpectedType(expectedValue, expectedType);
      return coerced.ok ? coerced.value : expectedValue;
    }
    if ((detail.operator === ">" || detail.operator === ">=") && expectedType === "number") {
      const actual = toNumberOrNull(detail.actual_value);
      const fallback = actual === null ? 1 : actual + 1;
      return fallback;
    }
    return defaultValueForType(expectedType);
  }
  if (detail.reason === "unique_conflict") {
    const base =
      detail.actual_value === null || detail.actual_value === undefined
        ? String(detail.mineral_key || "value")
        : String(detail.actual_value);
    return `${base}-alt`;
  }
  return undefined;
}

function strategyForReason(reason) {
  if (reason === "required_missing" || reason === "required_empty") return "fill_required";
  if (reason === "type_mismatch") return "coerce_type";
  if (reason === "validator_failed") return "align_validator";
  if (reason === "unique_conflict") return "ensure_uniqueness";
  return "unsupported";
}

export function resolveGuidedRepairSuggestion(errorLike, { operation = "unknown", civilizationId = "" } = {}) {
  const detail = normalizeContractViolationDetail(errorLike);
  if (detail.code !== "TABLE_CONTRACT_VIOLATION") return null;
  if (!SUPPORTED_REASONS.has(detail.reason)) return null;
  const mineralKey = String(detail.mineral_key || "").trim();
  if (!mineralKey) return null;

  const typedValue = chooseRepairValue(detail);
  if (typeof typedValue === "undefined") return null;

  const normalizedCivilizationId = String(civilizationId || "").trim();
  const expectedType = normalizeExpectedType(detail.expected_type);
  const fingerprint = fnv1a32(
    stableStringify({
      code: detail.code,
      reason: detail.reason,
      mineral_key: mineralKey,
      expected_type: expectedType,
      expected_value: detail.expected_value,
      operator: detail.operator,
      actual_value: detail.actual_value,
      rule_id: detail.rule_id,
      capability_key: detail.capability_key,
      source: detail.source,
      operation: String(operation || "unknown"),
      civilization_id: normalizedCivilizationId,
    })
  );

  return {
    id: `repair-${fingerprint}`,
    fingerprint,
    strategy_key: strategyForReason(detail.reason),
    reason: detail.reason,
    operation: String(operation || "unknown"),
    table_name: detail.table_name,
    expected_type: expectedType,
    mineral_key: mineralKey,
    civilization_id: normalizedCivilizationId,
    suggested_typed_value: typedValue,
    suggested_raw_value: formatValueForMessage(typedValue),
    idempotency_key: `repair-${normalizedCivilizationId || "unknown"}-${fingerprint}`,
    rule_id: detail.rule_id,
    capability_key: detail.capability_key,
    source: detail.source,
  };
}

function formatValueForMessage(value) {
  if (value === null) return "null";
  if (typeof value === "string") return value;
  if (typeof value === "number" || typeof value === "boolean") return String(value);
  try {
    return JSON.stringify(value);
  } catch {
    return String(value);
  }
}

export function buildGuidedRepairMessage(suggestion) {
  if (!suggestion) return "";
  return `Navrh opravy: ${suggestion.mineral_key} -> ${suggestion.suggested_raw_value} (${suggestion.strategy_key})`;
}

export function buildGuidedRepairMutationRequest(suggestion, { galaxyId = "", expectedEventSeq = null } = {}) {
  const civilizationId = String(suggestion?.civilization_id || "").trim();
  const mineralKey = String(suggestion?.mineral_key || "").trim();
  if (!galaxyId || !civilizationId || !mineralKey) return null;

  const payload = {
    galaxy_id: String(galaxyId),
    minerals: {
      [mineralKey]: suggestion.suggested_typed_value,
    },
    idempotency_key: String(suggestion.idempotency_key || ""),
  };
  if (Number.isInteger(expectedEventSeq)) {
    payload.expected_event_seq = expectedEventSeq;
  }
  return {
    civilizationId,
    payload,
  };
}

export function buildGuidedRepairAuditRecord(
  suggestion,
  { stage = "planned", occurredAtIso = null, errorMessage = "" } = {}
) {
  if (!suggestion) return null;
  const occurredAt = occurredAtIso || new Date().toISOString();
  return {
    repair_id: suggestion.id,
    fingerprint: suggestion.fingerprint,
    stage: String(stage || "planned"),
    occurred_at: occurredAt,
    civilization_id: suggestion.civilization_id,
    mineral_key: suggestion.mineral_key,
    strategy_key: suggestion.strategy_key,
    idempotency_key: suggestion.idempotency_key,
    error_message: String(errorMessage || ""),
  };
}
