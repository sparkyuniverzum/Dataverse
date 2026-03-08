import { useMemo, useRef, useState, useCallback, useEffect } from "react";
import { useFrame, useThree } from "@react-three/fiber";
import { Billboard, Text } from "@react-three/drei";
import * as THREE from "three";

import { clamp, createRng, hashText, setBodyCursor } from "./sceneMath";
import { phaseFromLegacyStatus, resolveMoonPhaseVisual, resolvePlanetPhaseVisual } from "./physicsSystem";
import { resolvePlanetV1Style, signatureColorFromSeed } from "./sceneStyling";

const FALLBACK_NODE_PHYSICS = Object.freeze({
  quality: 1,
  stress: 0,
  alertPressure: 0,
  bondDensity: 0,
  massFactor: 1,
  radiusFactor: 1,
  spinFactor: 1,
  emissiveBoost: 0,
  auraFactor: 1,
  pulseFactor: 1,
});

const CONSTELLATION_ARCHETYPES = [
  { key: "cluster", label: "Cluster Core", palette: ["#79c2ff", "#8de6ff", "#d6f4ff"], coreShape: "sphere" },
  { key: "ring", label: "Ring Nexus", palette: ["#90a7ff", "#9bb8ff", "#eceeff"], coreShape: "icosa" },
  { key: "crystal", label: "Crystal Forge", palette: ["#ffd08a", "#ffbb66", "#fff1d8"], coreShape: "octa" },
  { key: "nebula", label: "Nebula Field", palette: ["#9cf3ff", "#5fcbff", "#e9fcff"], coreShape: "dodeca" },
  { key: "irregular", label: "Irregular Mesh", palette: ["#88ffd4", "#64e5c2", "#eafff5"], coreShape: "icosa" },
];

function pickConstellationArchetype(seedText) {
  return CONSTELLATION_ARCHETYPES[hashText(seedText) % CONSTELLATION_ARCHETYPES.length];
}

function pushPoint(positions, colors, x, y, z, color) {
  positions.push(x, y, z);
  colors.push(color.r, color.g, color.b);
}

function PinIndicator({ size = 1 }) {
  return (
    <group>
      <mesh position={[0, size * 1.5, 0]}>
        <sphereGeometry args={[size * 0.5, 16, 16]} />
        <meshStandardMaterial color="#ffffff" emissive="#dddddd" emissiveIntensity={0.5} />
      </mesh>
      <mesh position={[0, size * 0.5, 0]}>
        <cylinderGeometry args={[size * 0.1, size * 0.1, size, 8]} />
        <meshStandardMaterial color="#aaaaaa" metalness={0.5} roughness={0.5} />
      </mesh>
    </group>
  );
}

