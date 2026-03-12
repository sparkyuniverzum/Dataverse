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
      />
    );

    expect(screen.getByTestId("star-core-hud")).toBeTruthy();
    expect(screen.getByText("Potvrdit ústavu a uzamknout politiky")).toBeTruthy();
  });
});
