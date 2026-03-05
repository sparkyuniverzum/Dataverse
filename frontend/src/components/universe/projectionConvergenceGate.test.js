import { describe, expect, it } from "vitest";

import { applySseFrameCursor } from "./runtimeSyncUtils";
import { evaluateProjectionConvergence } from "./projectionConvergenceGate";

function makeProjection({
  tableId = "table-1",
  tableName = "Finance > Cashflow",
  members = [],
  asteroids = [],
  bonds = [],
} = {}) {
  return {
    snapshot: {
      asteroids: asteroids.map((row, index) => ({
        id: row.id,
        table_id: row.table_id || tableId,
        value: row.value || `Row-${index + 1}`,
        metadata: row.metadata || {},
        calculated_values: row.calculated_values || {},
      })),
      bonds: bonds.map((row, index) => ({
        id: row.id || `bond-${index + 1}`,
        source_id: row.source_id,
        target_id: row.target_id,
        type: row.type || "RELATION",
      })),
    },
    tables: [
      {
        table_id: tableId,
        name: tableName,
        constellation_name: "Finance",
        planet_name: "Cashflow",
        members: members.map((id, index) => ({
          id,
          value: `Member-${index + 1}`,
          created_at: null,
        })),
        schema_fields: [],
        formula_fields: [],
        internal_bonds: [],
        external_bonds: [],
        sector: {
          center: [280, 0, 0],
          size: 280,
          mode: "belt",
          grid_plate: true,
        },
      },
    ],
    selectedTableId: tableId,
  };
}

describe("projection convergence gate", () => {
  it("keeps 3D layout and grid converged after stream replay updates", () => {
    const initial = makeProjection({
      members: ["a-1"],
      asteroids: [{ id: "a-1", value: "Salary", metadata: { amount: 48000 } }],
    });
    const afterUpdateOne = makeProjection({
      members: ["a-1", "a-2"],
      asteroids: [
        { id: "a-1", value: "Salary", metadata: { amount: 48000 } },
        { id: "a-2", value: "Rent", metadata: { amount: -17000 } },
      ],
      bonds: [{ id: "b-1", source_id: "a-1", target_id: "a-2" }],
    });
    const afterUpdateTwo = makeProjection({
      members: ["a-1", "a-2", "a-3"],
      asteroids: [
        { id: "a-1", value: "Salary", metadata: { amount: 48000 } },
        { id: "a-2", value: "Rent", metadata: { amount: -17000 } },
        { id: "a-3", value: "Groceries", metadata: { amount: -4200 } },
      ],
      bonds: [
        { id: "b-1", source_id: "a-1", target_id: "a-2" },
        { id: "b-2", source_id: "a-2", target_id: "a-3" },
      ],
    });

    const frames = [
      { id: "40", event: "ready", data: { last_event_seq: 40 } },
      { id: "41", event: "update", data: { last_event_seq: 41 } },
      { id: "41", event: "keepalive", data: { last_event_seq: 41 } },
      { id: "42", event: "update", data: { last_event_seq: 42 } },
    ];

    let cursor = 0;
    let projection = initial;
    let checks = 0;

    frames.forEach((frame) => {
      const decision = applySseFrameCursor(frame, cursor);
      cursor = decision.cursor;
      if (!decision.shouldRefresh) return;

      if (cursor === 41) projection = afterUpdateOne;
      if (cursor === 42) projection = afterUpdateTwo;

      const report = evaluateProjectionConvergence(projection);
      expect(report.ok).toBe(true);
      checks += 1;
    });

    expect(cursor).toBe(42);
    expect(checks).toBe(2);
  });

  it("detects divergence between selected table members and snapshot/grid rows", () => {
    const broken = makeProjection({
      members: ["a-1", "a-2"],
      asteroids: [{ id: "a-1", value: "Salary", metadata: { amount: 48000 } }],
    });
    const report = evaluateProjectionConvergence(broken);
    expect(report.ok).toBe(false);
    expect(report.reason).toBe("projection_grid_layout_diverged");
    expect(report.selected_member_vs_grid.missing).toContain("a-2");
  });
});
