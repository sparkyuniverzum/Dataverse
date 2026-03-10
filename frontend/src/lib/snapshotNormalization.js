function toObject(raw) {
  return raw && typeof raw === "object" ? raw : {};
}

function normalizeAsteroidSource(data) {
  if (Array.isArray(data?.asteroids)) return data.asteroids;
  if (Array.isArray(data?.civilizations)) return data.civilizations;
  if (Array.isArray(data?.moons)) return data.moons;
  if (Array.isArray(data?.atoms)) return data.atoms;
  return [];
}

function normalizeBondSource(data) {
  if (Array.isArray(data?.bonds)) return data.bonds;
  if (Array.isArray(data?.relations)) return data.relations;
  if (Array.isArray(data?.links)) return data.links;
  return [];
}

export function normalizeSnapshotAsteroids(data) {
  return normalizeAsteroidSource(data)
    .map((raw) => {
      const source = toObject(raw);
      const id = String(source.id || source.civilization_id || source.moon_id || "").trim();
      if (!id) return null;
      const tableId = String(source.table_id || source.planet_id || "").trim();
      const metadataSource =
        source.metadata && typeof source.metadata === "object" && !Array.isArray(source.metadata)
          ? source.metadata
          : source.minerals && typeof source.minerals === "object" && !Array.isArray(source.minerals)
            ? source.minerals
            : {};
      const value = source.value ?? source.label ?? source.name ?? "";
      return {
        ...source,
        id,
        value,
        table_id: tableId,
        metadata: metadataSource,
        minerals:
          source.minerals && typeof source.minerals === "object" && !Array.isArray(source.minerals)
            ? source.minerals
            : metadataSource,
      };
    })
    .filter((asteroid) => asteroid && asteroid.is_deleted !== true);
}

export function normalizeSnapshotBonds(data, asteroidIds = new Set()) {
  return normalizeBondSource(data)
    .map((raw) => {
      const source = toObject(raw);
      const sourceId = String(source.source_id || source.source_civilization_id || "").trim();
      const targetId = String(source.target_id || source.target_civilization_id || "").trim();
      if (!sourceId || !targetId) return null;
      return {
        ...source,
        source_id: sourceId,
        target_id: targetId,
      };
    })
    .filter(
      (bond) =>
        bond &&
        bond.is_deleted !== true &&
        asteroidIds.has(String(bond.source_id)) &&
        asteroidIds.has(String(bond.target_id))
    );
}

export function normalizeSnapshotProjection(data) {
  const asteroids = normalizeSnapshotAsteroids(data);
  const asteroidIds = new Set(asteroids.map((asteroid) => String(asteroid.id)));
  const bonds = normalizeSnapshotBonds(data, asteroidIds);
  return { asteroids, bonds };
}
