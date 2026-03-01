import { useMemo, useRef } from "react";
import { Canvas, useFrame } from "@react-three/fiber";
import { Billboard, Line, OrbitControls, Stars, Text } from "@react-three/drei";
import { Bloom, EffectComposer } from "@react-three/postprocessing";
import * as THREE from "three";

import CameraPilot from "./CameraPilot";

function curvePoints(start, end, arc = 0.24, segments = 40) {
  const control = [
    (start[0] + end[0]) * 0.5,
    (start[1] + end[1]) * 0.5 + arc * Math.max(16, Math.abs(start[0] - end[0]) + Math.abs(start[2] - end[2])),
    (start[2] + end[2]) * 0.5,
  ];
  const points = [];
  for (let i = 0; i <= segments; i += 1) {
    const t = i / segments;
    const inv = 1 - t;
    points.push([
      inv * inv * start[0] + 2 * inv * t * control[0] + t * t * end[0],
      inv * inv * start[1] + 2 * inv * t * control[1] + t * t * end[1],
      inv * inv * start[2] + 2 * inv * t * control[2] + t * t * end[2],
    ]);
  }
  return points;
}

const CONSTELLATION_ARCHETYPES = [
  { key: "cluster", label: "Cluster Core", palette: ["#79c2ff", "#8de6ff", "#d6f4ff"], coreShape: "sphere" },
  { key: "ring", label: "Ring Nexus", palette: ["#90a7ff", "#9bb8ff", "#eceeff"], coreShape: "icosa" },
  { key: "crystal", label: "Crystal Forge", palette: ["#ffd08a", "#ffbb66", "#fff1d8"], coreShape: "octa" },
  { key: "nebula", label: "Nebula Field", palette: ["#9cf3ff", "#5fcbff", "#e9fcff"], coreShape: "dodeca" },
  { key: "irregular", label: "Irregular Mesh", palette: ["#88ffd4", "#64e5c2", "#eafff5"], coreShape: "icosa" },
];

function hashText(input) {
  const text = String(input || "");
  let hash = 2166136261;
  for (let i = 0; i < text.length; i += 1) {
    hash ^= text.charCodeAt(i);
    hash = Math.imul(hash, 16777619);
  }
  return hash >>> 0;
}

