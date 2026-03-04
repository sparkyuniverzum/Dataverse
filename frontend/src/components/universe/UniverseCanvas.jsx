import { useEffect, useMemo, useRef, useState } from "react";
import { Canvas, useFrame } from "@react-three/fiber";
import { Billboard, Line, OrbitControls, Stars, Text } from "@react-three/drei";
import { Bloom, EffectComposer } from "@react-three/postprocessing";
import * as THREE from "three";

import CameraPilot from "./CameraPilot";

function clamp(value, min, max) {
  return Math.max(min, Math.min(max, value));
}

function setBodyCursor(cursor) {
  if (typeof document === "undefined" || !document.body) return;
  document.body.style.cursor = cursor;
}

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

function signatureColorFromSeed(seedText) {
  const hue = (hashText(seedText) % 360) / 360;
  const color = new THREE.Color();
  color.setHSL(hue, 0.66, 0.6);
  return color;
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

const FALLBACK_LINK_PHYSICS = Object.freeze({
  stress: 0,
  flow: 0,
  widthFactor: 1,
  speedFactor: 1,
  opacityFactor: 1,
  pulseSizeFactor: 1,
});

const COMMAND_METEOR_HINTS = [
  "/grid",
  "/3d",
  "Ukaz : cil",
  "A + B",
  "A.pole := hodnota",
  ":help",
];
const METEOR_CYCLE_SECONDS = 180;
const METEOR_SHOWER_SECONDS = 42;
const METEOR_FALL_SECONDS = 22;

function MouseGuideOverlay({ level, hoveredNode }) {
  const [expanded, setExpanded] = useState(false);
  const isTablesLevel = level < 3;
  const title = isTablesLevel ? "L2 objekty: Souhvezdi / Planety" : "L3 objekty: Mesice";
  const lines = isTablesLevel
    ? [
        "Levy klik na planetu: otevres tabulku a jeji mesice.",
        "Pravy klik na planetu: akce (vstoupit/zpet).",
        "Male body kolem planety jsou mesice (nahled).",
        "Tazenim pozadi otacis kamerou, koleckem zoomujes.",
      ]
    : [
        "Levy klik na mesic: otevres detail radku tabulky.",
        "Pravy klik na mesic: akce (upravit/zhasnout).",
        "Nova vazba: pretahni mesic na mesic (prave tlacitko).",
        "Vazbu vyberes klikem na svetelnou krivku nebo jeji popisek.",
      ];

  const hoverTip = hoveredNode
    ? hoveredNode.kind === "table"
      ? `Objekt ${hoveredNode.label}: levy klik otevre detail, pravy klik otevre akce.`
      : `Objekt ${hoveredNode.label}: levy klik detail, pravy klik akce, pretazenim vytvoris vazbu.`
    : isTablesLevel
      ? "Najed mysi na planetu a hned uvidis, co muzes udelat."
      : "Propojeni mezi mesici vytvoris pretazenim.";
  const compactHint = isTablesLevel
    ? "LMB planeta: otevres tabulku. RMB: akce."
    : "LMB mesic: detail radku. RMB: akce.";

  useEffect(() => {
    setExpanded(false);
  }, [level]);

  return (
    <div
      style={{
        position: "fixed",
        left: 12,
        bottom: 154,
        zIndex: 32,
        width: "min(360px, calc(100vw - 24px))",
        pointerEvents: "auto",
        borderRadius: 12,
        border: "1px solid rgba(109, 209, 241, 0.36)",
        background: "rgba(4, 12, 22, 0.78)",
        color: "#dcf8ff",
        padding: "7px 9px",
        boxShadow: "0 0 20px rgba(53, 164, 214, 0.22)",
        backdropFilter: "blur(7px)",
      }}
    >
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 8 }}>
        <div style={{ fontSize: "var(--dv-fs-xs)", letterSpacing: "var(--dv-tr-wide)", opacity: 0.86 }}>{title}</div>
        <button
          type="button"
          onClick={() => setExpanded((prev) => !prev)}
          style={{
            border: "1px solid rgba(108, 207, 239, 0.34)",
            borderRadius: 8,
            background: "rgba(7, 20, 34, 0.86)",
            color: "#cfefff",
            padding: "3px 7px",
            fontSize: "var(--dv-fs-xs)",
            cursor: "pointer",
          }}
        >
          {expanded ? "Min" : "?"}
        </button>
      </div>
      <div style={{ fontSize: "var(--dv-fs-sm)", marginTop: 5, color: "#9fe6ff", lineHeight: "var(--dv-lh-base)" }}>
        {hoveredNode ? hoverTip : compactHint}
      </div>
      {expanded ? (
        <div style={{ marginTop: 4, display: "grid", gap: 3 }}>
          {lines.map((item) => (
            <div key={item} style={{ fontSize: "var(--dv-fs-xs)", opacity: 0.9, lineHeight: "var(--dv-lh-base)" }}>
              {item}
            </div>
          ))}
        </div>
      ) : null}
    </div>
  );
}

