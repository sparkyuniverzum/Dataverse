import { useMemo, useRef } from "react";
import { useFrame } from "@react-three/fiber";
import { Billboard, Line, Text } from "@react-three/drei";
import * as THREE from "three";

import { normalizePhase, resolveLinkPhaseVisual } from "./physicsSystem";
import { clamp, curvePoints, samplePath, setBodyCursor } from "./sceneMath";

const FALLBACK_LINK_PHYSICS = Object.freeze({
  stress: 0,
  flow: 0,
  widthFactor: 1,
  speedFactor: 1,
  opacityFactor: 1,
  pulseSizeFactor: 1,
});

const LINK_COLORS = {
  RELATION: "#58d2ff",
  TYPE: "#91a8ff",
  FLOW: "#84ffd1",
  FORMULA: "#84ffd1",
  GUARDIAN: "#ffb15f",
  DEFAULT: "#76d8ff",
};

const LINK_SEMANTICS = {
  RELATION: {
    directional: false,
    description: "Obecny vztah mezi dvema mesici (obousmerne).",
  },
  TYPE: {
    directional: true,
    description: "Mesic A patri pod typ/tridu B.",
  },
  FORMULA: {
    directional: true,
    description: "Data pro vypocet jdou ze zdroje do cile.",
  },
  FLOW: {
    directional: true,
    description: "Data tecou ze zdroje do cile.",
  },
  GUARDIAN: {
    directional: true,
    description: "Mesic A hlida nebo spousti kontrolu nad B.",
  },
};

function resolveBondTypeLabel(type) {
  const key = String(type || "RELATION").toUpperCase();
  if (key === "RELATION") return "Vztah";
  if (key === "TYPE") return "Typ";
  if (key === "FLOW" || key === "FORMULA") return "Tok dat";
  if (key === "GUARDIAN") return "Kontrola";
  return key;
}

function resolveLinkColor(type) {
  const key = String(type || "RELATION").toUpperCase();
  return LINK_COLORS[key] || LINK_COLORS.DEFAULT;
}

function resolveLinkSemantic(link) {
  const key = String(link?.type || "RELATION").toUpperCase();
  const byType = LINK_SEMANTICS[key] || {
    directional: true,
    description: "Směr odpovídá source -> target.",
  };
  const directional = typeof link?.directional === "boolean" ? link.directional : byType.directional;
  return {
    directional,
    description: String(link?.description || byType.description),
  };
}