function createRng(seedText) {
  let seed = hashText(seedText) || 1;
  return () => {
    seed += 0x6d2b79f5;
    let t = seed;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function pickConstellationArchetype(seedText) {
  return CONSTELLATION_ARCHETYPES[hashText(seedText) % CONSTELLATION_ARCHETYPES.length];
}

function pushPoint(positions, colors, x, y, z, color) {
  positions.push(x, y, z);
  colors.push(color.r, color.g, color.b);
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
      temp.copy(primary).lerp(secondary, rng() * 0.65).lerp(highlight, rng() * 0.1);
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

const LINK_COLORS = {
  RELATION: "#58d2ff",
  TYPE: "#91a8ff",
  FORMULA: "#84ffd1",
  GUARDIAN: "#ffb15f",
  DEFAULT: "#76d8ff",
};

const LINK_SEMANTICS = {
  RELATION: {
    directional: false,
    description: "Vzájemná vazba mezi entitami (obousměrný kontext).",
  },
  TYPE: {
    directional: true,
    description: "Tok typování: instance -> typ.",
  },
  FORMULA: {
    directional: true,
    description: "Datový tok do výpočtu: zdroj -> cíl.",
  },
  GUARDIAN: {
    directional: true,
    description: "Tok hlídacího pravidla: pozorovaný zdroj -> kontrolní cíl.",
  },
};

function resolveLinkColor(type) {
  const key = String(type || "RELATION").toUpperCase();
  return LINK_COLORS[key] || LINK_COLORS.DEFAULT;
}

function resolveStatusRank(status) {
  const key = String(status || "GREEN").toUpperCase();
  if (key === "RED") return 2;
  if (key === "YELLOW") return 1;
  return 0;
}

function resolveWorstStatus(...statuses) {
  let worst = "GREEN";
  let worstRank = 0;
  statuses.forEach((status) => {
    const rank = resolveStatusRank(status);
    if (rank > worstRank) {
      worstRank = rank;
      worst = String(status || "GREEN").toUpperCase();
    }
  });
  return worst;
}

function resolveStatusTint(status) {
  const key = String(status || "GREEN").toUpperCase();
  if (key === "RED") return "#ff5f86";
  if (key === "YELLOW") return "#ffbe57";
  return "#64d9ff";
}

function resolveLinkSemantic(type) {
  const key = String(type || "RELATION").toUpperCase();
  return LINK_SEMANTICS[key] || {
    directional: true,
    description: "Směr odpovídá source -> target.",
  };
}

function resolvePlanetV1Style(metrics) {
  const status = String(metrics?.status || "GREEN").toUpperCase();
  if (status === "RED") {
    return {
      tint: "#ffb5c9",
      emissive: "#ff5f86",
      rim: "#ff8fad",
      auraOpacity: 0.2,
    };
  }
  if (status === "YELLOW") {
    return {
      tint: "#ffe9bb",
      emissive: "#ffbe57",
      rim: "#ffd27f",
      auraOpacity: 0.17,
    };
  }
  return {
    tint: "#d6fbff",
    emissive: "#66dcff",
    rim: "#90e5ff",
    auraOpacity: 0.14,
  };
}

function resolveMoonV1Style(metrics) {
  const status = String(metrics?.status || "GREEN").toUpperCase();
  if (status === "RED") {
    return {
      color: "#ffd0dc",
      emissive: "#ff5f86",
      aura: "#ff8daa",
    };
  }
  if (status === "YELLOW") {
    return {
      color: "#ffedc8",
      emissive: "#ffbe57",
      aura: "#ffd38a",
    };
  }
  return {
    color: "#d8f3ff",
    emissive: "#3ac4ff",
    aura: "#8fe1ff",
  };
}

function samplePath(points, t) {
  const safe = Array.isArray(points) ? points : [];
  if (!safe.length) return [0, 0, 0];
  if (safe.length === 1) return safe[0];
  const total = safe.length - 1;
  const clampedT = Math.max(0, Math.min(0.9999, t));
  const scaled = clampedT * total;
  const i = Math.floor(scaled);
  const frac = scaled - i;
  const p0 = safe[i];
  const p1 = safe[Math.min(i + 1, total)];
  return [
    p0[0] + (p1[0] - p0[0]) * frac,
    p0[1] + (p1[1] - p0[1]) * frac,
    p0[2] + (p1[2] - p0[2]) * frac,
  ];
}

function LinkChannel({ link, sourceNode, targetNode, dimmed, emphasized, onHoverLink, onLeaveLink }) {
  const pulseRef = useRef(null);
  const pulse2Ref = useRef(null);
  const points = useMemo(() => {
    const arc = emphasized ? 0.1 : 0.08;
    return curvePoints(sourceNode.position, targetNode.position, arc, 40);
  }, [sourceNode, targetNode, emphasized]);

  const color = resolveLinkColor(link.type);
  const semantics = resolveLinkSemantic(link.type);
  const endpointStatus = resolveWorstStatus(sourceNode?.v1?.status, targetNode?.v1?.status);
  const v1Status = String(link?.v1?.status || endpointStatus);
  const v1Quality = Number(link?.v1?.quality_score ?? (v1Status === "RED" ? 55 : v1Status === "YELLOW" ? 78 : 95));
  const baseColor = new THREE.Color(color);
  const statusColor = new THREE.Color(resolveStatusTint(v1Status));
  const mixedColor = baseColor.clone().lerp(statusColor, 0.34).getStyle();
  const opacity = dimmed ? 0.14 : emphasized ? 0.94 : 0.74;
  const lineWidth = dimmed ? 0.3 : emphasized ? 1.8 : v1Status === "RED" ? 1.55 : v1Status === "YELLOW" ? 1.25 : 1.05;
  const pulseColor = new THREE.Color(mixedColor).lerp(new THREE.Color("#ffffff"), 0.35).getStyle();
  const speed = dimmed ? 0.12 : emphasized ? 0.34 : 0.22;
  const weight = Number(link.weight || 1);
  const sourceConstellation = String(link.source_constellation_name || sourceNode.entityName || "Unknown");
  const sourcePlanet = String(link.source_planet_name || sourceNode.planetName || sourceNode.label || "Unknown");
  const targetConstellation = String(link.target_constellation_name || targetNode.entityName || "Unknown");
  const targetPlanet = String(link.target_planet_name || targetNode.planetName || targetNode.label || "Unknown");

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
  });

  return (
    <group>
      <Line
        points={points}
        color={mixedColor}
        lineWidth={lineWidth}
        transparent
        opacity={opacity}
        onPointerOver={(event) => {
          event.stopPropagation();
          onHoverLink?.({
            id: link.id,
            type: String(link.type || "RELATION"),
            weight: weight,
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
            x: event.nativeEvent.clientX,
            y: event.nativeEvent.clientY,
          });
        }}
        onPointerOut={(event) => {
          event.stopPropagation();
          onLeaveLink?.();
        }}
      />
      {!dimmed ? (
        <>
          <mesh ref={pulseRef}>
            <sphereGeometry args={[emphasized ? 1.2 : 0.86, 12, 12]} />
            <meshBasicMaterial color={pulseColor} transparent opacity={0.95} />
          </mesh>
          <mesh ref={pulse2Ref}>
            <sphereGeometry args={[0.56, 10, 10]} />
            <meshBasicMaterial color={pulseColor} transparent opacity={0.72} />
          </mesh>
        </>
      ) : null}
    </group>
  );
}

function TableNode({ node, selected, onPointerDownNode, onPointerUpNode, onSelectNode, onContextNode }) {
  const groupRef = useRef(null);
  const visual = useMemo(() => buildConstellationVisual(node), [node.id, node.entityName, node.memberCount, node.radius, node.label]);
  const targetScaleRef = useRef(selected ? 1.16 : 1);
  const v1Style = resolvePlanetV1Style(node.v1);
  const hasV1 = Boolean(node.v1);

  useFrame((_, delta) => {
    if (!groupRef.current) return;
    targetScaleRef.current = selected ? 1.16 : 1;
    const nextScale = THREE.MathUtils.damp(groupRef.current.scale.x, targetScaleRef.current, 7, delta);
    groupRef.current.scale.set(nextScale, nextScale, nextScale);
    groupRef.current.rotation.y += delta * visual.spinSpeed;
  });

  const coreMaterial = (
    <meshStandardMaterial
      color={selected ? "#f4fbff" : visual.coreColor}
      emissive={selected ? "#b3eaff" : v1Style.emissive}
      emissiveIntensity={selected ? 1.25 : 0.62}
      roughness={0.28}
      metalness={0.52}
      transparent
      opacity={0.95}
    />
  );

  const coreGeometry = visual.coreShape === "octa"
    ? <octahedronGeometry args={[node.radius, 1]} />
    : visual.coreShape === "dodeca"
      ? <dodecahedronGeometry args={[node.radius * 0.96, 0]} />
      : visual.coreShape === "icosa"
        ? <icosahedronGeometry args={[node.radius, 1]} />
        : <sphereGeometry args={[node.radius, 24, 24]} />;

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
            <bufferAttribute
              attach="attributes-color"
              args={[visual.colors, 3]}
              count={visual.colors.length / 3}
            />
          </bufferGeometry>
          <pointsMaterial
            size={(selected ? 0.92 : 0.72) * visual.pointSize}
            sizeAttenuation
            vertexColors
            transparent
            depthWrite={false}
            opacity={selected ? 0.95 : 0.78}
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
                color={visual.rimColor}
                emissive={selected ? visual.rimColor : v1Style.rim}
                emissiveIntensity={selected ? 0.98 : 0.58}
                transparent
                opacity={0.64 - idx * 0.12}
              />
            </mesh>
          );
        })}

        <mesh>
          <sphereGeometry args={[node.radius * 1.2, 22, 22]} />
          <meshBasicMaterial
            color={selected ? visual.glowColor : v1Style.emissive}
            transparent
            opacity={selected ? 0.18 : v1Style.auraOpacity}
            depthWrite={false}
          />
        </mesh>
      </group>

      <mesh
        onPointerDown={(event) => onPointerDownNode(event, node)}
        onPointerUp={(event) => onPointerUpNode(event, node)}
        onClick={(event) => {
          event.stopPropagation();
          onSelectNode(node);
        }}
        onContextMenu={(event) => onContextNode(event, node)}
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
        <Text fontSize={2.4} color={hasV1 ? v1Style.tint : "#aee9ff"} anchorX="center" anchorY="middle" maxWidth={76}>
          {`${node.entityName || node.label} • ${node.memberCount || 0} mesicu`}
        </Text>
      </Billboard>
      <Billboard position={[0, node.radius + 0.6, 0]}>
        <Text fontSize={1.85} color="#8ccce0" anchorX="center" anchorY="middle" maxWidth={76}>
          {hasV1 ? `V1 ${node.v1.status} • ${node.v1.quality_score}/100` : visual.archetypeLabel}
        </Text>
      </Billboard>
    </group>
  );
}