function buildConstellationVisual(node) {
  const seed = `${node.id}|${node.entityName || node.label}|${node.memberCount || 0}`;
  const rng = createRng(seed);
  const archetype = pickConstellationArchetype(seed);
  const baseRadius = node.radius;
  const positions = [];
  const colors = [];

  const primary = new THREE.Color(archetype.palette[0]);
  const secondary = new THREE.Color(archetype.palette[1]);
  const highlight = new THREE.Color(archetype.palette[2]);
  const temp = new THREE.Color();

  const stars = 70 + Math.floor(rng() * 60);
  if (archetype.key === "ring") {
    const ringRadius = baseRadius * (1.42 + rng() * 0.34);
    for (let i = 0; i < stars; i += 1) {
      const angle = (i / stars) * Math.PI * 2 + (rng() - 0.5) * 0.08;
      const x = Math.cos(angle) * (ringRadius + (rng() - 0.5) * 0.8);
      const y = (rng() - 0.5) * 1.1;
      const z = Math.sin(angle) * (ringRadius + (rng() - 0.5) * 0.8);
      temp.copy(secondary).lerp(highlight, rng() * 0.28);
      pushPoint(positions, colors, x, y, z, temp);
    }
  } else if (archetype.key === "crystal") {
    for (let i = 0; i < stars; i += 1) {
      const face = i % 4;
      const signX = face < 2 ? 1 : -1;
      const signZ = face % 2 === 0 ? 1 : -1;
      const dist = baseRadius * (0.9 + rng() * 1.0);
      const x = signX * dist + (rng() - 0.5) * 1.4;
      const y = (rng() - 0.5) * (baseRadius * 0.8);
      const z = signZ * dist + (rng() - 0.5) * 1.4;
      temp.copy(primary).lerp(highlight, 0.18 + rng() * 0.28);
      pushPoint(positions, colors, x, y, z, temp);
    }
  } else if (archetype.key === "irregular") {
    for (let i = 0; i < stars; i += 1) {
      const spread = baseRadius * (1.0 + rng() * 1.6);
      const x = (rng() - 0.5) * spread * 2.2;
      const y = (rng() - 0.5) * spread * 1.0;
      const z = (rng() - 0.5) * spread * 2.2;
      temp
        .copy(primary)
        .lerp(secondary, rng() * 0.65)
        .lerp(highlight, rng() * 0.1);
      pushPoint(positions, colors, x, y, z, temp);
    }
  } else if (archetype.key === "nebula") {
    for (let i = 0; i < stars; i += 1) {
      const theta = rng() * Math.PI * 2;
      const r = Math.pow(rng(), 0.72) * baseRadius * (1.35 + rng() * 0.9);
      const x = Math.cos(theta) * r;
      const y = (rng() - 0.5) * baseRadius * 0.9;
      const z = Math.sin(theta) * r;
      temp.copy(secondary).lerp(highlight, 0.2 + rng() * 0.34);
      pushPoint(positions, colors, x, y, z, temp);
    }
  } else {
    for (let i = 0; i < stars; i += 1) {
      const theta = rng() * Math.PI * 2;
      const r = Math.pow(rng(), 1.15) * baseRadius * (1.16 + rng() * 0.56);
      const x = Math.cos(theta) * r;
      const y = (rng() - 0.5) * baseRadius * 0.6;
      const z = Math.sin(theta) * r;
      temp.copy(primary).lerp(highlight, rng() * 0.32);
      pushPoint(positions, colors, x, y, z, temp);
    }
  }

  const ringCount = 1 + Math.floor(rng() * 3);
  const ringTilt = (rng() - 0.5) * 0.5;
  const rotation = [(rng() - 0.5) * 0.7, (rng() - 0.5) * 1.0, (rng() - 0.5) * 0.34];
  const pointSize = 0.4 + rng() * 0.42;
  const spinSpeed = 0.06 + rng() * 0.12;

  return {
    archetypeLabel: archetype.label,
    coreShape: archetype.coreShape,
    coreColor: highlight.getStyle(),
    rimColor: secondary.getStyle(),
    glowColor: primary.getStyle(),
    ringCount,
    ringTilt,
    rotation,
    pointSize,
    spinSpeed,
    positions: new Float32Array(positions),
    colors: new Float32Array(colors),
  };
}

