import { describe, expect, it } from "vitest";
import { calculateSectorLayout } from "./layout_service";

function distance(a, b) {
  const dx = a[0] - b[0];
  const dy = a[1] - b[1];
  const dz = a[2] - b[2];
  return Math.sqrt(dx * dx + dy * dy + dz * dz);
}

describe("layout_service", () => {
  it("is deterministic for identical input", () => {
    const nodes = [
      { id: "a", category: "Firma", collisionRadius: 4.2, mass: 3 },
      { id: "b", category: "Firma", collisionRadius: 4.1, mass: 2.8 },
      { id: "c", category: "Produkt", collisionRadius: 3.5, mass: 2.1 },
    ];
    const edges = [{ id: "e1", source_id: "a", target_id: "b" }];

    const first = calculateSectorLayout({ nodes, edges, previousPositions: null });
    const second = calculateSectorLayout({ nodes, edges, previousPositions: null });

    expect([...first.positions.entries()]).toEqual([...second.positions.entries()]);
    expect(first.sectors).toEqual(second.sectors);
  });

  it("keeps minimum separation for dense nodes", () => {
    const nodes = Array.from({ length: 6 }, (_, index) => ({
      id: `node-${index + 1}`,
      category: "Dense",
      collisionRadius: 5.5,
      mass: 2.6,
    }));
    const result = calculateSectorLayout({ nodes, edges: [], previousPositions: null });

    for (let i = 0; i < nodes.length; i += 1) {
      for (let j = i + 1; j < nodes.length; j += 1) {
        const p1 = result.positions.get(nodes[i].id);
        const p2 = result.positions.get(nodes[j].id);
        const minDistance = nodes[i].collisionRadius + nodes[j].collisionRadius + 4.5;
        expect(distance(p1, p2)).toBeGreaterThanOrEqual(minDistance);
      }
    }
  });

  it("switches sector mode to ring for larger categories", () => {
    const nodes = Array.from({ length: 7 }, (_, index) => ({
      id: `r-${index + 1}`,
      category: "RingTable",
      collisionRadius: 3.2,
      mass: 1.8,
      metadata: { a: 1, b: 2, c: 3, d: 4 },
    }));
    const { sectors } = calculateSectorLayout({ nodes, edges: [], previousPositions: null });
    expect(sectors).toHaveLength(1);
    expect(sectors[0].mode).toBe("ring");
    expect(sectors[0].asteroidCount).toBe(7);
  });
});

