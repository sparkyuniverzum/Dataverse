/**
 * Canonical semantic types for hierarchy transformation.
 * Stage 1 scope: strict typing + normalization + diagnostics container.
 */

export const NODE_SEMANTIC_TYPES = Object.freeze({
  CONSTELLATION: "CONSTELLATION",
  PLANET: "PLANET",
  MOON: "MOON",
  UNKNOWN: "UNKNOWN",
});

export const EDGE_SEMANTIC_TYPES = Object.freeze({
  INSTANCE_OF: "INSTANCE_OF",
  FLOW: "FLOW",
  RELATION: "RELATION",
  GUARDIAN: "GUARDIAN",
  UNKNOWN: "UNKNOWN",
});

const NODE_ALIASES = Object.freeze({
  CONSTELLATION: NODE_SEMANTIC_TYPES.CONSTELLATION,
  GROUP: NODE_SEMANTIC_TYPES.CONSTELLATION,
  CLUSTER: NODE_SEMANTIC_TYPES.CONSTELLATION,
  PLANET: NODE_SEMANTIC_TYPES.PLANET,
  TABLE: NODE_SEMANTIC_TYPES.PLANET,
  TAB: NODE_SEMANTIC_TYPES.PLANET,
  MOON: NODE_SEMANTIC_TYPES.MOON,
  ROW: NODE_SEMANTIC_TYPES.MOON,
  ASTEROID: NODE_SEMANTIC_TYPES.MOON,
  ITEM: NODE_SEMANTIC_TYPES.MOON,
});

const EDGE_ALIASES = Object.freeze({
  INSTANCE_OF: EDGE_SEMANTIC_TYPES.INSTANCE_OF,
  TYPE: EDGE_SEMANTIC_TYPES.INSTANCE_OF,
  ":": EDGE_SEMANTIC_TYPES.INSTANCE_OF,
  FLOW: EDGE_SEMANTIC_TYPES.FLOW,
  "->": EDGE_SEMANTIC_TYPES.FLOW,
  RELATION: EDGE_SEMANTIC_TYPES.RELATION,
  REL: EDGE_SEMANTIC_TYPES.RELATION,
  LINK: EDGE_SEMANTIC_TYPES.RELATION,
  "+": EDGE_SEMANTIC_TYPES.RELATION,
  GUARDIAN: EDGE_SEMANTIC_TYPES.GUARDIAN,
  GUARD: EDGE_SEMANTIC_TYPES.GUARDIAN,
  WATCH: EDGE_SEMANTIC_TYPES.GUARDIAN,
});

function normalizeToken(value) {
  return String(value || "")
    .trim()
    .toUpperCase()
    .replaceAll("-", "_")
    .replaceAll(" ", "_");
}

/**
 * @param {unknown} rawType
 * @returns {"CONSTELLATION" | "PLANET" | "MOON" | "UNKNOWN"}
 */
export function normalizeNodeSemanticType(rawType) {
  const token = normalizeToken(rawType);
  if (!token) return NODE_SEMANTIC_TYPES.UNKNOWN;
  return NODE_ALIASES[token] || NODE_SEMANTIC_TYPES.UNKNOWN;
}

/**
 * @param {unknown} rawType
 * @returns {"INSTANCE_OF" | "FLOW" | "RELATION" | "GUARDIAN" | "UNKNOWN"}
 */
export function normalizeEdgeSemanticType(rawType) {
  const raw = String(rawType || "").trim();
  if (raw === "->") return EDGE_SEMANTIC_TYPES.FLOW;
  if (raw === ":") return EDGE_SEMANTIC_TYPES.INSTANCE_OF;
  if (raw === "+") return EDGE_SEMANTIC_TYPES.RELATION;
  const token = normalizeToken(rawType);
  if (!token) return EDGE_SEMANTIC_TYPES.UNKNOWN;
  return EDGE_ALIASES[token] || EDGE_SEMANTIC_TYPES.UNKNOWN;
}

/**
 * @param {unknown} rawNode
 * @returns {string}
 */
export function nodeIdOf(rawNode) {
  if (!rawNode || typeof rawNode !== "object") return "";
  const node = /** @type {Record<string, unknown>} */ (rawNode);
  return String(node.id || node.node_id || node.asteroid_id || "").trim();
}

/**
 * @param {unknown} rawEdge
 * @returns {{ sourceId: string, targetId: string }}
 */
