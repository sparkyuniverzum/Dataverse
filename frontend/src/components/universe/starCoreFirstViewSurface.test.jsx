import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import StarCoreFirstViewSurface from "./starCoreFirstViewSurface.jsx";

const unlockedModel = {
  state: "star_core_unlocked",
  title: "Nejdřív nastav zákony hvězdy",
  description: "Bez uzamčení Star Core nemá galaxie pevná pravidla.",
  primaryActionLabel: "Otevřít Srdce hvězdy",
  secondaryActionLabel: "Proč je to první krok",
  badges: [{ label: "Scope: Moje Galaxie" }, { label: "Mode: Star Core first" }, { label: "Sync online" }],
  rows: [
    { label: "Policy status", value: "DRAFT / v1" },
    { label: "Law preset", value: "Balanced" },
    { label: "Lock status", value: "Čeká na potvrzení governance" },
  ],
  tone: {
    accent: "#7ee8ff",
    accentSoft: "#82ffd4",
    glow: "rgba(255, 170, 84, 0.28)",
  },
};

describe("StarCoreFirstViewSurface", () => {
  it("renders dominant pre-lock surface", () => {
    render(<StarCoreFirstViewSurface model={unlockedModel} halo={{ intensity: 0.34, orbitOpacity: 0.42 }} />);

    expect(screen.getByTestId("star-core-first-view")).toBeTruthy();
    expect(screen.getByText("Nejdřív nastav zákony hvězdy")).toBeTruthy();
    expect(screen.getByText("Otevřít Srdce hvězdy")).toBeTruthy();
  });

  it("renders post-lock CTA", () => {
    render(
      <StarCoreFirstViewSurface
        model={{
          ...unlockedModel,
          state: "star_core_locked_ready",
          title: "Hvězda je uzamčena. Můžeš založit první planetu",
          primaryActionLabel: "Založit první planetu",
        }}
        halo={{ intensity: 0.46, orbitOpacity: 0.7 }}
      />
    );

    expect(screen.getByText("Hvězda je uzamčena. Můžeš založit první planetu")).toBeTruthy();
    expect(screen.getByText("Založit první planetu")).toBeTruthy();
  });
});
