import { cleanup, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { AuthProvider, useAuth } from "./AuthContext.jsx";

function Probe() {
  const auth = useAuth();
  return (
    <div>
      <div data-testid="auth-loading">{String(auth.isLoading)}</div>
      <div data-testid="auth-user">{auth.user?.email || ""}</div>
      <div data-testid="auth-galaxy">{auth.defaultGalaxy?.name || ""}</div>
      <div data-testid="auth-bootstrap">{auth.galaxyBootstrapState || ""}</div>
    </div>
  );
}

describe("AuthProvider bootstrap default galaxy", () => {
  beforeEach(() => {
    localStorage.clear();
    localStorage.setItem("dataverse_auth_access_token", "access-token");
    localStorage.setItem("dataverse_auth_refresh_token", "refresh-token");
    vi.stubGlobal("fetch", vi.fn());
  });

  afterEach(() => {
    cleanup();
    localStorage.clear();
    vi.unstubAllGlobals();
  });

  it("restores defaultGalaxy from real /galaxies list during bootstrap", async () => {
    fetch
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({ id: "u-1", email: "pilot@dataverse.test" }),
      })
      .mockResolvedValueOnce({
        ok: true,
        json: async () => [
          { id: "g-1", name: "Moje Galaxie", owner_id: "u-1", created_at: null, deleted_at: null },
          { id: "g-2", name: "Vedlejsi Galaxie", owner_id: "u-1", created_at: null, deleted_at: null },
        ],
      });

    render(
      <AuthProvider>
        <Probe />
      </AuthProvider>
    );

    await waitFor(() => {
      expect(screen.getByTestId("auth-loading").textContent).toBe("false");
    });

    expect(screen.getByTestId("auth-user").textContent).toBe("pilot@dataverse.test");
    expect(screen.getByTestId("auth-galaxy").textContent).toBe("Moje Galaxie");
    expect(screen.getByTestId("auth-bootstrap").textContent).toBe("workspace_ready");
  });

  it("enters empty_galaxy bootstrap state when authenticated user has no galaxies", async () => {
    fetch
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({ id: "u-1", email: "pilot@dataverse.test" }),
      })
      .mockResolvedValueOnce({
        ok: true,
        json: async () => [],
      });

    render(
      <AuthProvider>
        <Probe />
      </AuthProvider>
    );

    await waitFor(() => {
      expect(screen.getByTestId("auth-loading").textContent).toBe("false");
    });

    expect(screen.getByTestId("auth-user").textContent).toBe("pilot@dataverse.test");
    expect(screen.getByTestId("auth-galaxy").textContent).toBe("");
    expect(screen.getByTestId("auth-bootstrap").textContent).toBe("empty_galaxy");
  });
});
