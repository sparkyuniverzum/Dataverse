import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("./UniverseCanvas.jsx", () => ({
  default: ({ model, navigationModel, spaceObjects, onSelectObject, onApproachObject, onClearFocus }) => (
    <div data-testid="universe-canvas">
      <span data-testid="canvas-state">{model.state}</span>
      <span data-testid="canvas-nav-mode">{navigationModel.mode}</span>
      <span data-testid="canvas-selected-object">{navigationModel.selectedObjectId || "none"}</span>
      <span data-testid="canvas-object-count">{spaceObjects.length}</span>
      <button type="button" onClick={() => onSelectObject("star-core")}>
        select star
      </button>
      <button type="button" onClick={() => onApproachObject("star-core")}>
        approach star
      </button>
      <button type="button" onClick={onClearFocus}>
        clear focus
      </button>
    </div>
  ),
}));

import UniverseWorkspace from "./UniverseWorkspace.jsx";

describe("UniverseWorkspace", () => {
  beforeEach(() => {
    vi.stubGlobal("fetch", vi.fn());
  });

  afterEach(() => {
    cleanup();
    vi.unstubAllGlobals();
  });

  it("renders explicit data_unavailable state when galaxy is missing", () => {
    const { container } = render(<UniverseWorkspace />);

    expect(screen.getByTestId("workspace-reset-root")).toBeTruthy();
    expect(container.querySelectorAll('span[aria-hidden="true"]').length).toBeGreaterThan(200);
    expect(screen.getByTestId("canvas-state").textContent).toBe("data_unavailable");
    expect(screen.getByText("Volná navigace galaxií")).toBeTruthy();
  });

  it("renders pre-lock state from BE truth", async () => {
    fetch
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          profile_key: "ORIGIN",
          law_preset: "balanced",
          profile_mode: "auto",
          lock_status: "draft",
          policy_version: 1,
          locked_at: null,
          can_edit_core_laws: true,
        }),
      })
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          galaxy_id: "g-1",
          profile_key: "BALANCE",
          profile_version: 1,
          lock_status: "draft",
          coefficients: { a: 0.12, b: 0.4 },
        }),
      })
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          items: [
            {
              table_id: "t-1",
              planet_name: "Planeta A",
              constellation_name: "Orion",
              sector: { center: { x: 6, z: -2 }, size: 2 },
            },
          ],
        }),
      });

    render(<UniverseWorkspace defaultGalaxy={{ id: "g-1", name: "Moje Galaxie" }} connectivity={{ isOnline: true }} />);

    await waitFor(() => {
      expect(screen.getByTestId("canvas-state").textContent).toBe("star_core_unlocked");
    });
    expect(screen.getByTestId("canvas-object-count").textContent).toBe("2");
    expect(screen.getByText("Volná navigace galaxií")).toBeTruthy();
  });

  it("renders post-lock ready state from BE truth", async () => {
    fetch
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          profile_key: "SENTINEL",
          law_preset: "integrity_first",
          profile_mode: "locked",
          lock_status: "locked",
          policy_version: 3,
          locked_at: "2026-03-12T10:00:00Z",
          can_edit_core_laws: false,
        }),
      })
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          galaxy_id: "g-1",
          profile_key: "FORGE",
          profile_version: 2,
          lock_status: "locked",
          coefficients: { a: 0.12, b: 0.4, c: 0.9 },
        }),
      })
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          items: [],
        }),
      });

    render(<UniverseWorkspace defaultGalaxy={{ id: "g-1", name: "Moje Galaxie" }} connectivity={{ isOnline: true }} />);

    await waitFor(() => {
      expect(screen.getByTestId("canvas-state").textContent).toBe("star_core_locked_ready");
    });
    expect(screen.getByText("Volná navigace galaxií")).toBeTruthy();
  });

  it("falls back to data_unavailable when policy fetch fails", async () => {
    fetch
      .mockResolvedValueOnce({
        ok: false,
        status: 503,
        text: async () => JSON.stringify({ detail: "service unavailable" }),
      })
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          galaxy_id: "g-1",
          profile_key: "BALANCE",
          profile_version: 1,
          lock_status: "draft",
          coefficients: {},
        }),
      })
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          items: [],
        }),
      });

    render(<UniverseWorkspace defaultGalaxy={{ id: "g-1", name: "Moje Galaxie" }} connectivity={{ isOnline: true }} />);

    await waitFor(() => {
      expect(screen.getByTestId("canvas-state").textContent).toBe("data_unavailable");
    });
    expect(screen.getByText("service unavailable")).toBeTruthy();
  });

  it("switches selection and approach states from canvas actions", async () => {
    fetch
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          profile_key: "ORIGIN",
          law_preset: "balanced",
          profile_mode: "auto",
          lock_status: "draft",
          policy_version: 1,
          locked_at: null,
          can_edit_core_laws: true,
        }),
      })
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          galaxy_id: "g-1",
          profile_key: "BALANCE",
          profile_version: 1,
          lock_status: "draft",
          coefficients: { a: 0.12, b: 0.4 },
        }),
      })
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          items: [],
        }),
      });

    render(<UniverseWorkspace defaultGalaxy={{ id: "g-1", name: "Moje Galaxie" }} connectivity={{ isOnline: true }} />);

    await waitFor(() => {
      expect(screen.getByTestId("canvas-nav-mode").textContent).toBe("space_idle");
    });

    fireEvent.click(screen.getByRole("button", { name: "select star" }));
    expect(screen.getByTestId("canvas-nav-mode").textContent).toBe("object_selected");
    expect(screen.getByText("Vybraný objekt: Srdce hvězdy")).toBeTruthy();

    fireEvent.click(screen.getByRole("button", { name: "approach star" }));
    expect(screen.getByTestId("canvas-nav-mode").textContent).toBe("approach_active");

    fireEvent.click(screen.getByRole("button", { name: "clear focus" }));
    expect(screen.getByTestId("canvas-nav-mode").textContent).toBe("space_idle");
  });
});
