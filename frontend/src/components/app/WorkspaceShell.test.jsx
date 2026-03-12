import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import WorkspaceShell from "./WorkspaceShell.jsx";

describe("WorkspaceShell", () => {
  it("renders the reset workspace shell", () => {
    render(<WorkspaceShell />);

    expect(screen.getByTestId("workspace-reset-root")).toBeTruthy();
  });
});
