/** @vitest-environment jsdom */
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
    metadata: { amount: 42, state: "active" },
    facts: [
      {
        key: "amount",
        typed_value: 42,
        value_type: "number",
        source: "metadata",
        status: "valid",
        errors: [],
      },
      {
        key: "state",
        typed_value: "active",
        value_type: "string",
        source: "metadata",
        status: "valid",
        errors: [],
      },
    ],
  };
}

function renderOverlay(overrides = {}) {
  const row = buildRow();
  return render(
    <QuickGridOverlay
      open
      selectedTable={{ table_id: "table-1", name: "Core > Planet", schema_fields: ["amount", "state"] }}
      tableRows={[row]}
      gridColumns={["value", "state", "amount"]}
      gridFilteredRows={[row]}
      gridSearchQuery=""
      onGridSearchChange={() => {}}
      selectedAsteroidId="moon-1"
      onSelectRow={() => {}}
      onCreateRow={async () => true}
      onUpdateRow={async () => true}
      onDeleteRow={async () => true}
      onUpsertMetadata={async () => true}
      pendingCreate={false}
      pendingRowOps={{}}
      busy={false}
      onClose={() => {}}
      readGridCell={(sourceRow, column) => String(sourceRow?.[column] ?? sourceRow?.metadata?.[column] ?? "")}
      {...overrides}
    />
  );
}

describe("QuickGridOverlay mineral editor", () => {
  it("loads mineral key/value when user clicks mineral fact row", async () => {
    const user = userEvent.setup();
    renderOverlay();

    await user.click(screen.getByTestId("quick-grid-mineral-item-amount"));
    expect(screen.getByPlaceholderText("Nerost / sloupec").value).toBe("amount");
    expect(screen.getByPlaceholderText("Hodnota (prazdne = remove_soft)").value).toBe("42");
  });

  it("normalizes key and sends explicit remove payload", async () => {
    const user = userEvent.setup();
    const onUpsertMetadata = vi.fn(async () => ({ ok: true, message: "removed" }));
    renderOverlay({ onUpsertMetadata });

    const keyInput = screen.getByPlaceholderText("Nerost / sloupec");
    await user.clear(keyInput);
    await user.type(keyInput, " Custom Amount ");
    await user.click(screen.getByRole("button", { name: "Odebrat nerost" }));
    expect(onUpsertMetadata).not.toHaveBeenCalled();
    await user.click(screen.getByRole("button", { name: "Potvrdit odebrani" }));

    await waitFor(() => {
      expect(onUpsertMetadata).toHaveBeenCalledWith("moon-1", "custom_amount", "");
    });
  });

  it("applies queued mineral batch sequentially", async () => {
    const user = userEvent.setup();
    const onUpsertMetadata = vi.fn(async () => ({ ok: true }));
    renderOverlay({ onUpsertMetadata });

    const keyInput = screen.getByPlaceholderText("Nerost / sloupec");
    const valueInput = screen.getByPlaceholderText("Hodnota (prazdne = remove_soft)");

    await user.clear(keyInput);
    await user.type(keyInput, "amount");
    await user.clear(valueInput);
    await user.type(valueInput, "150");
    await user.click(screen.getByRole("button", { name: "Pridat do batch" }));

    await user.clear(keyInput);
    await user.type(keyInput, "state");
    await user.clear(valueInput);
    await user.type(valueInput, "archived");
    await user.click(screen.getByRole("button", { name: "Pridat do batch" }));

    await user.click(screen.getByTestId("quick-grid-apply-mineral-batch-button"));

    await waitFor(() => {
      expect(onUpsertMetadata).toHaveBeenCalledTimes(2);
    });
    expect(onUpsertMetadata).toHaveBeenNthCalledWith(1, "moon-1", "amount", "150");
    expect(onUpsertMetadata).toHaveBeenNthCalledWith(2, "moon-1", "state", "archived");
  });

  it("supports explicit REMOVE_SOFT action from composer mode", async () => {
    const user = userEvent.setup();
    const onUpsertMetadata = vi.fn(async () => ({ ok: true }));
    renderOverlay({ onUpsertMetadata });

    const composer = screen.getByTestId("quick-grid-mineral-composer");
    const modeSelect = within(composer).getByDisplayValue("AUTO");
    await user.selectOptions(modeSelect, "REMOVE_SOFT");

    await user.click(screen.getByRole("button", { name: "Provést remove_soft" }));
    expect(onUpsertMetadata).not.toHaveBeenCalled();
    await user.click(screen.getByRole("button", { name: "Potvrdit remove_soft" }));

    await waitFor(() => {
      expect(onUpsertMetadata).toHaveBeenCalledWith("moon-1", "amount", "");
    });
  });

  it("writes mineral operation into workflow log", async () => {
    const user = userEvent.setup();
    const onUpsertMetadata = vi.fn(async () => ({ ok: true }));
    renderOverlay({ onUpsertMetadata });

    await user.click(screen.getByRole("button", { name: "Ulozit nerost" }));

    await waitFor(() => {
      expect(onUpsertMetadata).toHaveBeenCalled();
    });
    expect(screen.getByTestId("quick-grid-planet-event-log").textContent).toContain("MINERAL_UPSERT");
  });

  it("does not write mineral on workflow next-action CTA", async () => {
    const user = userEvent.setup();
    const onUpsertMetadata = vi.fn(async () => ({ ok: true }));
    renderOverlay({ onUpsertMetadata });

    await user.click(screen.getByTestId("quick-grid-workflow-next-action"));

    expect(onUpsertMetadata).not.toHaveBeenCalled();
    expect(screen.getByTestId("quick-grid-write-feedback").textContent).toContain(
      "Pro zapis klikni na 'Ulozit nerost'"
    );
  });

  it("shows remove_soft armed badge and clears it when mode switches to UPSERT", async () => {
    const user = userEvent.setup();
    const onUpsertMetadata = vi.fn(async () => ({ ok: true }));
    renderOverlay({ onUpsertMetadata });

    const composer = screen.getByTestId("quick-grid-mineral-composer");
    const modeSelect = within(composer).getByDisplayValue("AUTO");
    await user.selectOptions(modeSelect, "REMOVE_SOFT");

    await user.click(screen.getByRole("button", { name: "Provést remove_soft" }));
    expect(onUpsertMetadata).not.toHaveBeenCalled();
    expect(screen.getByTestId("quick-grid-remove-soft-armed-badge").textContent).toContain("Remove_soft je pripraven");

    await user.selectOptions(modeSelect, "UPSERT");
    expect(screen.queryByTestId("quick-grid-remove-soft-armed-badge")).toBeNull();
    expect(screen.getByRole("button", { name: "Ulozit nerost" })).not.toBeNull();
  });

  it("blocks mineral writes while workspace is offline", async () => {
    const user = userEvent.setup();
    const onUpsertMetadata = vi.fn(async () => ({ ok: true }));
    renderOverlay({
      onUpsertMetadata,
      runtimeConnectivity: {
        isOnline: false,
        badgeLabel: "offline",
        writeBlocked: true,
        sidebarMessage: "Workspace je offline. Zapisy jsou docasne pozastavene.",
      },
    });

    await user.click(screen.getByRole("button", { name: "Ulozit nerost" }));

    expect(onUpsertMetadata).not.toHaveBeenCalled();
    expect(screen.getByTestId("quick-grid-connectivity-guard").textContent).toContain("offline");
    expect(screen.getByTestId("quick-grid-write-feedback").textContent).toContain("workspace je offline");
  });
});
