import { describe, expect, it } from "vitest";

import {
  EDGE_SEMANTIC_TYPES,
  NODE_SEMANTIC_TYPES,
  buildHierarchyTree,
  createHierarchyDiagnostics,
  edgeEndpointsOf,
  nodeIdOf,
  normalizeEdgeSemanticType,
  normalizeNodeSemanticType,
} from "./universe_viewmodel";

describe("universe_viewmodel stage1", () => {
  it("normalizes node semantic aliases", () => {
    expect(normalizeNodeSemanticType("planet")).toBe(NODE_SEMANTIC_TYPES.PLANET);
    expect(normalizeNodeSemanticType("TABLE")).toBe(NODE_SEMANTIC_TYPES.PLANET);
    expect(normalizeNodeSemanticType("moon")).toBe(NODE_SEMANTIC_TYPES.MOON);
    expect(normalizeNodeSemanticType("asteroid")).toBe(NODE_SEMANTIC_TYPES.MOON);
    expect(normalizeNodeSemanticType("group")).toBe(NODE_SEMANTIC_TYPES.CONSTELLATION);
  });

  it("marks unknown node semantic values as UNKNOWN", () => {
    expect(normalizeNodeSemanticType("weird-type")).toBe(NODE_SEMANTIC_TYPES.UNKNOWN);
    expect(normalizeNodeSemanticType("")).toBe(NODE_SEMANTIC_TYPES.UNKNOWN);
  });

  it("normalizes edge semantic aliases", () => {
    expect(normalizeEdgeSemanticType("TYPE")).toBe(EDGE_SEMANTIC_TYPES.INSTANCE_OF);
    expect(normalizeEdgeSemanticType(":")).toBe(EDGE_SEMANTIC_TYPES.INSTANCE_OF);
    expect(normalizeEdgeSemanticType("->")).toBe(EDGE_SEMANTIC_TYPES.FLOW);
    expect(normalizeEdgeSemanticType("+")).toBe(EDGE_SEMANTIC_TYPES.RELATION);
    expect(normalizeEdgeSemanticType("guardian")).toBe(EDGE_SEMANTIC_TYPES.GUARDIAN);
  });

  it("exposes stable id and endpoint helpers", () => {
    expect(nodeIdOf({ id: "n-1" })).toBe("n-1");
    expect(nodeIdOf({ node_id: "n-2" })).toBe("n-2");
    expect(nodeIdOf({ asteroid_id: "n-3" })).toBe("n-3");

    expect(edgeEndpointsOf({ source_id: "a", target_id: "b" })).toEqual({ sourceId: "a", targetId: "b" });
    expect(edgeEndpointsOf({ source: "x", target: "y" })).toEqual({ sourceId: "x", targetId: "y" });
  });

  it("creates empty diagnostics container", () => {
    expect(createHierarchyDiagnostics()).toEqual({
      warnings: [],
      errors: [],
      droppedEdges: [],
    });
  });

  it("builds planets + moons hierarchy from INSTANCE_OF edges", () => {
    const nodes = [
      { id: "p-finance", semantic_type: "PLANET", name: "Finance" },
      { id: "p-stock", semantic_type: "PLANET", name: "Sklad" },
      { id: "m-hrebiky", semantic_type: "MOON", name: "Hrebiky" },
      { id: "m-srouby", semantic_type: "MOON", name: "Srouby" },
      { id: "m-desky", semantic_type: "MOON", name: "Desky" },
    ];
    const edges = [
      { id: "i-1", edge_type: "INSTANCE_OF", source_id: "m-hrebiky", target_id: "p-stock" },
      { id: "i-2", edge_type: "TYPE", source_id: "m-srouby", target_id: "p-stock" },
      { id: "f-1", edge_type: "FLOW", source_id: "m-hrebiky", target_id: "m-srouby" },
      { id: "r-1", edge_type: "RELATION", source_id: "m-srouby", target_id: "m-hrebiky" },
    ];

    const result = buildHierarchyTree(nodes, edges);

    expect(result.planets).toHaveLength(2);
    expect(result.orphans.map((item) => item.id)).toEqual(["m-desky"]);

    const stock = result.planets.find((item) => item.id === "p-stock");
    expect(stock).toBeTruthy();
    expect(stock.moons.map((item) => item.id)).toEqual(["m-hrebiky", "m-srouby"]);

    const moonA = result.indexes.moonById.get("m-hrebiky");
    const moonB = result.indexes.moonById.get("m-srouby");
    expect(moonA.flowingOut).toHaveLength(1);
    expect(moonB.flowingIn).toHaveLength(1);
    expect(moonA.relations).toHaveLength(1);
    expect(moonB.relations).toHaveLength(1);
  });

  it("keeps first planet when moon has multiple INSTANCE_OF edges", () => {
    const nodes = [
      { id: "p-1", semantic_type: "PLANET", name: "A" },
      { id: "p-2", semantic_type: "PLANET", name: "B" },
      { id: "m-1", semantic_type: "MOON", name: "Moon1" },
    ];
    const edges = [
      { id: "i-1", edge_type: "INSTANCE_OF", source_id: "m-1", target_id: "p-1" },
      { id: "i-2", edge_type: "INSTANCE_OF", source_id: "m-1", target_id: "p-2" },
    ];

    const result = buildHierarchyTree(nodes, edges);

    expect(result.indexes.moonToPlanet.get("m-1")).toBe("p-1");
    expect(result.diagnostics.warnings.some((item) => item.code === "MOON_MULTI_PLANET")).toBe(true);
  });

  it("collects diagnostics for invalid or unknown edges", () => {
    const nodes = [
      { id: "p-1", semantic_type: "PLANET", name: "A" },
      { id: "m-1", semantic_type: "MOON", name: "Moon1" },
    ];
    const edges = [
      { id: "i-bad", edge_type: "INSTANCE_OF", source_id: "m-1", target_id: "p-missing" },
      { id: "u-1", edge_type: "???", source_id: "m-1", target_id: "p-1" },
      { id: "f-bad", edge_type: "FLOW", source_id: "m-1", target_id: "p-1" },
    ];

    const result = buildHierarchyTree(nodes, edges);

    expect(result.orphans.map((item) => item.id)).toEqual(["m-1"]);
    expect(result.diagnostics.warnings.some((item) => item.code === "INSTANCE_OF_TARGET_NOT_PLANET")).toBe(true);
    expect(result.diagnostics.droppedEdges.some((item) => item.code === "EDGE_UNKNOWN_TYPE")).toBe(true);
    expect(result.diagnostics.droppedEdges.some((item) => item.code === "EDGE_NOT_BETWEEN_MOONS")).toBe(true);
  });
});
