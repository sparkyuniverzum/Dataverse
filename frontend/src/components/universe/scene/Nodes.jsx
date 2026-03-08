import { useMemo, useRef, useState, useEffect } from "react";
import { useFrame, useThree } from "@react-three/fiber";
import { Text, Torus } from "@react-three/drei";
import * as THREE from "three";
import { animated, useSpring } from "@react-spring/three";
import { useGesture } from "@use-gesture/react";

import { clamp, createRng, hashText, setBodyCursor } from "./sceneMath";
import { phaseFromLegacyStatus, resolveMoonPhaseVisual, resolvePlanetPhaseVisual } from "./physicsSystem";
import { resolvePlanetV1Style, signatureColorFromSeed } from "./sceneStyling";


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
  const { camera } = useThree();
  const phase = String(
    node.runtimePlanetPhysics?.phase || phaseFromLegacyStatus(node.v1?.status || "CALM")
  ).toUpperCase();
  const phaseVisual = useMemo(
    () =>
      resolvePlanetPhaseVisual({
        phase,
        isConverging: node.runtimePulse?.is_converging,
        corrosionLevel: node.physics?.corrosionLevel,
        crackIntensity: node.physics?.crackIntensity,
        hue: node.physics?.hue,
        saturation: node.physics?.saturation,
      }),
    [
      node.physics?.corrosionLevel,
      node.physics?.crackIntensity,
      node.physics?.hue,
      node.physics?.saturation,
      node.runtimePlanetPhysics?.phase,
      node.runtimePulse?.is_converging,
      node.v1?.status,
    ]
  );

  const [spring, api] = useSpring(() => ({
    position: node.position,
    scale: 1,
    config: { mass: 1, tension: 200, friction: 26 },
  }));

  useEffect(() => {
    // Fyzika aktualizuje pozici, pouze pokud uzel není ukotvený
    if (!node.isPinned) {
      api.start({ position: node.position });
    }
    api.start({ scale: selected ? 1.15 : 1 });
  }, [node.position, node.isPinned, selected, api]);

  useFrame((state, delta) => {
    if (!groupRef.current || reducedMotion || node.isPinned) return;
    const t = state.clock.getElapsedTime();
    groupRef.current.rotation.y = t * 0.08 * (phaseVisual.spinMultiplier || 1);
    const scale = THREE.MathUtils.damp(
      groupRef.current.scale.x,
      selected ? 1.15 : 1,
      8,
      delta
    );
    groupRef.current.scale.set(scale, scale, scale);
  });

  const bind = useGesture(
    {
      onDrag: ({ event, first, down }) => {
        event.stopPropagation();
        if (first) {
          setBodyCursor("grabbing");
          if (node.isPinned) {
            onUpdateLayout?.(node.id, { isPinned: false });
          }
        }
        if (!down) {
          const finalPosition = spring.position.get();
          onUpdateLayout?.(node.id, { position: finalPosition, isPinned: true });
          setBodyCursor("grab");
          return;
        }

        const plane = new THREE.Plane().setFromNormalAndCoplanarPoint(
          camera.position.clone().normalize().negate(),
          new THREE.Vector3(...spring.position.get())
        );
        const intersection = new THREE.Vector3();
        event.ray.intersectPlane(plane, intersection);
        api.start({ position: [intersection.x, intersection.y, intersection.z] });
      },
      onHover: ({ hovering }) => {
        if (hovering) {
          onHoverNode?.(node);
          setBodyCursor("grab");
        } else {
          onLeaveNode?.(node);
          setBodyCursor("auto");
        }
      },
      onClick: ({ event }) => {
        event.stopPropagation();
        onSelectNode?.(node);
      },
    },
    {
      drag: {
        filterTaps: true,
        pointer: { buttons: [1] },
        from: () => spring.position.get(),
      },
    }
  );

  const handleContextMenu = (event) => {
    event.stopPropagation();
    event.preventDefault();
    if (node.isPinned) {
      onUpdateLayout?.(node.id, { isPinned: false });
    } else {
      onContextNode?.(event, node);
    }
  };

  return (
    <animated.group
      {...spring}
      {...bind()}
      ref={groupRef}
      onPointerDown={(e) => onPointerDownNode?.(e, node)}
      onPointerUp={(e) => onPointerUpNode?.(e, node)}
      onContextMenu={handleContextMenu}
    >
      <mesh>
        <sphereGeometry args={[node.radius, 32, 32]} />
        <meshStandardMaterial
          color={phaseVisual.tint}
          emissive={phaseVisual.emissive}
          emissiveIntensity={0.8}
          roughness={phaseVisual.roughness}
          metalness={phaseVisual.metalness}
        />
      </mesh>
      {node.isPinned && (
        <Torus args={[node.radius * 1.2, 0.4, 2, 64]} rotation-x={Math.PI / 2}>
          <meshBasicMaterial color="#7fffff" toneMapped={false} transparent opacity={0.7} />
        </Torus>
      )}
      <Text
        position={[0, -node.radius - 2, 0]}
        fontSize={4}
        color={phaseVisual.label}
        anchorX="center"
        anchorY="top"
        maxWidth={40}
      >
        {node.label}
      </Text>
    </animated.group>
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
  const { camera } = useThree();
  const phaseName = String(node.parentPhase || phaseFromLegacyStatus(node.v1?.status || "CALM")).toUpperCase();
  const phaseVisual = useMemo(
    () =>
      resolveMoonPhaseVisual({
        phase: phaseName,
        isConverging: node.runtimePulse?.is_converging,
        corrosionLevel: node.physics?.corrosionLevel,
        crackIntensity: node.physics?.crackIntensity,
        hue: node.physics?.hue,
        saturation: node.physics?.saturation,
      }),
    [
      node.physics?.corrosionLevel,
      node.physics?.crackIntensity,
      node.physics?.hue,
      node.physics?.saturation,
      node.parentPhase,
      node.runtimePulse?.is_converging,
      node.v1?.status,
    ]
  );

  const [spring, api] = useSpring(() => ({
    position: node.position,
    scale: 1,
    config: { mass: 1, tension: 210, friction: 30 },
  }));

  useEffect(() => {
    if (!node.isPinned) {
      api.start({ position: node.position });
    }
    api.start({ scale: selected ? 1.2 : 1 });
  }, [node.position, node.isPinned, selected, api]);

  useFrame((state, delta) => {
    if (!groupRef.current || reducedMotion || node.isPinned) return;
    const t = state.clock.getElapsedTime();
    groupRef.current.rotation.y = t * 0.12 * (phaseVisual.spinMultiplier || 1);
    groupRef.current.rotation.x = t * 0.05 * (phaseVisual.spinMultiplier || 1);
    const scale = THREE.MathUtils.damp(
      groupRef.current.scale.x,
      selected ? 1.2 : 1,
      8,
      delta
    );
    groupRef.current.scale.set(scale, scale, scale);
  });

  const bind = useGesture(
    {
      onDrag: ({ event, first, down }) => {
        event.stopPropagation();
        if (first) {
          setBodyCursor("grabbing");
          if (node.isPinned) {
            onUpdateLayout?.(node.id, { isPinned: false });
          }
        }
        if (!down) {
          const finalPosition = spring.position.get();
          onUpdateLayout?.(node.id, { position: finalPosition, isPinned: true });
          setBodyCursor("grab");
          return;
        }
        const plane = new THREE.Plane().setFromNormalAndCoplanarPoint(
          camera.position.clone().normalize().negate(),
          new THREE.Vector3(...spring.position.get())
        );
        const intersection = new THREE.Vector3();
        event.ray.intersectPlane(plane, intersection);
        api.start({ position: [intersection.x, intersection.y, intersection.z] });
      },
      onHover: ({ hovering }) => {
        if (hovering) {
          onHoverNode?.(node);
          setBodyCursor("grab");
        } else {
          onLeaveNode?.(node);
          setBodyCursor("auto");
        }
      },
      onClick: ({ event }) => {
        event.stopPropagation();
        onSelectNode?.(node);
      },
    },
    {
      drag: {
        filterTaps: true,
        pointer: { buttons: [1] },
        from: () => spring.position.get(),
      },
    }
  );

  const handleContextMenu = (event) => {
    event.stopPropagation();
    event.preventDefault();
    if (node.isPinned) {
      onUpdateLayout?.(node.id, { isPinned: false });
    } else {
      onContextNode?.(event, node);
    }
  };

  return (
    <animated.group
      {...spring}
      {...bind()}
      ref={groupRef}
      onPointerDown={(e) => onPointerDownNode?.(e, node)}
      onPointerUp={(e) => onPointerUpNode?.(e, node)}
      onContextMenu={handleContextMenu}
    >
      <mesh>
        <icosahedronGeometry args={[node.radius, 1]} />
        <meshStandardMaterial
          color={phaseVisual.tint}
          emissive={phaseVisual.emissive}
          emissiveIntensity={0.8}
          roughness={phaseVisual.roughness}
          metalness={phaseVisual.metalness}
        />
      </mesh>
      {node.isPinned && (
        <Torus args={[node.radius * 1.4, 0.25, 2, 48]} rotation-x={Math.PI / 2}>
          <meshBasicMaterial color="#96feff" toneMapped={false} transparent opacity={0.6} />
        </Torus>
      )}
      <Text
        position={[0, -node.radius - 1, 0]}
        fontSize={3}
        color={phaseVisual.label}
        anchorX="center"
        anchorY="top"
        maxWidth={30}
      >
        {node.label}
      </Text>
    </animated.group>
  );
}