export function edgeEndpointsOf(rawEdge) {
  if (!rawEdge || typeof rawEdge !== "object") {
    return { sourceId: "", targetId: "" };
  }
  const edge = /** @type {Record<string, unknown>} */ (rawEdge);
  return {
    sourceId: String(edge.source_id || edge.source || "").trim(),
    targetId: String(edge.target_id || edge.target || "").trim(),
  };
}

export function createHierarchyDiagnostics() {
  return {
    warnings: [],
    errors: [],
    droppedEdges: [],
  };
}

function semanticTypeOfNode(rawNode) {
  if (!rawNode || typeof rawNode !== "object") return NODE_SEMANTIC_TYPES.UNKNOWN;
  const node = /** @type {Record<string, unknown>} */ (rawNode);
  const candidates = [
    node.semantic_type,
    node.semanticType,
    node.node_type,
    node.nodeType,
    node.kind,
    node.type,
  ];
  for (const candidate of candidates) {
    const normalized = normalizeNodeSemanticType(candidate);
    if (normalized !== NODE_SEMANTIC_TYPES.UNKNOWN) return normalized;
  }
  return NODE_SEMANTIC_TYPES.UNKNOWN;
}

function semanticTypeOfEdge(rawEdge) {
  if (!rawEdge || typeof rawEdge !== "object") return EDGE_SEMANTIC_TYPES.UNKNOWN;
  const edge = /** @type {Record<string, unknown>} */ (rawEdge);
  const candidates = [
    edge.edge_type,
    edge.edgeType,
    edge.semantic_type,
    edge.semanticType,
    edge.type,
    edge.operator,
  ];
  for (const candidate of candidates) {
    const normalized = normalizeEdgeSemanticType(candidate);
    if (normalized !== EDGE_SEMANTIC_TYPES.UNKNOWN) return normalized;
  }
  return EDGE_SEMANTIC_TYPES.UNKNOWN;
}

function labelOfNode(rawNode) {
  if (!rawNode || typeof rawNode !== "object") return "";
  const node = /** @type {Record<string, unknown>} */ (rawNode);
  const candidates = [node.label, node.name, node.value, node.title];
  for (const candidate of candidates) {
    if (typeof candidate === "string" && candidate.trim()) return candidate.trim();
    if (typeof candidate === "number" || typeof candidate === "boolean") return String(candidate);
  }
  return "";
}

function pushDiag(diagList, payload) {
  if (!Array.isArray(diagList)) return;
  diagList.push(payload);
}

function sortByStableLabel(items) {
  return [...items].sort((a, b) => {
    const la = String(a?.label || "").toLowerCase();
    const lb = String(b?.label || "").toLowerCase();
    if (la && lb && la !== lb) return la.localeCompare(lb);
    if (la && !lb) return -1;
    if (!la && lb) return 1;
    return String(a?.id || "").localeCompare(String(b?.id || ""));
  });
}

/**
 * Build strict UI hierarchy from flat graph data.
 *
 * Output contract:
 * - planet = table bucket
 * - moon = row bucket
 * - INSTANCE_OF binds moon -> planet
 *
 * @param {unknown[]} nodes
 * @param {unknown[]} edges
 * @returns {{
 *   planets: Array<{
 *     id: string,
 *     label: string,
 *     originalNode: unknown,
 *     moons: Array<{
 *       id: string,
 *       label: string,
 *       originalNode: unknown,
 *       flowingIn: unknown[],
 *       flowingOut: unknown[],
 *       relations: unknown[],
 *     }>,
 *   }>,
 *   orphans: Array<{
 *     id: string,
 *     label: string,
 *     originalNode: unknown,
 *     flowingIn: unknown[],
 *     flowingOut: unknown[],
 *     relations: unknown[],
 *   }>,
 *   diagnostics: {
 *     warnings: unknown[],
 *     errors: unknown[],
 *     droppedEdges: unknown[],
 *   },
 *   indexes: {
 *     planetById: Map<string, unknown>,
 *     moonById: Map<string, unknown>,
 *     moonToPlanet: Map<string, string>,
 *   },
 * }}
 */
