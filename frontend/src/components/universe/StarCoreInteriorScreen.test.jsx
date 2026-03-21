import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";

import StarCoreInteriorScreen from "./StarCoreInteriorScreen.jsx";

afterEach(() => {
  cleanup();
});

function createProps(overrides = {}) {
  return {
    screenModel: {
      stage: "active",
      isVisible: true,
      isActive: true,
    },
    ...overrides,
  };
}

describe("StarCoreInteriorScreen", () => {
  it("renders dedicated interior screen when screen model is visible", () => {
    render(<StarCoreInteriorScreen {...createProps()} />);

    expect(screen.getByTestId("star-core-interior-screen")).toBeTruthy();
    expect(screen.getByTestId("ritual-chamber-core")).toBeTruthy();
  });

  it("stays hidden when screen model is not visible", () => {
    render(
      <StarCoreInteriorScreen
        {...createProps({
          screenModel: {
            stage: "closed",
            isVisible: false,
            isActive: false,
          },
        })}
      />
    );

    expect(screen.queryByTestId("star-core-interior-screen")).toBeNull();
  });
});
