import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

const useAuthMock = vi.fn();
const useConnectivityStateMock = vi.fn();
const universeWorkspaceMock = vi.fn(() => <div data-testid="workspace-reset-root">workspace</div>);

vi.mock("../../context/AuthContext.jsx", () => ({
  useAuth: () => useAuthMock(),
}));

vi.mock("../../hooks/useConnectivityState", () => ({
  useConnectivityState: () => useConnectivityStateMock(),
}));

vi.mock("../universe/UniverseWorkspace", () => ({
  default: (props) => universeWorkspaceMock(props),
}));

import WorkspaceShell from "./WorkspaceShell.jsx";

describe("WorkspaceShell", () => {
  it("renders the reset workspace shell", () => {
    useAuthMock.mockReturnValue({
      defaultGalaxy: { id: "g-1", name: "Moje Galaxie" },
    });
    useConnectivityStateMock.mockReturnValue({
      isOnline: true,
      isOffline: false,
    });

    render(<WorkspaceShell />);

    expect(screen.getByTestId("workspace-reset-root")).toBeTruthy();
    expect(universeWorkspaceMock.mock.calls[0][0]).toEqual(
      expect.objectContaining({
        defaultGalaxy: { id: "g-1", name: "Moje Galaxie" },
        connectivity: expect.objectContaining({ isOnline: true }),
      })
    );
  });
});
