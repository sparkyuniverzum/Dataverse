import { useEffect, useMemo, useRef, useState } from "react";
import { Canvas, useFrame } from "@react-three/fiber";
import { Billboard, OrbitControls, Stars, Text } from "@react-three/drei";
import { Bloom, EffectComposer } from "@react-three/postprocessing";
import * as THREE from "three";
import { API_BASE, apiFetch } from "../../lib/dataverseApi";
import {
  GALAXY_CREATION_PRESETS,
  GALAXY_GUIDE,
  GALAXY_PURPOSE_OPTIONS,
  GALAXY_REGION_OPTIONS,
  GALAXY_TIMEZONE_OPTIONS,
  MODEL_PATH_LABEL,
} from "../../lib/onboarding";

function hashText(input) {
  const text = String(input || "");
  let hash = 2166136261;
  for (let i = 0; i < text.length; i += 1) {
    hash ^= text.charCodeAt(i);
    hash = Math.imul(hash, 16777619);
  }
  return hash >>> 0;
}

const GALAXY_ARCHETYPES = [
  {
    key: "spiral",
    label: "Spiralni",
    palette: ["#8de6ff", "#5bc8ff", "#dfffff"],
  },
  {
    key: "barred",
    label: "Barred Spiral",
    palette: ["#9db7ff", "#7b8dff", "#f2edff"],
  },
  {
    key: "ring",
    label: "Prstencova",
    palette: ["#ffd88d", "#ffbe63", "#fff1cc"],
  },
  {
    key: "elliptical",
    label: "Elipticka",
    palette: ["#ffb5d2", "#f392c8", "#fff0f7"],
  },
  {
    key: "irregular",
    label: "Nepravidelna",
    palette: ["#87ffd2", "#5de3b6", "#e3fff5"],
  },
];

function clamp(value, min, max) {
  return Math.max(min, Math.min(max, value));
}

