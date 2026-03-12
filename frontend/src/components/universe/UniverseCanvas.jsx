import { Canvas, useFrame, useThree } from "@react-three/fiber";
import { Line, Stars, Text } from "@react-three/drei";
import { Bloom, EffectComposer } from "@react-three/postprocessing";
import { useMemo, useRef } from "react";
import * as THREE from "three";

function createOrbitPoints(radius, y = 0, segments = 80) {
  return Array.from({ length: segments + 1 }, (_, index) => {
    const theta = (index / segments) * Math.PI * 2;
    return [Math.cos(theta) * radius, y, Math.sin(theta) * radius];
  });
}

function CameraRig({ isFocused, isLocked }) {
  const { camera } = useThree();

  useFrame((_, delta) => {
    const target = isFocused ? new THREE.Vector3(0, 1.4, isLocked ? 6.8 : 7.6) : new THREE.Vector3(0, 2.5, 11.8);
    camera.position.lerp(target, 1 - Math.exp(-delta * 1.8));
    camera.lookAt(0, 0.5, 0);
  });

  return null;
}

function ReactorCore({ model, isFocused, onSelectStar }) {
  const rootRef = useRef(null);
  const ringPrimaryRef = useRef(null);
  const ringSecondaryRef = useRef(null);
  const cageRef = useRef(null);
  const orbitCue = useMemo(() => createOrbitPoints(4.8, -0.45), []);
  const commandArc = useMemo(() => createOrbitPoints(2.6, -1.65), []);

  useFrame((state) => {
    const t = state.clock.elapsedTime;
    const amplitude = model.visual.pulseAmplitude;
    const pulse = 1 + Math.sin(t * model.visual.pulseSpeed) * amplitude;

    if (rootRef.current) {
      rootRef.current.rotation.y = t * 0.2;
      rootRef.current.scale.setScalar(isFocused ? pulse * 1.05 : pulse);
    }
    if (cageRef.current) {
      cageRef.current.rotation.x = t * 0.18;
      cageRef.current.rotation.y = -t * 0.15;
    }
    if (ringPrimaryRef.current) {
      ringPrimaryRef.current.rotation.z = t * 0.34;
    }
    if (ringSecondaryRef.current) {
      ringSecondaryRef.current.rotation.z = -t * 0.26;
    }
  });

  return (
    <group ref={rootRef} position={[0, 0.4, 0]}>
      <mesh
        onClick={onSelectStar}
        onPointerOver={(event) => {
          event.stopPropagation();
          document.body.style.cursor = "pointer";
        }}
        onPointerOut={() => {
          document.body.style.cursor = "auto";
        }}
      >
        <sphereGeometry args={[1.55, 48, 48]} />
        <meshStandardMaterial
          color={model.palette.primary}
          emissive={model.palette.secondary}
          emissiveIntensity={1.6}
          roughness={0.25}
          metalness={0.1}
        />
      </mesh>

      <mesh scale={1.3}>
        <icosahedronGeometry args={[1.75, 1]} />
        <meshBasicMaterial color={model.palette.halo} transparent opacity={0.28} wireframe />
      </mesh>

      <mesh scale={1.8}>
        <sphereGeometry args={[1.45, 40, 40]} />
        <meshBasicMaterial color={model.palette.governance} transparent opacity={0.06} />
      </mesh>

      <group ref={cageRef}>
        <lineSegments>
          <edgesGeometry args={[new THREE.IcosahedronGeometry(2.2, 0)]} />
          <lineBasicMaterial color={model.palette.secondary} transparent opacity={0.36} />
        </lineSegments>
      </group>

      <group ref={ringPrimaryRef} rotation={[Math.PI / 2.8, 0.4, 0.2]}>
        <mesh>
          <torusGeometry args={[3.35, 0.08, 24, 160]} />
          <meshBasicMaterial
            color={model.visual.ringLocked ? model.palette.halo : model.palette.secondary}
            transparent
            opacity={model.visual.ringLocked ? 0.78 : 0.68}
          />
        </mesh>
      </group>

      <group ref={ringSecondaryRef} rotation={[Math.PI / 1.8, 0.22, -0.4]}>
        <mesh>
          <torusGeometry args={[2.85, 0.05, 24, 140]} />
          <meshBasicMaterial color={model.palette.governance} transparent opacity={0.52} />
        </mesh>
      </group>

      {model.visual.showCommandBeacon ? (
        <Line points={commandArc} color={model.palette.secondary} transparent opacity={0.34} lineWidth={1.6} />
      ) : null}

      {model.visual.showOrbitCue ? (
        <>
          <Line points={orbitCue} color={model.palette.halo} transparent opacity={0.56} lineWidth={1.5} />
          <mesh position={[4.8, -0.45, 0]}>
            <sphereGeometry args={[0.18, 20, 20]} />
            <meshBasicMaterial color={model.palette.halo} />
          </mesh>
        </>
      ) : null}

      <Text position={[-4.2, 2.8, 0]} fontSize={0.28} color="#dff6ff" anchorX="left" anchorY="middle">
        {`${model.ringLabels[0].key}: ${model.ringLabels[0].value}`}
      </Text>
      <Text position={[3.2, 2.2, 0]} fontSize={0.24} color="#dff6ff" anchorX="left" anchorY="middle">
        {`${model.ringLabels[1].key}: ${model.ringLabels[1].value}`}
      </Text>
      <Text position={[-3.9, -2.25, 0]} fontSize={0.22} color="#dff6ff" anchorX="left" anchorY="middle">
        {`${model.ringLabels[2].key}: ${model.ringLabels[2].value}`}
      </Text>
    </group>
  );
}

export default function UniverseCanvas({
  model,
  isStarFocused = false,
  onSelectStar = () => {},
  onClearFocus = () => {},
}) {
  const locked = model.state === "star_core_locked_ready";

  return (
    <div data-testid="universe-canvas-shell" style={{ position: "absolute", inset: 0 }}>
      <Canvas
        camera={{ position: [0, 2.5, 11.8], fov: 38, near: 0.1, far: 200 }}
        gl={{ antialias: true }}
        style={{ width: "100%", height: "100%" }}
        onPointerMissed={() => {
          document.body.style.cursor = "auto";
          onClearFocus();
        }}
      >
        <color attach="background" args={["#03060d"]} />
        <fog attach="fog" args={["#03060d", 18, 48]} />

        <ambientLight intensity={0.55} />
        <pointLight position={[0, 1.8, 1.2]} intensity={12} color={model.palette.primary} />
        <pointLight position={[0, -2.2, -4]} intensity={4} color={model.palette.secondary} />
        <directionalLight position={[6, 10, 8]} intensity={0.8} color="#bfdfff" />

        <Stars radius={80} depth={36} count={3600} factor={4} saturation={0} fade speed={0.24} />
        <CameraRig isFocused={isStarFocused} isLocked={locked} />
        <ReactorCore model={model} isFocused={isStarFocused} onSelectStar={onSelectStar} />

        <EffectComposer>
          <Bloom mipmapBlur luminanceThreshold={0.15} intensity={locked ? 1.2 : 1.6} />
        </EffectComposer>
      </Canvas>
    </div>
  );
}
