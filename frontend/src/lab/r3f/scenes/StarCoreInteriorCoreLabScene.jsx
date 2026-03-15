import { Stars } from "@react-three/drei";
import { useFrame } from "@react-three/fiber";
import { useMemo, useRef } from "react";
import * as THREE from "three";
import { mapInteriorToLabProps } from "../adapters/starCoreInteriorLabAdapter";

/**
 * R3F Lab Scéna: Interiér jádra hvězdy
 * Vizualizuje stav Governance procesu na základě presetu.
 */
export function StarCoreInteriorCoreLabScene({ sceneConfig, viewMode }) {
  const groupRef = useRef(null);
  const coreRef = useRef(null);

  // Transformace presetu přes adaptér
  const visuals = useMemo(() => mapInteriorToLabProps(sceneConfig), [sceneConfig]);

  useFrame((state, delta) => {
    if (!groupRef.current || !visuals) return;

    const time = state.clock.elapsedTime;
    const pulse = Math.sin(time * visuals.pulseRate) * 0.05 * visuals.intensity;

    // Rotace celého systému
    groupRef.current.rotation.y += delta * (viewMode === "performance_safe" ? 0.05 : 0.1);

    // Pulzování měřítka jádra
    if (coreRef.current) {
      const targetScale = visuals.scale + pulse;
      coreRef.current.scale.lerp(new THREE.Vector3(targetScale, targetScale, targetScale), 0.1);
    }
  });

  if (!visuals) return null;

  return (
    <>
      <ambientLight intensity={viewMode === "debug" ? 0.8 : 0.4} />
      <pointLight position={[0, 0, 0]} intensity={2.5 * visuals.intensity} color={visuals.accent} />
      <directionalLight position={[5, 5, 5]} intensity={0.5} />

      <Stars radius={50} depth={50} count={1000} factor={4} saturation={0} fade speed={1} />

      <group ref={groupRef}>
        {/* Hlavní energetické jádro (Reactor Core) */}
        <mesh ref={coreRef} castShadow receiveShadow>
          <sphereGeometry args={[1.2, 64, 64]} />
          <meshStandardMaterial
            color={visuals.accent}
            emissive={visuals.accent}
            emissiveIntensity={1.5 * visuals.intensity}
            roughness={0.1}
            metalness={0.8}
            transparent
            opacity={0.9}
          />
        </mesh>

        {/* Atmosférický prstenec (Governance Astrolabe placeholder) */}
        <mesh rotation={[Math.PI / 2, 0, 0]}>
          <torusGeometry args={[2.2, 0.05, 16, 100]} />
          <meshBasicMaterial color={visuals.atmosphere} transparent opacity={0.6} />
        </mesh>

        {/* Sekundární prstenec */}
        <mesh rotation={[Math.PI / 4, Math.PI / 4, 0]}>
          <torusGeometry args={[2.8, 0.02, 8, 100]} />
          <meshBasicMaterial color={visuals.accent} transparent opacity={0.3} />
        </mesh>
      </group>

      {/* Lab UI Debug pomocníci */}
      {viewMode === "debug" && (
        <>
          <gridHelper args={[20, 20, "#444", "#222"]} position={[0, -3, 0]} />
          <axesHelper args={[5]} />
        </>
      )}
    </>
  );
}
