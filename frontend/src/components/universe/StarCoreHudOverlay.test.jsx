import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import StarCoreHudOverlay from "./StarCoreHudOverlay.jsx";

describe("StarCoreHudOverlay", () => {
  it("renders minimal HUD and command prompt", () => {
    render(
      <StarCoreHudOverlay
        model={{
          galaxyName: "Moje Galaxie",
          globalStage: "ONBOARDING_INCOMPLETE",
          syncLabel: "SYNC ONLINE",
          hudTitle: "Srdce hvězdy čeká na uzamčení politik",
          hudSubtitle: "Nejdřív potvrď ústavu prostoru.",
          commandPrompt: "Potvrdit ústavu a uzamknout politiky",
          commandHint: "Law preset: BALANCED",
          errorHint: "",
        }}
        isStarFocused={false}
        isCoreEntered={false}
      />
    );

    expect(screen.getByTestId("star-core-hud")).toBeTruthy();
    expect(screen.getByText("Dvojklikem vstoupíš do Srdce hvězdy")).toBeTruthy();
    expect(
      screen.getByText("Pohybem myši obhlédneš hlavní prostor galaxie. Další rozhodnutí začíná až uvnitř jádra.")
    ).toBeTruthy();
  });

  it("switches prompt copy for entered core state", () => {
    render(
      <StarCoreHudOverlay
        model={{
          galaxyName: "Moje Galaxie",
          globalStage: "ONBOARDING_INCOMPLETE",
          syncLabel: "SYNC ONLINE",
          state: "star_core_unlocked",
          hudTitle: "Srdce hvězdy čeká na uzamčení politik",
          hudSubtitle: "Nejdřív potvrď ústavu prostoru.",
          commandPrompt: "Potvrdit ústavu a uzamknout politiky",
          commandHint: "Law preset: BALANCED",
          errorHint: "",
        }}
        isStarFocused
        isCoreEntered
      />
    );

    expect(screen.getByText("Jsi v prahu Srdce hvězdy")).toBeTruthy();
  });
});
