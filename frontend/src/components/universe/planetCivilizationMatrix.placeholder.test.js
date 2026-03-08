/** @vitest-environment jsdom */

import React from "react";
import { cleanup, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";

import BondBuilderPanel from "./BondBuilderPanel";
import QuickGridOverlay from "./QuickGridOverlay";
import WorkspaceSidebar from "./WorkspaceSidebar";
import {
  evaluateBondFlowTransition,
  resolveNavigationState,
  resolveVisualBuilderState,
  VISUAL_BUILDER_BOND_STATE,
  VISUAL_BUILDER_EVENT,
  VISUAL_BUILDER_NAV_STATE,
} from "./visualBuilderStateMachine";

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

  it("P0 branch controls: sidebar supports branch switch and promote trigger", async () => {
    const user = userEvent.setup();
    const onSelectBranch = vi.fn();
    const onCreateBranch = vi.fn();
    const onBranchCreateNameChange = vi.fn();
    const onPromoteBranch = vi.fn();

    render(
      React.createElement(WorkspaceSidebar, {
        galaxy: { name: "Milky QA" },
        branches: [
          { id: "br-1", name: "Experiment A", deleted_at: null },
          { id: "br-2", name: "Experiment B", deleted_at: null },
        ],
        selectedBranchId: "br-1",
        onSelectBranch,
        branchCreateName: "Feature-X",
        onBranchCreateNameChange,
        branchCreateBusy: false,
        onCreateBranch,
        branchPromoteBusy: false,
        branchPromoteSummary: "Branch byl promotnut (3 eventů).",
        onPromoteBranch,
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
        moonRows: [buildMoonRow("moon-1")],
        selectedMoonId: "moon-1",
        onSelectTable: () => {},
        onSelectMoon: () => {},
        onOpenGrid: () => {},
        onRefresh: () => {},
        onOpenStarHeart: () => {},
        onBackToGalaxies: () => {},
        onLogout: () => {},
      })
    );

    const selector = screen.getByDisplayValue("Experiment A");
    await user.selectOptions(selector, "br-2");
    expect(onSelectBranch).toHaveBeenCalledWith("br-2");

    const createInput = screen.getByTestId("workspace-branch-create-input");
    await user.clear(createInput);
    await user.type(createInput, "Feature-Y");
    expect(onBranchCreateNameChange).toHaveBeenCalled();
    await user.click(screen.getByTestId("workspace-branch-create-button"));
    expect(onCreateBranch).toHaveBeenCalledTimes(1);

    await user.click(screen.getByRole("button", { name: "Promote branch" }));
    expect(onPromoteBranch).toHaveBeenCalledTimes(1);
    expect(screen.getByTestId("branch-promote-summary").textContent).toContain("promotnut");
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

  it("LF-04 bond builder: preview gate blocks commit on REJECT and allows commit on ALLOW", async () => {
    const user = userEvent.setup();
    const onPreview = vi.fn();
    const onCommit = vi.fn();

    const { rerender } = render(
      React.createElement(BondBuilderPanel, {
        open: true,
        visualBuilderState: "NAV_PLANET_FOCUSED",
        options: [
          { id: "moon-1", label: "Moon 1" },
          { id: "moon-2", label: "Moon 2" },
        ],
        selectedAsteroidId: "moon-1",
        bondState: VISUAL_BUILDER_BOND_STATE.BOND_PREVIEW,
        sourceId: "moon-1",
        targetId: "moon-2",
        bondType: "RELATION",
        preview: {
          decision: "REJECT",
          blocking: true,
          reasons: [{ code: "BOND_VALIDATE_SAME_ENDPOINT", severity: "error", blocking: true, message: "blocked" }],
        },
        previewBusy: false,
        commitBusy: false,
        onStartDraft: () => {},
        onSourceChange: () => {},
        onTargetChange: () => {},
        onTypeChange: () => {},
        onRequestPreview: onPreview,
        onCommit,
        onCancel: () => {},
      })
    );

    expect(screen.getByTestId("bond-commit-button").hasAttribute("disabled")).toBe(true);
    await user.click(screen.getByTestId("bond-preview-button"));
    expect(onPreview).toHaveBeenCalledTimes(1);

    rerender(
      React.createElement(BondBuilderPanel, {
        open: true,
        visualBuilderState: "NAV_PLANET_FOCUSED",
        options: [
          { id: "moon-1", label: "Moon 1" },
          { id: "moon-2", label: "Moon 2" },
        ],
        selectedAsteroidId: "moon-1",
        bondState: VISUAL_BUILDER_BOND_STATE.BOND_PREVIEW,
        sourceId: "moon-1",
        targetId: "moon-2",
        bondType: "RELATION",
        preview: {
          decision: "ALLOW",
          blocking: false,
          reasons: [],
        },
        previewBusy: false,
        commitBusy: false,
        onStartDraft: () => {},
        onSourceChange: () => {},
        onTargetChange: () => {},
        onTypeChange: () => {},
        onRequestPreview: onPreview,
        onCommit,
        onCancel: () => {},
      })
    );

    expect(screen.getByTestId("bond-commit-button").hasAttribute("disabled")).toBe(false);
    await user.click(screen.getByTestId("bond-commit-button"));
    expect(onCommit).toHaveBeenCalledTimes(1);
  });

  it("LF-05 state machine: enforces deterministic bond transitions and priority resolution", () => {
    const start = evaluateBondFlowTransition({
      state: VISUAL_BUILDER_BOND_STATE.BOND_IDLE,
      event: VISUAL_BUILDER_EVENT.START_BOND_DRAFT,
      payload: { sourceId: "moon-1" },
    });
    expect(start.allowed).toBe(true);
    expect(start.next_state).toBe(VISUAL_BUILDER_BOND_STATE.BOND_DRAFT_SOURCE);

    const target = evaluateBondFlowTransition({
      state: start.next_state,
      event: VISUAL_BUILDER_EVENT.SELECT_BOND_TARGET,
      payload: { sourceId: "moon-1", targetId: "moon-2" },
    });
    expect(target.allowed).toBe(true);
    expect(target.next_state).toBe(VISUAL_BUILDER_BOND_STATE.BOND_DRAFT_TARGET);

    const previewRequest = evaluateBondFlowTransition({
      state: target.next_state,
      event: VISUAL_BUILDER_EVENT.REQUEST_BOND_PREVIEW,
      payload: { sourceId: "moon-1", targetId: "moon-2", type: "FLOW" },
    });
    expect(previewRequest.allowed).toBe(true);
    expect(previewRequest.next_state).toBe(VISUAL_BUILDER_BOND_STATE.BOND_PREVIEW);

    const commitGuard = evaluateBondFlowTransition({
      state: previewRequest.next_state,
      event: VISUAL_BUILDER_EVENT.CONFIRM_BOND_COMMIT,
      payload: { previewDecision: "REJECT", previewBlocking: true },
    });
    expect(commitGuard.allowed).toBe(false);
    expect(commitGuard.reason).toBe("preview_not_committable");

    const nav = resolveNavigationState({
      selectedTableId: "table-1",
      selectedAsteroidId: "moon-1",
      quickGridOpen: false,
    });
    expect(nav).toBe(VISUAL_BUILDER_NAV_STATE.NAV_MOON_FOCUSED);
    expect(
      resolveVisualBuilderState({
        loading: false,
        runtimeError: "",
        navigationState: nav,
        bondState: VISUAL_BUILDER_BOND_STATE.BOND_PREVIEW,
      })
    ).toBe(VISUAL_BUILDER_BOND_STATE.BOND_PREVIEW);
  });

  it.skip("LF-06 cross-planet gate placeholder", () => {});
  it.skip("LF-07 replay parity gate placeholder", () => {});
  it.skip("LF-08 accessibility/performance gate placeholder", () => {});
});
