import { useEffect, useMemo, useRef, useState } from "react";
import { useFrame } from "@react-three/fiber";
import { Billboard, Text } from "@react-three/drei";

function clamp(value, min, max) {
  return Math.max(min, Math.min(max, value));
}

export function SourceCoreStar({
  starCore,
  onSelectStar,
  onOpenControlCenter,
  isFocused = false,
  isControlCenterOpen = false,
}) {
  const coreRef = useRef(null);
  const auraRef = useRef(null);
  const ringARef = useRef(null);
  const ringBRef = useRef(null);
  const lightRef = useRef(null);
  const burstRef = useRef(0);
  const previousSeqRef = useRef(0);
  const [isHovered, setIsHovered] = useState(false);

  const writesPerMinute = Number(starCore?.writesPerMinute || 0);
  const domainActivity = clamp(Number(starCore?.domainActivity || 0), 0, 1);
  const profile = starCore?.profile || null;
  const lastEventSeq = Number.isFinite(Number(starCore?.lastEventSeq)) ? Number(starCore.lastEventSeq) : 0;
  // Star must be visually distinct from planets: warm, bright stellar core.
  const primaryColor = "#ffd36b";
  const secondaryColor = "#ff8a3a";
  const coronaColor = "#fff0b3";
  const ringColor = "#ffb65a";
  const label = String(profile?.label || "Source Core");
  const subtitle = `${String(starCore?.recommendedLawPreset || "balanced")} · ${writesPerMinute.toFixed(2)} write/min`;

  useEffect(() => {
    if (typeof document === "undefined") return undefined;
    const previous = document.body.style.cursor;
    if (isHovered) {
      document.body.style.cursor = "pointer";
    }
    return () => {
      document.body.style.cursor = previous;
    };
  }, [isHovered]);

  useEffect(() => {
    if (lastEventSeq > previousSeqRef.current) {
      burstRef.current = 1;
      previousSeqRef.current = lastEventSeq;
    }
  }, [lastEventSeq]);

  const baseRadius = useMemo(() => 30 + domainActivity * 10, [domainActivity]);
  const pulseSpeed = useMemo(
    () => 0.75 + domainActivity * 1.15 + Math.min(writesPerMinute / 18, 1),
    [domainActivity, writesPerMinute]
  );

  useFrame((state, delta) => {
    const t = state.clock.elapsedTime;
    burstRef.current = Math.max(0, burstRef.current - delta * 0.85);
    const burst = burstRef.current;
    const wave = (Math.sin(t * pulseSpeed) + 1) / 2;
    const focusBoost = isFocused || isControlCenterOpen ? 0.07 : 0;
    const scale = 1 + wave * 0.05 + burst * 0.16 + focusBoost;

    if (coreRef.current) {
      coreRef.current.scale.setScalar(scale);
      coreRef.current.rotation.y += delta * (0.24 + domainActivity * 0.32);
      coreRef.current.rotation.x = Math.sin(t * 0.22) * 0.08;
    }
    if (auraRef.current) {
      auraRef.current.material.opacity = clamp(0.15 + wave * 0.18 + burst * 0.22, 0.1, 0.56);
      auraRef.current.scale.setScalar(1 + wave * 0.08 + burst * 0.12);
    }
    if (ringARef.current) {
      ringARef.current.rotation.z += delta * (0.22 + domainActivity * 0.34);
      ringARef.current.rotation.x = Math.sin(t * 0.4) * 0.08;
      ringARef.current.material.opacity = clamp(
        0.28 + (isFocused ? 0.24 : 0) + (isControlCenterOpen ? 0.18 : 0),
        0.2,
        0.82
      );
    }
    if (ringBRef.current) {
      ringBRef.current.rotation.z -= delta * (0.18 + domainActivity * 0.28);
      ringBRef.current.rotation.y += delta * 0.12;
      ringBRef.current.material.opacity = clamp(
        0.18 + (isFocused ? 0.16 : 0) + (isControlCenterOpen ? 0.14 : 0),
        0.14,
        0.68
      );
    }
    if (lightRef.current) {
      lightRef.current.intensity =
        5.8 + wave * 2.8 + burst * 2.7 + (isFocused ? 1.8 : 0) + (isControlCenterOpen ? 1.2 : 0);
      lightRef.current.distance = 560 + domainActivity * 280;
    }
  });

  return (
    <group position={[0, 0, 0]}>
      <pointLight ref={lightRef} color={secondaryColor} intensity={5.9} distance={620} decay={2} />
      <group ref={coreRef}>
        <mesh
          onPointerOver={(event) => {
            event.stopPropagation();
            setIsHovered(true);
          }}
          onPointerOut={(event) => {
            event.stopPropagation();
            setIsHovered(false);
          }}
          onClick={(event) => {
            event.stopPropagation();
            if (typeof onSelectStar === "function") {
              onSelectStar();
            }
          }}
          onDoubleClick={(event) => {
            event.stopPropagation();
            if (typeof onOpenControlCenter === "function") {
              onOpenControlCenter();
            }
          }}
        >
          <icosahedronGeometry args={[baseRadius, 2]} />
          <meshStandardMaterial
            color={primaryColor}
            emissive={secondaryColor}
            emissiveIntensity={2.2}
            roughness={0.18}
            metalness={0.3}
          />
        </mesh>
        <mesh ref={auraRef} raycast={() => null}>
          <sphereGeometry args={[baseRadius * 2.15, 30, 30]} />
          <meshBasicMaterial color={coronaColor} transparent opacity={0.24} depthWrite={false} />
        </mesh>
        <mesh raycast={() => null}>
          <octahedronGeometry args={[baseRadius * 1.45, 1]} />
          <meshBasicMaterial color="#ffe9a8" wireframe transparent opacity={0.24} depthWrite={false} />
        </mesh>
      </group>
      <mesh ref={ringARef} rotation={[-Math.PI / 2, 0, 0]} raycast={() => null}>
        <torusGeometry args={[baseRadius * 2.75, baseRadius * 0.095, 16, 128]} />
        <meshBasicMaterial color={ringColor} transparent opacity={0.42} depthWrite={false} />
      </mesh>
      <mesh ref={ringBRef} rotation={[-Math.PI / 2 + 0.5, 0.3, 0.2]} raycast={() => null}>
        <torusGeometry args={[baseRadius * 3.2, baseRadius * 0.065, 14, 112]} />
        <meshBasicMaterial color={coronaColor} transparent opacity={0.34} depthWrite={false} />
      </mesh>

      <Billboard position={[0, baseRadius * 2.95, 0]}>
        <Text raycast={() => null} fontSize={3.8} color="#dff9ff" anchorX="center" anchorY="middle" maxWidth={180}>
          {label}
        </Text>
      </Billboard>
      <Billboard position={[0, baseRadius * 2.5, 0]}>
        <Text raycast={() => null} fontSize={1.8} color="#9fdfff" anchorX="center" anchorY="middle" maxWidth={220}>
          {subtitle}
        </Text>
      </Billboard>
    </group>
  );
}
