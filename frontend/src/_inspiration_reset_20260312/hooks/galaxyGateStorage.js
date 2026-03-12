export const LEGACY_SELECTED_GALAXY_STORAGE_KEY = "dataverse_selected_galaxy_id";

export function buildSelectedGalaxyStorageKey(userId) {
  const safeUserId = String(userId || "").trim();
  return safeUserId ? `${LEGACY_SELECTED_GALAXY_STORAGE_KEY}:${safeUserId}` : LEGACY_SELECTED_GALAXY_STORAGE_KEY;
}

export function readPersistedSelectedGalaxyId(storage, userId) {
  if (!storage) return "";
  const scopedKey = buildSelectedGalaxyStorageKey(userId);
  const scopedValue = String(storage.getItem(scopedKey) || "").trim();
  if (scopedValue) return scopedValue;
  const legacyValue = String(storage.getItem(LEGACY_SELECTED_GALAXY_STORAGE_KEY) || "").trim();
  return legacyValue;
}

export function writePersistedSelectedGalaxyId(storage, userId, galaxyId) {
  if (!storage) return;
  const safeGalaxyId = String(galaxyId || "").trim();
  const scopedKey = buildSelectedGalaxyStorageKey(userId);
  if (safeGalaxyId) {
    storage.setItem(scopedKey, safeGalaxyId);
  } else {
    storage.removeItem(scopedKey);
  }
  storage.removeItem(LEGACY_SELECTED_GALAXY_STORAGE_KEY);
}

export function clearPersistedSelectedGalaxyId(storage, userId) {
  if (!storage) return;
  storage.removeItem(buildSelectedGalaxyStorageKey(userId));
  storage.removeItem(LEGACY_SELECTED_GALAXY_STORAGE_KEY);
}
