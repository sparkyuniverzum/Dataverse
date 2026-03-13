import { Canvas, useFrame } from "@react-three/fiber";
import { useMemo, useRef } from "react";
import * as THREE from "three";

const CAMERA_ENTRY_START = new THREE.Vector3(0, 2.4, 20.5);
const CAMERA_CORE_POSITION = new THREE.Vector3(0, 0.7, 10.8);
const LOOK_ENTRY_START = new THREE.Vector3(0, 0.8, -1.2);
const LOOK_CORE = new THREE.Vector3(0, 0.2, 0);
const CORE_SHELL_BASE_SCALE = new THREE.Vector3(0.72, 1.88, 0.72);
const CORE_INNER_BASE_SCALE = new THREE.Vector3(0.18, 2.28, 0.18);
const CORE_HALO_BASE_SCALE = new THREE.Vector3(0.64, 2.56, 0.64);

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

function easeOutCubic(value) {
  const t = Math.max(0, Math.min(1, Number(value) || 0));
  return 1 - (1 - t) ** 3;
}

function buildDiveLayers() {
  return Array.from({ length: 9 }, (_, index) => ({
    key: `dive-${index}`,
    radius: 2.6 + index * 0.5,
    tube: 0.035 + index * 0.008,
    speed: 1 + index * 0.2,
    zOffset: index * 0.44,
    twist: index * 0.18,
  }));
}

function buildCrystalPillars() {
  return [
    { key: "pillar-nw", position: [-8.6, 0.5, -4.8], rotation: [0.05, 0.12, 0.02], scale: [0.26, 6.4, 0.26] },
    { key: "pillar-ne", position: [8.6, 0.5, -4.8], rotation: [-0.05, -0.12, -0.02], scale: [0.26, 6.4, 0.26] },
    { key: "pillar-sw", position: [-7.4, -0.3, 1.4], rotation: [0.03, -0.14, -0.02], scale: [0.18, 4.9, 0.18] },
    { key: "pillar-se", position: [7.4, -0.3, 1.4], rotation: [-0.03, 0.14, 0.02], scale: [0.18, 4.9, 0.18] },
  ];
}

function buildFrameBeams() {
  return [
    { key: "top-a", position: [0, 4.55, -2.6], rotation: [0, 0, 0], scale: [7.2, 0.18, 0.18] },
    { key: "top-b", position: [0, 5.15, -3.4], rotation: [0, 0, 0], scale: [5.8, 0.14, 0.14] },
    { key: "bottom-a", position: [0, -4.85, -1.9], rotation: [0, 0, 0], scale: [7.6, 0.2, 0.2] },
    { key: "support-left", position: [-3.1, 2.45, -2.8], rotation: [0, 0, 0.9], scale: [2.9, 0.1, 0.1] },
    { key: "support-right", position: [3.1, 2.45, -2.8], rotation: [0, 0, -0.9], scale: [2.9, 0.1, 0.1] },
    { key: "base-left", position: [-3.2, -2.9, -2.1], rotation: [0, 0, -0.88], scale: [2.5, 0.1, 0.1] },
    { key: "base-right", position: [3.2, -2.9, -2.1], rotation: [0, 0, 0.88], scale: [2.5, 0.1, 0.1] },
  ];
}

function buildBackdropLattice() {
  return [
    { key: "ring-0", radius: 6.4, y: 0, opacity: 0.035 },
    { key: "ring-1", radius: 5.1, y: 0, opacity: 0.05 },
    { key: "ring-2", radius: 3.9, y: 0, opacity: 0.065 },
  ];
}

function buildPortalFrames() {
  return [
    { key: "frame-outer-top", position: [0, 3.55, -3.8], scale: [7.6, 0.12, 0.14] },
    { key: "frame-outer-bottom", position: [0, -3.55, -3.8], scale: [7.6, 0.12, 0.14] },
    { key: "frame-outer-left", position: [-3.8, 0, -3.8], scale: [0.12, 7.1, 0.14] },
    { key: "frame-outer-right", position: [3.8, 0, -3.8], scale: [0.12, 7.1, 0.14] },
    { key: "frame-inner-top", position: [0, 2.45, -2.35], scale: [4.8, 0.08, 0.1] },
    { key: "frame-inner-bottom", position: [0, -2.45, -2.35], scale: [4.8, 0.08, 0.1] },
    { key: "frame-inner-left", position: [-2.4, 0, -2.35], scale: [0.08, 4.9, 0.1] },
    { key: "frame-inner-right", position: [2.4, 0, -2.35], scale: [0.08, 4.9, 0.1] },
  ];
}

