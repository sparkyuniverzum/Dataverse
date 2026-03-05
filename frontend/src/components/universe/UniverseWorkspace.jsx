import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { DndContext, DragOverlay, PointerSensor, useDraggable, useDroppable, useSensor, useSensors } from "@dnd-kit/core";

import {
  API_BASE,
  apiErrorFromResponse,
  apiFetch,
  buildMoonCreateUrl,
  buildMoonExtinguishUrl,
  buildMoonMutateUrl,
  buildOccConflictMessage,
  buildParserPayload,
  buildStarCorePolicyLockUrl,
  buildTableContractUrl,
  isOccConflictError,
} from "../../lib/dataverseApi";
import {
  buildExtinguishMoonCommand,
  buildIngestMoonCommand,
  buildLinkMoonsCommand,
} from "../../lib/builderParserCommand";
import { PARSER_EXECUTION_MODE } from "../../lib/parserExecutionMode";
import { createParserTelemetrySnapshot, recordParserTelemetry } from "../../lib/parserExecutionTelemetry";
import { calculateHierarchyLayout } from "../../lib/hierarchy_layout";
import LinkHoverTooltip from "./LinkHoverTooltip";
import { resolveEntityLaws, resolveLinkLaws, resolveStarCoreProfile } from "./lawResolver";
import QuickGridOverlay from "./QuickGridOverlay";
import { mergeMetadataValue } from "./rowWriteUtils";
import StarHeartDashboard from "./StarHeartDashboard";
import UniverseCanvas from "./UniverseCanvas";
import { useUniverseRuntimeSync } from "./useUniverseRuntimeSync";
import WorkspaceSidebar from "./WorkspaceSidebar";
import { buildStageZeroPlanetName, mapDropPointToPlanetPosition } from "./stageZeroUtils";
import { buildMoonCreateMinerals } from "./moonWriteDefaults";
import { readWorkspaceUiState, writeWorkspaceUiState } from "./workspaceUiPersistence";
import {
  collectGridColumns,
  normalizeText,
  readGridCell,
  tableDisplayName,
  valueToLabel,
} from "./workspaceFormatters";

const DEFAULT_CAMERA_STATE = {
  position: [0, 120, 340],
  minDistance: 36,
  maxDistance: 1800,
};

const STAR_CONTROL_PHASE = Object.freeze({
  IDLE: "idle",
  STAR_FOCUSED: "star_focused",
  STAR_HEART_DASHBOARD_OPEN: "star_heart_dashboard_open",
  APPLY_PROFILE: "apply_profile",
  LOCKED: "locked",
});

const STAGE_ZERO_FLOW = Object.freeze({
  INTRO: "intro",
  BLUEPRINT: "blueprint",
  BUILDING: "building",
  COMPLETE: "complete",
});
const STAGE_ZERO_DND = Object.freeze({
  PLANET_ITEM: "stage0:planet-item",
  CANVAS_DROP_ZONE: "stage0:canvas-drop-zone",
});

function StageZeroDraggablePlanetCard({ disabled = false }) {
  const { attributes, listeners, setNodeRef, transform, isDragging } = useDraggable({
    id: STAGE_ZERO_DND.PLANET_ITEM,
    disabled,
  });

  const translateStyle = transform
    ? { transform: `translate3d(${Math.round(transform.x)}px, ${Math.round(transform.y)}px, 0)` }
    : null;

  return (
    <button
      ref={setNodeRef}
      type="button"
      {...attributes}
      {...listeners}
      disabled={disabled}
      style={{
        border: "1px solid rgba(137, 231, 255, 0.56)",
        background: "radial-gradient(circle at 50% 35%, rgba(90, 218, 255, 0.42), rgba(16, 70, 102, 0.82))",
        color: "#dfffff",
        borderRadius: 12,
        padding: "14px 10px",
        fontWeight: 700,
        cursor: disabled ? "not-allowed" : "grab",
        textAlign: "left",
        display: "grid",
        gap: 4,
        boxShadow: isDragging ? "0 0 24px rgba(105, 230, 255, 0.44)" : "0 0 14px rgba(105, 230, 255, 0.2)",
        opacity: disabled ? 0.6 : 1,
        ...translateStyle,
      }}
    >
      <span style={{ fontSize: "var(--dv-fs-sm)" }}>Planeta</span>
      <span style={{ fontSize: "var(--dv-fs-xs)", opacity: 0.82 }}>Zakladni datovy kontejner</span>
    </button>
  );
}

function StageZeroDropZone({ active = false }) {
  const { setNodeRef, isOver } = useDroppable({
    id: STAGE_ZERO_DND.CANVAS_DROP_ZONE,
    disabled: !active,
  });
  if (!active) return null;
  return (
    <div
      ref={setNodeRef}
      data-stage-zero-drop-zone="true"
      style={{
        position: "fixed",
        inset: 0,
        zIndex: 57,
        pointerEvents: "auto",
        border: isOver ? "2px solid rgba(125, 226, 255, 0.74)" : "2px dashed rgba(125, 226, 255, 0.36)",
        boxShadow: isOver ? "inset 0 0 48px rgba(89, 209, 255, 0.24)" : "inset 0 0 24px rgba(89, 209, 255, 0.1)",
        opacity: isOver ? 1 : 0.82,
        transition: "opacity 160ms ease, border-color 180ms ease, box-shadow 180ms ease",
      }}
    />
  );
}

function StageZeroDragGhost() {
  return (
    <div
      style={{
        width: 160,
        borderRadius: 12,
        border: "1px solid rgba(144, 233, 255, 0.66)",
        background: "radial-gradient(circle at 50% 35%, rgba(103, 226, 255, 0.34), rgba(12, 54, 78, 0.44))",
        color: "#defdff",
        padding: "12px 10px",
        backdropFilter: "blur(3px)",
        boxShadow: "0 0 26px rgba(97, 221, 255, 0.32)",
        opacity: 0.86,
        pointerEvents: "none",
      }}
    >
      <div style={{ fontSize: "var(--dv-fs-sm)", fontWeight: 700 }}>Hologram Planety</div>
      <div style={{ fontSize: "var(--dv-fs-xs)", opacity: 0.82 }}>Pust me do prostoru</div>
    </div>
  );
}

function resolveDragCenter(event) {
  const translated = event?.active?.rect?.current?.translated;
  const initial = event?.active?.rect?.current?.initial;
  const rect = translated || initial;
  if (!rect) return null;
  return {
    x: Number(rect.left) + Number(rect.width) / 2,
    y: Number(rect.top) + Number(rect.height) / 2,
  };
}

