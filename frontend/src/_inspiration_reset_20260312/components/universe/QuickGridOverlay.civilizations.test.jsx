/** @vitest-environment jsdom */
import { cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";

import QuickGridOverlay from "./QuickGridOverlay";

afterEach(() => {
  cleanup();
});

function buildRow() {
  return {
    id: "moon-1",
    value: "Moon-1",
    state: "ACTIVE",
    violation_count: 0,
    current_event_seq: 3,
    metadata: { state: "active" },
    facts: [],
  };
}

function renderOverlay(overrides = {}) {
  const row = buildRow();
  const row2 = {
    ...buildRow(),
    id: "moon-2",
    value: "Moon-2",
    state: "DRAFT",
    metadata: { state: "draft" },
  };
  return render(
    <QuickGridOverlay
      open
      selectedTable={{ table_id: "table-1", name: "Core > Planet", schema_fields: ["state"] }}
      selectedTableId="table-1"
      tableOptions={[
        { table_id: "table-1", name: "Core > Planet" },
        { table_id: "table-2", name: "Core > Planet-2" },
      ]}
      tableContract={{
        required_fields: ["label", "state"],
        field_types: { label: "string", state: "string" },
      }}
      tableRows={[row, row2]}
      gridColumns={["value", "state"]}
      gridFilteredRows={[row, row2]}
      gridSearchQuery=""
      onGridSearchChange={() => {}}
      onSelectTable={() => {}}
      onCreatePlanet={async () => ({ ok: true })}
      onExtinguishPlanet={async () => ({ ok: true })}
      onApplyTableContract={async () => ({ ok: true })}
      selectedAsteroidId="moon-1"
      onSelectRow={() => {}}
      onCreateRow={async () => ({ ok: true })}
      onUpdateRow={async () => ({ ok: true })}
      onDeleteRow={async () => ({ ok: true })}
      onUpsertMetadata={async () => ({ ok: true })}
      pendingCreate={false}
      pendingRowOps={{}}
      busy={false}
      onClose={() => {}}
      readGridCell={(sourceRow, column) => String(sourceRow?.[column] ?? sourceRow?.metadata?.[column] ?? "")}
      {...overrides}
    />
  );
}

describe("QuickGridOverlay civilization batch", () => {
  it("keeps direct and batch civilization operations hidden by default", () => {
    renderOverlay();
    expect(screen.getByTestId("quick-grid-civilization-advanced").style.display).toBe("none");
  });

  it("queues create/update/archive and applies them sequentially", async () => {
    const onCreateRow = vi.fn(async () => ({ ok: true }));
    const onUpdateRow = vi.fn(async () => ({ ok: true }));
    const onDeleteRow = vi.fn(async () => ({ ok: true }));
    renderOverlay({ onCreateRow, onUpdateRow, onDeleteRow });
    fireEvent.click(screen.getByTestId("quick-grid-civilization-advanced-toggle"));

    const createInput = screen.getByPlaceholderText("Nova hodnota civilizace...");
    fireEvent.change(createInput, { target: { value: "Moon-X" } });
    fireEvent.click(screen.getByRole("button", { name: "+ batch create" }));

    const editInput = screen.getByPlaceholderText("Upravit hodnotu vybrane civilizace...");
    fireEvent.change(editInput, { target: { value: "Moon-1-Edited" } });
    fireEvent.click(screen.getByRole("button", { name: "+ batch update" }));
    fireEvent.click(screen.getByRole("button", { name: "+ batch archive" }));

    fireEvent.click(screen.getByTestId("quick-grid-apply-civilization-batch-button"));

    await waitFor(() => {
      expect(onCreateRow).toHaveBeenCalledWith("Moon-X");
      expect(onUpdateRow).toHaveBeenCalledWith("moon-1", "Moon-1-Edited");
      expect(onDeleteRow).toHaveBeenCalledWith("moon-1");
    });
  }, 15000);

  it("supports multi-select + lifecycle queue with commit diff preview", async () => {
    const user = userEvent.setup();
    const onUpsertMetadata = vi.fn(async () => ({ ok: true }));
    renderOverlay({ onUpsertMetadata });
    await user.click(screen.getByTestId("quick-grid-civilization-advanced-toggle"));

    const checkboxes = screen.getAllByRole("checkbox");
    await user.click(checkboxes[1]);
    await user.click(checkboxes[2]);

    const lifecycleSelect = screen.getByDisplayValue("ACTIVE");
    await user.selectOptions(lifecycleSelect, "ARCHIVED");
    await user.click(screen.getByRole("button", { name: "+ batch lifecycle" }));

    expect(screen.getByTestId("quick-grid-civilization-batch-diff-preview").textContent).toContain("[lifecycle]");
    await user.click(screen.getByTestId("quick-grid-apply-civilization-batch-button"));

    await waitFor(() => {
      expect(onUpsertMetadata).toHaveBeenCalled();
    });
  });

  it("shows civilization composer preview and allows explicit action mode", async () => {
    const user = userEvent.setup();
    renderOverlay();

    const composer = screen.getByTestId("quick-grid-civilization-composer");
    expect(composer.textContent).toContain("CIVILIZATION COMPOSER");

    const modeSelect = within(composer).getByDisplayValue("AUTO");
    await user.selectOptions(modeSelect, "ARCHIVE");

    expect(composer.textContent).toContain("action: ARCHIVE");
  });

  it("applies CREATE action directly from civilization composer", async () => {
    const user = userEvent.setup();
    const onCreateRow = vi.fn(async () => ({ ok: true }));
    renderOverlay({ onCreateRow });
    await user.click(screen.getByTestId("quick-grid-civilization-advanced-toggle"));

    await user.type(screen.getByPlaceholderText("Nova hodnota civilizace..."), "Moon-Composer");

    const composer = screen.getByTestId("quick-grid-civilization-composer");
    const modeSelect = within(composer).getByDisplayValue("AUTO");
    await user.selectOptions(modeSelect, "CREATE");
    await user.click(screen.getByTestId("quick-grid-apply-civilization-composer-button"));

    await waitFor(() => {
      expect(onCreateRow).toHaveBeenCalledWith("Moon-Composer");
    });
    expect(screen.getByTestId("quick-grid-planet-event-log").textContent).toContain("CIV_CREATE");
  });

  it("planet composer applies SELECT with explicit target", async () => {
    const user = userEvent.setup();
    const onSelectTable = vi.fn();
    renderOverlay({ onSelectTable });

    const planetComposer = screen.getByTestId("quick-grid-planet-composer");
    const selects = within(planetComposer).getAllByRole("combobox");
    await user.selectOptions(selects[0], "table-2");
    await user.selectOptions(selects[1], "SELECT");
    await user.click(screen.getByTestId("quick-grid-apply-planet-composer-button"));

    await waitFor(() => {
      expect(onSelectTable).toHaveBeenCalledWith("table-2");
    });
    expect(screen.getByTestId("quick-grid-planet-toast").textContent).toContain("Planeta vybrana");
    expect(screen.getByTestId("quick-grid-planet-event-log").textContent).toContain("PLANET_SELECT");
  });

  it("planet composer blocks EXTINGUISH when table has rows", async () => {
    const user = userEvent.setup();
    const onExtinguishPlanet = vi.fn();
    renderOverlay({ onExtinguishPlanet });

    const planetComposer = screen.getByTestId("quick-grid-planet-composer");
    const modeSelect = within(planetComposer).getAllByRole("combobox")[1];
    await user.selectOptions(modeSelect, "EXTINGUISH");

    expect(screen.getByTestId("quick-grid-apply-planet-composer-button").disabled).toBe(true);
    expect(screen.getByTestId("quick-grid-planet-guard-reason").textContent).toContain("jen pro prazdnou planetu");
    expect(onExtinguishPlanet).not.toHaveBeenCalled();
  });

  it("planet composer extinguish uses selected target table", async () => {
    const user = userEvent.setup();
    const onExtinguishPlanet = vi.fn(async () => ({ ok: true }));
    renderOverlay({ onExtinguishPlanet });

    const planetComposer = screen.getByTestId("quick-grid-planet-composer");
    const selects = within(planetComposer).getAllByRole("combobox");
    await user.selectOptions(selects[0], "table-2");
    await user.selectOptions(selects[1], "EXTINGUISH");
    await user.click(screen.getByTestId("quick-grid-apply-planet-composer-button"));

    await waitFor(() => {
      expect(onExtinguishPlanet).toHaveBeenCalledWith("table-2");
    });
  });

  it("schema composer applies manual contract fields", async () => {
    const user = userEvent.setup();
    const onApplyTableContract = vi.fn(async () => ({ ok: true }));
    renderOverlay({ onApplyTableContract });

    await user.type(screen.getByPlaceholderText("field_key"), "amount");
    await user.selectOptions(screen.getByDisplayValue("string"), "number");
    await user.click(screen.getByRole("button", { name: "Pridat pole" }));
    await user.click(screen.getByTestId("quick-grid-apply-schema-composer-button"));

    await waitFor(() => {
      expect(onApplyTableContract).toHaveBeenCalled();
    });
    const callArg = onApplyTableContract.mock.calls[0][0];
    expect(Array.isArray(callArg)).toBe(true);
    expect(callArg.some((item) => item.fieldKey === "amount" && item.fieldType === "number")).toBe(true);
  });

  it("shows contract diagnostics for selected civilization", () => {
    renderOverlay();
    const diagnostics = screen.getByTestId("quick-grid-contract-diagnostics");
    expect(diagnostics.textContent).toContain("CONTRACT DIAGNOSTICS");
    expect(diagnostics.textContent).toContain("missing: 1");
    expect(diagnostics.textContent).toContain("chybi: label");
  });

  it("renders shared inspector fields (impacted minerals + active rules)", () => {
    renderOverlay({
      tableRows: [
        {
          id: "moon-1",
          value: "Moon-1",
          state: "ANOMALY",
          violation_count: 1,
          current_event_seq: 7,
          health_score: 41,
          metadata: { state: "active" },
          facts: [
            {
              key: "amount",
              typed_value: -5,
              status: "invalid",
              errors: [{ rule_id: "amount-positive" }],
            },
          ],
        },
      ],
      gridFilteredRows: [
        {
          id: "moon-1",
          value: "Moon-1",
          state: "ANOMALY",
          violation_count: 1,
          current_event_seq: 7,
          health_score: 41,
          metadata: { state: "active" },
          facts: [
            {
              key: "amount",
              typed_value: -5,
              status: "invalid",
              errors: [{ rule_id: "amount-positive" }],
            },
          ],
        },
      ],
    });
    const inspector = screen.getByTestId("quick-grid-civilization-inspector");
    expect(inspector.textContent).toContain("state: ANOMALY");
    expect(inspector.textContent).toContain("impacted minerals:");
    expect(inspector.textContent).toContain("amount");
    expect(inspector.textContent).toContain("active rules:");
    expect(inspector.textContent).toContain("amount-positive");
  });

  it("filters workflow log by source and query", async () => {
    const user = userEvent.setup();
    const onSelectTable = vi.fn();
    renderOverlay({
      onSelectTable,
      backendStreamEvents: [{ id: "be-1", cursor: 12, eventType: "UPDATE", message: "server update" }],
    });

    const planetComposer = screen.getByTestId("quick-grid-planet-composer");
    const selects = within(planetComposer).getAllByRole("combobox");
    await user.selectOptions(selects[0], "table-2");
    await user.selectOptions(selects[1], "SELECT");
    await user.click(screen.getByTestId("quick-grid-apply-planet-composer-button"));

    const log = screen.getByTestId("quick-grid-planet-event-log");
    expect(log.textContent).toContain("BE_STREAM");
    expect(log.textContent).toContain("PLANET_SELECT");

    await user.selectOptions(screen.getByTestId("quick-grid-workflow-log-filter"), "BE_STREAM");
    expect(log.textContent).toContain("BE_STREAM");
    expect(log.textContent).not.toContain("PLANET_SELECT");

    await user.clear(screen.getByTestId("quick-grid-workflow-log-search"));
    await user.type(screen.getByTestId("quick-grid-workflow-log-search"), "server update");
    expect(log.textContent).toContain("server update");
  });

  it("ingests runtime moon-impact and repair events into unified workflow log", async () => {
    const user = userEvent.setup();
    renderOverlay({
      runtimeWorkflowEvents: [
        {
          id: "wf-1",
          action: "MOON_IMPACT_READY",
          message: "Moon impact ready pro Core > Planet: rules 3, violations 1.",
          tone: "warn",
        },
        {
          id: "wf-2",
          action: "REPAIR_APPLY_OK",
          message: "Guided repair aplikovan (auto) #repair-1.",
          tone: "ok",
        },
      ],
    });

    const log = screen.getByTestId("quick-grid-planet-event-log");
    expect(log.textContent).toContain("MOON_IMPACT_READY");
    expect(log.textContent).toContain("REPAIR_APPLY_OK");

    await user.selectOptions(screen.getByTestId("quick-grid-workflow-log-filter"), "IMPACT_REPAIR");
    expect(log.textContent).toContain("MOON_IMPACT_READY");
    expect(log.textContent).toContain("REPAIR_APPLY_OK");
  });

  it("blocks civilization create writes while workspace is offline", async () => {
    const user = userEvent.setup();
    const onCreateRow = vi.fn(async () => ({ ok: true }));
    renderOverlay({
      onCreateRow,
      runtimeConnectivity: {
        isOnline: false,
        badgeLabel: "offline",
        writeBlocked: true,
        sidebarMessage: "Workspace je offline. Zapisy jsou docasne pozastavene.",
      },
    });

    await user.click(screen.getByTestId("quick-grid-civilization-advanced-toggle"));
    await user.type(screen.getByPlaceholderText("Nova hodnota civilizace..."), "Moon-Offline");
    await user.click(screen.getByRole("button", { name: "Pridat civilizaci" }));

    expect(onCreateRow).not.toHaveBeenCalled();
    expect(screen.getByTestId("quick-grid-write-feedback").textContent).toContain("workspace je offline");
  });
});
