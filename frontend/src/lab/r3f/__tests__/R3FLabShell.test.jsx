import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import { createLabPresetStore } from "../labPresetStore.js";
import { FORCED_WARNING_DIAGNOSTICS } from "../labDiagnosticsModel.js";

vi.mock("../LabCanvas.jsx", () => ({
  default: ({ onDiagnosticsChange, sceneId, viewMode }) => (
    <div data-testid="lab-canvas">
      <span data-testid="lab-canvas-scene">{sceneId}</span>
      <span data-testid="lab-canvas-mode">{viewMode}</span>
      <button
        type="button"
        onClick={() =>
          onDiagnosticsChange({
            frameMs: 24.3,
            programs: 11,
            memory: { geometries: 31, textures: 14 },
            render: { calls: 8 },
          })
        }
      >
        push diagnostics
      </button>
    </div>
  ),
}));

import R3FLabShell from "../R3FLabShell.jsx";

function createStorage() {
  const state = new Map();
  return {
    getItem(key) {
      return state.has(key) ? state.get(key) : null;
    },
    setItem(key, value) {
      state.set(key, value);
    },
    removeItem(key) {
      state.delete(key);
    },
  };
}

describe("R3FLabShell", () => {
  it("renders lab_ready shell and reacts to diagnostics and mode changes", () => {
    const store = createLabPresetStore({ storage: createStorage() });

    render(<R3FLabShell activationSource="query" onExit={vi.fn()} store={store} />);

    expect(screen.getByText("R3F Lab v1")).toBeTruthy();
    expect(screen.getByTestId("lab-canvas-scene").textContent).toBe("star_core_interior_core");

    fireEvent.click(screen.getByRole("button", { name: "Debug" }));
    expect(screen.getByTestId("lab-canvas-mode").textContent).toBe("debug");

    fireEvent.click(screen.getByRole("button", { name: "Vynutit warning" }));
    expect(screen.getByText("Forced warning pro screenshot gate")).toBeTruthy();
    expect(screen.getByText(`${FORCED_WARNING_DIAGNOSTICS.frameMs.toFixed(1)} ms`)).toBeTruthy();

    fireEvent.click(screen.getByRole("button", { name: "Zobrazit export" }));
    expect(screen.getByLabelText("Preset JSON").value).toContain('"viewMode": "debug"');

    fireEvent.click(screen.getByRole("button", { name: "Vypnout forced warning" }));
    fireEvent.click(screen.getByRole("button", { name: "push diagnostics" }));
    expect(screen.getByText("Rust poctu geometrii")).toBeTruthy();
    expect(screen.getByText("Drift poctu programu")).toBeTruthy();
  });
});
