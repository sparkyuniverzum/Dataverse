function normalizeKey(raw) {
  return String(raw || "")
    .trim()
    .toLowerCase();
}

export function buildRemoveSoftConfirmationKey({ rowId = "", mineralKey = "" } = {}) {
  const normalizedRowId = String(rowId || "").trim();
  const normalizedMineralKey = normalizeKey(mineralKey);
  if (!normalizedRowId || !normalizedMineralKey) return "";
  return `${normalizedRowId}:${normalizedMineralKey}`;
}
