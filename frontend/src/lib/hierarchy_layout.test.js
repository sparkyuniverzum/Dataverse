import { describe, expect, it } from "vitest";

import { calculateHierarchyLayout } from "./hierarchy_layout";

function baseTable(id, overrides = {}) {
  return {
    table_id: id,
    name: `Core > Planeta-${id}`,
    constellation_name: "Core",
    planet_name: `Planeta-${id}`,
    members: [],
    internal_bonds: [],
    external_bonds: [],
    sector: {
      center: [0, 0, 0],
      size: 260,
      mode: "belt",
      grid_plate: true,
    },
    ...overrides,
  };
}

describe("calculateHierarchyLayout", () => {
  it("keeps single manual-positioned planet at provided sector center", () => {
    const table = baseTable("table-1", {
      sector: { center: [190, 12, -40], size: 260, mode: "manual", grid_plate: true },
    });

    const result = calculateHierarchyLayout({
      tables: [table],
      selectedTableId: "",
      asteroidById: new Map(),
    });
    const position = result.tablePositions.get("table-1");
    expect(position).toBeTruthy();
    const radius = Math.sqrt(position[0] ** 2 + position[1] ** 2 + position[2] ** 2);
    expect(radius).toBeGreaterThanOrEqual(259.9);
  });

  it("places first automatic planet outside star clearance", () => {
    const table = baseTable("table-1");
    const result = calculateHierarchyLayout({
      tables: [table],
      selectedTableId: "",
      asteroidById: new Map(),
    });
    const position = result.tablePositions.get("table-1");
    expect(position).toBeTruthy();
    const radius = Math.sqrt(position[0] ** 2 + position[1] ** 2 + position[2] ** 2);
    expect(radius).toBeGreaterThanOrEqual(259.9);
  });

  it("keeps all automatic planets outside star clearance even for large counts", () => {
    const tables = Array.from({ length: 120 }).map((_, idx) =>
      baseTable(`table-${idx + 1}`, {
        constellation_name: idx % 2 === 0 ? "Ops" : "Sales",
        name: `${idx % 2 === 0 ? "Ops" : "Sales"} > Planeta-${idx + 1}`,
      })
    );
    const result = calculateHierarchyLayout({
      tables,
      selectedTableId: "",
      asteroidById: new Map(),
    });

    expect(result.tableNodes).toHaveLength(120);
    result.tableNodes.forEach((node) => {
      const position = result.tablePositions.get(node.id);
      expect(position).toBeTruthy();
      const radius = Math.sqrt(position[0] ** 2 + position[1] ** 2 + position[2] ** 2);
      expect(radius).toBeGreaterThanOrEqual(259.9);
    });
  });
});
