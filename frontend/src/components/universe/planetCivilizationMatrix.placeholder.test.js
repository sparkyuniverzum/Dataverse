/** @vitest-environment jsdom */

import React from "react";
import { cleanup, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";

import QuickGridOverlay from "./QuickGridOverlay";
import WorkspaceSidebar from "./WorkspaceSidebar";

afterEach(() => {
  cleanup();
});

function buildMoonRow(id, overrides = {}) {
  return {
    id,
    value: `Moon-${id}`,
    state: "ACTIVE",
    violation_count: 0,
    current_event_seq: 7,
    metadata: { entity_id: `entity-${id}` },
    facts: [
      {
        key: "entity_id",
        typed_value: `entity-${id}`,
        value_type: "string",
        source: "value",
        status: "valid",
        errors: [],
      },
    ],
    ...overrides,
  };
}

function renderGrid(props = {}) {
  return render(
    React.createElement(QuickGridOverlay, {
      open: true,
      selectedTable: { table_id: "table-1", name: "Finance > Cashflow" },
      tableRows: [buildMoonRow("moon-1")],
      gridColumns: ["value", "state", "entity_id"],
      gridFilteredRows: [buildMoonRow("moon-1")],
      gridSearchQuery: "",
      onGridSearchChange: () => {},
      selectedAsteroidId: "moon-1",
      onSelectRow: () => {},
      onCreateRow: async () => true,
      onUpdateRow: () => {},
      onDeleteRow: () => {},
      onUpsertMetadata: async () => true,
      pendingCreate: false,
      pendingRowOps: {},
      busy: false,
      onClose: () => {},
      readGridCell: (row, column) => String(row?.[column] ?? row?.metadata?.[column] ?? ""),
      ...props,
    })
  );
}

describe("planetCivilizationMatrix Wave1 gates", () => {
  it("LF-01 moon discoverability: sidebar exposes moon orbit list and one-click inspector selection", async () => {
    const user = userEvent.setup();
    const onSelectMoon = vi.fn();

    render(
      React.createElement(WorkspaceSidebar, {
        galaxy: { name: "Milky QA" },
        branches: [],
        onboarding: null,
        tableNodes: [{ id: "table-1", entityName: "Finance", label: "Cashflow" }],
        asteroidCount: 2,
        bondCount: 1,
        loading: false,
        busy: false,
        error: "",
        selectedTableId: "table-1",
        selectedTableLabel: "Tabulka: Cashflow",
        selectedAsteroidLabel: "Moon-moon-1",
        moonRows: [
          buildMoonRow("moon-1"),
          buildMoonRow("moon-2", {
            state: "ANOMALY",
            violation_count: 2,
            facts: [
              {
                key: "amount",
                typed_value: -12,
                value_type: "number",
                source: "value",
                status: "invalid",
                errors: [{ rule_id: "amount-positive" }],
              },
            ],
          }),
        ],
        selectedMoonId: "moon-1",
        onSelectTable: () => {},
        onSelectMoon,
        onOpenGrid: () => {},
        onRefresh: () => {},
        onOpenStarHeart: () => {},
        onBackToGalaxies: () => {},
        onLogout: () => {},
      })
    );

    expect(screen.getByTestId("moon-orbit-list")).toBeTruthy();
    expect(screen.getByTestId("moon-inspector-card").textContent).toContain("MOON INSPECTOR");

    await user.click(screen.getByTestId("moon-orbit-item-moon-2"));
    expect(onSelectMoon).toHaveBeenCalledWith("moon-2");
  });

  it("LF-02 semantic clarity: grid shows explicit civilization vs mineral legend and separated inspector panels", () => {
    renderGrid({
      tableRows: [
        buildMoonRow("moon-1", {
          state: "WARNING",
          health_score: 78,
          violation_count: 1,
          facts: [
            {
              key: "state",
              typed_value: "warning",
              value_type: "string",
              source: "value",
              status: "invalid",
              errors: [{ rule_id: "state-rule" }],
            },
          ],
        }),
      ],
      gridFilteredRows: [
        buildMoonRow("moon-1", {
          state: "WARNING",
          health_score: 78,
          violation_count: 1,
          facts: [
            {
              key: "state",
              typed_value: "warning",
              value_type: "string",
              source: "value",
              status: "invalid",
              errors: [{ rule_id: "state-rule" }],
            },
          ],
        }),
      ],
    });

    expect(screen.getByTestId("quick-grid-semantic-legend").textContent).toContain(
      "Civilizace = zivotni cyklus entity"
    );
    expect(screen.getByTestId("quick-grid-semantic-legend").textContent).toContain("Nerost = atomicka typed hodnota");
    expect(screen.getByTestId("quick-grid-lifecycle-panel").textContent).toContain("CIVILIZATION LIFECYCLE");
    expect(screen.getByTestId("quick-grid-mineral-panel").textContent).toContain("MINERAL FACTS");
  });

  it("LF-03 mineral workflow: upsert/remove-soft action keeps deterministic callback shape and workflow hints", async () => {
    const user = userEvent.setup();
    const onUpsertMetadata = vi.fn(async () => true);

    renderGrid({
      onUpsertMetadata,
      tableRows: [
        buildMoonRow("moon-1", {
          state: "ANOMALY",
          health_score: 52,
          violation_count: 2,
          facts: [
            {
              key: "amount",
              typed_value: -5,
              value_type: "number",
              source: "value",
              status: "invalid",
              errors: [{ rule_id: "amount-positive" }],
            },
          ],
        }),
      ],
      gridFilteredRows: [
        buildMoonRow("moon-1", {
          state: "ANOMALY",
          health_score: 52,
          violation_count: 2,
          facts: [
            {
              key: "amount",
              typed_value: -5,
              value_type: "number",
              source: "value",
              status: "invalid",
              errors: [{ rule_id: "amount-positive" }],
            },
          ],
        }),
      ],
    });

    expect(screen.getByTestId("quick-grid-semantic-legend").textContent).toContain("UPSERT");
    expect(screen.getByTestId("quick-grid-semantic-legend").textContent).toContain("REPAIR");
    expect(screen.getByTestId("quick-grid-semantic-legend").textContent).toContain("REMOVE_SOFT");

    const mineralKeyInput = screen.getByPlaceholderText("Nerost / sloupec");
    const mineralValueInput = screen.getByPlaceholderText("Hodnota (prazdne = remove_soft)");
    await user.clear(mineralKeyInput);
    await user.type(mineralKeyInput, "amount");
    await user.clear(mineralValueInput);
    await user.click(screen.getByRole("button", { name: "Ulozit nerost" }));

    expect(onUpsertMetadata).toHaveBeenCalledWith("moon-1", "amount", "");
    expect(screen.getByTestId("quick-grid-civilization-inspector").textContent).toContain("state: ANOMALY");
  });

  it.skip("LF-04 bond builder gate placeholder", () => {});
  it.skip("LF-05 state machine gate placeholder", () => {});
  it.skip("LF-06 cross-planet gate placeholder", () => {});
  it.skip("LF-07 replay parity gate placeholder", () => {});
  it.skip("LF-08 accessibility/performance gate placeholder", () => {});
});
