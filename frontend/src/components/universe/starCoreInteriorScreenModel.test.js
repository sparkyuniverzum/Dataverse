import { describe, expect, it } from "vitest";

import {
  beginStarCoreInteriorScreenEntry,
  beginStarCoreInteriorScreenReturn,
  closeStarCoreInteriorScreen,
  createInitialStarCoreInteriorScreenState,
  resolveStarCoreInteriorScreenEntryComplete,
  resolveStarCoreInteriorScreenModel,
} from "./starCoreInteriorScreenModel.js";

describe("starCoreInteriorScreenModel", () => {
  it("starts closed by default", () => {
    expect(createInitialStarCoreInteriorScreenState()).toEqual({ stage: "closed" });
  });

  it("moves from entering to active", () => {
    const entering = beginStarCoreInteriorScreenEntry();
    const enteringModel = resolveStarCoreInteriorScreenModel({ screenState: entering });
    expect(enteringModel.isEntering).toBe(true);
    expect(enteringModel.transitionDurationMs).toBe(760);

    const active = resolveStarCoreInteriorScreenEntryComplete(entering);
    const model = resolveStarCoreInteriorScreenModel({ screenState: active });
    expect(model.isActive).toBe(true);
    expect(model.isVisible).toBe(true);
  });

  it("tracks returning state with reduced-motion timing", () => {
    const model = resolveStarCoreInteriorScreenModel({
      screenState: beginStarCoreInteriorScreenReturn(),
      reducedMotion: true,
    });
    expect(model.isReturning).toBe(true);
    expect(model.transitionDurationMs).toBe(40);
  });

  it("closes back to hidden state", () => {
    const model = resolveStarCoreInteriorScreenModel({ screenState: closeStarCoreInteriorScreen() });
    expect(model.isVisible).toBe(false);
    expect(model.stage).toBe("closed");
  });
});
