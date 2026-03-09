/** @vitest-environment jsdom */

import React from "react";
import { cleanup, render, screen, waitFor, within } from "@testing-library/react";
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
  it("queues create/update/archive and applies them sequentially", async () => {
    const user = userEvent.setup();
    const onCreateRow = vi.fn(async () => ({ ok: true }));
    const onUpdateRow = vi.fn(async () => ({ ok: true }));
    const onDeleteRow = vi.fn(async () => ({ ok: true }));
    renderOverlay({ onCreateRow, onUpdateRow, onDeleteRow });

    const createInput = screen.getByPlaceholderText("Nova hodnota civilizace...");
    await user.clear(createInput);
    await user.type(createInput, "Moon-X");
    await user.click(screen.getByRole("button", { name: "+ batch create" }));

    const editInput = screen.getByPlaceholderText("Upravit hodnotu vybrane civilizace...");
    await user.clear(editInput);
    await user.type(editInput, "Moon-1-Edited");
    await user.click(screen.getByRole("button", { name: "+ batch update" }));
    await user.click(screen.getByRole("button", { name: "+ batch archive" }));

    await user.click(screen.getByTestId("quick-grid-apply-civilization-batch-button"));

    await waitFor(() => {
      expect(onCreateRow).toHaveBeenCalledWith("Moon-X");
      expect(onUpdateRow).toHaveBeenCalledWith("moon-1", "Moon-1-Edited");
      expect(onDeleteRow).toHaveBeenCalledWith("moon-1");
    });
  });

  it("supports multi-select + lifecycle queue with commit diff preview", async () => {
    const user = userEvent.setup();
    const onUpsertMetadata = vi.fn(async () => ({ ok: true }));
    renderOverlay({ onUpsertMetadata });

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
});
