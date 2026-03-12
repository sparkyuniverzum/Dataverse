export const WORKSPACE_UI_STORAGE_PREFIX = "dv:workspace-ui:v1";

function safeStorage(provided) {
  if (provided && typeof provided.getItem === "function" && typeof provided.setItem === "function") {
    return provided;
  }
  if (typeof window !== "undefined" && window.localStorage) {
    return window.localStorage;
  }
  return null;
}

function asBoolean(value, fallback = false) {
  if (typeof value === "boolean") return value;
  if (typeof value === "string") {
    const lowered = value.trim().toLowerCase();
    if (lowered === "true") return true;
    if (lowered === "false") return false;
  }
  return fallback;
}

export function buildWorkspaceUiStorageKey(galaxyId) {
  const scope = String(galaxyId || "").trim();
  return `${WORKSPACE_UI_STORAGE_PREFIX}:${scope || "unknown"}`;
}

export function normalizeWorkspaceUiState(raw) {
  const source = raw && typeof raw === "object" ? raw : {};
  return {
    selectedTableId: String(source.selected_table_id || source.selectedTableId || "").trim(),
    quickGridOpen: asBoolean(source.quick_grid_open ?? source.quickGridOpen, false),
  };
}

export function readWorkspaceUiState(galaxyId, { storage } = {}) {
  const resolvedStorage = safeStorage(storage);
  if (!resolvedStorage) {
    return { selectedTableId: "", quickGridOpen: false };
  }
  const key = buildWorkspaceUiStorageKey(galaxyId);
  try {
    const raw = resolvedStorage.getItem(key);
    if (!raw) return { selectedTableId: "", quickGridOpen: false };
    return normalizeWorkspaceUiState(JSON.parse(raw));
  } catch {
    return { selectedTableId: "", quickGridOpen: false };
  }
}

export function writeWorkspaceUiState(galaxyId, nextState, { storage } = {}) {
  const resolvedStorage = safeStorage(storage);
  if (!resolvedStorage) return false;
  const key = buildWorkspaceUiStorageKey(galaxyId);
  const normalized = normalizeWorkspaceUiState(nextState);
  try {
    if (!normalized.selectedTableId && !normalized.quickGridOpen) {
      resolvedStorage.removeItem(key);
      return true;
    }
    resolvedStorage.setItem(
      key,
      JSON.stringify({
        selected_table_id: normalized.selectedTableId,
        quick_grid_open: normalized.quickGridOpen,
        updated_at: new Date().toISOString(),
      })
    );
    return true;
  } catch {
    return false;
  }
}
