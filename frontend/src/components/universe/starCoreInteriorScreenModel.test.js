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
    const model = resolveStarCoreInteriorScreenModel({
      screenState: openStarCoreInteriorScreen(),
      interiorTruth: {
        interiorPhase: "constitution_select",
        nextAction: { label: "Vyber ústavu" },
        explainability: { headline: "Nejdřív vyber ústavu.", body: "Bez ní nelze pokračovat." },
      },
    });
    expect(model.isActive).toBe(true);
    expect(model.isVisible).toBe(true);
    expect(model.interiorPhase).toBe("constitution_select");
    expect(model.nextActionLabel).toBe("Vyber ústavu");
  });

  it("closes back to hidden state", () => {
    const model = resolveStarCoreInteriorScreenModel({ screenState: closeStarCoreInteriorScreen() });
    expect(model.isVisible).toBe(false);
    expect(model.stage).toBe("closed");
  });
});
