import { forceCollide, forceLink, forceManyBody, forceSimulation, forceX, forceY, forceZ } from "d3-force-3d";

function clamp(value, min, max) {
  return Math.max(min, Math.min(max, value));
}

const GOLDEN_ANGLE = Math.PI * (3 - Math.sqrt(5));
const STAR_CLEARANCE_RADIUS = 260;

function hashText(input) {
  const text = String(input || "");
  let hash = 2166136261;
  for (let i = 0; i < text.length; i += 1) {
    hash ^= text.charCodeAt(i);
    hash = Math.imul(hash, 16777619);
  }
  return hash >>> 0;
}

function spiralPolar(index, minRadius, radiusStep) {
  const i = Math.max(0, Number(index) || 0);
  // r(i) = r0 + step * sqrt(i + 1)
  // theta(i) = i * golden_angle
  return {
    radius: minRadius + radiusStep * Math.sqrt(i + 1),
    angle: i * GOLDEN_ANGLE,
  };
}

function orbitalSeedPosition(index, total, center, radiusBase = 84) {
  const [cx, cy, cz] = center;
  const n = Math.max(1, total);
  const angle = (Math.PI * 2 * index) / n;
  const ring = Math.floor(index / 8);
  const radius = radiusBase + ring * 24;
  return {
    x: cx + Math.cos(angle) * radius,
    y: cy + (index % 2 === 0 ? 5 : -5),
    z: cz + Math.sin(angle) * radius,
  };
}

function splitEntityAndPlanetName(table) {
  const explicitConstellation = String(table?.constellation_name || "").trim();
  const explicitPlanet = String(table?.planet_name || "").trim();
  if (explicitConstellation && explicitPlanet) {
    return {
      entityName: explicitConstellation,
      planetName: explicitPlanet,
    };
  }

  const raw = String(table?.name || "").trim() || "Souhvezdi";
  const separators = [">", "/", "::", "|"];
  for (const separator of separators) {
    if (!raw.includes(separator)) continue;
    const parts = raw
      .split(separator)
      .map((part) => part.trim())
      .filter(Boolean);
    if (parts.length >= 2) {
      return {
        entityName: parts[0],
        planetName: parts.slice(1).join(" / "),
      };
    }
  }
  return {
    entityName: raw,
    planetName: raw,
  };
}

function clampToStarClearance(point, minRadius = 260) {
  const x = Number(point?.[0] || 0);
  const y = Number(point?.[1] || 0);
  const z = Number(point?.[2] || 0);
  const radius = Math.sqrt(x * x + y * y + z * z);
  if (radius >= minRadius) return [x, y, z];
  if (radius < 1e-6) return [minRadius, 0, 0];
  const scale = minRadius / radius;
  return [x * scale, y * scale, z * scale];
}

function readSectorCenter(table) {
  const center = Array.isArray(table?.sector?.center) ? table.sector.center : null;
  if (!center || center.length !== 3) return null;
  const x = Number(center[0]);
  const y = Number(center[1]);
  const z = Number(center[2]);
  if (!Number.isFinite(x) || !Number.isFinite(y) || !Number.isFinite(z)) return null;
  return clampToStarClearance([x, y, z]);
}

function hasManualSectorPosition(table) {
  return String(table?.sector?.mode || "").toLowerCase() === "manual" && Boolean(readSectorCenter(table));
}

function aggregateTableLinks(tables) {
  const dominantType = (counter) => {
    const entries = Object.entries(counter || {});
    if (!entries.length) return "RELATION";
    entries.sort((a, b) => b[1] - a[1]);
    return entries[0][0];
  };

  const tableMemberIds = new Map(
    (tables || []).map((table) => [
      String(table.table_id),
      new Set((Array.isArray(table.members) ? table.members : []).map((member) => String(member.id))),
    ])
  );

  // 1) Deduplicate mirrored entries (each external bond can appear once in each table bucket)
  const uniqueBonds = new Map();
  tables.forEach((table) => {
    const currentTableId = String(table.table_id);
    const currentMembers = tableMemberIds.get(currentTableId) || new Set();
    const external = Array.isArray(table.external_bonds) ? table.external_bonds : [];
    external.forEach((bond) => {
      const bondId = String(bond.id || "");
      if (!bondId) return;
      const peerTableId = String(bond.peer_table_id || "");
      if (!peerTableId || currentTableId === peerTableId) return;

      const sourceAsteroidId = String(bond.source_id || "");
      const targetAsteroidId = String(bond.target_id || "");
      const sourceInCurrent = currentMembers.has(sourceAsteroidId);
      const targetInCurrent = currentMembers.has(targetAsteroidId);

      let sourceTableId = currentTableId;
      let targetTableId = peerTableId;
      if (sourceInCurrent && !targetInCurrent) {
        sourceTableId = currentTableId;
        targetTableId = peerTableId;
      } else if (!sourceInCurrent && targetInCurrent) {
        sourceTableId = peerTableId;
        targetTableId = currentTableId;
      }

      if (!uniqueBonds.has(bondId)) {
        uniqueBonds.set(bondId, {
          id: bondId,
          source: sourceTableId,
          target: targetTableId,
          type: String(bond.type || "RELATION").toUpperCase(),
        });
      }
    });
  });

  // 2) Aggregate multiple bonds between same table pair
  const pairLinks = new Map();
  uniqueBonds.forEach((bond) => {
    const key = `${bond.source}|${bond.target}`;
    const existing = pairLinks.get(key);
    if (existing) {
      existing.weight += 1;
      existing.typeCounts[bond.type] = (existing.typeCounts[bond.type] || 0) + 1;
    } else {
      pairLinks.set(key, {
        id: key,
        source: bond.source,
        target: bond.target,
        weight: 1,
        typeCounts: { [bond.type]: 1 },
      });
    }
  });

  return [...pairLinks.values()].map((item) => ({
    ...item,
    type: dominantType(item.typeCounts),
  }));
}

