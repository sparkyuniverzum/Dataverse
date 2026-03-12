/** @vitest-environment jsdom */

import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";

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
    selectionInspector: {
      selectedTableLabel: "Tabulka: Cashflow",
      selectedCivilizationLabel: "Moon-1",
      orbitCivilizations: [],
      selectedCivilizationId: "",
      selectedCivilization: null,
      inspector: null,
    },
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

describe("WorkspaceSidebar connectivity", () => {
  it("shows offline badge and continuity card when runtime is disconnected", () => {
    render(
      <WorkspaceSidebar
        {...baseProps({
          runtimeConnectivity: {
            isOnline: false,
            badgeLabel: "offline",
            writeBlocked: true,
            sidebarMessage: "Workspace je offline. Zapisy jsou docasne pozastavene, dokud se spojeni neobnovi.",
          },
        })}
      />
    );

    expect(screen.getByTestId("workspace-connectivity-badge").textContent).toContain("offline");
    expect(screen.getByTestId("workspace-connectivity-card").textContent).toContain("Zapisy jsou docasne pozastavene");
  });
});