function CommandMeteors({ enabled = true }) {
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
    if (!enabled) return;
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
      node.position.set(
        x,
        y,
        z
      );
      node.rotation.x = meteor.tiltX;
      node.rotation.z = meteor.tiltZ;
      node.rotation.y += delta * 0.7;
    });
  });

  if (!enabled) return null;
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
            <Text
              raycast={() => null}
              fontSize={1.7}
              color="#a5ebff"
              anchorX="center"
              anchorY="middle"
              maxWidth={34}
            >
              {meteor.hint}
            </Text>
          </Billboard>
        </group>
      ))}
    </group>
  );
}

function LinkChannel({ link, sourceNode, targetNode, dimmed, emphasized, onHoverLink, onLeaveLink, onSelectLink }) {
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
  const endpointStatus = resolveWorstStatus(sourceNode?.v1?.status, targetNode?.v1?.status);
  const v1Status = String(link?.v1?.status || endpointStatus);
  const v1Quality = Number(link?.v1?.quality_score ?? (v1Status === "RED" ? 55 : v1Status === "YELLOW" ? 78 : 95));
  const baseColor = new THREE.Color(color);
  const statusColor = new THREE.Color(resolveStatusTint(v1Status));
  const mixedColor = baseColor.clone().lerp(statusColor, 0.34).getStyle();
  const opacity = clamp((dimmed ? 0.14 : emphasized ? 0.94 : 0.74) * opacityFactor, 0.12, 0.98);
  const lineWidth = (dimmed ? 0.3 : emphasized ? 1.8 : v1Status === "RED" ? 1.55 : v1Status === "YELLOW" ? 1.25 : 1.05) * widthFactor;
  const pulseColor = new THREE.Color(mixedColor).lerp(new THREE.Color("#ffffff"), 0.35).getStyle();
  const speed = (dimmed ? 0.12 : emphasized ? 0.34 : 0.22) * speedFactor;
  const weight = Number(link.weight || 1);
  const sourceConstellation = String(link.source_constellation_name || sourceNode.entityName || "Unknown");
  const sourcePlanet = String(link.source_planet_name || sourceNode.planetName || sourceNode.label || "Unknown");
  const targetConstellation = String(link.target_constellation_name || targetNode.entityName || "Unknown");
  const targetPlanet = String(link.target_planet_name || targetNode.planetName || targetNode.label || "Unknown");
  const labelPoint = samplePath(points, 0.5);
  const typeLabel = resolveBondTypeLabel(link.type);
  const directionLabel = semantics.directional ? "->" : "<->";
  const interactionRadius = clamp((emphasized ? 2.8 : 2.4) + (stress + flow) * 0.45, 2.2, 4.2);
  const activeFlow = flow > 0.2 || stress > 0.24 || emphasized;
  const trailCount = semantics.directional ? 6 : 4;

  const buildHoverPayload = (event) => ({
    id: link.id,
    type: resolveBondTypeLabel(link.type),
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
            <sphereGeometry args={[(emphasized ? 1.2 : 0.86) * pulseSizeFactor, 12, 12]} />
            <meshBasicMaterial color={pulseColor} transparent opacity={0.95} />
          </mesh>
          <mesh ref={pulse2Ref}>
            <sphereGeometry args={[0.56 * pulseSizeFactor, 10, 10]} />
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

function TableNode({
  node,
  selected,
  onPointerDownNode,
  onPointerUpNode,
  onSelectNode,
  onContextNode,
  onHoverNode,
  onLeaveNode,
}) {
  const groupRef = useRef(null);
  const previewRef = useRef(null);
  const visual = useMemo(() => buildConstellationVisual(node), [node.id, node.entityName, node.memberCount, node.radius, node.label]);
  const targetScaleRef = useRef(selected ? 1.16 : 1);
  const v1Style = resolvePlanetV1Style(node.v1);
  const hasV1 = Boolean(node.v1);
  const physics = node.physics || FALLBACK_NODE_PHYSICS;
  const stress = clamp(Number(physics?.stress) || 0, 0, 1);
  const spinFactor = clamp(Number(physics?.spinFactor) || 1, 0.82, 2.1);
  const emissiveBoost = clamp(Number(physics?.emissiveBoost) || 0, 0, 0.9);
  const auraFactor = clamp(Number(physics?.auraFactor) || 1, 0.9, 2.2);
  const alertPressure = clamp(Number(physics?.alertPressure) || 0, 0, 1);
  const signatureColor = useMemo(
    () => signatureColorFromSeed(`${node.id}|${node.entityName || node.label}`).getStyle(),
    [node.entityName, node.id, node.label]
  );
  const previewMoonCount = clamp(Number(node.memberCount || 0), 0, 5);
  const previewOrbitRadius = node.radius * 2.15;
  const previewMoonRadius = Math.max(0.5, node.radius * 0.11);
  const previewPhase = useMemo(() => ((hashText(node.id) % 360) / 180) * Math.PI, [node.id]);

  useFrame((_, delta) => {
    if (!groupRef.current) return;
    targetScaleRef.current = selected ? 1.16 + stress * 0.04 : 1 + stress * 0.06;
    const nextScale = THREE.MathUtils.damp(groupRef.current.scale.x, targetScaleRef.current, 7, delta);
    groupRef.current.scale.set(nextScale, nextScale, nextScale);
    groupRef.current.rotation.y += delta * visual.spinSpeed * spinFactor;
    if (previewRef.current) {
      previewRef.current.rotation.y += delta * (0.24 + stress * 0.18);
      previewRef.current.rotation.x = Math.sin(performance.now() * 0.00012 + previewPhase) * 0.07;
    }
  });

  const coreMaterial = (
    <meshStandardMaterial
      color={selected ? "#f4fbff" : visual.coreColor}
      emissive={selected ? "#b3eaff" : v1Style.emissive}
      emissiveIntensity={selected ? 1.25 : 0.62 + emissiveBoost}
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
                color={visual.rimColor}
                emissive={selected ? visual.rimColor : v1Style.rim}
                emissiveIntensity={selected ? 0.98 : 0.58 + emissiveBoost * 0.72}
                transparent
                opacity={0.64 - idx * 0.12}
              />
            </mesh>
          );
        })}

        <mesh rotation={[Math.PI / 2, 0, 0]}>
          <torusGeometry args={[node.radius * 1.08, node.radius * 0.028, 14, 120]} />
          <meshStandardMaterial
            color={signatureColor}
            emissive={signatureColor}
            emissiveIntensity={selected ? 1.05 : 0.72}
            transparent
            opacity={0.86}
          />
        </mesh>

        <mesh>
          <sphereGeometry args={[node.radius * 1.2, 22, 22]} />
          <meshBasicMaterial
            color={selected ? visual.glowColor : v1Style.emissive}
            transparent
            opacity={selected ? 0.18 : clamp(v1Style.auraOpacity * auraFactor, 0.11, 0.42)}
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
                  position={[
                    Math.cos(angle) * previewOrbitRadius,
                    yOffset,
                    Math.sin(angle) * previewOrbitRadius,
                  ]}
                >
                  <sphereGeometry args={[previewMoonRadius, 10, 10]} />
                  <meshBasicMaterial color={signatureColor} transparent opacity={0.88} />
                </mesh>
              );
            })}
          </group>
        ) : null}
      </group>

      <mesh
        onPointerDown={(event) => onPointerDownNode(event, node)}
        onPointerUp={(event) => onPointerUpNode(event, node)}
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
          {`${node.entityName || node.label} • ${node.memberCount || 0} mesicu kolem`}
        </Text>
      </Billboard>
      <Billboard position={[0, node.radius + 0.6, 0]}>
        <Text fontSize={1.85} color="#8ccce0" anchorX="center" anchorY="middle" maxWidth={76}>
          {hasV1 ? `Klikni pro otevreni • V1 ${node.v1.status}` : `Klikni pro otevreni • ${visual.archetypeLabel}`}
        </Text>
      </Billboard>
    </group>
  );
}

