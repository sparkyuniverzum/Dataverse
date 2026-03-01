import { forceCenter, forceCollide, forceLink, forceManyBody, forceSimulation, forceX, forceY, forceZ } from "d3-force-3d";

function clamp(value, min, max) {
  return Math.max(min, Math.min(max, value));
}

function hashText(input) {
  const text = String(input || "");
  let hash = 2166136261;
  for (let i = 0; i < text.length; i += 1) {
    hash ^= text.charCodeAt(i);
    hash = Math.imul(hash, 16777619);
  }
  return hash >>> 0;
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
    const parts = raw.split(separator).map((part) => part.trim()).filter(Boolean);
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

  const previousTablePositions = previous?.tablePositions instanceof Map ? previous.tablePositions : new Map();
  const previousAsteroidPositions = previous?.asteroidPositions instanceof Map ? previous.asteroidPositions : new Map();

  const tableNodes = safeTables
    .map((table) => {
      const id = String(table.table_id);
      const memberCount = Array.isArray(table.members) ? table.members.length : 0;
      const radius = clamp(16 + Math.sqrt(Math.max(1, memberCount)) * 3.8, 16, 46);
      const mass = clamp(1 + memberCount * 0.18, 1, 18);
      const prev = previousTablePositions.get(id);
      const sectorCenter = Array.isArray(table?.sector?.center) ? table.sector.center : [0, 0, 0];
      const [x, y, z] = Array.isArray(prev) ? prev : sectorCenter;
      const { entityName, planetName } = splitEntityAndPlanetName(table);
      return {
        id,
        kind: "table",
        label: planetName,
        entityName,
        planetName,
        memberCount,
        table,
        radius,
        mass,
        x: Number(x) || 0,
        y: Number(y) || 0,
        z: Number(z) || 0,
      };
    })
    .sort((a, b) => a.id.localeCompare(b.id));

  const tableLinks = aggregateTableLinks(safeTables);
  const tableLinksForLayout = tableLinks.map((link) => ({
    id: link.id,
    source: link.source,
    target: link.target,
    weight: link.weight,
  }));

  const tableSim = forceSimulation(tableNodes)
    .force("charge", forceManyBody().strength((node) => -2200 - node.mass * 140))
    .force("center", forceCenter(0, 0, 0).strength(0.08))
    .force("collision", forceCollide().radius((node) => node.radius + 82).iterations(2))
    .force(
      "link",
      forceLink(tableLinksForLayout)
        .id((node) => node.id)
        .distance((link) => 220 + Math.min(180, Number(link.weight || 1) * 24))
        .strength((link) => clamp(0.22 + Number(link.weight || 1) * 0.08, 0.22, 0.78))
    )
    .stop();

  for (let i = 0; i < 240; i += 1) tableSim.tick();

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
        radius: 6.2,
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
    }))
    .filter((link) => link.source !== link.target);
  const asteroidLinksForLayout = asteroidLinks.map((link) => ({
    id: link.id,
    source: link.source,
    target: link.target,
    weight: link.weight,
  }));

  const asteroidSim = forceSimulation(asteroidNodes)
    .force("charge", forceManyBody().strength(-190))
    .force("collision", forceCollide().radius((node) => node.radius + 5.4).iterations(2))
    .force(
      "link",
      forceLink(asteroidLinksForLayout)
        .id((node) => node.id)
        .distance(34)
        .strength(0.35)
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
