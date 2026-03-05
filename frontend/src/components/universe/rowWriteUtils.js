export function parseMetadataLiteral(rawValue) {
  const text = String(rawValue ?? "");
  const trimmed = text.trim();
  if (!trimmed) return undefined;
  if (trimmed === "true") return true;
  if (trimmed === "false") return false;
  if (trimmed === "null") return null;
  if (/^-?\d+(\.\d+)?$/.test(trimmed)) return Number(trimmed);
  if ((trimmed.startsWith("{") && trimmed.endsWith("}")) || (trimmed.startsWith("[") && trimmed.endsWith("]"))) {
    try {
      return JSON.parse(trimmed);
    } catch {
      return text;
    }
  }
  return text;
}

export function mergeMetadataValue(metadata, key, rawValue) {
  const metadataKey = String(key || "").trim();
  if (!metadataKey) return metadata && typeof metadata === "object" ? { ...metadata } : {};
  const current = metadata && typeof metadata === "object" ? { ...metadata } : {};
  const parsed = parseMetadataLiteral(rawValue);
  if (typeof parsed === "undefined") {
    delete current[metadataKey];
  } else {
    current[metadataKey] = parsed;
  }
  return current;
}
