import { useMemo, useRef } from "react";
import { useFrame } from "@react-three/fiber";
import { Billboard, Text } from "@react-three/drei";

import { clamp, createRng } from "./sceneMath";
import { signatureColorFromSeed } from "./sceneStyling";

const COMMAND_METEOR_HINTS = ["/grid", "/3d", "Ukaz : cil", "A + B", "A.pole := hodnota", ":help"];

const METEOR_CYCLE_SECONDS = 180;
const METEOR_SHOWER_SECONDS = 42;
const METEOR_FALL_SECONDS = 22;

export function CommandMeteors({ enabled = true, reducedMotion = false }) {
  const meteorRefs = useRef([]);
  const meteors = useMemo(
    () =>
      COMMAND_METEOR_HINTS.map((hint, index) => {
        const seed = createRng(`cmd-meteor:${hint}:${index}`);
        const slotWindow = Math.max(4, METEOR_SHOWER_SECONDS - METEOR_FALL_SECONDS - 2);
        return {
          hint,
          startOffset: (index / Math.max(1, COMMAND_METEOR_HINTS.length - 1)) * slotWindow + seed() * 2.4,
          phase: seed() * 99,
          baseX: (seed() - 0.5) * 320,
          baseZ: (seed() - 0.5) * 260,
          driftX: 10 + seed() * 26,
          driftZ: 9 + seed() * 24,
          startY: 128 + seed() * 18,
          endY: -74 - seed() * 16,
          tiltX: 0.2 + seed() * 0.5,
          tiltZ: (seed() - 0.5) * 0.56,
          size: 0.75 + seed() * 0.44,
          color: signatureColorFromSeed(`cmd-color:${hint}`).getStyle(),
        };
      }),
    []
  );

  useFrame((state, delta) => {
    if (!enabled || reducedMotion) return;
    const elapsed = state.clock.elapsedTime;
    const cycleT = elapsed % METEOR_CYCLE_SECONDS;
    const showerActive = cycleT < METEOR_SHOWER_SECONDS;

    meteors.forEach((meteor, index) => {
      const node = meteorRefs.current[index];
      if (!node) return;
      if (!showerActive) {
        node.visible = false;
        return;
      }

      const localT = cycleT - meteor.startOffset;
      if (localT < 0 || localT > METEOR_FALL_SECONDS) {
        node.visible = false;
        return;
      }

      node.visible = true;
      const progress = clamp(localT / METEOR_FALL_SECONDS, 0, 1);
      const x = meteor.baseX + Math.sin(elapsed * 0.22 + meteor.phase) * meteor.driftX;
      const z = meteor.baseZ + Math.cos(elapsed * 0.18 + meteor.phase) * meteor.driftZ;
      const y = meteor.startY + (meteor.endY - meteor.startY) * progress;
      node.position.set(x, y, z);
      node.rotation.x = meteor.tiltX;
      node.rotation.z = meteor.tiltZ;
      node.rotation.y += delta * 0.7;
    });
  });

  if (!enabled || reducedMotion) return null;

  return (
    <group>
      {meteors.map((meteor, index) => (
        <group
          key={`meteor:${meteor.hint}:${index}`}
          ref={(node) => {
            meteorRefs.current[index] = node;
          }}
        >
          <mesh position={[0, meteor.size * 2.05, 0]}>
            <cylinderGeometry args={[meteor.size * 0.1, meteor.size * 0.62, meteor.size * 4.7, 10, 1, true]} />
            <meshBasicMaterial color={meteor.color} transparent opacity={0.36} />
          </mesh>
          <mesh>
            <dodecahedronGeometry args={[meteor.size, 0]} />
            <meshStandardMaterial
              color="#7c6951"
              emissive={meteor.color}
              emissiveIntensity={0.78}
              roughness={0.88}
              metalness={0.06}
            />
          </mesh>
          <mesh>
            <sphereGeometry args={[meteor.size * 1.18, 8, 8]} />
            <meshBasicMaterial color={meteor.color} transparent opacity={0.32} depthWrite={false} />
          </mesh>
          <Billboard position={[0, meteor.size + 1.25, 0]}>
            <Text raycast={() => null} fontSize={1.7} color="#a5ebff" anchorX="center" anchorY="middle" maxWidth={34}>
              {meteor.hint}
            </Text>
          </Billboard>
        </group>
      ))}
    </group>
  );
}

export function ConstellationHalo({ cluster, reducedMotion = false }) {
  const ringRef = useRef(null);

  useFrame((_, delta) => {
    if (!ringRef.current || reducedMotion) return;
    ringRef.current.rotation.z += delta * 0.06;
  });

  return (
    <group position={cluster.center}>
      <mesh>
        <sphereGeometry args={[cluster.radius * 0.93, 24, 20]} />
        <meshBasicMaterial color={cluster.glow} transparent opacity={0.04} depthWrite={false} />
      </mesh>
      <mesh ref={ringRef} rotation={[-Math.PI / 2, 0, 0]}>
        <ringGeometry args={[cluster.radius * 0.82, cluster.radius * 0.88, 72]} />
        <meshBasicMaterial color={cluster.rim} transparent opacity={0.2} depthWrite={false} />
      </mesh>
      <Billboard position={[0, cluster.radius + 9, 0]}>
        <Text fontSize={4.2} color={cluster.rim} anchorX="center" anchorY="middle" maxWidth={220}>
          {cluster.name}
        </Text>
      </Billboard>
      <Billboard position={[0, cluster.radius + 4.4, 0]}>
        <Text fontSize={2.1} color="#9fdfff" anchorX="center" anchorY="middle" maxWidth={220}>
          {`Planety: ${cluster.planetCount}`}
        </Text>
      </Billboard>
    </group>
  );
}
