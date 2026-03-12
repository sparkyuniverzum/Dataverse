import { Canvas, useFrame, useThree } from "@react-three/fiber";
import { Billboard, Line, OrbitControls, Stars, Text } from "@react-three/drei";
import { Bloom, EffectComposer } from "@react-three/postprocessing";
import { useEffect, useMemo, useRef } from "react";
import * as THREE from "three";

import { resolveStarCoreExteriorLabels } from "./starCoreExteriorLabels.js";
import { resolveStarCoreExteriorState } from "./starCoreExteriorStateModel.js";
import { resolveStarCoreExteriorVisualModel } from "./starCoreExteriorVisualModel.js";

function createOrbitPoints(radius, y = 0, segments = 80) {
  return Array.from({ length: segments + 1 }, (_, index) => {
    const theta = (index / segments) * Math.PI * 2;
    return [Math.cos(theta) * radius, y, Math.sin(theta) * radius];
  });
}

function CameraRig({ controlsRef, navigationModel, movementRef, onHeadingChange, interiorModel }) {
  const { camera, pointer } = useThree();
  const headingRef = useRef(0);

  useFrame((state, delta) => {
    const controls = controlsRef.current;
    const selectedObject = navigationModel.selectedObject;
    const activeObject = navigationModel.approachTarget || selectedObject;
    const activePosition = activeObject?.position || [0, 0.4, 0];
    const target = new THREE.Vector3(
      Number(activePosition[0] || 0),
      Number(activePosition[1] || 0.4),
      Number(activePosition[2] || 0)
    );
    const interiorTargetYOffset = interiorModel.isOpen
      ? interiorModel.phase === "first_orbit_ready"
        ? 0.82
        : 1.04
      : 0;
    const desiredDistance = interiorModel.isOpen
      ? interiorModel.phase === "first_orbit_ready"
        ? 7.4
        : interiorModel.phase === "policy_lock_transition"
          ? 8.2
          : interiorModel.phase === "policy_lock_ready"
            ? 8.8
            : interiorModel.phase === "constitution_select"
              ? 9.1
              : 9.6
      : navigationModel.mode === "approach_active"
        ? activeObject?.type === "star"
          ? activeObject?.approachDistance || 6.7
          : 5.8
        : navigationModel.mode === "object_selected"
          ? activeObject?.type === "star"
            ? 10.5
            : 8.8
          : 14.8;

    if (controls) {
      if (navigationModel.mode !== "space_idle" || interiorModel.isOpen) {
        const targetWithParallax = new THREE.Vector3(
          target.x + pointer.x * (interiorModel.isOpen ? 0.04 : 0.18),
          target.y + interiorTargetYOffset + pointer.y * (interiorModel.isOpen ? 0.035 : 0.12),
          target.z
        );
        controls.target.lerp(targetWithParallax, 1 - Math.exp(-delta * 3.2));
        const offset = camera.position.clone().sub(controls.target);
        const currentDistance = offset.length() || desiredDistance;
        const nextDistance = THREE.MathUtils.lerp(currentDistance, desiredDistance, 1 - Math.exp(-delta * 2.1));
        offset.setLength(nextDistance);
        camera.position.copy(controls.target.clone().add(offset));
      }

      const movement = movementRef.current;
      if (!interiorModel.isOpen && (movement.forward || movement.backward)) {
        const speed = navigationModel.mode === "approach_active" ? 3.8 : 5.4;
        const direction = new THREE.Vector3();
        camera.getWorldDirection(direction);
        direction.y = 0;
        if (direction.lengthSq() > 0.0001) {
          direction.normalize();
          const sign = movement.forward ? 1 : -1;
          const step = sign * speed * delta;
          camera.position.addScaledVector(direction, step);
          controls.target.addScaledVector(direction, step);
        }
      }

      controls.update();
      const headingRadians = controls.getAzimuthalAngle();
      const headingDegrees = THREE.MathUtils.radToDeg(headingRadians);
      if (Math.abs(headingDegrees - headingRef.current) > 0.5) {
        headingRef.current = headingDegrees;
        onHeadingChange(headingDegrees);
      }
    } else {
      camera.position.lerp(
        new THREE.Vector3(pointer.x * 0.4, 2.2 + pointer.y * 0.18, desiredDistance),
        1 - Math.exp(-delta * 2)
      );
      camera.lookAt(target);
    }
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

function PlanetNode({ item, isSelected, isApproached, onSelectObject, onApproachObject }) {
  const glowScale = isApproached ? 1.7 : isSelected ? 1.45 : 1.25;

  return (
    <group position={item.position}>
      <mesh
        onClick={(event) => {
          event.stopPropagation();
          onSelectObject(item.id);
        }}
        onDoubleClick={(event) => {
          event.stopPropagation();
          onApproachObject(item.id);
        }}
        onPointerOver={(event) => {
          event.stopPropagation();
          document.body.style.cursor = "pointer";
        }}
        onPointerOut={() => {
          document.body.style.cursor = "auto";
        }}
      >
        <sphereGeometry args={[item.size * 0.28, 24, 24]} />
        <meshStandardMaterial color="#bdefff" emissive="#7fdfff" emissiveIntensity={isSelected ? 1.4 : 0.82} />
      </mesh>
      <mesh scale={glowScale}>
        <sphereGeometry args={[item.size * 0.22, 18, 18]} />
        <meshBasicMaterial color="#7fe8ff" transparent opacity={isApproached ? 0.16 : 0.08} />
      </mesh>
      <DiegeticLabel
        position={[0, item.size * 0.52 + 0.3, 0]}
        text={item.label}
        size={0.18}
        color={isSelected ? "#f3fdff" : "#d3f6ff"}
      />
    </group>
  );
}

function ConstitutionNode({ option, index, selected, onSelectConstitution }) {
  const radius = 3.3;
  const theta = (index / 4) * Math.PI * 2 - Math.PI / 2;
  const position = [Math.cos(theta) * radius, Math.sin(theta) * 1.12 + 0.6, Math.sin(theta) * radius * 0.32];
  return (
    <group position={position}>
      <mesh
        onClick={(event) => {
          event.stopPropagation();
          onSelectConstitution(option.id);
        }}
        onPointerOver={(event) => {
          event.stopPropagation();
          document.body.style.cursor = "pointer";
        }}
        onPointerOut={() => {
          document.body.style.cursor = "auto";
        }}
      >
        <sphereGeometry args={[selected ? 0.46 : 0.34, 26, 26]} />
        <meshStandardMaterial
          color={selected ? option.tonePrimary : option.toneSecondary}
          emissive={option.tonePrimary}
          emissiveIntensity={selected ? 1.9 : 1.1}
        />
      </mesh>
      <DiegeticLabel position={[0, 0.72, 0]} text={option.title} size={0.16} color="#fff1d6" />
      <DiegeticLabel position={[0, -0.62, 0]} text={option.effectHint} size={0.1} color="#ffe1b1" />
    </group>
  );
}

function StarCoreInterior({ model, interiorModel, selectedConstitution, onSelectConstitution }) {
  const interiorGlow = interiorModel.phase === "policy_lock_transition" ? "#fff0ba" : "#aef6ff";
  const orbitRadius = interiorModel.phase === "first_orbit_ready" ? 4.1 : 3.3;
  const orbitCue = useMemo(() => createOrbitPoints(orbitRadius, -0.12), [orbitRadius]);
  const constitutionOptions = Array.isArray(interiorModel.availableConstitutions)
    ? interiorModel.availableConstitutions
    : [];
  const showConstitutions = interiorModel.canSelectConstitution;

  return (
    <group position={[0, 0.4, 0]}>
      <mesh scale={1.24}>
        <sphereGeometry args={[1.28, 48, 48]} />
        <meshBasicMaterial color={interiorGlow} transparent opacity={0.12} />
      </mesh>
      <mesh scale={1.06}>
        <icosahedronGeometry args={[2.42, 0]} />
        <meshBasicMaterial
          color={selectedConstitution?.toneSecondary || "#bff8ff"}
          transparent
          opacity={0.24}
          wireframe
        />
      </mesh>
      <Line
        points={orbitCue}
        color={selectedConstitution?.tonePrimary || model.palette.halo}
        transparent
        opacity={interiorModel.phase === "first_orbit_ready" ? 0.88 : 0.34}
        lineWidth={1.5}
      />
      {showConstitutions
        ? constitutionOptions.map((option, index) => (
            <ConstitutionNode
              key={option.id}
              option={option}
              index={index}
              selected={selectedConstitution?.id === option.id}
              onSelectConstitution={onSelectConstitution}
            />
          ))
        : null}
      <DiegeticLabel
        position={[0, 2.7, 0]}
        text={
          interiorModel.phase === "star_core_interior_entry"
            ? "Jádro prostoru se otevírá"
            : interiorModel.explainability.headline || "Jádro prostoru je otevřené"
        }
        size={0.22}
        color="#fff0cf"
      />
    </group>
  );
}

function ReactorCore({
  model,
  navigationModel,
  interiorModel,
  selectedConstitution,
  onSelectObject,
  onApproachObject,
  onSelectConstitution,
}) {
  const rootRef = useRef(null);
  const ringPrimaryRef = useRef(null);
  const ringSecondaryRef = useRef(null);
  const cageRef = useRef(null);
  const exteriorState = useMemo(
    () => resolveStarCoreExteriorState({ model, navigationModel }),
    [model, navigationModel]
  );
  const visualModel = useMemo(
    () => resolveStarCoreExteriorVisualModel({ model, exteriorState }),
    [exteriorState, model]
  );
  const labels = useMemo(
    () => resolveStarCoreExteriorLabels({ model, exteriorState, visualModel }),
    [exteriorState, model, visualModel]
  );
  const selected = exteriorState.selected;
  const approached = exteriorState.approached;
  const orbitCue = useMemo(() => createOrbitPoints(4.8, -0.45), []);
  const runtimeArc = useMemo(
    () => createOrbitPoints(visualModel.orbitRadiusPrimary, 0.18),
    [visualModel.orbitRadiusPrimary]
  );
  const domainArc = useMemo(
    () => createOrbitPoints(visualModel.orbitRadiusSecondary, -0.12),
    [visualModel.orbitRadiusSecondary]
  );

  const starObject = useMemo(
    () => ({
      id: "star-core",
      type: "star",
      approachDistance: visualModel.approachDistance,
      position: [0, 0.4, 0],
    }),
    [visualModel.approachDistance]
  );

  useFrame((state) => {
    const t = state.clock.elapsedTime;
    const amplitude = visualModel.pulseScale;
    const pulseDamping = approached ? 0.3 : selected ? 0.42 : 0.56;
    const pulse = 1 + Math.sin(t * visualModel.pulseSpeed) * amplitude * pulseDamping;
    const interiorScale = interiorModel.isOpen ? (interiorModel.phase === "first_orbit_ready" ? 0.92 : 0.78) : 1;

    if (rootRef.current) {
      rootRef.current.rotation.y = t * 0.12;
      rootRef.current.scale.setScalar((pulse + (selected ? 0.014 : 0)) * interiorScale);
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
        onClick={(event) => {
          event.stopPropagation();
          onSelectObject("star-core");
        }}
        onDoubleClick={(event) => {
          event.stopPropagation();
          onApproachObject(starObject.id);
        }}
        onPointerOver={(event) => {
          event.stopPropagation();
          document.body.style.cursor = "pointer";
        }}
        onPointerOut={() => {
          document.body.style.cursor = "auto";
        }}
      >
        <sphereGeometry args={[1.64, 48, 48]} />
        <meshStandardMaterial
          color={model.palette.primary}
          emissive={model.palette.secondary}
          emissiveIntensity={visualModel.starEmissiveIntensity}
          roughness={0.25}
          metalness={0.1}
        />
      </mesh>

      <mesh scale={approached ? 1.2 : 1.28}>
        <icosahedronGeometry args={[1.75, 1]} />
        <meshBasicMaterial
          color={visualModel.secondaryRingColor}
          transparent
          opacity={visualModel.cageOpacity}
          wireframe
        />
      </mesh>

      <mesh scale={approached ? 1.94 : 1.8}>
        <sphereGeometry args={[1.52, 40, 40]} />
        <meshBasicMaterial color={model.palette.governance} transparent opacity={visualModel.domainShellOpacity} />
      </mesh>

      <group ref={cageRef}>
        <lineSegments>
          <edgesGeometry args={[new THREE.IcosahedronGeometry(2.2, 0)]} />
          <lineBasicMaterial color={visualModel.secondaryRingColor} transparent opacity={visualModel.cageOpacity} />
        </lineSegments>
      </group>

      <group ref={ringPrimaryRef} rotation={[Math.PI / 2.8, 0.4, 0.2]}>
        <mesh>
          <torusGeometry args={[3.35, 0.08, 24, 160]} />
          <meshBasicMaterial
            color={visualModel.governanceRingColor}
            transparent
            opacity={visualModel.governanceRingOpacity}
          />
        </mesh>
      </group>

      <group ref={ringSecondaryRef} rotation={[Math.PI / 1.8, 0.22, -0.4]}>
        <mesh>
          <torusGeometry args={[2.85, 0.05, 24, 140]} />
          <meshBasicMaterial
            color={visualModel.secondaryRingColor}
            transparent
            opacity={visualModel.secondaryRingOpacity}
          />
        </mesh>
      </group>

      <Line
        points={runtimeArc}
        color={visualModel.governanceRingColor}
        transparent
        opacity={visualModel.runtimeArcOpacity}
        lineWidth={1.1}
      />
      <Line
        points={domainArc}
        color={visualModel.secondaryRingColor}
        transparent
        opacity={visualModel.secondaryRingOpacity * 0.72}
        lineWidth={1.1}
      />

      {model.visual.showOrbitCue ? (
        <>
          <Line
            points={orbitCue}
            color={model.palette.halo}
            transparent
            opacity={visualModel.orbitCueOpacity}
            lineWidth={1.5}
          />
          <mesh position={[4.8, -0.45, 0]}>
            <sphereGeometry args={[0.18, 20, 20]} />
            <meshBasicMaterial color={model.palette.halo} />
          </mesh>
        </>
      ) : null}

      {labels.map((label) => (
        <DiegeticLabel
          key={label.key}
          position={label.position}
          text={label.text}
          size={label.size}
          color={label.color}
        />
      ))}

      {interiorModel.isOpen ? (
        <StarCoreInterior
          model={model}
          interiorModel={interiorModel}
          selectedConstitution={selectedConstitution}
          onSelectConstitution={onSelectConstitution}
        />
      ) : null}
    </group>
  );
}

export default function UniverseCanvas({
  model,
  spaceObjects = [],
  navigationModel,
  interiorModel = { phase: "closed", isOpen: false },
  selectedConstitution = null,
  onSelectObject = () => {},
  onApproachObject = () => {},
  onSelectConstitution = () => {},
  onHeadingChange = () => {},
  onClearFocus = () => {},
}) {
  const exteriorState = useMemo(
    () => resolveStarCoreExteriorState({ model, navigationModel }),
    [model, navigationModel]
  );
  const exteriorVisualModel = useMemo(
    () => resolveStarCoreExteriorVisualModel({ model, exteriorState }),
    [exteriorState, model]
  );
  const adjustedNavigationModel = useMemo(() => {
    const starDistance = exteriorVisualModel.approachDistance;
    const selectedObject =
      navigationModel.selectedObject?.id === "star-core"
        ? { ...navigationModel.selectedObject, approachDistance: starDistance }
        : navigationModel.selectedObject;
    const approachTarget =
      navigationModel.approachTarget?.id === "star-core"
        ? { ...navigationModel.approachTarget, approachDistance: starDistance }
        : navigationModel.approachTarget;
    return {
      ...navigationModel,
      selectedObject,
      approachTarget,
    };
  }, [exteriorVisualModel.approachDistance, navigationModel]);
  const controlsRef = useRef(null);
  const movementRef = useRef({ forward: false, backward: false });

  useEffect(() => {
    document.body.style.cursor = "auto";
    function handleKeyChange(event, pressed) {
      if (event.key === "w" || event.key === "ArrowUp") {
        movementRef.current.forward = pressed;
      }
      if (event.key === "s" || event.key === "ArrowDown") {
        movementRef.current.backward = pressed;
      }
    }

    function handleKeyDown(event) {
      handleKeyChange(event, true);
    }

    function handleKeyUp(event) {
      handleKeyChange(event, false);
    }

    window.addEventListener("keydown", handleKeyDown);
    window.addEventListener("keyup", handleKeyUp);
    return () => {
      window.removeEventListener("keydown", handleKeyDown);
      window.removeEventListener("keyup", handleKeyUp);
      document.body.style.cursor = "auto";
    };
  }, []);

  return (
    <div data-testid="universe-canvas-shell" style={{ position: "absolute", inset: 0 }}>
      <Canvas
        camera={{ position: [0, 3.1, 16.2], fov: 38, near: 0.1, far: 200 }}
        gl={{ antialias: true }}
        style={{ width: "100%", height: "100%" }}
        onPointerMissed={() => {
          document.body.style.cursor = "auto";
          if (!interiorModel.isOpen) {
            onClearFocus();
          }
        }}
      >
        <color attach="background" args={["#03060d"]} />
        <fog attach="fog" args={["#03060d", 18, 48]} />

        <ambientLight intensity={0.55} />
        <pointLight position={[0, 1.8, 1.2]} intensity={12} color={model.palette.primary} />
        <pointLight position={[0, -2.2, -4]} intensity={4} color={model.palette.secondary} />
        <directionalLight position={[6, 10, 8]} intensity={0.8} color="#bfdfff" />

        <OrbitControls
          ref={controlsRef}
          enableDamping
          dampingFactor={0.08}
          minDistance={3.8}
          maxDistance={24}
          maxPolarAngle={Math.PI * 0.47}
          minPolarAngle={Math.PI * 0.2}
          zoomSpeed={0.84}
          rotateSpeed={0.86}
          panSpeed={0.65}
        />
        <Stars radius={80} depth={36} count={3600} factor={4} saturation={0} fade speed={0.24} />
        <TacticalGrid color={model.palette.halo} intensity={exteriorVisualModel.tacticalGridIntensity} />
        <CameraRig
          controlsRef={controlsRef}
          navigationModel={adjustedNavigationModel}
          movementRef={movementRef}
          onHeadingChange={onHeadingChange}
          interiorModel={interiorModel}
        />
        <ReactorCore
          model={model}
          navigationModel={adjustedNavigationModel}
          interiorModel={interiorModel}
          selectedConstitution={selectedConstitution}
          onSelectObject={onSelectObject}
          onApproachObject={onApproachObject}
          onSelectConstitution={onSelectConstitution}
        />
        {spaceObjects
          .filter((item) => item.type === "planet")
          .map((item) => (
            <PlanetNode
              key={item.id}
              item={item}
              isSelected={navigationModel.selectedObjectId === item.id}
              isApproached={navigationModel.approachTargetId === item.id}
              onSelectObject={onSelectObject}
              onApproachObject={onApproachObject}
            />
          ))}

        <EffectComposer>
          <Bloom mipmapBlur luminanceThreshold={0.15} intensity={exteriorVisualModel.bloomIntensity} />
        </EffectComposer>
      </Canvas>
    </div>
  );
}