function pickArchetype(galaxyId) {
  const hash = hashText(galaxyId);
  return GALAXY_ARCHETYPES[hash % GALAXY_ARCHETYPES.length];
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

function pushStar(positions, colors, x, y, z, color) {
  positions.push(x, y, z);
  colors.push(color.r, color.g, color.b);
}

function buildGalaxyCloud(galaxyId) {
  const rng = createRng(galaxyId);
  const archetype = pickArchetype(galaxyId);
  const primary = new THREE.Color(archetype.palette[0]);
  const secondary = new THREE.Color(archetype.palette[1]);
  const highlight = new THREE.Color(archetype.palette[2]);
  const temp = new THREE.Color();

  const positions = [];
  const colors = [];
  const baseRadius = 11 + rng() * 8.5;
  const haloRadius = baseRadius + 5.4 + rng() * 3.8;
  const coreRadius = clamp(baseRadius * (0.18 + rng() * 0.08), 1.8, 5.4);

  if (archetype.key === "spiral" || archetype.key === "barred") {
    const armCount = archetype.key === "barred" ? 2 : 3 + Math.floor(rng() * 2);
    const armStars = 210 + Math.floor(rng() * 180);
    const coreStars = 60 + Math.floor(rng() * 70);
    const spin = archetype.key === "barred" ? 0.82 + rng() * 0.56 : 1.2 + rng() * 1.4;
    const thickness = 1.1 + rng() * 1.9;

    for (let i = 0; i < coreStars; i += 1) {
      const theta = rng() * Math.PI * 2;
      const r = Math.pow(rng(), 2.0) * (baseRadius * 0.34);
      const x = Math.cos(theta) * r;
      const z = Math.sin(theta) * r;
      const y = (rng() - 0.5) * thickness * 1.6;
      temp.copy(primary).lerp(highlight, 0.42 + rng() * 0.34);
      pushStar(positions, colors, x, y, z, temp);
    }

    if (archetype.key === "barred") {
      const barStars = 100 + Math.floor(rng() * 60);
      for (let i = 0; i < barStars; i += 1) {
        const t = (i / Math.max(1, barStars - 1)) * 2 - 1;
        const x = t * (baseRadius * 0.78) + (rng() - 0.5) * 0.9;
        const z = (rng() - 0.5) * 1.5;
        const y = (rng() - 0.5) * 1.0;
        temp.copy(secondary).lerp(highlight, 0.22 + rng() * 0.25);
        pushStar(positions, colors, x, y, z, temp);
      }
    }

    for (let i = 0; i < armStars; i += 1) {
      const armIndex = i % armCount;
      const t = rng();
      const armBase = (armIndex / armCount) * Math.PI * 2;
      const angle = armBase + t * spin * Math.PI * 2 + (rng() - 0.5) * 0.28;
      const r = Math.max(0.8, t * baseRadius + (rng() - 0.5) * 1.8);
      const x = Math.cos(angle) * r;
      const z = Math.sin(angle) * r;
      const y = (rng() - 0.5) * thickness * (1.14 - t * 0.62);
      temp.copy(secondary).lerp(highlight, rng() * 0.2);
      if (rng() > 0.88) temp.copy(highlight);
      pushStar(positions, colors, x, y, z, temp);
    }
  } else if (archetype.key === "ring") {
    const ringStars = 330 + Math.floor(rng() * 180);
    const coreStars = 45 + Math.floor(rng() * 50);
    const ringRadius = baseRadius * (0.92 + rng() * 0.3);

    for (let i = 0; i < coreStars; i += 1) {
      const theta = rng() * Math.PI * 2;
      const r = Math.pow(rng(), 1.8) * (baseRadius * 0.2);
      const x = Math.cos(theta) * r;
      const z = Math.sin(theta) * r;
      const y = (rng() - 0.5) * 0.9;
      temp.copy(primary).lerp(highlight, 0.5 + rng() * 0.3);
      pushStar(positions, colors, x, y, z, temp);
    }

    for (let i = 0; i < ringStars; i += 1) {
      const theta = (i / ringStars) * Math.PI * 2 + (rng() - 0.5) * 0.06;
      const r = ringRadius + (rng() - 0.5) * 1.4;
      const x = Math.cos(theta) * r;
      const z = Math.sin(theta) * r;
      const y = (rng() - 0.5) * 0.8;
      temp.copy(secondary).lerp(highlight, rng() * 0.25);
      pushStar(positions, colors, x, y, z, temp);
    }
  } else if (archetype.key === "elliptical") {
    const cloudStars = 360 + Math.floor(rng() * 180);
    const spreadX = baseRadius * 0.92;
    const spreadY = baseRadius * 0.54;
    const spreadZ = baseRadius * 0.76;
    for (let i = 0; i < cloudStars; i += 1) {
      const rx = (rng() - 0.5) * 2;
      const ry = (rng() - 0.5) * 2;
      const rz = (rng() - 0.5) * 2;
      const scale = Math.pow(rng(), 0.44);
      const x = rx * spreadX * scale;
      const y = ry * spreadY * scale;
      const z = rz * spreadZ * scale;
      temp.copy(primary).lerp(secondary, rng() * 0.45).lerp(highlight, 0.08 + rng() * 0.16);
      pushStar(positions, colors, x, y, z, temp);
    }
  } else {
    const clusterCount = 4 + Math.floor(rng() * 4);
    const starsPerCluster = 70 + Math.floor(rng() * 50);
    const clusters = [];
    for (let i = 0; i < clusterCount; i += 1) {
      clusters.push({
        x: (rng() - 0.5) * baseRadius * 1.9,
        y: (rng() - 0.5) * baseRadius * 0.8,
        z: (rng() - 0.5) * baseRadius * 1.9,
      });
    }

    for (const cluster of clusters) {
      for (let i = 0; i < starsPerCluster; i += 1) {
        const spread = 0.72 + rng() * 1.9;
        const x = cluster.x + (rng() - 0.5) * spread * 2.2;
        const y = cluster.y + (rng() - 0.5) * spread * 1.2;
        const z = cluster.z + (rng() - 0.5) * spread * 2.2;
        temp.copy(primary).lerp(secondary, rng() * 0.65).lerp(highlight, rng() * 0.18);
        pushStar(positions, colors, x, y, z, temp);
      }
    }
  }

  const tiltX = (rng() - 0.5) * 0.96;
  const tiltY = (rng() - 0.5) * 1.25;
  const tiltZ = (rng() - 0.5) * 0.52;
  const ringCount = 1 + Math.floor(rng() * 2);
  const ringTilt = (rng() - 0.5) * 0.4;
  const spinSpeed = 0.05 + rng() * 0.13;
  const pointSize = 0.64 + rng() * 0.34;

  return {
    positions: new Float32Array(positions),
    colors: new Float32Array(colors),
    haloRadius,
    rotation: [tiltX, tiltY, tiltZ],
    coreRadius,
    spinSpeed,
    pointSize,
    ringCount,
    ringTilt,
    archetypeLabel: archetype.label,
    coreColor: highlight.getStyle(),
    ringColor: secondary.getStyle(),
  };
}

function buildPositions(galaxies) {
  const sorted = [...(galaxies || [])].sort((a, b) => String(a.id).localeCompare(String(b.id)));
  const positions = new Map();

  if (!sorted.length) return positions;

  const rings = [];
  let remaining = sorted.length;
  let ring = 0;
  while (remaining > 0) {
    const capacity = ring === 0 ? 8 : 8 + ring * 6;
    const take = Math.min(remaining, capacity);
    rings.push({ ring, take });
    remaining -= take;
    ring += 1;
  }

  let index = 0;
  rings.forEach(({ ring: ringIndex, take }) => {
    const radius = 85 + ringIndex * 62;
    for (let i = 0; i < take; i += 1) {
      const galaxy = sorted[index];
      const t = i / Math.max(1, take);
      const angle = t * Math.PI * 2;
      const jitter = ((hashText(galaxy.id) % 100) / 100 - 0.5) * 8;
      const y = ((hashText(`${galaxy.id}:y`) % 100) / 100 - 0.5) * 16;
      positions.set(galaxy.id, [
        Math.cos(angle) * (radius + jitter),
        y,
        Math.sin(angle) * (radius + jitter),
      ]);
      index += 1;
    }
  });

  return positions;
}

function formatDateTime(value) {
  if (!value) return "n/a";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "n/a";
  return date.toLocaleString();
}

function GalaxyNode({ galaxy, position, selected, hovered, onHover, onClick, onDoubleClick }) {
  const groupRef = useRef(null);
  const baseScale = selected ? 1.22 : hovered ? 1.1 : 1;
  const targetScaleRef = useRef(baseScale);

  useEffect(() => {
    targetScaleRef.current = selected ? 1.22 : hovered ? 1.1 : 1;
  }, [selected, hovered]);

  useFrame((_, delta) => {
    if (!groupRef.current) return;
    const next = THREE.MathUtils.damp(groupRef.current.scale.x, targetScaleRef.current, 6, delta);
    groupRef.current.scale.set(next, next, next);
    groupRef.current.rotation.y += delta * cloud.spinSpeed;
  });

  const cloud = useMemo(() => buildGalaxyCloud(galaxy.id), [galaxy.id]);

  return (
    <group ref={groupRef} position={position}>
      <group rotation={cloud.rotation}>
        <points>
          <bufferGeometry>
            <bufferAttribute
              attach="attributes-position"
              args={[cloud.positions, 3]}
              count={cloud.positions.length / 3}
            />
            <bufferAttribute
              attach="attributes-color"
              args={[cloud.colors, 3]}
              count={cloud.colors.length / 3}
            />
          </bufferGeometry>
          <pointsMaterial
            size={(selected ? 1.02 : 0.8) * cloud.pointSize}
            sizeAttenuation
            vertexColors
            transparent
            depthWrite={false}
            opacity={selected ? 0.98 : 0.82}
            blending={THREE.AdditiveBlending}
          />
        </points>

        <mesh>
          <sphereGeometry args={[cloud.coreRadius, 24, 24]} />
          <meshStandardMaterial
            color={selected ? "#f7ffff" : cloud.coreColor}
            emissive={selected ? "#d8fbff" : cloud.coreColor}
            emissiveIntensity={selected ? 1.46 : 0.92}
            roughness={0.24}
            metalness={0.2}
            transparent
            opacity={0.94}
          />
        </mesh>

        {Array.from({ length: cloud.ringCount }).map((_, idx) => {
          const factor = 0.5 + idx * 0.17;
          return (
            <mesh key={idx} rotation={[Math.PI / 2 + cloud.ringTilt * (idx + 1), 0, idx * 0.38]}>
              <torusGeometry args={[cloud.haloRadius * factor, 0.26 + idx * 0.08, 16, 120]} />
              <meshStandardMaterial
                color={cloud.ringColor}
                emissive={cloud.ringColor}
                emissiveIntensity={selected ? 1.0 : 0.55}
                transparent
                opacity={0.45 - idx * 0.08}
              />
            </mesh>
          );
        })}
      </group>

      <mesh
        onPointerOver={(event) => {
          event.stopPropagation();
          onHover(galaxy.id);
        }}
        onPointerOut={(event) => {
          event.stopPropagation();
          onHover("");
        }}
        onClick={(event) => {
          event.stopPropagation();
          onClick(galaxy.id);
        }}
        onDoubleClick={(event) => {
          event.stopPropagation();
          onDoubleClick(galaxy.id);
        }}
      >
        <sphereGeometry args={[cloud.haloRadius, 24, 24]} />
        <meshBasicMaterial transparent opacity={0} depthWrite={false} />
      </mesh>

      <Billboard position={[0, cloud.haloRadius + 6.4, 0]}>
        <Text fontSize={4.1} color="#e6fbff" anchorX="center" anchorY="middle" maxWidth={78}>
          {galaxy.name}
        </Text>
      </Billboard>
      <Billboard position={[0, cloud.haloRadius + 2.8, 0]}>
        <Text fontSize={2.2} color="#aadff0" anchorX="center" anchorY="middle" maxWidth={74}>
          {cloud.archetypeLabel}
        </Text>
      </Billboard>
    </group>
  );
}

function GalaxyScene({ galaxies, selectedId, hoveredId, onHover, onClick, onDoubleClick }) {
  const positions = useMemo(() => buildPositions(galaxies), [galaxies]);

  return (
    <>
      <color attach="background" args={["#02050c"]} />
      <fog attach="fog" args={["#02050c", 220, 1300]} />

      <ambientLight intensity={0.46} />
      <directionalLight position={[180, 180, 220]} intensity={1.06} color="#b6ecff" />
      <directionalLight position={[-220, -140, -180]} intensity={0.38} color="#6d9bff" />

      <Stars radius={1800} depth={820} count={7600} factor={8} saturation={0} fade speed={0.12} />

      {galaxies.map((galaxy) => (
        <GalaxyNode
          key={galaxy.id}
          galaxy={galaxy}
          position={positions.get(galaxy.id) || [0, 0, 0]}
          selected={selectedId === galaxy.id}
          hovered={hoveredId === galaxy.id}
          onHover={onHover}
          onClick={onClick}
          onDoubleClick={onDoubleClick}
        />
      ))}

      <EffectComposer>
        <Bloom intensity={0.64} luminanceThreshold={0.08} luminanceSmoothing={0.34} mipmapBlur />
      </EffectComposer>

      <OrbitControls
        makeDefault
        enableDamping
        dampingFactor={0.08}
        minDistance={50}
        maxDistance={620}
      />
    </>
  );
}

export default function GalaxySelector3D({
  user,
  galaxies,
  selectedGalaxyId,
  newGalaxyName,
  loading,
  busy,
  error,
  onSelect,
  onCreate,
  onNameChange,
  onExtinguish,
  onRefresh,
  onLogout,
}) {
  const [candidateGalaxyId, setCandidateGalaxyId] = useState(selectedGalaxyId || "");
  const [hoveredGalaxyId, setHoveredGalaxyId] = useState("");
  const [workspacePurpose, setWorkspacePurpose] = useState("general");
  const [workspaceOwner, setWorkspaceOwner] = useState("");
  const [workspaceTeam, setWorkspaceTeam] = useState("");
  const [workspaceRegion, setWorkspaceRegion] = useState("global");
  const [workspaceTimezone, setWorkspaceTimezone] = useState("UTC");
  const [creationPreset, setCreationPreset] = useState("blank");
  const [dashboardLoading, setDashboardLoading] = useState(false);
  const [dashboardError, setDashboardError] = useState("");
  const [summary, setSummary] = useState(null);
  const [health, setHealth] = useState(null);
  const [activity, setActivity] = useState([]);
  const [showGuide, setShowGuide] = useState(false);

  useEffect(() => {
    if (!candidateGalaxyId && galaxies.length === 1) {
      setCandidateGalaxyId(galaxies[0].id);
    }
    if (candidateGalaxyId && !galaxies.some((g) => String(g.id) === String(candidateGalaxyId))) {
      setCandidateGalaxyId("");
    }
  }, [candidateGalaxyId, galaxies]);

  const selectedGalaxy = useMemo(
    () => galaxies.find((item) => String(item.id) === String(candidateGalaxyId || "")) || null,
    [candidateGalaxyId, galaxies]
  );

  const hoveredGalaxy = useMemo(
    () => galaxies.find((item) => String(item.id) === String(hoveredGalaxyId || "")) || null,
    [hoveredGalaxyId, galaxies]
  );
  const selectedCreationPreset = useMemo(
    () => GALAXY_CREATION_PRESETS.find((item) => item.key === creationPreset) || GALAXY_CREATION_PRESETS[0],
    [creationPreset]
  );
  const selectedPurposeOption = useMemo(
    () => GALAXY_PURPOSE_OPTIONS.find((item) => item.key === workspacePurpose) || GALAXY_PURPOSE_OPTIONS[0],
    [workspacePurpose]
  );

  useEffect(() => {
    if (!candidateGalaxyId) {
      setSummary(null);
      setHealth(null);
      setActivity([]);
      setDashboardError("");
      return;
    }

    let active = true;
    const loadDashboard = async () => {
      setDashboardLoading(true);
      setDashboardError("");
      try {
        const [summaryRes, healthRes, activityRes] = await Promise.all([
          apiFetch(`${API_BASE}/galaxies/${candidateGalaxyId}/summary`),
          apiFetch(`${API_BASE}/galaxies/${candidateGalaxyId}/health`),
          apiFetch(`${API_BASE}/galaxies/${candidateGalaxyId}/activity?limit=8`),
        ]);

        if (!summaryRes.ok || !healthRes.ok || !activityRes.ok) {
          throw new Error(`Dashboard load failed (${summaryRes.status}/${healthRes.status}/${activityRes.status})`);
        }
        const [summaryBody, healthBody, activityBody] = await Promise.all([
          summaryRes.json(),
          healthRes.json(),
          activityRes.json(),
        ]);
        if (!active) return;
        setSummary(summaryBody || null);
        setHealth(healthBody || null);
        setActivity(Array.isArray(activityBody?.items) ? activityBody.items : []);
      } catch (error) {
        if (!active) return;
        setDashboardError(error.message || "Dashboard load failed");
      } finally {
        if (active) setDashboardLoading(false);
      }
    };

    loadDashboard();
    return () => {
      active = false;
    };
  }, [candidateGalaxyId]);

  const healthColor = health?.status === "RED"
    ? "#ff8ea5"
    : health?.status === "YELLOW"
      ? "#ffd28e"
      : "#8fffd2";
  const noGalaxiesYet = galaxies.length === 0;

  return (
    <main style={{ width: "100vw", height: "100vh", position: "relative", overflow: "hidden", background: "#02050c" }}>
      <Canvas
        camera={{ position: [0, 42, 250], fov: 56, near: 0.1, far: 4500 }}
        gl={{ antialias: true, toneMapping: THREE.ACESFilmicToneMapping, toneMappingExposure: 1.2 }}
        onPointerMissed={() => setHoveredGalaxyId("")}
      >
        <GalaxyScene
          galaxies={galaxies}
          selectedId={candidateGalaxyId}
          hoveredId={hoveredGalaxyId}
          onHover={setHoveredGalaxyId}
          onClick={setCandidateGalaxyId}
          onDoubleClick={(id) => {
            setCandidateGalaxyId(id);
            onSelect(id);
          }}
        />
      </Canvas>

      {noGalaxiesYet ? (
        <section
          style={{
            position: "fixed",
            left: "50%",
            top: "50%",
            transform: "translate(-50%, -50%)",
            zIndex: 33,
            width: "min(680px, 92vw)",
            borderRadius: 16,
            border: "1px solid rgba(99, 192, 224, 0.44)",
            background: "rgba(3, 11, 21, 0.92)",
            color: "#dcf8ff",
            padding: "14px 16px",
            display: "grid",
            gap: 10,
            boxShadow: "0 0 34px rgba(30, 122, 171, 0.3)",
            backdropFilter: "blur(10px)",
          }}
        >
          <div style={{ fontSize: "var(--dv-fs-4xl)", fontWeight: 800 }}>Start: nejdriv zaloz prvni galaxii</div>
          <div style={{ fontSize: "var(--dv-fs-md)", opacity: 0.9 }}>
            Nemáš zatim zadny workspace. Udelej 5 kroku: 1) pojmenuj galaxii, 2) vyber ucel, 3) nastav owner/team a lokaci, 4) vyber predvyplneni, 5) klikni Vytvorit prvni galaxii.
          </div>
          <div style={{ display: "grid", gridTemplateColumns: "1fr minmax(190px, 250px)", gap: 8 }}>
            <input
              value={newGalaxyName}
              onChange={(event) => onNameChange(event.target.value)}
              placeholder="Krok 1: Nazev (napr. Firma 2026)"
              style={inputStyle}
            />
            <select
              value={workspacePurpose}
              onChange={(event) => setWorkspacePurpose(event.target.value)}
              style={selectStyle}
            >
              {GALAXY_PURPOSE_OPTIONS.map((item) => (
                <option key={item.key} value={item.key}>
                  {item.label}
                </option>
              ))}
            </select>
          </div>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
            <input
              value={workspaceOwner}
              onChange={(event) => setWorkspaceOwner(event.target.value)}
              placeholder="Krok 3: Owner (napr. jana.novak)"
              style={inputStyle}
            />
            <input
              value={workspaceTeam}
              onChange={(event) => setWorkspaceTeam(event.target.value)}
              placeholder="Team (napr. finance-core)"
              style={inputStyle}
            />
          </div>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
            <select
              value={workspaceRegion}
              onChange={(event) => setWorkspaceRegion(event.target.value)}
              style={selectStyle}
            >
              {GALAXY_REGION_OPTIONS.map((item) => (
                <option key={item.key} value={item.key}>
                  {item.label}
                </option>
              ))}
            </select>
            <select
              value={workspaceTimezone}
              onChange={(event) => setWorkspaceTimezone(event.target.value)}
              style={selectStyle}
            >
              {GALAXY_TIMEZONE_OPTIONS.map((item) => (
                <option key={item.key} value={item.key}>
                  {item.label}
                </option>
              ))}
            </select>
          </div>
          <div style={{ display: "grid", gridTemplateColumns: "minmax(190px, 250px) auto", gap: 8, justifyContent: "space-between" }}>
            <select
              value={creationPreset}
              onChange={(event) => setCreationPreset(event.target.value)}
              style={selectStyle}
            >
              {GALAXY_CREATION_PRESETS.map((item) => (
                <option key={item.key} value={item.key}>
                  {item.label}
                </option>
              ))}
            </select>
            <button
              type="button"
              onClick={() =>
                onCreate({
                  preset: creationPreset,
                  purpose: workspacePurpose,
                  owner: workspaceOwner,
                  team: workspaceTeam,
                  region: workspaceRegion,
                  timezone: workspaceTimezone,
                })
              }
              disabled={busy || !newGalaxyName.trim()}
              style={actionButtonStyle}
            >
              Vytvorit prvni galaxii
            </button>
          </div>
          <div style={{ fontSize: "var(--dv-fs-sm)", opacity: 0.88 }}>
            Krok 2 detail: <strong>{selectedPurposeOption.label}</strong> - {selectedPurposeOption.description}
          </div>
          <div style={{ fontSize: "var(--dv-fs-sm)", opacity: 0.88 }}>
            Krok 3 detail: <strong>{selectedCreationPreset.label}</strong> - {selectedCreationPreset.description}
          </div>
          <div style={{ fontSize: "var(--dv-fs-sm)", opacity: 0.8 }}>
            Owner/team/region/timezone se ulozi do metadata predvyplnenych zaznamu.
          </div>
        </section>
      ) : null}

      <div
        style={{
          position: "fixed",
          top: 14,
          left: "50%",
          transform: "translateX(-50%)",
          zIndex: 30,
          borderRadius: 999,
          border: "1px solid rgba(102, 203, 235, 0.4)",
          background: "rgba(5, 13, 23, 0.86)",
          color: "#d9f8ff",
          padding: "8px 14px",
          fontSize: "var(--dv-fs-sm)",
          display: "flex",
          alignItems: "center",
          gap: 10,
          backdropFilter: "blur(7px)",
        }}
      >
        <strong>GALAXY NAVIGATOR</strong>
        <span style={{ opacity: 0.84 }}>Pilot: {user?.email || "n/a"}</span>
        <span style={{ opacity: 0.84 }}>Workspaces/Galaxie: {galaxies.length}</span>
        {loading ? <span style={{ color: "#9be8ff" }}>Loading...</span> : null}
      </div>

      <aside
        style={{
          position: "fixed",
          right: 14,
          top: 72,
          zIndex: 31,
          width: "min(360px, 92vw)",
          borderRadius: 14,
          border: "1px solid rgba(100, 196, 226, 0.36)",
          background: "rgba(4, 12, 24, 0.8)",
          color: "#d7f6ff",
          padding: 12,
          backdropFilter: "blur(12px)",
          boxShadow: "0 0 26px rgba(33, 122, 170, 0.24)",
          display: "grid",
          gap: 10,
        }}
      >
        <div style={{ fontSize: "var(--dv-fs-xs)", letterSpacing: "var(--dv-tr-xwide)", opacity: 0.74 }}>FLEET CONTROL</div>
        <div style={{ fontSize: "var(--dv-fs-sm)", opacity: 0.78 }}>Hierarchie: {MODEL_PATH_LABEL}</div>

        <div style={{ fontSize: "var(--dv-fs-md)" }}>
          {selectedGalaxy ? (
            <>
              Vybraná galaxie: <strong>{selectedGalaxy.name}</strong>
            </>
          ) : (
            "Klikni na galaxii v prostoru"
          )}
        </div>

        {hoveredGalaxy ? (
          <div style={{ fontSize: "var(--dv-fs-sm)", opacity: 0.78 }}>
            Hover: {hoveredGalaxy.name}
          </div>
        ) : null}

        <div style={{ display: "grid", gridTemplateColumns: "1fr auto", gap: 8 }}>
          <input
            value={newGalaxyName}
            onChange={(event) => onNameChange(event.target.value)}
            placeholder="Nova galaxie (napr. Finance-Q2)"
            style={inputStyle}
          />
          <button
            type="button"
            onClick={() =>
              onCreate({
                preset: creationPreset,
                purpose: workspacePurpose,
                owner: workspaceOwner,
                team: workspaceTeam,
                region: workspaceRegion,
                timezone: workspaceTimezone,
              })
            }
            disabled={busy || !newGalaxyName.trim()}
            style={actionButtonStyle}
          >
            ↗ Launch
          </button>
        </div>
        <div style={{ display: "grid", gap: 6 }}>
          <div style={{ fontSize: "var(--dv-fs-xs)", letterSpacing: "var(--dv-tr-wide)", opacity: 0.76 }}>Ucel workspace</div>
          <select
            value={workspacePurpose}
            onChange={(event) => setWorkspacePurpose(event.target.value)}
            style={selectStyle}
          >
            {GALAXY_PURPOSE_OPTIONS.map((item) => (
              <option key={item.key} value={item.key}>
                {item.label}
              </option>
            ))}
          </select>
          <div style={{ fontSize: "var(--dv-fs-sm)", opacity: 0.84 }}>{selectedPurposeOption.description}</div>
        </div>
        <div style={{ display: "grid", gap: 6 }}>
          <div style={{ fontSize: "var(--dv-fs-xs)", letterSpacing: "var(--dv-tr-wide)", opacity: 0.76 }}>Owner, Team a Lokace</div>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 6 }}>
            <input
              value={workspaceOwner}
              onChange={(event) => setWorkspaceOwner(event.target.value)}
              placeholder="owner"
              style={inputStyle}
            />
            <input
              value={workspaceTeam}
              onChange={(event) => setWorkspaceTeam(event.target.value)}
              placeholder="team"
              style={inputStyle}
            />
          </div>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 6 }}>
            <select
              value={workspaceRegion}
              onChange={(event) => setWorkspaceRegion(event.target.value)}
              style={selectStyle}
            >
              {GALAXY_REGION_OPTIONS.map((item) => (
                <option key={item.key} value={item.key}>
                  {item.label}
                </option>
              ))}
            </select>
            <select
              value={workspaceTimezone}
              onChange={(event) => setWorkspaceTimezone(event.target.value)}
              style={selectStyle}
            >
              {GALAXY_TIMEZONE_OPTIONS.map((item) => (
                <option key={item.key} value={item.key}>
                  {item.label}
                </option>
              ))}
            </select>
          </div>
          <div style={{ fontSize: "var(--dv-fs-sm)", opacity: 0.84 }}>
            Tyto hodnoty se pouziji jako default metadata pro seed data.
          </div>
        </div>
        <div style={{ display: "grid", gap: 6 }}>
          <div style={{ fontSize: "var(--dv-fs-xs)", letterSpacing: "var(--dv-tr-wide)", opacity: 0.76 }}>Preddefinovani pri vytvoreni</div>
          <select
            value={creationPreset}
            onChange={(event) => setCreationPreset(event.target.value)}
            style={selectStyle}
          >
            {GALAXY_CREATION_PRESETS.map((item) => (
              <option key={item.key} value={item.key}>
                {item.label}
              </option>
            ))}
          </select>
          <div style={{ fontSize: "var(--dv-fs-sm)", opacity: 0.84 }}>{selectedCreationPreset.description}</div>
        </div>

        <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
          <button
            type="button"
            onClick={() => candidateGalaxyId && onSelect(candidateGalaxyId)}
            disabled={!candidateGalaxyId || noGalaxiesYet}
            style={actionButtonStyle}
          >
            Vstoupit
          </button>
          <button
            type="button"
            onClick={() => candidateGalaxyId && onExtinguish(candidateGalaxyId)}
            disabled={!candidateGalaxyId || busy || noGalaxiesYet}
            style={dangerButtonStyle}
          >
            Zhasnout
          </button>
          <button type="button" onClick={onRefresh} disabled={loading} style={ghostButtonStyle}>
            Obnovit
          </button>
          <button type="button" onClick={onLogout} style={ghostButtonStyle}>
            Logout
          </button>
        </div>

        <div style={{ fontSize: "var(--dv-fs-sm)", opacity: 0.8 }}>
          {noGalaxiesYet ? "Nejdriv vytvor galaxii. Potom funguje klik=vyber, dvojklik=vstup." : "Tip: dvojklik na galaxii = okamzity vstup."}
        </div>

        <div style={{ display: "grid", gap: 6 }}>
          <button
            type="button"
            onClick={() => setShowGuide((prev) => !prev)}
            style={{
              ...ghostButtonStyle,
              justifySelf: "start",
              borderRadius: 999,
              width: 30,
              height: 30,
              padding: 0,
              fontSize: "var(--dv-fs-lg)",
              fontWeight: 700,
            }}
            title="Napoveda"
          >
            ?
          </button>
          {showGuide ? (
            <div
              style={{
                border: "1px solid rgba(98, 190, 222, 0.28)",
                borderRadius: 10,
                background: "rgba(4, 11, 20, 0.76)",
                padding: 10,
                display: "grid",
                gap: 6,
              }}
            >
              <div style={{ fontSize: "var(--dv-fs-xs)", letterSpacing: "var(--dv-tr-xwide)", opacity: 0.78 }}>JAK POKRACOVAT BEZ VAHANI</div>
              {GALAXY_GUIDE.map((item) => (
                <div key={item} style={{ fontSize: "var(--dv-fs-sm)", opacity: 0.88 }}>
                  - {item}
                </div>
              ))}
            </div>
          ) : null}
        </div>

        <div
          style={{
            border: "1px solid rgba(98, 190, 222, 0.28)",
            borderRadius: 10,
            background: "rgba(4, 11, 20, 0.76)",
            padding: 10,
            display: "grid",
            gap: 8,
          }}
        >
          <div style={{ fontSize: "var(--dv-fs-xs)", letterSpacing: "var(--dv-tr-xwide)", opacity: 0.78 }}>GALAXY DASHBOARD V1</div>
          {dashboardLoading ? <div style={{ fontSize: "var(--dv-fs-sm)", color: "#9adfff" }}>Nacitam summary/health/activity...</div> : null}
          {!dashboardLoading && summary ? (
            <div style={{ display: "grid", gap: 5, fontSize: "var(--dv-fs-sm)" }}>
              <div>Souhvezdi: <strong>{summary.constellations_count}</strong></div>
              <div>Planety: <strong>{summary.planets_count}</strong></div>
              <div>Mesice: <strong>{summary.moons_count}</strong></div>
              <div>Vazby: <strong>{summary.bonds_count}</strong></div>
              <div>Vzorce: <strong>{summary.formula_fields_count}</strong></div>
            </div>
          ) : null}
          {!dashboardLoading && health ? (
            <div style={{ display: "grid", gap: 5, fontSize: "var(--dv-fs-sm)" }}>
              <div>
                Stav:
                <strong style={{ marginLeft: 6, color: healthColor }}>{health.status}</strong>
                <span style={{ marginLeft: 6, opacity: 0.84 }}>({health.quality_score}/100)</span>
              </div>
              <div>Guardian pravidla: <strong>{health.guardian_rules_count}</strong></div>
              <div>Aktivni alerty: <strong>{health.alerted_asteroids_count}</strong></div>
              <div>Kruhove odkazy: <strong>{health.circular_fields_count}</strong></div>
            </div>
          ) : null}
          {!dashboardLoading && activity.length ? (
            <div style={{ display: "grid", gap: 5 }}>
              <div style={{ fontSize: "var(--dv-fs-xs)", opacity: 0.76 }}>Posledni aktivita</div>
              {activity.slice(0, 6).map((item) => (
                <div
                  key={item.id}
                  style={{
                    border: "1px solid rgba(96, 180, 210, 0.2)",
                    borderRadius: 8,
                    padding: "6px 7px",
                    background: "rgba(6, 16, 30, 0.68)",
                    fontSize: "var(--dv-fs-xs)",
                    display: "grid",
                    gap: 2,
                  }}
                >
                  <div style={{ color: "#cfeef8" }}>{item.event_type}</div>
                  <div style={{ opacity: 0.76 }}>{formatDateTime(item.happened_at)}</div>
                </div>
              ))}
            </div>
          ) : null}
          {dashboardError ? <div style={{ fontSize: "var(--dv-fs-sm)", color: "#ffb3c7" }}>{dashboardError}</div> : null}
        </div>

        {error ? <div style={{ fontSize: "var(--dv-fs-sm)", color: "#ffb3c7" }}>{error}</div> : null}
      </aside>
    </main>
  );
}