function buildWallFacets() {
  return [
    { key: "facet-top-left", position: [-4.9, 3.2, -3.1], rotation: [0, 0.22, 0.26], scale: [0.72, 1.8, 0.18] },
    { key: "facet-top-right", position: [4.9, 3.2, -3.1], rotation: [0, -0.22, -0.26], scale: [0.72, 1.8, 0.18] },
    { key: "facet-mid-left", position: [-5.4, 0.3, -2.5], rotation: [0, 0.16, 0.08], scale: [0.54, 2.7, 0.16] },
    { key: "facet-mid-right", position: [5.4, 0.3, -2.5], rotation: [0, -0.16, -0.08], scale: [0.54, 2.7, 0.16] },
    { key: "facet-bottom-left", position: [-4.8, -3.2, -2.9], rotation: [0, 0.18, -0.22], scale: [0.64, 1.7, 0.18] },
    { key: "facet-bottom-right", position: [4.8, -3.2, -2.9], rotation: [0, -0.18, 0.22], scale: [0.64, 1.7, 0.18] },
  ];
}

function buildInnerSpines() {
  return [
    { key: "spine-left", position: [-2.65, 0.15, -1.9], scale: [0.08, 5.8, 0.1] },
    { key: "spine-right", position: [2.65, 0.15, -1.9], scale: [0.08, 5.8, 0.1] },
    { key: "spine-left-inner", position: [-1.65, 0.15, -1.2], scale: [0.05, 4.2, 0.08] },
    { key: "spine-right-inner", position: [1.65, 0.15, -1.2], scale: [0.05, 4.2, 0.08] },
  ];
}

function buildPulseCloud(count) {
  const safeCount = Math.max(16, Math.min(96, Math.floor(Number(count) || 24)));
  return Array.from({ length: safeCount }, (_, index) => {
    const angle = (index / safeCount) * Math.PI * 2;
    const radial = 0.7 + (index % 9) * 0.09;
    return {
      key: `pulse-${index}`,
      angle,
      radial,
      y: ((index % 7) - 3) * 0.12,
      size: 0.03 + (index % 4) * 0.01,
      speed: 0.65 + (index % 8) * 0.08,
    };
  });
}

function buildTelemetryColumns(metricStreams = []) {
  return metricStreams.map((metric, index) => {
    const side = index < 3 ? -1 : 1;
    const order = index % 3;
    return {
      ...metric,
      key: `telemetry-${metric.key}`,
      position: [side * (5.9 + order * 0.8), -3.15 + order * 0.92, -1.8 - order * 0.35],
      rotation: [0, side < 0 ? 0.3 : -0.3, 0],
      scaleX: 0.05 + metric.intensity * 0.05,
      scaleZ: 0.05 + metric.intensity * 0.035,
    };
  });
}

function SegmentedRing({ radius, tube, color, opacity, rotation, segmentCount = 6, gapRatio = 0.18 }) {
  const arc = ((Math.PI * 2) / segmentCount) * (1 - gapRatio);
  return (
    <group rotation={rotation}>
      {Array.from({ length: segmentCount }, (_, index) => (
        <mesh key={`${radius}-${index}`} rotation={[0, 0, (Math.PI * 2 * index) / segmentCount]}>
          <torusGeometry args={[radius, tube, 18, 80, arc]} />
          <meshBasicMaterial color={color} transparent opacity={opacity} />
        </mesh>
      ))}
    </group>
  );
}

