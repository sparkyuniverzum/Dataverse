import { Canvas, useFrame } from "@react-three/fiber";
import { useMemo, useRef } from "react";
import * as THREE from "three";

const CAMERA_ENTRY_START = new THREE.Vector3(0, 1.3, 18.2);
const CAMERA_CORE_POSITION = new THREE.Vector3(0, 0.2, 10.4);
const LOOK_ENTRY_START = new THREE.Vector3(0, 0.6, 0);
const LOOK_CORE = new THREE.Vector3(0, 0, 0);

function toThreeColor(value, fallback = "#7ee8ff") {
  const candidate = String(value || "").trim();
  const color = new THREE.Color();
  try {
    color.set(candidate || fallback);
    return color;
  } catch {
    color.set(fallback);
    return color;
  }
}

function polarVector(angleDeg, radiusX, radiusY, y = 0) {
  const theta = (Number(angleDeg) || 0) * (Math.PI / 180);
  return new THREE.Vector3(Math.cos(theta) * radiusX, y, Math.sin(theta) * radiusY);
}

function buildEventHaloNodes(count = 4) {
  const safeCount = Math.max(4, Math.min(28, Math.floor(Number(count) || 4)));
  return Array.from({ length: safeCount }, (_, index) => {
    const angleDeg = (index / safeCount) * 360;
    return {
      key: `event-halo-${index}`,
      angleDeg,
      radiusX: 5.9 + Math.sin(index * 0.6) * 0.25,
      radiusY: 4.2 + Math.cos(index * 0.5) * 0.18,
      y: Math.sin(index * 0.4) * 0.35,
    };
  });
}

function buildDiveTunnelLayers() {
  return Array.from({ length: 8 }, (_, index) => ({
    key: `dive-layer-${index}`,
    radius: 2.8 + index * 0.55,
    tube: 0.05 + index * 0.008,
    zOffset: 1.1 + index * 0.36,
    speed: 1.2 + index * 0.22,
    twist: index * 0.2,
  }));
}

function easeOutCubic(value) {
  const t = Math.max(0, Math.min(1, Number(value) || 0));
  return 1 - (1 - t) ** 3;
}

