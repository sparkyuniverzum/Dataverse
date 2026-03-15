function normalizeEventType(value) {
  return String(value || "")
    .trim()
    .toUpperCase();
}

function mergeMetadata(currentMetadata, nextMetadata, metadataRemove) {
  const current =
    currentMetadata && typeof currentMetadata === "object" && !Array.isArray(currentMetadata) ? currentMetadata : {};
  const incoming = nextMetadata && typeof nextMetadata === "object" && !Array.isArray(nextMetadata) ? nextMetadata : {};
  const next = { ...current, ...incoming };
  const removeKeys = Array.isArray(metadataRemove) ? metadataRemove : [];
  removeKeys.forEach((key) => {
    const safeKey = String(key || "").trim();
    if (safeKey) {
      delete next[safeKey];
    }
  });
  return next;
}

function patchMetadataUpdated(snapshot, event) {
  const entityId = String(event?.entity_id || "").trim();
  if (!entityId) return null;
  let changed = false;
  const asteroids = snapshot.asteroids.map((item) => {
    if (String(item?.id || "") !== entityId) return item;
    changed = true;
    const nextMetadata = mergeMetadata(item.metadata, event?.payload?.metadata, event?.payload?.metadata_remove);
    return {
      ...item,
      metadata: nextMetadata,
      minerals: nextMetadata,
      current_event_seq: Math.max(Number(item?.current_event_seq || 0), Number(event?.event_seq || 0)),
    };
  });
  return changed ? { ...snapshot, asteroids } : null;
}

function patchAsteroidValueUpdated(snapshot, event) {
  const entityId = String(event?.entity_id || "").trim();
  if (!entityId) return null;
  let changed = false;
  const nextValue = event?.payload?.value;
  const asteroids = snapshot.asteroids.map((item) => {
    if (String(item?.id || "") !== entityId) return item;
    changed = true;
    return {
      ...item,
      value: nextValue ?? item.value,
      current_event_seq: Math.max(Number(item?.current_event_seq || 0), Number(event?.event_seq || 0)),
    };
  });
  return changed ? { ...snapshot, asteroids } : null;
}

function patchBondFormed(snapshot, event) {
  const payload = event?.payload && typeof event.payload === "object" ? event.payload : {};
  const sourceId = String(payload.source_civilization_id || payload.source_id || "").trim();
  const targetId = String(payload.target_civilization_id || payload.target_id || "").trim();
  const bondId = String(event?.entity_id || payload.bond_id || payload.id || "").trim();
  if (!sourceId || !targetId || !bondId) return null;
  const asteroidIds = new Set(snapshot.asteroids.map((item) => String(item?.id || "")));
  if (!asteroidIds.has(sourceId) || !asteroidIds.has(targetId)) return null;
  const existingIndex = snapshot.bonds.findIndex((item) => String(item?.id || "") === bondId);
  const nextBond = {
    id: bondId,
    source_id: sourceId,
    target_id: targetId,
    type: payload.type || "RELATION",
    current_event_seq: Number(event?.event_seq || 0),
    is_deleted: false,
  };
  if (existingIndex >= 0) {
    const bonds = [...snapshot.bonds];
    bonds[existingIndex] = { ...bonds[existingIndex], ...nextBond };
    return { ...snapshot, bonds };
  }
  return { ...snapshot, bonds: [...snapshot.bonds, nextBond] };
}

function patchBondSoftDeleted(snapshot, event) {
  const bondId = String(event?.entity_id || "").trim();
  if (!bondId) return null;
  const nextBonds = snapshot.bonds.filter((item) => String(item?.id || "") !== bondId);
  if (nextBonds.length === snapshot.bonds.length) return null;
  return { ...snapshot, bonds: nextBonds };
}

const SUPPORTED_PATCHERS = Object.freeze({
  METADATA_UPDATED: patchMetadataUpdated,
  ASTEROID_VALUE_UPDATED: patchAsteroidValueUpdated,
  BOND_FORMED: patchBondFormed,
  BOND_SOFT_DELETED: patchBondSoftDeleted,
});

export function applyRuntimeEventBatchToSnapshot(snapshot, events) {
  const baseSnapshot =
    snapshot && typeof snapshot === "object" && Array.isArray(snapshot.asteroids) && Array.isArray(snapshot.bonds)
      ? snapshot
      : { asteroids: [], bonds: [] };
  const batch = Array.isArray(events) ? events : [];
  if (batch.length === 0) {
    return { snapshot: baseSnapshot, applied: false, requiresRefresh: false, patchedEvents: [] };
  }

  let nextSnapshot = baseSnapshot;
  const patchedEvents = [];

  for (const rawEvent of batch) {
    const eventType = normalizeEventType(rawEvent?.event_type || rawEvent?.type);
    const patcher = SUPPORTED_PATCHERS[eventType];
    if (!patcher) {
      return { snapshot: baseSnapshot, applied: false, requiresRefresh: true, patchedEvents: patchedEvents.slice() };
    }
    const patched = patcher(nextSnapshot, rawEvent);
    if (!patched) {
      return { snapshot: baseSnapshot, applied: false, requiresRefresh: true, patchedEvents: patchedEvents.slice() };
    }
    nextSnapshot = patched;
    patchedEvents.push(eventType);
  }

  return {
    snapshot: nextSnapshot,
    applied: patchedEvents.length > 0,
    requiresRefresh: false,
    patchedEvents,
  };
}