function AsteroidNode({ node, selected, onPointerDownNode, onPointerUpNode, onSelectNode, onContextNode }) {
  const v1Style = resolveMoonV1Style(node.v1);
  const hasV1 = Boolean(node.v1);
  return (
    <group position={node.position}>
      <mesh
        onPointerDown={(event) => onPointerDownNode(event, node)}
        onPointerUp={(event) => onPointerUpNode(event, node)}
        onClick={(event) => {
          event.stopPropagation();
          onSelectNode(node);
        }}
        onContextMenu={(event) => onContextNode(event, node)}
      >
        <icosahedronGeometry args={[node.radius, 1]} />
        <meshStandardMaterial
          color={selected ? "#ffc27b" : v1Style.color}
          emissive={selected ? "#ff8d42" : v1Style.emissive}
          emissiveIntensity={selected ? 1.25 : 0.7}
          roughness={0.35}
          metalness={0.2}
          transparent
          opacity={0.96}
        />
      </mesh>
      <mesh>
        <sphereGeometry args={[node.radius * 1.45, 20, 20]} />
        <meshBasicMaterial color={v1Style.aura} transparent opacity={selected ? 0.2 : 0.12} depthWrite={false} />
      </mesh>
      <Billboard position={[0, node.radius + 4.2, 0]}>
        <Text fontSize={3.2} color="#e6fbff" anchorX="center" anchorY="middle" maxWidth={54}>
          {node.label}
        </Text>
      </Billboard>
      <Billboard position={[0, node.radius + 1.8, 0]}>
        <Text fontSize={2.05} color="#96dfff" anchorX="center" anchorY="middle" maxWidth={56}>
          {hasV1 ? `Mesic • ${node.v1.status}` : "Mesic"}
        </Text>
      </Billboard>
    </group>
  );
}

