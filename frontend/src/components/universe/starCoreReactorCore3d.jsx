import { useFrame } from "@react-three/fiber";
import { MeshTransmissionMaterial, Sparkles } from "@react-three/drei";
import { useMemo, useRef } from "react";
import * as THREE from "three";

const SHELL_BASE_SCALE = new THREE.Vector3(0.84, 2.18, 0.84);
const SEED_BASE_SCALE = new THREE.Vector3(0.24, 2.56, 0.24);
const HALO_BASE_SCALE = new THREE.Vector3(0.74, 2.94, 0.74);

function mixColors(a, b, ratio) {
  return a.clone().lerp(b.clone(), Math.max(0, Math.min(1, Number(ratio) || 0)));
}

function buildSatelliteShards() {
  return [
    { key: "sat-0", radius: 1.18, height: 0.56, speed: 0.64, phase: 0.2, scale: [0.14, 0.42, 0.14] },
    { key: "sat-1", radius: 1.26, height: -0.48, speed: 0.58, phase: 1.7, scale: [0.16, 0.34, 0.16] },
    { key: "sat-2", radius: 1.06, height: 0.08, speed: 0.72, phase: 3.3, scale: [0.12, 0.26, 0.12] },
    { key: "sat-3", radius: 1.36, height: -0.12, speed: 0.54, phase: 4.4, scale: [0.1, 0.22, 0.1] },
  ];
}

