const RESERVED_CONTRACT_KEYS = new Set(["table", "table_id", "table_name", "constellation_name", "planet_name"]);

function normalizeFieldType(rawType) {
  const normalized = String(rawType || "").trim().toLowerCase();
  if (!normalized) return "string";
  if (normalized === "text") return "string";
  if (normalized === "int" || normalized === "integer" || normalized === "float" || normalized === "decimal") return "number";
  if (normalized === "date") return "datetime";
  if (normalized === "object" || normalized === "array") return "json";
  if (normalized === "bool") return "boolean";
  return normalized;
}

function randomSuffix() {
  if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") {
    return crypto.randomUUID().slice(0, 8);
  }
  return Math.random().toString(16).slice(2, 10);
}

function findNumericValidatorHint(validators, fieldName) {
  const normalizedField = String(fieldName || "").trim();
  if (!Array.isArray(validators) || !normalizedField) return null;
  const entries = validators.filter(
    (item) => item && typeof item === "object" && String(item.field || "").trim() === normalizedField
  );
  for (const entry of entries) {
    const value = Number(entry?.value);
    if (!Number.isFinite(value)) continue;
    const operator = String(entry?.operator || "").trim();
    if (operator === ">" || operator === "gte") return value + 1;
    if (operator === ">=" || operator === "gteq" || operator === "==") return value;
    if (operator === "<") return value - 1;
    if (operator === "<=") return value;
  }
  return null;
}

function defaultMineralValue({ fieldName, fieldType, label, validators }) {
  const normalizedField = String(fieldName || "").trim().toLowerCase();
  if (!normalizedField) return null;

  if (normalizedField === "entity_id" || normalizedField.endsWith("_id")) {
    return `moon-${randomSuffix()}`;
  }
  if (
    normalizedField === "label" ||
    normalizedField === "name" ||
    normalizedField === "title" ||
    normalizedField === "transaction_name" ||
    normalizedField === "value"
  ) {
    return label;
  }
  if (normalizedField === "state" || normalizedField === "status") {
    return "active";
  }

  const normalizedType = normalizeFieldType(fieldType);
  if (normalizedType === "number") {
    const hinted = findNumericValidatorHint(validators, fieldName);
    if (Number.isFinite(hinted)) return hinted;
    return 1;
  }
  if (normalizedType === "boolean") return false;
  if (normalizedType === "datetime") return new Date().toISOString();
  if (normalizedType === "json") return {};
  if (normalizedType === "null") return null;
  return label;
}

export function buildMoonCreateMinerals({ label, contract } = {}) {
  const safeLabel = String(label || "").trim() || "Moon";
  const requiredFields = Array.isArray(contract?.required_fields)
    ? contract.required_fields.map((item) => String(item || "").trim()).filter(Boolean)
    : [];
  const fieldTypes = contract?.field_types && typeof contract.field_types === "object" ? contract.field_types : {};
  const validators = Array.isArray(contract?.validators) ? contract.validators : [];

  const minerals = {};
  requiredFields.forEach((fieldName) => {
    if (RESERVED_CONTRACT_KEYS.has(fieldName)) return;
    minerals[fieldName] = defaultMineralValue({
      fieldName,
      fieldType: fieldTypes[fieldName],
      label: safeLabel,
      validators,
    });
  });
  return minerals;
}

