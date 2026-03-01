import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Canvas, useFrame, useThree } from "@react-three/fiber";
import { Billboard, Line, OrbitControls, Stars, Text } from "@react-three/drei";
import { Bloom, EffectComposer } from "@react-three/postprocessing";
import { forceCenter, forceCollide, forceLink, forceManyBody, forceSimulation } from "d3-force-3d";
import * as THREE from "three";
import {
  API_BASE,
  apiFetch,
  buildParserPayload,
  buildSnapshotUrl,
  buildTablesUrl,
  normalizeSnapshot,
  toAsOfIso
} from "./lib/dataverseApi";
import { calculateSectorLayout } from "./lib/layout_service";
import { useAuth } from "./context/AuthContext.jsx";

const DEFAULT_CAMERA_POSITION = [0, 0, 28];
const SHAPES = ["planet", "crystal", "gear", "platform", "logistics", "orb"];
const PALETTE = ["#cf91ff", "#9ad8ff", "#6de8ff", "#9ca6ff", "#8dd8ff", "#f7cb7b", "#76ffa3", "#ffd58b"];
const MAX_SMART_SUGGESTIONS = 7;
const SELECTED_GALAXY_STORAGE_KEY = "dataverse_selected_galaxy_id";
const NAV_SHORTCUTS = [
  { key: "/", label: "fokus na příkazový řádek" },
  { key: "Ctrl+K", label: "otevřít Smart Assist" },
  { key: "?", label: "zobrazit/schovat nápovědu" },
  { key: "Esc", label: "zrušit fokus planety" },
  { key: "L", label: "zpět do současnosti" },
];
const COMMAND_MODES = [
  { id: "auto", label: "Auto", hint: "Použij parser přímo" },
  { id: "create", label: "Create", hint: "Vytvoření asteroidů" },
  { id: "link", label: "Link", hint: "Propojení dvou entit" },
  { id: "type", label: "Type", hint: "Typování entity" },
  { id: "find", label: "Find", hint: "Lokální fokus" },
  { id: "formula", label: "Formula", hint: "Výpočet metadata" },
  { id: "guardian", label: "Guardian", hint: "Hlídací pravidlo" },
  { id: "delete", label: "Delete", hint: "Soft delete" },
];
const COMMAND_MODE_RULES = {
  auto: {
    format: "Přirozený příkaz parseru",
    example: "Pavel + Audi",
  },
  create: {
    format: "Název entity nebo věta",
    example: "Firma ACME",
  },
  link: {
    format: "A, B",
    example: "Firma ACME, Produkt X",
  },
  type: {
    format: "A, Typ",
    example: "Pavel, Zaměstnanec",
  },
  find: {
    format: "Název entity",
    example: "Pavel",
  },
  formula: {
    format: "Target.field = SUM(field) nebo SUM(field)",
    example: "Projekt.celkem = SUM(cena)",
  },
  guardian: {
    format: "Target.field > 1000 -> pulse",
    example: "Projekt.celkem > 1000 -> pulse",
  },
  delete: {
    format: "Název entity",
    example: "Pavel",
  },
};

function splitPairInput(value) {
  const raw = String(value || "").trim();
  if (!raw) return null;
  const separators = [",", "->", "=>", "|", ";", "+"];
  for (const separator of separators) {
    const parts = raw.split(separator).map((item) => item.trim()).filter(Boolean);
    if (parts.length >= 2) {
      return [parts[0], parts[1]];
    }
  }
  return null;
}

function valueToLabel(value) {
  if (typeof value === "string") return value;
  if (typeof value === "number" || typeof value === "boolean") return String(value);
  if (value && typeof value === "object") return JSON.stringify(value);
  return "";
}

function formatCreatedAt(value) {
  if (!value) return "Neznámý čas";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "Neznámý čas";
  return new Intl.DateTimeFormat("cs-CZ", {
    dateStyle: "medium",
    timeStyle: "medium",
  }).format(date);
}

function safeMetadata(metadata) {
  if (!metadata || typeof metadata !== "object" || Array.isArray(metadata)) return {};
  return metadata;
}

function normalizeSearchText(value) {
  return String(value ?? "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .trim();
}

function evaluateCommandReadiness({ mode, input, composed, historicalMode }) {
  const raw = String(input || "").trim();
  const cmd = String(composed || "").trim();
  const modeRule = COMMAND_MODE_RULES[mode] || COMMAND_MODE_RULES.auto;
  if (historicalMode) {
    return {
      status: "blocked",
      message: "Historický mód je pouze pro čtení. Přepni na Live.",
      executePath: "LOCKED",
      ...modeRule,
    };
  }
  if (!raw || !cmd) {
    return {
      status: "needs_input",
      message: "Zadej příkaz.",
      executePath: "N/A",
      ...modeRule,
    };
  }

  const localFocus = /^(ukaž|ukaz|najdi)\s*:\s*.+$/i.test(cmd);
  const executePath = localFocus ? "LOCAL" : "API";
  const ok = (message) => ({ status: "ready", message, executePath, ...modeRule });
  const invalid = (message) => ({ status: "invalid", message, executePath, ...modeRule });

  if (mode === "auto") return ok("Parser rozhodne automaticky.");
  if (mode === "create") return ok("Vytvoření/ingest bude provedeno parserem.");
  if (mode === "find") {
    return localFocus ? ok("Lokální fokus bez volání API.") : invalid("Find režim očekává „Ukaž : Název“.");
  }
  if (mode === "delete") {
    return /^(delete|zhasni|smaz|smaž)\s*:\s*.+$/i.test(cmd)
      ? ok("Soft delete bude proveden přes event log.")
      : invalid("Delete režim očekává cíl typu „Delete : Název“.");
  }
  if (mode === "link") {
    const parts = cmd.split("+").map((p) => p.trim()).filter(Boolean);
    return parts.length >= 2 ? ok("Vytvoří se RELATION vazba.") : invalid("Link režim očekává dvě entity.");
  }
  if (mode === "type") {
    const parts = cmd.split(":").map((p) => p.trim()).filter(Boolean);
    return parts.length >= 2 ? ok("Vytvoří se TYPE vazba.") : invalid("Type režim očekává „A : Typ“.");
  }
  if (mode === "formula") {
    return /^(spočítej|spocitej|vypočítej|vypocitej)\s*:\s*[^.]+\.[^=\s]+\s*=\s*(SUM|AVG|MIN|MAX|COUNT)\s*\([^)]+\)\s*$/i.test(cmd)
      ? ok("Vzorec bude uložen do metadata.")
      : invalid("Formula režim očekává validní tvar Spočítej.");
  }
  if (mode === "guardian") {
    return /^(hlídej|hlidej)\s*:\s*[^.]+\.[^\s]+\s*(>=|<=|==|>|<)\s*.+\s*->\s*[a-zA-Z_][\w-]*\s*$/i.test(cmd)
      ? ok("Guardian pravidlo bude přidáno do metadata.")
      : invalid("Guardian režim očekává „Hlídej : A.field > X -> action“.");
  }
  return ok("Příkaz je připraven.");
}

function toNumericValue(value) {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (typeof value === "string") {
    const cleaned = value.trim().replace(/\u00A0/g, "").replace(/\s+/g, "").replace(",", ".");
    if (!cleaned) return null;
    const parsed = Number(cleaned);
    return Number.isFinite(parsed) ? parsed : null;
  }
  return null;
}

function mapValueToPhysics(value) {
  const numericValue = toNumericValue(value);
  const safe = numericValue && numericValue > 0 ? numericValue : 0;
  const signal = Math.log10(safe + 1);
  return {
    scale: clamp(1 + signal * 0.34, 0.9, 2.85),
    mass: clamp(1 + signal * 2.3, 1, 20),
    intensity: clamp(1 + signal * 0.65, 1, 3.6),
    value: safe,
  };
}

function inferCategory(asteroid) {
  const metadata = safeMetadata(asteroid?.metadata);
  const direct = metadata.kategorie || metadata.category || metadata.typ || metadata.type;
  if (typeof direct === "string" && direct.trim()) return direct.trim();

  const label = valueToLabel(asteroid?.value);
  const prefix = label.match(/^\s*([A-Za-zÀ-ž0-9 _-]{2,24})\s*:/);
  return prefix?.[1]?.trim() || null;
}

function extractComputedValue(asteroid) {
  const calculated = asteroid?.calculated_values;
  const measured = [];
  if (calculated && typeof calculated === "object" && !Array.isArray(calculated)) {
    Object.values(calculated).forEach((item) => {
      const num = toNumericValue(item);
      if (num !== null) measured.push(Math.abs(num));
    });
  }

  const metadata = safeMetadata(asteroid?.metadata);
  Object.values(metadata).forEach((item) => {
    const num = toNumericValue(item);
    if (num !== null) measured.push(Math.abs(num));
  });

  if (!measured.length) return null;
  return measured.sort((a, b) => b - a)[0];
}

function extractFormulaFields(metadata) {
  const fields = new Set();
  const source = safeMetadata(metadata);
  Object.values(source).forEach((value) => {
    if (typeof value !== "string" || !value.trim().startsWith("=")) return;
    const match = value.trim().match(/^=\s*(SUM|AVG|MIN|MAX|COUNT)\s*\(\s*([^)]+)\s*\)/i);
    if (!match) return;
    const field = (match[2] || "").trim();
    if (field) fields.add(field);
  });
  return fields;
}

function PlanetShape({ planet, selected }) {
  const color = planet.color || "#9ad8ff";
  const radius = planet.radius || 0.9;
  const baseOpacity = typeof planet.opacity === "number" ? planet.opacity : 1;
  const glowBoost = planet.glowBoost || 1;
  const activeAlerts = Array.isArray(planet.active_alerts) ? planet.active_alerts : [];
  const hasAlert = activeAlerts.length > 0;
  const alertAmplifier = hasAlert ? 1.45 : 0.72;
  const emissiveIntensity = clamp(
    (selected ? 1.05 : 0.72) * glowBoost * alertAmplifier * (0.45 + 0.55 * baseOpacity),
    0.35,
    3.2
  );
  const accentIntensity = clamp(emissiveIntensity * (hasAlert ? 1.2 : 1.04), 0.42, 3.4);
  const auraIntensity = clamp(emissiveIntensity * (hasAlert ? 0.92 : 0.7), 0.28, 2.6);
  const coreMaterial = (
    <meshStandardMaterial
      color={color}
      emissive={color}
      emissiveIntensity={emissiveIntensity}
      metalness={0.25}
      roughness={0.35}
      transparent={baseOpacity < 0.999}
      opacity={baseOpacity}
    />
  );

  switch (planet.type) {
    case "crystal":
      return (
        <group rotation={[planet.orbitTilt || 0, 0.35, 0]}>
          <mesh>
            <octahedronGeometry args={[radius, 0]} />
            {coreMaterial}
          </mesh>
          <mesh>
            <octahedronGeometry args={[radius * 0.52, 0]} />
            <meshStandardMaterial
              color="#ffffff"
              emissive={color}
              emissiveIntensity={accentIntensity}
              transparent
              opacity={0.78 * baseOpacity}
            />
          </mesh>
        </group>
      );

    case "gear":
      return (
        <group rotation={[planet.orbitTilt || 0, 0, 0]}>
          <mesh>
            <sphereGeometry args={[radius * 0.72, 24, 24]} />
            {coreMaterial}
          </mesh>
          <mesh rotation={[Math.PI / 2, 0.28, 0]}>
            <torusGeometry args={[radius * 1.05, radius * 0.2, 16, 42]} />
            {coreMaterial}
          </mesh>
          <mesh rotation={[0.55, Math.PI / 2, 0]}>
            <torusGeometry args={[radius * 0.9, radius * 0.17, 16, 36]} />
            {coreMaterial}
          </mesh>
        </group>
      );

    case "platform":
      return (
        <group rotation={[planet.orbitTilt || 0, 0, 0]}>
          <mesh>
            <cylinderGeometry args={[radius * 1.02, radius * 1.16, radius * 0.58, 32]} />
            {coreMaterial}
          </mesh>
          <mesh rotation={[Math.PI / 2, 0, 0]}>
            <torusGeometry args={[radius * 1.24, radius * 0.11, 16, 52]} />
            <meshStandardMaterial
              color={color}
              emissive={color}
              emissiveIntensity={accentIntensity}
              transparent={baseOpacity < 0.999}
              opacity={baseOpacity}
            />
          </mesh>
        </group>
      );

    case "logistics":
      return (
        <group rotation={[planet.orbitTilt || 0, 0.25, 0]}>
          <mesh>
            <dodecahedronGeometry args={[radius * 0.9, 0]} />
            {coreMaterial}
          </mesh>
          <mesh>
            <boxGeometry args={[radius * 2.1, radius * 2.1, radius * 2.1]} />
            <meshBasicMaterial color={color} wireframe transparent opacity={0.58 * baseOpacity} />
          </mesh>
        </group>
      );

    case "planet":
      return (
        <group rotation={[planet.orbitTilt || 0, 0.22, 0]}>
          <mesh>
            <sphereGeometry args={[radius, 32, 32]} />
            {coreMaterial}
          </mesh>
          <mesh rotation={[Math.PI / 2.35, 0.18, 0]}>
            <torusGeometry args={[radius * 1.42, radius * 0.085, 16, 72]} />
            <meshStandardMaterial
              color={color}
              emissive={color}
              emissiveIntensity={accentIntensity}
              transparent={baseOpacity < 0.999}
              opacity={baseOpacity}
            />
          </mesh>
        </group>
      );

    case "orb":
      return (
        <group>
          <mesh>
            <sphereGeometry args={[radius, 30, 30]} />
            {coreMaterial}
          </mesh>
          <mesh>
            <sphereGeometry args={[radius * 1.22, 24, 24]} />
            <meshStandardMaterial
              color={color}
              emissive={color}
              emissiveIntensity={auraIntensity}
              transparent
              opacity={0.2 * baseOpacity}
            />
          </mesh>
        </group>
      );

    default:
      return (
        <mesh>
          <sphereGeometry args={[radius, 32, 32]} />
          {coreMaterial}
        </mesh>
      );
  }
}

function PlanetNode({ planet, position, onSelectPlanet }) {
  const bodyRef = useRef(null);
  const currentScaleRef = useRef(planet.visualScale || 1);
  const targetScaleRef = useRef(planet.visualScale || 1);
  const baseRadius = planet.radius || 0.9;
  const scaledRadius = baseRadius * (planet.visualScale || 1);
  const showAtmosphere = scaledRadius >= 2.65;

  useEffect(() => {
    targetScaleRef.current = planet.visualScale || 1;
  }, [planet.visualScale]);

  useFrame((state, delta) => {
    if (!bodyRef.current) return;
    const hasPulse = Array.isArray(planet.active_alerts) && planet.active_alerts.includes("pulse");
    const pulseFactor = hasPulse ? 1 + 0.12 * Math.sin(state.clock.elapsedTime * 4.2) : 1;
    targetScaleRef.current = (planet.visualScale || 1) * pulseFactor;
    currentScaleRef.current = THREE.MathUtils.damp(
      currentScaleRef.current,
      targetScaleRef.current,
      5,
      delta
    );
    bodyRef.current.scale.setScalar(currentScaleRef.current);
  });

  const label = valueToLabel(planet.value);
  return (
    <group
      key={planet.id}
      position={position}
      onClick={(event) => {
        event.stopPropagation();
        if (onSelectPlanet) {
          onSelectPlanet(planet.id);
        }
      }}
    >
      <group ref={bodyRef}>
        <PlanetShape planet={planet} selected={Boolean(planet.selected)} />
        {showAtmosphere ? (
          <mesh>
            <sphereGeometry args={[baseRadius * 1.78, 30, 30]} />
            <meshStandardMaterial
              color={planet.color}
              emissive={planet.color}
              emissiveIntensity={Array.isArray(planet.active_alerts) && planet.active_alerts.length ? 1.1 : 0.66}
              transparent
              opacity={0.14 * Math.max(0.25, planet.opacity ?? 1)}
              depthWrite={false}
            />
          </mesh>
        ) : null}
      </group>
      {planet.isCategoryCore ? (
        <mesh>
          <sphereGeometry args={[(planet.radius || 0.9) * 2.1, 24, 24]} />
          <meshStandardMaterial
            color={planet.color}
            emissive={planet.color}
            emissiveIntensity={1.35}
            transparent
            opacity={0.1 * Math.max(0.2, planet.opacity ?? 1)}
          />
        </mesh>
      ) : null}
      <Billboard position={[0, (planet.radius || 0.9) * (planet.visualScale || 1) + 0.58, 0]}>
        <Text
          fontSize={0.34}
          color="#c9f3ff"
          fillOpacity={Math.max(0.2, planet.opacity ?? 1)}
          maxWidth={6}
          textAlign="center"
          anchorX="center"
          anchorY="middle"
          outlineWidth={0.02}
          outlineColor="#0e2237"
        >
          {label}
        </Text>
      </Billboard>
    </group>
  );
}