function RitualChamberScene({ visualModel, entryDiveActive = false, entryDurationMs = 760 }) {
  const rootRef = useRef(null);
  const coreRef = useRef(null);
  const selectionRingRef = useRef(null);
  const lockRingRef = useRef(null);
  const firstOrbitRef = useRef(null);
  const diveTunnelRef = useRef(null);
  const diveProgressRef = useRef(entryDiveActive ? 0 : 1);
  const previousEntryStateRef = useRef(false);
  const cameraTargetRef = useRef(new THREE.Vector3());
  const lookTargetRef = useRef(new THREE.Vector3());
  const haloNodes = useMemo(() => buildEventHaloNodes(visualModel.eventHaloCount), [visualModel.eventHaloCount]);
  const diveTunnelLayers = useMemo(() => buildDiveTunnelLayers(), []);
  const tonePrimary = useMemo(
    () => toThreeColor(visualModel.theme.tonePrimary, "#7ee8ff"),
    [visualModel.theme.tonePrimary]
  );
  const toneSecondary = useMemo(
    () => toThreeColor(visualModel.theme.toneSecondary, "#82ffd4"),
    [visualModel.theme.toneSecondary]
  );
  const chamberGlow = useMemo(
    () => toThreeColor(visualModel.theme.tonePrimary, "#7ee8ff"),
    [visualModel.theme.tonePrimary]
  );

  useFrame((state, delta) => {
    const elapsed = state.clock.elapsedTime;
    const baseRotation = 0.16 + visualModel.runtimeTempo * 0.42;
    const pulse = 1 + Math.sin(elapsed * visualModel.chamberPulseSpeed) * (0.028 + visualModel.pulseStrength * 0.05);
    const entering = Boolean(entryDiveActive);
    const entryDurationSec = Math.max(0.2, (Number(entryDurationMs) || 760) / 1000);

    if (entering && !previousEntryStateRef.current) {
      diveProgressRef.current = 0;
      state.camera.position.copy(CAMERA_ENTRY_START);
      state.camera.fov = 31;
      state.camera.updateProjectionMatrix();
    }
    if (!entering && previousEntryStateRef.current) {
      diveProgressRef.current = 1;
    }
    previousEntryStateRef.current = entering;

    if (entering) {
      diveProgressRef.current = Math.min(1, diveProgressRef.current + delta / entryDurationSec);
    }
    const diveProgress = easeOutCubic(diveProgressRef.current);
    cameraTargetRef.current.copy(CAMERA_ENTRY_START).lerp(CAMERA_CORE_POSITION, diveProgress);
    lookTargetRef.current.copy(LOOK_ENTRY_START).lerp(LOOK_CORE, diveProgress);
    state.camera.position.lerp(cameraTargetRef.current, entering ? 0.22 : 0.12);
    const targetFov = THREE.MathUtils.lerp(31, 38, diveProgress);
    state.camera.fov = THREE.MathUtils.lerp(state.camera.fov, targetFov, 0.16);
    state.camera.lookAt(lookTargetRef.current);
    state.camera.updateProjectionMatrix();

    if (rootRef.current) {
      rootRef.current.rotation.y += delta * baseRotation;
    }
    if (coreRef.current) {
      coreRef.current.scale.setScalar(pulse * visualModel.chamberPulseScale);
    }
    if (selectionRingRef.current) {
      selectionRingRef.current.rotation.z += delta * (0.24 + visualModel.domainDensity * 0.56);
    }
    if (lockRingRef.current) {
      lockRingRef.current.rotation.z -= delta * (0.34 + visualModel.criticalLoad * 0.32);
      lockRingRef.current.scale.setScalar(visualModel.lockRingScale);
    }
    if (firstOrbitRef.current) {
      firstOrbitRef.current.rotation.y += delta * (0.21 + visualModel.planetActivity * 0.4);
    }
    if (diveTunnelRef.current) {
      const diveEnergy = 1 - diveProgress;
      diveTunnelRef.current.visible = entering && diveEnergy > 0.03;
      diveTunnelRef.current.rotation.z += delta * 0.14;
      diveTunnelRef.current.children.forEach((child, index) => {
        const layer = diveTunnelLayers[index];
        if (!layer) return;
        child.position.z = ((elapsed * layer.speed + layer.zOffset) % 5.8) - 2.9;
        const intensity = 0.08 + diveEnergy * (0.28 + index * 0.014);
        child.scale.setScalar(1 + diveEnergy * 0.72);
        if (child.material && typeof child.material === "object" && "opacity" in child.material) {
          child.material.opacity = intensity;
        }
      });
    }
  });

  return (
    <>
      <color attach="background" args={["#010914"]} />
      <fog attach="fog" args={["#010914", 10, 26]} />
      <ambientLight intensity={0.48 + visualModel.chamberDepth * 0.24} />
      <pointLight position={[0, 0, 3.2]} intensity={6.8 + visualModel.pulseStrength * 4.2} color={tonePrimary} />
      <pointLight position={[0, 1.8, -2.2]} intensity={3.4 + visualModel.runtimeTempo * 2.6} color={toneSecondary} />

      <group ref={diveTunnelRef}>
        {diveTunnelLayers.map((layer) => (
          <mesh key={layer.key} rotation={[Math.PI / 2, layer.twist, 0]} position={[0, 0, layer.zOffset]}>
            <torusGeometry args={[layer.radius, layer.tube, 16, 96]} />
            <meshBasicMaterial color={tonePrimary} transparent opacity={0.18} />
          </mesh>
        ))}
      </group>

      <group ref={rootRef}>
        <mesh ref={coreRef}>
          <sphereGeometry args={[1.92, 64, 64]} />
          <meshStandardMaterial
            color={tonePrimary}
            emissive={toneSecondary}
            emissiveIntensity={0.62 + visualModel.pulseStrength * 0.74}
            roughness={0.22}
            metalness={0.14}
            transparent
            opacity={0.94}
          />
        </mesh>

        <mesh scale={1.22}>
          <sphereGeometry args={[1.74, 48, 48]} />
          <meshBasicMaterial color={toneSecondary} transparent opacity={0.16 + visualModel.chamberDepth * 0.18} />
        </mesh>

        <group ref={selectionRingRef} rotation={[Math.PI / 2.5, 0.18, 0.26]}>
          <mesh visible={visualModel.showSelectionOrbit}>
            <torusGeometry args={[3.65, 0.07, 24, 180]} />
            <meshBasicMaterial color={tonePrimary} transparent opacity={0.42 + visualModel.domainDensity * 0.34} />
          </mesh>
        </group>

        <group ref={lockRingRef} rotation={[Math.PI / 2, 0.32, -0.16]}>
          <mesh visible={visualModel.showLockRing}>
            <torusGeometry args={[2.85, 0.09, 24, 180]} />
            <meshBasicMaterial color={toneSecondary} transparent opacity={0.5 + visualModel.pulseStrength * 0.3} />
          </mesh>
        </group>

        <group ref={firstOrbitRef} rotation={[Math.PI / 1.8, -0.24, 0.22]}>
          <mesh visible={visualModel.showFirstOrbit}>
            <torusGeometry args={[4.8, 0.05, 20, 220]} />
            <meshBasicMaterial color={tonePrimary} transparent opacity={0.66 + visualModel.planetActivity * 0.22} />
          </mesh>
        </group>

        {haloNodes.map((node, index) => {
          const position = polarVector(node.angleDeg, node.radiusX, node.radiusY, node.y);
          return (
            <mesh key={node.key} position={position}>
              <sphereGeometry args={[0.035 + (index % 3) * 0.01, 10, 10]} />
              <meshBasicMaterial color={tonePrimary} transparent opacity={visualModel.eventHaloOpacity} />
            </mesh>
          );
        })}

        {visualModel.domainSegments.map((segment) => {
          const position = polarVector(segment.angleDeg, 4.25, 3.05, Math.sin(segment.angleDeg) * 0.24);
          return (
            <mesh key={`domain-node-${segment.key}`} position={position}>
              <boxGeometry args={[0.22 + segment.intensity * 0.45, 0.035, 0.11]} />
              <meshBasicMaterial
                color={segment.status === "degraded" || segment.status === "critical" ? "#ffc488" : chamberGlow}
                transparent
                opacity={0.38 + segment.intensity * 0.58}
              />
            </mesh>
          );
        })}

        {visualModel.planetaryNodes.map((node) => {
          const position = polarVector(node.angleDeg, 5.05, 2.42, Math.sin(node.angleDeg) * 0.2);
          return (
            <mesh key={`planetary-node-${node.key}`} position={position}>
              <sphereGeometry args={[0.07 + node.size * 0.07, 14, 14]} />
              <meshBasicMaterial color={toneSecondary} transparent opacity={0.42 + visualModel.planetActivity * 0.5} />
            </mesh>
          );
        })}
      </group>
    </>
  );
}

export default function StarCoreInteriorScene3d({ visualModel, screenModel = null }) {
  const canUseWebGL = typeof window !== "undefined" && typeof window.WebGLRenderingContext !== "undefined";
  if (!canUseWebGL) {
    return <div data-testid="ritual-3d-fallback" style={{ position: "absolute", inset: 0 }} />;
  }
  const entryDiveActive = Boolean(screenModel?.isEntering);
  const entryDurationMs = Number(screenModel?.transitionDurationMs) || 760;

  return (
    <Canvas camera={{ position: [0, 0.2, 10.4], fov: 38, near: 0.1, far: 80 }} dpr={[1, 1.7]} gl={{ antialias: true }}>
      <RitualChamberScene
        visualModel={visualModel}
        entryDiveActive={entryDiveActive}
        entryDurationMs={entryDurationMs}
      />
    </Canvas>
  );
}
