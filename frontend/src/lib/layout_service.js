const SECTOR_SPACING = 500;
const LINK_PULL_SAME_SECTOR = 0.022;
const LINK_PULL_CROSS_SECTOR = 0.008;
const CENTER_PULL = 0.018;
const RING_PULL = 0.028;
const COLLISION_PADDING = 6.5;
const ITERATIONS = 160;

function clamp(value, min, max) {
  return Math.max(min, Math.min(max, value));
}

function hashText(input) {
  const text = String(input ?? "");
  let hash = 2166136261;
  for (let i = 0; i < text.length; i += 1) {
    hash ^= text.charCodeAt(i);
    hash = Math.imul(hash, 16777619);
  }
  return hash >>> 0;
}

function normalizeCategory(value) {
  const text = String(value ?? "").trim();
  return text || "Uncategorized";
}

function seededUnitVector(seedText) {
  const seed = hashText(seedText);
  const u = ((seed & 0xffff) / 0xffff) * 2 - 1;
  const v = (((seed >>> 16) & 0xffff) / 0xffff) * 2 - 1;
  const theta = (u + 1) * Math.PI;
  const z = clamp(v, -0.97, 0.97);
  const radius = Math.sqrt(1 - z * z);
  return [Math.cos(theta) * radius, z, Math.sin(theta) * radius];
}

function getSectorCenter(index, total) {
  const cols = Math.max(1, Math.ceil(Math.sqrt(total)));
  const rows = Math.max(1, Math.ceil(total / cols));
  const col = index % cols;
  const row = Math.floor(index / cols);
  const offsetX = ((cols - 1) * SECTOR_SPACING) / 2;
  const offsetZ = ((rows - 1) * SECTOR_SPACING) / 2;
  return [col * SECTOR_SPACING - offsetX, 0, row * SECTOR_SPACING - offsetZ];
}

function buildRingPlacement(node, localIndex, count, center, seedShift) {
  const [cx, cy, cz] = center;
  let ringIndex = 0;
  let consumed = 0;
  let capacity = 6;
  while (localIndex >= consumed + capacity) {
    consumed += capacity;
    ringIndex += 1;
    capacity += 6;
  }
  const ringPos = localIndex - consumed;
  const radius = 46 + ringIndex * 26 + (Number(node.collisionRadius) || 2.2) * 0.45;
  const angle = seedShift + (Math.PI * 2 * ringPos) / Math.max(1, capacity);
  const [nx, ny, nz] = seededUnitVector(`${node.id}|ring-jitter`);
  return {
    x: cx + Math.cos(angle) * radius + nx * 1.7,
    y: cy + ny * 2.1 + (ringIndex % 2 === 0 ? 0.65 : -0.65),
    z: cz + Math.sin(angle) * radius + nz * 1.7,
    targetRadius: radius,
  };
}

function buildBeltPlacement(node, localIndex, count, center, seedShift) {
  const [cx, cy, cz] = center;
  const n = Math.max(1, count);
  const beltRadius = clamp(42 + Math.sqrt(n) * 20, 48, 138);
  const golden = Math.PI * (3 - Math.sqrt(5));
  const angle = seedShift + localIndex * golden;
  const radial = beltRadius * Math.sqrt((localIndex + 0.6) / n);
  const [nx, ny, nz] = seededUnitVector(`${node.id}|belt-jitter`);
  return {
    x: cx + Math.cos(angle) * radial + nx * 2.4,
    y: cy + ny * 2.8,
    z: cz + Math.sin(angle) * radial + nz * 2.4,
    targetRadius: radial,
  };
}

function resolveNodeIdentity(edge) {
  const sourceId = edge.flow_source_id || edge.source_id || edge.source || null;
  const targetId = edge.flow_target_id || edge.target_id || edge.target || null;
  return [sourceId, targetId];
}

