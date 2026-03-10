/** @vitest-environment jsdom */
import React from "react";
import { cleanup, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";

import WorkspaceSidebar from "./WorkspaceSidebar";

afterEach(() => {
  cleanup();
});

function baseProps(overrides = {}) {
  return {
    galaxy: { name: "Milky QA" },
    branches: [],
    onboarding: null,
    tableNodes: [{ id: "table-1", entityName: "Finance", label: "Cashflow" }],
    asteroidCount: 1,
    bondCount: 0,
    loading: false,
    busy: false,
    error: "",
    selectedTableId: "table-1",
    selectedTableLabel: "Tabulka: Cashflow",
    selectedAsteroidLabel: "Moon-1",
    moonRows: [
      {
        id: "moon-1",
        value: "Moon-1",
        state: "ACTIVE",
        violation_count: 0,
        metadata: {},
        facts: [{ key: "state", typed_value: "active", status: "valid", errors: [] }],
      },
    ],
    selectedMoonId: "moon-1",
    onSelectTable: () => {},
    onSelectMoon: () => {},
    onOpenGrid: () => {},
    onRefresh: () => {},
    onOpenStarHeart: () => {},
    onBackToGalaxies: () => {},
    onLogout: () => {},
    ...overrides,
  };
}

describe("WorkspaceSidebar moon-impact integration", () => {
  it("prefers moon-impact API payload for moon inspector summary", () => {
    render(
      React.createElement(
        WorkspaceSidebar,
        baseProps({
          moonImpact: {
            items: [
              {
                rule_id: "state-must-be-active",
                mineral_key: "state",
                active_violations_count: 2,
                impacted_civilization_ids: ["moon-1"],
              },
              {
                rule_id: "amount-positive",
                mineral_key: "amount",
                active_violations_count: 1,
                impacted_civilization_ids: ["moon-2"],
              },
            ],
          },
        })
      )
    );

    const card = screen.getByTestId("moon-inspector-card");
    expect(card.textContent).toContain("violations: 2");
    expect(card.textContent).toContain("state");
    expect(card.textContent).toContain("state-must-be-active");
    expect(card.textContent).not.toContain("amount-positive");
    expect(card.textContent).toContain("health:");
    expect(card.textContent).toContain("event_seq:");
  });

  it("opens grid from moon inspector deep-link button", async () => {
    const user = userEvent.setup();
    const onOpenGrid = vi.fn();
    render(React.createElement(WorkspaceSidebar, baseProps({ onOpenGrid })));

    await user.click(screen.getByTestId("moon-inspector-open-grid-button"));
    expect(onOpenGrid).toHaveBeenCalledTimes(1);
  });
});
