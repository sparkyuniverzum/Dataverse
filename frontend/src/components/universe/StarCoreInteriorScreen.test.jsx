import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import StarCoreInteriorScreen from "./StarCoreInteriorScreen.jsx";

vi.mock("./starCoreInteriorScene3d.jsx", () => ({
  default: () => <div data-testid="ritual-3d-scene-mock" />,
}));

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
      governanceSignal: {
        lockStatus: "draft",
        policyVersion: 1,
        profileMode: "auto",
      },
      telemetry: {
        runtime: { writesPerMinute: 21.8, eventsCount: 14 },
        pulse: { lastEventSeq: 91, eventTypes: ["table_update"], sampledCount: 4, peakIntensity: 0.62 },
        domains: {
          items: [{ domainName: "governance", status: "stable", activityIntensity: 0.4 }],
        },
        planetPhysics: {
          itemCount: 3,
          activeCount: 2,
          criticalCount: 0,
          phaseCounts: [{ phase: "ACTIVE", count: 2 }],
        },
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
  it("renders standalone interior screen as clean foundation scene", () => {
    const props = createProps();
    render(<StarCoreInteriorScreen {...props} />);

    expect(screen.getByTestId("star-core-interior-screen")).toBeTruthy();
    expect(screen.getByTestId("ritual-chamber-core")).toBeTruthy();
    expect(screen.getByTestId("star-core-return-action")).toBeTruthy();
    expect(screen.queryByTestId("constitution-selection-focus")).toBeNull();
    expect(screen.queryByTestId("ritual-live-telemetry")).toBeNull();
    expect(screen.queryByTestId("constitution-option-rovnovaha")).toBeNull();
    expect(screen.queryAllByTestId("ritual-domain-segment")).toHaveLength(0);
    expect(screen.queryAllByTestId("ritual-pulse-beacon")).toHaveLength(0);
  });

  it("shows short entry dive and delays constitution interaction during entering stage", () => {
    const props = createProps({
      screenModel: {
        stage: "entering",
        isVisible: true,
        isEntering: true,
        isActive: false,
        isReturning: false,
        transitionDurationMs: 760,
      },
    });
    render(<StarCoreInteriorScreen {...props} />);

    expect(screen.getByTestId("star-core-entry-dive-overlay")).toBeTruthy();
    expect(screen.queryByTestId("constitution-option-rovnovaha")).toBeNull();
    expect(screen.getByTestId("star-core-return-action").getAttribute("aria-disabled")).toBe("true");
  });

  it("keeps foundation scene free of focus detail and telemetry chrome", () => {
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

    expect(screen.queryByText("AKTIVNI PROUD")).toBeNull();
    expect(screen.queryByText("Udrzi prvni prostor citelny, stabilni a pripraveny na navazani.")).toBeNull();
    expect(screen.queryByText(/Tonalita: stabilni modry puls/)).toBeNull();
  });

  it("routes primary action through policy lock affordance", () => {
    const props = createProps({
      interiorModel: {
        phase: "policy_lock_ready",
        canSelectConstitution: false,
        availableConstitutions: [],
        explainability: { headline: "Ustava je pripravena", body: "Mužeš pokračovat." },
        governanceSignal: {
          lockStatus: "draft",
          policyVersion: 1,
          profileMode: "auto",
        },
        telemetry: {
          runtime: { writesPerMinute: 21.8, eventsCount: 14 },
          pulse: { lastEventSeq: 91, eventTypes: ["table_update"], sampledCount: 4, peakIntensity: 0.62 },
          domains: { items: [{ domainName: "governance", status: "stable", activityIntensity: 0.4 }] },
          planetPhysics: {
            itemCount: 2,
            activeCount: 2,
            criticalCount: 0,
            phaseCounts: [{ phase: "ACTIVE", count: 2 }],
          },
        },
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
    expect(screen.queryByTestId("ritual-lock-ring")).toBeNull();
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
        governanceSignal: {
          lockStatus: "locked",
          policyVersion: 2,
          profileMode: "locked",
        },
        telemetry: {
          runtime: { writesPerMinute: 9.2, eventsCount: 20 },
          pulse: { lastEventSeq: 120, eventTypes: ["policy_lock"], sampledCount: 1, peakIntensity: 0.32 },
          domains: { items: [{ domainName: "governance", status: "stable", activityIntensity: 0.2 }] },
          planetPhysics: { itemCount: 4, activeCount: 1, criticalCount: 0, phaseCounts: [{ phase: "CALM", count: 3 }] },
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

    expect(screen.queryByTestId("first-orbit-ready-surface")).toBeNull();
    expect(screen.queryByTestId("first-orbit-ring")).toBeNull();
    expect(screen.queryAllByTestId("ritual-planet-node")).toHaveLength(0);
  });
});
