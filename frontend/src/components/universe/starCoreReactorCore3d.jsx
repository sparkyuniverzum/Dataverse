import { MeshTransmissionMaterial, Sparkles } from "@react-three/drei";
import { useFrame } from "@react-three/fiber";
import { useMemo, useRef } from "react";
import * as THREE from "three";

const OUTER_SHELL_SCALE = new THREE.Vector3(1.42, 1.88, 1.42);
const INNER_CORE_SCALE = new THREE.Vector3(0.92, 1.24, 0.92);
const HALO_SCALE = new THREE.Vector3(2.4, 2.9, 2.4);

function mixColors(a, b, ratio) {
  return a.clone().lerp(b.clone(), Math.max(0, Math.min(1, Number(ratio) || 0)));
}

function buildOrbitShards() {
  return [
    { key: "shard-0", radius: 1.94, height: 0.44, speed: 0.34, phase: 0.1, scale: [0.24, 0.62, 0.18] },
    { key: "shard-1", radius: 2.08, height: -0.5, speed: 0.28, phase: 1.7, scale: [0.18, 0.46, 0.16] },
    { key: "shard-2", radius: 1.76, height: 0.06, speed: 0.39, phase: 3.1, scale: [0.16, 0.36, 0.14] },
    { key: "shard-3", radius: 2.22, height: -0.1, speed: 0.24, phase: 4.5, scale: [0.14, 0.32, 0.12] },
  ];
}