function BridgeBeam({ start, end, color, opacity = 0.2, thickness = 0.045 }) {
  const startVector = useMemo(() => new THREE.Vector3(...start), [start]);
  const endVector = useMemo(() => new THREE.Vector3(...end), [end]);
  const direction = useMemo(() => endVector.clone().sub(startVector), [endVector, startVector]);
  const length = direction.length();
  const midpoint = useMemo(() => startVector.clone().add(endVector).multiplyScalar(0.5), [endVector, startVector]);
  const quaternion = useMemo(() => {
    const axis = new THREE.Vector3(0, 1, 0);
    return new THREE.Quaternion().setFromUnitVectors(axis, direction.clone().normalize());
  }, [direction]);

  return (
    <mesh position={midpoint.toArray()} quaternion={quaternion}>
      <boxGeometry args={[thickness, Math.max(0.001, length), thickness]} />
      <meshStandardMaterial
        color={color}
        emissive={color}
        emissiveIntensity={0.08}
        roughness={0.24}
        metalness={0.22}
        transparent
        opacity={opacity}
      />
    </mesh>
  );
}

function buildGovernanceClamps() {
  return [
    { key: "clamp-top", angleDeg: -90, mountRadiusX: 0.45, mountRadiusY: 0.45, y: 0.12, inwardOffset: [0, -1, 0] },
    { key: "clamp-right", angleDeg: 0, mountRadiusX: 0.45, mountRadiusY: 0.45, y: 0.12, inwardOffset: [-1, 0, 0] },
    { key: "clamp-bottom", angleDeg: 90, mountRadiusX: 0.45, mountRadiusY: 0.45, y: 0.12, inwardOffset: [0, 1, 0] },
    { key: "clamp-left", angleDeg: 180, mountRadiusX: 0.45, mountRadiusY: 0.45, y: 0.12, inwardOffset: [1, 0, 0] },
  ];
}