export function TableNode({
  node,
  selected,
  reducedMotion = false,
  onPointerDownNode,
  onPointerUpNode,
  onSelectNode,
  onContextNode,
  onHoverNode,
  onLeaveNode,
  onUpdateLayout,
}) {
  const groupRef = useRef(null);
  const previewRef = useRef(null);
  const { camera, gl, controls } = useThree();
  const [isDragging, setDragging] = useState(false);
  const visual = useMemo(() => buildConstellationVisual(node), [node]);
  const targetScaleRef = useRef(selected ? 1.16 : 1);
  const v1Style = resolvePlanetV1Style(node.v1);
  const physics = node.physics || FALLBACK_NODE_PHYSICS;
  const stress = clamp(Number(physics?.stress) || 0, 0, 1);
  const spinFactor = clamp(Number(physics?.spinFactor) || 1, 0.82, 2.1);
  const emissiveBoost = clamp(Number(physics?.emissiveBoost) || 0, 0, 0.9);
  const auraFactor = clamp(Number(physics?.auraFactor) || 1, 0.9, 2.2);
  const alertPressure = clamp(Number(physics?.alertPressure) || 0, 0, 1);
  const corrosionLevel = clamp(Number(physics?.corrosionLevel) || 0, 0, 1);
  const crackIntensity = clamp(Number(physics?.crackIntensity) || 0, 0, 1);
  const hue = clamp(Number(physics?.hue) || 0.58, 0, 1);
  const saturation = clamp(Number(physics?.saturation) || 0.66, 0, 1);
  const phase = String(
    node.runtimePlanetPhysics?.phase || phaseFromLegacyStatus(node.v1?.status || "CALM")
  ).toUpperCase();
  const phaseVisual = useMemo(
    () =>
      resolvePlanetPhaseVisual({
        phase,
        corrosionLevel,
        crackIntensity,
        hue,
        saturation,
      }),
    [corrosionLevel, crackIntensity, hue, phase, saturation]
  );
  const signatureColor = useMemo(
    () => signatureColorFromSeed(`${node.id}|${node.entityName || node.label}`).getStyle(),
    [node.entityName, node.id, node.label]
  );
  const previewMoonCount = clamp(
    Number.isFinite(Number(node.previewMoonCountOverride))
      ? Number(node.previewMoonCountOverride)
      : Number(node.memberCount || 0),
    0,
    5
  );
  const previewOrbitRadius = node.radius * 2.15;
  const previewMoonRadius = Math.max(0.5, node.radius * 0.11);
  const previewPhase = useMemo(() => ((hashText(node.id) % 360) / 180) * Math.PI, [node.id]);

  const onDragEnd = useCallback(() => {
    if (!isDragging) return;
    setDragging(false);
    if (controls) controls.enabled = true;
    if (groupRef.current) {
      const { x, y, z } = groupRef.current.position;
      onUpdateLayout(node.id, { position: [x, y, z] });
    }
  }, [isDragging, controls, node.id, onUpdateLayout]);

  useEffect(() => {
    const interactionPlane = new THREE.Plane();
    const worldPosition = new THREE.Vector3();

    const onPointerMove = (event) => {
      if (!groupRef.current) return;
      const rect = gl.domElement.getBoundingClientRect();
      const mouse = new THREE.Vector2();
      mouse.x = ((event.clientX - rect.left) / rect.width) * 2 - 1;
      mouse.y = -((event.clientY - rect.top) / rect.height) * 2 + 1;
      groupRef.current.getWorldPosition(worldPosition);
      interactionPlane.setFromNormalAndCoplanarPoint(
        camera.position.clone().sub(worldPosition).normalize(),
        worldPosition
      );
      const raycaster = new THREE.Raycaster();
      raycaster.setFromCamera(mouse, camera);
      const intersection = new THREE.Vector3();
      if (raycaster.ray.intersectPlane(interactionPlane, intersection)) {
        groupRef.current.position.copy(intersection);
      }
    };

    if (isDragging) {
      gl.domElement.addEventListener("pointermove", onPointerMove);
      gl.domElement.addEventListener("pointerup", onDragEnd, { once: true });
    }
    return () => {
      gl.domElement.removeEventListener("pointermove", onPointerMove);
      gl.domElement.removeEventListener("pointerup", onDragEnd);
    };
  }, [isDragging, gl.domElement, camera, onDragEnd]);

  useFrame((_, delta) => {
    if (!groupRef.current) return;
    if (reducedMotion || node.isPinned) {
      const staticScale = selected ? 1.1 : 1;
      groupRef.current.scale.set(staticScale, staticScale, staticScale);
      groupRef.current.rotation.x = 0;
      groupRef.current.rotation.y = 0;
      groupRef.current.rotation.z = 0;
      if (previewRef.current) {
        previewRef.current.rotation.x = 0;
        previewRef.current.rotation.y = 0;
      }
      return;
    }
    const pulseMultiplier = phaseVisual.pulseMultiplier;
    targetScaleRef.current = (selected ? 1.16 + stress * 0.05 : 1 + stress * 0.08) * (1 + (pulseMultiplier - 1) * 0.05);
    const nextScale = THREE.MathUtils.damp(groupRef.current.scale.x, targetScaleRef.current, 7, delta);
    groupRef.current.scale.set(nextScale, nextScale, nextScale);
    groupRef.current.rotation.y += delta * visual.spinSpeed * spinFactor * phaseVisual.spinMultiplier;
    if (phaseVisual.phase === "CRITICAL") {
      const jitter = Math.sin(performance.now() * 0.015 + previewPhase) * 0.03;
      groupRef.current.rotation.x = jitter;
      groupRef.current.rotation.z = -jitter * 0.6;
    } else {
      groupRef.current.rotation.x = THREE.MathUtils.damp(groupRef.current.rotation.x, 0, 8, delta);
      groupRef.current.rotation.z = THREE.MathUtils.damp(groupRef.current.rotation.z, 0, 8, delta);
    }
    if (previewRef.current) {
      previewRef.current.rotation.y += delta * (0.2 + stress * 0.16) * phaseVisual.pulseMultiplier;
      previewRef.current.rotation.x = Math.sin(performance.now() * 0.00012 + previewPhase) * 0.07;
    }
  });

  const coreMaterial = (
    <meshStandardMaterial
      color={selected ? "#f4fbff" : phaseVisual.tint}
      emissive={selected ? "#b3eaff" : phaseVisual.emissive}
      emissiveIntensity={selected ? 1.25 : 0.58 + emissiveBoost + phaseVisual.pulseMultiplier * 0.08}
      roughness={phaseVisual.roughness}
      metalness={phaseVisual.metalness}
      transparent
      opacity={0.95}
    />
  );

  const coreGeometry =
    visual.coreShape === "octa" ? (
      <octahedronGeometry args={[node.radius, 1]} />
    ) : visual.coreShape === "dodeca" ? (
      <dodecahedronGeometry args={[node.radius * 0.96, 0]} />
    ) : visual.coreShape === "icosa" ? (
      <icosahedronGeometry args={[node.radius, 1]} />
    ) : (
      <sphereGeometry args={[node.radius, 24, 24]} />
    );

  return (
    <group ref={groupRef} position={node.position}>
      <group rotation={visual.rotation}>
        <points>
          <bufferGeometry>
            <bufferAttribute
              attach="attributes-position"
              args={[visual.positions, 3]}
              count={visual.positions.length / 3}
            />
            <bufferAttribute attach="attributes-color" args={[visual.colors, 3]} count={visual.colors.length / 3} />
          </bufferGeometry>
          <pointsMaterial
            size={(selected ? 0.92 : 0.72) * visual.pointSize}
            sizeAttenuation
            vertexColors
            transparent
            depthWrite={false}
            opacity={selected ? 0.95 : clamp(0.76 + alertPressure * 0.2, 0.76, 0.98)}
            blending={THREE.AdditiveBlending}
          />
        </points>

        <mesh>
          {coreGeometry}
          {coreMaterial}
        </mesh>

        {Array.from({ length: visual.ringCount }).map((_, idx) => {
          const factor = 1.36 + idx * 0.18;
          return (
            <mesh key={idx} rotation={[Math.PI / 2 + visual.ringTilt * (idx + 1), idx * 0.2, idx * 0.34]}>
              <torusGeometry args={[node.radius * factor, node.radius * (0.05 + idx * 0.012), 14, 100]} />
              <meshStandardMaterial
                color={selected ? visual.rimColor : phaseVisual.rim}
                emissive={selected ? visual.rimColor : phaseVisual.rim}
                emissiveIntensity={selected ? 0.98 : 0.52 + emissiveBoost * 0.72 + phaseVisual.pulseMultiplier * 0.06}
                transparent
                opacity={0.64 - idx * 0.12}
              />
            </mesh>
          );
        })}

        <mesh rotation={[Math.PI / 2, 0, 0]}>
          <torusGeometry args={[node.radius * 1.08, node.radius * (node.isPinned ? 0.042 : 0.028), 14, 120]} />
          <meshStandardMaterial
            color={signatureColor}
            emissive={signatureColor}
            emissiveIntensity={selected ? 1.05 : node.isPinned ? 1.0 : 0.72}
            transparent
            opacity={0.86}
          />
        </mesh>

        <mesh>
          <sphereGeometry args={[node.radius * 1.2, 22, 22]} />
          <meshBasicMaterial
            color={selected ? visual.glowColor : phaseVisual.aura}
            transparent
            opacity={
              selected
                ? 0.18
                : clamp(v1Style.auraOpacity * auraFactor + (phaseVisual.pulseMultiplier - 1) * 0.05, 0.11, 0.5)
            }
            depthWrite={false}
          />
        </mesh>
        <mesh>
          <sphereGeometry args={[node.radius * 1.03, 18, 18]} />
          <meshBasicMaterial
            color={phaseVisual.corrosionOverlayColor}
            transparent
            opacity={phaseVisual.corrosionOverlayOpacity}
            depthWrite={false}
          />
        </mesh>
        <mesh>
          <icosahedronGeometry args={[node.radius * 1.01, 2]} />
          <meshBasicMaterial
            color={phaseVisual.crackColor}
            wireframe
            transparent
            opacity={phaseVisual.crackOpacity}
            depthWrite={false}
          />
        </mesh>

        {previewMoonCount > 0 ? (
          <group ref={previewRef}>
            {Array.from({ length: previewMoonCount }).map((_, idx) => {
              const angle = (idx / previewMoonCount) * Math.PI * 2 + previewPhase;
              const yOffset = (idx % 2 === 0 ? 1 : -1) * node.radius * 0.14;
              return (
                <mesh
                  key={`moon-preview-${idx}`}
                  position={[Math.cos(angle) * previewOrbitRadius, yOffset, Math.sin(angle) * previewOrbitRadius]}
                >
                  <sphereGeometry args={[previewMoonRadius, 10, 10]} />
                  <meshBasicMaterial color={signatureColor} transparent opacity={0.88} />
                </mesh>
              );
            })}
          </group>
        ) : null}
        {node.isPinned ? (
          <group position={[0, node.radius + 2, 0]}>
            <PinIndicator size={1.5} />
          </group>
        ) : null}
      </group>

      <mesh
        onPointerDown={(event) => {
          if (node.isPinned) {
            event.stopPropagation();
            setDragging(true);
            if (controls) controls.enabled = false;
          } else {
            onPointerDownNode(event, node);
          }
        }}
        onPointerUp={(event) => {
          if (isDragging) {
            onDragEnd();
          } else {
            onPointerUpNode(event, node);
          }
        }}
        onPointerOver={(event) => {
          event.stopPropagation();
          setBodyCursor("pointer");
          onHoverNode?.(node);
        }}
        onPointerOut={(event) => {
          event.stopPropagation();
          setBodyCursor("auto");
          onLeaveNode?.(node);
        }}
        onClick={(event) => {
          event.stopPropagation();
          onSelectNode(node);
        }}
        onContextMenu={(event) => {
          event.stopPropagation();
          event.preventDefault();
          if (isDragging) return;
          onUpdateLayout(node.id, { isPinned: !node.isPinned });
          onContextNode(event, node);
        }}
      >
        <sphereGeometry args={[node.radius * 1.3, 22, 22]} />
        <meshBasicMaterial transparent opacity={0} depthWrite={false} />
      </mesh>

      <Billboard position={[0, node.radius + 7, 0]}>
        <Text fontSize={4.8} color="#def8ff" anchorX="center" anchorY="middle" maxWidth={72}>
          {node.label}
        </Text>
      </Billboard>
      <Billboard position={[0, node.radius + 2.8, 0]}>
        <Text fontSize={2.4} color={phaseVisual.label} anchorX="center" anchorY="middle" maxWidth={76}>
          {`${node.entityName || node.label} • ${node.memberCount || 0} mesicu kolem`}
        </Text>
      </Billboard>
      <Billboard position={[0, node.radius + 0.6, 0]}>
        <Text fontSize={1.85} color={phaseVisual.label} anchorX="center" anchorY="middle" maxWidth={76}>
          {`Klikni pro otevreni • ${phaseVisual.phase}`}
        </Text>
      </Billboard>
    </group>
  );
}