function hashText(input) {
  let hash = 2166136261;
  for (let i = 0; i < input.length; i += 1) {
    hash ^= input.charCodeAt(i);
    hash = Math.imul(hash, 16777619);
  }
  return hash >>> 0;
}

function clamp(val, min, max) {
  return Math.max(min, Math.min(max, val));
}

function seededUnitVector(seedText) {
  const seed = hashText(seedText);
  const u = ((seed & 0xffff) / 0xffff) * 2 - 1;
  const v = (((seed >>> 16) & 0xffff) / 0xffff) * 2 - 1;
  const theta = (u + 1) * Math.PI;
  const z = clamp(v, -0.97, 0.97);
  const radius = Math.sqrt(1 - z * z);
  return [Math.cos(theta) * radius, z, Math.sin(theta) * radius];
}

function projectNoOverlap(nodes, iterations = 16) {
  if (nodes.length < 2) return;
  for (let pass = 0; pass < iterations; pass += 1) {
    let moved = false;
    for (let i = 0; i < nodes.length; i += 1) {
      for (let j = i + 1; j < nodes.length; j += 1) {
        const a = nodes[i];
        const b = nodes[j];
        let dx = a.x - b.x;
        let dy = a.y - b.y;
        let dz = a.z - b.z;
        let dist = Math.sqrt(dx * dx + dy * dy + dz * dz);
        if (dist < 0.0001) {
          const [nx, ny, nz] = seededUnitVector(`${a.id}|${b.id}|overlap`);
          dx = nx;
          dy = ny;
          dz = nz;
          dist = 1;
        }
        const minDistance = (a.collisionRadius || 2) + (b.collisionRadius || 2) + 1.0;
        if (dist >= minDistance) continue;
        moved = true;
        const overlap = (minDistance - dist) * 0.52;
        const nx = dx / dist;
        const ny = dy / dist;
        const nz = dz / dist;
        a.x += nx * overlap;
        a.y += ny * overlap;
        a.z += nz * overlap;
        b.x -= nx * overlap;
        b.y -= ny * overlap;
        b.z -= nz * overlap;
      }
    }
    if (!moved) break;
  }
}

function calculatePatentGravityLayout(nodes, edges, previousPositions) {
  if (!nodes.length) return [];

  const sortedNodes = [...nodes].sort((a, b) => a.id.localeCompare(b.id));
  const adjacency = new Map(sortedNodes.map((node) => [node.id, new Set()]));
  const incoming = new Map(sortedNodes.map((node) => [node.id, new Set()]));
  const outgoing = new Map(sortedNodes.map((node) => [node.id, new Set()]));
  edges.forEach((edge) => {
    const sourceId = edge.flow_source_id || edge.source_id || edge.source;
    const targetId = edge.flow_target_id || edge.target_id || edge.target;
    if (!sourceId || !targetId || sourceId === targetId) return;
    if (!adjacency.has(sourceId) || !adjacency.has(targetId)) return;
    adjacency.get(sourceId)?.add(targetId);
    adjacency.get(targetId)?.add(sourceId);
    outgoing.get(sourceId)?.add(targetId);
    incoming.get(targetId)?.add(sourceId);
  });

  const formulaById = new Map(
    sortedNodes.map((node) => [node.id, node.formulaFields instanceof Set ? node.formulaFields : new Set()])
  );
  const hasFormulaById = new Map(sortedNodes.map((node) => [node.id, (formulaById.get(node.id)?.size || 0) > 0]));
  const depthById = new Map(sortedNodes.map((node) => [node.id, hasFormulaById.get(node.id) ? 1 : 0]));
  for (let pass = 0; pass < 14; pass += 1) {
    sortedNodes.forEach((node) => {
      if (!hasFormulaById.get(node.id)) return;
      let nextDepth = 1;
      incoming.get(node.id)?.forEach((sourceId) => {
        nextDepth = Math.max(nextDepth, (depthById.get(sourceId) || 0) + 1);
      });
      depthById.set(node.id, clamp(nextDepth, 1, 8));
    });
  }

  const points = new Map();
  const sunCandidate = [...sortedNodes]
    .sort((a, b) => {
      const aFormula = hasFormulaById.get(a.id) ? 1 : 0;
      const bFormula = hasFormulaById.get(b.id) ? 1 : 0;
      if (aFormula !== bFormula) return bFormula - aFormula;
      return (b.mass || 1) - (a.mass || 1);
    })[0];
  const sunId = sunCandidate?.id || sortedNodes[0].id;
  const baseBounds = 46 + Math.sqrt(sortedNodes.length) * 4.8;

  sortedNodes.forEach((node) => {
    const prev = previousPositions?.get(node.id);
    const hasFormula = hasFormulaById.get(node.id);
    const depth = depthById.get(node.id) || 0;
    const targetRadius = hasFormula ? 5 + depth * 3.6 : 28 + Math.min(16, (outgoing.get(node.id)?.size || 0) * 1.2);
    if (Array.isArray(prev) && prev.length === 3 && prev.every((x) => Number.isFinite(x))) {
      points.set(node.id, {
        id: node.id,
        x: prev[0],
        y: prev[1],
        z: prev[2],
        vx: 0,
        vy: 0,
        vz: 0,
        mass: Number(node.mass) || 1,
        collisionRadius: Number(node.collisionRadius) || 2.2,
        hasFormula,
        depth,
        targetRadius,
        degree: adjacency.get(node.id)?.size || 0,
      });
      return;
    }
    const [dx, dy, dz] = seededUnitVector(`${node.id}|spawn`);
    const centerBias = hasFormula ? 0.48 : 1;
    const orbit = targetRadius * (0.88 + (hashText(node.id) % 100) / 420);

    points.set(node.id, {
      id: node.id,
      x: dx * orbit * centerBias,
      y: dy * orbit * 0.78 * centerBias,
      z: dz * orbit * centerBias,
      vx: 0,
      vy: 0,
      vz: 0,
      mass: Number(node.mass) || 1,
      collisionRadius: Number(node.collisionRadius) || 2.2,
      hasFormula,
      depth,
      targetRadius,
      degree: adjacency.get(node.id)?.size || 0,
    });
  });

  const simNodes = sortedNodes.map((node) => points.get(node.id)).filter(Boolean);
  const simLinks = edges
    .map((edge) => {
      const sourceId = edge.flow_source_id || edge.source_id || edge.source;
      const targetId = edge.flow_target_id || edge.target_id || edge.target;
      if (!points.has(sourceId) || !points.has(targetId) || sourceId === targetId) return null;
      return { source: sourceId, target: targetId };
    })
    .filter(Boolean);

  simNodes.forEach((node) => {
    if (node.id === sunId) {
      node.fx = 0;
      node.fy = 0;
      node.fz = 0;
      node.x = 0;
      node.y = 0;
      node.z = 0;
    }
  });

  const nodeById = new Map(simNodes.map((node) => [node.id, node]));
  const simulation = forceSimulation(simNodes, 3)
    .alpha(1)
    .alphaDecay(0.022)
    .velocityDecay(0.26)
    .force(
      "charge",
      forceManyBody().strength((node) => {
        const mass = Number(node.mass) || 1;
        const edgeSpace = node.hasFormula ? 0.9 : 1.2;
        return -(120 + mass * mass * 6.2 + mass * 34) * edgeSpace;
      })
    )
    .force(
      "link",
      forceLink(simLinks)
        .id((node) => node.id)
        .distance((link) => {
          const source = typeof link.source === "object" ? link.source : nodeById.get(link.source);
          const target = typeof link.target === "object" ? link.target : nodeById.get(link.target);
          const sourceR = Number(source?.collisionRadius) || 2.2;
          const targetR = Number(target?.collisionRadius) || 2.2;
          const depthGap = Math.abs((source?.depth || 0) - (target?.depth || 0));
          return sourceR + targetR + 2.8 + depthGap * 1.3;
        })
        .strength((link) => {
          const source = typeof link.source === "object" ? link.source : nodeById.get(link.source);
          const target = typeof link.target === "object" ? link.target : nodeById.get(link.target);
          const flowToFormula = source && target ? (!source.hasFormula && target.hasFormula ? 1.2 : 1) : 1;
          return clamp(0.12 * flowToFormula, 0.1, 0.4);
        })
    )
    .force(
      "collide",
      forceCollide()
        .radius((node) => (Number(node.collisionRadius) || 2.2) + 1.35)
        .strength(1)
        .iterations(3)
    )
    .force("center", forceCenter(0, 0, 0))
    .stop();

  const iterations = clamp(220 + simNodes.length * 5, 220, 420);
  for (let it = 0; it < iterations; it += 1) {
    simulation.tick();
    const alpha = 1 - it / iterations;
    simNodes.forEach((node) => {
      if (node.id === sunId) return;
      const dist = Math.sqrt(node.x * node.x + node.y * node.y + node.z * node.z) || 0.0001;
      const nx = node.x / dist;
      const ny = node.y / dist;
      const nz = node.z / dist;
      const radialDiff = (node.targetRadius || 10) - dist;
      const radialStrength = (node.hasFormula ? 0.052 : 0.061) * alpha;
      node.vx += nx * radialDiff * radialStrength;
      node.vy += ny * radialDiff * radialStrength * 0.9;
      node.vz += nz * radialDiff * radialStrength;
      if (node.hasFormula) {
        node.vy += -node.y * 0.0035 * alpha;
      }
      node.x = clamp(node.x, -baseBounds, baseBounds);
      node.y = clamp(node.y, -baseBounds * 0.72, baseBounds * 0.72);
      node.z = clamp(node.z, -baseBounds, baseBounds);
    });
  }

  projectNoOverlap(simNodes, 26);
  const sun = nodeById.get(sunId);
  if (sun) {
    sun.x = 0;
    sun.y = 0;
    sun.z = 0;
  }

  const working = simNodes;
  return working.map((node) => ({ id: node.id, x: node.x, y: node.y, z: node.z }));
}

function curvePoints(start, control, end, segments = 64) {
  const pts = [];
  for (let i = 0; i <= segments; i += 1) {
    const t = i / segments;
    const inv = 1 - t;
    pts.push([
      inv * inv * start[0] + 2 * inv * t * control[0] + t * t * end[0],
      inv * inv * start[1] + 2 * inv * t * control[1] + t * t * end[1],
      inv * inv * start[2] + 2 * inv * t * control[2] + t * t * end[2]
    ]);
  }
  return pts;
}

function samplePolyline(points, t) {
  if (!Array.isArray(points) || !points.length) return [0, 0, 0];
  if (points.length === 1) return points[0];
  const clamped = clamp(t, 0, 1);
  const scaled = clamped * (points.length - 1);
  const index = Math.floor(scaled);
  const nextIndex = Math.min(points.length - 1, index + 1);
  const local = scaled - index;
  const a = points[index];
  const b = points[nextIndex];
  return [
    a[0] + (b[0] - a[0]) * local,
    a[1] + (b[1] - a[1]) * local,
    a[2] + (b[2] - a[2]) * local,
  ];
}

function FlowLink({ bond, onHover, onLeave }) {
  const flowPhaseRef = useRef((hashText(bond.id) % 1000) / 1000);
  const flowRefs = useRef([]);
  const hitPointFractions = [0.3, 0.5, 0.7];
  const flowSpeed = 0.13 + ((hashText(bond.id) % 9) / 9) * 0.18;
  const dotColor = bond.flow_highlight ? "#7df4ff" : "#56b7db";
  const lineColor = bond.flow_highlight ? "#7adfff" : "#3f7f9d";

  useFrame((_, delta) => {
    flowPhaseRef.current = (flowPhaseRef.current + delta * flowSpeed) % 1;
    flowRefs.current.forEach((ref, index) => {
      if (!ref) return;
      const t = (flowPhaseRef.current + index / Math.max(flowRefs.current.length, 1)) % 1;
      const [x, y, z] = samplePolyline(bond.points, t);
      ref.position.set(x, y, z);
    });
  });

  return (
    <group>
      <Line
        points={bond.points}
        color={lineColor}
        lineWidth={bond.flow_highlight ? 1.5 : 1.2}
        transparent
        opacity={typeof bond.opacity === "number" ? bond.opacity : 0.85}
      />

      {[0, 1, 2].map((index) => (
        <mesh
          key={`${bond.id}-flow-dot-${index}`}
          ref={(el) => {
            flowRefs.current[index] = el;
          }}
        >
          <sphereGeometry args={[bond.flow_highlight ? 0.2 : 0.16, 12, 12]} />
          <meshStandardMaterial
            color={dotColor}
            emissive={dotColor}
            emissiveIntensity={bond.flow_highlight ? 1.35 : 0.85}
            transparent
            opacity={Math.max(0.15, bond.opacity || 0.8)}
            depthWrite={false}
          />
        </mesh>
      ))}

      {hitPointFractions.map((fraction) => {
        const [hx, hy, hz] = samplePolyline(bond.points, fraction);
        return (
          <mesh
            key={`${bond.id}-hit-${fraction}`}
            position={[hx, hy, hz]}
            onPointerOver={(event) => {
              event.stopPropagation();
              onHover?.({
                id: bond.id,
                text: bond.flowLabel || "Tok dat",
                x: event.clientX,
                y: event.clientY,
              });
            }}
            onPointerMove={(event) => {
              event.stopPropagation();
              onHover?.({
                id: bond.id,
                text: bond.flowLabel || "Tok dat",
                x: event.clientX,
                y: event.clientY,
              });
            }}
            onPointerOut={(event) => {
              event.stopPropagation();
              onLeave?.();
            }}
          >
            <sphereGeometry args={[0.95, 8, 8]} />
            <meshBasicMaterial transparent opacity={0} depthWrite={false} />
          </mesh>
        );
      })}
    </group>
  );
}

function dampVector3(current, target, lambda, delta) {
  current.x = THREE.MathUtils.damp(current.x, target.x, lambda, delta);
  current.y = THREE.MathUtils.damp(current.y, target.y, lambda, delta);
  current.z = THREE.MathUtils.damp(current.z, target.z, lambda, delta);
}

function CameraRig({
  selectedPlanet,
  defaultCameraPosition,
  defaultCameraTarget,
  defaultMinDistance,
  controlsRef,
}) {
  const { camera } = useThree();
  const targetPosition = useRef(new THREE.Vector3(0, 0, 0));
  const cameraPosition = useRef(new THREE.Vector3(...defaultCameraPosition));
  const modeRef = useRef("idle");
  const desiredMinDistanceRef = useRef(2.5);
  const lastSelectedIdRef = useRef(null);
  const homeSignatureRef = useRef("");

  useEffect(() => {
    if (selectedPlanet?.id && selectedPlanet.position) {
      const selectedScale = Number(selectedPlanet.visualScale) || 1;
      const padding = 4.2;
      const targetDistance = selectedScale * 3.5 + padding;
      targetPosition.current.set(...selectedPlanet.position);
      cameraPosition.current.set(
        selectedPlanet.position[0],
        selectedPlanet.position[1] + selectedScale * 1.25 + 1.2,
        selectedPlanet.position[2] + targetDistance
      );
      desiredMinDistanceRef.current = clamp(targetDistance * 0.55, 2.4, 48);
      modeRef.current = "fly";
      lastSelectedIdRef.current = selectedPlanet.id;
      return;
    }

    const homeSignature = `${defaultCameraPosition.join(",")}|${defaultCameraTarget.join(",")}|${defaultMinDistance.toFixed(4)}`;
    if (lastSelectedIdRef.current || homeSignatureRef.current !== homeSignature) {
      targetPosition.current.set(...defaultCameraTarget);
      cameraPosition.current.set(...defaultCameraPosition);
      desiredMinDistanceRef.current = defaultMinDistance;
      modeRef.current = "home";
      lastSelectedIdRef.current = null;
      homeSignatureRef.current = homeSignature;
    }
  }, [selectedPlanet, defaultCameraPosition, defaultCameraTarget, defaultMinDistance]);

  useFrame((_, delta) => {
    if (controlsRef.current) {
      controlsRef.current.minDistance = desiredMinDistanceRef.current;
    }
    if (modeRef.current === "idle") {
      return;
    }

    dampVector3(camera.position, cameraPosition.current, 4, delta);
    if (controlsRef.current) {
      dampVector3(controlsRef.current.target, targetPosition.current, 4, delta);
      controlsRef.current.update();
    }

    const camDone = camera.position.distanceTo(cameraPosition.current) < 0.05;
    const tgtDone = controlsRef.current
      ? controlsRef.current.target.distanceTo(targetPosition.current) < 0.05
      : true;
    if (camDone && tgtDone) {
      modeRef.current = "idle";
    }
  });

  return null;
}