export function LinkChannel({
  link,
  sourceNode,
  targetNode,
  dimmed,
  emphasized,
  onHoverLink,
  onLeaveLink,
  onSelectLink,
}) {
  const pulseRef = useRef(null);
  const pulse2Ref = useRef(null);
  const trailRefs = useRef([]);
  const linkPhysics = link?.physics || FALLBACK_LINK_PHYSICS;
  const stress = clamp(Number(linkPhysics?.stress) || 0, 0, 1);
  const flow = clamp(Number(linkPhysics?.flow) || 0, 0, 1);
  const widthFactor = clamp(Number(linkPhysics?.widthFactor) || 1, 0.9, 2.35);
  const speedFactor = clamp(Number(linkPhysics?.speedFactor) || 1, 0.82, 2.5);
  const opacityFactor = clamp(Number(linkPhysics?.opacityFactor) || 1, 0.9, 1.18);
  const pulseSizeFactor = clamp(Number(linkPhysics?.pulseSizeFactor) || 1, 0.9, 2.3);

  const points = useMemo(() => {
    const arc = (emphasized ? 0.1 : 0.08) + stress * 0.04 + flow * 0.02;
    return curvePoints(sourceNode.position, targetNode.position, arc, 40);
  }, [sourceNode, targetNode, emphasized, flow, stress]);

  const interactionCurve = useMemo(
    () => new THREE.CatmullRomCurve3(points.map((point) => new THREE.Vector3(point[0], point[1], point[2]))),
    [points]
  );

  const color = resolveLinkColor(link.type);
  const semantics = resolveLinkSemantic(link);
  const sourcePhase = normalizePhase(
    link.source_phase || linkPhysics.sourcePhase || sourceNode?.runtimePlanetPhysics?.phase || sourceNode?.parentPhase
  );
  const targetPhase = normalizePhase(
    link.target_phase || linkPhysics.targetPhase || targetNode?.runtimePlanetPhysics?.phase || targetNode?.parentPhase
  );
  const sourceCorrosionLevel = clamp(
    Number(link.source_corrosion_level ?? linkPhysics.sourceCorrosionLevel ?? sourceNode?.physics?.corrosionLevel) || 0,
    0,
    1
  );
  const targetCorrosionLevel = clamp(
    Number(link.target_corrosion_level ?? linkPhysics.targetCorrosionLevel ?? targetNode?.physics?.corrosionLevel) || 0,
    0,
    1
  );
  const phaseVisual = resolveLinkPhaseVisual({
    sourcePhase,
    targetPhase,
    sourceCorrosionLevel,
    targetCorrosionLevel,
    flow,
    stress,
  });
  const v1Status = phaseVisual.dominantPhase;
  const v1Quality = Math.round((1 - Math.max(sourceCorrosionLevel, targetCorrosionLevel)) * 100);
  const baseColor = new THREE.Color(color);
  const phaseColor = new THREE.Color(phaseVisual.color);
  const mixedColor = baseColor.clone().lerp(phaseColor, 0.52).getStyle();
  const opacity = clamp(
    (dimmed ? 0.14 : emphasized ? 0.94 : 0.74) * opacityFactor * phaseVisual.opacityMultiplier,
    0.12,
    0.98
  );
  const lineWidth = (dimmed ? 0.3 : emphasized ? 1.8 : 1.15) * widthFactor * phaseVisual.widthMultiplier;
  const pulseColor = new THREE.Color(phaseVisual.pulseColor).lerp(new THREE.Color("#ffffff"), 0.18).getStyle();
  const speed = (dimmed ? 0.12 : emphasized ? 0.34 : 0.22) * speedFactor * phaseVisual.speedMultiplier;
  const weight = Number(link.weight || 1);
  const sourceConstellation = String(link.source_constellation_name || sourceNode.entityName || "Unknown");
  const sourcePlanet = String(link.source_planet_name || sourceNode.planetName || sourceNode.label || "Unknown");
  const targetConstellation = String(link.target_constellation_name || targetNode.entityName || "Unknown");
  const targetPlanet = String(link.target_planet_name || targetNode.planetName || targetNode.label || "Unknown");
  const labelPoint = samplePath(points, 0.5);
  const typeLabel = resolveBondTypeLabel(link.type);
  const directionLabel = semantics.directional ? "->" : "<->";
  const interactionRadius = clamp((emphasized ? 2.8 : 2.4) + (stress + flow) * 0.45, 2.2, 4.2);
  const activeFlow = flow > 0.2 || stress > 0.24 || emphasized || phaseVisual.severity >= 2;
  const trailCount = semantics.directional ? 6 : 4;

  const buildHoverPayload = (event) => ({
    id: link.id,
    type: resolveBondTypeLabel(link.type),
    weight,
    sourceLabel: sourceNode.label,
    targetLabel: targetNode.label,
    sourceConstellation,
    sourcePlanet,
    targetConstellation,
    targetPlanet,
    directional: semantics.directional,
    description: semantics.description,
    v1Status,
    v1Quality,
    sourcePhase,
    targetPhase,
    physicsStress: stress,
    physicsFlow: flow,
    x: event.nativeEvent.clientX,
    y: event.nativeEvent.clientY,
  });

  useFrame((state) => {
    if (dimmed) return;
    const elapsed = state.clock.elapsedTime;
    if (pulseRef.current) {
      const p = samplePath(points, (elapsed * speed + (weight % 5) * 0.09) % 1);
      pulseRef.current.position.set(p[0], p[1], p[2]);
    }
    if (pulse2Ref.current) {
      const secondT = semantics.directional
        ? (elapsed * speed + 0.5 + (weight % 7) * 0.07) % 1
        : 1 - ((elapsed * speed + (weight % 7) * 0.07) % 1);
      const p = samplePath(points, secondT);
      pulse2Ref.current.position.set(p[0], p[1], p[2]);
    }
    for (let idx = 0; idx < trailCount; idx += 1) {
      const node = trailRefs.current[idx];
      if (!node) continue;
      const offset = (idx + 1) / (trailCount + 1);
      const travel = (elapsed * speed + (weight % 11) * 0.03 + offset) % 1;
      const t = semantics.directional ? travel : idx % 2 === 0 ? travel : 1 - travel;
      const p = samplePath(points, t);
      node.position.set(p[0], p[1], p[2]);
    }
  });

  return (
    <group>
      <Line
        points={points}
        color={mixedColor}
        lineWidth={lineWidth}
        transparent
        opacity={opacity}
        raycast={() => null}
      />
      <mesh
        onPointerOver={(event) => {
          event.stopPropagation();
          setBodyCursor("pointer");
          onHoverLink?.(buildHoverPayload(event));
        }}
        onPointerMove={(event) => {
          event.stopPropagation();
          onHoverLink?.(buildHoverPayload(event));
        }}
        onClick={(event) => {
          event.stopPropagation();
          onSelectLink?.({
            id: link.id,
            type: String(link.type || "RELATION"),
            directional: semantics.directional,
            source_id: link.source_id || link.source,
            target_id: link.target_id || link.target,
            x: event.nativeEvent.clientX,
            y: event.nativeEvent.clientY,
          });
        }}
        onPointerOut={(event) => {
          event.stopPropagation();
          setBodyCursor("auto");
          onLeaveLink?.();
        }}
      >
        <tubeGeometry args={[interactionCurve, 54, interactionRadius, 10, false]} />
        <meshBasicMaterial transparent opacity={0} depthWrite={false} side={THREE.DoubleSide} />
      </mesh>
      <Billboard position={labelPoint}>
        <Text
          raycast={() => null}
          fontSize={emphasized ? 2.15 : 1.85}
          color={mixedColor}
          anchorX="center"
          anchorY="middle"
          maxWidth={48}
        >
          {`${typeLabel} ${directionLabel}`}
        </Text>
      </Billboard>
      {!dimmed && activeFlow ? (
        <>
          <mesh ref={pulseRef}>
            <sphereGeometry
              args={[(emphasized ? 1.2 : 0.86) * pulseSizeFactor * phaseVisual.pulseMultiplier, 12, 12]}
            />
            <meshBasicMaterial color={pulseColor} transparent opacity={0.95} />
          </mesh>
          <mesh ref={pulse2Ref}>
            <sphereGeometry args={[0.56 * pulseSizeFactor * phaseVisual.pulseMultiplier, 10, 10]} />
            <meshBasicMaterial color={pulseColor} transparent opacity={0.72} />
          </mesh>
          {Array.from({ length: trailCount }).map((_, idx) => (
            <mesh
              key={`trail-${idx}`}
              ref={(node) => {
                trailRefs.current[idx] = node;
              }}
            >
              <sphereGeometry args={[(0.2 + (idx % 3) * 0.07) * pulseSizeFactor, 8, 8]} />
              <meshBasicMaterial color={pulseColor} transparent opacity={semantics.directional ? 0.56 : 0.42} />
            </mesh>
          ))}
        </>
      ) : null}
    </group>
  );
}
