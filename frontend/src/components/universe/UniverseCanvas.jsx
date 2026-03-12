import { Canvas, useFrame, useThree } from "@react-three/fiber";
import { Billboard, Line, Stars, Text } from "@react-three/drei";
import { Bloom, EffectComposer } from "@react-three/postprocessing";
import { useMemo, useRef } from "react";
import * as THREE from "three";

function createOrbitPoints(radius, y = 0, segments = 80) {
  return Array.from({ length: segments + 1 }, (_, index) => {
    const theta = (index / segments) * Math.PI * 2;
    return [Math.cos(theta) * radius, y, Math.sin(theta) * radius];
  });
}

function CameraRig({ isFocused, isLocked, isCoreEntered }) {
  const { camera, pointer } = useThree();

  useFrame((state, delta) => {
    const t = state.clock.elapsedTime;
    const orbitSpeed = isCoreEntered ? 0.16 : isFocused ? 0.11 : 0.07;
    const orbitRadius = isCoreEntered ? 0.34 : isFocused ? 0.52 : 0.42;
    const baseDistance = isCoreEntered ? (isLocked ? 8.2 : 8.6) : isFocused ? (isLocked ? 10.4 : 11.1) : 14.2;
    const baseHeight = isCoreEntered ? 1.18 : isFocused ? 1.78 : 2.18;
    const parallaxX = pointer.x * (isCoreEntered ? 0.78 : isFocused ? 0.92 : 0.84);
    const parallaxY = pointer.y * (isCoreEntered ? 0.18 : 0.28);
    const target = new THREE.Vector3(
      Math.sin(t * orbitSpeed) * orbitRadius + parallaxX,
      baseHeight + Math.cos(t * orbitSpeed * 0.7) * 0.06 - parallaxY,
      baseDistance
    );
    const lookTarget = new THREE.Vector3(parallaxX * 0.16, 0.5 - parallaxY * 0.24, 0);

    camera.position.lerp(target, 1 - Math.exp(-delta * (isCoreEntered ? 1.9 : 1.55)));
    camera.lookAt(lookTarget);
  });

  return null;
}

function TacticalGrid({ color = "#66d8ff", intensity = 0.3 }) {
  const majorLines = useMemo(() => {
    const lines = [];
    const span = 14;
    const step = 1.4;
    for (let index = -span; index <= span; index += 1) {
      const offset = index * step;
      lines.push([
        [-span * step, -2.55, offset],
        [span * step, -2.55, offset],
      ]);
      lines.push([
        [offset, -2.55, -span * step],
        [offset, -2.55, span * step],
      ]);
    }
    return lines;
  }, []);

  return (
    <group>
      {majorLines.map((points, index) => (
        <Line
          key={`grid-${index}`}
          points={points}
          color={color}
          transparent
          opacity={index % 2 === 0 ? intensity * 0.42 : intensity * 0.22}
          lineWidth={1}
        />
      ))}
    </group>
  );
}

function DiegeticLabel({ position, text, size = 0.24, color = "#dff6ff" }) {
  return (
    <Billboard position={position} follow lockX={false} lockY={false} lockZ={false}>
      <Text fontSize={size} color={color} anchorX="center" anchorY="middle" outlineWidth={0.012} outlineColor="#04111c">
        {text}
      </Text>
    </Billboard>
  );
}

function ReactorCore({ model, isFocused, isCoreEntered, onSelectStar, onEnterCore }) {
  const rootRef = useRef(null);
  const ringPrimaryRef = useRef(null);
  const ringSecondaryRef = useRef(null);
  const cageRef = useRef(null);
  const orbitCue = useMemo(() => createOrbitPoints(4.8, -0.45), []);
  const commandArc = useMemo(() => createOrbitPoints(2.6, -1.65), []);
  const entryArc = useMemo(() => createOrbitPoints(2.2, 1.95, 48), []);

  useFrame((state) => {
    const t = state.clock.elapsedTime;
    const amplitude = model.visual.pulseAmplitude;
    const pulseDamping = isCoreEntered ? 0.26 : isFocused ? 0.38 : 0.52;
    const pulse = 1 + Math.sin(t * model.visual.pulseSpeed) * amplitude * pulseDamping;

    if (rootRef.current) {
      rootRef.current.rotation.y = t * (isCoreEntered ? 0.28 : 0.2);
      rootRef.current.scale.setScalar(pulse + (isFocused ? 0.018 : 0));
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
        onDoubleClick={onEnterCore}
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
          emissiveIntensity={isCoreEntered ? 1.9 : 1.55}
          roughness={0.25}
          metalness={0.1}
        />
      </mesh>

      <mesh scale={isCoreEntered ? 1.22 : 1.3}>
        <icosahedronGeometry args={[1.75, 1]} />
        <meshBasicMaterial color={model.palette.halo} transparent opacity={0.28} wireframe />
      </mesh>

      <mesh scale={isCoreEntered ? 1.94 : 1.8}>
        <sphereGeometry args={[1.45, 40, 40]} />
        <meshBasicMaterial color={model.palette.governance} transparent opacity={isCoreEntered ? 0.09 : 0.06} />
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

      {!model.visual.showOrbitCue ? (
        <>
          <Line points={entryArc} color={model.palette.governance} transparent opacity={0.3} lineWidth={1.2} />
          <mesh position={[0, 1.95, 2.2]}>
            <sphereGeometry args={[0.08, 18, 18]} />
            <meshBasicMaterial color={model.palette.governance} />
          </mesh>
        </>
      ) : null}

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

      <DiegeticLabel
        position={[-3.9, 2.7, 0.2]}
        text={`${model.ringLabels[0].key}: ${model.ringLabels[0].value}`}
        size={0.28}
      />
      <DiegeticLabel
        position={[3.75, 2.05, -0.25]}
        text={`${model.ringLabels[1].key}: ${model.ringLabels[1].value}`}
        size={0.24}
      />
      <DiegeticLabel
        position={[3.4, -2.1, 0.15]}
        text={`${model.ringLabels[2].key}: ${model.ringLabels[2].value}`}
        size={0.22}
      />
      {!model.visual.showOrbitCue ? (
        <DiegeticLabel
          position={[0, 2.45, 2.65]}
          text={isCoreEntered ? "PRAH SRDCE HVĚZDY" : "DVOJKLIKEM VSTOUPÍŠ DO JÁDRA"}
          size={0.19}
          color={model.palette.governance}
        />
      ) : null}
    </group>
  );
}

export default function UniverseCanvas({
  model,
  isStarFocused = false,
  isCoreEntered = false,
  onSelectStar = () => {},
  onEnterCore = () => {},
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
        <TacticalGrid color={model.palette.halo} intensity={locked ? 0.34 : 0.24} />
        <CameraRig isFocused={isStarFocused} isLocked={locked} isCoreEntered={isCoreEntered} />
        <ReactorCore
          model={model}
          isFocused={isStarFocused}
          isCoreEntered={isCoreEntered}
          onSelectStar={onSelectStar}
          onEnterCore={onEnterCore}
        />

        <EffectComposer>
          <Bloom mipmapBlur luminanceThreshold={0.15} intensity={locked ? 1.2 : 1.6} />
        </EffectComposer>
      </Canvas>
    </div>
  );
}