export default function StarCoreReactorCore3d({
  tonePrimary,
  toneSecondary,
  toneAccent,
  pulseStrength = 0,
  runtimeTempo = 0,
  chamberPulseSpeed = 1,
}) {
  const shellRef = useRef(null);
  const shellGhostRef = useRef(null);
  const seedRef = useRef(null);
  const haloRef = useRef(null);
  const satelliteRefs = useRef([]);
  const groupRef = useRef(null);

  const shellColor = useMemo(() => mixColors(tonePrimary, toneSecondary, 0.34), [tonePrimary, toneSecondary]);
  const shellGhostColor = useMemo(() => mixColors(tonePrimary, toneSecondary, 0.7), [tonePrimary, toneSecondary]);
  const seedColor = useMemo(() => mixColors(toneAccent, toneSecondary, 0.22), [toneAccent, toneSecondary]);
  const satelliteShards = useMemo(() => buildSatelliteShards(), []);

  useFrame((state, delta) => {
    const elapsed = state.clock.elapsedTime;
    const slowPulse = Math.sin(elapsed * chamberPulseSpeed);
    const fastPulse = Math.sin(elapsed * (chamberPulseSpeed * 1.6 + runtimeTempo * 0.32));

    if (groupRef.current) {
      groupRef.current.rotation.y = Math.sin(elapsed * 0.16) * 0.08;
      groupRef.current.rotation.x = Math.sin(elapsed * 0.11) * 0.03;
    }

    if (shellRef.current) {
      shellRef.current.rotation.y += delta * (0.18 + pulseStrength * 0.18);
      shellRef.current.rotation.z += delta * 0.08;
      const scale = 1 + slowPulse * (0.024 + pulseStrength * 0.04);
      shellRef.current.scale.set(
        SHELL_BASE_SCALE.x * scale,
        SHELL_BASE_SCALE.y * (1 + slowPulse * 0.04 + pulseStrength * 0.03),
        SHELL_BASE_SCALE.z * scale
      );
    }

    if (shellGhostRef.current) {
      shellGhostRef.current.rotation.y -= delta * (0.11 + pulseStrength * 0.1);
      shellGhostRef.current.rotation.x += delta * 0.06;
      const scale = 1 + fastPulse * 0.03;
      shellGhostRef.current.scale.set(
        (SHELL_BASE_SCALE.x + 0.18) * scale,
        (SHELL_BASE_SCALE.y + 0.22) * (1 + fastPulse * 0.02),
        (SHELL_BASE_SCALE.z + 0.18) * scale
      );
    }

    if (seedRef.current) {
      seedRef.current.rotation.y -= delta * (0.34 + runtimeTempo * 0.32);
      seedRef.current.rotation.z += delta * 0.12;
      const scale = 0.94 + fastPulse * 0.06 + pulseStrength * 0.02;
      seedRef.current.scale.set(SEED_BASE_SCALE.x * scale, SEED_BASE_SCALE.y * scale, SEED_BASE_SCALE.z * scale);
    }

    if (haloRef.current) {
      haloRef.current.scale.set(
        HALO_BASE_SCALE.x * (1 + slowPulse * 0.04),
        HALO_BASE_SCALE.y * (1 + slowPulse * 0.06),
        HALO_BASE_SCALE.z * (1 + slowPulse * 0.04)
      );
    }

    satelliteRefs.current.forEach((node, index) => {
      const shard = satelliteShards[index];
      if (!node || !shard) return;
      const theta = elapsed * shard.speed + shard.phase;
      node.position.x = Math.cos(theta) * shard.radius;
      node.position.z = Math.sin(theta) * shard.radius * 0.22 - 0.16;
      node.position.y = shard.height + Math.sin(theta * 1.4) * 0.12;
      node.rotation.x += delta * 0.7;
      node.rotation.y += delta * 0.55;
    });
  });

  return (
    <group ref={groupRef}>
      <pointLight position={[0, 0.4, 1.2]} intensity={2.4 + pulseStrength * 1.2} color={toneSecondary} distance={9} />
      <pointLight position={[0, -0.3, 0.9]} intensity={1.5 + runtimeTempo * 0.8} color={toneAccent} distance={7} />

      <mesh position={[0, 0.12, -0.24]} scale={[0.12, 4.2, 0.12]}>
        <cylinderGeometry args={[0.55, 0.16, 1, 18]} />
        <meshBasicMaterial color={toneSecondary} transparent opacity={0.14 + pulseStrength * 0.06} />
      </mesh>

      <mesh position={[0, 2.42, -0.28]} scale={[0.28, 0.78, 0.28]}>
        <octahedronGeometry args={[1, 0]} />
        <meshStandardMaterial
          color={shellGhostColor}
          emissive={toneSecondary}
          emissiveIntensity={0.28}
          roughness={0.16}
          metalness={0.08}
          transparent
          opacity={0.56}
        />
      </mesh>

      <mesh position={[0, -2.24, -0.28]} scale={[0.28, 0.96, 0.28]}>
        <octahedronGeometry args={[1, 0]} />
        <meshStandardMaterial
          color={shellGhostColor}
          emissive={tonePrimary}
          emissiveIntensity={0.24}
          roughness={0.16}
          metalness={0.08}
          transparent
          opacity={0.48}
        />
      </mesh>

      <mesh ref={shellGhostRef} position={[0, 0.12, -0.28]}>
        <octahedronGeometry args={[1.04, 2]} />
        <MeshTransmissionMaterial
          color={shellGhostColor}
          backside
          thickness={0.88}
          roughness={0.22}
          transmission={0.96}
          ior={1.12}
          chromaticAberration={0.02}
          anisotropy={0.18}
          distortion={0.08}
          distortionScale={0.2}
          temporalDistortion={0.1}
          attenuationDistance={0.9}
          attenuationColor={toneSecondary}
          transparent
          opacity={0.44}
        />
      </mesh>

      <mesh ref={shellRef} position={[0, 0.12, -0.2]}>
        <octahedronGeometry args={[1, 2]} />
        <MeshTransmissionMaterial
          color={shellColor}
          backside
          thickness={1.1}
          roughness={0.18}
          transmission={1}
          ior={1.08}
          chromaticAberration={0.03}
          anisotropy={0.24}
          distortion={0.12}
          distortionScale={0.26}
          temporalDistortion={0.14}
          attenuationDistance={0.72}
          attenuationColor={toneSecondary}
        />
      </mesh>

      <mesh position={[0.32, 0.86, -0.06]} rotation={[0.2, 0.64, 0.28]} scale={[0.42, 0.94, 0.42]}>
        <octahedronGeometry args={[0.82, 0]} />
        <meshStandardMaterial
          color={shellGhostColor}
          emissive={toneSecondary}
          emissiveIntensity={0.42}
          roughness={0.12}
          metalness={0.08}
          transparent
          opacity={0.42}
        />
      </mesh>

      <mesh position={[-0.28, -0.92, -0.08]} rotation={[-0.26, 0.34, -0.22]} scale={[0.32, 0.82, 0.32]}>
        <octahedronGeometry args={[0.78, 0]} />
        <meshStandardMaterial
          color={shellGhostColor}
          emissive={tonePrimary}
          emissiveIntensity={0.3}
          roughness={0.12}
          metalness={0.08}
          transparent
          opacity={0.34}
        />
      </mesh>

      <mesh position={[0, 0.12, -0.16]} ref={haloRef}>
        <sphereGeometry args={[0.52, 32, 32]} />
        <meshBasicMaterial color={toneSecondary} transparent opacity={0.11 + pulseStrength * 0.06} />
      </mesh>

      <mesh ref={seedRef} position={[0, 0.12, -0.12]}>
        <icosahedronGeometry args={[1, 2]} />
        <meshStandardMaterial
          color={seedColor}
          emissive={toneAccent}
          emissiveIntensity={1.05 + runtimeTempo * 0.26}
          roughness={0.06}
          metalness={0.02}
          transparent
          opacity={0.94}
        />
      </mesh>

      {satelliteShards.map((shard, index) => (
        <mesh
          key={shard.key}
          ref={(instance) => {
            satelliteRefs.current[index] = instance;
          }}
          scale={shard.scale}
        >
          <octahedronGeometry args={[1, 0]} />
          <meshStandardMaterial
            color={index % 2 === 0 ? toneSecondary : toneAccent}
            emissive={index % 2 === 0 ? toneSecondary : toneAccent}
            emissiveIntensity={0.62}
            roughness={0.1}
            metalness={0.16}
            transparent
            opacity={0.78}
          />
        </mesh>
      ))}

      <Sparkles
        count={18}
        scale={[2.8, 4.6, 2.3]}
        size={3}
        speed={0.18 + pulseStrength * 0.08}
        opacity={0.54}
        color={shellGhostColor}
        noise={0.48}
      />
      <Sparkles
        count={9}
        scale={[1.6, 2.8, 1.4]}
        size={4}
        speed={0.24 + runtimeTempo * 0.1}
        opacity={0.62}
        color={toneAccent}
        noise={0.28}
      />
    </group>
  );
}