export function AsteroidNode({
  node,
  selected,
  reducedMotion = false,
  onPointerDownNode,
  onPointerUpNode,
  onSelectNode,
  onContextNode,
  onHoverNode,
  onLeaveNode,
  onUpdateLayout,
}) {
  const groupRef = useRef(null);
  const { camera, gl, controls } = useThree();
  const [isDragging, setDragging] = useState(false);
  const physics = node.physics || FALLBACK_NODE_PHYSICS;
  const stress = clamp(Number(physics?.stress) || 0, 0, 1);
  const pulseFactor = clamp(Number(physics?.pulseFactor) || 1, 0.9, 2.35);
  const emissiveBoost = clamp(Number(physics?.emissiveBoost) || 0, 0, 0.95);
  const auraFactor = clamp(Number(physics?.auraFactor) || 1, 0.9, 2.2);
  const corrosionLevel = clamp(Number(physics?.corrosionLevel) || 0, 0, 1);
  const crackIntensity = clamp(Number(physics?.crackIntensity) || 0, 0, 1);
  const hue = clamp(Number(physics?.hue) || 0.56, 0, 1);
  const saturation = clamp(Number(physics?.saturation) || 0.62, 0, 1);
  const phaseName = String(node.parentPhase || phaseFromLegacyStatus(node.v1?.status || "CALM")).toUpperCase();
  const phaseVisual = useMemo(
    () =>
      resolveMoonPhaseVisual({
        phase: phaseName,
        corrosionLevel,
        crackIntensity,
        hue,
        saturation,
      }),
    [corrosionLevel, crackIntensity, hue, phaseName, saturation]
  );
  const phase = useMemo(() => ((hashText(node.id) % 360) / 180) * Math.PI, [node.id]);

  const onDragEnd = useCallback(() => {
    if (!isDragging) return;
    setDragging(false);
    if (controls) controls.enabled = true;
    if (groupRef.current) {
      const { x, y, z } = groupRef.current.position;
      onUpdateLayout(node.id, { position: [x, y, z] });
    }
  }, [isDragging, controls, node.id, onUpdateLayout]);

  useEffect(() => {
    const interactionPlane = new THREE.Plane();
    const worldPosition = new THREE.Vector3();
    const onPointerMove = (event) => {
      if (!groupRef.current) return;
      const rect = gl.domElement.getBoundingClientRect();
      const mouse = new THREE.Vector2();
      mouse.x = ((event.clientX - rect.left) / rect.width) * 2 - 1;
      mouse.y = -((event.clientY - rect.top) / rect.height) * 2 + 1;
      groupRef.current.getWorldPosition(worldPosition);
      interactionPlane.setFromNormalAndCoplanarPoint(
        camera.position.clone().sub(worldPosition).normalize(),
        worldPosition
      );
      const raycaster = new THREE.Raycaster();
      raycaster.setFromCamera(mouse, camera);
      const intersection = new THREE.Vector3();
      if (raycaster.ray.intersectPlane(interactionPlane, intersection)) {
        groupRef.current.position.copy(intersection);
      }
    };
    if (isDragging) {
      gl.domElement.addEventListener("pointermove", onPointerMove);
      gl.domElement.addEventListener("pointerup", onDragEnd, { once: true });
    }
    return () => {
      gl.domElement.removeEventListener("pointermove", onPointerMove);
      gl.domElement.removeEventListener("pointerup", onDragEnd);
    };
  }, [isDragging, gl.domElement, camera, onDragEnd]);

  useFrame((state, delta) => {
    if (!groupRef.current) return;
    if (reducedMotion || node.isPinned) {
      const staticScale = selected ? 1.06 : 1;
      groupRef.current.scale.set(staticScale, staticScale, staticScale);
      return;
    }
    const wave = Math.sin(state.clock.elapsedTime * (0.9 + pulseFactor * 0.64) * phaseVisual.pulseMultiplier + phase);
    const targetScale = (selected ? 1.08 : 1) + wave * 0.028 * (0.3 + stress * 0.7);
    const nextScale = THREE.MathUtils.damp(groupRef.current.scale.x, targetScale, 7, delta);
    groupRef.current.scale.set(nextScale, nextScale, nextScale);
  });

  return (
    <group ref={groupRef} position={node.position}>
      <mesh>
        <icosahedronGeometry args={[node.radius, 1]} />
        <meshStandardMaterial
          color={selected ? "#ffc27b" : phaseVisual.tint}
          emissive={selected ? "#ff8d42" : phaseVisual.emissive}
          emissiveIntensity={selected ? 1.25 : 0.64 + emissiveBoost + phaseVisual.pulseMultiplier * 0.08}
          roughness={phaseVisual.roughness}
          metalness={phaseVisual.metalness}
          transparent
          opacity={0.96}
        />
      </mesh>
      {node.isPinned ? (
        <group position={[0, node.radius + 1.2, 0]}>
          <PinIndicator size={0.8} />
        </group>
      ) : null}
      <mesh
        onPointerDown={(event) => {
          if (node.isPinned && event.button === 0 && !event.shiftKey) {
            event.stopPropagation();
            setDragging(true);
            if (controls) controls.enabled = false;
          } else {
            onPointerDownNode(event, node);
          }
        }}
        onPointerUp={(event) => {
          if (isDragging) {
            onDragEnd();
          } else {
            onPointerUpNode(event, node);
          }
        }}
        onPointerOver={(event) => {
          event.stopPropagation();
          setBodyCursor("grab");
          onHoverNode?.(node);
        }}
        onPointerOut={(event) => {
          event.stopPropagation();
          setBodyCursor("auto");
          onLeaveNode?.(node);
        }}
        onClick={(event) => {
          event.stopPropagation();
          onSelectNode(node);
        }}
        onContextMenu={(event) => {
          event.stopPropagation();
          event.preventDefault();
          if (isDragging) return;
          onUpdateLayout(node.id, { isPinned: !node.isPinned });
          onContextNode(event, node);
        }}
      >
        <sphereGeometry args={[node.radius * 1.38, 18, 18]} />
        <meshBasicMaterial transparent opacity={0} depthWrite={false} />
      </mesh>
      <mesh>
        <sphereGeometry args={[node.radius * (1.45 + stress * 0.2), 20, 20]} />
        <meshBasicMaterial
          color={phaseVisual.aura}
          transparent
          opacity={selected ? 0.2 : clamp(0.12 * auraFactor + phaseVisual.corrosionOverlayOpacity * 0.2, 0.1, 0.45)}
          depthWrite={false}
        />
      </mesh>
      <mesh>
        <icosahedronGeometry args={[node.radius * 1.02, 1]} />
        <meshBasicMaterial
          color={phaseVisual.crackColor}
          wireframe
          transparent
          opacity={phaseVisual.crackOpacity}
          depthWrite={false}
        />
      </mesh>
      <Billboard position={[0, node.radius + 4.2, 0]}>
        <Text fontSize={3.2} color="#e6fbff" anchorX="center" anchorY="middle" maxWidth={54}>
          {node.label}
        </Text>
      </Billboard>
      <Billboard position={[0, node.radius + 1.8, 0]}>
        <Text fontSize={2.05} color={phaseVisual.label} anchorX="center" anchorY="middle" maxWidth={56}>
          {`Mesic • ${phaseVisual.phase}`}
        </Text>
      </Billboard>
    </group>
  );
}
