import { cleanup, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("./UniverseCanvas.jsx", () => ({
  default: ({ model }) => <div data-testid="universe-canvas">{model.state}</div>,
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
    expect(screen.getByTestId("universe-canvas").textContent).toBe("data_unavailable");
    expect(screen.getByText("Srdce hvězdy nemá potvrzený scope")).toBeTruthy();
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
      });

    render(<UniverseWorkspace defaultGalaxy={{ id: "g-1", name: "Moje Galaxie" }} connectivity={{ isOnline: true }} />);

    expect(screen.getByText("Synchronizuji pravdu Srdce hvězdy")).toBeTruthy();
    await waitFor(() => {
      expect(screen.getByTestId("universe-canvas").textContent).toBe("star_core_unlocked");
    });
    expect(screen.getByText("Potvrdit ústavu a uzamknout politiky")).toBeTruthy();
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
      });

    render(<UniverseWorkspace defaultGalaxy={{ id: "g-1", name: "Moje Galaxie" }} connectivity={{ isOnline: true }} />);

    await waitFor(() => {
      expect(screen.getByTestId("universe-canvas").textContent).toBe("star_core_locked_ready");
    });
    expect(screen.getByText("První oběžná dráha je připravená")).toBeTruthy();
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
      });

    render(<UniverseWorkspace defaultGalaxy={{ id: "g-1", name: "Moje Galaxie" }} connectivity={{ isOnline: true }} />);

    await waitFor(() => {
      expect(screen.getByTestId("universe-canvas").textContent).toBe("data_unavailable");
    });
    expect(screen.getByText("service unavailable")).toBeTruthy();
  });
});