function nextIdempotencyKey(prefix) {
  const safePrefix = String(prefix || "ui").trim() || "ui";
  if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") {
    return `${safePrefix}-${crypto.randomUUID()}`;
  }
  return `${safePrefix}-${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

function clamp(value, min, max) {
  return Math.max(min, Math.min(max, value));
}

export default function UniverseWorkspace({
  galaxy,
  branches = [],
  onboarding = null,
  onBackToGalaxies,
  onLogout,
  minimalShell = false,
}) {
  const galaxyId = String(galaxy?.id || "");

  const {
    snapshot,
    tables,
    loading,
    error,
    starRuntime,
    starDomains,
    starPolicy,
    starPhysicsProfile,
    starPlanetPhysicsByTableId,
    starPulseByEntity,
    starPulseLastEventSeq,
    setRuntimeError,
    clearRuntimeError,
    refreshProjection,
    refreshStarTelemetry,
  } = useUniverseRuntimeSync({ galaxyId });

  const [busy, setBusy] = useState(false);
  const [pendingCreate, setPendingCreate] = useState(false);
  const [pendingRowOps, setPendingRowOps] = useState({});
  const [selectedTableId, setSelectedTableId] = useState("");
  const [selectedAsteroidId, setSelectedAsteroidId] = useState("");
  const [linkDraft, setLinkDraft] = useState(null);
  const [hoveredLink, setHoveredLink] = useState(null);

  const [quickGridOpen, setQuickGridOpen] = useState(false);
  const [gridSearchQuery, setGridSearchQuery] = useState("");
  const [starControlPhase, setStarControlPhase] = useState(STAR_CONTROL_PHASE.IDLE);
  const [starProfileDraftKey, setStarProfileDraftKey] = useState("ORIGIN");
  const [starPhysicalProfileDraftKey, setStarPhysicalProfileDraftKey] = useState("BALANCE");
  const [starControlError, setStarControlError] = useState("");
  const [parserTelemetry, setParserTelemetry] = useState(() => createParserTelemetrySnapshot());
  const [stageZeroFlow, setStageZeroFlow] = useState(STAGE_ZERO_FLOW.INTRO);
  const [stageZeroDragging, setStageZeroDragging] = useState(false);
  const [stageZeroDropHover, setStageZeroDropHover] = useState(false);
  const [stageZeroCreating, setStageZeroCreating] = useState(false);
  const [stageZeroSetupOpen, setStageZeroSetupOpen] = useState(false);
  const [stageZeroPlanetName, setStageZeroPlanetName] = useState("");
  const [stageZeroPresetSelected, setStageZeroPresetSelected] = useState(false);
  const [stageZeroSchemaDraft, setStageZeroSchemaDraft] = useState({
    transactionName: false,
    amount: false,
    transactionType: false,
  });
  const [stageZeroCommitBusy, setStageZeroCommitBusy] = useState(false);
  const [workspaceUiHydrated, setWorkspaceUiHydrated] = useState(false);

  const layoutRef = useRef({ tablePositions: new Map(), asteroidPositions: new Map() });
  const workspaceRef = useRef(null);
  const dndSensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: { distance: 6 },
    })
  );

  useEffect(() => {
    const persistedUiState = readWorkspaceUiState(galaxyId);
    setPendingCreate(false);
    setPendingRowOps({});
    setSelectedTableId(String(persistedUiState.selectedTableId || ""));
    setSelectedAsteroidId("");
    setQuickGridOpen(Boolean(persistedUiState.quickGridOpen));
    setGridSearchQuery("");
    setLinkDraft(null);
    setHoveredLink(null);
    setStarControlPhase(STAR_CONTROL_PHASE.IDLE);
    setStarProfileDraftKey("ORIGIN");
    setStarPhysicalProfileDraftKey("BALANCE");
    setStarControlError("");
    setParserTelemetry(createParserTelemetrySnapshot());
    setStageZeroFlow(STAGE_ZERO_FLOW.INTRO);
    setStageZeroDragging(false);
    setStageZeroDropHover(false);
    setStageZeroCreating(false);
    setStageZeroSetupOpen(false);
    setStageZeroPlanetName("");
    setStageZeroPresetSelected(false);
    setStageZeroSchemaDraft({
      transactionName: false,
      amount: false,
      transactionType: false,
    });
    setStageZeroCommitBusy(false);
    setWorkspaceUiHydrated(true);
    layoutRef.current = { tablePositions: new Map(), asteroidPositions: new Map() };
  }, [galaxyId]);

  useEffect(() => {
    if (!workspaceUiHydrated) return;
    writeWorkspaceUiState(galaxyId, {
      selectedTableId,
      quickGridOpen,
    });
  }, [galaxyId, quickGridOpen, selectedTableId, workspaceUiHydrated]);

  const tableById = useMemo(
    () => new Map((Array.isArray(tables) ? tables : []).map((table) => [String(table.table_id), table])),
    [tables]
  );
  const starPolicyLocked = String(starPolicy?.lock_status || "").toLowerCase() === "locked";
  const hasPlanets = tables.length > 0;
  const stageZeroActive = !hasPlanets;
  const stageZeroRequiresStarLock = stageZeroActive && !starPolicyLocked;
  const stageZeroBuilderOpen =
    stageZeroActive &&
    !stageZeroRequiresStarLock &&
    (stageZeroFlow === STAGE_ZERO_FLOW.BLUEPRINT || stageZeroFlow === STAGE_ZERO_FLOW.BUILDING) &&
    !stageZeroCreating;
  const stageZeroDropMode = stageZeroBuilderOpen && stageZeroDragging;

  useEffect(() => {
    if (!tables.length) {
      setSelectedTableId("");
      setSelectedAsteroidId("");
      return;
    }
    if (!selectedTableId || !tableById.has(String(selectedTableId))) {
      const first = tables[0];
      setSelectedTableId(first?.table_id ? String(first.table_id) : "");
      setSelectedAsteroidId("");
    }
  }, [selectedTableId, tableById, tables]);

  useEffect(() => {
    if (!stageZeroActive) {
      setStageZeroDragging(false);
      setStageZeroDropHover(false);
      if (stageZeroFlow !== STAGE_ZERO_FLOW.COMPLETE) {
        setStageZeroFlow(STAGE_ZERO_FLOW.COMPLETE);
      }
      return;
    }
    if (quickGridOpen) {
      setQuickGridOpen(false);
    }
    if (stageZeroRequiresStarLock) {
      setStageZeroDragging(false);
      setStageZeroDropHover(false);
      setStageZeroSetupOpen(false);
      if (stageZeroFlow !== STAGE_ZERO_FLOW.INTRO) {
        setStageZeroFlow(STAGE_ZERO_FLOW.INTRO);
      }
      return;
    }
    if (stageZeroFlow === STAGE_ZERO_FLOW.COMPLETE) {
      setStageZeroFlow(STAGE_ZERO_FLOW.INTRO);
    }
  }, [quickGridOpen, stageZeroActive, stageZeroFlow, stageZeroRequiresStarLock]);

  const asteroidById = useMemo(
    () => new Map((Array.isArray(snapshot.asteroids) ? snapshot.asteroids : []).map((item) => [String(item.id), item])),
    [snapshot.asteroids]
  );
  const asteroidPhysicsById = useMemo(() => {
    const map = new Map();
    (Array.isArray(snapshot.asteroids) ? snapshot.asteroids : []).forEach((item) => {
      const id = String(item?.id || "").trim();
      if (!id) return;
      const physics = item?.physics && typeof item.physics === "object" ? item.physics : {};
      map.set(id, physics);
    });
    return map;
  }, [snapshot.asteroids]);
  const tablePhysicsById = useMemo(() => {
    const map = new Map();
    Object.entries(starPlanetPhysicsByTableId || {}).forEach(([tableId, runtime]) => {
      const visual = runtime?.visual && typeof runtime.visual === "object" ? runtime.visual : {};
      const metrics = runtime?.metrics && typeof runtime.metrics === "object" ? runtime.metrics : {};
      const sizeFactor = clamp(Number(visual.size_factor) || 1, 0.85, 2.4);
      const stress = clamp(Number(metrics.stress) || 0, 0, 1);
      const rows = Math.max(0, Number(metrics.rows) || 0);
      const massFactor = clamp(1 + stress * 0.75 + Math.log10(rows + 1) * 0.12, 0.9, 2.4);
      map.set(String(tableId), {
        radiusFactor: sizeFactor,
        massFactor,
      });
    });
    return map;
  }, [starPlanetPhysicsByTableId]);
  const domainMetricsByName = useMemo(() => {
    const map = new Map();
    (Array.isArray(starDomains) ? starDomains : []).forEach((domain) => {
      const name = String(domain?.domain_name || "").trim();
      if (!name) return;
      map.set(name, domain);
    });
    return map;
  }, [starDomains]);
  const starCoreProfile = useMemo(
    () =>
      resolveStarCoreProfile({
        starRuntime,
        starDomains,
        starPolicy,
        starPhysicsProfile,
      }),
    [starDomains, starPhysicsProfile, starPolicy, starRuntime]
  );
  const starCoreForCanvas = useMemo(
    () => ({
      ...starCoreProfile,
      lastEventSeq: Number.isFinite(Number(starPulseLastEventSeq)) ? Number(starPulseLastEventSeq) : 0,
    }),
    [starCoreProfile, starPulseLastEventSeq]
  );
  const starHeartOpen =
    starControlPhase === STAR_CONTROL_PHASE.STAR_HEART_DASHBOARD_OPEN ||
    starControlPhase === STAR_CONTROL_PHASE.APPLY_PROFILE ||
    starControlPhase === STAR_CONTROL_PHASE.LOCKED;

  useEffect(() => {
    const policyProfileKey = String(starPolicy?.profile_key || starCoreProfile?.profile?.key || "ORIGIN").toUpperCase();
    const policyPhysicalKey = String(starPhysicsProfile?.profile_key || starCoreProfile?.physicalProfile?.key || "BALANCE").toUpperCase();
    if (starPolicyLocked || starControlPhase === STAR_CONTROL_PHASE.IDLE) {
      setStarProfileDraftKey(policyProfileKey);
      setStarPhysicalProfileDraftKey(policyPhysicalKey);
    }
    if (starPolicyLocked) {
      setStarControlPhase((prev) => {
        if (prev === STAR_CONTROL_PHASE.IDLE) return prev;
        return STAR_CONTROL_PHASE.LOCKED;
      });
    }
  }, [
    starControlPhase,
    starCoreProfile?.physicalProfile?.key,
    starCoreProfile?.profile?.key,
    starPhysicsProfile?.profile_key,
    starPolicy?.profile_key,
    starPolicyLocked,
  ]);

  useEffect(() => {
    if (!selectedAsteroidId) return;
    if (!asteroidById.has(String(selectedAsteroidId))) {
      setSelectedAsteroidId("");
    }
  }, [asteroidById, selectedAsteroidId]);

  const layout = useMemo(
    () =>
      calculateHierarchyLayout({
        tables,
        selectedTableId,
        asteroidById,
        tablePhysicsById,
        asteroidPhysicsById,
        previous: layoutRef.current,
      }),
    [asteroidById, asteroidPhysicsById, selectedTableId, tablePhysicsById, tables]
  );

  useEffect(() => {
    layoutRef.current = {
      tablePositions: layout.tablePositions,
      asteroidPositions: layout.asteroidPositions,
    };
  }, [layout]);

  const tableNodes = useMemo(
    () =>
      layout.tableNodes.map((node) => {
        const runtimePulse = starPulseByEntity[String(node.id)] || null;
        const runtimeDomain = domainMetricsByName.get(String(node.entityName || "")) || null;
        const runtimePlanetPhysics = starPlanetPhysicsByTableId[String(node.id)] || null;
        const resolved = resolveEntityLaws({
          kind: "planet",
          basePhysics: node.physics || {},
          domainMetric: runtimeDomain,
          pulse: runtimePulse,
        });
        const metrics = runtimePlanetPhysics?.metrics && typeof runtimePlanetPhysics.metrics === "object" ? runtimePlanetPhysics.metrics : {};
        const visual = runtimePlanetPhysics?.visual && typeof runtimePlanetPhysics.visual === "object" ? runtimePlanetPhysics.visual : {};
        const health = clamp(Number(metrics.health) || 0, 0, 1);
        const corrosion = clamp(Number(metrics.corrosion) || 0, 0, 1);
        const backendPhysics = runtimePlanetPhysics
          ? {
              stress: clamp(Number(metrics.stress) || resolved.physics?.stress || 0, 0, 1),
              radiusFactor: clamp(Number(visual.size_factor) || 1, 0.85, 2.4),
              pulseFactor: clamp(Number(visual.pulse_rate) || resolved.physics?.pulseFactor || 1, 0.82, 2.4),
              emissiveBoost: clamp(Number(visual.luminosity) || resolved.physics?.emissiveBoost || 0, 0, 1),
              auraFactor: clamp(1 + (1 - health) * 0.5 + corrosion * 0.3, 0.9, 2.2),
              alertPressure: clamp(corrosion * 0.7 + (1 - health) * 0.3, 0, 1),
              corrosionLevel: clamp(Number(visual.corrosion_level) || corrosion, 0, 1),
              crackIntensity: clamp(Number(visual.crack_intensity) || 0, 0, 1),
              hue: clamp(Number(visual.hue) || 0, 0, 1),
              saturation: clamp(Number(visual.saturation) || 0, 0, 1),
            }
          : {};
        const backendStatus = runtimePlanetPhysics?.phase ? String(runtimePlanetPhysics.phase).toUpperCase() : null;
        return {
          ...node,
          position: layout.tablePositions.get(node.id) || [0, 0, 0],
          runtimePulse,
          runtimeDomain,
          runtimePlanetPhysics,
          v1: {
            ...resolved.v1,
            ...(backendStatus ? { status: backendStatus } : {}),
            quality_score: runtimePlanetPhysics ? Math.round(health * 100) : resolved.v1?.quality_score || 100,
          },
          physics: {
            ...resolved.physics,
            ...backendPhysics,
          },
        };
      }),
    [domainMetricsByName, layout, starPlanetPhysicsByTableId, starPulseByEntity]
  );

  const asteroidNodes = useMemo(
    () => {
      const selectedPlanetRuntime = selectedTableId ? starPlanetPhysicsByTableId[String(selectedTableId)] || null : null;
      const selectedMetrics =
        selectedPlanetRuntime?.metrics && typeof selectedPlanetRuntime.metrics === "object"
          ? selectedPlanetRuntime.metrics
          : {};
      const selectedVisual =
        selectedPlanetRuntime?.visual && typeof selectedPlanetRuntime.visual === "object"
          ? selectedPlanetRuntime.visual
          : {};
      const parentPhase = selectedPlanetRuntime?.phase ? String(selectedPlanetRuntime.phase).toUpperCase() : null;
      const parentCorrosion = clamp(
        Number(selectedVisual.corrosion_level ?? selectedMetrics.corrosion ?? 0) || 0,
        0,
        1
      );
      const parentCrack = clamp(Number(selectedVisual.crack_intensity) || 0, 0, 1);
      const parentHue = clamp(Number(selectedVisual.hue) || 0, 0, 1);
      const parentSaturation = clamp(Number(selectedVisual.saturation) || 0, 0, 1);
      return layout.asteroidNodes.map((node) => {
        const runtimePulse = starPulseByEntity[String(node.id)] || null;
        const runtimeDomain = domainMetricsByName.get(String(node.entityName || "")) || null;
        const resolved = resolveEntityLaws({
          kind: "moon",
          basePhysics: node.physics || {},
          domainMetric: runtimeDomain,
          pulse: runtimePulse,
        });
        const enrichedPhysics = {
          ...resolved.physics,
          corrosionLevel: parentCorrosion,
          crackIntensity: clamp(parentCrack * 0.8 + (resolved.physics?.stress || 0) * 0.2, 0, 1),
          hue: parentHue,
          saturation: parentSaturation,
        };
        return {
          ...node,
          position: layout.asteroidPositions.get(node.id) || [0, 0, 0],
          runtimePulse,
          runtimeDomain,
          parentPhase,
          v1: {
            ...resolved.v1,
            ...(parentPhase ? { status: parentPhase } : {}),
          },
          physics: enrichedPhysics,
        };
      });
    },
    [domainMetricsByName, layout, selectedTableId, starPlanetPhysicsByTableId, starPulseByEntity]
  );
  const tableNodeById = useMemo(() => new Map(tableNodes.map((node) => [String(node.id), node])), [tableNodes]);
  const asteroidNodeById = useMemo(() => new Map(asteroidNodes.map((node) => [String(node.id), node])), [asteroidNodes]);
  const tableLinks = useMemo(
    () =>
      (layout.tableLinks || []).map((link) => {
        const source = tableNodeById.get(String(link.source));
        const target = tableNodeById.get(String(link.target));
        const linkPulse = starPulseByEntity[String(link.id)] || null;
        const sourcePhase = String(source?.runtimePlanetPhysics?.phase || source?.v1?.status || "").toUpperCase();
        const targetPhase = String(target?.runtimePlanetPhysics?.phase || target?.v1?.status || "").toUpperCase();
        const sourceCorrosionLevel = clamp(Number(source?.physics?.corrosionLevel) || 0, 0, 1);
        const targetCorrosionLevel = clamp(Number(target?.physics?.corrosionLevel) || 0, 0, 1);
        return {
          ...link,
          source_phase: sourcePhase,
          target_phase: targetPhase,
          source_corrosion_level: sourceCorrosionLevel,
          target_corrosion_level: targetCorrosionLevel,
          runtimePulse: linkPulse,
          physics: resolveLinkLaws({
            kind: "table",
            basePhysics: {
              ...(link.physics || {}),
              sourcePhase,
              targetPhase,
              sourceCorrosionLevel,
              targetCorrosionLevel,
            },
            sourceDomainMetric: source?.runtimeDomain || null,
            targetDomainMetric: target?.runtimeDomain || null,
            linkPulse,
          }),
        };
      }),
    [layout.tableLinks, starPulseByEntity, tableNodeById]
  );
  const asteroidLinks = useMemo(
    () =>
      (layout.asteroidLinks || []).map((link) => {
        const sourceNode = asteroidNodeById.get(String(link.source)) || null;
        const targetNode = asteroidNodeById.get(String(link.target)) || null;
        const sourcePulse = starPulseByEntity[String(link.source)] || null;
        const targetPulse = starPulseByEntity[String(link.target)] || null;
        const linkPulse = starPulseByEntity[String(link.id)] || null;
        const sourcePhase = String(sourceNode?.parentPhase || sourceNode?.v1?.status || "").toUpperCase();
        const targetPhase = String(targetNode?.parentPhase || targetNode?.v1?.status || "").toUpperCase();
        const sourceCorrosionLevel = clamp(Number(sourceNode?.physics?.corrosionLevel) || 0, 0, 1);
        const targetCorrosionLevel = clamp(Number(targetNode?.physics?.corrosionLevel) || 0, 0, 1);
        return {
          ...link,
          source_phase: sourcePhase,
          target_phase: targetPhase,
          source_corrosion_level: sourceCorrosionLevel,
          target_corrosion_level: targetCorrosionLevel,
          runtimePulse: linkPulse,
          physics: resolveLinkLaws({
            kind: "moon",
            basePhysics: {
              ...(link.physics || {}),
              sourcePhase,
              targetPhase,
              sourceCorrosionLevel,
              targetCorrosionLevel,
            },
            sourceDomainMetric: sourceNode?.runtimeDomain || null,
            targetDomainMetric: targetNode?.runtimeDomain || null,
            sourcePulse,
            targetPulse,
            linkPulse,
          }),
        };
      }),
    [asteroidNodeById, layout.asteroidLinks, starPulseByEntity]
  );

  const selectedTable = useMemo(
    () => (selectedTableId ? tableById.get(String(selectedTableId)) || null : null),
    [selectedTableId, tableById]
  );

  const tableRows = useMemo(() => {
    if (!selectedTableId) return [];
    return (snapshot.asteroids || [])
      .filter((item) => String(item.table_id) === String(selectedTableId))
      .sort((a, b) => String(a.id).localeCompare(String(b.id)));
  }, [selectedTableId, snapshot.asteroids]);

  const gridColumns = useMemo(() => collectGridColumns(tableRows), [tableRows]);

  const gridFilteredRows = useMemo(() => {
    const query = normalizeText(gridSearchQuery);
    if (!query) return tableRows;
    return tableRows.filter((row) =>
      gridColumns.some((column) => normalizeText(readGridCell(row, column)).includes(query))
    );
  }, [gridColumns, gridSearchQuery, tableRows]);

  const selectedAsteroidLabel = useMemo(() => {
    if (!selectedAsteroidId) return "";
    const asteroid = asteroidById.get(String(selectedAsteroidId));
    return asteroid ? valueToLabel(asteroid.value) : "";
  }, [asteroidById, selectedAsteroidId]);

  const level = selectedTableId ? 3 : 2;
  const parserExecutionMode = PARSER_EXECUTION_MODE;

  const handleStageZeroDropPlanet = useCallback(
    async (dropPayload) => {
      if (!galaxyId || stageZeroCreating || !stageZeroActive || stageZeroRequiresStarLock) return;
      const visualPosition = mapDropPointToPlanetPosition(dropPayload, dropPayload?.viewport);
      const suffix = Math.random().toString(36).slice(2, 6);
      const planetName = buildStageZeroPlanetName({ existingCount: tableNodes.length, suffix });

      setStageZeroCreating(true);
      setBusy(true);
      clearRuntimeError();
      try {
        const response = await apiFetch(`${API_BASE}/planets`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            name: planetName,
            archetype: "catalog",
            initial_schema_mode: "empty",
            seed_rows: false,
            visual_position: visualPosition,
            galaxy_id: galaxyId,
            idempotency_key: nextIdempotencyKey("planet-stage0"),
          }),
        });
        if (!response.ok) {
          throw await apiErrorFromResponse(response, `Planetu se nepodarilo vytvorit: ${response.status}`);
        }
        const body = await response.json().catch(() => ({}));
        const tableId = body?.table_id ? String(body.table_id) : "";

        await refreshProjection({ silent: true });
        if (tableId) {
          setSelectedTableId(tableId);
        }
        setStageZeroPlanetName(planetName);
        setStageZeroFlow(STAGE_ZERO_FLOW.COMPLETE);
        setStageZeroPresetSelected(false);
        setStageZeroSchemaDraft({
          transactionName: false,
          amount: false,
          transactionType: false,
        });
        setStageZeroSetupOpen(true);
      } catch (createError) {
        setRuntimeError(createError?.message || "Planetu se nepodarilo vytvorit.");
        setStageZeroFlow(STAGE_ZERO_FLOW.BLUEPRINT);
      } finally {
        setStageZeroCreating(false);
        setStageZeroDragging(false);
        setStageZeroDropHover(false);
        setBusy(false);
      }
    },
    [
      clearRuntimeError,
      galaxyId,
      refreshProjection,
      setRuntimeError,
      stageZeroActive,
      stageZeroCreating,
      stageZeroRequiresStarLock,
      tableNodes.length,
    ]
  );

  const handleStageZeroDndStart = useCallback(
    (event) => {
      if (!stageZeroBuilderOpen) return;
      if (String(event?.active?.id || "") !== STAGE_ZERO_DND.PLANET_ITEM) return;
      setStageZeroDragging(true);
      setStageZeroDropHover(false);
      setStageZeroFlow(STAGE_ZERO_FLOW.BUILDING);
    },
    [stageZeroBuilderOpen]
  );

  const handleStageZeroDndOver = useCallback((event) => {
    const overId = String(event?.over?.id || "");
    setStageZeroDropHover(overId === STAGE_ZERO_DND.CANVAS_DROP_ZONE);
  }, []);

  const handleStageZeroDndCancel = useCallback(() => {
    setStageZeroDragging(false);
    setStageZeroDropHover(false);
    if (!stageZeroCreating) {
      setStageZeroFlow(STAGE_ZERO_FLOW.BLUEPRINT);
    }
  }, [stageZeroCreating]);

  const handleStageZeroDndEnd = useCallback(
    (event) => {
      const overId = String(event?.over?.id || "");
      const isPlanetDrag = String(event?.active?.id || "") === STAGE_ZERO_DND.PLANET_ITEM;
      const isValidDrop = isPlanetDrag && overId === STAGE_ZERO_DND.CANVAS_DROP_ZONE;

      setStageZeroDragging(false);
      setStageZeroDropHover(false);
      if (!isValidDrop) {
        if (!stageZeroCreating) {
          setStageZeroFlow(STAGE_ZERO_FLOW.BLUEPRINT);
        }
        return;
      }

      const center = resolveDragCenter(event);
      const viewportRect = workspaceRef.current?.getBoundingClientRect?.();
      const viewport = viewportRect
        ? {
            left: viewportRect.left,
            top: viewportRect.top,
            width: viewportRect.width,
            height: viewportRect.height,
          }
        : {
            left: 0,
            top: 0,
            width: typeof window !== "undefined" ? window.innerWidth : 1,
            height: typeof window !== "undefined" ? window.innerHeight : 1,
          };
      const fallbackPoint = {
        x: viewport.left + viewport.width * 0.5,
        y: viewport.top + viewport.height * 0.5,
      };
      void handleStageZeroDropPlanet({
        ...(center || fallbackPoint),
        viewport,
      });
    },
    [handleStageZeroDropPlanet, stageZeroCreating]
  );

  const stageZeroAllSchemaStepsDone =
    stageZeroSchemaDraft.transactionName && stageZeroSchemaDraft.amount && stageZeroSchemaDraft.transactionType;
  const stageZeroSchemaPreview = [
    { key: "transactionName", label: "transaction_name", type: "text", done: stageZeroSchemaDraft.transactionName },
    { key: "amount", label: "amount", type: "number", done: stageZeroSchemaDraft.amount },
    { key: "transactionType", label: "transaction_type", type: "enum(INCOME|EXPENSE)", done: stageZeroSchemaDraft.transactionType },
  ];

  const handleStageZeroSchemaStep = useCallback((key) => {
    if (!stageZeroPresetSelected) return;
    setStageZeroSchemaDraft((prev) => ({ ...prev, [key]: true }));
  }, [stageZeroPresetSelected]);

  const loadTableContract = useCallback(
    async (tableId) => {
      const targetTableId = String(tableId || "").trim();
      if (!galaxyId || !targetTableId) return null;
      const contractRead = await apiFetch(buildTableContractUrl(API_BASE, targetTableId, galaxyId));
      if (!contractRead.ok) {
        throw await apiErrorFromResponse(contractRead, `Kontrakt planety nelze nacist: ${contractRead.status}`);
      }
      return contractRead.json();
    },
    [galaxyId]
  );

  const handleStageZeroCommitPreset = useCallback(async () => {
    if (!galaxyId || !selectedTableId || !selectedTable || !stageZeroAllSchemaStepsDone || stageZeroCommitBusy) return;
    setStageZeroCommitBusy(true);
    setBusy(true);
    clearRuntimeError();
    try {
      const currentContract = await loadTableContract(selectedTableId);
      const nextFieldTypes = {
        value: "string",
        transaction_name: "string",
        amount: "number",
        transaction_type: "string",
      };
      const requiredFields = ["transaction_name", "amount", "transaction_type"];
      const nextPayload = {
        galaxy_id: galaxyId,
        required_fields: requiredFields,
        field_types: nextFieldTypes,
        unique_rules: [],
        validators: [],
        auto_semantics: [],
        schema_registry: {
          required_fields: requiredFields,
          field_types: nextFieldTypes,
          unique_rules: [],
          validators: [],
          auto_semantics: [],
        },
        formula_registry: Array.isArray(currentContract?.formula_registry) ? currentContract.formula_registry : [],
        physics_rulebook:
          currentContract?.physics_rulebook && typeof currentContract.physics_rulebook === "object"
            ? currentContract.physics_rulebook
            : { rules: [], defaults: {} },
      };
      const contractWrite = await apiFetch(`${API_BASE}/contracts/${selectedTableId}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(nextPayload),
      });
      if (!contractWrite.ok) {
        throw await apiErrorFromResponse(contractWrite, `Schema se nepodarilo ulozit: ${contractWrite.status}`);
      }

      const rows = [
        { name: "Salary", amount: 48000, type: "INCOME" },
        { name: "Rent", amount: -17000, type: "EXPENSE" },
        { name: "Groceries", amount: -4200, type: "EXPENSE" },
      ];
      for (const row of rows) {
        const minerals = {
          ...buildMoonCreateMinerals({ label: row.name, contract: nextPayload }),
          transaction_name: row.name,
          amount: row.amount,
          transaction_type: row.type,
        };
        const ingest = await apiFetch(buildMoonCreateUrl(API_BASE), {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            label: row.name,
            minerals,
            planet_id: selectedTableId,
            galaxy_id: galaxyId,
            idempotency_key: nextIdempotencyKey("stage0-seed"),
          }),
        });
        if (!ingest.ok) {
          throw await apiErrorFromResponse(ingest, `Seed dat selhal: ${ingest.status}`);
        }
      }

      await refreshProjection({ silent: true });
      setStageZeroSetupOpen(false);
      setQuickGridOpen(true);
    } catch (commitError) {
      setRuntimeError(commitError?.message || "Preset se nepodarilo aplikovat.");
    } finally {
      setStageZeroCommitBusy(false);
      setBusy(false);
    }
  }, [
    clearRuntimeError,
    galaxyId,
    loadTableContract,
    refreshProjection,
    selectedTable,
    selectedTableId,
    setRuntimeError,
    stageZeroAllSchemaStepsDone,
    stageZeroCommitBusy,
  ]);

  const executeParserCommand = useCallback(
    async (command) => {
      const trimmed = String(command || "").trim();
      if (!trimmed || !galaxyId) {
        throw new Error("Parser command is empty.");
      }
      const response = await apiFetch(`${API_BASE}/parser/execute`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(buildParserPayload(trimmed, galaxyId)),
      });
      if (!response.ok) {
        throw await apiErrorFromResponse(response, `Parser command failed: ${response.status}`);
      }
      return response.json().catch(() => ({}));
    },
    [galaxyId]
  );
  const trackParserAttempt = useCallback((details) => {
    setParserTelemetry((prev) => recordParserTelemetry(prev, details));
  }, []);

  const handleCreateLink = useCallback(
    async (payload) => {
      if (!galaxyId || !payload?.sourceId || !payload?.targetId) return;
      if (String(payload.sourceId) === String(payload.targetId)) return;

      const sourceAsteroid = asteroidById.get(String(payload.sourceId));
      const targetAsteroid = asteroidById.get(String(payload.targetId));
      const expectedSourceEventSeq = Number.isInteger(sourceAsteroid?.current_event_seq)
        ? Number(sourceAsteroid.current_event_seq)
        : null;
      const expectedTargetEventSeq = Number.isInteger(targetAsteroid?.current_event_seq)
        ? Number(targetAsteroid.current_event_seq)
        : null;
      let parserAttempted = false;
      let fallbackAttempted = false;
      let parserFailure = null;
      let parserTelemetryRecorded = false;

      setBusy(true);
      clearRuntimeError();
      try {
        const parserCommand = buildLinkMoonsCommand({
          sourceId: payload.sourceId,
          targetId: payload.targetId,
        });
        if (parserCommand) {
          parserAttempted = true;
          try {
            await executeParserCommand(parserCommand);
            trackParserAttempt({ action: "LINK", parserOk: true });
            parserTelemetryRecorded = true;
            await refreshProjection({ silent: true });
            return;
          } catch (parserError) {
            parserFailure = parserError;
            if (parserExecutionMode.link) {
              throw parserError;
            }
          }
        }

        fallbackAttempted = true;
        const response = await apiFetch(`${API_BASE}/bonds/link`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            source_id: payload.sourceId,
            target_id: payload.targetId,
            type: "RELATION",
            galaxy_id: galaxyId,
            idempotency_key: nextIdempotencyKey("link"),
            ...(expectedSourceEventSeq !== null ? { expected_source_event_seq: expectedSourceEventSeq } : {}),
            ...(expectedTargetEventSeq !== null ? { expected_target_event_seq: expectedTargetEventSeq } : {}),
          }),
        });
        if (!response.ok) {
          throw await apiErrorFromResponse(response, `Vazba se nepodarila vytvorit: ${response.status}`);
        }
        if (parserAttempted) {
          trackParserAttempt({
            action: "LINK",
            parserOk: false,
            parserError: parserFailure,
            fallbackUsed: true,
            fallbackOk: true,
          });
          parserTelemetryRecorded = true;
        }
        await refreshProjection({ silent: true });
      } catch (createError) {
        if (parserAttempted && !parserTelemetryRecorded) {
          trackParserAttempt({
            action: "LINK",
            parserOk: false,
            parserError: parserFailure || createError,
            fallbackUsed: fallbackAttempted,
            fallbackOk: fallbackAttempted ? false : null,
          });
          parserTelemetryRecorded = true;
        }
        if (isOccConflictError(createError)) {
          setRuntimeError(buildOccConflictMessage(createError, "vytvoreni vazby"));
          await refreshProjection({ silent: true });
        } else {
          setRuntimeError(createError?.message || "Vazbu se nepodarilo vytvorit.");
        }
      } finally {
        setBusy(false);
      }
    },
    [
      asteroidById,
      clearRuntimeError,
      executeParserCommand,
      galaxyId,
      parserExecutionMode,
      refreshProjection,
      setRuntimeError,
      trackParserAttempt,
    ]
  );

  const handleCreateRow = useCallback(
    async (value) => {
      if (!galaxyId || !selectedTableId) return false;
      const trimmed = String(value || "").trim();
      if (!trimmed) return false;
      let parserAttempted = false;
      let fallbackAttempted = false;
      let parserFailure = null;
      let parserTelemetryRecorded = false;

      setBusy(true);
      setPendingCreate(true);
      clearRuntimeError();
      try {
        const parserCommand = buildIngestMoonCommand({
          value: trimmed,
          tableName: selectedTable?.name || tableDisplayName(selectedTable),
        });
        if (parserCommand) {
          parserAttempted = true;
          try {
            const parserBody = await executeParserCommand(parserCommand);
            const parserAsteroids = Array.isArray(parserBody?.asteroids) ? parserBody.asteroids : [];
            const asteroidId = parserAsteroids[0]?.id ? String(parserAsteroids[0].id) : "";
            trackParserAttempt({ action: "INGEST", parserOk: true });
            parserTelemetryRecorded = true;
            await refreshProjection({ silent: true });
            if (asteroidId) {
              setSelectedAsteroidId(asteroidId);
            }
            return true;
          } catch (parserError) {
            parserFailure = parserError;
            if (parserExecutionMode.ingest) {
              throw parserError;
            }
          }
        }

        fallbackAttempted = true;
        const tableContract = await loadTableContract(selectedTableId);
        const minerals = buildMoonCreateMinerals({
          label: trimmed,
          contract: tableContract,
        });
        const response = await apiFetch(buildMoonCreateUrl(API_BASE), {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            label: trimmed,
            minerals,
            planet_id: selectedTableId,
            galaxy_id: galaxyId,
            idempotency_key: nextIdempotencyKey("ingest"),
          }),
        });
        if (!response.ok) {
          throw await apiErrorFromResponse(response, `Mesic se nepodarilo vytvorit: ${response.status}`);
        }
        const payload = await response.json().catch(() => ({}));
        const asteroidId = payload?.moon_id ? String(payload.moon_id) : "";
        if (parserAttempted) {
          trackParserAttempt({
            action: "INGEST",
            parserOk: false,
            parserError: parserFailure,
            fallbackUsed: true,
            fallbackOk: true,
          });
          parserTelemetryRecorded = true;
        }

        await refreshProjection({ silent: true });
        if (asteroidId) {
          setSelectedAsteroidId(asteroidId);
        }
        return true;
      } catch (createError) {
        if (parserAttempted && !parserTelemetryRecorded) {
          trackParserAttempt({
            action: "INGEST",
            parserOk: false,
            parserError: parserFailure || createError,
            fallbackUsed: fallbackAttempted,
            fallbackOk: fallbackAttempted ? false : null,
          });
          parserTelemetryRecorded = true;
        }
        setRuntimeError(createError?.message || "Mesic se nepodarilo vytvorit.");
        return false;
      } finally {
        setPendingCreate(false);
        setBusy(false);
      }
    },
    [
      clearRuntimeError,
      executeParserCommand,
      galaxyId,
      loadTableContract,
      parserExecutionMode,
      refreshProjection,
      selectedTable,
      selectedTableId,
      setRuntimeError,
      trackParserAttempt,
    ]
  );

  const handleUpdateRow = useCallback(
    async (asteroidId, value) => {
      const targetId = String(asteroidId || "").trim();
      if (!galaxyId || !targetId) return;

      const asteroid = asteroidById.get(targetId);
      if (!asteroid) return;
      const expectedEventSeq = Number.isInteger(asteroid?.current_event_seq) ? Number(asteroid.current_event_seq) : null;

      setBusy(true);
      setPendingRowOps((prev) => ({ ...prev, [targetId]: "mutate" }));
      clearRuntimeError();
      try {
        const response = await apiFetch(buildMoonMutateUrl(API_BASE, targetId), {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            label: value,
            galaxy_id: galaxyId,
            idempotency_key: nextIdempotencyKey("mutate"),
            ...(expectedEventSeq !== null ? { expected_event_seq: expectedEventSeq } : {}),
          }),
        });
        if (!response.ok) {
          throw await apiErrorFromResponse(response, `Mesic se nepodarilo upravit: ${response.status}`);
        }
        await refreshProjection({ silent: true });
      } catch (updateError) {
        if (isOccConflictError(updateError)) {
          setRuntimeError(buildOccConflictMessage(updateError, "uprava mesice"));
          await refreshProjection({ silent: true });
        } else {
          setRuntimeError(updateError?.message || "Mesic se nepodarilo upravit.");
        }
      } finally {
        setPendingRowOps((prev) => {
          const next = { ...prev };
          delete next[targetId];
          return next;
        });
        setBusy(false);
      }
    },
    [asteroidById, clearRuntimeError, galaxyId, refreshProjection, setRuntimeError]
  );

  const handleDeleteRow = useCallback(
    async (asteroidId) => {
      const targetId = String(asteroidId || "").trim();
      if (!galaxyId || !targetId) return;

      const asteroid = asteroidById.get(targetId);
      if (!asteroid) return;
      const expectedEventSeq = Number.isInteger(asteroid?.current_event_seq) ? Number(asteroid.current_event_seq) : null;
      let parserAttempted = false;
      let fallbackAttempted = false;
      let parserFailure = null;
      let parserTelemetryRecorded = false;

      setBusy(true);
      setPendingRowOps((prev) => ({ ...prev, [targetId]: "extinguish" }));
      clearRuntimeError();
      try {
        const parserCommand = buildExtinguishMoonCommand({
          asteroidId: targetId,
          asteroidLabel: asteroid?.value,
        });
        if (parserCommand) {
          parserAttempted = true;
          try {
            await executeParserCommand(parserCommand);
            trackParserAttempt({ action: "EXTINGUISH", parserOk: true });
            parserTelemetryRecorded = true;
            await refreshProjection({ silent: true });
            if (String(selectedAsteroidId) === targetId) {
              setSelectedAsteroidId("");
            }
            return;
          } catch (parserError) {
            parserFailure = parserError;
            if (parserExecutionMode.extinguish) {
              throw parserError;
            }
          }
        }

        fallbackAttempted = true;
        const url = new URL(buildMoonExtinguishUrl(API_BASE, targetId));
        url.searchParams.set("galaxy_id", galaxyId);
        url.searchParams.set("idempotency_key", nextIdempotencyKey("extinguish"));
        if (expectedEventSeq !== null) {
          url.searchParams.set("expected_event_seq", String(expectedEventSeq));
        }

        const response = await apiFetch(url.toString(), {
          method: "PATCH",
        });
        if (!response.ok) {
          throw await apiErrorFromResponse(response, `Mesic se nepodarilo zhasnout: ${response.status}`);
        }
        if (parserAttempted) {
          trackParserAttempt({
            action: "EXTINGUISH",
            parserOk: false,
            parserError: parserFailure,
            fallbackUsed: true,
            fallbackOk: true,
          });
          parserTelemetryRecorded = true;
        }

        await refreshProjection({ silent: true });
        if (String(selectedAsteroidId) === targetId) {
          setSelectedAsteroidId("");
        }
      } catch (deleteError) {
        if (parserAttempted && !parserTelemetryRecorded) {
          trackParserAttempt({
            action: "EXTINGUISH",
            parserOk: false,
            parserError: parserFailure || deleteError,
            fallbackUsed: fallbackAttempted,
            fallbackOk: fallbackAttempted ? false : null,
          });
          parserTelemetryRecorded = true;
        }
        if (isOccConflictError(deleteError)) {
          setRuntimeError(buildOccConflictMessage(deleteError, "zhasnuti mesice"));
          await refreshProjection({ silent: true });
        } else {
          setRuntimeError(deleteError?.message || "Mesic se nepodarilo zhasnout.");
        }
      } finally {
        setPendingRowOps((prev) => {
          const next = { ...prev };
          delete next[targetId];
          return next;
        });
        setBusy(false);
      }
    },
    [
      asteroidById,
      clearRuntimeError,
      executeParserCommand,
      galaxyId,
      parserExecutionMode,
      refreshProjection,
      selectedAsteroidId,
      setRuntimeError,
      trackParserAttempt,
    ]
  );

  const handleUpsertMetadata = useCallback(
    async (asteroidId, key, rawValue) => {
      const targetId = String(asteroidId || "").trim();
      const metadataKey = String(key || "").trim();
      if (!galaxyId || !targetId || !metadataKey) return false;

      const asteroid = asteroidById.get(targetId);
      if (!asteroid) return false;
      const expectedEventSeq = Number.isInteger(asteroid?.current_event_seq) ? Number(asteroid.current_event_seq) : null;
      const currentMetadata = asteroid?.metadata && typeof asteroid.metadata === "object" ? asteroid.metadata : {};
      const nextMetadata = mergeMetadataValue(currentMetadata, metadataKey, rawValue);

      setBusy(true);
      setPendingRowOps((prev) => ({ ...prev, [targetId]: "metadata" }));
      clearRuntimeError();
      try {
        const response = await apiFetch(buildMoonMutateUrl(API_BASE, targetId), {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            minerals: nextMetadata,
            galaxy_id: galaxyId,
            idempotency_key: nextIdempotencyKey("metadata"),
            ...(expectedEventSeq !== null ? { expected_event_seq: expectedEventSeq } : {}),
          }),
        });
        if (!response.ok) {
          throw await apiErrorFromResponse(response, `Nerost se nepodarilo ulozit: ${response.status}`);
        }
        await refreshProjection({ silent: true });
        return true;
      } catch (metadataError) {
        if (isOccConflictError(metadataError)) {
          setRuntimeError(buildOccConflictMessage(metadataError, "uprava nerostu"));
          await refreshProjection({ silent: true });
        } else {
          setRuntimeError(metadataError?.message || "Nerost se nepodarilo ulozit.");
        }
        return false;
      } finally {
        setPendingRowOps((prev) => {
          const next = { ...prev };
          delete next[targetId];
          return next;
        });
        setBusy(false);
      }
    },
    [asteroidById, clearRuntimeError, galaxyId, refreshProjection, setRuntimeError]
  );

  const handleStarSelect = useCallback(() => {
    if (starPolicyLocked) {
      setStarControlPhase(STAR_CONTROL_PHASE.LOCKED);
      setStarControlError("");
      return;
    }
    setStarControlError("");
    setStarControlPhase((prev) => {
      if (prev === STAR_CONTROL_PHASE.IDLE) return STAR_CONTROL_PHASE.STAR_FOCUSED;
      if (prev === STAR_CONTROL_PHASE.STAR_FOCUSED) return STAR_CONTROL_PHASE.STAR_HEART_DASHBOARD_OPEN;
      return prev;
    });
  }, [starPolicyLocked]);

  const handleOpenStarHeartDashboard = useCallback(() => {
    setStarControlError("");
    setStarControlPhase(starPolicyLocked ? STAR_CONTROL_PHASE.LOCKED : STAR_CONTROL_PHASE.STAR_HEART_DASHBOARD_OPEN);
  }, [starPolicyLocked]);

  const handleCloseStarHeartDashboard = useCallback(() => {
    setStarControlPhase(STAR_CONTROL_PHASE.IDLE);
  }, []);

  const handleClearStarFocus = useCallback(() => {
    setStarControlPhase((prev) => (prev === STAR_CONTROL_PHASE.STAR_FOCUSED ? STAR_CONTROL_PHASE.IDLE : prev));
  }, []);

  const handleApplyStarProfileLock = useCallback(async () => {
    if (!galaxyId) return;
    if (starPolicyLocked) {
      setStarControlPhase(STAR_CONTROL_PHASE.LOCKED);
      return;
    }
    setStarControlError("");
    setStarControlPhase(STAR_CONTROL_PHASE.APPLY_PROFILE);
    clearRuntimeError();
    try {
      const response = await apiFetch(buildStarCorePolicyLockUrl(API_BASE, galaxyId), {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          profile_key: starProfileDraftKey,
          physical_profile_key: starPhysicalProfileDraftKey,
          physical_profile_version: Math.max(1, Number(starPhysicsProfile?.profile_version || 1)),
          lock_after_apply: true,
        }),
      });
      if (!response.ok) {
        throw await apiErrorFromResponse(response, `Star Core lock selhal: ${response.status}`);
      }
      await response.json().catch(() => null);
      await refreshStarTelemetry({ force: true });
      setStarControlPhase(STAR_CONTROL_PHASE.LOCKED);
    } catch (applyError) {
      if (isOccConflictError(applyError)) {
        setRuntimeError(buildOccConflictMessage(applyError, "lock star core"));
      } else {
        const message = applyError?.message || "Star Core profil se nepodarilo uzamknout.";
        setStarControlError(message);
      }
      await refreshStarTelemetry({ force: true });
      setStarControlPhase(starPolicyLocked ? STAR_CONTROL_PHASE.LOCKED : STAR_CONTROL_PHASE.STAR_HEART_DASHBOARD_OPEN);
    }
  }, [
    clearRuntimeError,
    galaxyId,
    refreshStarTelemetry,
    setRuntimeError,
    starPhysicalProfileDraftKey,
    starPhysicsProfile?.profile_version,
    starPolicyLocked,
    starProfileDraftKey,
  ]);

  const selectedTableLabel = selectedTable ? `Tabulka: ${tableDisplayName(selectedTable)}` : "";

  return (
    <main ref={workspaceRef} style={{ width: "100vw", height: "100vh", position: "relative", overflow: "hidden", background: "#020205" }}>
      <DndContext
        sensors={dndSensors}
        onDragStart={handleStageZeroDndStart}
        onDragOver={handleStageZeroDndOver}
        onDragEnd={handleStageZeroDndEnd}
        onDragCancel={handleStageZeroDndCancel}
      >
      <UniverseCanvas
        level={level}
        tableNodes={tableNodes}
        asteroidNodes={asteroidNodes}
        tableLinks={tableLinks}
        asteroidLinks={asteroidLinks}
        cameraState={DEFAULT_CAMERA_STATE}
        starCore={starCoreForCanvas}
        starFocused={starControlPhase === STAR_CONTROL_PHASE.STAR_FOCUSED}
        starControlOpen={starHeartOpen}
        starDiveActive={starHeartOpen}
        selectedTableId={selectedTableId}
        selectedAsteroidId={selectedAsteroidId}
        cameraFocusOffset={stageZeroSetupOpen && selectedTableId && !selectedAsteroidId ? [140, 0, 0] : [0, 0, 0]}
        linkDraft={linkDraft}
        builderDropActive={stageZeroDropMode || stageZeroCreating}
        builderDropHover={stageZeroDropHover}
        hideMouseGuide={minimalShell}
        onSelectStar={handleStarSelect}
        onOpenStarControlCenter={handleOpenStarHeartDashboard}
        onClearStarFocus={handleClearStarFocus}
        onSelectTable={(tableId) => {
          setSelectedTableId(String(tableId || ""));
          setSelectedAsteroidId("");
        }}
        onSelectAsteroid={(asteroidId) => {
          setSelectedAsteroidId(String(asteroidId || ""));
        }}
        onOpenContext={() => {}}
        onLinkStart={(draft) => setLinkDraft(draft)}
        onLinkMove={(nextPoint) =>
          setLinkDraft((prev) => {
            if (!prev) return prev;
            return { ...prev, to: nextPoint };
          })
        }
        onLinkComplete={(payload) => {
          setLinkDraft(null);
          void handleCreateLink(payload);
        }}
        onLinkCancel={() => setLinkDraft(null)}
        onHoverLink={setHoveredLink}
        onLeaveLink={() => setHoveredLink(null)}
        onSelectLink={() => {}}
      />
      <StageZeroDropZone active={stageZeroDropMode || stageZeroCreating} />

      {stageZeroRequiresStarLock ? (
        <section
          style={{
            position: "fixed",
            inset: 0,
            zIndex: 60,
            display: "grid",
            placeItems: "center",
            background: "radial-gradient(circle at 50% 50%, rgba(37, 27, 13, 0.28), rgba(2, 6, 14, 0.72))",
            backdropFilter: "blur(2px)",
          }}
        >
          <article
            style={{
              width: "min(680px, calc(100vw - 24px))",
              borderRadius: 14,
              border: "1px solid rgba(252, 205, 122, 0.38)",
              background: "rgba(12, 10, 7, 0.92)",
              color: "#ffeccf",
              padding: 16,
              display: "grid",
              gap: 10,
              boxShadow: "0 0 24px rgba(189, 126, 46, 0.22)",
            }}
          >
            <div style={{ fontSize: "var(--dv-fs-xs)", letterSpacing: "var(--dv-tr-wide)", opacity: 0.82 }}>STAGE 0 / STAR CORE</div>
            <div style={{ fontSize: "clamp(18px, 3vw, 24px)", fontWeight: 800 }}>Nejdriv nastav zakony hvezdy</div>
            <div style={{ fontSize: "var(--dv-fs-sm)", opacity: 0.9, lineHeight: "var(--dv-lh-base)" }}>
              Hvezda urcuje fyzikalni zakon cele galaxie. Dokud neni Star Core uzamceny, neni bezpecne zakladat prvni planetu.
            </div>
            <div
              style={{
                border: "1px solid rgba(242, 195, 114, 0.26)",
                borderRadius: 10,
                background: "rgba(22, 16, 10, 0.7)",
                padding: "9px 10px",
                display: "grid",
                gap: 6,
              }}
            >
              {[
                {
                  key: "no_hard_delete",
                  label: "Zakaz tvrdeho mazani (soft-delete only)",
                  impact: "Historie metrik zustane konzistentni i po odstraneni dat.",
                  done: starPolicy?.no_hard_delete !== false,
                },
                {
                  key: "occ",
                  label: "OCC ochrana soubehu",
                  impact: "Dva zapisy neprepisou stejny zaznam bez varovani.",
                  done: starPolicy?.occ_enforced !== false,
                },
                {
                  key: "idempotency",
                  label: "Idempotence prikazu",
                  impact: "Opakovany request nevytvori duplicitni data pri retry.",
                  done: starPolicy?.idempotency_supported !== false,
                },
                {
                  key: "physical_profile",
                  label: "Fyzikalni profil planety",
                  impact: "Urci, jak planety meni velikost, zar a degradaci pri zatezi.",
                  done: Boolean(String(starPhysicsProfile?.profile_key || "").trim()),
                },
                { key: "lock", label: "Star Core lock status = locked", done: starPolicyLocked },
              ].map((item) => (
                <div key={item.key} style={{ display: "grid", gap: 3 }}>
                  <label style={{ display: "flex", alignItems: "center", gap: 8, fontSize: "var(--dv-fs-xs)" }}>
                    <input type="checkbox" checked={Boolean(item.done)} readOnly />
                    <span>{item.label}</span>
                  </label>
                  {item.impact ? (
                    <div style={{ fontSize: "var(--dv-fs-2xs)", opacity: 0.72, paddingLeft: 24 }}>
                      {item.impact}
                    </div>
                  ) : null}
                </div>
              ))}
            </div>
            <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
              <button
                type="button"
                onClick={handleOpenStarHeartDashboard}
                style={{
                  border: "1px solid rgba(255, 205, 121, 0.52)",
                  background: "linear-gradient(120deg, #ffb457, #ffd27a)",
                  color: "#3f2200",
                  borderRadius: 10,
                  padding: "10px 12px",
                  fontWeight: 700,
                  cursor: "pointer",
                }}
              >
                Otevrit Star Heart Dashboard
              </button>
            </div>
          </article>
        </section>
      ) : null}

      {stageZeroActive && !stageZeroRequiresStarLock && stageZeroFlow === STAGE_ZERO_FLOW.INTRO ? (
        <section
          style={{
            position: "fixed",
            inset: 0,
            zIndex: 60,
            display: "grid",
            placeItems: "center",
            background: "radial-gradient(circle at 50% 50%, rgba(19, 42, 66, 0.28), rgba(2, 6, 14, 0.68))",
            backdropFilter: "blur(2px)",
          }}
        >
          <article
            style={{
              width: "min(640px, calc(100vw - 24px))",
              borderRadius: 14,
              border: "1px solid rgba(126, 216, 250, 0.38)",
              background: "rgba(5, 13, 24, 0.92)",
              color: "#d8f8ff",
              padding: 16,
              display: "grid",
              gap: 10,
              boxShadow: "0 0 24px rgba(46, 145, 189, 0.24)",
            }}
          >
            <div style={{ fontSize: "var(--dv-fs-xs)", letterSpacing: "var(--dv-tr-wide)", opacity: 0.82 }}>STAGE 0</div>
            <div style={{ fontSize: "clamp(18px, 3vw, 24px)", fontWeight: 800 }}>Prazdny vesmir ceka na prvni planetu</div>
            <div style={{ fontSize: "var(--dv-fs-sm)", opacity: 0.88, lineHeight: "var(--dv-lh-base)" }}>
              Planeta je kontejner pro data. Nejdriv ji umistime do prostoru, potom ji nastavime zakladni zakony a schema.
            </div>
            <button
              type="button"
              onClick={() => setStageZeroFlow(STAGE_ZERO_FLOW.BLUEPRINT)}
              style={{
                border: "1px solid rgba(114, 219, 252, 0.5)",
                background: "linear-gradient(120deg, #21bbea, #44d8ff)",
                color: "#072737",
                borderRadius: 10,
                padding: "10px 12px",
                fontWeight: 700,
                cursor: "pointer",
                width: "fit-content",
              }}
            >
              Otevrit stavebnici
            </button>
          </article>
        </section>
      ) : null}

      {stageZeroBuilderOpen ? (
        <aside
          style={{
            position: "fixed",
            left: 12,
            top: "50%",
            transform: "translateY(-50%)",
            zIndex: 59,
            width: 250,
            borderRadius: 14,
            border: "1px solid rgba(106, 208, 243, 0.38)",
            background: "rgba(6, 15, 28, 0.9)",
            color: "#dbf8ff",
            boxShadow: "0 0 26px rgba(36, 136, 182, 0.24)",
            padding: 12,
            display: "grid",
            gap: 10,
          }}
        >
          <div style={{ fontSize: "var(--dv-fs-xs)", letterSpacing: "var(--dv-tr-wide)", opacity: 0.82 }}>BLUEPRINT PANEL</div>
          <div style={{ fontSize: "var(--dv-fs-xs)", opacity: 0.82, lineHeight: "var(--dv-lh-base)" }}>
            Tohle je tva stavebnice. Vezmi Planetu a pretahni ji kamkoliv do prazdneho prostoru.
          </div>
          <StageZeroDraggablePlanetCard disabled={stageZeroCreating} />
        </aside>
      ) : null}

      {stageZeroCreating ? (
        <div
          style={{
            position: "fixed",
            left: "50%",
            top: 18,
            transform: "translateX(-50%)",
            zIndex: 61,
            borderRadius: 999,
            border: "1px solid rgba(118, 209, 243, 0.42)",
            background: "rgba(5, 14, 26, 0.9)",
            color: "#d9f8ff",
            padding: "7px 12px",
            fontSize: "var(--dv-fs-xs)",
          }}
        >
          Zhmotnuji planetu v prostoru...
        </div>
      ) : null}

      {stageZeroSetupOpen && selectedTableId ? (
        <aside
          style={{
            position: "fixed",
            right: 12,
            top: 232,
            zIndex: 58,
            width: "min(420px, calc(100vw - 24px))",
            borderRadius: 14,
            border: "1px solid rgba(112, 203, 238, 0.34)",
            background: "rgba(5, 13, 24, 0.88)",
            color: "#ddf7ff",
            padding: 12,
            display: "grid",
            gap: 8,
            backdropFilter: "blur(10px)",
          }}
        >
          <div style={{ fontSize: "var(--dv-fs-xs)", letterSpacing: "var(--dv-tr-wide)", opacity: 0.82 }}>SETUP PANEL</div>
          <div style={{ fontSize: "var(--dv-fs-sm)", lineHeight: "var(--dv-lh-base)" }}>
            Vyborne. <strong>{stageZeroPlanetName || "Planeta"}</strong> slouzi jako kontejner pro mesice (data). Aby v ni
            nebyl chaos, nastavime zakladni schema krok za krokem.
          </div>
          {!stageZeroPresetSelected ? (
            <>
              <div style={{ fontSize: "var(--dv-fs-xs)", opacity: 0.82 }}>
                Vesmír nebudujeme od nuly, pouzivame proverene nakresy. Vyber si pro zacatek Cashflow.
              </div>
              <div style={{ display: "grid", gap: 8 }}>
                <button
                  type="button"
                  style={{
                    border: "1px solid rgba(110, 198, 229, 0.2)",
                    background: "rgba(7, 18, 32, 0.8)",
                    color: "#8fb9c9",
                    borderRadius: 10,
                    padding: "9px 10px",
                    textAlign: "left",
                    cursor: "not-allowed",
                  }}
                  disabled
                >
                  Agilni CRM (zamceno)
                </button>
                <button
                  type="button"
                  style={{
                    border: "1px solid rgba(110, 198, 229, 0.2)",
                    background: "rgba(7, 18, 32, 0.8)",
                    color: "#8fb9c9",
                    borderRadius: 10,
                    padding: "9px 10px",
                    textAlign: "left",
                    cursor: "not-allowed",
                  }}
                  disabled
                >
                  Sklad (zamceno)
                </button>
                <button
                  type="button"
                  onClick={() => setStageZeroPresetSelected(true)}
                  style={{
                    border: "1px solid rgba(142, 234, 255, 0.62)",
                    background: "linear-gradient(120deg, rgba(35, 165, 207, 0.42), rgba(88, 226, 255, 0.2))",
                    color: "#dcfcff",
                    borderRadius: 10,
                    padding: "10px 11px",
                    textAlign: "left",
                    fontWeight: 700,
                    cursor: "pointer",
                    boxShadow: "0 0 18px rgba(98, 223, 255, 0.24)",
                  }}
                >
                  Osobni Cashflow
                </button>
              </div>
            </>
          ) : (
            <>
              <div
                style={{
                  border: "1px solid rgba(98, 188, 220, 0.24)",
                  borderRadius: 10,
                  background: "rgba(6, 17, 30, 0.7)",
                  padding: "8px 9px",
                  display: "grid",
                  gap: 8,
                }}
              >
                <div style={{ fontSize: "var(--dv-fs-xs)", opacity: 0.86 }}>
                  Krok A: Pridat <strong>Nazev transakce</strong> (Text)
                </div>
                <button
                  type="button"
                  onClick={() => handleStageZeroSchemaStep("transactionName")}
                  disabled={stageZeroSchemaDraft.transactionName}
                  style={{
                    border: "1px solid rgba(114, 219, 252, 0.5)",
                    background: stageZeroSchemaDraft.transactionName
                      ? "rgba(25, 75, 58, 0.86)"
                      : "linear-gradient(120deg, #21bbea, #44d8ff)",
                    color: stageZeroSchemaDraft.transactionName ? "#d7ffe5" : "#072737",
                    borderRadius: 9,
                    padding: "7px 10px",
                    fontWeight: 700,
                    cursor: stageZeroSchemaDraft.transactionName ? "default" : "pointer",
                  }}
                >
                  {stageZeroSchemaDraft.transactionName ? "Pridano ✓" : "+ Nazev"}
                </button>
              </div>

              <div
                style={{
                  border: "1px solid rgba(98, 188, 220, 0.24)",
                  borderRadius: 10,
                  background: "rgba(6, 17, 30, 0.7)",
                  padding: "8px 9px",
                  display: "grid",
                  gap: 8,
                  opacity: stageZeroSchemaDraft.transactionName ? 1 : 0.58,
                }}
              >
                <div style={{ fontSize: "var(--dv-fs-xs)", opacity: 0.86 }}>
                  Krok B: Pridat <strong>Castku</strong> (Cislo)
                </div>
                <button
                  type="button"
                  onClick={() => handleStageZeroSchemaStep("amount")}
                  disabled={!stageZeroSchemaDraft.transactionName || stageZeroSchemaDraft.amount}
                  style={{
                    border: "1px solid rgba(114, 219, 252, 0.5)",
                    background: stageZeroSchemaDraft.amount
                      ? "rgba(25, 75, 58, 0.86)"
                      : "linear-gradient(120deg, #21bbea, #44d8ff)",
                    color: stageZeroSchemaDraft.amount ? "#d7ffe5" : "#072737",
                    borderRadius: 9,
                    padding: "7px 10px",
                    fontWeight: 700,
                    cursor: !stageZeroSchemaDraft.transactionName || stageZeroSchemaDraft.amount ? "default" : "pointer",
                  }}
                >
                  {stageZeroSchemaDraft.amount ? "Pridano ✓" : "+ Castka"}
                </button>
              </div>

              <div
                style={{
                  border: "1px solid rgba(98, 188, 220, 0.24)",
                  borderRadius: 10,
                  background: "rgba(6, 17, 30, 0.7)",
                  padding: "8px 9px",
                  display: "grid",
                  gap: 8,
                  opacity: stageZeroSchemaDraft.amount ? 1 : 0.58,
                }}
              >
                <div style={{ fontSize: "var(--dv-fs-xs)", opacity: 0.86 }}>
                  Krok C: Pridat <strong>Typ</strong> (Prijem/Vydej)
                </div>
                <button
                  type="button"
                  onClick={() => handleStageZeroSchemaStep("transactionType")}
                  disabled={!stageZeroSchemaDraft.amount || stageZeroSchemaDraft.transactionType}
                  style={{
                    border: "1px solid rgba(114, 219, 252, 0.5)",
                    background: stageZeroSchemaDraft.transactionType
                      ? "rgba(25, 75, 58, 0.86)"
                      : "linear-gradient(120deg, #21bbea, #44d8ff)",
                    color: stageZeroSchemaDraft.transactionType ? "#d7ffe5" : "#072737",
                    borderRadius: 9,
                    padding: "7px 10px",
                    fontWeight: 700,
                    cursor: !stageZeroSchemaDraft.amount || stageZeroSchemaDraft.transactionType ? "default" : "pointer",
                  }}
                >
                  {stageZeroSchemaDraft.transactionType ? "Pridano ✓" : "+ Typ"}
                </button>
              </div>

              <div
                style={{
                  border: "1px solid rgba(95, 188, 220, 0.26)",
                  borderRadius: 10,
                  background: "rgba(7, 18, 32, 0.74)",
                  padding: "8px 9px",
                  display: "grid",
                  gap: 6,
                }}
              >
                <div style={{ fontSize: "var(--dv-fs-xs)", opacity: 0.86 }}>Prubezny preview planety</div>
                {stageZeroSchemaPreview.map((item) => (
                  <div key={item.key} style={{ fontSize: "var(--dv-fs-xs)", opacity: item.done ? 0.96 : 0.58 }}>
                    {item.done ? "✓" : "○"} {item.label} <span style={{ opacity: 0.74 }}>({item.type})</span>
                  </div>
                ))}
                <div style={{ fontSize: "var(--dv-fs-xs)", opacity: 0.72 }}>
                  Po zazehnuti jadra se vlozi 3 ukazkove mesice do gridu.
                </div>
              </div>

              {stageZeroAllSchemaStepsDone ? (
                <div
                  style={{
                    border: "1px solid rgba(120, 217, 247, 0.38)",
                    borderRadius: 10,
                    background: "rgba(8, 22, 36, 0.74)",
                    padding: "8px 10px",
                    display: "grid",
                    gap: 8,
                  }}
                >
                  <div style={{ fontSize: "var(--dv-fs-xs)", opacity: 0.86 }}>
                    Plan je kompletni. Vytvori se struktura o 3 zakonech a nasypou se 3 ukazkove zaznamy.
                  </div>
                  <button
                    type="button"
                    onClick={() => {
                      void handleStageZeroCommitPreset();
                    }}
                    disabled={stageZeroCommitBusy}
                    style={{
                      border: "1px solid rgba(130, 233, 255, 0.64)",
                      background: "linear-gradient(120deg, #35c1ea, #8cecff)",
                      color: "#062535",
                      borderRadius: 10,
                      padding: "9px 12px",
                      fontWeight: 800,
                      cursor: stageZeroCommitBusy ? "wait" : "pointer",
                    }}
                  >
                    {stageZeroCommitBusy ? "Aplikuji..." : "Zazehnout Jadro"}
                  </button>
                </div>
              ) : null}
            </>
          )}

          <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
            <button
              type="button"
              onClick={() => setStageZeroSetupOpen(false)}
              style={{
                border: "1px solid rgba(113, 202, 234, 0.3)",
                background: "rgba(7, 18, 32, 0.86)",
                color: "#d5f5ff",
                borderRadius: 9,
                padding: "8px 10px",
                cursor: "pointer",
              }}
            >
              Zavrit panel
            </button>
          </div>
        </aside>
      ) : null}

      <WorkspaceSidebar
        galaxy={galaxy}
        branches={branches}
        onboarding={onboarding}
        tableNodes={tableNodes}
        asteroidCount={snapshot.asteroids.length}
        bondCount={snapshot.bonds.length}
        loading={loading}
        busy={busy}
        error={error}
        selectedTableId={selectedTableId}
        selectedTableLabel={selectedTableLabel}
        selectedAsteroidLabel={selectedAsteroidLabel}
        onSelectTable={(tableId) => {
          setSelectedTableId(tableId);
          setSelectedAsteroidId("");
        }}
        onOpenGrid={() => setQuickGridOpen(true)}
        onRefresh={() => {
          void refreshProjection();
        }}
        onOpenStarHeart={handleOpenStarHeartDashboard}
        onBackToGalaxies={onBackToGalaxies}
        onLogout={onLogout}
      />

      <StarHeartDashboard
        open={starHeartOpen}
        phase={starControlPhase}
        starCoreProfile={starCoreProfile}
        starPolicy={starPolicy}
        starPhysicsProfile={starPhysicsProfile}
        starRuntime={starRuntime}
        starDomains={starDomains}
        parserTelemetry={parserTelemetry}
        parserExecutionMode={parserExecutionMode}
        selectedProfileKey={starProfileDraftKey}
        selectedPhysicalProfileKey={starPhysicalProfileDraftKey}
        applyBusy={starControlPhase === STAR_CONTROL_PHASE.APPLY_PROFILE}
        applyError={starControlError}
        onSelectProfile={setStarProfileDraftKey}
        onSelectPhysicalProfile={setStarPhysicalProfileDraftKey}
        onApplyProfileLock={() => {
          void handleApplyStarProfileLock();
        }}
        onClose={handleCloseStarHeartDashboard}
      />

      <QuickGridOverlay
        open={quickGridOpen}
        selectedTable={selectedTable}
        tableRows={tableRows}
        gridColumns={gridColumns}
        gridFilteredRows={gridFilteredRows}
        gridSearchQuery={gridSearchQuery}
        onGridSearchChange={setGridSearchQuery}
        selectedAsteroidId={selectedAsteroidId}
        onSelectRow={setSelectedAsteroidId}
        onCreateRow={handleCreateRow}
        onUpdateRow={handleUpdateRow}
        onDeleteRow={handleDeleteRow}
        onUpsertMetadata={handleUpsertMetadata}
        pendingCreate={pendingCreate}
        pendingRowOps={pendingRowOps}
        busy={busy}
        onClose={() => setQuickGridOpen(false)}
        readGridCell={readGridCell}
      />

      <LinkHoverTooltip hoveredLink={hoveredLink} />
      <DragOverlay>{stageZeroDragging ? <StageZeroDragGhost /> : null}</DragOverlay>
      </DndContext>
    </main>
  );
}