export function calculateHierarchyLayout({
  tables,
  selectedTableId,
  asteroidById,
  tablePhysicsById = null,
  asteroidPhysicsById = null,
  previous = null,
}) {
  const safeTables = Array.isArray(tables) ? [...tables] : [];
  if (!safeTables.length) {
    return {
      tablePositions: new Map(),
      asteroidPositions: new Map(),
      tableLinks: [],
      asteroidLinks: [],
      tableNodes: [],
      asteroidNodes: [],
    };
  }

  const previousAsteroidPositions = previous?.asteroidPositions instanceof Map ? previous.asteroidPositions : new Map();
  const safeTablePhysicsById = tablePhysicsById instanceof Map ? tablePhysicsById : new Map();
  const safeAsteroidPhysicsById = asteroidPhysicsById instanceof Map ? asteroidPhysicsById : new Map();

  const tableNodes = safeTables
    .map((table) => {
      const id = String(table.table_id);
      const memberCount = Array.isArray(table.members) ? table.members.length : 0;
      const baseRadius = clamp(16 + Math.sqrt(Math.max(1, memberCount)) * 3.8, 16, 46);
      const baseMass = clamp(1 + memberCount * 0.18, 1, 18);
      const physics = safeTablePhysicsById.get(id) || null;
      const radiusFactor = clamp(Number(physics?.radiusFactor) || 1, 0.85, 2.4);
      const massFactor = clamp(Number(physics?.massFactor) || 1, 0.8, 2.4);
      const radius = clamp(baseRadius * radiusFactor, 14, 52);
      const mass = clamp(baseMass * massFactor, 1, 24);
      const sectorCenter = readSectorCenter(table) || [0, 0, 0];
      const [x, y, z] = sectorCenter;
      const { entityName, planetName } = splitEntityAndPlanetName(table);
      return {
        id,
        kind: "table",
        label: planetName,
        entityName,
        planetName,
        memberCount,
        table,
        hasManualPosition: hasManualSectorPosition(table),
        radius,
        mass,
        x: Number(x) || 0,
        y: Number(y) || 0,
        z: Number(z) || 0,
      };
    })
    .sort((a, b) => a.id.localeCompare(b.id));

  const tableLinks = aggregateTableLinks(safeTables);

  const tablesByConstellation = new Map();
  tableNodes.forEach((node) => {
    const key = String(node?.entityName || "Uncategorized").trim() || "Uncategorized";
    if (!tablesByConstellation.has(key)) {
      tablesByConstellation.set(key, []);
    }
    tablesByConstellation.get(key).push(node);
  });

  const constellationEntries = [...tablesByConstellation.entries()]
    .map(([name, members]) => [name, [...members].sort((a, b) => a.id.localeCompare(b.id))])
    .sort((a, b) => String(a[0]).localeCompare(String(b[0])));
  const seededTablePositions = new Map();
  constellationEntries.forEach(([name, members], constellationIndex) => {
    const seed = hashText(name);
    const constellationSeedAngle = ((seed % 360) * Math.PI) / 180;
    const constellationPolar = spiralPolar(constellationIndex, STAR_CLEARANCE_RADIUS + 120, 170);
    const centerX = Math.cos(constellationPolar.angle + constellationSeedAngle * 0.1) * constellationPolar.radius;
    const centerZ = Math.sin(constellationPolar.angle + constellationSeedAngle * 0.1) * constellationPolar.radius;
    const centerY = Math.sin(constellationPolar.angle * 0.9) * 10;

    members.forEach((node, memberIndex) => {
      if (node.hasManualPosition) {
        const manualCenter = readSectorCenter(node.table) || [node.x, node.y, node.z];
        seededTablePositions.set(node.id, manualCenter);
        return;
      }
      const memberSeed = hashText(`${name}|${node.id}`);
      const localSeedAngle = ((memberSeed % 360) * Math.PI) / 180;
      const localPolar = spiralPolar(memberIndex, 86, 56);
      const localAngle = localPolar.angle + localSeedAngle * 0.08 + constellationPolar.angle * 0.24;
      const seedX = centerX + Math.cos(localAngle) * localPolar.radius;
      const seedY = centerY + Math.sin(localAngle * 1.7) * 7;
      const seedZ = centerZ + Math.sin(localAngle) * localPolar.radius;
      seededTablePositions.set(node.id, clampToStarClearance([seedX, seedY, seedZ], STAR_CLEARANCE_RADIUS));
    });
  });

  tableNodes.forEach((node) => {
    const seeded = seededTablePositions.get(node.id) || [0, 0, 0];
    node.x = Number(seeded[0]) || 0;
    node.y = Number(seeded[1]) || 0;
    node.z = Number(seeded[2]) || 0;
  });

  const tablePositions = new Map(tableNodes.map((node) => [node.id, [node.x, node.y, node.z]]));

  const selectedTable = safeTables.find((table) => String(table.table_id) === String(selectedTableId || "")) || null;
  if (!selectedTable) {
    return {
      tablePositions,
      asteroidPositions: new Map(),
      tableLinks,
      asteroidLinks: [],
      tableNodes,
      asteroidNodes: [],
    };
  }

  const tableCenter = tablePositions.get(String(selectedTable.table_id)) || [0, 0, 0];
  const members = Array.isArray(selectedTable.members) ? selectedTable.members : [];
  const selectedSemantic = splitEntityAndPlanetName(selectedTable);

  const asteroidNodes = members
    .map((member, index) => {
      const id = String(member.id);
      const asteroid = asteroidById.get(id) || { id, value: id, metadata: {} };
      const physics = safeAsteroidPhysicsById.get(id) || null;
      const radiusFactor = clamp(Number(physics?.radiusFactor) || 1, 0.84, 1.32);
      const massFactor = clamp(Number(physics?.massFactor) || 1, 0.82, 1.75);
      const prev = previousAsteroidPositions.get(id);
      const seeded = orbitalSeedPosition(index, members.length, tableCenter, 86 + (hashText(id) % 28));
      const x = Array.isArray(prev) ? prev[0] : seeded.x;
      const y = Array.isArray(prev) ? prev[1] : seeded.y;
      const z = Array.isArray(prev) ? prev[2] : seeded.z;
      return {
        id,
        kind: "asteroid",
        label: String(asteroid.value || "Mesic"),
        entityName: selectedSemantic.entityName,
        planetName: selectedSemantic.planetName,
        asteroid,
        radius: clamp(6.2 * radiusFactor, 5.4, 8.6),
        mass: clamp(1 * massFactor, 0.82, 1.75),
        x,
        y,
        z,
      };
    })
    .sort((a, b) => a.id.localeCompare(b.id));

  const asteroidLinkSource = Array.isArray(selectedTable.internal_bonds) ? selectedTable.internal_bonds : [];
  const asteroidLinks = asteroidLinkSource
    .map((bond) => ({
      id: String(bond.id),
      source: String(bond.source_id),
      target: String(bond.target_id),
      weight: 1,
      type: String(bond.type || "RELATION").toUpperCase(),
      directional: typeof bond.directional === "boolean" ? bond.directional : undefined,
      flow_direction: typeof bond.flow_direction === "string" ? bond.flow_direction : undefined,
    }))
    .filter((link) => link.source !== link.target);
  const asteroidLinksForLayout = asteroidLinks.map((link) => ({
    id: link.id,
    source: link.source,
    target: link.target,
    weight: link.weight,
  }));

  const asteroidSim = forceSimulation(asteroidNodes)
    .force(
      "charge",
      forceManyBody().strength((node) => -150 - node.mass * 95)
    )
    .force(
      "collision",
      forceCollide()
        .radius((node) => node.radius + 5.4 + node.mass * 0.9)
        .iterations(2)
    )
    .force(
      "link",
      forceLink(asteroidLinksForLayout)
        .id((node) => node.id)
        .distance((link) => 34 + Math.min(16, Number(link.weight || 1) * 4))
        .strength((link) => clamp(0.28 + Number(link.weight || 1) * 0.07, 0.28, 0.72))
    )
    .force("x", forceX(tableCenter[0]).strength(0.07))
    .force("y", forceY(tableCenter[1]).strength(0.09))
    .force("z", forceZ(tableCenter[2]).strength(0.07))
    .stop();

  for (let i = 0; i < 220; i += 1) asteroidSim.tick();

  const asteroidPositions = new Map(asteroidNodes.map((node) => [node.id, [node.x, node.y, node.z]]));

  return {
    tablePositions,
    asteroidPositions,
    tableLinks,
    asteroidLinks,
    tableNodes,
    asteroidNodes,
  };
}
