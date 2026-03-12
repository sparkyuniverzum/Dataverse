import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";

import GalaxySelectionHud from "./GalaxySelectionHud.jsx";

afterEach(() => {
  cleanup();
});

describe("GalaxySelectionHud", () => {
  it("renders free navigation prompt and radar", () => {
    render(
      <GalaxySelectionHud
        model={{
          galaxyName: "Moje Galaxie",
          globalStage: "ONBOARDING_READY",
          syncLabel: "SYNC ONLINE",
          errorHint: "",
        }}
        navigationModel={{
          mode: "space_idle",
          selectedObject: null,
        }}
        radarModel={{
          galaxyName: "Moje Galaxie",
          headingDegrees: 0,
          markers: [{ id: "star-core", type: "star", label: "Srdce hvězdy", x: 50, y: 50, selected: false }],
        }}
      />
    );

    expect(screen.getByTestId("galaxy-selection-hud")).toBeTruthy();
    expect(screen.getByText("Volná navigace galaxií")).toBeTruthy();
    expect(screen.getByTestId("galaxy-radar")).toBeTruthy();
  });

  it("renders selected object focus", () => {
    render(
      <GalaxySelectionHud
        model={{
          galaxyName: "Moje Galaxie",
          globalStage: "ONBOARDING_READY",
          syncLabel: "SYNC ONLINE",
          errorHint: "",
        }}
        navigationModel={{
          mode: "object_selected",
          selectedObject: { label: "Planeta A", subtitle: "Orion" },
        }}
        radarModel={{
          galaxyName: "Moje Galaxie",
          headingDegrees: 24,
          markers: [],
        }}
      />
    );

    expect(screen.getByText("Vybraný objekt: Planeta A")).toBeTruthy();
    expect(screen.getByText("Fokus: Planeta A • Orion")).toBeTruthy();
  });

  it("renders approach guidance", () => {
    render(
      <GalaxySelectionHud
        model={{
          galaxyName: "Moje Galaxie",
          globalStage: "ONBOARDING_READY",
          syncLabel: "SYNC ONLINE",
          errorHint: "",
        }}
        navigationModel={{
          mode: "approach_active",
          selectedObject: { label: "Srdce hvězdy", subtitle: "My Galaxy" },
        }}
        radarModel={{
          galaxyName: "Moje Galaxie",
          headingDegrees: 24,
          markers: [],
        }}
      />
    );

    expect(screen.getByText("Přibližuješ se k objektu Srdce hvězdy")).toBeTruthy();
    expect(screen.getAllByTestId("galaxy-radar")).toHaveLength(1);
  });
});