export default function StarCoreReactorCore3d({
  tonePrimary,
  toneSecondary,
  toneAccent,
  pulseStrength = 0,
  runtimeTempo = 0,
  chamberPulseSpeed = 1,
  chaosIntensity = 0.5,
  stability = 0.5,
}) {
  const clusterRef = useRef(null);
  const shellRef = useRef(null);
  const shellGhostRef = useRef(null);
  const coreRef = useRef(null);
  const haloRef = useRef(null);
  const orbitShardRefs = useRef([]);

  const shellColor = useMemo(() => mixColors(tonePrimary, toneSecondary, 0.3), [tonePrimary, toneSecondary]);
  const shellGhostColor = useMemo(() => mixColors(tonePrimary, toneSecondary, 0.64), [tonePrimary, toneSecondary]);
  const coreColor = useMemo(() => mixColors(toneAccent, toneSecondary, 0.18), [toneAccent, toneSecondary]);
  const orbitShards = useMemo(() => buildOrbitShards(), []);

  useFrame((state, delta) => {
    const elapsed = state.clock.elapsedTime;
    const slowPulse = Math.sin(elapsed * chamberPulseSpeed * (0.8 + chaosIntensity * 0.28));
    const fastPulse = Math.sin(elapsed * (1.2 + runtimeTempo * 0.36 + chaosIntensity * 0.72));
    const orderWeight = 0.3 + stability * 0.7;

    if (clusterRef.current) {
      clusterRef.current.rotation.y = elapsed * (0.06 + chaosIntensity * 0.08);
      clusterRef.current.rotation.x = Math.sin(elapsed * 0.14) * chaosIntensity * 0.08;
      clusterRef.current.position.y = Math.sin(elapsed * 0.42) * (0.03 + chaosIntensity * 0.08);
    }

    if (shellRef.current) {
      shellRef.current.rotation.y += delta * (0.12 + chaosIntensity * 0.16);
      shellRef.current.rotation.z += delta * (0.03 + chaosIntensity * 0.08);
      const scalar = 1 + slowPulse * (0.05 + chaosIntensity * 0.08);
      shellRef.current.scale.set(
        OUTER_SHELL_SCALE.x * scalar,
        OUTER_SHELL_SCALE.y * (1 + slowPulse * (0.08 + chaosIntensity * 0.12)),
        OUTER_SHELL_SCALE.z * scalar
      );
    }

    if (shellGhostRef.current) {
      shellGhostRef.current.rotation.y -= delta * (0.08 + runtimeTempo * 0.08);
      shellGhostRef.current.rotation.x += delta * (0.02 + chaosIntensity * 0.06);
      const scalar = 1 + fastPulse * (0.04 + chaosIntensity * 0.06);
      shellGhostRef.current.scale.set(
        (OUTER_SHELL_SCALE.x + 0.34) * scalar,
        (OUTER_SHELL_SCALE.y + 0.46) * (1 + fastPulse * (0.04 + chaosIntensity * 0.04)),
        (OUTER_SHELL_SCALE.z + 0.34) * scalar
      );
    }

    if (coreRef.current) {
      coreRef.current.rotation.y += delta * (0.2 + runtimeTempo * 0.14);
      coreRef.current.rotation.x = Math.sin(elapsed * 0.24) * (0.08 + chaosIntensity * 0.16);
      const scalar = 1 + fastPulse * (0.05 + chaosIntensity * 0.07) + pulseStrength * 0.03;
      coreRef.current.scale.set(
        INNER_CORE_SCALE.x * scalar,
        INNER_CORE_SCALE.y * (1 + fastPulse * (0.06 + chaosIntensity * 0.08)),
        INNER_CORE_SCALE.z * scalar
      );
    }

    if (haloRef.current) {
      const scalar = 1 + slowPulse * 0.04 + stability * 0.02;
      haloRef.current.scale.set(HALO_SCALE.x * scalar, HALO_SCALE.y * scalar, HALO_SCALE.z * scalar);
    }

    orbitShardRefs.current.forEach((node, index) => {
      const shard = orbitShards[index];
      if (!node || !shard) return;
      const theta = elapsed * shard.speed * (0.6 + chaosIntensity * 1.2) + shard.phase;
      node.position.x = Math.cos(theta) * (shard.radius - stability * 0.14);
      node.position.z = Math.sin(theta) * shard.radius * (0.26 + chaosIntensity * 0.28);
      node.position.y = shard.height + Math.sin(theta * 1.2) * (0.08 + chaosIntensity * 0.14);
      node.rotation.x += delta * (0.2 + chaosIntensity * 0.32);
      node.rotation.y += delta * (0.18 + orderWeight * 0.12);
    });
  });

  return (
    <group ref={clusterRef}>
      <pointLight
        position={[0, 0.2, 1.2]}
        intensity={1.6 + pulseStrength * 0.8 + chaosIntensity * 0.4}
        color={toneSecondary}
        distance={11}
      />
      <pointLight
        position={[0, -0.4, 0.8]}
        intensity={0.9 + runtimeTempo * 0.5 + stability * 0.6}
        color={toneAccent}
        distance={8}
      />

      <mesh ref={haloRef} position={[0, 0.06, -0.1]}>
        <sphereGeometry args={[1.02, 32, 32]} />
        <meshBasicMaterial color={toneSecondary} transparent opacity={0.08 + stability * 0.06} />
      </mesh>

      <mesh ref={shellGhostRef} position={[0, 0.08, -0.12]}>
        <icosahedronGeometry args={[1.24, 3]} />
        <MeshTransmissionMaterial
          color={shellGhostColor}
          backside
          thickness={0.92}
          roughness={0.24}
          transmission={0.96}
          ior={1.08}
          chromaticAberration={0.014}
          anisotropy={0.14}
          distortion={0.05 + chaosIntensity * 0.08}
          distortionScale={0.22 + chaosIntensity * 0.16}
          temporalDistortion={0.04 + chaosIntensity * 0.1}
          attenuationDistance={1}
          attenuationColor={toneSecondary}
          transparent
          opacity={0.42}
        />
      </mesh>

      <mesh ref={shellRef} position={[0, 0.06, -0.08]}>
        <icosahedronGeometry args={[1.06, 5]} />
        <MeshTransmissionMaterial
          color={shellColor}
          backside
          thickness={1.24}
          roughness={0.16}
          transmission={1}
          ior={1.04}
          chromaticAberration={0.018}
          anisotropy={0.2}
          distortion={0.08 + chaosIntensity * 0.12}
          distortionScale={0.3 + chaosIntensity * 0.2}
          temporalDistortion={0.08 + chaosIntensity * 0.12}
          attenuationDistance={0.7}
          attenuationColor={toneSecondary}
        />
      </mesh>

      <mesh ref={coreRef} position={[0, 0.08, -0.04]}>
        <icosahedronGeometry args={[0.86, 4]} />
        <meshStandardMaterial
          color={coreColor}
          emissive={toneAccent}
          emissiveIntensity={0.9 + runtimeTempo * 0.2 + stability * 0.18}
          roughness={0.08}
          metalness={0.04}
          transparent
          opacity={0.96}
        />
      </mesh>

      <mesh position={[0, 0.06, -0.22]} scale={[0.18, 3.2, 0.18]}>
        <cylinderGeometry args={[0.26, 0.06, 1, 16]} />
        <meshBasicMaterial color={toneSecondary} transparent opacity={0.12 + stability * 0.08} />
      </mesh>

      {orbitShards.map((shard, index) => (
        <mesh
          key={shard.key}
          ref={(instance) => {
            orbitShardRefs.current[index] = instance;
          }}
          scale={shard.scale}
        >
          <octahedronGeometry args={[1, 0]} />
          <meshStandardMaterial
            color={index % 2 === 0 ? toneSecondary : toneAccent}
            emissive={index % 2 === 0 ? toneSecondary : toneAccent}
            emissiveIntensity={0.36 + stability * 0.22}
            roughness={0.1}
            metalness={0.16}
            transparent
            opacity={0.72}
          />
        </mesh>
      ))}

      <Sparkles
        count={chaosIntensity > 0.4 ? 20 : 12}
        scale={[3.6, 4.4, 3]}
        size={3}
        speed={0.12 + chaosIntensity * 0.16}
        opacity={0.22 + chaosIntensity * 0.2}
        color={shellGhostColor}
        noise={0.32}
      />
      <Sparkles
        count={stability > 0.7 ? 8 : 5}
        scale={[1.6, 2.4, 1.6]}
        size={4}
        speed={0.08 + runtimeTempo * 0.08}
        opacity={0.26 + stability * 0.16}
        color={toneAccent}
        noise={0.12}
      />
    </group>
  );
}
