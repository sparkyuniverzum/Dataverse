import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const useAuthMock = vi.fn();
const useConnectivityStateMock = vi.fn();
const universeWorkspaceMock = vi.fn(() => <div data-testid="workspace-root">workspace</div>);

vi.mock("../../context/AuthContext.jsx", () => ({
  useAuth: () => useAuthMock(),
}));

vi.mock("../../hooks/useConnectivityState", () => ({
  useConnectivityState: () => useConnectivityStateMock(),
}));

vi.mock("../universe/UniverseWorkspace", () => ({
  default: (props) => universeWorkspaceMock(props),
}));

vi.mock("./EmptyGalaxyBootstrapScreen.jsx", () => ({
  default: (props) => (
    <div data-testid="empty-galaxy-screen">
      <button type="button" onClick={() => props.onCreateGalaxy({ name: "Nova galaxie" })}>
        create galaxy
      </button>
      <span>{props.error}</span>
    </div>
  ),
}));

import WorkspaceShell from "./WorkspaceShell.jsx";

describe("WorkspaceShell", () => {
  beforeEach(() => {
    universeWorkspaceMock.mockClear();
  });

  afterEach(() => {
    cleanup();
  });

  it("renders the workspace shell", () => {
    useAuthMock.mockReturnValue({
      defaultGalaxy: { id: "g-1", name: "Moje Galaxie" },
      galaxyBootstrapState: "workspace_ready",
      galaxyBootstrapError: "",
      createGalaxy: vi.fn(),
      logout: vi.fn(),
    });
    useConnectivityStateMock.mockReturnValue({
      isOnline: true,
      isOffline: false,
    });

    render(<WorkspaceShell />);

    expect(screen.getByTestId("workspace-root")).toBeTruthy();
    expect(universeWorkspaceMock.mock.calls[0][0]).toEqual(
      expect.objectContaining({
        defaultGalaxy: { id: "g-1", name: "Moje Galaxie" },
        connectivity: expect.objectContaining({ isOnline: true }),
        onLogout: expect.any(Function),
      })
    );
  });

  it("renders empty galaxy bootstrap when no workspace galaxy exists", () => {
    useAuthMock.mockReturnValue({
      defaultGalaxy: null,
      galaxyBootstrapState: "empty_galaxy",
      galaxyBootstrapError: "Chybi galaxie",
      createGalaxy: vi.fn(),
      logout: vi.fn(),
    });
    useConnectivityStateMock.mockReturnValue({
      isOnline: true,
      isOffline: false,
    });

    render(<WorkspaceShell />);

    expect(screen.getByTestId("empty-galaxy-screen")).toBeTruthy();
    expect(screen.queryByTestId("workspace-root")).toBeNull();
    expect(universeWorkspaceMock).not.toHaveBeenCalled();
  });

  it("shows bootstrap screen while galaxy list is still loading", () => {
    useAuthMock.mockReturnValue({
      defaultGalaxy: null,
      galaxyBootstrapState: "loading_galaxies",
      galaxyBootstrapError: "",
      createGalaxy: vi.fn(),
      logout: vi.fn(),
    });
    useConnectivityStateMock.mockReturnValue({
      isOnline: true,
      isOffline: false,
    });

    render(<WorkspaceShell />);

    expect(screen.getByTestId("empty-galaxy-screen")).toBeTruthy();
    expect(universeWorkspaceMock).not.toHaveBeenCalled();
  });
});