export default function UniverseCanvas({
  level,
  tableNodes,
  asteroidNodes,
  tableLinks,
  asteroidLinks,
  cameraState,
  selectedTableId,
  selectedAsteroidId,
  linkDraft,
  onSelectTable,
  onSelectAsteroid,
  onOpenContext,
  onLinkStart,
  onLinkMove,
  onLinkComplete,
  onLinkCancel,
  onHoverLink,
  onLeaveLink,
}) {
  const controlsRef = useRef(null);
  const dragRef = useRef(null);
  const interactionPlane = useMemo(() => new THREE.Plane(new THREE.Vector3(0, 0, 1), 0), []);

  const tableById = useMemo(() => new Map(tableNodes.map((node) => [node.id, node])), [tableNodes]);
  const asteroidById = useMemo(() => new Map(asteroidNodes.map((node) => [node.id, node])), [asteroidNodes]);

  const selectedTableNode = selectedTableId ? tableById.get(selectedTableId) || null : null;
  const selectedAsteroidNode = selectedAsteroidId ? asteroidById.get(selectedAsteroidId) || null : null;

  const resolveLinePoint = (event) => {
    const out = new THREE.Vector3();
    const hit = event.ray?.intersectPlane?.(interactionPlane, out);
    if (!hit) return [0, 0, 0];
    return [hit.x, hit.y, hit.z];
  };

  const beginNodeDrag = (event, node) => {
    if (event.button !== 0) return;
    if (level < 3) return;
    if (node.kind !== "asteroid") return;
    if (!event.shiftKey) return;
    event.stopPropagation();
    dragRef.current = {
      sourceId: node.id,
      sourceKind: node.kind,
      moved: false,
      startX: event.clientX,
      startY: event.clientY,
    };
    const from = [node.position[0], node.position[1], node.position[2]];
    onLinkStart({ sourceId: node.id, sourceKind: node.kind, from, to: from });
  };

  const endNodeDrag = (event, node) => {
    if (event.button !== 0) return;
    const draft = dragRef.current;
    if (!draft || draft.sourceId !== linkDraft?.sourceId) return;
    event.stopPropagation();
    if (draft.moved && draft.sourceId !== node.id && draft.sourceKind === "asteroid" && node.kind === "asteroid") {
      onLinkComplete({
        sourceId: draft.sourceId,
        sourceKind: draft.sourceKind,
        targetId: node.id,
        targetKind: node.kind,
      });
    }

    dragRef.current = null;
    onLinkCancel();
  };

  const onBackgroundMove = (event) => {
    const draft = dragRef.current;
    if (!draft) return;
    const dx = event.clientX - draft.startX;
    const dy = event.clientY - draft.startY;
    if (!draft.moved && Math.sqrt(dx * dx + dy * dy) > 6) {
      draft.moved = true;
    }
    onLinkMove(resolveLinePoint(event));
  };

  const onBackgroundUp = (event) => {
    if (event.button !== 0) return;
    if (dragRef.current) {
      dragRef.current = null;
      onLinkCancel();
    }
  };

  const resolveLinkEndpoint = (value) => {
    if (!value) return "";
    if (typeof value === "object") return String(value.id || "");
    return String(value);
  };

  return (
    <Canvas
      camera={{
        position: cameraState.position,
        fov: 54,
        near: 0.1,
        far: 8000,
      }}
      gl={{ antialias: true, toneMapping: THREE.ACESFilmicToneMapping, toneMappingExposure: 1.18 }}
      style={{ width: "100vw", height: "100vh", background: "#020205" }}
      onPointerMove={onBackgroundMove}
      onPointerUp={onBackgroundUp}
      onPointerMissed={() => {
        dragRef.current = null;
        onLinkCancel();
      }}
    >
      <color attach="background" args={["#020205"]} />
      <fog attach="fog" args={["#020205", 260, 1600]} />

      <ambientLight intensity={0.46} />
      <directionalLight position={[240, 220, 200]} intensity={1.1} color="#b5e8ff" />
      <directionalLight position={[-220, -120, -180]} intensity={0.38} color="#6fa5ff" />

      <Stars radius={2200} depth={900} count={8200} factor={8} saturation={0} fade speed={0.1} />

      {level < 3
        ? tableLinks.map((link) => {
            const sourceId = resolveLinkEndpoint(link.source);
            const targetId = resolveLinkEndpoint(link.target);
            const sourceNode = tableById.get(sourceId);
            const targetNode = tableById.get(targetId);
            if (!sourceNode || !targetNode) return null;
            const isRelated = selectedTableId
              ? sourceId === String(selectedTableId) || targetId === String(selectedTableId)
              : true;
            return (
              <LinkChannel
                key={String(link.id)}
                link={link}
                sourceNode={sourceNode}
                targetNode={targetNode}
                dimmed={!isRelated}
                emphasized={isRelated}
                onHoverLink={onHoverLink}
                onLeaveLink={onLeaveLink}
              />
            );
          })
        : null}
      {level >= 3
        ? asteroidLinks.map((link) => {
            const sourceId = resolveLinkEndpoint(link.source);
            const targetId = resolveLinkEndpoint(link.target);
            const sourceNode = asteroidById.get(sourceId);
            const targetNode = asteroidById.get(targetId);
            if (!sourceNode || !targetNode) return null;
            const isRelated = selectedAsteroidId
              ? sourceId === String(selectedAsteroidId) || targetId === String(selectedAsteroidId)
              : true;
            return (
              <LinkChannel
                key={String(link.id)}
                link={link}
                sourceNode={sourceNode}
                targetNode={targetNode}
                dimmed={!isRelated}
                emphasized={isRelated}
                onHoverLink={onHoverLink}
                onLeaveLink={onLeaveLink}
              />
            );
          })
        : null}

      {tableNodes.map((node) => (
        <TableNode
          key={node.id}
          node={node}
          selected={node.id === selectedTableId}
          onPointerDownNode={beginNodeDrag}
          onPointerUpNode={endNodeDrag}
          onSelectNode={(current) => onSelectTable(current.id)}
          onContextNode={(event, current) => {
            event.stopPropagation();
            event.preventDefault();
            onOpenContext({
              kind: "table",
              id: current.id,
              label: current.label,
              x: event.nativeEvent.clientX,
              y: event.nativeEvent.clientY,
            });
          }}
        />
      ))}

      {level >= 3
        ? asteroidNodes.map((node) => (
            <AsteroidNode
              key={node.id}
              node={node}
              selected={node.id === selectedAsteroidId}
              onPointerDownNode={beginNodeDrag}
              onPointerUpNode={endNodeDrag}
              onSelectNode={(current) => onSelectAsteroid(current.id)}
              onContextNode={(event, current) => {
                event.stopPropagation();
                event.preventDefault();
                onOpenContext({
                  kind: "asteroid",
                  id: current.id,
                  label: current.label,
                  x: event.nativeEvent.clientX,
                  y: event.nativeEvent.clientY,
                });
              }}
            />
          ))
        : null}

      {linkDraft?.from && linkDraft?.to ? (
        <Line
          points={curvePoints(linkDraft.from, linkDraft.to, 0.03, 20)}
          color="#9de8ff"
          lineWidth={2}
          transparent
          opacity={0.88}
        />
      ) : null}

      <EffectComposer>
        <Bloom intensity={0.62} luminanceThreshold={0.1} luminanceSmoothing={0.34} mipmapBlur />
      </EffectComposer>

      <OrbitControls
        ref={controlsRef}
        makeDefault
        enableDamping
        dampingFactor={0.08}
        minDistance={cameraState.minDistance}
        maxDistance={cameraState.maxDistance}
      />
      <CameraPilot
        controlsRef={controlsRef}
        cameraState={cameraState}
        tableNodes={tableNodes}
        selectedTableNode={selectedTableNode}
        selectedAsteroidNode={selectedAsteroidNode}
        focusKey={`${level}:${selectedTableId || "-"}:${selectedAsteroidId || "-"}`}
      />
    </Canvas>
  );
}
