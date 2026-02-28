import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Canvas, useFrame, useThree } from "@react-three/fiber";
import { Billboard, Line, OrbitControls, Stars, Text } from "@react-three/drei";
import { Bloom, EffectComposer } from "@react-three/postprocessing";
import * as THREE from "three";
import {
  API_BASE,
  apiFetch,
  buildParserPayload,
  buildSnapshotUrl,
  normalizeSnapshot,
  toAsOfIso
} from "./lib/dataverseApi";
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

function PlanetShape({ planet, selected }) {
  const color = planet.color || "#9ad8ff";
  const radius = planet.radius || 0.9;
  const baseOpacity = typeof planet.opacity === "number" ? planet.opacity : 1;
  const glowBoost = planet.glowBoost || 1;
  const emissiveIntensity = (selected ? 2.5 : 1.7) * glowBoost * (0.35 + 0.65 * baseOpacity);
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
              emissiveIntensity={2.1 * glowBoost}
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
              emissiveIntensity={2.15 * glowBoost}
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
              emissiveIntensity={2.3 * glowBoost}
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
              emissiveIntensity={1.4 * glowBoost}
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

function halton(index, base) {
  let f = 1;
  let r = 0;
  let i = index;
  while (i > 0) {
    f /= base;
    r += f * (i % base);
    i = Math.floor(i / base);
  }
  return r;
}

function calculateStaticLayout(nodes, edges, iterations = 150) {
  const MIN_DISTANCE = 5.0;
  const IDEAL_LINK_DISTANCE = 6.5;
  const CENTER_PULL = 0.01;
  const bounds = 25;

  const points = nodes.map((node, i) => ({
    id: node.id,
    x: (halton(i + 1, 2) - 0.5) * 20,
    y: (halton(i + 1, 3) - 0.5) * 10,
    z: (halton(i + 1, 5) - 0.5) * 20,
  }));

  const byId = new Map(points.map((point, index) => [point.id, index]));
  const massById = new Map(nodes.map((node) => [node.id, Number(node.mass) || 1]));

  for (let it = 0; it < iterations; it += 1) {
    const alpha = 1 - it / iterations;

    for (const edge of edges) {
      const sourceIdx = byId.get(edge.from || edge.source_id);
      const targetIdx = byId.get(edge.to || edge.target_id);
      if (sourceIdx === undefined || targetIdx === undefined) continue;

      const s = points[sourceIdx];
      const t = points[targetIdx];
      const dx = t.x - s.x;
      const dy = t.y - s.y;
      const dz = t.z - s.z;
      const dist = Math.sqrt(dx * dx + dy * dy + dz * dz) || 0.01;

      const sourceMass = massById.get(s.id) || 1;
      const targetMass = massById.get(t.id) || 1;
      const massSignal = Math.sqrt(sourceMass * targetMass);
      const idealDistance = clamp(IDEAL_LINK_DISTANCE - Math.log10(massSignal + 1) * 1.05, 3.2, IDEAL_LINK_DISTANCE);

      if (dist > idealDistance) {
        const force = (dist - idealDistance) * (0.032 + massSignal * 0.006) * alpha;
        const sourceWeight = targetMass / (sourceMass + targetMass);
        const targetWeight = sourceMass / (sourceMass + targetMass);
        s.x += (dx / dist) * force * sourceWeight;
        s.y += (dy / dist) * force * sourceWeight;
        s.z += (dz / dist) * force * sourceWeight;
        t.x -= (dx / dist) * force * targetWeight;
        t.y -= (dy / dist) * force * targetWeight;
        t.z -= (dz / dist) * force * targetWeight;
      }
    }

    for (let i = 0; i < points.length; i += 1) {
      for (let j = i + 1; j < points.length; j += 1) {
        const a = points[i];
        const b = points[j];
        const dx = a.x - b.x;
        const dy = a.y - b.y;
        const dz = a.z - b.z;
        const dist = Math.sqrt(dx * dx + dy * dy + dz * dz) || 0.01;
        const massA = massById.get(a.id) || 1;
        const massB = massById.get(b.id) || 1;
        const minDistance = MIN_DISTANCE + Math.log10(massA + massB + 1) * 0.45;

        if (dist < minDistance) {
          const force = (minDistance - dist) * (0.08 + Math.log10(massA + massB + 1) * 0.012) * alpha;
          a.x += (dx / dist) * force;
          a.y += (dy / dist) * force;
          a.z += (dz / dist) * force;
          b.x -= (dx / dist) * force;
          b.y -= (dy / dist) * force;
          b.z -= (dz / dist) * force;
        }
      }

      points[i].x -= points[i].x * CENTER_PULL * alpha;
      points[i].y -= points[i].y * CENTER_PULL * alpha;
      points[i].z -= points[i].z * CENTER_PULL * alpha;

      points[i].x = clamp(points[i].x, -bounds, bounds);
      points[i].y = clamp(points[i].y, -bounds / 2, bounds / 2);
      points[i].z = clamp(points[i].z, -bounds, bounds);
    }
  }

  return points;
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

function dampVector3(current, target, lambda, delta) {
  current.x = THREE.MathUtils.damp(current.x, target.x, lambda, delta);
  current.y = THREE.MathUtils.damp(current.y, target.y, lambda, delta);
  current.z = THREE.MathUtils.damp(current.z, target.z, lambda, delta);
}

function CameraRig({ selectedPlanet, defaultCameraPosition, controlsRef }) {
  const { camera } = useThree();
  const targetPosition = useRef(new THREE.Vector3(0, 0, 0));
  const cameraPosition = useRef(new THREE.Vector3(...defaultCameraPosition));
  const modeRef = useRef("idle");
  const lastSelectedIdRef = useRef(null);

  useEffect(() => {
    if (selectedPlanet?.id && selectedPlanet.position) {
      if (lastSelectedIdRef.current === selectedPlanet.id) {
        return;
      }
      targetPosition.current.set(...selectedPlanet.position);
      cameraPosition.current.set(
        selectedPlanet.position[0],
        selectedPlanet.position[1] + 2,
        selectedPlanet.position[2] + 8
      );
      modeRef.current = "fly";
      lastSelectedIdRef.current = selectedPlanet.id;
      return;
    }

    if (lastSelectedIdRef.current) {
      targetPosition.current.set(0, 0, 0);
      cameraPosition.current.set(...defaultCameraPosition);
      modeRef.current = "home";
      lastSelectedIdRef.current = null;
    }
  }, [selectedPlanet, defaultCameraPosition]);

  useFrame((_, delta) => {
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

function UniverseScene({ atoms, bonds, atomPositions, selectedPlanet, onSelectPlanet, onClearSelection }) {
  const controlsRef = useRef(null);

  return (
    <Canvas
      style={{ position: "absolute", inset: 0, zIndex: 0 }}
      camera={{ position: DEFAULT_CAMERA_POSITION, fov: 55 }}
      onPointerMissed={() => {
        if (onClearSelection) onClearSelection();
      }}
    >
      <color attach="background" args={["#020205"]} />
      <ambientLight intensity={0.25} />
      <pointLight position={[0, 10, 15]} intensity={1.2} color="#8fd6ff" />
      <pointLight position={[-12, -8, -10]} intensity={0.9} color="#ff6af0" />

      <CameraRig
        selectedPlanet={selectedPlanet}
        defaultCameraPosition={DEFAULT_CAMERA_POSITION}
        controlsRef={controlsRef}
      />

      <Stars radius={180} depth={80} count={6000} factor={2.8} saturation={0} fade speed={0.5} />

      {bonds.map((bond) => (
        <Line
          key={bond.id}
          points={bond.points}
          color="#6fdcff"
          lineWidth={1.2}
          transparent
          opacity={typeof bond.opacity === "number" ? bond.opacity : 0.85}
        />
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

      <OrbitControls ref={controlsRef} makeDefault enableDamping dampingFactor={0.06} />
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
  const [query, setQuery] = useState("");
  const [asOfInput, setAsOfInput] = useState("");
  const [selectedPlanetId, setSelectedPlanetId] = useState(null);
  const [assistOpen, setAssistOpen] = useState(false);
  const [commandFocused, setCommandFocused] = useState(false);
  const [activeSuggestionIndex, setActiveSuggestionIndex] = useState(0);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const commandInputRef = useRef(null);
  const asOfIso = useMemo(() => toAsOfIso(asOfInput), [asOfInput]);
  const historicalMode = Boolean(asOfIso);

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
      return;
    }
    setError("");
    const res = await apiFetch(buildSnapshotUrl(API_BASE, asOfIso, selectedGalaxyId));
    if (!res.ok) {
      const message = await parseApiError(res, `Snapshot failed: ${res.status}`);
      throw new Error(message);
    }
    const data = await res.json();
    const { asteroids: nextAsteroids, bonds: nextBonds } = normalizeSnapshot(data);
    setAtoms(nextAsteroids);
    setBonds(nextBonds);
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
        asteroid?.calculated_values && typeof asteroid.calculated_values === "object" && !Array.isArray(asteroid.calculated_values)
          ? asteroid.calculated_values
          : {},
      active_alerts: Array.isArray(asteroid?.active_alerts) ? asteroid.active_alerts : [],
      created_at: asteroid?.created_at || null,
    }));
    const sortedAsteroids = [...normalizedAsteroids].sort((a, b) => a.id.localeCompare(b.id));
    const sortedBonds = [...bonds].sort((a, b) => a.id.localeCompare(b.id));
    const physicsAsteroids = sortedAsteroids.map((asteroid) => {
      const valueSignal = extractComputedValue(asteroid);
      const physics = mapValueToPhysics(valueSignal);
      const category = inferCategory(asteroid);
      return {
        ...asteroid,
        category,
        mass: physics.mass,
        visualScale: physics.scale,
        physicsIntensity: physics.intensity,
        isCategoryCore: Boolean(category),
      };
    });

    const staticPositions = calculateStaticLayout(physicsAsteroids, sortedBonds, 150);
    const positionById = new Map(staticPositions.map((pos) => [pos.id, [pos.x, pos.y, pos.z]]));
    const hasFocus = Boolean(selectedPlanetId);
    const highlightedAtomIds = new Set();
    const highlightedBondIds = new Set();
    if (hasFocus) {
      highlightedAtomIds.add(selectedPlanetId);
      sortedBonds.forEach((bond) => {
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
      const hashId = hashText(asteroid.id);
      const hashVal = hashText(valueToLabel(asteroid.value));
      const isHighlighted = !hasFocus || highlightedAtomIds.has(asteroid.id);
      const activeAlerts = Array.isArray(asteroid.active_alerts) ? asteroid.active_alerts : [];
      const isGuardianRed = activeAlerts.includes("color_red");
      const isGuardianHidden = activeAlerts.includes("hide");
      const baseColor = PALETTE[hashVal % PALETTE.length];
      return {
        ...asteroid,
        metadata: safeMetadata(asteroid.metadata),
        calculated_values: asteroid.calculated_values || {},
        active_alerts: activeAlerts,
        created_at: asteroid.created_at || null,
        type: SHAPES[hashId % SHAPES.length],
        color: isGuardianRed ? "#ff2f3f" : baseColor,
        radius: 0.8 + (hashId % 10) * 0.05,
        orbitTilt: ((hashVal % 100) / 100 - 0.5) * 0.8,
        glowBoost: isGuardianRed
          ? Math.max(asteroid.physicsIntensity * 1.55, 2.2)
          : asteroid.isCategoryCore
            ? 1.55 * asteroid.physicsIntensity
            : asteroid.physicsIntensity,
        opacity: isGuardianHidden ? 0.04 : isHighlighted ? 1 : 0.15,
        selected: asteroid.id === selectedPlanetId
      };
    });

    const atomPositions = {};
    enrichedAtoms.forEach((atom) => {
      atomPositions[atom.id] = positionById.get(atom.id) || [0, 0, 0];
    });

    const curvedBonds = sortedBonds
      .map((bond) => {
        const start = atomPositions[bond.source_id];
        const end = atomPositions[bond.target_id];
        if (!start || !end) return null;
        const control = [
          (start[0] + end[0]) / 2,
          (start[1] + end[1]) / 2 + 2.5,
          (start[2] + end[2]) / 2
        ];
        return {
          ...bond,
          opacity: !hasFocus || highlightedBondIds.has(bond.id) ? 0.9 : 0.15,
          points: curvePoints(start, control, end, 64)
        };
      })
      .filter(Boolean);

    return { enrichedAtoms, atomPositions, curvedBonds };
  }, [atoms, bonds, selectedPlanetId]);

  const selectedPlanet = useMemo(() => {
    if (!selectedPlanetId) return null;
    const planet = visualData.enrichedAtoms.find((atom) => atom.id === selectedPlanetId);
    if (!planet) return null;
    return { ...planet, position: visualData.atomPositions[planet.id] || [0, 0, 0] };
  }, [selectedPlanetId, visualData]);

  const selectedPlanetMetadata = useMemo(() => Object.entries(selectedPlanet?.metadata || {}), [selectedPlanet]);

  useEffect(() => {
    if (selectedPlanetId && !selectedPlanet) {
      setSelectedPlanetId(null);
    }
  }, [selectedPlanetId, selectedPlanet]);

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
        setAssistOpen((prev) => !prev);
        return;
      }

      if (event.key.toLowerCase() === "l" && !isTextInput && historicalMode) {
        event.preventDefault();
        setAsOfInput("");
        return;
      }

      if (event.key === "Escape") {
        setSelectedPlanetId(null);
      }
    };

    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [historicalMode]);

  function applySuggestion(command) {
    setQuery(command);
    commandInputRef.current?.focus();
  }

  async function executeCommand(e) {
    e.preventDefault();
    const trimmed = query.trim();
    if (!trimmed || busy || historicalMode) return;
    if (!selectedGalaxyId) {
      setError("Nejprve vyber galaxii.");
      return;
    }

    const localFocusMatch = trimmed.match(/^(ukaž|ukaz|najdi)\s*:\s*(.+)$/i);
    if (localFocusMatch) {
      const focusTargetRaw = localFocusMatch[2].split("@")[0]?.trim() || "";
      if (!focusTargetRaw) {
        setError("Lokální fokus: chybí název asteroidu");
        return;
      }

      if (runLocalFocus(focusTargetRaw)) {
        setQuery("");
        setError("");
      } else {
        setError(`Lokální fokus: asteroid "${focusTargetRaw}" nebyl nalezen`);
      }
      return;
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
      setQuery("");
      await loadSnapshot();
    } catch (err) {
      setError(err.message || "Execution failed");
    } finally {
      setBusy(false);
    }
  }

  const handleSelectGalaxy = useCallback((galaxyId) => {
    if (!galaxyId) return;
    setSelectedGalaxyId(galaxyId);
    setSelectedPlanetId(null);
    setAsOfInput("");
    setError("");
  }, []);

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
        atomPositions={visualData.atomPositions}
        selectedPlanet={selectedPlanet}
        onSelectPlanet={setSelectedPlanetId}
        onClearSelection={() => setSelectedPlanetId(null)}
      />

      <div
        style={{
          position: "absolute",
          top: 14,
          left: "50%",
          transform: "translateX(-50%)",
          zIndex: 22,
          width: "min(760px, 92vw)",
          pointerEvents: "auto",
        }}
      >
        <button
          type="button"
          onClick={() => setAssistOpen((prev) => !prev)}
          style={{
            width: "100%",
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            gap: 8,
            borderRadius: 14,
            border: "1px solid rgba(110, 220, 255, 0.35)",
            background: "linear-gradient(120deg, rgba(8,16,30,0.86), rgba(10,22,40,0.78))",
            color: "#d7f9ff",
            padding: "10px 14px",
            fontSize: 13,
            cursor: "pointer",
            backdropFilter: "blur(8px)",
          }}
        >
          <span style={{ fontWeight: 700, letterSpacing: 0.4 }}>SMART ASSIST</span>
          <span style={{ opacity: 0.86, overflow: "hidden", whiteSpace: "nowrap", textOverflow: "ellipsis" }}>
            {contextHints[0]}
          </span>
          <span style={{ opacity: 0.75 }}>{assistOpen ? "Hide" : "Show"}</span>
        </button>

        {assistOpen ? (
          <div
            style={{
              marginTop: 8,
              borderRadius: 14,
              border: "1px solid rgba(107, 214, 255, 0.28)",
              background: "rgba(7, 15, 28, 0.84)",
              color: "#cef3ff",
              padding: "12px 14px",
              backdropFilter: "blur(8px)",
              boxShadow: "0 0 24px rgba(96, 216, 255, 0.12)",
            }}
          >
            <div style={{ fontSize: 12, opacity: 0.78, letterSpacing: 0.5 }}>KONTEXTOVÁ NÁPOVĚDA</div>
            {contextHints.map((hint) => (
              <div key={hint} style={{ marginTop: 6, fontSize: 13, opacity: 0.92 }}>
                {hint}
              </div>
            ))}

            <div style={{ marginTop: 12, fontSize: 12, opacity: 0.78, letterSpacing: 0.5 }}>RYCHLÉ PŘÍKAZY</div>
            <div style={{ marginTop: 8, display: "flex", flexWrap: "wrap", gap: 8 }}>
              {smartTemplates.slice(0, 5).map((item) => (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => applySuggestion(item.command)}
                  style={{
                    border: "1px solid rgba(116, 216, 255, 0.35)",
                    background: "rgba(8, 20, 34, 0.82)",
                    color: "#d5f9ff",
                    borderRadius: 999,
                    padding: "7px 11px",
                    fontSize: 12,
                    cursor: "pointer",
                  }}
                >
                  {item.title}
                </button>
              ))}
            </div>
          </div>
        ) : null}
      </div>

      <div
        style={{
          position: "absolute",
          inset: 0,
          zIndex: 10,
          pointerEvents: "none",
          display: "flex",
          flexDirection: "column",
          justifyContent: "space-between",
          padding: "20px",
          fontFamily: "ui-sans-serif, system-ui, -apple-system, Segoe UI, Roboto, sans-serif",
        }}
      >
        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "flex-start",
            gap: 14,
          }}
        >
          <div
            style={{
              pointerEvents: "auto",
              background: "rgba(8, 12, 20, 0.72)",
              border: "1px solid rgba(120, 198, 255, 0.35)",
              borderRadius: 12,
              padding: "12px 14px",
              color: "#c9f3ff",
              minWidth: 170,
              backdropFilter: "blur(6px)",
            }}
          >
            <div style={{ fontSize: 12, opacity: 0.75, letterSpacing: 0.6 }}>UNIVERSE STATUS</div>
            <div style={{ marginTop: 6, fontSize: 12, opacity: 0.8 }}>Uživatel: {user?.email || "n/a"}</div>
            <div style={{ marginTop: 6, fontSize: 14 }}>Asteroids: {atoms.length}</div>
            <div style={{ marginTop: 2, fontSize: 14 }}>Bonds: {bonds.length}</div>
            <div style={{ marginTop: 2, fontSize: 12, opacity: 0.78 }}>Layout: Deterministic</div>
            <div style={{ marginTop: 10, fontSize: 12, opacity: 0.75, letterSpacing: 0.6 }}>GALAXY</div>
            <select
              value={selectedGalaxyId}
              onChange={(e) => handleSelectGalaxy(e.target.value)}
              style={{
                marginTop: 6,
                width: "100%",
                border: "1px solid rgba(132, 216, 255, 0.25)",
                background: "rgba(4, 8, 16, 0.9)",
                color: "#d9f8ff",
                borderRadius: 10,
                fontSize: 13,
                padding: "8px 10px",
                outline: "none",
              }}
            >
              {galaxies.map((galaxy) => (
                <option key={galaxy.id} value={galaxy.id}>
                  {galaxy.name}
                </option>
              ))}
            </select>
            <div style={{ marginTop: 8, display: "flex", gap: 8 }}>
              <button
                type="button"
                onClick={loadGalaxies}
                disabled={galaxyLoading || galaxyBusy}
                style={{
                  flex: 1,
                  border: "1px solid rgba(111, 206, 255, 0.32)",
                  background: "rgba(9, 18, 33, 0.7)",
                  color: "#cff5ff",
                  borderRadius: 10,
                  fontWeight: 600,
                  fontSize: 12,
                  padding: "7px 8px",
                  cursor: galaxyLoading || galaxyBusy ? "not-allowed" : "pointer",
                }}
              >
                Obnovit
              </button>
              <button
                type="button"
                onClick={logout}
                style={{
                  flex: 1,
                  border: "1px solid rgba(255, 120, 150, 0.45)",
                  background: "rgba(40, 13, 22, 0.75)",
                  color: "#ffc7d5",
                  borderRadius: 10,
                  fontWeight: 600,
                  fontSize: 12,
                  padding: "7px 8px",
                  cursor: "pointer",
                }}
              >
                Logout
              </button>
            </div>
            {galaxyError ? <div style={{ marginTop: 8, color: "#ff8fa3", fontSize: 12 }}>{galaxyError}</div> : null}
            {error ? <div style={{ marginTop: 8, color: "#ff8fa3", fontSize: 12 }}>{error}</div> : null}
          </div>

          <div
            style={{
              pointerEvents: "auto",
              background: "rgba(8, 12, 20, 0.72)",
              border: "1px solid rgba(120, 198, 255, 0.35)",
              borderRadius: 12,
              padding: "12px 14px",
              color: "#c9f3ff",
              minWidth: 290,
              backdropFilter: "blur(6px)",
            }}
          >
            <div style={{ fontSize: 12, opacity: 0.75, letterSpacing: 0.6 }}>TIME MACHINE</div>
            <input
              type="datetime-local"
              value={asOfInput}
              onChange={(e) => setAsOfInput(e.target.value)}
              style={{
                marginTop: 8,
                width: "100%",
                border: "1px solid rgba(132, 216, 255, 0.25)",
                background: "rgba(4, 8, 16, 0.9)",
                color: "#d9f8ff",
                borderRadius: 10,
                fontSize: 14,
                padding: "10px 12px",
                outline: "none",
              }}
            />
            <div style={{ marginTop: 7, fontSize: 12, opacity: 0.78 }}>
              {historicalMode ? "Historický mód aktivní" : "Live mód (současnost)"}
            </div>
            <button
              type="button"
              onClick={() => setAsOfInput("")}
              disabled={!historicalMode}
              style={{
                marginTop: 8,
                border: "1px solid rgba(110, 225, 255, 0.5)",
                background: historicalMode
                  ? "linear-gradient(120deg, #18b2e2, #36d6ff)"
                  : "linear-gradient(120deg, rgba(63,95,110,0.7), rgba(48,66,80,0.7))",
                color: historicalMode ? "#02121c" : "#b9c8cf",
                borderRadius: 10,
                fontWeight: 700,
                letterSpacing: 0.2,
                padding: "9px 12px",
                width: "100%",
                cursor: historicalMode ? "pointer" : "not-allowed",
              }}
            >
              Zpet do soucasnosti
            </button>
          </div>
        </div>

        <div
          style={{
            pointerEvents: "auto",
            alignSelf: "center",
            width: "min(920px, 96vw)",
            marginBottom: 8,
          }}
        >
          <div style={{ display: "flex", flexWrap: "wrap", gap: 8, marginBottom: 8, justifyContent: "center" }}>
            {smartSuggestions.slice(0, 4).map((item) => (
              <button
                key={`quick-${item.id}`}
                type="button"
                onClick={() => applySuggestion(item.command)}
                disabled={historicalMode}
                style={{
                  border: "1px solid rgba(117, 216, 255, 0.3)",
                  background: historicalMode ? "rgba(36,45,58,0.8)" : "rgba(6, 18, 32, 0.8)",
                  color: historicalMode ? "#8ea0aa" : "#d4f8ff",
                  borderRadius: 999,
                  padding: "7px 12px",
                  fontSize: 12,
                  cursor: historicalMode ? "not-allowed" : "pointer",
                }}
                title={item.command}
              >
                {item.title}
              </button>
            ))}
          </div>

          <form
            onSubmit={executeCommand}
            style={{
              display: "flex",
              gap: 10,
              padding: 10,
              borderRadius: 14,
              background: "rgba(5, 9, 18, 0.75)",
              border: "1px solid rgba(102, 209, 255, 0.3)",
              backdropFilter: "blur(8px)",
            }}
          >
            <div style={{ flex: 1, position: "relative" }}>
              <input
                ref={commandInputRef}
                value={query}
                onChange={(e) => setQuery(e.target.value)}
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
                placeholder='Např. "Pavel + Audi", "Spočítej : Projekt.celkem = SUM(cena)" nebo "Ukaž : Pavel"'
                style={{
                  width: "100%",
                  border: "1px solid rgba(132, 216, 255, 0.25)",
                  background: "rgba(4, 8, 16, 0.9)",
                  color: "#d9f8ff",
                  borderRadius: 10,
                  fontSize: 16,
                  padding: "12px 14px",
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
                        key={`suggest-${item.id}-${item.command}`}
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
              disabled={busy || historicalMode}
              style={{
                border: "1px solid rgba(110, 225, 255, 0.5)",
                background: busy || historicalMode
                  ? "linear-gradient(120deg, rgba(63,95,110,0.7), rgba(48,66,80,0.7))"
                  : "linear-gradient(120deg, #18b2e2, #36d6ff)",
                color: busy || historicalMode ? "#b9c8cf" : "#02121c",
                borderRadius: 10,
                fontWeight: 700,
                letterSpacing: 0.3,
                padding: "0 18px",
                minWidth: 124,
                cursor: busy || historicalMode ? "not-allowed" : "pointer",
              }}
            >
              {historicalMode ? "HISTORICAL LOCK" : busy ? "RUNNING..." : "EXECUTE"}
            </button>
          </form>
        </div>

      </div>

      <div
        style={{
          position: "absolute",
          right: 18,
          bottom: 18,
          zIndex: 23,
          pointerEvents: "none",
          borderRadius: 12,
          border: "1px solid rgba(113, 210, 245, 0.25)",
          background: "rgba(8, 14, 26, 0.72)",
          color: "#c7eefb",
          padding: "9px 11px",
          fontSize: 11,
          backdropFilter: "blur(6px)",
        }}
      >
        {NAV_SHORTCUTS.map((item) => (
          <div key={item.key} style={{ display: "flex", gap: 6, marginTop: 3 }}>
            <span style={{ opacity: 0.86, minWidth: 46 }}>{item.key}</span>
            <span style={{ opacity: 0.72 }}>{item.label}</span>
          </div>
        ))}
      </div>

      {selectedPlanet ? (
        <div
          style={{
            position: "absolute",
            right: 20,
            top: 170,
            zIndex: 25,
            width: "min(360px, 92vw)",
            pointerEvents: "auto",
            background: "linear-gradient(150deg, rgba(10, 17, 30, 0.86), rgba(6, 11, 22, 0.8))",
            border: "1px solid rgba(122, 221, 255, 0.38)",
            borderRadius: 14,
            padding: "14px 16px",
            color: "#d6f6ff",
            backdropFilter: "blur(8px)",
            boxShadow: "0 0 30px rgba(81, 208, 255, 0.15)",
          }}
        >
          <div style={{ fontSize: 12, opacity: 0.74, letterSpacing: 0.7 }}>HOLOGRAFICKÝ PANEL</div>
          <div
            style={{
              marginTop: 8,
              fontSize: 22,
              lineHeight: 1.25,
              fontWeight: 700,
              color: "#ebfbff",
              textShadow: "0 0 14px rgba(127, 224, 255, 0.5)",
              wordBreak: "break-word",
            }}
          >
            {valueToLabel(selectedPlanet.value)}
          </div>
          <div style={{ marginTop: 8, fontSize: 13, opacity: 0.82 }}>
            Created: {formatCreatedAt(selectedPlanet.created_at)}
          </div>

          {selectedPlanetMetadata.length > 0 ? (
            <div style={{ marginTop: 12 }}>
              <div style={{ fontSize: 12, opacity: 0.75, letterSpacing: 0.6 }}>METADATA</div>
              <div style={{ marginTop: 8, display: "grid", gap: 6 }}>
                {selectedPlanetMetadata.map(([key, value]) => (
                  <div
                    key={key}
                    style={{
                      display: "grid",
                      gridTemplateColumns: "minmax(96px, 36%) 1fr",
                      gap: 8,
                      fontSize: 13,
                      alignItems: "start",
                    }}
                  >
                    <div style={{ color: "#9dd7ea", opacity: 0.9, wordBreak: "break-word" }}>{key}</div>
                    <div style={{ color: "#f0fdff", wordBreak: "break-word" }}>{valueToLabel(value)}</div>
                  </div>
                ))}
              </div>
            </div>
          ) : (
            <div style={{ marginTop: 12, fontSize: 13, opacity: 0.68 }}>Metadata: žádná</div>
          )}
        </div>
      ) : null}
    </div>
  );
}