function SectorGridPlate({ sector }) {
  const center = Array.isArray(sector?.center) ? sector.center : [0, 0, 0];
  const size = Math.max(180, Number(sector?.size) || 260);
  const mode = sector?.mode === "ring" ? "ring" : "belt";
  const accent = mode === "ring" ? "#2f7aa2" : "#2a5e7f";
  const secondary = mode === "ring" ? "#173650" : "#142f46";
  const divisions = clamp(Math.round(size / 24), 8, 24);
  return (
    <group position={[center[0], center[1] - 4.2, center[2]]}>
      <mesh rotation={[-Math.PI / 2, 0, 0]} raycast={() => null}>
        <planeGeometry args={[size, size]} />
        <meshStandardMaterial
          color="#06101d"
          emissive={accent}
          emissiveIntensity={0.11}
          transparent
          opacity={0.18}
          depthWrite={false}
        />
      </mesh>
      <gridHelper args={[size, divisions, accent, secondary]} position={[0, 0.04, 0]} raycast={() => null} />
      <Billboard position={[0, 1.8, -size * 0.46]}>
        <Text
          fontSize={3.4}
          color="#7fd3fb"
          fillOpacity={0.72}
          anchorX="center"
          anchorY="middle"
          outlineWidth={0.11}
          outlineColor="#06131f"
        >
          {sector?.label || "Uncategorized"}
        </Text>
      </Billboard>
    </group>
  );
}

function UniverseScene({
  atoms,
  bonds,
  sectors,
  atomPositions,
  selectedPlanet,
  defaultCameraPosition,
  defaultCameraTarget,
  defaultMinDistance,
  defaultMaxDistance,
  onSelectPlanet,
  onClearSelection,
  onHoverFlow,
  onClearHoverFlow,
}) {
  const controlsRef = useRef(null);

  return (
    <Canvas
      style={{ position: "absolute", inset: 0, zIndex: 0 }}
      gl={{ antialias: true, toneMapping: THREE.ACESFilmicToneMapping }}
      onCreated={({ gl }) => {
        gl.toneMapping = THREE.ACESFilmicToneMapping;
        gl.toneMappingExposure = 1.2;
      }}
      camera={{ position: defaultCameraPosition, fov: 55 }}
      onPointerMissed={() => {
        if (onClearSelection) onClearSelection();
        if (onClearHoverFlow) onClearHoverFlow();
      }}
    >
      <color attach="background" args={["#020205"]} />
      <fog attach="fog" args={["#020205", 40, 170]} />
      <ambientLight intensity={0.25} />
      <pointLight position={[0, 10, 15]} intensity={1.2} color="#8fd6ff" />
      <pointLight position={[-12, -8, -10]} intensity={0.9} color="#ff6af0" />

      <CameraRig
        selectedPlanet={selectedPlanet}
        defaultCameraPosition={defaultCameraPosition}
        defaultCameraTarget={defaultCameraTarget}
        defaultMinDistance={defaultMinDistance}
        controlsRef={controlsRef}
      />

      <Stars radius={180} depth={80} count={6000} factor={2.8} saturation={0} fade speed={0.5} />

      {(sectors || []).map((sector) => (
        <SectorGridPlate key={sector.id} sector={sector} />
      ))}

      {bonds.map((bond) => (
        <FlowLink key={bond.id} bond={bond} onHover={onHoverFlow} onLeave={onClearHoverFlow} />
      ))}

      {atoms.map((atom) => (
        <PlanetNode
          key={atom.id}
          planet={atom}
          position={atomPositions[atom.id] || [0, 0, 0]}
          onSelectPlanet={onSelectPlanet}
        />
      ))}

      <EffectComposer>
        <Bloom intensity={2.25} luminanceThreshold={0.08} luminanceSmoothing={0.22} />
      </EffectComposer>

      <OrbitControls
        ref={controlsRef}
        makeDefault
        enableDamping
        dampingFactor={0.06}
        minDistance={defaultMinDistance}
        maxDistance={defaultMaxDistance}
      />
    </Canvas>
  );
}

async function parseApiError(response, fallback) {
  const text = await response.text();
  if (!text) return fallback;
  try {
    const parsed = JSON.parse(text);
    if (typeof parsed?.detail === "string" && parsed.detail) {
      return parsed.detail;
    }
  } catch {
    // Ignore invalid json and use raw text below.
  }
  return text || fallback;
}

function AuthScreen({
  mode,
  email,
  password,
  busy,
  error,
  onEmailChange,
  onPasswordChange,
  onModeChange,
  onSubmit,
}) {
  const isLogin = mode === "login";
  return (
    <div
      style={{
        width: "100vw",
        height: "100vh",
        background: "radial-gradient(circle at 20% 20%, #0f1e33 0%, #050812 48%, #020205 100%)",
        display: "grid",
        placeItems: "center",
        fontFamily: "ui-sans-serif, system-ui, -apple-system, Segoe UI, Roboto, sans-serif",
        color: "#d9f8ff",
        padding: 16,
      }}
    >
      <form
        onSubmit={onSubmit}
        style={{
          width: "min(420px, 95vw)",
          borderRadius: 16,
          border: "1px solid rgba(120, 210, 255, 0.32)",
          background: "linear-gradient(160deg, rgba(8,16,30,0.92), rgba(5,10,20,0.86))",
          padding: 18,
          boxShadow: "0 0 32px rgba(67, 193, 255, 0.15)",
          backdropFilter: "blur(8px)",
        }}
      >
        <div style={{ fontSize: 12, opacity: 0.76, letterSpacing: 0.8 }}>DATAVERSE ACCESS</div>
        <div style={{ marginTop: 8, fontSize: 24, fontWeight: 700 }}>
          {isLogin ? "Přihlášení" : "Registrace"}
        </div>
        <div style={{ marginTop: 6, fontSize: 13, opacity: 0.8 }}>
          {isLogin
            ? "Přihlas se a vyber galaxii, se kterou chceš pracovat."
            : "Vytvoř účet. Po registraci dostaneš výchozí galaxii."}
        </div>

        <label style={{ marginTop: 14, display: "block", fontSize: 12, opacity: 0.86 }}>Email</label>
        <input
          autoFocus
          autoComplete="email"
          value={email}
          onChange={(e) => onEmailChange(e.target.value)}
          type="email"
          required
          style={{
            marginTop: 6,
            width: "100%",
            borderRadius: 10,
            border: "1px solid rgba(118, 215, 255, 0.28)",
            background: "rgba(4, 8, 16, 0.9)",
            color: "#d8f7ff",
            padding: "11px 12px",
            fontSize: 14,
            outline: "none",
          }}
        />

        <label style={{ marginTop: 12, display: "block", fontSize: 12, opacity: 0.86 }}>Heslo</label>
        <input
          autoComplete={isLogin ? "current-password" : "new-password"}
          value={password}
          onChange={(e) => onPasswordChange(e.target.value)}
          type="password"
          minLength={8}
          required
          style={{
            marginTop: 6,
            width: "100%",
            borderRadius: 10,
            border: "1px solid rgba(118, 215, 255, 0.28)",
            background: "rgba(4, 8, 16, 0.9)",
            color: "#d8f7ff",
            padding: "11px 12px",
            fontSize: 14,
            outline: "none",
          }}
        />

        {error ? <div style={{ marginTop: 10, color: "#ff9db0", fontSize: 13 }}>{error}</div> : null}

        <button
          type="submit"
          disabled={busy}
          style={{
            marginTop: 14,
            width: "100%",
            border: "1px solid rgba(110, 225, 255, 0.52)",
            background: busy
              ? "linear-gradient(120deg, rgba(63,95,110,0.7), rgba(48,66,80,0.7))"
              : "linear-gradient(120deg, #18b2e2, #36d6ff)",
            color: busy ? "#b9c8cf" : "#02121c",
            borderRadius: 10,
            fontWeight: 700,
            letterSpacing: 0.3,
            padding: "10px 12px",
            cursor: busy ? "not-allowed" : "pointer",
          }}
        >
          {busy ? "Pracuji..." : isLogin ? "Přihlásit se" : "Vytvořit účet"}
        </button>

        <button
          type="button"
          onClick={() => onModeChange(isLogin ? "register" : "login")}
          disabled={busy}
          style={{
            marginTop: 10,
            width: "100%",
            border: "1px solid rgba(111, 206, 255, 0.22)",
            background: "rgba(9, 18, 33, 0.7)",
            color: "#cff5ff",
            borderRadius: 10,
            fontWeight: 600,
            padding: "9px 12px",
            cursor: busy ? "not-allowed" : "pointer",
          }}
        >
          {isLogin ? "Nemám účet, chci registraci" : "Už mám účet, chci přihlášení"}
        </button>
      </form>
    </div>
  );
}

function GalaxySelector({
  galaxies,
  selectedGalaxyId,
  newGalaxyName,
  loading,
  busy,
  error,
  onSelect,
  onCreate,
  onExtinguish,
  onNameChange,
  onRefresh,
}) {
  return (
    <div
      style={{
        width: "100vw",
        height: "100vh",
        background: "radial-gradient(circle at 20% 20%, #0f1e33 0%, #050812 48%, #020205 100%)",
        display: "grid",
        placeItems: "center",
        fontFamily: "ui-sans-serif, system-ui, -apple-system, Segoe UI, Roboto, sans-serif",
        color: "#d9f8ff",
        padding: 16,
      }}
    >
      <div
        style={{
          width: "min(760px, 96vw)",
          borderRadius: 16,
          border: "1px solid rgba(120, 210, 255, 0.32)",
          background: "linear-gradient(160deg, rgba(8,16,30,0.92), rgba(5,10,20,0.86))",
          padding: 18,
          boxShadow: "0 0 32px rgba(67, 193, 255, 0.15)",
          backdropFilter: "blur(8px)",
        }}
      >
        <div style={{ fontSize: 12, opacity: 0.76, letterSpacing: 0.8 }}>GALAXY SELECTOR</div>
        <div style={{ marginTop: 8, fontSize: 24, fontWeight: 700 }}>Vyber galaxii</div>
        <div style={{ marginTop: 6, fontSize: 13, opacity: 0.8 }}>
          Data jsou izolovaná per uživatel i galaxie. Bez výběru galaxie nelze načíst snapshot.
        </div>

        <div style={{ marginTop: 14, display: "flex", gap: 10 }}>
          <input
            value={newGalaxyName}
            onChange={(e) => onNameChange(e.target.value)}
            placeholder="Název nové galaxie"
            style={{
              flex: 1,
              borderRadius: 10,
              border: "1px solid rgba(118, 215, 255, 0.28)",
              background: "rgba(4, 8, 16, 0.9)",
              color: "#d8f7ff",
              padding: "11px 12px",
              fontSize: 14,
              outline: "none",
            }}
          />
          <button
            type="button"
            onClick={onCreate}
            disabled={busy}
            style={{
              border: "1px solid rgba(110, 225, 255, 0.52)",
              background: busy
                ? "linear-gradient(120deg, rgba(63,95,110,0.7), rgba(48,66,80,0.7))"
                : "linear-gradient(120deg, #18b2e2, #36d6ff)",
              color: busy ? "#b9c8cf" : "#02121c",
              borderRadius: 10,
              fontWeight: 700,
              letterSpacing: 0.2,
              padding: "0 14px",
              minWidth: 100,
              cursor: busy ? "not-allowed" : "pointer",
            }}
          >
            Vytvořit
          </button>
          <button
            type="button"
            onClick={onRefresh}
            disabled={busy || loading}
            style={{
              border: "1px solid rgba(111, 206, 255, 0.28)",
              background: "rgba(9, 18, 33, 0.7)",
              color: "#cff5ff",
              borderRadius: 10,
              fontWeight: 600,
              padding: "0 12px",
              cursor: busy || loading ? "not-allowed" : "pointer",
            }}
          >
            Obnovit
          </button>
        </div>

        {error ? <div style={{ marginTop: 10, color: "#ff9db0", fontSize: 13 }}>{error}</div> : null}

        <div
          style={{
            marginTop: 12,
            borderRadius: 12,
            border: "1px solid rgba(112, 218, 255, 0.22)",
            overflow: "hidden",
            background: "rgba(4, 9, 18, 0.7)",
            maxHeight: "50vh",
            overflowY: "auto",
          }}
        >
          {loading ? (
            <div style={{ padding: 14, fontSize: 14, opacity: 0.84 }}>Načítám galaxie...</div>
          ) : galaxies.length === 0 ? (
            <div style={{ padding: 14, fontSize: 14, opacity: 0.84 }}>Zatím nemáš žádnou galaxii.</div>
          ) : (
            galaxies.map((galaxy) => {
              const selected = galaxy.id === selectedGalaxyId;
              return (
                <div
                  key={galaxy.id}
                  style={{
                    display: "grid",
                    gridTemplateColumns: "1fr auto auto",
                    gap: 8,
                    padding: "10px 12px",
                    alignItems: "center",
                    borderBottom: "1px solid rgba(104, 188, 228, 0.14)",
                    background: selected ? "rgba(34, 76, 108, 0.35)" : "transparent",
                  }}
                >
                  <div>
                    <div style={{ fontSize: 14, fontWeight: 600 }}>{galaxy.name}</div>
                    <div style={{ fontSize: 12, opacity: 0.72 }}>{galaxy.id}</div>
                  </div>
                  <button
                    type="button"
                    onClick={() => onSelect(galaxy.id)}
                    style={{
                      border: "1px solid rgba(110, 225, 255, 0.45)",
                      background: selected
                        ? "linear-gradient(120deg, #4fd2ff, #8ee4ff)"
                        : "rgba(8, 20, 34, 0.82)",
                      color: selected ? "#03253a" : "#d5f9ff",
                      borderRadius: 10,
                      padding: "7px 11px",
                      fontSize: 12,
                      cursor: "pointer",
                    }}
                  >
                    {selected ? "Aktivní" : "Vstoupit"}
                  </button>
                  <button
                    type="button"
                    onClick={() => onExtinguish(galaxy.id)}
                    disabled={busy}
                    style={{
                      border: "1px solid rgba(255, 120, 150, 0.45)",
                      background: "rgba(40, 13, 22, 0.75)",
                      color: "#ffc7d5",
                      borderRadius: 10,
                      padding: "7px 10px",
                      fontSize: 12,
                      cursor: busy ? "not-allowed" : "pointer",
                    }}
                  >
                    Soft delete
                  </button>
                </div>
              );
            })
          )}
        </div>
      </div>
    </div>
  );
}