function RitualChamberScene({
  visualModel,
  entryDiveActive = false,
  entryDurationMs = 760,
  astrolabeRotation = 0,
  onSelectConstitution = () => {},
}) {
  const rootRef = useRef(null);
  const coreShellRef = useRef(null);
  const coreInnerRef = useRef(null);
  const astrolabeRefs = useRef([]);
  const lockNodesRef = useRef([]);
  const pulseCloudRef = useRef(null);
  const telemetryRefs = useRef([]);
  const diveRef = useRef(null);
  const diveProgressRef = useRef(entryDiveActive ? 0 : 1);
  const previousEntryStateRef = useRef(false);
  const cameraTargetRef = useRef(new THREE.Vector3());
  const lookTargetRef = useRef(new THREE.Vector3());

  const diveLayers = useMemo(() => buildDiveLayers(), []);
  const crystalPillars = useMemo(() => buildCrystalPillars(), []);
  const frameBeams = useMemo(() => buildFrameBeams(), []);
  const backdropLattice = useMemo(() => buildBackdropLattice(), []);
  const portalFrames = useMemo(() => buildPortalFrames(), []);
  const wallFacets = useMemo(() => buildWallFacets(), []);
  const innerSpines = useMemo(() => buildInnerSpines(), []);
  const governanceClamps = useMemo(() => buildGovernanceClamps(), []);
  const pulseCloud = useMemo(() => buildPulseCloud(visualModel.eventSwarmCount), [visualModel.eventSwarmCount]);
  const telemetryColumns = useMemo(() => buildTelemetryColumns(visualModel.metricStreams), [visualModel.metricStreams]);

  const tonePrimary = useMemo(
    () => toThreeColor(visualModel.theme.tonePrimary, "#7ee8ff"),
    [visualModel.theme.tonePrimary]
  );
  const toneSecondary = useMemo(
    () => toThreeColor(visualModel.theme.toneSecondary, "#82ffd4"),
    [visualModel.theme.toneSecondary]
  );
  const toneAccent = useMemo(
    () => toThreeColor(visualModel.theme.toneAccent, "#ffd38e"),
    [visualModel.theme.toneAccent]
  );

  useFrame((state, delta) => {
    const elapsed = state.clock.elapsedTime;
    const entryDurationSec = Math.max(0.2, (Number(entryDurationMs) || 760) / 1000);
    const entering = Boolean(entryDiveActive);

    if (entering && !previousEntryStateRef.current) {
      diveProgressRef.current = 0;
      state.camera.position.copy(CAMERA_ENTRY_START);
      state.camera.fov = 30;
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
    state.camera.position.lerp(cameraTargetRef.current, entering ? 0.22 : 0.08);
    const targetFov = THREE.MathUtils.lerp(30, 38, diveProgress);
    state.camera.fov = THREE.MathUtils.lerp(state.camera.fov, targetFov, 0.14);
    state.camera.lookAt(lookTargetRef.current);
    state.camera.updateProjectionMatrix();

    if (rootRef.current) {
      rootRef.current.rotation.y = Math.sin(elapsed * 0.18) * 0.05 + astrolabeRotation * 0.08;
      rootRef.current.rotation.x = Math.sin(elapsed * 0.12) * 0.012;
    }

    if (coreShellRef.current) {
      coreShellRef.current.rotation.y += delta * (0.18 + visualModel.pulseStrength * 0.26);
      coreShellRef.current.rotation.z += delta * 0.06;
      const scale = 1 + Math.sin(elapsed * visualModel.chamberPulseSpeed) * (0.028 + visualModel.pulseStrength * 0.05);
      coreShellRef.current.scale.set(
        CORE_SHELL_BASE_SCALE.x * scale,
        CORE_SHELL_BASE_SCALE.y * scale,
        CORE_SHELL_BASE_SCALE.z * scale
      );
    }
    if (coreInnerRef.current) {
      coreInnerRef.current.rotation.y -= delta * (0.3 + visualModel.runtimeTempo * 0.35);
      const scale = 0.92 + Math.sin(elapsed * visualModel.chamberPulseSpeed * 1.3) * 0.05;
      coreInnerRef.current.scale.set(
        CORE_INNER_BASE_SCALE.x * scale,
        CORE_INNER_BASE_SCALE.y * scale,
        CORE_INNER_BASE_SCALE.z * scale
      );
    }

    astrolabeRefs.current.forEach((ringRef, index) => {
      if (!ringRef) return;
      const ring = visualModel.astrolabeRings[index];
      if (!ring) return;
      ringRef.rotation.z += delta * ring.speed;
      ringRef.rotation.y = ring.tilt[1] + astrolabeRotation * 0.55;
      ringRef.position.z = -0.45 - visualModel.governanceLockStrength * 0.08;
    });

    lockNodesRef.current.forEach((nodeRef, index) => {
      if (!nodeRef) return;
      nodeRef.rotation.y += delta * (0.3 + index * 0.05);
      nodeRef.position.y =
        0.12 +
        Math.sin(elapsed * 0.9 + index) * (0.08 - visualModel.governanceLockStrength * 0.03) -
        visualModel.governanceLockStrength * 0.12;
    });

    if (pulseCloudRef.current) {
      pulseCloudRef.current.children.forEach((node, index) => {
        const particle = pulseCloud[index];
        if (!particle) return;
        const orbitRadius = particle.radial + Math.sin(elapsed * particle.speed + index) * 0.08;
        node.position.x = Math.cos(elapsed * particle.speed + particle.angle) * orbitRadius;
        node.position.z = Math.sin(elapsed * particle.speed + particle.angle) * orbitRadius;
        node.position.y = particle.y + Math.sin(elapsed * particle.speed * 0.7 + index) * 0.06;
      });
    }

    telemetryRefs.current.forEach((columnRef, index) => {
      if (!columnRef) return;
      const column = telemetryColumns[index];
      if (!column) return;
      columnRef.scale.y = 0.7 + column.intensity * 2 + Math.sin(elapsed * (0.8 + index * 0.1)) * 0.08;
    });

    if (diveRef.current) {
      const diveEnergy = 1 - diveProgress;
      diveRef.current.visible = entering && diveEnergy > 0.03;
      diveRef.current.children.forEach((layerMesh, index) => {
        const layer = diveLayers[index];
        if (!layer) return;
        layerMesh.position.z = ((elapsed * layer.speed + layer.zOffset) % 7.4) - 3.7;
        layerMesh.scale.setScalar(1 + diveEnergy * 0.8);
        if (layerMesh.material && typeof layerMesh.material === "object" && "opacity" in layerMesh.material) {
          layerMesh.material.opacity = 0.07 + diveEnergy * (0.16 + index * 0.015);
        }
      });
    }
  });

  return (
    <>
      <color attach="background" args={["#010612"]} />
      <fog attach="fog" args={["#010612", 12, 34]} />
      <ambientLight intensity={0.18 + visualModel.chamberDepth * 0.12} />
      <pointLight position={[0, 4.2, 3.8]} intensity={3.1 + visualModel.pulseStrength * 1.8} color={toneSecondary} />
      <pointLight position={[0, -2.2, 2.4]} intensity={1.4 + visualModel.runtimeTempo * 1.2} color={tonePrimary} />
      <pointLight position={[-6.4, 1.6, -0.8]} intensity={1.1 + visualModel.domainDensity * 1.1} color={toneAccent} />
      <pointLight position={[6.4, 1.6, -0.6]} intensity={1 + visualModel.planetActivity * 1.1} color={tonePrimary} />

      <group ref={diveRef}>
        {diveLayers.map((layer) => (
          <mesh key={layer.key} position={[0, 0, layer.zOffset]} rotation={[Math.PI / 2, layer.twist, 0]}>
            <torusGeometry args={[layer.radius, layer.tube, 16, 96]} />
            <meshBasicMaterial color={tonePrimary} transparent opacity={0.15} />
          </mesh>
        ))}
      </group>

      <group ref={rootRef} position={[0, 0, -0.4]}>
        <mesh position={[0, 0.1, -9]}>
          <planeGeometry args={[28, 18]} />
          <meshBasicMaterial color="#050c1b" transparent opacity={0.66} />
        </mesh>

        <mesh position={[0, 0.25, -5.2]}>
          <planeGeometry args={[14, 10]} />
          <meshBasicMaterial color={toneSecondary} transparent opacity={0.035 + visualModel.pulseStrength * 0.03} />
        </mesh>

        {backdropLattice.map((ring) => (
          <mesh key={ring.key} position={[0, 0, -8.7]}>
            <ringGeometry args={[ring.radius - 0.03, ring.radius, 128]} />
            <meshBasicMaterial color={tonePrimary} transparent opacity={ring.opacity} side={THREE.DoubleSide} />
          </mesh>
        ))}

        {Array.from({ length: 5 }, (_, index) => {
          const offset = -3.6 + index * 1.8;
          return (
            <group key={`grid-${index}`}>
              <mesh position={[offset, 0, -8.6]}>
                <boxGeometry args={[0.02, 14, 0.02]} />
                <meshBasicMaterial color={tonePrimary} transparent opacity={0.018} />
              </mesh>
              <mesh position={[0, offset * 0.7, -8.6]}>
                <boxGeometry args={[18, 0.02, 0.02]} />
                <meshBasicMaterial color={tonePrimary} transparent opacity={0.018} />
              </mesh>
            </group>
          );
        })}

        {portalFrames.map((beam) => (
          <mesh key={beam.key} position={beam.position} scale={beam.scale}>
            <boxGeometry args={[1, 1, 1]} />
            <meshStandardMaterial
              color={tonePrimary}
              emissive={toneSecondary}
              emissiveIntensity={0.1}
              roughness={0.22}
              metalness={0.26}
              transparent
              opacity={0.34}
            />
          </mesh>
        ))}

        {wallFacets.map((facet) => (
          <mesh key={facet.key} position={facet.position} rotation={facet.rotation} scale={facet.scale}>
            <octahedronGeometry args={[1, 0]} />
            <meshStandardMaterial
              color={toneSecondary}
              emissive={toneSecondary}
              emissiveIntensity={0.14}
              roughness={0.2}
              metalness={0.18}
              transparent
              opacity={0.18}
            />
          </mesh>
        ))}

        {innerSpines.map((spine) => (
          <mesh key={spine.key} position={spine.position} scale={spine.scale}>
            <boxGeometry args={[1, 1, 1]} />
            <meshStandardMaterial
              color={tonePrimary}
              emissive={toneSecondary}
              emissiveIntensity={0.08}
              roughness={0.22}
              metalness={0.18}
              transparent
              opacity={0.26}
            />
          </mesh>
        ))}

        {crystalPillars.map((pillar) => (
          <group key={pillar.key} position={pillar.position} rotation={pillar.rotation}>
            <mesh scale={pillar.scale}>
              <octahedronGeometry args={[1, 0]} />
              <meshStandardMaterial
                color={tonePrimary}
                emissive={toneSecondary}
                emissiveIntensity={0.08}
                roughness={0.34}
                metalness={0.18}
                transparent
                opacity={0.18}
              />
            </mesh>
            <mesh position={[0, pillar.scale[1] * 0.16, 0]} scale={[pillar.scale[0] * 0.4, 1.1, pillar.scale[2] * 0.4]}>
              <octahedronGeometry args={[1, 0]} />
              <meshStandardMaterial
                color={toneSecondary}
                emissive={toneSecondary}
                emissiveIntensity={0.12}
                roughness={0.18}
                transparent
                opacity={0.22}
              />
            </mesh>
          </group>
        ))}

        {frameBeams.map((beam) => (
          <mesh key={beam.key} position={beam.position} rotation={beam.rotation} scale={beam.scale}>
            <boxGeometry args={[1, 1, 1]} />
            <meshStandardMaterial
              color={tonePrimary}
              emissive={toneSecondary}
              emissiveIntensity={0.05}
              roughness={0.34}
              metalness={0.14}
              transparent
              opacity={0.28}
            />
          </mesh>
        ))}

        <mesh position={[0, 5.45, -1.1]} rotation={[0, 0, Math.PI / 4]} scale={[0.54, 0.84, 0.54]}>
          <octahedronGeometry args={[1, 0]} />
          <meshStandardMaterial
            color={toneSecondary}
            emissive={toneSecondary}
            emissiveIntensity={0.22}
            roughness={0.2}
            metalness={0.14}
            transparent
            opacity={0.48}
          />
        </mesh>

        <mesh position={[0, 3.65, -1.2]} scale={[0.22, 3.1, 0.22]}>
          <cylinderGeometry args={[0.45, 0.18, 1, 10]} />
          <meshBasicMaterial color={toneSecondary} transparent opacity={0.11 + visualModel.pulseStrength * 0.05} />
        </mesh>

        <mesh position={[0, -5.35, -0.1]} scale={[2.4, 0.12, 1.8]}>
          <cylinderGeometry args={[1, 1.2, 1, 8]} />
          <meshStandardMaterial
            color={tonePrimary}
            emissive={tonePrimary}
            emissiveIntensity={0.05}
            roughness={0.42}
            metalness={0.14}
            transparent
            opacity={0.3}
          />
        </mesh>

        <mesh position={[0, -3.95, -0.4]} scale={[0.38, 2.2, 0.38]}>
          <octahedronGeometry args={[0.9, 0]} />
          <meshStandardMaterial
            color={tonePrimary}
            emissive={toneSecondary}
            emissiveIntensity={0.12}
            roughness={0.22}
            metalness={0.14}
            transparent
            opacity={0.22}
          />
        </mesh>

        <group>
          <mesh ref={coreShellRef} position={[0, 0.15, -0.15]} scale={CORE_SHELL_BASE_SCALE.toArray()}>
            <octahedronGeometry args={[1.1, 1]} />
            <meshStandardMaterial
              color={tonePrimary}
              emissive={toneSecondary}
              emissiveIntensity={0.24 + visualModel.pulseStrength * 0.16}
              roughness={0.3}
              metalness={0.12}
              transparent
              opacity={0.52}
            />
          </mesh>
          <mesh ref={coreInnerRef} position={[0, 0.15, -0.15]} scale={CORE_INNER_BASE_SCALE.toArray()}>
            <icosahedronGeometry args={[1, 3]} />
            <meshStandardMaterial
              color={toneAccent}
              emissive={toneAccent}
              emissiveIntensity={0.42 + visualModel.runtimeTempo * 0.2}
              roughness={0.16}
              metalness={0.08}
              transparent
              opacity={0.56}
            />
          </mesh>
          <mesh position={[0, 0.15, -0.15]} scale={CORE_HALO_BASE_SCALE.toArray()}>
            <sphereGeometry args={[0.6, 24, 24]} />
            <meshBasicMaterial color={toneSecondary} transparent opacity={0.025 + visualModel.pulseStrength * 0.03} />
          </mesh>
        </group>

        {visualModel.astrolabeRings.map((ring, index) => (
          <group
            key={ring.key}
            ref={(instance) => {
              astrolabeRefs.current[index] = instance;
            }}
            position={[0, 0.08, -0.45]}
            rotation={ring.tilt}
          >
            <SegmentedRing
              radius={ring.radius}
              tube={ring.tube}
              color={index === 0 ? toneAccent : tonePrimary}
              opacity={ring.opacity * 0.72}
              rotation={[0, 0, 0]}
              segmentCount={index === 0 ? 8 : 6}
              gapRatio={index === 0 ? 0.22 : 0.18}
            />
          </group>
        ))}

        {governanceClamps.map((clamp) => {
          const theta = (clamp.angleDeg * Math.PI) / 180;
          const radialX = 4.75 - visualModel.governanceLockStrength * 0.7;
          const radialY = 3.72 - visualModel.governanceLockStrength * 0.48;
          const position = polarVector(clamp.angleDeg, radialX, radialY, clamp.y);
          const clampDepth = 1.18 + visualModel.governanceLockStrength * 0.82;
          return (
            <group key={clamp.key} position={position.toArray()} rotation={[0, theta - Math.PI / 2, 0]}>
              <mesh position={[0, 0, -clampDepth * 0.4]} scale={[0.12, 0.12, clampDepth]}>
                <boxGeometry args={[1, 1, 1]} />
                <meshStandardMaterial
                  color={tonePrimary}
                  emissive={toneSecondary}
                  emissiveIntensity={0.08}
                  roughness={0.24}
                  metalness={0.24}
                  transparent
                  opacity={0.34}
                />
              </mesh>
              <mesh
                position={[0, 0, -clampDepth * 0.94]}
                rotation={[Math.PI / 4, 0, Math.PI / 4]}
                scale={[0.22, 0.22, 0.22]}
              >
                <boxGeometry args={[1, 1, 1]} />
                <meshStandardMaterial
                  color={toneAccent}
                  emissive={toneAccent}
                  emissiveIntensity={0.18 + visualModel.governanceLockStrength * 0.18}
                  roughness={0.16}
                  metalness={0.28}
                  transparent
                  opacity={0.58}
                />
              </mesh>
            </group>
          );
        })}

        {visualModel.showLockRing
          ? Array.from({ length: 4 }, (_, index) => {
              const angleDeg = index * 90 + 45;
              const position = polarVector(angleDeg, 4.35, 4.35, 0.12);
              return (
                <group
                  key={`lock-node-${index}`}
                  ref={(instance) => {
                    lockNodesRef.current[index] = instance;
                  }}
                  position={position}
                >
                  <mesh rotation={[Math.PI / 4, 0, Math.PI / 4]}>
                    <boxGeometry args={[0.22, 0.22, 0.22]} />
                    <meshStandardMaterial
                      color={toneAccent}
                      emissive={toneAccent}
                      emissiveIntensity={0.28}
                      roughness={0.18}
                      metalness={0.26}
                    />
                  </mesh>
                </group>
              );
            })
          : null}

        {visualModel.showFirstOrbit ? (
          <SegmentedRing
            radius={5.85}
            tube={0.028}
            color={toneSecondary}
            opacity={0.34}
            rotation={[1.22, 0.18, 0.08]}
            segmentCount={7}
            gapRatio={0.2}
          />
        ) : null}

        <group ref={pulseCloudRef}>
          {pulseCloud.map((particle) => (
            <mesh key={particle.key} position={[0, particle.y, 0]}>
              <sphereGeometry args={[particle.size, 8, 8]} />
              <meshBasicMaterial color={tonePrimary} transparent opacity={visualModel.eventHaloOpacity} />
            </mesh>
          ))}
        </group>

        {visualModel.constitutionGlyphs.map((glyph) => {
          const position = polarVector(glyph.angleDeg, 3.6, 2.9, 0.08);
          const anchor = polarVector(glyph.angleDeg, 2.42, 1.98, 0.08);
          const glyphColor = glyph.selected ? glyph.toneSecondary : glyph.tonePrimary;
          return (
            <group key={glyph.id}>
              <BridgeBeam
                start={anchor.toArray()}
                end={position.toArray()}
                color={glyph.selected ? glyph.toneSecondary : glyph.tonePrimary}
                opacity={glyph.selected ? 0.32 : 0.16}
                thickness={glyph.selected ? 0.06 : 0.04}
              />
              <mesh position={anchor.toArray()} scale={[0.14, 0.14, 0.14]}>
                <octahedronGeometry args={[1, 0]} />
                <meshStandardMaterial
                  color={glyphColor}
                  emissive={glyphColor}
                  emissiveIntensity={glyph.selected ? 0.28 : 0.12}
                  roughness={0.18}
                  metalness={0.22}
                  transparent
                  opacity={glyph.selected ? 0.72 : 0.34}
                />
              </mesh>
              <mesh
                position={position.toArray()}
                onPointerDown={(event) => {
                  event.stopPropagation();
                  onSelectConstitution(glyph.id);
                }}
                scale={glyph.selected ? 1.26 : 1}
              >
                <octahedronGeometry args={[0.16, 0]} />
                <meshStandardMaterial
                  color={glyphColor}
                  emissive={glyphColor}
                  emissiveIntensity={glyph.selected ? 0.52 : 0.2}
                  roughness={0.16}
                  metalness={0.18}
                  transparent
                  opacity={glyph.selected ? 0.7 : 0.42}
                />
              </mesh>
            </group>
          );
        })}

        {telemetryColumns.map((column, index) => (
          <group key={column.key} position={column.position} rotation={column.rotation}>
            <mesh
              ref={(instance) => {
                telemetryRefs.current[index] = instance;
              }}
              scale={[column.scaleX, 1.1 + column.intensity * 1.8, column.scaleZ]}
            >
              <boxGeometry args={[1, 1, 1]} />
              <meshBasicMaterial
                color={index < 3 ? toneAccent : tonePrimary}
                transparent
                opacity={0.1 + column.intensity * 0.14}
              />
            </mesh>
            <mesh position={[0, 0.7, 0]} scale={[column.scaleX * 2.2, 0.08, column.scaleZ * 2.2]}>
              <boxGeometry args={[1, 1, 1]} />
              <meshBasicMaterial color={toneSecondary} transparent opacity={0.12 + column.intensity * 0.12} />
            </mesh>
          </group>
        ))}
      </group>
    </>
  );
}

export default function StarCoreInteriorScene3d({
  visualModel,
  screenModel = null,
  astrolabeRotation = 0,
  onSelectConstitution = () => {},
}) {
  const canUseWebGL = typeof window !== "undefined" && typeof window.WebGLRenderingContext !== "undefined";
  if (!canUseWebGL) {
    return <div data-testid="ritual-3d-fallback" style={{ position: "absolute", inset: 0 }} />;
  }

  const entryDiveActive = Boolean(screenModel?.isEntering);
  const entryDurationMs = Number(screenModel?.transitionDurationMs) || 760;

  return (
    <Canvas camera={{ position: [0, 0.7, 10.8], fov: 38, near: 0.1, far: 120 }} dpr={[1, 1.7]} gl={{ antialias: true }}>
      <RitualChamberScene
        visualModel={visualModel}
        entryDiveActive={entryDiveActive}
        entryDurationMs={entryDurationMs}
        astrolabeRotation={astrolabeRotation}
        onSelectConstitution={onSelectConstitution}
      />
    </Canvas>
  );
}
