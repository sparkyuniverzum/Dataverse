function normalizeMessage(message) {
  return String(message || "").trim();
}

export function isContractViolationMessage(message = "") {
  const text = normalizeMessage(message).toLowerCase();
  return text.includes("table contract violation") || text.includes("required field");
}

export function extractMissingRequiredFields(message = "") {
  const text = normalizeMessage(message);
  if (!text) return [];

  const regex = /required field ['"]?([^'"]+)['"]? is missing/gi;
  const values = [];
  let match = regex.exec(text);
  while (match) {
    const key = String(match[1] || "").trim();
    if (key && !values.includes(key)) {
      values.push(key);
    }
    match = regex.exec(text);
  }
  return values;
}

export function buildContractViolationRecovery(message = "", { knownFieldKeys = [] } = {}) {
  const missingFields = extractMissingRequiredFields(message);
  const normalizedKnown = (Array.isArray(knownFieldKeys) ? knownFieldKeys : [])
    .map((item) => String(item || "").trim())
    .filter(Boolean);
  const recoverable = missingFields.filter((key) => normalizedKnown.includes(key));
  const unresolved = missingFields.filter((key) => !normalizedKnown.includes(key));
  return {
    hasViolation: isContractViolationMessage(message),
    missingFields,
    recoverable,
    unresolved,
  };
}