function AsteroidNode({
  node,
  selected,
  onPointerDownNode,
  onPointerUpNode,
  onSelectNode,
  onContextNode,
  onHoverNode,
  onLeaveNode,
}) {
  const groupRef = useRef(null);
  const v1Style = resolveMoonV1Style(node.v1);
  const hasV1 = Boolean(node.v1);
  const physics = node.physics || FALLBACK_NODE_PHYSICS;
  const stress = clamp(Number(physics?.stress) || 0, 0, 1);
  const pulseFactor = clamp(Number(physics?.pulseFactor) || 1, 0.9, 2.35);
  const emissiveBoost = clamp(Number(physics?.emissiveBoost) || 0, 0, 0.95);
  const auraFactor = clamp(Number(physics?.auraFactor) || 1, 0.9, 2.2);
  const phase = useMemo(() => ((hashText(node.id) % 360) / 180) * Math.PI, [node.id]);

  useFrame((state, delta) => {
    if (!groupRef.current) return;
    const wave = Math.sin(state.clock.elapsedTime * (0.9 + pulseFactor * 0.64) + phase);
    const targetScale = (selected ? 1.08 : 1) + wave * 0.028 * (0.3 + stress * 0.7);
    const nextScale = THREE.MathUtils.damp(groupRef.current.scale.x, targetScale, 7, delta);
    groupRef.current.scale.set(nextScale, nextScale, nextScale);
  });

  return (
    <group ref={groupRef} position={node.position}>
      <mesh>
        <icosahedronGeometry args={[node.radius, 1]} />
        <meshStandardMaterial
          color={selected ? "#ffc27b" : v1Style.color}
          emissive={selected ? "#ff8d42" : v1Style.emissive}
          emissiveIntensity={selected ? 1.25 : 0.7 + emissiveBoost}
          roughness={0.35}
          metalness={0.2}
          transparent
          opacity={0.96}
        />
      </mesh>
      <mesh
        onPointerDown={(event) => onPointerDownNode(event, node)}
        onPointerUp={(event) => onPointerUpNode(event, node)}
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
        onContextMenu={(event) => onContextNode(event, node)}
      >
        <sphereGeometry args={[node.radius * 1.38, 18, 18]} />
        <meshBasicMaterial transparent opacity={0} depthWrite={false} />
      </mesh>
      <mesh>
        <sphereGeometry args={[node.radius * (1.45 + stress * 0.2), 20, 20]} />
        <meshBasicMaterial
          color={v1Style.aura}
          transparent
          opacity={selected ? 0.2 : clamp(0.12 * auraFactor, 0.1, 0.4)}
          depthWrite={false}
        />
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
  hideMouseGuide = false,
  onSelectTable,
  onSelectAsteroid,
  onOpenContext,
  onLinkStart,
  onLinkMove,
  onLinkComplete,
  onLinkCancel,
  onHoverLink,
  onLeaveLink,
  onSelectLink,
}) {
  const controlsRef = useRef(null);
  const dragRef = useRef(null);
  const suppressContextMenuUntilRef = useRef(0);
  const [hoveredNode, setHoveredNode] = useState(null);
  const interactionPlane = useMemo(() => new THREE.Plane(new THREE.Vector3(0, 0, 1), 0), []);

  const tableById = useMemo(() => new Map(tableNodes.map((node) => [node.id, node])), [tableNodes]);
  const asteroidById = useMemo(() => new Map(asteroidNodes.map((node) => [node.id, node])), [asteroidNodes]);

  const selectedTableNode = selectedTableId ? tableById.get(selectedTableId) || null : null;
  const selectedAsteroidNode = selectedAsteroidId ? asteroidById.get(selectedAsteroidId) || null : null;

  useEffect(() => () => setBodyCursor("auto"), []);
  useEffect(() => {
    setHoveredNode(null);
  }, [level]);

  const isDragLinkGesture = (event, node) => {
    if (level < 3) return false;
    if (!node || node.kind !== "asteroid") return false;
    if (event.button === 2) return true;
    if (event.button === 0 && event.shiftKey) return true;
    return false;
  };

  const releaseDragState = ({ suppressContextMenu = false } = {}) => {
    dragRef.current = null;
    if (controlsRef.current) {
      controlsRef.current.enabled = true;
    }
    if (suppressContextMenu) {
      suppressContextMenuUntilRef.current = Date.now() + 320;
    }
    onLinkCancel();
  };

  const resolveLinePoint = (event) => {
    const out = new THREE.Vector3();
    const hit = event.ray?.intersectPlane?.(interactionPlane, out);
    if (!hit) return [0, 0, 0];
    return [hit.x, hit.y, hit.z];
  };

  const beginNodeDrag = (event, node) => {
    if (!isDragLinkGesture(event, node)) return;
    event.stopPropagation();
    event.preventDefault();
    if (controlsRef.current) {
      controlsRef.current.enabled = false;
    }
    dragRef.current = {
      sourceId: node.id,
      sourceKind: node.kind,
      sourceButton: event.button,
      moved: false,
      startX: event.clientX,
      startY: event.clientY,
    };
    const from = [node.position[0], node.position[1], node.position[2]];
    onLinkStart({ sourceId: node.id, sourceKind: node.kind, from, to: from });
  };

  const endNodeDrag = (event, node) => {
    const draft = dragRef.current;
    if (!draft || draft.sourceId !== linkDraft?.sourceId) return;
    if (event.button !== draft.sourceButton) return;
    event.stopPropagation();
    event.preventDefault();
    if (draft.moved && draft.sourceId !== node.id && draft.sourceKind === "asteroid" && node.kind === "asteroid") {
      onLinkComplete({
        sourceId: draft.sourceId,
        sourceKind: draft.sourceKind,
        targetId: node.id,
        targetKind: node.kind,
      });
    }
    releaseDragState({ suppressContextMenu: draft.sourceButton === 2 && draft.moved });
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
    const draft = dragRef.current;
    if (!draft) return;
    if (event.button !== draft.sourceButton) return;
    event.stopPropagation();
    event.preventDefault();
    releaseDragState({ suppressContextMenu: draft.sourceButton === 2 && draft.moved });
  };

  const resolveLinkEndpoint = (value) => {
    if (!value) return "";
    if (typeof value === "object") return String(value.id || "");
    return String(value);
  };

  return (
    <div style={{ position: "relative", width: "100%", height: "100%" }}>
      <Canvas
        camera={{
          position: cameraState.position,
          fov: 54,
          near: 0.1,
          far: 8000,
        }}
        gl={{ antialias: true, toneMapping: THREE.ACESFilmicToneMapping, toneMappingExposure: 1.18 }}
        style={{ width: "100%", height: "100%", background: "#020205" }}
        onPointerMove={onBackgroundMove}
        onPointerUp={onBackgroundUp}
        onContextMenu={(event) => {
          event.preventDefault();
        }}
        onPointerMissed={() => {
          releaseDragState();
          setBodyCursor("auto");
        }}
      >
        <color attach="background" args={["#020205"]} />
        <fog attach="fog" args={["#020205", 260, 1600]} />

        <ambientLight intensity={0.46} />
        <directionalLight position={[240, 220, 200]} intensity={1.1} color="#b5e8ff" />
        <directionalLight position={[-220, -120, -180]} intensity={0.38} color="#6fa5ff" />

        <Stars radius={2200} depth={900} count={8200} factor={8} saturation={0} fade speed={0.1} />
        <CommandMeteors enabled />

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
                onSelectLink={onSelectLink}
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
                onSelectLink={onSelectLink}
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
            onHoverNode={(current) => setHoveredNode({ kind: "table", id: current.id, label: current.label })}
            onLeaveNode={(current) =>
              setHoveredNode((prev) => (prev && prev.kind === "table" && prev.id === current.id ? null : prev))
            }
            onContextNode={(event, current) => {
              event.stopPropagation();
              event.preventDefault();
              if (Date.now() < suppressContextMenuUntilRef.current) return;
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
                onHoverNode={(current) => setHoveredNode({ kind: "asteroid", id: current.id, label: current.label })}
                onLeaveNode={(current) =>
                  setHoveredNode((prev) => (prev && prev.kind === "asteroid" && prev.id === current.id ? null : prev))
                }
                onContextNode={(event, current) => {
                  event.stopPropagation();
                  event.preventDefault();
                  if (Date.now() < suppressContextMenuUntilRef.current) return;
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
      {!hideMouseGuide ? <MouseGuideOverlay level={level} hoveredNode={hoveredNode} /> : null}
    </div>
  );
}
