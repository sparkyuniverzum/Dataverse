import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import { createLabPresetStore } from "../labPresetStore.js";

vi.mock("../R3FLabShell.jsx", () => ({
  default: ({ activationSource, onExit }) => (
    <div data-testid="lab-shell-mock">
      <span data-testid="lab-activation-source">{activationSource}</span>
      <button type="button" onClick={onExit}>
        exit
      </button>
    </div>
  ),
}));

import R3FLabEntry from "../R3FLabEntry.jsx";

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

describe("R3FLabEntry", () => {
  it("remembers query activation and clears it on exit", () => {
    const storage = createStorage();
    const store = createLabPresetStore({ storage });
    const onExit = vi.fn();

    render(<R3FLabEntry onExit={onExit} search="?lab=r3f" storage={storage} store={store} />);

    expect(screen.getByTestId("lab-activation-source").textContent).toBe("query");
    expect(storage.getItem("dv:lab")).toBe("r3f");

    fireEvent.click(screen.getByRole("button", { name: "exit" }));
    expect(storage.getItem("dv:lab")).toBeNull();
    expect(onExit).toHaveBeenCalledTimes(1);
  });
});