const inputStyle = {
  width: "100%",
  borderRadius: 12,
  border: "1px solid rgba(114, 202, 234, 0.34)",
  background: "linear-gradient(140deg, rgba(10, 26, 44, 0.82), rgba(5, 16, 28, 0.72))",
  color: "#ddf7ff",
  padding: "8px 10px",
  fontSize: "var(--dv-fs-sm)",
  letterSpacing: "var(--dv-tr-normal)",
  outline: "none",
  boxSizing: "border-box",
};

const selectStyle = {
  ...inputStyle,
  appearance: "none",
};

const actionButtonStyle = {
  border: "1px solid rgba(113, 222, 255, 0.5)",
  background: "linear-gradient(120deg, #22b5e2, #53dbff)",
  color: "#052133",
  borderRadius: 12,
  padding: "7px 11px",
  fontWeight: 700,
  fontSize: "var(--dv-fs-xs)",
  letterSpacing: "var(--dv-tr-medium)",
  cursor: "pointer",
};

const dangerButtonStyle = {
  border: "1px solid rgba(255, 130, 160, 0.45)",
  background: "rgba(40, 13, 21, 0.76)",
  color: "#ffc7d7",
  borderRadius: 8,
  padding: "7px 10px",
  fontSize: "var(--dv-fs-sm)",
  cursor: "pointer",
};

const ghostButtonStyle = {
  border: "1px solid rgba(112, 200, 232, 0.3)",
  background: "rgba(7, 18, 32, 0.78)",
  color: "#d5f5ff",
  borderRadius: 10,
  padding: "7px 10px",
  fontSize: "var(--dv-fs-xs)",
  letterSpacing: "var(--dv-tr-normal)",
  cursor: "pointer",
};
