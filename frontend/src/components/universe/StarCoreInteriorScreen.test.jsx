import { cleanup, render, screen } from "@testing-library/react";
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
      mode: "ritual",
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
  it("renders only chamber shell and 3d scene", () => {
    render(<StarCoreInteriorScreen {...createProps()} />);

    expect(screen.getByTestId("star-core-interior-screen")).toBeTruthy();
    expect(screen.getByTestId("ritual-chamber-core")).toBeTruthy();
    expect(screen.getByTestId("ritual-3d-scene-mock")).toBeTruthy();
  });

  it("removes ritual html overlays from the screen shell", () => {
    render(<StarCoreInteriorScreen {...createProps()} />);

    expect(screen.queryByTestId("star-core-mode-ritual")).toBeNull();
    expect(screen.queryByTestId("constitution-selection-focus")).toBeNull();
    expect(screen.queryByTestId("ritual-live-telemetry")).toBeNull();
    expect(screen.queryByTestId("constitution-option-rovnovaha")).toBeNull();
    expect(screen.queryByTestId("star-core-primary-action")).toBeNull();
    expect(screen.queryByTestId("star-core-return-action")).toBeNull();
  });

  it("keeps observatory screen equally free of html chrome", () => {
    render(
      <StarCoreInteriorScreen
        {...createProps({
          interiorModel: {
            ...createProps().interiorModel,
            mode: "observatory",
            phase: "first_orbit_ready",
            availableConstitutions: [],
            governanceSignal: {
              lockStatus: "locked",
              policyVersion: 2,
              profileMode: "locked",
            },
          },
        })}
      />
    );

    expect(screen.queryByTestId("star-core-mode-observatory")).toBeNull();
    expect(screen.queryByTestId("star-core-observatory-panel")).toBeNull();
    expect(screen.queryByTestId("first-orbit-ready-surface")).toBeNull();
  });

  it("stays hidden when screen model is not visible", () => {
    render(
      <StarCoreInteriorScreen
        {...createProps({
          screenModel: {
            stage: "closed",
            isVisible: false,
            isEntering: false,
            isActive: false,
            isReturning: false,
          },
        })}
      />
    );

    expect(screen.queryByTestId("star-core-interior-screen")).toBeNull();
  });
});
