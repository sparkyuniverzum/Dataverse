import { describe, expect, it } from "vitest";

import { resolveStarCoreFirstViewModel, resolveStarCoreLoadingModel } from "./starCoreFirstViewModel.js";

describe("starCoreFirstViewModel", () => {
  it("builds explicit loading state without fake governance claims", () => {
    const model = resolveStarCoreLoadingModel({ galaxyName: "Moje Galaxie", isOnline: true });

    expect(model.state).toBe("loading");
    expect(model.title).toMatch(/Načítám pravdu Srdce hvězdy/);
    expect(model.badges[0].label).toBe("Scope: Moje Galaxie");
  });

  it("resolves unlocked governance-first state", () => {
    const model = resolveStarCoreFirstViewModel({
      galaxy: { id: "g-1", name: "Moje Galaxie" },
      connectivity: { isOnline: true },
      policy: {
        lock_status: "draft",
        policy_version: 1,
        law_preset: "balanced",
        locked_at: null,
      },
      physicsProfile: {
        profile_version: 1,
      },
      profileMeta: { label: "Origin Core", primaryColor: "#7ee8ff", secondaryColor: "#82ffd4" },
      physicalProfileMeta: { label: "Balance Physics" },
    });

    expect(model.state).toBe("star_core_unlocked");
    expect(model.title).toMatch(/Nejdřív nastav zákony hvězdy/);
    expect(model.primaryActionLabel).toBe("Otevřít Srdce hvězdy");
  });

  it("resolves locked ready state with next-step CTA", () => {
    const model = resolveStarCoreFirstViewModel({
      galaxy: { id: "g-1", name: "Moje Galaxie" },
      connectivity: { isOnline: true },
      policy: {
        lock_status: "locked",
        policy_version: 3,
        law_preset: "integrity_first",
        locked_at: "2026-03-12T10:00:00Z",
      },
      physicsProfile: {
        profile_version: 2,
      },
      profileMeta: { label: "Sentinel Core", primaryColor: "#ff9a7a", secondaryColor: "#ffd27f" },
      physicalProfileMeta: { label: "Forge Physics" },
    });

    expect(model.state).toBe("star_core_locked_ready");
    expect(model.title).toMatch(/Hvězda je uzamčena/);
    expect(model.primaryActionLabel).toBe("Založit první planetu");
    expect(model.rows[0].value).toBe("LOCKED / v3");
  });

  it("falls back to data_unavailable when truth is missing", () => {
    const model = resolveStarCoreFirstViewModel(null);

    expect(model.state).toBe("data_unavailable");
    expect(model.primaryActionLabel).toBeNull();
  });
});
