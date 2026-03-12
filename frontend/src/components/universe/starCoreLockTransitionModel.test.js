import { describe, expect, it } from "vitest";

import { resolveStarCoreLockTransitionModel } from "./starCoreLockTransitionModel.js";

describe("starCoreLockTransitionModel", () => {
  it("returns disabled action while lock is pending", () => {
    const transition = resolveStarCoreLockTransitionModel({
      interiorModel: { phase: "policy_lock_transition" },
      selectedConstitution: null,
    });
    expect(transition.disabled).toBe(true);
    expect(transition.actionLabel).toBe("Uzamykám Srdce hvězdy");
  });

  it("returns return action for first orbit ready", () => {
    const transition = resolveStarCoreLockTransitionModel({
      interiorModel: { phase: "first_orbit_ready" },
      selectedConstitution: null,
    });
    expect(transition.actionLabel).toBe("Vrátit se do prostoru");
    expect(transition.disabled).toBe(false);
  });
});
