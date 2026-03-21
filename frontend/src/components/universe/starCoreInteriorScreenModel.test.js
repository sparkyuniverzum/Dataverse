import { describe, expect, it } from "vitest";

import {
  closeStarCoreInteriorScreen,
  createInitialStarCoreInteriorScreenState,
  openStarCoreInteriorScreen,
  resolveStarCoreInteriorScreenModel,
} from "./starCoreInteriorScreenModel.js";

describe("starCoreInteriorScreenModel", () => {
  it("starts closed by default", () => {
    expect(createInitialStarCoreInteriorScreenState()).toEqual({ stage: "closed" });
  });

  it("opens directly into active state", () => {
    const model = resolveStarCoreInteriorScreenModel({ screenState: openStarCoreInteriorScreen() });
    expect(model.isActive).toBe(true);
    expect(model.isVisible).toBe(true);
  });

  it("closes back to hidden state", () => {
    const model = resolveStarCoreInteriorScreenModel({ screenState: closeStarCoreInteriorScreen() });
    expect(model.isVisible).toBe(false);
    expect(model.stage).toBe("closed");
  });
});