export function buildHierarchyTree(nodes, edges) {
  const safeNodes = Array.isArray(nodes) ? nodes : [];
  const safeEdges = Array.isArray(edges) ? edges : [];
  const diagnostics = createHierarchyDiagnostics();

  const planetById = new Map();
  const moonById = new Map();
  const moonToPlanet = new Map();

  for (const rawNode of safeNodes) {
    const id = nodeIdOf(rawNode);
    if (!id) continue;
    const semanticType = semanticTypeOfNode(rawNode);
    const label = labelOfNode(rawNode);
    if (semanticType === NODE_SEMANTIC_TYPES.PLANET) {
      if (!planetById.has(id)) {
        planetById.set(id, {
          id,
          label,
          originalNode: rawNode,
          moons: [],
        });
      }
      continue;
    }
    if (semanticType === NODE_SEMANTIC_TYPES.MOON) {
      if (!moonById.has(id)) {
        moonById.set(id, {
          id,
          label,
          originalNode: rawNode,
          flowingIn: [],
          flowingOut: [],
          relations: [],
        });
      }
    }
  }

  for (const rawEdge of safeEdges) {
    const edgeType = semanticTypeOfEdge(rawEdge);
    if (edgeType !== EDGE_SEMANTIC_TYPES.INSTANCE_OF) continue;
    const { sourceId, targetId } = edgeEndpointsOf(rawEdge);

    if (!sourceId || !targetId) {
      pushDiag(diagnostics.droppedEdges, {
        code: "INSTANCE_OF_MISSING_ENDPOINT",
        edge: rawEdge,
      });
      continue;
    }
    if (!moonById.has(sourceId)) {
      pushDiag(diagnostics.droppedEdges, {
        code: "INSTANCE_OF_SOURCE_NOT_MOON",
        edge: rawEdge,
        sourceId,
        targetId,
      });
      continue;
    }
    if (!planetById.has(targetId)) {
      pushDiag(diagnostics.warnings, {
        code: "INSTANCE_OF_TARGET_NOT_PLANET",
        edge: rawEdge,
        sourceId,
        targetId,
      });
      continue;
    }

    const existing = moonToPlanet.get(sourceId);
    if (existing && existing !== targetId) {
      pushDiag(diagnostics.warnings, {
        code: "MOON_MULTI_PLANET",
        moonId: sourceId,
        keptPlanetId: existing,
        droppedPlanetId: targetId,
        edge: rawEdge,
      });
      continue;
    }
    moonToPlanet.set(sourceId, targetId);
  }

  for (const moon of moonById.values()) {
    const planetId = moonToPlanet.get(moon.id);
    if (!planetId) continue;
    const planet = planetById.get(planetId);
    if (!planet) continue;
    planet.moons.push(moon);
  }

  for (const rawEdge of safeEdges) {
    const edgeType = semanticTypeOfEdge(rawEdge);
    if (
      edgeType !== EDGE_SEMANTIC_TYPES.FLOW &&
      edgeType !== EDGE_SEMANTIC_TYPES.RELATION &&
      edgeType !== EDGE_SEMANTIC_TYPES.GUARDIAN
    ) {
      if (edgeType === EDGE_SEMANTIC_TYPES.UNKNOWN) {
        pushDiag(diagnostics.droppedEdges, {
          code: "EDGE_UNKNOWN_TYPE",
          edge: rawEdge,
        });
      }
      continue;
    }

    const { sourceId, targetId } = edgeEndpointsOf(rawEdge);
    if (!sourceId || !targetId) {
      pushDiag(diagnostics.droppedEdges, {
        code: "EDGE_MISSING_ENDPOINT",
        edge: rawEdge,
      });
      continue;
    }

    const sourceMoon = moonById.get(sourceId);
    const targetMoon = moonById.get(targetId);
    if (!sourceMoon || !targetMoon) {
      pushDiag(diagnostics.droppedEdges, {
        code: "EDGE_NOT_BETWEEN_MOONS",
        edge: rawEdge,
        sourceId,
        targetId,
      });
      continue;
    }

    const link = {
      id: String(rawEdge?.id || `${sourceId}:${targetId}:${edgeType}`),
      type: edgeType,
      sourceId,
      targetId,
      originalEdge: rawEdge,
    };

    if (edgeType === EDGE_SEMANTIC_TYPES.FLOW) {
      sourceMoon.flowingOut.push(link);
      targetMoon.flowingIn.push(link);
      continue;
    }

    sourceMoon.relations.push(link);
    if (sourceId !== targetId) {
      targetMoon.relations.push(link);
    }
  }

  const planets = sortByStableLabel(
    [...planetById.values()].map((planet) => ({
      ...planet,
      moons: sortByStableLabel(planet.moons),
    }))
  );

  const orphans = sortByStableLabel(
    [...moonById.values()].filter((moon) => !moonToPlanet.has(moon.id))
  );

  return {
    planets,
    orphans,
    diagnostics,
    indexes: {
      planetById,
      moonById,
      moonToPlanet,
    },
  };
}
