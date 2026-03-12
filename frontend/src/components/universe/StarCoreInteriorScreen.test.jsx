import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import StarCoreInteriorScreen from "./StarCoreInteriorScreen.jsx";

afterEach(() => {
  cleanup();
});

function createProps(overrides = {}) {
  return {
    screenModel: {
      stage: "active",
      isVisible: true,
      isEntering: false,
      isActive: true,
      isReturning: false,
    },
    interiorModel: {
      phase: "constitution_select",
      canSelectConstitution: true,
      availableConstitutions: [
        {
          id: "rovnovaha",
          title: "Rovnovaha",
          subtitle: "Stabilni rezim",
          effectHint: "Stabilni univerzalni rezim.",
          pulseHint: "steady",
          tonePrimary: "#7ee8ff",
          toneSecondary: "#82ffd4",
          recommended: true,
          profileKey: "ORIGIN",
          lawPreset: "balanced",
          physicalProfileKey: "BALANCE",
        },
      ],
      recommendedConstitutionId: "rovnovaha",
      explainability: {
        headline: "Vyber ustavu prostoru",
        body: "Kazdy rezim meni dalsi smer rozvoje galaxie.",
      },
      errorMessage: "",
      isFirstOrbitReady: false,
      isLockPending: false,
      canConfirmLock: false,
    },
    selectedConstitution: null,
    lockTransitionModel: null,
    onSelectConstitution: vi.fn(),
    onConfirmPolicyLock: vi.fn(),
    onReturnToSpace: vi.fn(),
    ...overrides,
  };
}

describe("StarCoreInteriorScreen", () => {
  it("renders standalone interior screen and constitution actions", () => {
    const props = createProps();
    render(<StarCoreInteriorScreen {...props} />);

    expect(screen.getByTestId("star-core-interior-screen")).toBeTruthy();
    expect(screen.getByTestId("constitution-selection-focus")).toBeTruthy();
    expect(screen.queryAllByText("Puls hvezdy: Steady")).toHaveLength(2);
    fireEvent.click(screen.getByTestId("constitution-option-rovnovaha"));
    expect(props.onSelectConstitution).toHaveBeenCalledWith("rovnovaha");
  });

  it("renders backend-driven focus detail for selected constitution", () => {
    const props = createProps({
      selectedConstitution: {
        id: "rovnovaha",
        title: "Rovnovaha",
        subtitle: "Stabilni rezim",
        effectHint: "Stabilni univerzalni rezim.",
        pulseHint: "steady",
        tonePrimary: "#7ee8ff",
        toneSecondary: "#82ffd4",
        recommended: true,
        profileKey: "ORIGIN",
        lawPreset: "balanced",
        physicalProfileKey: "BALANCE",
      },
    });
    render(<StarCoreInteriorScreen {...props} />);

    expect(screen.getByText("AKTIVNI VOLBA")).toBeTruthy();
    expect(screen.getByText("Rovnovaha urci prvni charakter prostoru")).toBeTruthy();
    expect(screen.getAllByText("Tonalita: stabilni modry puls").length).toBeGreaterThan(0);
  });

  it("routes primary action through policy lock affordance", () => {
    const props = createProps({
      interiorModel: {
        phase: "policy_lock_ready",
        canSelectConstitution: false,
        availableConstitutions: [],
        explainability: { headline: "Ustava je pripravena", body: "Mužeš pokračovat." },
        errorMessage: "",
        isFirstOrbitReady: false,
        isLockPending: false,
        canConfirmLock: true,
      },
      lockTransitionModel: {
        title: "Ustava je pripravena",
        hint: "Mužeš pokračovat.",
        actionLabel: "Potvrdit ustavu a uzamknout politiky",
        disabled: false,
      },
    });
    render(<StarCoreInteriorScreen {...props} />);

    fireEvent.click(screen.getByTestId("star-core-primary-action"));
    expect(props.onConfirmPolicyLock).toHaveBeenCalledTimes(1);
  });

  it("uses explicit return action", () => {
    const props = createProps();
    render(<StarCoreInteriorScreen {...props} />);

    fireEvent.click(screen.getByTestId("star-core-return-action"));
    expect(props.onReturnToSpace).toHaveBeenCalledTimes(1);
  });

  it("renders dedicated first-orbit-ready view without constitution form framing", () => {
    const props = createProps({
      interiorModel: {
        phase: "first_orbit_ready",
        canSelectConstitution: false,
        availableConstitutions: [],
        recommendedConstitutionId: "straz",
        explainability: {
          headline: "Politiky jsou uzamceny.",
          body: "Governance zaklad je potvrzen a prostor muze navazat prvni orbitou.",
        },
        errorMessage: "",
        isFirstOrbitReady: true,
        isLockPending: false,
        canConfirmLock: false,
      },
      selectedConstitution: {
        id: "straz",
        title: "Straz",
        subtitle: "Strazni rezim",
        effectHint: "Zpevni governance obal.",
        pulseHint: "steady",
        tonePrimary: "#8ae3ff",
        toneSecondary: "#c8f4ff",
        recommended: false,
        profileKey: "SENTINEL",
        lawPreset: "integrity_first",
        physicalProfileKey: "BALANCE",
      },
      lockTransitionModel: {
        title: "Politiky jsou uzamceny.",
        hint: "Governance zaklad je potvrzen.",
        actionLabel: "Vratit se do prostoru",
        disabled: false,
      },
    });
    render(<StarCoreInteriorScreen {...props} />);

    expect(screen.getByTestId("first-orbit-ready-surface")).toBeTruthy();
    expect(screen.queryByTestId("constitution-select-surface")).toBeNull();
    expect(screen.getByText("POTVRZENA USTAVA")).toBeTruthy();
  });
});
