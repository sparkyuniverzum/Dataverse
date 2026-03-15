/* @vitest-environment jsdom */

import { act, render } from "@testing-library/react";
import * as THREE from "three";
import { beforeEach, describe, expect, it, vi } from "vitest";

let frameCallback = null;
let mockCamera = null;

vi.mock("@react-three/fiber", () => ({
  useFrame: (callback) => {
    frameCallback = callback;
  },
  useThree: () => ({
    camera: mockCamera,
  }),
}));

import CameraPilot from "./CameraPilot";

function createControlsRef() {
  return {
    current: {
      target: new THREE.Vector3(),
      minDistance: 0,
      maxDistance: 0,
      update: vi.fn(),
    },
  };
}

function createBaseProps(overrides = {}) {
  return {
    controlsRef: createControlsRef(),
    cameraState: {
      position: [0, 120, 340],
      minDistance: 36,
      maxDistance: 1800,
    },
    tableNodes: [{ id: "planet-a", position: [100, 20, 8], radius: 10 }],
    selectedTableNode: { id: "planet-a", position: [100, 20, 8], radius: 10 },
    selectedAsteroidNode: null,
    selectedTableId: "planet-a",
    selectedAsteroidId: "",
    focusOffset: [0, 0, 0],
    microNudgeKey: "",
    starDiveActive: false,
    focusKey: "focus:planet-a",
    reducedMotion: false,
    ...overrides,
  };
}

describe("CameraPilot", () => {
  beforeEach(() => {
    frameCallback = null;
    mockCamera = new THREE.PerspectiveCamera(54, 1, 0.1, 8000);
    mockCamera.position.set(0, 0, 0);
  });

  it("snaps to deterministic target in reduced-motion mode", () => {
    const props = createBaseProps({ reducedMotion: true });
    render(<CameraPilot {...props} />);

    expect(mockCamera.position.x).toBeCloseTo(154.72, 2);
    expect(mockCamera.position.y).toBeCloseTo(63.32, 2);
    expect(mockCamera.position.z).toBeCloseTo(236, 2);
    expect(props.controlsRef.current.target.x).toBeCloseTo(100, 6);
    expect(props.controlsRef.current.target.y).toBeCloseTo(20, 6);
    expect(props.controlsRef.current.target.z).toBeCloseTo(8, 6);
    expect(props.controlsRef.current.minDistance).toBeCloseTo(50.16, 2);
    expect(props.controlsRef.current.maxDistance).toBeCloseTo(1800, 2);
    expect(props.controlsRef.current.update).toHaveBeenCalled();
  });

  it("keeps focus transition deterministic for identical input", () => {
    const runDeterministicFrame = () => {
      mockCamera.position.set(0, 0, 0);
      const props = createBaseProps({
        reducedMotion: false,
        focusKey: "focus:planet-a:deterministic",
      });
      const rendered = render(<CameraPilot {...props} />);
      act(() => {
        frameCallback?.({}, 0.016);
      });
      const snapshot = {
        x: Number(mockCamera.position.x.toFixed(6)),
        y: Number(mockCamera.position.y.toFixed(6)),
        z: Number(mockCamera.position.z.toFixed(6)),
        targetX: Number(props.controlsRef.current.target.x.toFixed(6)),
        targetY: Number(props.controlsRef.current.target.y.toFixed(6)),
        targetZ: Number(props.controlsRef.current.target.z.toFixed(6)),
      };
      rendered.unmount();
      return snapshot;
    };

    const first = runDeterministicFrame();
    const second = runDeterministicFrame();
    expect(second).toEqual(first);
  });

  it("does not drift target while selection is unresolved during rapid state changes", () => {
    const props = createBaseProps();
    const rendered = render(<CameraPilot {...props} />);

    act(() => {
      frameCallback?.({}, 0.016);
    });
    const stableSnapshot = {
      camera: mockCamera.position.clone(),
      target: props.controlsRef.current.target.clone(),
    };

    const unresolvedProps = createBaseProps({
      controlsRef: props.controlsRef,
      selectedTableId: "planet-missing",
      selectedTableNode: null,
      focusKey: "focus:planet-missing",
    });
    rendered.rerender(<CameraPilot {...unresolvedProps} />);

    act(() => {
      frameCallback?.({}, 0.016);
    });

    expect(mockCamera.position.x).toBeCloseTo(stableSnapshot.camera.x, 8);
    expect(mockCamera.position.y).toBeCloseTo(stableSnapshot.camera.y, 8);
    expect(mockCamera.position.z).toBeCloseTo(stableSnapshot.camera.z, 8);
    expect(props.controlsRef.current.target.x).toBeCloseTo(stableSnapshot.target.x, 8);
    expect(props.controlsRef.current.target.y).toBeCloseTo(stableSnapshot.target.y, 8);
    expect(props.controlsRef.current.target.z).toBeCloseTo(stableSnapshot.target.z, 8);
  });
});
