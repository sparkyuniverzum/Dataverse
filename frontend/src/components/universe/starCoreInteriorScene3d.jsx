import { Canvas, useFrame } from "@react-three/fiber";
import { useMemo, useRef } from "react";
import * as THREE from "three";

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

function RitualChamberScene({ visualModel }) {
  const rootRef = useRef(null);
  const coreRef = useRef(null);
  const selectionRingRef = useRef(null);
  const lockRingRef = useRef(null);
  const firstOrbitRef = useRef(null);
  const haloNodes = useMemo(() => buildEventHaloNodes(visualModel.eventHaloCount), [visualModel.eventHaloCount]);
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
  });

  return (
    <>
      <color attach="background" args={["#010914"]} />
      <fog attach="fog" args={["#010914", 10, 26]} />
      <ambientLight intensity={0.48 + visualModel.chamberDepth * 0.24} />
      <pointLight position={[0, 0, 3.2]} intensity={6.8 + visualModel.pulseStrength * 4.2} color={tonePrimary} />
      <pointLight position={[0, 1.8, -2.2]} intensity={3.4 + visualModel.runtimeTempo * 2.6} color={toneSecondary} />

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

export default function StarCoreInteriorScene3d({ visualModel }) {
  const canUseWebGL = typeof window !== "undefined" && typeof window.WebGLRenderingContext !== "undefined";
  if (!canUseWebGL) {
    return <div data-testid="ritual-3d-fallback" style={{ position: "absolute", inset: 0 }} />;
  }

  return (
    <Canvas camera={{ position: [0, 0.2, 10.4], fov: 38, near: 0.1, far: 80 }} dpr={[1, 1.7]} gl={{ antialias: true }}>
      <RitualChamberScene visualModel={visualModel} />
    </Canvas>
  );
}