function LayeredNavigationPanel({
  userEmail,
  galaxies,
  selectedGalaxyId,
  activeGalaxy,
  onSelectGalaxy,
  onOpenGalaxyOverview,
  onRefreshGalaxies,
  onLogout,
  galaxyLoading,
  galaxyBusy,
  galaxyError,
  appError,
  atomsCount,
  bondsCount,
  tableCount,
  tableContracts,
  activeTableId,
  onSelectTable,
  onClearTableFocus,
  activeTableAsteroids,
  selectedPlanetId,
  onSelectPlanet,
}) {
  return (
    <aside
      style={{
        pointerEvents: "auto",
        width: "min(360px, 96vw)",
        background: "rgba(8, 12, 20, 0.76)",
        border: "1px solid rgba(120, 198, 255, 0.35)",
        borderRadius: 14,
        padding: "12px 12px 10px",
        color: "#c9f3ff",
        backdropFilter: "blur(8px)",
        boxShadow: "0 0 24px rgba(73, 185, 238, 0.14)",
      }}
    >
      <div style={{ fontSize: 11, opacity: 0.75, letterSpacing: 0.7 }}>NAVIGATION LAYERS</div>
      <div style={{ marginTop: 4, fontSize: 12, opacity: 0.8 }}>Uživatel: {userEmail || "n/a"}</div>
      <div style={{ marginTop: 6, fontSize: 13, opacity: 0.88 }}>
        Asteroids {atomsCount} | Bonds {bondsCount} | Tables {tableCount}
      </div>

      <div
        style={{
          marginTop: 10,
          borderRadius: 10,
          border: "1px solid rgba(104, 188, 228, 0.22)",
          background: "rgba(7, 18, 30, 0.74)",
          padding: "9px 10px",
        }}
      >
        <div style={{ fontSize: 11, opacity: 0.76, letterSpacing: 0.45 }}>L1 / GALAXIES</div>
        <div style={{ marginTop: 5, fontSize: 13, fontWeight: 700 }}>{activeGalaxy?.name || "Bez výběru"}</div>
        <div style={{ marginTop: 4, maxHeight: 96, overflowY: "auto", display: "grid", gap: 6 }}>
          {galaxies.map((galaxy) => {
            const selected = galaxy.id === selectedGalaxyId;
            return (
              <button
                key={galaxy.id}
                type="button"
                onClick={() => onSelectGalaxy(galaxy.id)}
                style={{
                  border: "1px solid rgba(116, 216, 255, 0.28)",
                  background: selected ? "rgba(38, 89, 122, 0.74)" : "rgba(8, 20, 34, 0.82)",
                  color: "#d5f9ff",
                  borderRadius: 8,
                  padding: "6px 8px",
                  fontSize: 12,
                  textAlign: "left",
                  cursor: "pointer",
                }}
              >
                {galaxy.name}
              </button>
            );
          })}
        </div>
        <div style={{ marginTop: 6, display: "flex", gap: 6 }}>
          <button
            type="button"
            onClick={onOpenGalaxyOverview}
            style={{
              flex: 1,
              border: "1px solid rgba(116, 216, 255, 0.32)",
              background: "rgba(8, 20, 34, 0.82)",
              color: "#d5f9ff",
              borderRadius: 8,
              padding: "6px 8px",
              fontSize: 11,
              cursor: "pointer",
            }}
          >
            Přehled galaxií
          </button>
          <button
            type="button"
            onClick={onRefreshGalaxies}
            disabled={galaxyLoading || galaxyBusy}
            style={{
              flex: 1,
              border: "1px solid rgba(111, 206, 255, 0.32)",
              background: "rgba(9, 18, 33, 0.7)",
              color: "#cff5ff",
              borderRadius: 8,
              padding: "6px 8px",
              fontSize: 11,
              cursor: galaxyLoading || galaxyBusy ? "not-allowed" : "pointer",
            }}
          >
            Obnovit
          </button>
          <button
            type="button"
            onClick={onLogout}
            style={{
              flex: 1,
              border: "1px solid rgba(255, 120, 150, 0.45)",
              background: "rgba(40, 13, 22, 0.75)",
              color: "#ffc7d5",
              borderRadius: 8,
              padding: "6px 8px",
              fontSize: 11,
              cursor: "pointer",
            }}
          >
            Logout
          </button>
        </div>
      </div>

      <div
        style={{
          marginTop: 8,
          borderRadius: 10,
          border: "1px solid rgba(104, 188, 228, 0.22)",
          background: "rgba(7, 18, 30, 0.74)",
          padding: "9px 10px",
        }}
      >
        <div style={{ fontSize: 11, opacity: 0.76, letterSpacing: 0.45 }}>L2 / TABLES (SECTORS)</div>
        <div style={{ marginTop: 4, maxHeight: 132, overflowY: "auto", display: "grid", gap: 6 }}>
          {tableContracts.length ? (
            tableContracts.map((table) => {
              const selected = String(table.table_id) === String(activeTableId);
              return (
                <button
                  key={String(table.table_id)}
                  type="button"
                  onClick={() => onSelectTable(String(table.table_id))}
                  style={{
                    border: "1px solid rgba(116, 216, 255, 0.28)",
                    background: selected ? "rgba(38, 89, 122, 0.74)" : "rgba(8, 20, 34, 0.82)",
                    color: "#d5f9ff",
                    borderRadius: 8,
                    padding: "6px 8px",
                    fontSize: 12,
                    textAlign: "left",
                    cursor: "pointer",
                  }}
                >
                  <div style={{ fontWeight: 600 }}>{table.name}</div>
                  <div style={{ marginTop: 2, fontSize: 11, opacity: 0.76 }}>
                    Rows {table.members.length} | Fields {table.schema_fields.length}
                  </div>
                </button>
              );
            })
          ) : (
            <div style={{ fontSize: 12, opacity: 0.74 }}>Tabulky zatím nejsou k dispozici.</div>
          )}
        </div>
        <button
          type="button"
          onClick={onClearTableFocus}
          disabled={!activeTableId}
          style={{
            marginTop: 6,
            width: "100%",
            border: "1px solid rgba(116, 216, 255, 0.24)",
            background: activeTableId ? "rgba(8, 20, 34, 0.82)" : "rgba(48, 60, 72, 0.6)",
            color: activeTableId ? "#d5f9ff" : "#9caab2",
            borderRadius: 8,
            padding: "6px 8px",
            fontSize: 11,
            cursor: activeTableId ? "pointer" : "not-allowed",
          }}
        >
          Zrušit fokus tabulky
        </button>
      </div>

      <div
        style={{
          marginTop: 8,
          borderRadius: 10,
          border: "1px solid rgba(104, 188, 228, 0.22)",
          background: "rgba(7, 18, 30, 0.74)",
          padding: "9px 10px",
        }}
      >
        <div style={{ fontSize: 11, opacity: 0.76, letterSpacing: 0.45 }}>L3 / ASTEROIDS</div>
        <div style={{ marginTop: 4, maxHeight: 196, overflowY: "auto", display: "grid", gap: 6 }}>
          {activeTableAsteroids.length ? (
            activeTableAsteroids.map((asteroid) => {
              const selected = asteroid.id === selectedPlanetId;
              return (
                <button
                  key={asteroid.id}
                  type="button"
                  onClick={() => onSelectPlanet(asteroid.id)}
                  style={{
                    border: "1px solid rgba(116, 216, 255, 0.25)",
                    background: selected ? "rgba(49, 101, 134, 0.78)" : "rgba(8, 20, 34, 0.82)",
                    color: "#e2fbff",
                    borderRadius: 8,
                    padding: "6px 8px",
                    fontSize: 12,
                    textAlign: "left",
                    cursor: "pointer",
                  }}
                >
                  <div style={{ fontWeight: 600 }}>{valueToLabel(asteroid.value)}</div>
                  <div style={{ marginTop: 2, fontSize: 11, opacity: 0.74 }}>
                    Created {formatCreatedAt(asteroid.created_at)}
                  </div>
                </button>
              );
            })
          ) : (
            <div style={{ fontSize: 12, opacity: 0.74 }}>
              {activeTableId ? "Vybraná tabulka neobsahuje asteroidy." : "Vyber tabulku v L2."}
            </div>
          )}
        </div>
      </div>

      {galaxyError ? <div style={{ marginTop: 8, color: "#ff8fa3", fontSize: 12 }}>{galaxyError}</div> : null}
      {appError ? <div style={{ marginTop: 4, color: "#ff8fa3", fontSize: 12 }}>{appError}</div> : null}
    </aside>
  );
}