export function calculateSectorLayout({ nodes, edges, previousPositions }) {
  const safeNodes = Array.isArray(nodes) ? nodes : [];
  const safeEdges = Array.isArray(edges) ? edges : [];
  if (!safeNodes.length) {
    return { positions: new Map(), sectors: [] };
  }

  const sortedNodes = [...safeNodes].sort((a, b) => String(a.id).localeCompare(String(b.id)));
  const byCategory = new Map();
  sortedNodes.forEach((node) => {
    const category = normalizeCategory(node.category);
    if (!byCategory.has(category)) {
      byCategory.set(category, []);
    }
    byCategory.get(category).push(node);
  });

  const categoryNames = [...byCategory.keys()].sort((a, b) => a.localeCompare(b));
  const sectorByCategory = new Map();
  categoryNames.forEach((category, index) => {
    const members = byCategory.get(category) || [];
    const metadataFieldSet = new Set();
    members.forEach((node) => {
      const metadata = node?.metadata && typeof node.metadata === "object" && !Array.isArray(node.metadata)
        ? node.metadata
        : {};
      Object.keys(metadata).forEach((key) => metadataFieldSet.add(key));
    });
    const mode = members.length > 5 || metadataFieldSet.size > 3 ? "ring" : "belt";
    const center = getSectorCenter(index, categoryNames.length);
    const size = clamp(
      210 + Math.sqrt(members.length || 1) * 34 + (mode === "ring" ? 70 : 22),
      220,
      420
    );
    sectorByCategory.set(category, {
      id: `sector-${hashText(category).toString(16)}`,
      label: category,
      category,
      center,
      mode,
      size,
      metadataFieldCount: metadataFieldSet.size,
      asteroidCount: members.length,
    });
  });

  const points = sortedNodes.map((node) => {
    const category = normalizeCategory(node.category);
    const sector = sectorByCategory.get(category);
    const members = byCategory.get(category) || [];
    const localNodes = [...members].sort((a, b) => String(a.id).localeCompare(String(b.id)));
    const localIndex = localNodes.findIndex((item) => item.id === node.id);
    const seedShift = ((hashText(`${category}|${node.id}`) % 360) / 360) * Math.PI * 2;
    const fallback = sector.mode === "ring"
      ? buildRingPlacement(node, Math.max(0, localIndex), localNodes.length, sector.center, seedShift)
      : buildBeltPlacement(node, Math.max(0, localIndex), localNodes.length, sector.center, seedShift);
    const prev = previousPositions?.get(node.id);
    const hasValidPrev =
      Array.isArray(prev) &&
      prev.length === 3 &&
      prev.every((value) => Number.isFinite(value));

    const collisionRadius = Number(node.collisionRadius) || 2.2;
    return {
      id: node.id,
      category,
      sector,
      mode: sector.mode,
      x: hasValidPrev ? prev[0] : fallback.x,
      y: hasValidPrev ? prev[1] : fallback.y,
      z: hasValidPrev ? prev[2] : fallback.z,
      vx: 0,
      vy: 0,
      vz: 0,
      targetRadius: fallback.targetRadius,
      collisionRadius,
      mass: Number(node.mass) || 1,
    };
  });

  const indexById = new Map(points.map((point, index) => [point.id, index]));
  for (let it = 0; it < ITERATIONS; it += 1) {
    const alpha = 1 - it / ITERATIONS;

    for (let i = 0; i < points.length; i += 1) {
      for (let j = i + 1; j < points.length; j += 1) {
        const a = points[i];
        const b = points[j];
        let dx = a.x - b.x;
        let dy = a.y - b.y;
        let dz = a.z - b.z;
        let dist = Math.sqrt(dx * dx + dy * dy + dz * dz);
        if (dist < 0.0001) {
          const [nx, ny, nz] = seededUnitVector(`${a.id}|${b.id}|collision`);
          dx = nx;
          dy = ny;
          dz = nz;
          dist = 1;
        }
        const minDistance = a.collisionRadius + b.collisionRadius + COLLISION_PADDING;
        if (dist >= minDistance) continue;
        const overlap = (minDistance - dist) * 0.5 * alpha;
        const nx = dx / dist;
        const ny = dy / dist;
        const nz = dz / dist;
        a.x += nx * overlap;
        a.y += ny * overlap;
        a.z += nz * overlap;
        b.x -= nx * overlap;
        b.y -= ny * overlap;
        b.z -= nz * overlap;
      }
    }

    safeEdges.forEach((edge) => {
      const [sourceId, targetId] = resolveNodeIdentity(edge);
      if (!sourceId || !targetId) return;
      const sourceIdx = indexById.get(sourceId);
      const targetIdx = indexById.get(targetId);
      if (sourceIdx === undefined || targetIdx === undefined) return;

      const source = points[sourceIdx];
      const target = points[targetIdx];
      const dx = target.x - source.x;
      const dy = target.y - source.y;
      const dz = target.z - source.z;
      const dist = Math.sqrt(dx * dx + dy * dy + dz * dz) || 0.01;
      const ideal = source.collisionRadius + target.collisionRadius + 24;
      if (dist <= ideal) return;
      const sameSector = source.category === target.category;
      const pull = (sameSector ? LINK_PULL_SAME_SECTOR : LINK_PULL_CROSS_SECTOR) * alpha;
      const force = (dist - ideal) * pull;
      source.x += (dx / dist) * force;
      source.y += (dy / dist) * force * 0.9;
      source.z += (dz / dist) * force;
      target.x -= (dx / dist) * force;
      target.y -= (dy / dist) * force * 0.9;
      target.z -= (dz / dist) * force;
    });

    points.forEach((point) => {
      const [cx, cy, cz] = point.sector.center;
      const toCenterX = cx - point.x;
      const toCenterY = cy - point.y;
      const toCenterZ = cz - point.z;
      point.x += toCenterX * CENTER_PULL * alpha;
      point.y += toCenterY * CENTER_PULL * alpha * 0.6;
      point.z += toCenterZ * CENTER_PULL * alpha;

      if (point.mode === "ring") {
        const localX = point.x - cx;
        const localZ = point.z - cz;
        const localDist = Math.sqrt(localX * localX + localZ * localZ) || 0.01;
        const radialDiff = (point.targetRadius || 46) - localDist;
        point.x += (localX / localDist) * radialDiff * RING_PULL * alpha;
        point.z += (localZ / localDist) * radialDiff * RING_PULL * alpha;
      }

      const radiusLimit = point.sector.size * 0.46;
      const fromCenterX = point.x - cx;
      const fromCenterZ = point.z - cz;
      const fromCenterDist = Math.sqrt(fromCenterX * fromCenterX + fromCenterZ * fromCenterZ) || 0.01;
      if (fromCenterDist > radiusLimit) {
        const scale = radiusLimit / fromCenterDist;
        point.x = cx + fromCenterX * scale;
        point.z = cz + fromCenterZ * scale;
      }
      point.y = clamp(point.y, cy - 14, cy + 14);
    });
  }

  const positions = new Map(points.map((point) => [point.id, [point.x, point.y, point.z]]));
  const sectors = categoryNames.map((category) => {
    const sector = sectorByCategory.get(category);
    return {
      id: sector.id,
      label: sector.label,
      category: sector.category,
      center: [...sector.center],
      size: sector.size,
      mode: sector.mode,
      metadataFieldCount: sector.metadataFieldCount,
      asteroidCount: sector.asteroidCount,
    };
  });
  return { positions, sectors };
}
