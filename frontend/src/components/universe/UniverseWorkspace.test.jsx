import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import UniverseWorkspace from "./UniverseWorkspace.jsx";

describe("UniverseWorkspace", () => {
  it("renders the reset workspace root with a starfield-only scene", () => {
    const { container } = render(<UniverseWorkspace />);

    expect(screen.getByTestId("workspace-reset-root")).toBeTruthy();
    expect(container.querySelectorAll('span[aria-hidden="true"]').length).toBeGreaterThan(200);
  });
});