function GridWorkbench({
  open,
  onToggle,
  maximized,
  onToggleMaximized,
  historicalMode,
  activeTableName,
  columns,
  rows,
  draftValues,
  busyCellKey,
  newRowLabel,
  onNewRowLabelChange,
  onCreateRow,
  onDeleteRow,
  onCellChange,
  onCellCommit,
  error,
}) {
  const renderCellValue = (row, field) => {
    const key = `${row.id}::${field}`;
    if (Object.prototype.hasOwnProperty.call(draftValues, key)) {
      return draftValues[key];
    }
    if (field === "value") {
      return valueToLabel(row.value);
    }
    return valueToLabel(row.metadata?.[field] ?? "");
  };

  const focusCell = (rowIndex, colIndex) => {
    if (rowIndex < 0 || colIndex < 0) return;
    const selector = `[data-grid-row="${rowIndex}"][data-grid-col="${colIndex}"]`;
    const next = document.querySelector(selector);
    if (next instanceof HTMLInputElement) {
      next.focus();
      next.select();
    }
  };

  return (
    <section
      style={{
        position: "absolute",
        left: maximized ? 12 : 20,
        right: maximized ? 12 : 20,
        top: maximized ? 74 : "auto",
        bottom: maximized ? 16 : 104,
        zIndex: maximized ? 30 : 19,
        pointerEvents: "auto",
        background: "rgba(7, 14, 24, 0.84)",
        border: "1px solid rgba(108, 206, 245, 0.3)",
        borderRadius: 12,
        backdropFilter: "blur(8px)",
        boxShadow: "0 0 24px rgba(56, 173, 225, 0.12)",
      }}
    >
      <div
        style={{
          display: "flex",
          gap: 8,
          justifyContent: "space-between",
          alignItems: "center",
          padding: "8px 10px",
          borderBottom: open ? "1px solid rgba(108, 206, 245, 0.16)" : "none",
        }}
      >
        <div style={{ minWidth: 0 }}>
          <div style={{ fontSize: 11, opacity: 0.72, letterSpacing: 0.6 }}>GRID WORKBENCH</div>
          <div style={{ marginTop: 2, fontSize: 12, opacity: 0.88, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
            Tabulka: <strong>{activeTableName || "n/a"}</strong> | Řádky: {rows.length} | Sloupce: {columns.length}
          </div>
        </div>
        <div style={{ display: "flex", gap: 8 }}>
          {open ? (
            <button
              type="button"
              onClick={onToggleMaximized}
              style={{
                border: "1px solid rgba(116, 216, 255, 0.35)",
                background: "rgba(8, 20, 34, 0.82)",
                color: "#d5f9ff",
                borderRadius: 999,
                padding: "5px 10px",
                fontSize: 11,
                cursor: "pointer",
              }}
            >
              {maximized ? "Minimalizovat" : "Maximalizovat"}
            </button>
          ) : null}
          <button
            type="button"
            onClick={onToggle}
            style={{
              border: "1px solid rgba(116, 216, 255, 0.35)",
              background: "rgba(8, 20, 34, 0.82)",
              color: "#d5f9ff",
              borderRadius: 999,
              padding: "5px 10px",
              fontSize: 11,
              cursor: "pointer",
            }}
          >
            {open ? "Skrýt grid" : "Zobrazit grid"}
          </button>
        </div>
      </div>

      {open ? (
        <div style={{ padding: "8px 10px 10px" }}>
          <div style={{ marginBottom: 8, fontSize: 11, opacity: 0.7 }}>
            Tip: `Enter` uloží buňku a skočí o řádek níž, `Shift+Enter` o řádek výš.
          </div>
          <div style={{ display: "flex", gap: 8, marginBottom: 8 }}>
            <input
              value={newRowLabel}
              onChange={(event) => onNewRowLabelChange(event.target.value)}
              placeholder="Nový řádek (název asteroidu)"
              disabled={historicalMode}
              style={{
                flex: 1,
                borderRadius: 8,
                border: "1px solid rgba(118, 215, 255, 0.25)",
                background: "rgba(4, 8, 16, 0.9)",
                color: "#d8f7ff",
                padding: "8px 10px",
                fontSize: 13,
                outline: "none",
              }}
            />
            <button
              type="button"
              onClick={onCreateRow}
              disabled={historicalMode || !newRowLabel.trim()}
              style={{
                border: "1px solid rgba(110, 225, 255, 0.5)",
                background: historicalMode || !newRowLabel.trim()
                  ? "linear-gradient(120deg, rgba(63,95,110,0.7), rgba(48,66,80,0.7))"
                  : "linear-gradient(120deg, #18b2e2, #36d6ff)",
                color: historicalMode || !newRowLabel.trim() ? "#b9c8cf" : "#02121c",
                borderRadius: 8,
                fontWeight: 700,
                padding: "0 12px",
                fontSize: 12,
                cursor: historicalMode || !newRowLabel.trim() ? "not-allowed" : "pointer",
              }}
            >
              Přidat řádek
            </button>
          </div>

          <div
            style={{
              maxHeight: maximized ? "calc(100vh - 250px)" : 260,
              overflow: "auto",
              border: "1px solid rgba(106, 194, 232, 0.18)",
              borderRadius: 8,
            }}
          >
            <table style={{ width: "100%", borderCollapse: "collapse", minWidth: 680 }}>
              <thead>
                <tr>
                  <th
                    style={{
                      position: "sticky",
                      top: 0,
                      background: "rgba(8, 18, 30, 0.96)",
                      color: "#bdeeff",
                      textAlign: "left",
                      padding: "7px 8px",
                      fontSize: 11,
                      borderBottom: "1px solid rgba(106, 194, 232, 0.18)",
                      width: 56,
                    }}
                  >
                    #
                  </th>
                  {columns.map((column) => (
                    <th
                      key={column}
                      style={{
                        position: "sticky",
                        top: 0,
                        background: "rgba(8, 18, 30, 0.96)",
                        color: "#bdeeff",
                        textAlign: "left",
                        padding: "7px 8px",
                        fontSize: 11,
                        borderBottom: "1px solid rgba(106, 194, 232, 0.18)",
                      }}
                    >
                      {column}
                    </th>
                  ))}
                  <th
                    style={{
                      position: "sticky",
                      top: 0,
                      background: "rgba(8, 18, 30, 0.96)",
                      color: "#bdeeff",
                      textAlign: "left",
                      padding: "7px 8px",
                      fontSize: 11,
                      borderBottom: "1px solid rgba(106, 194, 232, 0.18)",
                      width: 76,
                    }}
                  >
                    Akce
                  </th>
                </tr>
              </thead>
              <tbody>
                {rows.map((row, rowIndex) => (
                  <tr key={row.id}>
                    <td
                      style={{
                        borderBottom: "1px solid rgba(95, 169, 202, 0.14)",
                        padding: "6px 8px",
                        color: "#98cddd",
                        fontSize: 11,
                        whiteSpace: "nowrap",
                      }}
                    >
                      {rowIndex + 1}
                    </td>
                    {columns.map((column, columnIndex) => {
                      const key = `${row.id}::${column}`;
                      const busy = busyCellKey === key;
                      return (
                        <td
                          key={key}
                          style={{
                            borderBottom: "1px solid rgba(95, 169, 202, 0.14)",
                            padding: "6px 8px",
                            background: busy ? "rgba(20, 54, 72, 0.6)" : "transparent",
                          }}
                        >
                          <input
                            value={renderCellValue(row, column)}
                            data-grid-row={rowIndex}
                            data-grid-col={columnIndex}
                            onChange={(event) => onCellChange(row.id, column, event.target.value)}
                            onBlur={() => onCellCommit(row.id, column)}
                            onKeyDown={(event) => {
                              if (event.key === "Enter") {
                                event.preventDefault();
                                onCellCommit(row.id, column);
                                focusCell(event.shiftKey ? rowIndex - 1 : rowIndex + 1, columnIndex);
                              }
                            }}
                            disabled={historicalMode || busy}
                            style={{
                              width: "100%",
                              borderRadius: 6,
                              border: "1px solid rgba(117, 203, 235, 0.18)",
                              background: "rgba(3, 7, 14, 0.9)",
                              color: "#ddf9ff",
                              padding: "6px 7px",
                              fontSize: 12,
                              outline: "none",
                            }}
                          />
                        </td>
                      );
                    })}
                    <td style={{ borderBottom: "1px solid rgba(95, 169, 202, 0.14)", padding: "6px 8px" }}>
                      <button
                        type="button"
                        onClick={() => onDeleteRow(row.id)}
                        disabled={historicalMode}
                        style={{
                          border: "1px solid rgba(255, 120, 150, 0.45)",
                          background: "rgba(40, 13, 22, 0.75)",
                          color: "#ffc7d5",
                          borderRadius: 8,
                          padding: "5px 8px",
                          fontSize: 11,
                          cursor: historicalMode ? "not-allowed" : "pointer",
                        }}
                      >
                        Zhasni
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {error ? <div style={{ marginTop: 7, color: "#ff9db0", fontSize: 12 }}>{error}</div> : null}
        </div>
      ) : null}
    </section>
  );
}

export default function App() {
  const {
    user,
    defaultGalaxy,
    isAuthenticated,
    isLoading: authLoading,
    login,
    register,
    logout,
    setDefaultGalaxy,
  } = useAuth();
  const [authMode, setAuthMode] = useState("login");
  const [authEmail, setAuthEmail] = useState("");
  const [authPassword, setAuthPassword] = useState("");
  const [authBusy, setAuthBusy] = useState(false);
  const [authError, setAuthError] = useState("");
  const [selectedGalaxyId, setSelectedGalaxyId] = useState(() => localStorage.getItem(SELECTED_GALAXY_STORAGE_KEY) || "");
  const [galaxies, setGalaxies] = useState([]);
  const [newGalaxyName, setNewGalaxyName] = useState("");
  const [galaxyLoading, setGalaxyLoading] = useState(false);
  const [galaxyBusy, setGalaxyBusy] = useState(false);
  const [galaxyError, setGalaxyError] = useState("");
  const [atoms, setAtoms] = useState([]);
  const [bonds, setBonds] = useState([]);
  const [tables, setTables] = useState([]);
  const [activeTableId, setActiveTableId] = useState("");
  const [gridOpen, setGridOpen] = useState(true);
  const [gridMaximized, setGridMaximized] = useState(false);
  const [gridDraftValues, setGridDraftValues] = useState({});
  const [gridBusyCellKey, setGridBusyCellKey] = useState("");
  const [gridError, setGridError] = useState("");
  const [newGridRowLabel, setNewGridRowLabel] = useState("");
  const [uiPreset, setUiPreset] = useState("focus");
  const [commandMode, setCommandMode] = useState("auto");
  const [query, setQuery] = useState("");
  const [asOfInput, setAsOfInput] = useState("");
  const [selectedPlanetId, setSelectedPlanetId] = useState(null);
  const [auditTargetId, setAuditTargetId] = useState(null);
  const [hoveredFlow, setHoveredFlow] = useState(null);
  const [assistOpen, setAssistOpen] = useState(false);
  const [assistPinned, setAssistPinned] = useState(false);
  const [navHelpOpen, setNavHelpOpen] = useState(false);
  const [commandFocused, setCommandFocused] = useState(false);
  const [activeSuggestionIndex, setActiveSuggestionIndex] = useState(0);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const commandInputRef = useRef(null);
  const layoutStateRef = useRef({ signature: "", positions: new Map(), sectors: [] });
  const asOfIso = useMemo(() => toAsOfIso(asOfInput), [asOfInput]);
  const historicalMode = Boolean(asOfIso);
  const smartUiFocus = uiPreset === "focus";

  useEffect(() => {
    if (selectedGalaxyId) {
      localStorage.setItem(SELECTED_GALAXY_STORAGE_KEY, selectedGalaxyId);
      return;
    }
    localStorage.removeItem(SELECTED_GALAXY_STORAGE_KEY);
  }, [selectedGalaxyId]);

  useEffect(() => {
    if (isAuthenticated) return;
    setSelectedGalaxyId("");
    setGalaxies([]);
    setNewGalaxyName("");
    setGalaxyLoading(false);
    setGalaxyBusy(false);
    setGalaxyError("");
    setAtoms([]);
    setBonds([]);
    setTables([]);
    setActiveTableId("");
    setGridDraftValues({});
    setGridBusyCellKey("");
    setGridError("");
    setGridMaximized(false);
    setNewGridRowLabel("");
    setSelectedPlanetId(null);
    setError("");
  }, [isAuthenticated]);

  const loadGalaxies = useCallback(async () => {
    if (!isAuthenticated) return;
    setGalaxyError("");
    setGalaxyLoading(true);
    try {
      const res = await apiFetch(`${API_BASE}/galaxies`);
      if (!res.ok) {
        const message = await parseApiError(res, `Galaxies failed: ${res.status}`);
        throw new Error(message);
      }
      const data = await res.json();
      const activeGalaxies = Array.isArray(data) ? data.filter((galaxy) => !galaxy?.deleted_at) : [];
      setGalaxies(activeGalaxies);
      setSelectedGalaxyId((prev) => {
        if (prev && activeGalaxies.some((galaxy) => galaxy.id === prev)) {
          return prev;
        }
        const stored = localStorage.getItem(SELECTED_GALAXY_STORAGE_KEY);
        if (stored && activeGalaxies.some((galaxy) => galaxy.id === stored)) {
          return stored;
        }
        if (defaultGalaxy?.id && activeGalaxies.some((galaxy) => galaxy.id === defaultGalaxy.id)) {
          return defaultGalaxy.id;
        }
        return activeGalaxies[0]?.id || "";
      });
    } catch (loadError) {
      setGalaxyError(loadError.message || "Načtení galaxií selhalo");
    } finally {
      setGalaxyLoading(false);
    }
  }, [defaultGalaxy?.id, isAuthenticated]);

  useEffect(() => {
    if (!isAuthenticated) return;
    loadGalaxies();
  }, [isAuthenticated, loadGalaxies]);

  const loadSnapshot = useCallback(async () => {
    if (!isAuthenticated || !selectedGalaxyId) {
      setAtoms([]);
      setBonds([]);
      setTables([]);
      setActiveTableId("");
      return;
    }
    setError("");
    const [snapshotResponse, tablesResponse] = await Promise.all([
      apiFetch(buildSnapshotUrl(API_BASE, asOfIso, selectedGalaxyId)),
      apiFetch(buildTablesUrl(API_BASE, asOfIso, selectedGalaxyId)),
    ]);

    if (!snapshotResponse.ok) {
      const message = await parseApiError(snapshotResponse, `Snapshot failed: ${snapshotResponse.status}`);
      throw new Error(message);
    }
    if (!tablesResponse.ok) {
      const message = await parseApiError(tablesResponse, `Tables failed: ${tablesResponse.status}`);
      throw new Error(message);
    }

    const data = await snapshotResponse.json();
    const tablesPayload = await tablesResponse.json();
    const nextTables = Array.isArray(tablesPayload?.tables) ? tablesPayload.tables : [];
    const { asteroids: nextAsteroids, bonds: nextBonds } = normalizeSnapshot(data);
    setAtoms(nextAsteroids);
    setBonds(nextBonds);
    setTables(nextTables);
  }, [asOfIso, isAuthenticated, selectedGalaxyId]);

  useEffect(() => {
    if (!isAuthenticated || !selectedGalaxyId) return;
    loadSnapshot().catch((e) => setError(e.message));
  }, [isAuthenticated, selectedGalaxyId, loadSnapshot]);

  const handleAuthSubmit = useCallback(
    async (event) => {
      event.preventDefault();
      if (authBusy) return;
      setAuthBusy(true);
      setAuthError("");
      try {
        const action = authMode === "login" ? login : register;
        const authResult = await action(authEmail.trim(), authPassword);
        const nextGalaxyId = authResult?.default_galaxy?.id || "";
        if (nextGalaxyId) {
          setDefaultGalaxy(authResult.default_galaxy || null);
          setSelectedGalaxyId(nextGalaxyId);
        }
        setAuthPassword("");
        setError("");
        setGalaxyError("");
      } catch (submitError) {
        setAuthError(submitError.message || "Autentizace selhala");
      } finally {
        setAuthBusy(false);
      }
    },
    [authBusy, authEmail, authMode, authPassword, login, register, setDefaultGalaxy]
  );

  const handleCreateGalaxy = useCallback(async () => {
    const name = newGalaxyName.trim();
    if (!name || galaxyBusy) return;
    setGalaxyBusy(true);
    setGalaxyError("");
    try {
      const res = await apiFetch(`${API_BASE}/galaxies`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name }),
      });
      if (!res.ok) {
        const message = await parseApiError(res, `Create galaxy failed: ${res.status}`);
        throw new Error(message);
      }
      const created = await res.json();
      setGalaxies((prev) => {
        if (prev.some((item) => item.id === created.id)) return prev;
        return [...prev, created];
      });
      setDefaultGalaxy((prevDefault) => prevDefault || created);
      setSelectedGalaxyId(created.id);
      setNewGalaxyName("");
    } catch (createError) {
      setGalaxyError(createError.message || "Vytvoření galaxie selhalo");
    } finally {
      setGalaxyBusy(false);
    }
  }, [galaxyBusy, newGalaxyName, setDefaultGalaxy]);

  const handleExtinguishGalaxy = useCallback(
    async (galaxyId) => {
      if (!galaxyId || galaxyBusy) return;
      setGalaxyBusy(true);
      setGalaxyError("");
      try {
        const res = await apiFetch(`${API_BASE}/galaxies/${galaxyId}/extinguish`, {
          method: "PATCH",
        });
        if (!res.ok) {
          const message = await parseApiError(res, `Soft delete galaxy failed: ${res.status}`);
          throw new Error(message);
        }
        setGalaxies((prev) => prev.filter((galaxy) => galaxy.id !== galaxyId));
        setSelectedPlanetId(null);
        if (selectedGalaxyId === galaxyId) {
          setSelectedGalaxyId("");
          setAtoms([]);
          setBonds([]);
          setTables([]);
          setActiveTableId("");
          setError("");
        }
      } catch (extinguishError) {
        setGalaxyError(extinguishError.message || "Soft delete galaxie selhal");
      } finally {
        setGalaxyBusy(false);
      }
    },
    [galaxyBusy, selectedGalaxyId]
  );

  const visualData = useMemo(() => {
    const normalizedAsteroids = atoms.map((asteroid) => ({
      ...asteroid,
      metadata: safeMetadata(asteroid?.metadata),
      calculated_values:
        asteroid?.calculated_values &&
        typeof asteroid.calculated_values === "object" &&
        !Array.isArray(asteroid.calculated_values)
          ? asteroid.calculated_values
          : {},
      active_alerts: Array.isArray(asteroid?.active_alerts) ? asteroid.active_alerts : [],
      created_at: asteroid?.created_at || null,
    }));
    const sortedAsteroids = [...normalizedAsteroids].sort((a, b) => a.id.localeCompare(b.id));
    const sortedBonds = [...bonds].sort((a, b) => a.id.localeCompare(b.id));
    const physicsAsteroids = sortedAsteroids.map((asteroid) => {
      const metadata = safeMetadata(asteroid.metadata);
      const calculatedValues =
        asteroid?.calculated_values && typeof asteroid.calculated_values === "object" && !Array.isArray(asteroid.calculated_values)
          ? asteroid.calculated_values
          : {};
      const formulaFields = extractFormulaFields(metadata);
      const availableFields = new Set([...Object.keys(metadata), ...Object.keys(calculatedValues)]);
      const valueSignal = extractComputedValue({ ...asteroid, metadata, calculated_values: calculatedValues });
      const physics = mapValueToPhysics(valueSignal);
      const category = typeof asteroid?.table_name === "string" && asteroid.table_name.trim()
        ? asteroid.table_name.trim()
        : inferCategory(asteroid);
      const hashId = hashText(asteroid.id);
      const hashVal = hashText(valueToLabel(asteroid.value));
      const baseRadius = 0.8 + (hashId % 10) * 0.05;
      return {
        ...asteroid,
        metadata,
        calculated_values: calculatedValues,
        formulaFields,
        availableFields,
        hashId,
        hashVal,
        baseRadius,
        category,
        mass: physics.mass,
        visualScale: physics.scale,
        physicsIntensity: physics.intensity,
        collisionRadius: baseRadius * physics.scale + 1.8,
        isCategoryCore: Boolean(category),
      };
    });

    const asteroidById = new Map(physicsAsteroids.map((asteroid) => [asteroid.id, asteroid]));
    const directedBonds = sortedBonds
      .map((bond) => {
        const source = asteroidById.get(bond.source_id);
        const target = asteroidById.get(bond.target_id);
        if (!source || !target) return null;

        const sourceFormulaFields = source.formulaFields || new Set();
        const targetFormulaFields = target.formulaFields || new Set();
        const sourceAvailable = source.availableFields || new Set();
        const targetAvailable = target.availableFields || new Set();

        const forwardField = [...targetFormulaFields].find((field) => sourceAvailable.has(field));
        const reverseField = [...sourceFormulaFields].find((field) => targetAvailable.has(field));

        let flowSourceId = source.id;
        let flowTargetId = target.id;
        let flowField = null;

        if (forwardField && !reverseField) {
          flowSourceId = source.id;
          flowTargetId = target.id;
          flowField = forwardField;
        } else if (!forwardField && reverseField) {
          flowSourceId = target.id;
          flowTargetId = source.id;
          flowField = reverseField;
        } else if (forwardField && reverseField) {
          if (targetFormulaFields.size >= sourceFormulaFields.size) {
            flowSourceId = source.id;
            flowTargetId = target.id;
            flowField = forwardField;
          } else {
            flowSourceId = target.id;
            flowTargetId = source.id;
            flowField = reverseField;
          }
        }

        const flowSource = asteroidById.get(flowSourceId);
        const transferValue =
          flowField && flowSource
            ? flowSource.calculated_values?.[flowField] ?? flowSource.metadata?.[flowField]
            : null;
        const flowLabel = flowField
          ? `Přesun: ${valueToLabel(transferValue ?? "n/a")} (${flowField})`
          : `Tok: ${valueToLabel(asteroidById.get(flowSourceId)?.value)} -> ${valueToLabel(asteroidById.get(flowTargetId)?.value)}`;

        return {
          ...bond,
          flow_source_id: flowSourceId,
          flow_target_id: flowTargetId,
          flow_field: flowField || null,
          flowLabel,
        };
      })
      .filter(Boolean);

    const layoutSignature = [
      physicsAsteroids
        .map((asteroid) => {
          const formulaSignature = [...(asteroid.formulaFields || new Set())].sort().join(",");
          return `${asteroid.id}:${Number(asteroid.mass || 1).toFixed(4)}:${Number(asteroid.collisionRadius || 1).toFixed(4)}:${formulaSignature}`;
        })
        .join("|"),
      directedBonds
        .map((bond) => `${bond.id}:${bond.flow_source_id}->${bond.flow_target_id}:${bond.flow_field || ""}`)
        .join("|"),
    ].join("::");

    let positionById;
    let sectorPlates;
    if (layoutStateRef.current.signature === layoutSignature) {
      positionById = new Map(layoutStateRef.current.positions);
      sectorPlates = Array.isArray(layoutStateRef.current.sectors) ? layoutStateRef.current.sectors : [];
    } else {
      const sectorLayout = calculateSectorLayout({
        nodes: physicsAsteroids,
        edges: directedBonds,
        previousPositions: layoutStateRef.current.positions,
      });
      positionById = new Map(sectorLayout.positions);
      sectorPlates = Array.isArray(sectorLayout.sectors) ? sectorLayout.sectors : [];
      layoutStateRef.current = {
        signature: layoutSignature,
        positions: new Map([...positionById.entries()].map(([id, p]) => [id, [p[0], p[1], p[2]]])),
        sectors: sectorPlates,
      };
    }

    const hasAudit = Boolean(auditTargetId);
    const hasFocus = Boolean(selectedPlanetId);
    const normalizedActiveTableId = activeTableId ? String(activeTableId) : "";
    const hasTableFocus = Boolean(normalizedActiveTableId);
    const tableFocusedAtomIds = new Set(
      physicsAsteroids
        .filter((asteroid) => String(asteroid.table_id || "") === normalizedActiveTableId)
        .map((asteroid) => asteroid.id)
    );
    const tableFocusedBondIds = new Set(
      directedBonds
        .filter((bond) => tableFocusedAtomIds.has(bond.source_id) && tableFocusedAtomIds.has(bond.target_id))
        .map((bond) => bond.id)
    );
    const highlightedAtomIds = new Set();
    const highlightedBondIds = new Set();

    if (hasAudit && asteroidById.has(auditTargetId)) {
      const incomingByTarget = new Map();
      directedBonds.forEach((bond) => {
        if (!incomingByTarget.has(bond.flow_target_id)) {
          incomingByTarget.set(bond.flow_target_id, []);
        }
        incomingByTarget.get(bond.flow_target_id)?.push(bond);
      });
      const stack = [auditTargetId];
      highlightedAtomIds.add(auditTargetId);
      while (stack.length) {
        const targetId = stack.pop();
        const incoming = incomingByTarget.get(targetId) || [];
        incoming.forEach((bond) => {
          highlightedBondIds.add(bond.id);
          if (!highlightedAtomIds.has(bond.flow_source_id)) {
            highlightedAtomIds.add(bond.flow_source_id);
            stack.push(bond.flow_source_id);
          }
        });
      }
    } else if (hasFocus) {
      highlightedAtomIds.add(selectedPlanetId);
      directedBonds.forEach((bond) => {
        if (bond.source_id === selectedPlanetId) {
          highlightedAtomIds.add(bond.target_id);
          highlightedBondIds.add(bond.id);
        } else if (bond.target_id === selectedPlanetId) {
          highlightedAtomIds.add(bond.source_id);
          highlightedBondIds.add(bond.id);
        }
      });
    }

    const enrichedAtoms = physicsAsteroids.map((asteroid) => {
      const activeAlerts = Array.isArray(asteroid.active_alerts) ? asteroid.active_alerts : [];
      const isGuardianRed = activeAlerts.includes("color_red");
      const isGuardianHidden = activeAlerts.includes("hide");
      const baseColor = PALETTE[asteroid.hashVal % PALETTE.length];
      const isRelated = hasAudit || hasFocus ? highlightedAtomIds.has(asteroid.id) : true;
      const inActiveTable = hasTableFocus ? tableFocusedAtomIds.has(asteroid.id) : true;
      const opacity = isGuardianHidden
        ? 0.04
        : hasAudit
          ? isRelated
            ? 1
            : 0.1
          : hasFocus
            ? isRelated
              ? 1
              : 0.15
            : hasTableFocus
              ? inActiveTable
                ? 1
                : 0.18
            : 1;
      return {
        ...asteroid,
        metadata: safeMetadata(asteroid.metadata),
        calculated_values: asteroid.calculated_values || {},
        active_alerts: activeAlerts,
        created_at: asteroid.created_at || null,
        type: SHAPES[asteroid.hashId % SHAPES.length],
        color: isGuardianRed ? "#ff2f3f" : baseColor,
        radius: asteroid.baseRadius,
        orbitTilt: ((asteroid.hashVal % 100) / 100 - 0.5) * 0.8,
        glowBoost: isGuardianRed
          ? Math.max(asteroid.physicsIntensity * 1.55, 2.2)
          : asteroid.isCategoryCore
            ? 1.55 * asteroid.physicsIntensity
            : asteroid.physicsIntensity,
        opacity,
        selected: asteroid.id === selectedPlanetId
      };
    });

    const atomPositions = {};
    enrichedAtoms.forEach((atom) => {
      atomPositions[atom.id] = positionById.get(atom.id) || [0, 0, 0];
    });

    const curvedBonds = directedBonds
      .map((bond) => {
        const start = atomPositions[bond.flow_source_id];
        const end = atomPositions[bond.flow_target_id];
        if (!start || !end) return null;
        const dx = end[0] - start[0];
        const dy = end[1] - start[1];
        const dz = end[2] - start[2];
        const distance = Math.sqrt(dx * dx + dy * dy + dz * dz);
        const control = [
          (start[0] + end[0]) / 2,
          (start[1] + end[1]) / 2 + clamp(1.9 + distance * 0.11, 1.9, 8.2),
          (start[2] + end[2]) / 2
        ];
        const isRelated = highlightedBondIds.has(bond.id);
        const inActiveTable = hasTableFocus ? tableFocusedBondIds.has(bond.id) : true;
        const opacity = hasAudit
          ? (isRelated ? 0.96 : 0.1)
          : hasFocus
            ? (isRelated ? 0.9 : 0.15)
            : hasTableFocus
              ? (inActiveTable ? 0.9 : 0.16)
              : 0.82;
        return {
          ...bond,
          opacity,
          flow_highlight: hasAudit ? isRelated : false,
          points: curvePoints(start, control, end, 64)
        };
      })
      .filter(Boolean);

    return { enrichedAtoms, atomPositions, curvedBonds, sectorPlates };
  }, [atoms, bonds, selectedPlanetId, auditTargetId, activeTableId]);

  const selectedPlanet = useMemo(() => {
    if (!selectedPlanetId) return null;
    const planet = visualData.enrichedAtoms.find((atom) => atom.id === selectedPlanetId);
    if (!planet) return null;
    return { ...planet, position: visualData.atomPositions[planet.id] || [0, 0, 0] };
  }, [selectedPlanetId, visualData]);

  const tableContracts = useMemo(() => {
    const source = Array.isArray(tables) ? tables : [];
    return source
      .map((table) => ({
        ...table,
        name: String(table?.name || "Uncategorized"),
        schema_fields: Array.isArray(table?.schema_fields) ? table.schema_fields : [],
        formula_fields: Array.isArray(table?.formula_fields) ? table.formula_fields : [],
        members: Array.isArray(table?.members) ? table.members : [],
        internal_bonds: Array.isArray(table?.internal_bonds) ? table.internal_bonds : [],
        external_bonds: Array.isArray(table?.external_bonds) ? table.external_bonds : [],
        sector: table?.sector && typeof table.sector === "object" ? table.sector : null,
      }))
      .sort((a, b) => String(a.name).localeCompare(String(b.name)));
  }, [tables]);

  const activeGalaxy = useMemo(
    () => galaxies.find((galaxy) => galaxy.id === selectedGalaxyId) || null,
    [galaxies, selectedGalaxyId]
  );

  const activeTableContract = useMemo(() => {
    if (!tableContracts.length) return null;
    if (activeTableId) {
      const byLayer = tableContracts.find((table) => String(table.table_id) === String(activeTableId));
      if (byLayer) return byLayer;
    }
    const selectedTableId = selectedPlanet?.table_id ? String(selectedPlanet.table_id) : null;
    if (selectedTableId) {
      const matched = tableContracts.find((table) => String(table.table_id) === selectedTableId);
      if (matched) return matched;
    }
    return tableContracts[0];
  }, [tableContracts, selectedPlanet, activeTableId]);

  const activeTableAsteroids = useMemo(() => {
    if (!activeTableContract) return [];
    const contractMemberIds = new Set(
      (Array.isArray(activeTableContract.members) ? activeTableContract.members : [])
        .map((member) => member?.id)
        .filter(Boolean)
    );
    return visualData.enrichedAtoms
      .filter((asteroid) => {
        const belongsByTable = String(asteroid.table_id || "") === String(activeTableContract.table_id);
        const belongsByMember = contractMemberIds.has(asteroid.id);
        return belongsByTable || belongsByMember;
      })
      .sort((a, b) => valueToLabel(a.value).localeCompare(valueToLabel(b.value)));
  }, [activeTableContract, visualData]);

  const gridColumns = useMemo(() => {
    const fieldSet = new Set();
    fieldSet.add("value");

    if (activeTableContract) {
      activeTableContract.schema_fields.forEach((field) => fieldSet.add(field));
      activeTableContract.formula_fields.forEach((field) => fieldSet.add(field));
    }
    activeTableAsteroids.forEach((row) => {
      Object.keys(safeMetadata(row.metadata)).forEach((field) => fieldSet.add(field));
    });

    const columns = [...fieldSet];
    const metadataColumns = columns.filter((column) => column !== "value").sort((a, b) => a.localeCompare(b));
    return ["value", ...metadataColumns];
  }, [activeTableContract, activeTableAsteroids]);

  const defaultUniverseView = useMemo(() => {
    const nodes = visualData.enrichedAtoms;
    if (!nodes.length) {
      return {
        position: [0, 64, 460],
        target: [0, 0, 0],
        minDistance: 10,
        maxDistance: 3600,
      };
    }

    let minX = Number.POSITIVE_INFINITY;
    let minY = Number.POSITIVE_INFINITY;
    let minZ = Number.POSITIVE_INFINITY;
    let maxX = Number.NEGATIVE_INFINITY;
    let maxY = Number.NEGATIVE_INFINITY;
    let maxZ = Number.NEGATIVE_INFINITY;
    nodes.forEach((node) => {
      const p = visualData.atomPositions[node.id] || [0, 0, 0];
      const radius = (node.radius || 0.9) * (node.visualScale || 1) + 2.8;
      minX = Math.min(minX, p[0] - radius);
      minY = Math.min(minY, p[1] - radius);
      minZ = Math.min(minZ, p[2] - radius);
      maxX = Math.max(maxX, p[0] + radius);
      maxY = Math.max(maxY, p[1] + radius);
      maxZ = Math.max(maxZ, p[2] + radius);
    });

    const cx = (minX + maxX) / 2;
    const cy = (minY + maxY) / 2;
    const cz = (minZ + maxZ) / 2;
    const spanX = Math.max(8, maxX - minX);
    const spanY = Math.max(8, maxY - minY);
    const spanZ = Math.max(8, maxZ - minZ);

    const fov = (55 * Math.PI) / 180;
    const aspect = 16 / 9;
    const fitHeight = spanY * 0.5;
    const fitWidthAsHeight = (spanX / aspect) * 0.5;
    const fitDepthAsHeight = (spanZ / aspect) * 0.5;
    const requiredHalfHeight = Math.max(fitHeight, fitWidthAsHeight, fitDepthAsHeight);
    const fitDistance = requiredHalfHeight / Math.tan(fov / 2);
    const marginFactor = 1.24;
    const viewDistance = clamp(fitDistance * marginFactor + spanZ * 0.18, 120, 6800);

    const diagonal = Math.sqrt(spanX * spanX + spanY * spanY + spanZ * spanZ);
    const minDistance = clamp(diagonal * 0.18 + 8, 8, 900);
    const maxDistance = clamp(viewDistance * 6.2, 680, 22000);

    const dir = new THREE.Vector3(0.32, 0.24, 1).normalize();

    return {
      position: [cx + dir.x * viewDistance, cy + dir.y * viewDistance, cz + dir.z * viewDistance],
      target: [cx, cy, cz],
      minDistance,
      maxDistance,
    };
  }, [visualData]);

  const selectedPlanetMetadata = useMemo(() => Object.entries(selectedPlanet?.metadata || {}), [selectedPlanet]);

  useEffect(() => {
    if (!tableContracts.length) {
      if (activeTableId) {
        setActiveTableId("");
      }
      return;
    }
    if (activeTableId && tableContracts.some((table) => String(table.table_id) === String(activeTableId))) {
      return;
    }
    setActiveTableId(String(tableContracts[0].table_id));
  }, [tableContracts, activeTableId]);

  useEffect(() => {
    if (!selectedPlanet?.table_id) return;
    const nextTableId = String(selectedPlanet.table_id);
    if (nextTableId && nextTableId !== activeTableId) {
      setActiveTableId(nextTableId);
    }
  }, [selectedPlanet, activeTableId]);

  useEffect(() => {
    if (selectedPlanetId && !selectedPlanet) {
      setSelectedPlanetId(null);
    }
  }, [selectedPlanetId, selectedPlanet]);

  useEffect(() => {
    if (!smartUiFocus) return;
    setAssistOpen(false);
    setNavHelpOpen(false);
  }, [smartUiFocus]);

  useEffect(() => {
    if (!auditTargetId) return;
    const exists = visualData.enrichedAtoms.some((atom) => atom.id === auditTargetId);
    if (!exists) {
      setAuditTargetId(null);
    }
  }, [auditTargetId, visualData]);

  useEffect(() => {
    if (!assistPinned && assistOpen && selectedPlanet) {
      setAssistOpen(false);
    }
  }, [assistPinned, assistOpen, selectedPlanet]);

  const runLocalFocus = useCallback(
    (targetText) => {
      const normalizedTarget = normalizeSearchText(targetText);
      if (!normalizedTarget) return false;

      const found = visualData.enrichedAtoms.find((atom) => {
        const label = normalizeSearchText(valueToLabel(atom.value));
        const atomId = normalizeSearchText(atom.id);
        return label === normalizedTarget || label.includes(normalizedTarget) || atomId === normalizedTarget;
      });
      if (!found) return false;

      setSelectedPlanetId(found.id);
      setAuditTargetId(null);
      setHoveredFlow(null);
      setError("");
      return true;
    },
    [visualData]
  );

  const smartTemplates = useMemo(() => {
    const selectedLabel = selectedPlanet ? valueToLabel(selectedPlanet.value) : "Projekt";
    return [
      {
        id: "link",
        title: "Propojit entity",
        hint: "Vytvoří vazbu RELATION mezi asteroidy",
        command: "Pavel + Audi",
      },
      {
        id: "type",
        title: "Typování asteroidu",
        hint: "Vytvoří TYPE vazbu",
        command: "Pavel : Zaměstnanec",
      },
      {
        id: "formula",
        title: "Výpočet metriky",
        hint: "Uloží vzorec do metadata",
        command: `Spočítej : ${selectedLabel}.celkem = SUM(cena)`,
      },
      {
        id: "find",
        title: "Lokální fokus",
        hint: "Najde asteroid bez volání API",
        command: `Ukaž : ${selectedLabel}`,
      },
      {
        id: "delete",
        title: "Soft delete",
        hint: "Skryje asteroid v live snapshotu",
        command: `Delete : ${selectedLabel}`,
      },
    ];
  }, [selectedPlanet]);

  const liveAtomCommands = useMemo(
    () =>
      visualData.enrichedAtoms.slice(0, 14).map((atom) => ({
        id: `focus-${atom.id}`,
        title: "Fokus na asteroid",
        hint: "Přelet kamery + detail panel",
        command: `Ukaž : ${valueToLabel(atom.value)}`,
      })),
    [visualData]
  );

  const smartSuggestions = useMemo(() => {
    const pool = [...smartTemplates, ...liveAtomCommands];
    const normalizedQuery = normalizeSearchText(query);
    const filtered = normalizedQuery
      ? pool.filter((item) => normalizeSearchText(`${item.title} ${item.hint} ${item.command}`).includes(normalizedQuery))
      : pool;
    return filtered.slice(0, MAX_SMART_SUGGESTIONS);
  }, [query, smartTemplates, liveAtomCommands]);

  useEffect(() => {
    setActiveSuggestionIndex(0);
  }, [query]);

  const contextHints = useMemo(() => {
    if (historicalMode) {
      return [
        "Jsi v historickém módu. Výpočty a snapshot jsou čteny k vybranému času.",
        "Pro tvorbu nových příkazů přepni zpět na Live mód (klávesa L).",
      ];
    }
    if (!atoms.length) {
      return [
        "Začni jedním asteroidem: napiš třeba „Firma ACME“ a dej EXECUTE.",
        "Pak propoj entity příkazem „Firma ACME + Produkt X“.",
      ];
    }
    if (selectedPlanet) {
      const selectedLabel = valueToLabel(selectedPlanet.value);
      return [
        `Vybraný asteroid: ${selectedLabel}. Můžeš na něj rovnou navázat vzorec.`,
        `Tip: „Spočítej : ${selectedLabel}.celkem = SUM(cena)“`,
      ];
    }
    return [
      "Klikni na planetu pro detail nebo napiš „Ukaž : Název“ pro lokální fokus asteroidu.",
      "Pro rychlý start stiskni / a vyber návrh ze Smart Assistu.",
    ];
  }, [historicalMode, atoms.length, selectedPlanet]);

  const guidedActions = useMemo(() => {
    const selectedLabel = selectedPlanet ? valueToLabel(selectedPlanet.value) : "Projekt";
    if (historicalMode) {
      return [
        {
          id: "guide-live",
          title: "Přejdi do Live módu",
          description: "V historickém módu jsou zápisy zamčené.",
          action: "live",
        },
      ];
    }

    if (!atoms.length) {
      return [
        {
          id: "guide-first",
          title: "Vytvoř první asteroid",
          description: "Začni jednou entitou.",
          command: "Firma ACME",
        },
        {
          id: "guide-second",
          title: "Přidej druhý asteroid",
          description: "Druhý uzel umožní vytvořit vazbu.",
          command: "Produkt X",
        },
        {
          id: "guide-link",
          title: "Propoj je spolu",
          description: "Vytvoř relation vazbu mezi uzly.",
          command: "Firma ACME + Produkt X",
        },
      ];
    }

    if (atoms.length > 0 && !bonds.length) {
      const fallbackA = valueToLabel(visualData.enrichedAtoms[0]?.value) || "A";
      const fallbackB = valueToLabel(visualData.enrichedAtoms[1]?.value) || "B";
      return [
        {
          id: "guide-link-existing",
          title: "Vytvoř první vazbu",
          description: "Vazby dají grafu strukturu.",
          command: `${fallbackA} + ${fallbackB}`,
        },
        {
          id: "guide-focus-existing",
          title: "Najdi konkrétní asteroid",
          description: "Lokální fokus bez API volání.",
          command: `Ukaž : ${fallbackA}`,
        },
      ];
    }

    return [
      {
        id: "guide-focus",
        title: "Fokus na objekt",
        description: "Kamera doletí k cíli a otevře detail.",
        command: `Ukaž : ${selectedLabel}`,
      },
      {
        id: "guide-formula",
        title: "Přidej výpočet",
        description: "Ulož vzorec do metadat cíle.",
        command: `Spočítej : ${selectedLabel}.celkem = SUM(cena)`,
      },
      {
        id: "guide-soft-delete",
        title: "Soft delete",
        description: "Skryje objekt, data zůstanou v historii.",
        command: `Delete : ${selectedLabel}`,
      },
    ];
  }, [historicalMode, atoms.length, bonds.length, selectedPlanet, visualData]);

  const hasFormulaConfigured = useMemo(() => {
    return visualData.enrichedAtoms.some((asteroid) =>
      Object.values(safeMetadata(asteroid.metadata)).some(
        (item) => typeof item === "string" && item.trim().startsWith("=")
      )
    );
  }, [visualData]);

  const fixedWorkflow = useMemo(() => {
    const hasTable = Boolean(activeTableContract);
    const hasRows = hasTable && activeTableAsteroids.length > 0;
    const hasExecutionSignal = bonds.length > 0 || hasFormulaConfigured || Boolean(selectedPlanetId);
    return [
      {
        id: "wf-table",
        title: "1. Vyber tabulku",
        detail: hasTable ? `Aktivní: ${activeTableContract?.name || "n/a"}` : "Vyber sektor/tabulku vlevo",
        done: hasTable,
      },
      {
        id: "wf-grid",
        title: "2. Uprav grid",
        detail: hasRows ? `${activeTableAsteroids.length} řádků připraveno` : "Otevři grid a uprav buňky",
        done: hasRows,
      },
      {
        id: "wf-command",
        title: "3. Spusť příkaz",
        detail: hasExecutionSignal ? "Graf reaguje na příkazy" : "Použij command bar dole",
        done: hasExecutionSignal,
      },
    ];
  }, [activeTableContract, activeTableAsteroids.length, bonds.length, hasFormulaConfigured, selectedPlanetId]);

  const workflowProgress = useMemo(() => {
    if (!fixedWorkflow.length) return 0;
    const done = fixedWorkflow.filter((stage) => stage.done).length;
    return Math.round((done / fixedWorkflow.length) * 100);
  }, [fixedWorkflow]);

  useEffect(() => {
    const onKeyDown = (event) => {
      const activeElement = document.activeElement;
      const isTextInput =
        activeElement instanceof HTMLInputElement || activeElement instanceof HTMLTextAreaElement;

      if (event.key === "/" && !isTextInput) {
        event.preventDefault();
        commandInputRef.current?.focus();
        return;
      }

      if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === "k") {
        event.preventDefault();
        setAssistOpen(true);
        commandInputRef.current?.focus();
        return;
      }

      if (event.key === "?" && !isTextInput) {
        event.preventDefault();
        setNavHelpOpen((prev) => !prev);
        return;
      }

      if (event.key.toLowerCase() === "l" && !isTextInput && historicalMode) {
        event.preventDefault();
        setAsOfInput("");
        return;
      }

      if (event.key === "Escape") {
        setSelectedPlanetId(null);
        setAuditTargetId(null);
        setHoveredFlow(null);
      }
    };

    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [historicalMode]);

  function applySuggestion(command) {
    setQuery(command);
    commandInputRef.current?.focus();
  }

  const composeCommand = useCallback(
    (rawCommand) => {
      const raw = String(rawCommand || "").trim();
      if (!raw) return "";

      const selectedLabel = selectedPlanet ? valueToLabel(selectedPlanet.value) : "Projekt";
      const lower = raw.toLowerCase();
      const keepAsIs =
        /^(ukaž|ukaz|najdi|delete|zhasni|smaz|smaž|hlídej|hlidej|spočítej|spocitej|vypočítej|vypocitej)\s*:/.test(lower) ||
        raw.includes("+") ||
        raw.includes(" : ");
      if (commandMode === "auto" || keepAsIs) {
        return raw;
      }

      if (commandMode === "find") {
        return `Ukaž : ${raw}`;
      }
      if (commandMode === "delete") {
        return `Delete : ${raw}`;
      }
      if (commandMode === "link") {
        const pair = splitPairInput(raw);
        return pair ? `${pair[0]} + ${pair[1]}` : raw;
      }
      if (commandMode === "type") {
        const pair = splitPairInput(raw);
        return pair ? `${pair[0]} : ${pair[1]}` : raw;
      }
      if (commandMode === "formula") {
        if (raw.includes(".") && raw.includes("=")) {
          const match = raw.match(/^([^.=]+?)\s*\.\s*([^=\s]+)\s*=\s*(.+)$/);
          if (match) {
            const target = match[1].trim();
            const field = match[2].trim();
            const rhs = match[3].trim().replace(/^=/, "");
            return `Spočítej : ${target}.${field} = ${rhs}`;
          }
        }
        if (/^(SUM|AVG|MIN|MAX|COUNT)\s*\(/i.test(raw)) {
          return `Spočítej : ${selectedLabel}.celkem = ${raw.replace(/^=/, "")}`;
        }
        return raw;
      }
      if (commandMode === "guardian") {
        if (raw.includes("->") && raw.includes(".")) {
          return `Hlídej : ${raw}`;
        }
        return raw;
      }
      return raw;
    },
    [commandMode, selectedPlanet]
  );

  const effectiveCommandPreview = useMemo(() => composeCommand(query), [composeCommand, query]);
  const activeCommandMode = useMemo(
    () => COMMAND_MODES.find((mode) => mode.id === commandMode) || COMMAND_MODES[0],
    [commandMode]
  );
  const commandReadiness = useMemo(
    () =>
      evaluateCommandReadiness({
        mode: commandMode,
        input: query,
        composed: effectiveCommandPreview,
        historicalMode,
      }),
    [commandMode, query, effectiveCommandPreview, historicalMode]
  );
  const commandPlaceholder = useMemo(() => {
    if (commandMode === "link") return "A, B  (vytvoří A + B)";
    if (commandMode === "type") return "A, Typ  (vytvoří A : Typ)";
    if (commandMode === "find") return "Název asteroidu";
    if (commandMode === "delete") return "Název asteroidu pro soft delete";
    if (commandMode === "formula") return "Projekt.celkem = SUM(cena)  nebo  SUM(cena)";
    if (commandMode === "guardian") return "Projekt.celkem > 100000 -> pulse";
    if (commandMode === "create") return "Nový asteroid nebo přirozený příkaz";
    return 'Např. "Pavel + Audi", "Spočítej : Projekt.celkem = SUM(cena)" nebo "Ukaž : Pavel"';
  }, [commandMode]);

  const runCommand = useCallback(
    async (rawCommand, options = {}) => {
      const trimmed = composeCommand(rawCommand).trim();
      const closeAssistOnSuccess = options.closeAssistOnSuccess !== false;
      const clearInputOnSuccess = options.clearInputOnSuccess !== false;

      if (!trimmed || busy || historicalMode) return false;
      if (!selectedGalaxyId) {
        setError("Nejprve vyber galaxii.");
        return false;
      }

      const localFocusMatch = trimmed.match(/^(ukaž|ukaz|najdi)\s*:\s*(.+)$/i);
      if (localFocusMatch) {
        const focusTargetRaw = localFocusMatch[2].split("@")[0]?.trim() || "";
        if (!focusTargetRaw) {
          setError("Lokální fokus: chybí název asteroidu");
          return false;
        }

        if (runLocalFocus(focusTargetRaw)) {
          if (clearInputOnSuccess) {
            setQuery("");
          }
          setError("");
          if (closeAssistOnSuccess && !assistPinned) {
            setAssistOpen(false);
          }
          return true;
        }
        setError(`Lokální fokus: asteroid "${focusTargetRaw}" nebyl nalezen`);
        return false;
      }

      setBusy(true);
      setError("");
      try {
        const res = await apiFetch(`${API_BASE}/parser/execute`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(buildParserPayload(trimmed, selectedGalaxyId)),
        });
        if (!res.ok) {
          const msg = await parseApiError(res, `Execute failed: ${res.status}`);
          throw new Error(msg);
        }
        const result = await res.json();
        const pickedId =
          result?.selected_asteroids?.[0]?.id ||
          result?.asteroids?.[result?.asteroids?.length - 1]?.id ||
          result?.selected_atoms?.[0]?.id ||
          result?.atoms?.[result?.atoms?.length - 1]?.id ||
          null;
        if (pickedId) {
          setSelectedPlanetId(pickedId);
        }
        if (clearInputOnSuccess) {
          setQuery("");
        }
        await loadSnapshot();
        if (closeAssistOnSuccess && !assistPinned) {
          setAssistOpen(false);
        }
        return true;
      } catch (err) {
        setError(err.message || "Execution failed");
        return false;
      } finally {
        setBusy(false);
      }
    },
    [assistPinned, busy, composeCommand, historicalMode, loadSnapshot, runLocalFocus, selectedGalaxyId]
  );

  async function executeCommand(e) {
    e.preventDefault();
    const trimmed = query.trim();
    if (!trimmed || busy || historicalMode) return;
    if (commandReadiness.status !== "ready") {
      setError(commandReadiness.message || "Příkaz není ve validním formátu pro vybraný režim.");
      return;
    }
    await runCommand(trimmed, { closeAssistOnSuccess: true, clearInputOnSuccess: true });
  }

  const handleSelectGalaxy = useCallback((galaxyId) => {
    if (!galaxyId) return;
    setSelectedGalaxyId(galaxyId);
    setActiveTableId("");
    setTables([]);
    setGridDraftValues({});
    setGridBusyCellKey("");
    setGridError("");
    setGridMaximized(false);
    setNewGridRowLabel("");
    setSelectedPlanetId(null);
    setAuditTargetId(null);
    setHoveredFlow(null);
    setAsOfInput("");
    setError("");
  }, []);

  const highlightFlow = useCallback((targetId) => {
    if (!targetId) {
      setAuditTargetId(null);
      return;
    }
    setSelectedPlanetId(targetId);
    setAuditTargetId((prev) => (prev === targetId ? null : targetId));
    setHoveredFlow(null);
  }, []);

  const resetDesk = useCallback(() => {
    setSelectedPlanetId(null);
    setAuditTargetId(null);
    setHoveredFlow(null);
    setActiveTableId("");
    setGridDraftValues({});
    setGridBusyCellKey("");
    setGridError("");
    setGridMaximized(false);
    setNewGridRowLabel("");
    setQuery("");
    setCommandMode("auto");
    setAssistOpen(false);
    setError("");
  }, []);

  const focusTable = useCallback((table) => {
    if (table?.table_id) {
      setActiveTableId(String(table.table_id));
    }
    const members = Array.isArray(table?.members) ? table.members : [];
    const first = members[0];
    if (!first?.id) return;
    setSelectedPlanetId(first.id);
    setAuditTargetId(null);
    setHoveredFlow(null);
    setError("");
  }, []);

  const getGridBaselineValue = useCallback(
    (asteroidId, field) => {
      const row = activeTableAsteroids.find((item) => item.id === asteroidId);
      if (!row) return "";
      if (field === "value") return valueToLabel(row.value);
      return valueToLabel(safeMetadata(row.metadata)[field] ?? "");
    },
    [activeTableAsteroids]
  );

  const setGridCellDraft = useCallback(
    (asteroidId, field, nextValue) => {
      const key = `${asteroidId}::${field}`;
      const baseline = getGridBaselineValue(asteroidId, field);
      setGridDraftValues((prev) => {
        const normalized = String(nextValue ?? "");
        if (normalized === baseline) {
          if (!Object.prototype.hasOwnProperty.call(prev, key)) return prev;
          const next = { ...prev };
          delete next[key];
          return next;
        }
        return { ...prev, [key]: normalized };
      });
    },
    [getGridBaselineValue]
  );

  const commitGridCell = useCallback(
    async (asteroidId, field) => {
      if (!selectedGalaxyId || historicalMode) return;
      const key = `${asteroidId}::${field}`;
      const draft = Object.prototype.hasOwnProperty.call(gridDraftValues, key) ? gridDraftValues[key] : undefined;
      if (draft === undefined) return;
      const baseline = getGridBaselineValue(asteroidId, field);
      if (draft === baseline) {
        setGridCellDraft(asteroidId, field, draft);
        return;
      }

      setGridBusyCellKey(key);
      setGridError("");
      try {
        const payload = { galaxy_id: selectedGalaxyId };
        if (field === "value") {
          payload.value = draft;
        } else {
          payload.metadata = { [field]: draft };
        }
        const response = await apiFetch(`${API_BASE}/asteroids/${asteroidId}/mutate`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        });
        if (!response.ok) {
          const message = await parseApiError(response, `Grid mutate failed: ${response.status}`);
          throw new Error(message);
        }
        setGridCellDraft(asteroidId, field, baseline);
        await loadSnapshot();
      } catch (cellError) {
        setGridError(cellError.message || "Editace buňky selhala");
      } finally {
        setGridBusyCellKey("");
      }
    },
    [selectedGalaxyId, historicalMode, gridDraftValues, getGridBaselineValue, setGridCellDraft, loadSnapshot]
  );

  const createGridRow = useCallback(async () => {
    const label = newGridRowLabel.trim();
    if (!label || !selectedGalaxyId || historicalMode) return;
    setGridError("");
    try {
      const metadata = {};
      if (activeTableContract?.name) {
        metadata.table = activeTableContract.name;
      }
      const response = await apiFetch(`${API_BASE}/asteroids/ingest`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ value: label, metadata, galaxy_id: selectedGalaxyId }),
      });
      if (!response.ok) {
        const message = await parseApiError(response, `Grid create row failed: ${response.status}`);
        throw new Error(message);
      }
      const created = await response.json();
      setNewGridRowLabel("");
      await loadSnapshot();
      if (created?.id) {
        setSelectedPlanetId(created.id);
      }
    } catch (rowError) {
      setGridError(rowError.message || "Vytvoření řádku selhalo");
    }
  }, [newGridRowLabel, selectedGalaxyId, historicalMode, activeTableContract, loadSnapshot]);

  const deleteGridRow = useCallback(
    async (asteroidId) => {
      if (!asteroidId || !selectedGalaxyId || historicalMode) return;
      setGridError("");
      try {
        const response = await apiFetch(`${API_BASE}/asteroids/${asteroidId}/extinguish?galaxy_id=${selectedGalaxyId}`, {
          method: "PATCH",
        });
        if (!response.ok) {
          const message = await parseApiError(response, `Grid delete row failed: ${response.status}`);
          throw new Error(message);
        }
        setGridDraftValues((prev) => {
          const next = {};
          Object.entries(prev).forEach(([key, value]) => {
            if (!key.startsWith(`${asteroidId}::`)) {
              next[key] = value;
            }
          });
          return next;
        });
        await loadSnapshot();
      } catch (rowError) {
        setGridError(rowError.message || "Soft delete řádku selhal");
      }
    },
    [selectedGalaxyId, historicalMode, loadSnapshot]
  );

  if (authLoading) {
    return (
      <div
        style={{
          width: "100vw",
          height: "100vh",
          background: "radial-gradient(circle at 20% 20%, #0f1e33 0%, #050812 48%, #020205 100%)",
          display: "grid",
          placeItems: "center",
          color: "#d8f8ff",
          fontFamily: "ui-sans-serif, system-ui, -apple-system, Segoe UI, Roboto, sans-serif",
        }}
      >
        Ověřuji relaci...
      </div>
    );
  }

  if (!isAuthenticated) {
    return (
      <AuthScreen
        mode={authMode}
        email={authEmail}
        password={authPassword}
        busy={authBusy}
        error={authError}
        onEmailChange={setAuthEmail}
        onPasswordChange={setAuthPassword}
        onModeChange={(nextMode) => {
          setAuthMode(nextMode);
          setAuthError("");
        }}
        onSubmit={handleAuthSubmit}
      />
    );
  }

  if (!selectedGalaxyId) {
    return (
      <GalaxySelector
        galaxies={galaxies}
        selectedGalaxyId={selectedGalaxyId}
        newGalaxyName={newGalaxyName}
        loading={galaxyLoading}
        busy={galaxyBusy}
        error={galaxyError}
        onSelect={handleSelectGalaxy}
        onCreate={handleCreateGalaxy}
        onExtinguish={handleExtinguishGalaxy}
        onNameChange={setNewGalaxyName}
        onRefresh={loadGalaxies}
      />
    );
  }

  return (
    <div style={{ width: "100vw", height: "100vh", background: "#020205", position: "relative", overflow: "hidden" }}>
      <UniverseScene
        atoms={visualData.enrichedAtoms}
        bonds={visualData.curvedBonds}
        sectors={visualData.sectorPlates}
        atomPositions={visualData.atomPositions}
        selectedPlanet={selectedPlanet}
        defaultCameraPosition={defaultUniverseView.position}
        defaultCameraTarget={defaultUniverseView.target}
        defaultMinDistance={defaultUniverseView.minDistance}
        defaultMaxDistance={defaultUniverseView.maxDistance}
        onSelectPlanet={setSelectedPlanetId}
        onClearSelection={() => {
          setSelectedPlanetId(null);
          setAuditTargetId(null);
          setHoveredFlow(null);
        }}
        onHoverFlow={(payload) => setHoveredFlow(payload)}
        onClearHoverFlow={() => setHoveredFlow(null)}
      />

      <GridWorkbench
        open={gridOpen}
        onToggle={() => {
          setGridOpen((prev) => {
            const next = !prev;
            if (!next) setGridMaximized(false);
            return next;
          });
        }}
        maximized={gridMaximized}
        onToggleMaximized={() => setGridMaximized((prev) => !prev)}
        historicalMode={historicalMode}
        activeTableName={activeTableContract?.name || "Uncategorized"}
        columns={gridColumns}
        rows={activeTableAsteroids}
        draftValues={gridDraftValues}
        busyCellKey={gridBusyCellKey}
        newRowLabel={newGridRowLabel}
        onNewRowLabelChange={setNewGridRowLabel}
        onCreateRow={createGridRow}
        onDeleteRow={deleteGridRow}
        onCellChange={setGridCellDraft}
        onCellCommit={commitGridCell}
        error={gridError}
      />

      <header
        style={{
          position: "absolute",
          left: 12,
          right: 12,
          top: 12,
          zIndex: 20,
          pointerEvents: "auto",
          border: "1px solid rgba(105, 198, 234, 0.24)",
          background: "rgba(5, 12, 22, 0.78)",
          borderRadius: 14,
          padding: "10px 12px",
          color: "#d9f9ff",
          display: "grid",
          gap: 8,
          backdropFilter: "blur(8px)",
        }}
      >
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 10, flexWrap: "wrap" }}>
          <div>
            <div style={{ fontSize: 16, fontWeight: 800, letterSpacing: 0.2 }}>DataVerse</div>
            <div style={{ marginTop: 1, fontSize: 12, opacity: 0.74 }}>
              {galaxies.find((item) => item.id === selectedGalaxyId)?.name || "Galaxie"} /{" "}
              {activeTableContract?.name || "Uncategorized"}
            </div>
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
            <div
              style={{
                border: "1px solid rgba(111, 205, 236, 0.25)",
                background: "rgba(4, 10, 18, 0.86)",
                borderRadius: 999,
                padding: "5px 10px",
                fontSize: 12,
                opacity: 0.9,
              }}
            >
              Asteroids <strong>{atoms.length}</strong>
            </div>
            <div
              style={{
                border: "1px solid rgba(111, 205, 236, 0.25)",
                background: "rgba(4, 10, 18, 0.86)",
                borderRadius: 999,
                padding: "5px 10px",
                fontSize: 12,
                opacity: 0.9,
              }}
            >
              Bonds <strong>{bonds.length}</strong>
            </div>
            {historicalMode ? (
              <div
                style={{
                  border: "1px solid rgba(255, 193, 92, 0.42)",
                  background: "rgba(52, 38, 15, 0.8)",
                  borderRadius: 999,
                  padding: "5px 10px",
                  fontSize: 12,
                  color: "#ffd79f",
                }}
              >
                Historický mód
              </div>
            ) : null}
          </div>
        </div>

        <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
          <select
            value={selectedGalaxyId}
            onChange={(event) => handleSelectGalaxy(event.target.value)}
            style={{
              minWidth: 200,
              borderRadius: 8,
              border: "1px solid rgba(117, 203, 235, 0.25)",
              background: "rgba(3, 7, 14, 0.92)",
              color: "#dff9ff",
              padding: "7px 9px",
              fontSize: 13,
              outline: "none",
            }}
          >
            {galaxies.map((galaxy) => (
              <option key={galaxy.id} value={galaxy.id}>
                {galaxy.name}
              </option>
            ))}
          </select>

          <select
            value={activeTableId || ""}
            onChange={(event) => setActiveTableId(event.target.value)}
            style={{
              minWidth: 200,
              borderRadius: 8,
              border: "1px solid rgba(117, 203, 235, 0.25)",
              background: "rgba(3, 7, 14, 0.92)",
              color: "#dff9ff",
              padding: "7px 9px",
              fontSize: 13,
              outline: "none",
            }}
          >
            {tableContracts.map((table) => (
              <option key={String(table.table_id)} value={String(table.table_id)}>
                {table.name} ({table.members.length})
              </option>
            ))}
          </select>

          <input
            type="datetime-local"
            value={asOfInput}
            onChange={(event) => setAsOfInput(event.target.value)}
            style={{
              borderRadius: 8,
              border: "1px solid rgba(117, 203, 235, 0.25)",
              background: "rgba(3, 7, 14, 0.92)",
              color: "#dff9ff",
              padding: "7px 9px",
              fontSize: 13,
              outline: "none",
            }}
          />
          <button
            type="button"
            onClick={() => setAsOfInput("")}
            disabled={!historicalMode}
            style={{
              border: "1px solid rgba(116, 216, 255, 0.35)",
              background: historicalMode ? "rgba(34, 95, 121, 0.82)" : "rgba(24, 41, 52, 0.8)",
              color: historicalMode ? "#ddf9ff" : "#88a9b8",
              borderRadius: 8,
              padding: "7px 10px",
              fontSize: 12,
              cursor: historicalMode ? "pointer" : "not-allowed",
            }}
          >
            Live
          </button>

          <div style={{ marginLeft: "auto", display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
            <button
              type="button"
              onClick={() => {
                setGridOpen(true);
                setGridMaximized(true);
              }}
              style={{
                border: "1px solid rgba(110, 225, 255, 0.5)",
                background: "linear-gradient(120deg, #18b2e2, #36d6ff)",
                color: "#02121c",
                borderRadius: 8,
                fontWeight: 700,
                padding: "7px 11px",
                fontSize: 12,
                cursor: "pointer",
              }}
            >
              Grid
            </button>
            <button
              type="button"
              onClick={loadGalaxies}
              disabled={galaxyLoading}
              style={{
                border: "1px solid rgba(116, 216, 255, 0.35)",
                background: "rgba(8, 20, 34, 0.82)",
                color: "#d5f9ff",
                borderRadius: 8,
                padding: "7px 10px",
                fontSize: 12,
                cursor: galaxyLoading ? "not-allowed" : "pointer",
              }}
            >
              Obnovit
            </button>
            <button
              type="button"
              onClick={() => {
                setSelectedGalaxyId("");
                setActiveTableId("");
                setGridDraftValues({});
                setGridBusyCellKey("");
                setGridError("");
                setNewGridRowLabel("");
                setSelectedPlanetId(null);
                setAuditTargetId(null);
                setHoveredFlow(null);
              }}
              style={{
                border: "1px solid rgba(116, 216, 255, 0.35)",
                background: "rgba(8, 20, 34, 0.82)",
                color: "#d5f9ff",
                borderRadius: 8,
                padding: "7px 10px",
                fontSize: 12,
                cursor: "pointer",
              }}
            >
              Galaxie
            </button>
            <button
              type="button"
              onClick={logout}
              style={{
                border: "1px solid rgba(255, 145, 169, 0.38)",
                background: "rgba(36, 12, 18, 0.75)",
                color: "#ffcddd",
                borderRadius: 8,
                padding: "7px 10px",
                fontSize: 12,
                cursor: "pointer",
              }}
            >
              Odhlásit
            </button>
          </div>
        </div>
      </header>

      <aside
        style={{
          position: "absolute",
          left: 12,
          top: 112,
          bottom: 128,
          width: "min(320px, calc(100vw - 24px))",
          zIndex: 19,
          pointerEvents: "auto",
          border: "1px solid rgba(105, 198, 234, 0.2)",
          background: "rgba(5, 12, 22, 0.76)",
          borderRadius: 14,
          color: "#d9f9ff",
          display: "grid",
          gridTemplateRows: "auto 1fr auto",
          backdropFilter: "blur(8px)",
          overflow: "hidden",
        }}
      >
        <div style={{ padding: "10px 12px", borderBottom: "1px solid rgba(105, 198, 234, 0.2)" }}>
          {selectedPlanet ? (
            <>
              <div style={{ fontSize: 11, letterSpacing: 0.5, opacity: 0.7 }}>VYBRANÝ ASTEROID</div>
              <div style={{ marginTop: 4, fontSize: 16, fontWeight: 700 }}>{valueToLabel(selectedPlanet.value)}</div>
              <div style={{ marginTop: 2, fontSize: 12, opacity: 0.75 }}>
                {formatCreatedAt(selectedPlanet.created_at)} | Metadata {selectedPlanetMetadata.length}
              </div>
              <div style={{ marginTop: 8, display: "flex", gap: 6, flexWrap: "wrap" }}>
                <button
                  type="button"
                  onClick={() => highlightFlow(selectedPlanet.id)}
                  style={{
                    border: "1px solid rgba(110, 225, 255, 0.42)",
                    background:
                      auditTargetId === selectedPlanet.id
                        ? "linear-gradient(120deg, #4fd2ff, #8ee4ff)"
                        : "rgba(8, 20, 34, 0.82)",
                    color: auditTargetId === selectedPlanet.id ? "#03253a" : "#d5f9ff",
                    borderRadius: 999,
                    padding: "5px 9px",
                    fontSize: 11,
                    cursor: "pointer",
                  }}
                >
                  {auditTargetId === selectedPlanet.id ? "Vypnout Audit" : "Audit toků"}
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setSelectedPlanetId(null);
                    setAuditTargetId(null);
                    setHoveredFlow(null);
                  }}
                  style={{
                    border: "1px solid rgba(111, 206, 255, 0.28)",
                    background: "rgba(9, 18, 33, 0.7)",
                    color: "#cff5ff",
                    borderRadius: 999,
                    padding: "5px 9px",
                    fontSize: 11,
                    cursor: "pointer",
                  }}
                >
                  Zrušit fokus
                </button>
              </div>
            </>
          ) : (
            <>
              <div style={{ fontSize: 11, letterSpacing: 0.5, opacity: 0.7 }}>KONTEXT</div>
              <div style={{ marginTop: 4, fontSize: 16, fontWeight: 700 }}>{activeTableContract?.name || "Uncategorized"}</div>
              <div style={{ marginTop: 2, fontSize: 12, opacity: 0.75 }}>
                Vyber asteroid z listu nebo napiš příkaz do spodního panelu.
              </div>
            </>
          )}
        </div>

        <div style={{ overflowY: "auto", padding: 10, display: "grid", gap: 6 }}>
          {selectedPlanetMetadata.length > 0 ? (
            <div
              style={{
                border: "1px solid rgba(116, 216, 255, 0.24)",
                background: "rgba(8, 20, 34, 0.8)",
                borderRadius: 9,
                padding: "7px 8px",
                display: "grid",
                gap: 4,
              }}
            >
              {selectedPlanetMetadata.map(([key, value]) => (
                <div key={key} style={{ display: "grid", gridTemplateColumns: "92px 1fr", gap: 8, fontSize: 12 }}>
                  <div style={{ color: "#95d4ea" }}>{key}</div>
                  <div style={{ color: "#effcff", wordBreak: "break-word" }}>{valueToLabel(value)}</div>
                </div>
              ))}
            </div>
          ) : null}

          {(selectedPlanet ? activeTableAsteroids.slice(0, 12) : activeTableAsteroids.slice(0, 22)).map((asteroid) => {
            const selected = asteroid.id === selectedPlanetId;
            return (
              <button
                key={asteroid.id}
                type="button"
                onClick={() => {
                  setSelectedPlanetId(asteroid.id);
                  setAuditTargetId(null);
                  setHoveredFlow(null);
                }}
                style={{
                  border: "1px solid rgba(116, 216, 255, 0.2)",
                  background: selected ? "rgba(49, 101, 134, 0.78)" : "rgba(8, 20, 34, 0.82)",
                  color: "#e2fbff",
                  borderRadius: 8,
                  padding: "7px 8px",
                  fontSize: 12,
                  textAlign: "left",
                  cursor: "pointer",
                }}
              >
                <div style={{ fontWeight: 600 }}>{valueToLabel(asteroid.value)}</div>
                <div style={{ marginTop: 1, fontSize: 11, opacity: 0.7 }}>Created {formatCreatedAt(asteroid.created_at)}</div>
              </button>
            );
          })}
        </div>

        <div style={{ padding: 10, borderTop: "1px solid rgba(105, 198, 234, 0.2)", display: "flex", gap: 6, flexWrap: "wrap" }}>
          {smartSuggestions.slice(0, 3).map((item) => (
            <button
              key={`smart-minimal-${item.id}`}
              type="button"
              onClick={() => applySuggestion(item.command)}
              disabled={historicalMode}
              style={{
                border: "1px solid rgba(117, 216, 255, 0.3)",
                background: historicalMode ? "rgba(36,45,58,0.8)" : "rgba(6, 18, 32, 0.8)",
                color: historicalMode ? "#8ea0aa" : "#d4f8ff",
                borderRadius: 999,
                padding: "6px 10px",
                fontSize: 11,
                cursor: historicalMode ? "not-allowed" : "pointer",
              }}
              title={item.command}
            >
              {item.title}
            </button>
          ))}
        </div>
      </aside>

      <section
        style={{
          position: "absolute",
          left: "50%",
          transform: "translateX(-50%)",
          width: "min(980px, calc(100vw - 24px))",
          bottom: 12,
          zIndex: 21,
          pointerEvents: "auto",
          border: "1px solid rgba(105, 198, 234, 0.24)",
          background: "rgba(5, 12, 22, 0.82)",
          borderRadius: 14,
          padding: "10px 12px",
          color: "#d9f9ff",
          backdropFilter: "blur(8px)",
        }}
      >
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 10, flexWrap: "wrap" }}>
          <div style={{ fontSize: 12, opacity: 0.84 }}>
            {historicalMode ? "Historický mód: zápis je uzamčen." : commandReadiness.message}
          </div>
          <select
            value={commandMode}
            onChange={(event) => setCommandMode(event.target.value)}
            style={{
              borderRadius: 8,
              border: "1px solid rgba(117, 203, 235, 0.25)",
              background: "rgba(3, 7, 14, 0.92)",
              color: "#dff9ff",
              padding: "6px 9px",
              fontSize: 12,
              outline: "none",
            }}
          >
            {COMMAND_MODES.map((mode) => (
              <option key={mode.id} value={mode.id}>
                Rezim: {mode.label}
              </option>
            ))}
          </select>
        </div>

        {error ? <div style={{ marginTop: 6, color: "#ff9db0", fontSize: 12 }}>{error}</div> : null}

        <form
          onSubmit={executeCommand}
          style={{
            marginTop: 8,
            display: "flex",
            gap: 10,
            alignItems: "stretch",
          }}
        >
          <div style={{ flex: 1, position: "relative" }}>
            <input
              ref={commandInputRef}
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              onFocus={() => setCommandFocused(true)}
              onBlur={() => setTimeout(() => setCommandFocused(false), 120)}
              onKeyDown={(event) => {
                if (!commandFocused || !smartSuggestions.length) return;
                if (event.key === "ArrowDown") {
                  event.preventDefault();
                  setActiveSuggestionIndex((prev) => (prev + 1) % smartSuggestions.length);
                  return;
                }
                if (event.key === "ArrowUp") {
                  event.preventDefault();
                  setActiveSuggestionIndex((prev) => (prev - 1 + smartSuggestions.length) % smartSuggestions.length);
                  return;
                }
                if (event.key === "Tab" && smartSuggestions[activeSuggestionIndex]) {
                  const selectedSuggestion = smartSuggestions[activeSuggestionIndex];
                  if (normalizeSearchText(query) !== normalizeSearchText(selectedSuggestion.command)) {
                    event.preventDefault();
                    applySuggestion(selectedSuggestion.command);
                  }
                }
              }}
              disabled={historicalMode || busy}
              placeholder={commandPlaceholder}
              style={{
                width: "100%",
                border: "1px solid rgba(132, 216, 255, 0.25)",
                background: "rgba(4, 8, 16, 0.92)",
                color: "#d9f8ff",
                borderRadius: 10,
                fontSize: 15,
                padding: "11px 12px",
                outline: "none",
              }}
            />

            {commandFocused && !historicalMode && smartSuggestions.length > 0 ? (
              <div
                style={{
                  position: "absolute",
                  left: 0,
                  right: 0,
                  bottom: "calc(100% + 8px)",
                  borderRadius: 12,
                  border: "1px solid rgba(112, 218, 255, 0.35)",
                  background: "rgba(8, 16, 28, 0.92)",
                  backdropFilter: "blur(8px)",
                  overflow: "hidden",
                  boxShadow: "0 0 24px rgba(76, 200, 255, 0.16)",
                }}
              >
                {smartSuggestions.map((item, index) => {
                  const active = index === activeSuggestionIndex;
                  return (
                    <button
                      key={`suggest-minimal-${item.id}-${item.command}`}
                      type="button"
                      onMouseDown={(event) => {
                        event.preventDefault();
                        applySuggestion(item.command);
                      }}
                      style={{
                        width: "100%",
                        border: "none",
                        borderBottom: index < smartSuggestions.length - 1 ? "1px solid rgba(102, 197, 236, 0.14)" : "none",
                        background: active ? "rgba(34, 76, 108, 0.6)" : "transparent",
                        color: "#d7f8ff",
                        textAlign: "left",
                        padding: "9px 12px",
                        cursor: "pointer",
                      }}
                    >
                      <div style={{ fontSize: 12, opacity: 0.78 }}>{item.title}</div>
                      <div style={{ marginTop: 2, fontSize: 13 }}>{item.command}</div>
                    </button>
                  );
                })}
              </div>
            ) : null}
          </div>

          <button
            type="submit"
            disabled={busy || historicalMode || commandReadiness.status !== "ready"}
            style={{
              border: "1px solid rgba(110, 225, 255, 0.5)",
              background:
                busy || historicalMode || commandReadiness.status !== "ready"
                  ? "linear-gradient(120deg, rgba(63,95,110,0.7), rgba(48,66,80,0.7))"
                  : "linear-gradient(120deg, #18b2e2, #36d6ff)",
              color: busy || historicalMode || commandReadiness.status !== "ready" ? "#b9c8cf" : "#02121c",
              borderRadius: 10,
              fontWeight: 700,
              letterSpacing: 0.3,
              padding: "0 18px",
              minWidth: 132,
              cursor: busy || historicalMode || commandReadiness.status !== "ready" ? "not-allowed" : "pointer",
            }}
          >
            {historicalMode ? "LOCK" : busy ? "RUNNING..." : "EXECUTE"}
          </button>
        </form>
      </section>

      {hoveredFlow ? (
        <div
          style={{
            position: "absolute",
            left: `${(hoveredFlow.x ?? 16) + 14}px`,
            top: `${(hoveredFlow.y ?? 16) + 14}px`,
            zIndex: 35,
            pointerEvents: "none",
            maxWidth: 300,
            borderRadius: 10,
            border: "1px solid rgba(114, 218, 255, 0.4)",
            background: "rgba(6, 14, 26, 0.92)",
            color: "#dbf8ff",
            fontSize: 12,
            lineHeight: 1.35,
            padding: "7px 9px",
            boxShadow: "0 0 18px rgba(72, 198, 255, 0.2)",
            backdropFilter: "blur(6px)",
          }}
        >
          {hoveredFlow.text || "Tok dat"}
        </div>
      ) : null}
    </div>
  );
}
