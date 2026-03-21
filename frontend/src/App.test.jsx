import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

const useAuthMock = vi.fn();
const useConnectivityStateMock = vi.fn();

vi.mock("./context/AuthContext.jsx", () => ({
  useAuth: () => useAuthMock(),
}));

vi.mock("./hooks/useConnectivityState", () => ({
  useConnectivityState: () => useConnectivityStateMock(),
}));

vi.mock("./components/app/AuthExperience", () => ({
  default: () => <div data-testid="auth-experience">auth</div>,
}));

vi.mock("./components/app/WorkspaceShell", () => ({
  default: () => <div data-testid="workspace-shell">workspace</div>,
}));

vi.mock("./components/screens/ResetPasswordScreen.jsx", () => ({
  default: () => <div data-testid="reset-password-screen">reset</div>,
}));

import App from "./App.jsx";

describe("App", () => {
  it("renders reset password route on dedicated pathname", () => {
    window.history.pushState({}, "", "/reset-password");
    useAuthMock.mockReturnValue({
      isAuthenticated: false,
      isLoading: false,
      login: vi.fn(),
      register: vi.fn(),
      forgotPassword: vi.fn(),
    });
    useConnectivityStateMock.mockReturnValue({
      isOnline: true,
      isOffline: false,
    });

    render(<App />);

    expect(screen.getByTestId("reset-password-screen")).toBeTruthy();
    window.history.pushState({}, "", "/");
  });

  it("renders boot screen while auth is loading", () => {
    useAuthMock.mockReturnValue({
      isAuthenticated: false,
      isLoading: true,
    });
    useConnectivityStateMock.mockReturnValue({
      isOnline: true,
      isOffline: false,
    });

    render(<App />);

    expect(screen.getByText("Inicializuji Dataverse...")).toBeTruthy();
  });

  it("renders auth experience when user is not authenticated", () => {
    useAuthMock.mockReturnValue({
      isAuthenticated: false,
      isLoading: false,
      login: vi.fn(),
      register: vi.fn(),
      forgotPassword: vi.fn(),
    });
    useConnectivityStateMock.mockReturnValue({
      isOnline: true,
      isOffline: false,
    });

    render(<App />);

    expect(screen.getByTestId("auth-experience")).toBeTruthy();
  });

  it("renders workspace shell when user is authenticated", () => {
    useAuthMock.mockReturnValue({
      isAuthenticated: true,
      isLoading: false,
      login: vi.fn(),
      register: vi.fn(),
      forgotPassword: vi.fn(),
    });
    useConnectivityStateMock.mockReturnValue({
      isOnline: true,
      isOffline: false,
    });

    render(<App />);

    expect(screen.getByTestId("workspace-shell")).toBeTruthy();
  });
});
