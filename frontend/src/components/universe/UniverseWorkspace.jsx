import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  DndContext,
  DragOverlay,
  PointerSensor,
  useDraggable,
  useDroppable,
  useSensor,
  useSensors,
} from "@dnd-kit/core";

import {
  API_BASE,
  apiErrorFromResponse,
  apiFetch,
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
import {
  buildCivilizationWriteRouteCandidates,
  shouldFallbackToMoonAlias,
} from "../../lib/civilizationRuntimeRouteGate";
import { resolveCivilizationSelectionPatch } from "../../lib/civilizationWorkspaceSelectionGate";
import { calculateHierarchyLayout } from "../../lib/hierarchy_layout";
import LinkHoverTooltip from "./LinkHoverTooltip";
import { resolveEntityLaws, resolveLinkLaws, resolveStarCoreProfile } from "./lawResolver";
import QuickGridOverlay from "./QuickGridOverlay";
import { mergeMetadataValue, parseMetadataLiteral } from "./rowWriteUtils";
import StarHeartDashboard from "./StarHeartDashboard";
import UniverseCanvas from "./UniverseCanvas";
import { useUniverseRuntimeSync } from "./useUniverseRuntimeSync";
import WorkspaceSidebar from "./WorkspaceSidebar";
import { buildStageZeroPlanetName, mapDropPointToPlanetPosition } from "./stageZeroUtils";
import {
  STAGE_ZERO_CASHFLOW_STEPS,
  STAGE_ZERO_PRESET_CARDS,
  buildStageZeroFieldTypes,
  buildStageZeroCameraMicroNudgeKey,
  buildStageZeroRequiredFields,
  buildStageZeroSchemaPreview,
  createStageZeroSchemaDraft,
  isStageZeroStepUnlocked,
  resolveStageZeroPlanetVisualBoost,
  summarizeStageZeroSchemaDraft,
} from "./stageZeroBuilder";
import { buildMoonCreateMinerals } from "./moonWriteDefaults";
import {
  buildGuidedRepairAuditRecord,
  buildGuidedRepairMessage,
  buildGuidedRepairMutationRequest,
  resolveGuidedRepairSuggestion,
} from "./repairFlowContract";
import {
  resolveMoonParentRuntimePhysics,
  resolvePlanetAuthoritativePhysics,
  resolveTableRuntimeLayoutPhysics,
} from "./planetPhysicsParity";
import {
  buildPlanetBuilderTransitionMessage,
  evaluatePlanetBuilderTransition,
  buildPlanetBuilderNarrative,
  buildPlanetBuilderStepChecklist,
  PLANET_BUILDER_ACTION,
  PLANET_BUILDER_STATE,
  resolvePlanetBuilderRecoveryState,
  resolvePlanetBuilderState,
} from "./planetBuilderFlow";
import { resolvePlanetMoonCausalGuidance } from "./planetMoonCausalGuidance";
import { resolveStageZeroVisibility } from "./stageZeroVisibility";
import {
  observeReducedMotionPreference,
  readReducedMotionPreference,
  resolvePreviewSeverityColor,
  resolveWorkspaceKeyboardAction,
} from "./previewAccessibility";
import { buildContractViolationMessage } from "./workspaceContractExplainability";
import { readWorkspaceUiState, writeWorkspaceUiState } from "./workspaceUiPersistence";
import { collectGridColumns, normalizeText, readGridCell, tableDisplayName, valueToLabel } from "./workspaceFormatters";

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
      data-testid="stage0-draggable-planet-card"
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
      data-testid="stage0-drop-zone"
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
  const [reducedMotion, setReducedMotion] = useState(() => readReducedMotionPreference());
  const [parserTelemetry, setParserTelemetry] = useState(() => createParserTelemetrySnapshot());
  const [repairSuggestion, setRepairSuggestion] = useState(null);
  const [repairApplyBusy, setRepairApplyBusy] = useState(false);
  const [repairAuditTrail, setRepairAuditTrail] = useState([]);
  const [stageZeroFlow, setStageZeroFlow] = useState(STAGE_ZERO_FLOW.INTRO);
  const [stageZeroDragging, setStageZeroDragging] = useState(false);
  const [stageZeroDropHover, setStageZeroDropHover] = useState(false);
  const [stageZeroCreating, setStageZeroCreating] = useState(false);
  const [stageZeroSetupOpen, setStageZeroSetupOpen] = useState(false);
  const [stageZeroPlanetName, setStageZeroPlanetName] = useState("");
  const [stageZeroPresetSelected, setStageZeroPresetSelected] = useState(false);
  const [stageZeroSchemaDraft, setStageZeroSchemaDraft] = useState(() => createStageZeroSchemaDraft());
  const [stageZeroDraggedSchemaKey, setStageZeroDraggedSchemaKey] = useState("");
  const [stageZeroCommitBusy, setStageZeroCommitBusy] = useState(false);
  const [workspaceUiHydrated, setWorkspaceUiHydrated] = useState(false);
  const [planetBuilderLastValidState, setPlanetBuilderLastValidState] = useState(PLANET_BUILDER_STATE.IDLE);

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
    setRepairSuggestion(null);
    setRepairApplyBusy(false);
    setRepairAuditTrail([]);
    setStageZeroFlow(STAGE_ZERO_FLOW.INTRO);
    setStageZeroDragging(false);
    setStageZeroDropHover(false);
    setStageZeroCreating(false);
    setStageZeroSetupOpen(false);
    setStageZeroPlanetName("");
    setStageZeroPresetSelected(false);
    setStageZeroSchemaDraft(createStageZeroSchemaDraft());
    setStageZeroDraggedSchemaKey("");
    setStageZeroCommitBusy(false);
    setWorkspaceUiHydrated(true);
    setPlanetBuilderLastValidState(PLANET_BUILDER_STATE.IDLE);
    layoutRef.current = { tablePositions: new Map(), asteroidPositions: new Map() };
  }, [galaxyId]);

  useEffect(() => {
    if (!workspaceUiHydrated) return;
    writeWorkspaceUiState(galaxyId, {
      selectedTableId,
      quickGridOpen,
    });
  }, [galaxyId, quickGridOpen, selectedTableId, workspaceUiHydrated]);

  useEffect(() => {
    const unsubscribe = observeReducedMotionPreference((nextValue) => {
      setReducedMotion(Boolean(nextValue));
    });
    return unsubscribe;
  }, []);

  const tableById = useMemo(
    () => new Map((Array.isArray(tables) ? tables : []).map((table) => [String(table.table_id), table])),
    [tables]
  );
  const starPolicyLocked = String(starPolicy?.lock_status || "").toLowerCase() === "locked";
  const hasPlanets = tables.length > 0;
  const stageZeroActive = !hasPlanets || stageZeroSetupOpen;
  const stageZeroRequiresStarLock = stageZeroActive && !starPolicyLocked;
  const stageZeroBuilderOpen =
    stageZeroActive &&
    !stageZeroRequiresStarLock &&
    (stageZeroFlow === STAGE_ZERO_FLOW.BLUEPRINT || stageZeroFlow === STAGE_ZERO_FLOW.BUILDING) &&
    !stageZeroCreating &&
    !stageZeroSetupOpen;
  const stageZeroDropMode = stageZeroBuilderOpen && stageZeroDragging;
  const stageZeroUiVisibility = useMemo(
    () =>
      resolveStageZeroVisibility({
        stageZeroActive,
        stageZeroRequiresStarLock,
        stageZeroFlow,
        stageZeroSetupOpen,
        stageZeroBuilderOpen,
        stageZeroDropMode,
        stageZeroCreating,
      }),
    [
      stageZeroActive,
      stageZeroBuilderOpen,
      stageZeroCreating,
      stageZeroDropMode,
      stageZeroFlow,
      stageZeroRequiresStarLock,
      stageZeroSetupOpen,
    ]
  );
  const workspaceInteractionLocked =
    stageZeroActive &&
    (stageZeroUiVisibility.canvasInteractionLocked ||
      stageZeroSetupOpen ||
      stageZeroBuilderOpen ||
      stageZeroCommitBusy);
  const stageZeroSchemaSummary = useMemo(
    () => summarizeStageZeroSchemaDraft(stageZeroSchemaDraft),
    [stageZeroSchemaDraft]
  );
  const stageZeroAllSchemaStepsDone = stageZeroSchemaSummary.allDone;
  const stageZeroSchemaPreview = useMemo(
    () => buildStageZeroSchemaPreview(stageZeroSchemaDraft),
    [stageZeroSchemaDraft]
  );
  const stageZeroVisualBoost = useMemo(
    () =>
      resolveStageZeroPlanetVisualBoost(stageZeroSchemaDraft, {
        enabled: stageZeroSetupOpen && stageZeroPresetSelected,
      }),
    [stageZeroPresetSelected, stageZeroSchemaDraft, stageZeroSetupOpen]
  );
  const stageZeroCameraMicroNudgeKey = useMemo(
    () =>
      buildStageZeroCameraMicroNudgeKey({
        setupOpen: stageZeroSetupOpen,
        presetSelected: stageZeroPresetSelected,
        tableId: selectedTableId,
        completed: stageZeroSchemaSummary.completed,
      }),
    [selectedTableId, stageZeroPresetSelected, stageZeroSchemaSummary.completed, stageZeroSetupOpen]
  );
  const planetBuilderState = useMemo(
    () =>
      resolvePlanetBuilderState({
        stageZeroActive,
        stageZeroRequiresStarLock,
        stageZeroFlow,
        stageZeroDragging,
        stageZeroCreating,
        stageZeroSetupOpen,
        stageZeroPresetSelected,
        stageZeroAllSchemaStepsDone,
        stageZeroCommitBusy,
        stageZeroCompletedSteps: stageZeroSchemaSummary.completed,
        quickGridOpen,
        runtimeError: error,
      }),
    [
      error,
      quickGridOpen,
      stageZeroActive,
      stageZeroAllSchemaStepsDone,
      stageZeroCommitBusy,
      stageZeroCreating,
      stageZeroDragging,
      stageZeroFlow,
      stageZeroPresetSelected,
      stageZeroRequiresStarLock,
      stageZeroSchemaSummary.completed,
      stageZeroSetupOpen,
    ]
  );
  const planetBuilderNarrative = useMemo(() => buildPlanetBuilderNarrative(planetBuilderState), [planetBuilderState]);
  const planetBuilderChecklist = useMemo(
    () => buildPlanetBuilderStepChecklist(planetBuilderState),
    [planetBuilderState]
  );
  const planetBuilderRecoveryState = useMemo(
    () =>
      resolvePlanetBuilderRecoveryState({
        currentState: planetBuilderState,
        lastValidState: planetBuilderLastValidState,
      }),
    [planetBuilderLastValidState, planetBuilderState]
  );

  useEffect(() => {
    if (planetBuilderState !== PLANET_BUILDER_STATE.ERROR_RECOVERABLE) {
      setPlanetBuilderLastValidState(planetBuilderState);
    }
  }, [planetBuilderState]);

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
    const waitingForProjectionBootstrap = stageZeroActive && quickGridOpen && loading;
    if (waitingForProjectionBootstrap) {
      return;
    }
    if (!stageZeroActive) {
      setStageZeroDragging(false);
      setStageZeroDropHover(false);
      setStageZeroDraggedSchemaKey("");
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
      setStageZeroDraggedSchemaKey("");
      setStageZeroSetupOpen(false);
      if (stageZeroFlow !== STAGE_ZERO_FLOW.INTRO) {
        setStageZeroFlow(STAGE_ZERO_FLOW.INTRO);
      }
      return;
    }
    if (stageZeroFlow === STAGE_ZERO_FLOW.COMPLETE) {
      setStageZeroFlow(STAGE_ZERO_FLOW.INTRO);
    }
  }, [loading, quickGridOpen, stageZeroActive, stageZeroFlow, stageZeroRequiresStarLock]);

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
      const layoutPhysics = resolveTableRuntimeLayoutPhysics(runtime);
      if (!layoutPhysics) return;
      map.set(String(tableId), layoutPhysics);
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
    const policyPhysicalKey = String(
      starPhysicsProfile?.profile_key || starCoreProfile?.physicalProfile?.key || "BALANCE"
    ).toUpperCase();
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
        const authoritative = resolvePlanetAuthoritativePhysics(runtimePlanetPhysics, {
          fallbackPhysics: resolved.physics,
        });
        const backendPhysics = authoritative.physics;
        const backendStatus = authoritative.status;
        const isStageZeroBuilderTarget =
          stageZeroSetupOpen && stageZeroPresetSelected && String(selectedTableId || "") === String(node.id || "");
        const builderPhysics = isStageZeroBuilderTarget
          ? {
              radiusFactor: clamp(
                (Number(backendPhysics.radiusFactor) || Number(resolved.physics?.radiusFactor) || 1) *
                  stageZeroVisualBoost.radiusFactorBoost,
                0.85,
                2.6
              ),
              emissiveBoost: clamp(
                (Number(backendPhysics.emissiveBoost) || Number(resolved.physics?.emissiveBoost) || 0) +
                  stageZeroVisualBoost.emissiveBoost,
                0,
                1
              ),
              auraFactor: clamp(
                (Number(backendPhysics.auraFactor) || Number(resolved.physics?.auraFactor) || 1) *
                  stageZeroVisualBoost.auraFactorBoost,
                0.9,
                2.4
              ),
              pulseFactor: clamp(
                (Number(backendPhysics.pulseFactor) || Number(resolved.physics?.pulseFactor) || 1) +
                  stageZeroVisualBoost.ratio * 0.32,
                0.82,
                2.5
              ),
            }
          : {};
        return {
          ...node,
          position: layout.tablePositions.get(node.id) || [0, 0, 0],
          runtimePulse,
          runtimeDomain,
          runtimePlanetPhysics,
          previewMoonCountOverride: isStageZeroBuilderTarget ? stageZeroVisualBoost.previewMoonCount : null,
          v1: {
            ...resolved.v1,
            ...(backendStatus ? { status: backendStatus } : {}),
            ...(isStageZeroBuilderTarget && !backendStatus
              ? { status: stageZeroAllSchemaStepsDone ? "ACTIVE" : "WARMUP" }
              : {}),
            quality_score:
              runtimePlanetPhysics && Number.isInteger(authoritative.qualityScore)
                ? authoritative.qualityScore
                : resolved.v1?.quality_score || 100,
          },
          physics: {
            ...resolved.physics,
            ...backendPhysics,
            ...builderPhysics,
          },
        };
      }),
    [
      domainMetricsByName,
      layout,
      selectedTableId,
      stageZeroAllSchemaStepsDone,
      stageZeroPresetSelected,
      stageZeroSetupOpen,
      stageZeroVisualBoost.auraFactorBoost,
      stageZeroVisualBoost.emissiveBoost,
      stageZeroVisualBoost.previewMoonCount,
      stageZeroVisualBoost.radiusFactorBoost,
      stageZeroVisualBoost.ratio,
      starPlanetPhysicsByTableId,
      starPulseByEntity,
    ]
  );

  const asteroidNodes = useMemo(() => {
    const selectedPlanetRuntime = selectedTableId ? starPlanetPhysicsByTableId[String(selectedTableId)] || null : null;
    const { parentPhase, parentCorrosion, parentCrack, parentHue, parentSaturation } =
      resolveMoonParentRuntimePhysics(selectedPlanetRuntime);
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
  }, [domainMetricsByName, layout, selectedTableId, starPlanetPhysicsByTableId, starPulseByEntity]);
  const tableNodeById = useMemo(() => new Map(tableNodes.map((node) => [String(node.id), node])), [tableNodes]);
  const asteroidNodeById = useMemo(
    () => new Map(asteroidNodes.map((node) => [String(node.id), node])),
    [asteroidNodes]
  );
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
  const selectedTableNode = useMemo(
    () => (selectedTableId ? tableNodeById.get(String(selectedTableId)) || null : null),
    [selectedTableId, tableNodeById]
  );
  const selectedAsteroidNode = useMemo(
    () => (selectedAsteroidId ? asteroidNodeById.get(String(selectedAsteroidId)) || null : null),
    [asteroidNodeById, selectedAsteroidId]
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
  const planetMoonGuidance = useMemo(
    () =>
      resolvePlanetMoonCausalGuidance({
        planetBuilderNarrative,
        stageZeroActive,
        stageZeroSetupOpen,
        stageZeroPresetSelected,
        stageZeroSchemaSummary,
        stageZeroAllSchemaStepsDone,
        stageZeroCommitBusy,
        quickGridOpen,
        selectedTable,
        selectedPlanetNode: selectedTableNode,
        selectedMoonNode: selectedAsteroidNode,
        selectedMoonLabel: selectedAsteroidLabel,
        stageZeroStepDefinitions: STAGE_ZERO_CASHFLOW_STEPS,
      }),
    [
      planetBuilderNarrative,
      quickGridOpen,
      selectedAsteroidLabel,
      selectedAsteroidNode,
      selectedTable,
      selectedTableNode,
      stageZeroActive,
      stageZeroAllSchemaStepsDone,
      stageZeroCommitBusy,
      stageZeroPresetSelected,
      stageZeroSchemaSummary,
      stageZeroSetupOpen,
    ]
  );

  const level = selectedTableId ? 3 : 2;
  const parserExecutionMode = PARSER_EXECUTION_MODE;
  const appendRepairAudit = useCallback((entry) => {
    if (!entry) return;
    setRepairAuditTrail((prev) => [entry, ...prev].slice(0, 32));
  }, []);
  const clearRuntimeIssue = useCallback(() => {
    clearRuntimeError();
    setRepairSuggestion(null);
  }, [clearRuntimeError]);
  const reportContractViolationWithRepair = useCallback(
    (errorLike, { fallbackMessage = "Operace selhala.", operation = "unknown", civilizationId = "" } = {}) => {
      const suggestion = resolveGuidedRepairSuggestion(errorLike, { operation, civilizationId });
      setRepairSuggestion(suggestion);
      const message = buildContractViolationMessage(errorLike, { fallbackMessage });
      if (suggestion) {
        appendRepairAudit(
          buildGuidedRepairAuditRecord(suggestion, {
            stage: "planned",
          })
        );
      }
      setRuntimeError(suggestion ? `${message} | ${buildGuidedRepairMessage(suggestion)}` : message);
    },
    [appendRepairAudit, setRuntimeError]
  );
  const runBuilderGuard = useCallback(
    (action, { schemaComplete = stageZeroAllSchemaStepsDone } = {}) => {
      const result = evaluatePlanetBuilderTransition({
        state: planetBuilderState,
        action,
        context: {
          schemaComplete,
          starLocked: starPolicyLocked,
          lastValidState: planetBuilderLastValidState,
        },
      });
      if (result.allowed) return true;
      setRuntimeError(buildPlanetBuilderTransitionMessage(result));
      return false;
    },
    [planetBuilderLastValidState, planetBuilderState, setRuntimeError, stageZeroAllSchemaStepsDone, starPolicyLocked]
  );
  const applyBuilderRecoveryState = useCallback(
    (recoveryState) => {
      const targetState = String(recoveryState || "").trim();
      if (!targetState) return;
      clearRuntimeIssue();
      if (targetState === PLANET_BUILDER_STATE.BLUEPRINT_OPEN || targetState === PLANET_BUILDER_STATE.DRAGGING_PLANET) {
        setStageZeroFlow(STAGE_ZERO_FLOW.BLUEPRINT);
        setStageZeroSetupOpen(false);
        setStageZeroDragging(false);
        setStageZeroDropHover(false);
        return;
      }
      if (
        targetState === PLANET_BUILDER_STATE.PLANET_PLACED ||
        targetState === PLANET_BUILDER_STATE.CAMERA_SETTLED ||
        targetState === PLANET_BUILDER_STATE.BUILDER_OPEN
      ) {
        setStageZeroFlow(STAGE_ZERO_FLOW.COMPLETE);
        setStageZeroSetupOpen(true);
        return;
      }
      if (
        targetState === PLANET_BUILDER_STATE.CAPABILITY_ASSEMBLING ||
        targetState === PLANET_BUILDER_STATE.PREVIEW_READY ||
        targetState === PLANET_BUILDER_STATE.COMMITTING
      ) {
        setStageZeroFlow(STAGE_ZERO_FLOW.COMPLETE);
        setStageZeroSetupOpen(true);
        if (!stageZeroPresetSelected) {
          setStageZeroPresetSelected(true);
        }
      }
    },
    [clearRuntimeIssue, stageZeroPresetSelected]
  );

  const handleStageZeroDropPlanet = useCallback(
    async (dropPayload) => {
      if (!galaxyId || stageZeroCreating || !stageZeroActive || stageZeroRequiresStarLock) return;
      const visualPosition = mapDropPointToPlanetPosition(dropPayload, dropPayload?.viewport);
      const suffix = Math.random().toString(36).slice(2, 6);
      const planetName = buildStageZeroPlanetName({ existingCount: tableNodes.length, suffix });

      setStageZeroCreating(true);
      setBusy(true);
      clearRuntimeIssue();
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
        setStageZeroSchemaDraft(createStageZeroSchemaDraft());
        setStageZeroDraggedSchemaKey("");
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
      clearRuntimeIssue,
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
      if (!runBuilderGuard(PLANET_BUILDER_ACTION.START_DRAG_PLANET)) return;
      setStageZeroDragging(true);
      setStageZeroDropHover(false);
      setStageZeroFlow(STAGE_ZERO_FLOW.BUILDING);
    },
    [runBuilderGuard, stageZeroBuilderOpen]
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
      if (!runBuilderGuard(PLANET_BUILDER_ACTION.DROP_PLANET)) {
        setStageZeroFlow(STAGE_ZERO_FLOW.BLUEPRINT);
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
    [handleStageZeroDropPlanet, runBuilderGuard, stageZeroCreating]
  );

  const handleStageZeroSchemaStep = useCallback(
    (key) => {
      if (!stageZeroPresetSelected || !String(key || "").trim()) return;
      if (!runBuilderGuard(PLANET_BUILDER_ACTION.ASSEMBLE_SCHEMA_STEP)) return;
      setStageZeroSchemaDraft((prev) => ({ ...prev, [key]: true }));
      setStageZeroDraggedSchemaKey("");
    },
    [runBuilderGuard, stageZeroPresetSelected]
  );
  const handleStageZeroSchemaBlockDragStart = useCallback(
    (key) => {
      if (!stageZeroPresetSelected) return;
      const normalizedKey = String(key || "").trim();
      if (!normalizedKey) return;
      setStageZeroDraggedSchemaKey(normalizedKey);
    },
    [stageZeroPresetSelected]
  );
  const handleStageZeroSchemaBlockDragEnd = useCallback(() => {
    setStageZeroDraggedSchemaKey("");
  }, []);
  const handleStageZeroSchemaBlockDrop = useCallback(
    (targetKey, targetIndex) => {
      if (!stageZeroPresetSelected) return;
      const normalizedKey = String(targetKey || "").trim();
      if (!normalizedKey) return;
      if (!isStageZeroStepUnlocked(targetIndex, stageZeroSchemaDraft)) return;
      if (stageZeroDraggedSchemaKey && stageZeroDraggedSchemaKey !== normalizedKey) {
        return;
      }
      handleStageZeroSchemaStep(normalizedKey);
    },
    [handleStageZeroSchemaStep, stageZeroDraggedSchemaKey, stageZeroPresetSelected, stageZeroSchemaDraft]
  );

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
    if (!runBuilderGuard(PLANET_BUILDER_ACTION.COMMIT_PRESET, { schemaComplete: stageZeroAllSchemaStepsDone })) return;
    setStageZeroCommitBusy(true);
    setBusy(true);
    clearRuntimeIssue();
    try {
      const currentContract = await loadTableContract(selectedTableId);
      const nextFieldTypes = buildStageZeroFieldTypes();
      const requiredFields = buildStageZeroRequiredFields();
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

      const postCivilization = async (payload) => {
        const [primaryUrl, legacyUrl] = buildCivilizationWriteRouteCandidates(API_BASE, { operation: "create" });
        const primary = await apiFetch(primaryUrl, payload);
        if (!shouldFallbackToMoonAlias(primary.status)) return primary;
        return apiFetch(legacyUrl, payload);
      };
      for (const row of rows) {
        const minerals = {
          ...buildMoonCreateMinerals({ label: row.name, contract: nextPayload }),
          transaction_name: row.name,
          amount: row.amount,
          transaction_type: row.type,
        };
        const ingest = await postCivilization({
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
    clearRuntimeIssue,
    galaxyId,
    loadTableContract,
    refreshProjection,
    runBuilderGuard,
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
      clearRuntimeIssue();
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
          reportContractViolationWithRepair(createError, {
            fallbackMessage: createError?.message || "Vazbu se nepodarilo vytvorit.",
            operation: "link",
          });
        }
      } finally {
        setBusy(false);
      }
    },
    [
      asteroidById,
      clearRuntimeIssue,
      executeParserCommand,
      galaxyId,
      parserExecutionMode,
      refreshProjection,
      reportContractViolationWithRepair,
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
      clearRuntimeIssue();
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
        const createPayload = {
          label: trimmed,
          minerals,
          planet_id: selectedTableId,
          galaxy_id: galaxyId,
          idempotency_key: nextIdempotencyKey("ingest"),
        };
        const [primaryCreateUrl, legacyCreateUrl] = buildCivilizationWriteRouteCandidates(API_BASE, {
          operation: "create",
        });
        let response = await apiFetch(primaryCreateUrl, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(createPayload),
        });
        if (shouldFallbackToMoonAlias(response.status)) {
          response = await apiFetch(legacyCreateUrl, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(createPayload),
          });
        }
        if (!response.ok) {
          throw await apiErrorFromResponse(response, `Civilizaci se nepodarilo vytvorit: ${response.status}`);
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
        reportContractViolationWithRepair(createError, {
          fallbackMessage: createError?.message || "Civilizaci se nepodarilo vytvorit.",
          operation: "create",
        });
        return false;
      } finally {
        setPendingCreate(false);
        setBusy(false);
      }
    },
    [
      clearRuntimeIssue,
      executeParserCommand,
      galaxyId,
      loadTableContract,
      parserExecutionMode,
      refreshProjection,
      reportContractViolationWithRepair,
      selectedTable,
      selectedTableId,
      trackParserAttempt,
    ]
  );

  const handleUpdateRow = useCallback(
    async (asteroidId, value) => {
      const targetId = String(asteroidId || "").trim();
      if (!galaxyId || !targetId) return;

      const asteroid = asteroidById.get(targetId);
      if (!asteroid) return;
      const expectedEventSeq = Number.isInteger(asteroid?.current_event_seq)
        ? Number(asteroid.current_event_seq)
        : null;

      setBusy(true);
      setPendingRowOps((prev) => ({ ...prev, [targetId]: "mutate" }));
      clearRuntimeIssue();
      try {
        const mutatePayload = {
          label: value,
          galaxy_id: galaxyId,
          idempotency_key: nextIdempotencyKey("mutate"),
          ...(expectedEventSeq !== null ? { expected_event_seq: expectedEventSeq } : {}),
        };
        const [primaryMutateUrl, legacyMutateUrl] = buildCivilizationWriteRouteCandidates(API_BASE, {
          operation: "mutate",
          civilizationId: targetId,
        });
        let response = await apiFetch(primaryMutateUrl, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(mutatePayload),
        });
        if (shouldFallbackToMoonAlias(response.status)) {
          response = await apiFetch(legacyMutateUrl, {
            method: "PATCH",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(mutatePayload),
          });
        }
        if (!response.ok) {
          throw await apiErrorFromResponse(response, `Civilizaci se nepodarilo upravit: ${response.status}`);
        }
        await refreshProjection({ silent: true });
      } catch (updateError) {
        if (isOccConflictError(updateError)) {
          setRuntimeError(buildOccConflictMessage(updateError, "uprava civilizace"));
          await refreshProjection({ silent: true });
        } else {
          reportContractViolationWithRepair(updateError, {
            fallbackMessage: updateError?.message || "Civilizaci se nepodarilo upravit.",
            operation: "mutate",
            civilizationId: targetId,
          });
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
    [asteroidById, clearRuntimeIssue, galaxyId, refreshProjection, reportContractViolationWithRepair, setRuntimeError]
  );

  const handleDeleteRow = useCallback(
    async (asteroidId) => {
      const targetId = String(asteroidId || "").trim();
      if (!galaxyId || !targetId) return;

      const asteroid = asteroidById.get(targetId);
      if (!asteroid) return;
      const expectedEventSeq = Number.isInteger(asteroid?.current_event_seq)
        ? Number(asteroid.current_event_seq)
        : null;
      let parserAttempted = false;
      let fallbackAttempted = false;
      let parserFailure = null;
      let parserTelemetryRecorded = false;

      setBusy(true);
      setPendingRowOps((prev) => ({ ...prev, [targetId]: "extinguish" }));
      clearRuntimeIssue();
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
        const extinguishIdempotencyKey = nextIdempotencyKey("extinguish");
        const [primaryExtinguishBaseUrl, legacyExtinguishBaseUrl] = buildCivilizationWriteRouteCandidates(API_BASE, {
          operation: "extinguish",
          civilizationId: targetId,
        });
        const buildExtinguishUrl = (baseUrl) => {
          const url = new URL(baseUrl);
          url.searchParams.set("galaxy_id", galaxyId);
          url.searchParams.set("idempotency_key", extinguishIdempotencyKey);
          if (expectedEventSeq !== null) {
            url.searchParams.set("expected_event_seq", String(expectedEventSeq));
          }
          return url.toString();
        };
        let response = await apiFetch(buildExtinguishUrl(primaryExtinguishBaseUrl), {
          method: "PATCH",
        });
        if (shouldFallbackToMoonAlias(response.status)) {
          response = await apiFetch(buildExtinguishUrl(legacyExtinguishBaseUrl), {
            method: "PATCH",
          });
        }

        if (!response.ok) {
          throw await apiErrorFromResponse(response, `Civilizaci se nepodarilo zhasnout: ${response.status}`);
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
          setRuntimeError(buildOccConflictMessage(deleteError, "zhasnuti civilizace"));
          await refreshProjection({ silent: true });
        } else {
          reportContractViolationWithRepair(deleteError, {
            fallbackMessage: deleteError?.message || "Civilizaci se nepodarilo zhasnout.",
            operation: "extinguish",
            civilizationId: targetId,
          });
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
      clearRuntimeIssue,
      executeParserCommand,
      galaxyId,
      parserExecutionMode,
      refreshProjection,
      reportContractViolationWithRepair,
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
      const expectedEventSeq = Number.isInteger(asteroid?.current_event_seq)
        ? Number(asteroid.current_event_seq)
        : null;
      const currentMetadata = asteroid?.metadata && typeof asteroid.metadata === "object" ? asteroid.metadata : {};
      const parsedMineralValue = parseMetadataLiteral(rawValue);
      const removeRequested = typeof parsedMineralValue === "undefined";
      if (removeRequested && !Object.prototype.hasOwnProperty.call(currentMetadata, metadataKey)) {
        return true;
      }

      setBusy(true);
      setPendingRowOps((prev) => ({ ...prev, [targetId]: "metadata" }));
      clearRuntimeIssue();
      try {
        const mineralMutatePayload = {
          remove: removeRequested,
          galaxy_id: galaxyId,
          idempotency_key: nextIdempotencyKey("mineral"),
          ...(expectedEventSeq !== null ? { expected_event_seq: expectedEventSeq } : {}),
        };
        if (!removeRequested) {
          mineralMutatePayload.typed_value = parsedMineralValue;
        }

        const [primaryMineralUrl, legacyMineralUrl] = buildCivilizationWriteRouteCandidates(API_BASE, {
          operation: "mutate_mineral",
          civilizationId: targetId,
          mineralKey: metadataKey,
        });
        let response = await apiFetch(primaryMineralUrl, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(mineralMutatePayload),
        });
        if (shouldFallbackToMoonAlias(response.status)) {
          response = await apiFetch(legacyMineralUrl, {
            method: "PATCH",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(mineralMutatePayload),
          });
        }
        if (shouldFallbackToMoonAlias(response.status)) {
          const nextMetadata = mergeMetadataValue(currentMetadata, metadataKey, rawValue);
          const mutatePayload = {
            minerals: nextMetadata,
            galaxy_id: galaxyId,
            idempotency_key: nextIdempotencyKey("metadata-fallback"),
            ...(expectedEventSeq !== null ? { expected_event_seq: expectedEventSeq } : {}),
          };
          const [primaryMutateUrl, legacyMutateUrl] = buildCivilizationWriteRouteCandidates(API_BASE, {
            operation: "mutate",
            civilizationId: targetId,
          });
          response = await apiFetch(primaryMutateUrl, {
            method: "PATCH",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(mutatePayload),
          });
          if (shouldFallbackToMoonAlias(response.status)) {
            response = await apiFetch(legacyMutateUrl, {
              method: "PATCH",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify(mutatePayload),
            });
          }
        }
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
          reportContractViolationWithRepair(metadataError, {
            fallbackMessage: metadataError?.message || "Nerost se nepodarilo ulozit.",
            operation: "metadata",
            civilizationId: targetId,
          });
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
    [asteroidById, clearRuntimeIssue, galaxyId, refreshProjection, reportContractViolationWithRepair, setRuntimeError]
  );

  const handleApplyGuidedRepair = useCallback(async () => {
    const activeSuggestion = repairSuggestion;
    if (!galaxyId || !activeSuggestion) return;
    const targetId = String(activeSuggestion.civilization_id || "").trim();
    if (!targetId) return;

    const asteroid = asteroidById.get(targetId);
    const expectedEventSeq = Number.isInteger(asteroid?.current_event_seq) ? Number(asteroid.current_event_seq) : null;
    const request = buildGuidedRepairMutationRequest(activeSuggestion, {
      galaxyId,
      expectedEventSeq,
    });
    if (!request) return;

    setRepairApplyBusy(true);
    setBusy(true);
    setRuntimeError("");
    try {
      const [primaryMutateUrl, legacyMutateUrl] = buildCivilizationWriteRouteCandidates(API_BASE, {
        operation: "mutate",
        civilizationId: request.civilizationId,
      });
      let response = await apiFetch(primaryMutateUrl, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(request.payload),
      });
      if (shouldFallbackToMoonAlias(response.status)) {
        response = await apiFetch(legacyMutateUrl, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(request.payload),
        });
      }
      if (!response.ok) {
        throw await apiErrorFromResponse(response, `Guided repair selhal: ${response.status}`);
      }
      await refreshProjection({ silent: true });
      setRepairSuggestion(null);
      appendRepairAudit(
        buildGuidedRepairAuditRecord(activeSuggestion, {
          stage: "applied",
        })
      );
    } catch (applyError) {
      appendRepairAudit(
        buildGuidedRepairAuditRecord(activeSuggestion, {
          stage: "failed",
          errorMessage: applyError?.message || "Guided repair failed.",
        })
      );
      if (isOccConflictError(applyError)) {
        setRuntimeError(buildOccConflictMessage(applyError, "guided repair"));
        await refreshProjection({ silent: true });
      } else {
        reportContractViolationWithRepair(applyError, {
          fallbackMessage: applyError?.message || "Guided repair se nepodarilo aplikovat.",
          operation: "repair_apply",
          civilizationId: targetId,
        });
      }
    } finally {
      setRepairApplyBusy(false);
      setBusy(false);
    }
  }, [
    appendRepairAudit,
    asteroidById,
    galaxyId,
    refreshProjection,
    repairSuggestion,
    reportContractViolationWithRepair,
    setRuntimeError,
  ]);

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
  const handlePlanetSelect = useCallback(
    (tableId, { source = "programmatic" } = {}) => {
      const selectionPatch = resolveCivilizationSelectionPatch({
        source,
        tableId,
        interactionLocked: workspaceInteractionLocked,
        previousQuickGridOpen: quickGridOpen,
      });
      setSelectedTableId(selectionPatch.selectedTableId);
      setSelectedAsteroidId(selectionPatch.selectedAsteroidId);
      setQuickGridOpen(selectionPatch.quickGridOpen);
    },
    [quickGridOpen, workspaceInteractionLocked]
  );

  const handleApplyStarProfileLock = useCallback(async () => {
    if (!galaxyId) return;
    if (starPolicyLocked) {
      setStarControlPhase(STAR_CONTROL_PHASE.LOCKED);
      return;
    }
    setStarControlError("");
    setStarControlPhase(STAR_CONTROL_PHASE.APPLY_PROFILE);
    clearRuntimeIssue();
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
    clearRuntimeIssue,
    galaxyId,
    refreshStarTelemetry,
    setRuntimeError,
    starPhysicalProfileDraftKey,
    starPhysicsProfile?.profile_version,
    starPolicyLocked,
    starProfileDraftKey,
  ]);

  useEffect(() => {
    const onKeyDown = (event) => {
      const action = resolveWorkspaceKeyboardAction(event, {
        canOpenGrid: Boolean(selectedTableId) && !workspaceInteractionLocked,
        canOpenStarHeart: true,
        quickGridOpen,
        starHeartOpen,
        stageZeroSetupOpen,
      });
      if (!action) return;
      event.preventDefault();
      if (action === "open_grid") {
        setQuickGridOpen(true);
        return;
      }
      if (action === "open_star_heart") {
        handleOpenStarHeartDashboard();
        return;
      }
      if (action === "close_quick_grid") {
        setQuickGridOpen(false);
        return;
      }
      if (action === "close_star_heart") {
        handleCloseStarHeartDashboard();
        return;
      }
      if (action === "close_stage_zero_setup") {
        setStageZeroSetupOpen(false);
        setStageZeroDraggedSchemaKey("");
      }
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [
    handleCloseStarHeartDashboard,
    handleOpenStarHeartDashboard,
    quickGridOpen,
    selectedTableId,
    stageZeroSetupOpen,
    starHeartOpen,
    workspaceInteractionLocked,
  ]);

  const selectedTableLabel = selectedTable ? `Tabulka: ${tableDisplayName(selectedTable)}` : "";
  const guidanceSeverityColor = resolvePreviewSeverityColor(planetMoonGuidance.severity);

  return (
    <main
      ref={workspaceRef}
      data-testid="workspace-root"
      data-reduced-motion={reducedMotion ? "true" : "false"}
      aria-label="Dataverse workspace"
      style={{ width: "100vw", height: "100vh", position: "relative", overflow: "hidden", background: "#020205" }}
    >
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
          cameraMicroNudgeKey={stageZeroCameraMicroNudgeKey}
          linkDraft={linkDraft}
          builderDropActive={stageZeroDropMode || stageZeroCreating}
          builderDropHover={stageZeroDropHover}
          hideMouseGuide={minimalShell}
          reducedMotion={reducedMotion}
          onSelectStar={handleStarSelect}
          onOpenStarControlCenter={handleOpenStarHeartDashboard}
          onClearStarFocus={handleClearStarFocus}
          onSelectTable={(tableId) => handlePlanetSelect(tableId, { source: "canvas" })}
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
        <StageZeroDropZone active={stageZeroUiVisibility.dropZone} />

        {stageZeroUiVisibility.starLockGate ? (
          <section
            data-testid="stage0-star-lock-gate"
            role="dialog"
            aria-modal="true"
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
              <div style={{ fontSize: "var(--dv-fs-xs)", letterSpacing: "var(--dv-tr-wide)", opacity: 0.82 }}>
                STAGE 0 / STAR CORE
              </div>
              <div style={{ fontSize: "clamp(18px, 3vw, 24px)", fontWeight: 800 }}>Nejdriv nastav zakony hvezdy</div>
              <div style={{ fontSize: "var(--dv-fs-sm)", opacity: 0.9, lineHeight: "var(--dv-lh-base)" }}>
                Hvezda urcuje fyzikalni zakon cele galaxie. Dokud neni Star Core uzamceny, neni bezpecne zakladat prvni
                planetu.
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
                      <div style={{ fontSize: "var(--dv-fs-2xs)", opacity: 0.72, paddingLeft: 24 }}>{item.impact}</div>
                    ) : null}
                  </div>
                ))}
              </div>
              <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                <button
                  type="button"
                  onClick={handleOpenStarHeartDashboard}
                  data-testid="stage0-open-star-heart-button"
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

        {stageZeroUiVisibility.introGate ? (
          <section
            data-testid="stage0-intro-gate"
            role="dialog"
            aria-modal="true"
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
              <div style={{ fontSize: "var(--dv-fs-xs)", letterSpacing: "var(--dv-tr-wide)", opacity: 0.82 }}>
                STAGE 0
              </div>
              <div style={{ fontSize: "clamp(18px, 3vw, 24px)", fontWeight: 800 }}>
                Prazdny vesmir ceka na prvni planetu
              </div>
              <div style={{ fontSize: "var(--dv-fs-sm)", opacity: 0.88, lineHeight: "var(--dv-lh-base)" }}>
                Planeta je kontejner pro data. Nejdriv ji umistime do prostoru, potom ji nastavime zakladni zakony a
                schema.
              </div>
              <button
                type="button"
                onClick={() => {
                  if (!runBuilderGuard(PLANET_BUILDER_ACTION.OPEN_BLUEPRINT, { schemaComplete: false })) return;
                  setStageZeroFlow(STAGE_ZERO_FLOW.BLUEPRINT);
                }}
                data-testid="stage0-open-blueprint-button"
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

        {stageZeroUiVisibility.blueprintPanel ? (
          <aside
            data-testid="stage0-blueprint-panel"
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
            <div style={{ fontSize: "var(--dv-fs-xs)", letterSpacing: "var(--dv-tr-wide)", opacity: 0.82 }}>
              BLUEPRINT PANEL
            </div>
            <div style={{ fontSize: "var(--dv-fs-xs)", opacity: 0.82, lineHeight: "var(--dv-lh-base)" }}>
              Tohle je tva stavebnice. Vezmi Planetu a pretahni ji kamkoliv do prazdneho prostoru.
            </div>
            <StageZeroDraggablePlanetCard disabled={stageZeroCreating} />
          </aside>
        ) : null}

        {stageZeroUiVisibility.creatingBanner ? (
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

        {stageZeroUiVisibility.setupPanel && selectedTableId ? (
          <aside
            data-testid="stage0-setup-panel"
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
            <div style={{ fontSize: "var(--dv-fs-xs)", letterSpacing: "var(--dv-tr-wide)", opacity: 0.82 }}>
              SETUP PANEL
            </div>
            <div style={{ fontSize: "var(--dv-fs-sm)", lineHeight: "var(--dv-lh-base)" }}>
              Vyborne. <strong>{stageZeroPlanetName || "Planeta"}</strong> slouzi jako kontejner pro civilizaci (radky
              dat). Aby v ni nebyl chaos, nastavime zakladni schema krok za krokem.
            </div>
            {!stageZeroPresetSelected ? (
              <>
                <div style={{ fontSize: "var(--dv-fs-xs)", opacity: 0.82 }}>
                  Vesmír nebudujeme od nuly, pouzivame proverene nakresy. Vyber si pro zacatek Cashflow.
                </div>
                <div style={{ display: "grid", gap: 8 }}>
                  {STAGE_ZERO_PRESET_CARDS.map((preset) => {
                    const locked = Boolean(preset.locked);
                    return (
                      <button
                        key={preset.key}
                        type="button"
                        data-testid={`stage0-preset-${preset.key}`}
                        onClick={() => {
                          if (locked) return;
                          if (!runBuilderGuard(PLANET_BUILDER_ACTION.SELECT_PRESET)) return;
                          setStageZeroPresetSelected(true);
                          setStageZeroSchemaDraft(createStageZeroSchemaDraft());
                          setStageZeroDraggedSchemaKey("");
                        }}
                        disabled={locked}
                        style={{
                          border: locked ? "1px solid rgba(110, 198, 229, 0.2)" : "1px solid rgba(142, 234, 255, 0.62)",
                          background: locked
                            ? "rgba(7, 18, 32, 0.8)"
                            : "linear-gradient(120deg, rgba(35, 165, 207, 0.42), rgba(88, 226, 255, 0.2))",
                          color: locked ? "#8fb9c9" : "#dcfcff",
                          borderRadius: 10,
                          padding: "10px 11px",
                          textAlign: "left",
                          fontWeight: locked ? 500 : 700,
                          cursor: locked ? "not-allowed" : "pointer",
                          boxShadow: locked ? "none" : "0 0 18px rgba(98, 223, 255, 0.24)",
                          display: "grid",
                          gap: 3,
                        }}
                      >
                        <span>{preset.label}</span>
                        {locked ? (
                          <span style={{ fontSize: "var(--dv-fs-2xs)", opacity: 0.72 }}>{preset.lockReason}</span>
                        ) : null}
                      </button>
                    );
                  })}
                </div>
              </>
            ) : (
              <>
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
                  <div style={{ fontSize: "var(--dv-fs-xs)", opacity: 0.92 }}>
                    Stavebni plan: skladej schema z Lego dilku (klik nebo drag & drop).
                  </div>
                  <div style={{ fontSize: "var(--dv-fs-xs)", opacity: 0.72 }}>
                    Vizualni odezva planety: {stageZeroSchemaSummary.completed}/{stageZeroSchemaSummary.total} dilku •
                    zar +{Math.round(stageZeroVisualBoost.emissiveBoost * 100)}%
                  </div>
                </div>

                <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
                  {STAGE_ZERO_CASHFLOW_STEPS.map((step, index) => {
                    const unlocked = isStageZeroStepUnlocked(index, stageZeroSchemaDraft);
                    const done = Boolean(stageZeroSchemaDraft[step.key]);
                    return (
                      <button
                        key={`tray-${step.key}`}
                        type="button"
                        data-testid={`stage0-tray-${step.key}`}
                        draggable={unlocked && !done}
                        onDragStart={(event) => {
                          if (!unlocked || done) return;
                          event.dataTransfer.effectAllowed = "move";
                          event.dataTransfer.setData("text/plain", step.key);
                          handleStageZeroSchemaBlockDragStart(step.key);
                        }}
                        onDragEnd={handleStageZeroSchemaBlockDragEnd}
                        onClick={() => {
                          if (!unlocked || done) return;
                          handleStageZeroSchemaStep(step.key);
                        }}
                        disabled={!unlocked || done}
                        style={{
                          border: done ? "1px solid rgba(120, 232, 182, 0.6)" : "1px solid rgba(114, 219, 252, 0.5)",
                          background: done
                            ? "linear-gradient(120deg, rgba(30, 94, 67, 0.9), rgba(30, 136, 92, 0.7))"
                            : "linear-gradient(120deg, rgba(33, 187, 234, 0.24), rgba(68, 216, 255, 0.14))",
                          color: done ? "#d8ffea" : "#d7f7ff",
                          borderRadius: 9,
                          padding: "7px 10px",
                          fontSize: "var(--dv-fs-xs)",
                          cursor: !unlocked || done ? "default" : "grab",
                          opacity: unlocked ? 1 : 0.58,
                        }}
                      >
                        {done ? "✓ " : "+ "}
                        {step.blockLabel}
                      </button>
                    );
                  })}
                </div>

                {STAGE_ZERO_CASHFLOW_STEPS.map((step, index) => {
                  const unlocked = isStageZeroStepUnlocked(index, stageZeroSchemaDraft);
                  const done = Boolean(stageZeroSchemaDraft[step.key]);
                  const isDragTarget = stageZeroDraggedSchemaKey && stageZeroDraggedSchemaKey === step.key;
                  return (
                    <div
                      key={step.key}
                      onDragOver={(event) => {
                        if (!unlocked || done) return;
                        event.preventDefault();
                      }}
                      onDrop={(event) => {
                        if (!unlocked || done) return;
                        event.preventDefault();
                        const droppedKey = String(
                          event.dataTransfer?.getData("text/plain") || stageZeroDraggedSchemaKey || ""
                        );
                        if (droppedKey !== step.key) {
                          setStageZeroDraggedSchemaKey("");
                          return;
                        }
                        handleStageZeroSchemaBlockDrop(step.key, index);
                      }}
                      style={{
                        border: done
                          ? "1px solid rgba(116, 228, 170, 0.36)"
                          : isDragTarget
                            ? "1px solid rgba(144, 233, 255, 0.72)"
                            : "1px solid rgba(98, 188, 220, 0.24)",
                        borderRadius: 10,
                        background: done ? "rgba(15, 44, 34, 0.78)" : "rgba(6, 17, 30, 0.7)",
                        padding: "8px 9px",
                        display: "grid",
                        gap: 8,
                        opacity: unlocked ? 1 : 0.58,
                        transition: "border-color 150ms ease, box-shadow 150ms ease",
                        boxShadow: isDragTarget ? "0 0 16px rgba(98, 223, 255, 0.24)" : "none",
                      }}
                    >
                      <div style={{ fontSize: "var(--dv-fs-xs)", opacity: 0.9 }}>
                        {step.title}: <strong>{step.sentence}</strong> {step.instruction}
                      </div>
                      <div
                        style={{
                          border: "1px dashed rgba(114, 219, 252, 0.34)",
                          borderRadius: 8,
                          padding: "7px 9px",
                          fontSize: "var(--dv-fs-xs)",
                          color: done ? "#d9ffea" : "#a0d4e4",
                        }}
                      >
                        {done
                          ? `Slot osazen: ${step.blockLabel} ✓`
                          : "Slot prazdny: pretahni dil sem nebo klikni na dil v trayi."}
                      </div>
                      <button
                        type="button"
                        data-testid={`stage0-schema-add-${step.key}`}
                        onClick={() => handleStageZeroSchemaStep(step.key)}
                        disabled={!unlocked || done}
                        style={{
                          border: "1px solid rgba(114, 219, 252, 0.5)",
                          background: done ? "rgba(25, 75, 58, 0.86)" : "linear-gradient(120deg, #21bbea, #44d8ff)",
                          color: done ? "#d7ffe5" : "#072737",
                          borderRadius: 9,
                          padding: "7px 10px",
                          fontWeight: 700,
                          cursor: !unlocked || done ? "default" : "pointer",
                        }}
                      >
                        {done ? "Pridano ✓" : `+ ${step.blockLabel}`}
                      </button>
                    </div>
                  );
                })}

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
                    Po zazehnuti jadra se vlozi 3 ukazkove civilizacni radky do gridu.
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
                      data-testid="stage0-ignite-core-button"
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
                onClick={() => {
                  setStageZeroSetupOpen(false);
                  setStageZeroDraggedSchemaKey("");
                }}
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

        {stageZeroUiVisibility.missionPanel && (
          <aside
            data-testid="stage0-mission-panel"
            role="status"
            aria-live="polite"
            style={{
              position: "fixed",
              left: 12,
              top: 12,
              zIndex: 58,
              width: "min(340px, calc(100vw - 24px))",
              borderRadius: 14,
              border: "1px solid rgba(108, 206, 240, 0.34)",
              background: "rgba(5, 13, 24, 0.82)",
              color: "#ddf7ff",
              backdropFilter: "blur(10px)",
              boxShadow: "0 0 24px rgba(34, 132, 182, 0.18)",
              padding: "10px 11px",
              display: "grid",
              gap: 8,
            }}
          >
            <div style={{ fontSize: "var(--dv-fs-2xs)", letterSpacing: "var(--dv-tr-wide)", opacity: 0.82 }}>
              PLANET BUILDER MISSION
            </div>
            <div data-testid="stage0-mission-state" style={{ fontSize: "var(--dv-fs-sm)" }}>
              Stav: <strong>{planetBuilderState}</strong>
            </div>
            <div style={{ fontSize: "var(--dv-fs-xs)", color: guidanceSeverityColor }}>
              <strong>{planetMoonGuidance.title}</strong>
            </div>
            <div style={{ fontSize: "var(--dv-fs-xs)", opacity: 0.9, lineHeight: "var(--dv-lh-base)" }}>
              {planetMoonGuidance.why}
            </div>
            <div style={{ fontSize: "var(--dv-fs-xs)", opacity: 0.8, lineHeight: "var(--dv-lh-base)" }}>
              {planetMoonGuidance.action}
            </div>
            <div style={{ display: "grid", gap: 4 }}>
              {planetBuilderChecklist.map((item) => (
                <div
                  key={item.label}
                  style={{
                    fontSize: "var(--dv-fs-2xs)",
                    opacity: item.done ? 0.95 : item.active ? 0.9 : 0.64,
                    color: item.active ? "#9defff" : undefined,
                  }}
                >
                  {item.done ? "✓" : item.active ? "→" : "○"} {item.label}
                </div>
              ))}
            </div>
            {planetBuilderState === PLANET_BUILDER_STATE.ERROR_RECOVERABLE ? (
              <button
                type="button"
                onClick={() => {
                  const recoveryResult = evaluatePlanetBuilderTransition({
                    state: planetBuilderState,
                    action: PLANET_BUILDER_ACTION.RECOVER_ERROR,
                    context: {
                      starLocked: starPolicyLocked,
                      schemaComplete: stageZeroAllSchemaStepsDone,
                      lastValidState: planetBuilderLastValidState,
                    },
                  });
                  if (!recoveryResult.allowed) {
                    setRuntimeError(buildPlanetBuilderTransitionMessage(recoveryResult));
                    return;
                  }
                  applyBuilderRecoveryState(recoveryResult.next_state || planetBuilderRecoveryState);
                }}
                style={{
                  border: "1px solid rgba(120, 217, 247, 0.38)",
                  background: "rgba(8, 22, 36, 0.74)",
                  color: "#d6f8ff",
                  borderRadius: 10,
                  padding: "8px 10px",
                  fontSize: "var(--dv-fs-xs)",
                  fontWeight: 700,
                  cursor: "pointer",
                }}
              >
                Obnovit posledni validni krok ({planetBuilderRecoveryState})
              </button>
            ) : null}
          </aside>
        )}

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
          moonRows={tableRows}
          selectedMoonId={selectedAsteroidId}
          onSelectTable={(tableId) => handlePlanetSelect(tableId, { source: "sidebar" })}
          onSelectMoon={(moonId) => {
            setSelectedAsteroidId(String(moonId || ""));
          }}
          onOpenGrid={() => setQuickGridOpen(true)}
          onRefresh={() => {
            void refreshProjection();
          }}
          onOpenStarHeart={handleOpenStarHeartDashboard}
          onBackToGalaxies={onBackToGalaxies}
          onLogout={onLogout}
          interactionLocked={workspaceInteractionLocked}
          builderState={planetBuilderState}
          builderTitle={planetMoonGuidance.title}
          builderWhy={planetMoonGuidance.why}
          builderAction={planetMoonGuidance.action}
          builderSeverity={planetMoonGuidance.severity}
          repairSuggestion={repairSuggestion}
          repairApplyBusy={repairApplyBusy}
          onApplyRepair={() => {
            void handleApplyGuidedRepair();
          }}
          repairAuditCount={repairAuditTrail.length}
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
