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
  buildBranchPromoteUrl,
  buildOccConflictMessage,
  buildMoonImpactUrl,
  buildPresetsApplyUrl,
  buildPresetsCatalogUrl,
  buildParserPayload,
  buildStarCorePolicyLockUrl,
  buildTableContractUrl,
  isOccConflictError,
  normalizeBondType,
} from "../../lib/dataverseApi";
import {
  buildExtinguishMoonCommand,
  buildIngestMoonCommand,
  buildLinkMoonsCommand,
} from "../../lib/builderParserCommand";
import { PARSER_EXECUTION_MODE } from "../../lib/parserExecutionMode";
import { createParserTelemetrySnapshot, recordParserTelemetry } from "../../lib/parserExecutionTelemetry";
import { createWorkspaceTelemetryEvent, emitWorkspaceTelemetry } from "../../lib/workspaceTelemetry";
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
import BondBuilderPanel from "./BondBuilderPanel";
import { buildStageZeroPlanetName, mapDropPointToPlanetPosition } from "./stageZeroUtils";
import {
  STAGE_ZERO_CASHFLOW_STEPS,
  STAGE_ZERO_PRESET_CARDS,
  buildStageZeroCameraMicroNudgeKey,
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
import {
  buildVisualBuilderTransitionMessage,
  evaluateBondFlowTransition,
  resolveNavigationState,
  resolveVisualBuilderState,
  VISUAL_BUILDER_BOND_STATE,
  VISUAL_BUILDER_EVENT,
} from "./visualBuilderStateMachine";
import { useUniverseStore } from "../../store/useUniverseStore";

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
      <span style={{ fontSize: "var(--dv-fs-xs)", opacity: 0.82 }}>Základní datový kontejner</span>
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
      <div style={{ fontSize: "var(--dv-fs-sm)", fontWeight: 700 }}>Hologram planety</div>
      <div style={{ fontSize: "var(--dv-fs-xs)", opacity: 0.82 }}>Pusť mě do prostoru</div>
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

const contextMenuButtonStyle = {
  border: "1px solid rgba(113, 202, 234, 0.3)",
  background: "rgba(7, 18, 32, 0.86)",
  color: "#d5f5ff",
  borderRadius: 8,
  padding: "7px 9px",
  fontSize: "var(--dv-fs-xs)",
  lineHeight: "var(--dv-lh-base)",
  textAlign: "left",
  cursor: "pointer",
};

export default function UniverseWorkspace({
  galaxy,
  branches = [],
  onboarding = null,
  onBackToGalaxies,
  onLogout,
  onRefreshScopes = null,
  minimalShell = false,
}) {
  const galaxyId = String(galaxy?.id || "");
  const selectedBranchId = useUniverseStore((state) => String(state.selectedBranchId || ""));
  const selectBranch = useUniverseStore((state) => state.selectBranch);
  const branchIdScope = selectedBranchId || null;

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
  } = useUniverseRuntimeSync({ galaxyId, branchId: branchIdScope });

  const [busy, setBusy] = useState(false);
  const [pendingCreate, setPendingCreate] = useState(false);
  const [pendingRowOps, setPendingRowOps] = useState({});
  const [selectedTableId, setSelectedTableId] = useState("");
  const [selectedAsteroidId, setSelectedAsteroidId] = useState("");
  const [linkDraft, setLinkDraft] = useState(null);
  const [bondDraft, setBondDraft] = useState({
    state: VISUAL_BUILDER_BOND_STATE.BOND_IDLE,
    sourceId: "",
    targetId: "",
    type: "RELATION",
    preview: null,
    lastValidState: VISUAL_BUILDER_BOND_STATE.BOND_IDLE,
  });
  const [bondPreviewBusy, setBondPreviewBusy] = useState(false);
  const [bondCommitBusy, setBondCommitBusy] = useState(false);
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
  const [stageZeroPresetBundleKey, setStageZeroPresetBundleKey] = useState("");
  const [stageZeroPresetCatalog, setStageZeroPresetCatalog] = useState([]);
  const [stageZeroPresetCatalogLoading, setStageZeroPresetCatalogLoading] = useState(false);
  const [stageZeroPresetCatalogError, setStageZeroPresetCatalogError] = useState("");
  const [stageZeroSchemaDraft, setStageZeroSchemaDraft] = useState(() => createStageZeroSchemaDraft());
  const [stageZeroDraggedSchemaKey, setStageZeroDraggedSchemaKey] = useState("");
  const [stageZeroCommitBusy, setStageZeroCommitBusy] = useState(false);
  const [stageZeroCommitError, setStageZeroCommitError] = useState("");
  const [workspaceUiHydrated, setWorkspaceUiHydrated] = useState(false);
  const [planetBuilderLastValidState, setPlanetBuilderLastValidState] = useState(PLANET_BUILDER_STATE.IDLE);
  const [branchPromoteBusy, setBranchPromoteBusy] = useState(false);
  const [branchPromoteSummary, setBranchPromoteSummary] = useState("");
  const [branchCreateName, setBranchCreateName] = useState("");
  const [branchCreateBusy, setBranchCreateBusy] = useState(false);
  const [moonImpact, setMoonImpact] = useState(null);
  const [moonImpactLoading, setMoonImpactLoading] = useState(false);
  const [moonImpactError, setMoonImpactError] = useState("");
  const [contextMenu, setContextMenu] = useState({
    open: false,
    kind: "",
    id: "",
    label: "",
    x: 0,
    y: 0,
  });

  const layoutRef = useRef({ tablePositions: new Map(), asteroidPositions: new Map() });
  const workspaceRef = useRef(null);
  const lastMoonTelemetryRef = useRef("");
  const trackWorkspaceEvent = useCallback(
    (eventName, payload = {}) => {
      const event = createWorkspaceTelemetryEvent({
        eventName,
        galaxyId,
        branchId: branchIdScope,
        planetId: payload.planet_id ?? selectedTableId ?? null,
        civilizationId: payload.civilization_id ?? selectedAsteroidId ?? null,
        moonId: payload.moon_id ?? selectedAsteroidId ?? null,
        bondId: payload.bond_id ?? null,
        clientVersion: import.meta.env.VITE_APP_VERSION || "dev-local",
        flagPhase: onboarding?.mode || onboarding?.current_stage_key || "unknown",
        payload,
      });
      if (event) {
        emitWorkspaceTelemetry(event);
      }
    },
    [branchIdScope, galaxyId, onboarding?.current_stage_key, onboarding?.mode, selectedAsteroidId, selectedTableId]
  );
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
    setBondDraft({
      state: VISUAL_BUILDER_BOND_STATE.BOND_IDLE,
      sourceId: "",
      targetId: "",
      type: "RELATION",
      preview: null,
      lastValidState: VISUAL_BUILDER_BOND_STATE.BOND_IDLE,
    });
    setBondPreviewBusy(false);
    setBondCommitBusy(false);
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
    setStageZeroPresetBundleKey("");
    setStageZeroPresetCatalog([]);
    setStageZeroPresetCatalogLoading(false);
    setStageZeroPresetCatalogError("");
    setStageZeroSchemaDraft(createStageZeroSchemaDraft());
    setStageZeroDraggedSchemaKey("");
    setStageZeroCommitBusy(false);
    setStageZeroCommitError("");
    setWorkspaceUiHydrated(true);
    setPlanetBuilderLastValidState(PLANET_BUILDER_STATE.IDLE);
    setBranchPromoteBusy(false);
    setBranchPromoteSummary("");
    setBranchCreateName("");
    setBranchCreateBusy(false);
    setContextMenu({
      open: false,
      kind: "",
      id: "",
      label: "",
      x: 0,
      y: 0,
    });
    layoutRef.current = { tablePositions: new Map(), asteroidPositions: new Map() };
  }, [galaxyId]);

  useEffect(() => {
    if (!selectedBranchId) return;
    const exists = (Array.isArray(branches) ? branches : []).some(
      (item) => !item?.deleted_at && String(item?.id || "") === selectedBranchId
    );
    if (!exists) {
      selectBranch("");
    }
  }, [branches, selectBranch, selectedBranchId]);

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
  const stageZeroPresetCards = useMemo(() => {
    if (Array.isArray(stageZeroPresetCatalog) && stageZeroPresetCatalog.length > 0) {
      return stageZeroPresetCatalog.map((preset) => ({
        key: String(preset?.key || ""),
        bundleKey: String(preset?.bundle_key || preset?.key || ""),
        label: String(preset?.name || preset?.key || "Preset"),
        locked: !preset?.is_unlocked,
        lockReason: String(preset?.lock_reason || ""),
      }));
    }
    return STAGE_ZERO_PRESET_CARDS.map((preset) => ({
      ...preset,
      bundleKey: String(preset?.key || ""),
    }));
  }, [stageZeroPresetCatalog]);
  const stageZeroCommitDisabledReason = useMemo(() => {
    if (stageZeroCommitBusy) return "Aplikace presetu prave probiha.";
    if (!stageZeroPresetBundleKey) return "Nejdriv vyber preset.";
    if (!stageZeroAllSchemaStepsDone) return "Dokonci vsechny schema kroky.";
    return "";
  }, [stageZeroAllSchemaStepsDone, stageZeroCommitBusy, stageZeroPresetBundleKey]);
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
    if (!galaxyId) {
      setStageZeroPresetCatalog([]);
      setStageZeroPresetCatalogError("");
      setStageZeroPresetCatalogLoading(false);
      return undefined;
    }
    let cancelled = false;
    const run = async () => {
      setStageZeroPresetCatalogLoading(true);
      setStageZeroPresetCatalogError("");
      try {
        const response = await apiFetch(buildPresetsCatalogUrl(API_BASE, galaxyId));
        if (!response.ok) {
          throw await apiErrorFromResponse(response, `Katalog presetu nelze nacist: ${response.status}`);
        }
        const payload = await response.json().catch(() => ({}));
        const archetypes = Array.isArray(payload?.archetypes) ? payload.archetypes : [];
        const entries = archetypes.flatMap((group) => (Array.isArray(group?.presets) ? group.presets : []));
        if (cancelled) return;
        setStageZeroPresetCatalog(entries);
      } catch (catalogError) {
        if (cancelled) return;
        setStageZeroPresetCatalog([]);
        setStageZeroPresetCatalogError(catalogError?.message || "Katalog presetu nelze nacist.");
      } finally {
        if (!cancelled) {
          setStageZeroPresetCatalogLoading(false);
        }
      }
    };
    void run();
    return () => {
      cancelled = true;
    };
  }, [galaxyId]);

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

  useEffect(() => {
    const moonId = String(selectedAsteroidId || "").trim();
    if (!moonId) return;
    const dedupeKey = `${galaxyId}:${branchIdScope || ""}:${selectedTableId || ""}:${moonId}`;
    if (lastMoonTelemetryRef.current === dedupeKey) return;
    lastMoonTelemetryRef.current = dedupeKey;
    trackWorkspaceEvent("moon_opened", {
      moon_id: moonId,
      civilization_id: moonId,
      planet_id: selectedTableId || null,
    });
  }, [branchIdScope, galaxyId, selectedAsteroidId, selectedTableId, trackWorkspaceEvent]);

  useEffect(() => {
    const moonId = String(selectedAsteroidId || "").trim();
    if (!moonId) return;
    const impactItems = Array.isArray(moonImpact?.items) ? moonImpact.items : [];
    if (!impactItems.length) return;
    const impacted = impactItems.filter((item) =>
      Array.isArray(item?.impacted_civilization_ids)
        ? item.impacted_civilization_ids.some((id) => String(id) === moonId)
        : false
    );
    if (!impacted.length) return;
    const failed = impacted.find((item) => Number(item?.active_violations_count || 0) > 0) || null;
    if (!failed) return;
    trackWorkspaceEvent("moon_rule_failed", {
      moon_id: moonId,
      civilization_id: moonId,
      planet_id: selectedTableId || null,
      rule_id: failed.rule_id || null,
      capability_id: failed.capability_id || null,
      mineral_key: failed.mineral_key || null,
      expected_constraint:
        Array.isArray(failed.violation_samples) && failed.violation_samples[0]?.detail?.expected_constraint
          ? failed.violation_samples[0].detail.expected_constraint
          : null,
    });
  }, [moonImpact, selectedAsteroidId, selectedTableId, trackWorkspaceEvent]);

  useEffect(() => {
    let cancelled = false;
    if (!galaxyId || !selectedTableId) {
      setMoonImpact(null);
      setMoonImpactError("");
      setMoonImpactLoading(false);
      return () => {
        cancelled = true;
      };
    }

    const loadMoonImpact = async () => {
      setMoonImpactLoading(true);
      setMoonImpactError("");
      try {
        const response = await apiFetch(
          buildMoonImpactUrl(API_BASE, selectedTableId, {
            galaxyId,
            branchId: branchIdScope,
            includeCivilizationIds: true,
            includeViolationSamples: true,
            limit: 200,
          })
        );
        if (!response.ok) {
          throw await apiErrorFromResponse(response, "Moon impact nelze načíst");
        }
        const payload = await response.json();
        if (!cancelled) {
          setMoonImpact(payload && typeof payload === "object" ? payload : null);
        }
      } catch (loadError) {
        if (!cancelled) {
          setMoonImpact(null);
          setMoonImpactError(String(loadError?.message || "Moon impact nelze načíst"));
        }
      } finally {
        if (!cancelled) {
          setMoonImpactLoading(false);
        }
      }
    };

    void loadMoonImpact();
    return () => {
      cancelled = true;
    };
  }, [branchIdScope, galaxyId, selectedTableId]);

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
  const bondDraftOptions = useMemo(
    () =>
      tableRows.map((row) => ({
        id: String(row?.id || ""),
        label: valueToLabel(row?.value),
      })),
    [tableRows]
  );
  const visualBuilderNavigationState = useMemo(
    () =>
      resolveNavigationState({
        selectedTableId,
        selectedAsteroidId,
        selectedCivilizationId: selectedAsteroidId,
        quickGridOpen,
      }),
    [quickGridOpen, selectedAsteroidId, selectedTableId]
  );
  const visualBuilderState = useMemo(
    () =>
      resolveVisualBuilderState({
        loading,
        runtimeError: error,
        navigationState: visualBuilderNavigationState,
        bondState: bondDraft.state,
        planetBuilderState,
      }),
    [bondDraft.state, error, loading, planetBuilderState, visualBuilderNavigationState]
  );
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
  const resetBondDraft = useCallback(() => {
    setBondDraft({
      state: VISUAL_BUILDER_BOND_STATE.BOND_IDLE,
      sourceId: "",
      targetId: "",
      type: "RELATION",
      preview: null,
      lastValidState: VISUAL_BUILDER_BOND_STATE.BOND_IDLE,
    });
    setBondPreviewBusy(false);
    setBondCommitBusy(false);
  }, []);
  const applyBondTransition = useCallback(
    (event, payload = {}, updater = null) => {
      const result = evaluateBondFlowTransition({
        state: bondDraft.state,
        event,
        payload: {
          sourceId: payload?.sourceId ?? bondDraft.sourceId,
          targetId: payload?.targetId ?? bondDraft.targetId,
          type: payload?.type ?? bondDraft.type,
          previewDecision: payload?.previewDecision ?? bondDraft.preview?.decision,
          previewBlocking: payload?.previewBlocking ?? bondDraft.preview?.blocking,
          converged: payload?.converged ?? false,
        },
      });
      if (!result.allowed) {
        setRuntimeError(buildVisualBuilderTransitionMessage(result));
        return false;
      }
      setBondDraft((prev) => {
        const nextState = String(result.next_state || prev.state);
        const shouldRefreshLastValid =
          nextState !== VISUAL_BUILDER_BOND_STATE.BOND_BLOCKED &&
          nextState !== VISUAL_BUILDER_BOND_STATE.BOND_COMMITTING;
        const baseNext = {
          ...prev,
          state: nextState,
          ...(shouldRefreshLastValid ? { lastValidState: nextState } : {}),
        };
        return typeof updater === "function" ? updater(baseNext, prev) : baseNext;
      });
      return true;
    },
    [
      bondDraft.preview?.blocking,
      bondDraft.preview?.decision,
      bondDraft.sourceId,
      bondDraft.state,
      bondDraft.targetId,
      bondDraft.type,
      setRuntimeError,
    ]
  );
  const handleStartBondDraft = useCallback(
    (sourceId) => {
      const nextSourceId = String(sourceId || "").trim();
      if (!nextSourceId) return;
      const startResult = evaluateBondFlowTransition({
        state: VISUAL_BUILDER_BOND_STATE.BOND_IDLE,
        event: VISUAL_BUILDER_EVENT.START_BOND_DRAFT,
        payload: { sourceId: nextSourceId },
      });
      if (!startResult.allowed) {
        setRuntimeError(buildVisualBuilderTransitionMessage(startResult));
        return;
      }
      clearRuntimeIssue();
      setBondDraft({
        state: startResult.next_state,
        sourceId: nextSourceId,
        targetId: "",
        type: normalizeBondType(bondDraft.type || "RELATION"),
        preview: null,
        lastValidState: startResult.next_state,
      });
    },
    [bondDraft.type, clearRuntimeIssue, setRuntimeError]
  );
  const handleSelectBondTarget = useCallback(
    (targetId) => {
      const nextTargetId = String(targetId || "").trim();
      clearRuntimeIssue();
      applyBondTransition(
        VISUAL_BUILDER_EVENT.SELECT_BOND_TARGET,
        { sourceId: bondDraft.sourceId, targetId: nextTargetId },
        (next) => ({
          ...next,
          targetId: nextTargetId,
          preview: null,
        })
      );
    },
    [applyBondTransition, bondDraft.sourceId, clearRuntimeIssue]
  );
  const handleSelectBondType = useCallback((nextType) => {
    setBondDraft((prev) => ({
      ...prev,
      type: normalizeBondType(nextType || "RELATION"),
      preview: null,
    }));
  }, []);
  const primeBondDraftFromLink = useCallback(
    (payload) => {
      const sourceId = String(payload?.sourceId || "").trim();
      const targetId = String(payload?.targetId || "").trim();
      if (!sourceId || !targetId) return;
      const startResult = evaluateBondFlowTransition({
        state: VISUAL_BUILDER_BOND_STATE.BOND_IDLE,
        event: VISUAL_BUILDER_EVENT.START_BOND_DRAFT,
        payload: { sourceId },
      });
      if (!startResult.allowed) {
        setRuntimeError(buildVisualBuilderTransitionMessage(startResult));
        return;
      }
      const targetResult = evaluateBondFlowTransition({
        state: startResult.next_state,
        event: VISUAL_BUILDER_EVENT.SELECT_BOND_TARGET,
        payload: { sourceId, targetId },
      });
      if (!targetResult.allowed) {
        setRuntimeError(buildVisualBuilderTransitionMessage(targetResult));
        return;
      }
      clearRuntimeIssue();
      setBondDraft({
        state: targetResult.next_state,
        sourceId,
        targetId,
        type: "RELATION",
        preview: null,
        lastValidState: targetResult.next_state,
      });
    },
    [clearRuntimeIssue, setRuntimeError]
  );
  useEffect(() => {
    if (bondDraft.state === VISUAL_BUILDER_BOND_STATE.BOND_IDLE) return;
    const rowIds = new Set(tableRows.map((row) => String(row?.id || "")));
    const hasSource = rowIds.has(String(bondDraft.sourceId || ""));
    const hasTarget = !bondDraft.targetId || rowIds.has(String(bondDraft.targetId || ""));
    if (!hasSource || !hasTarget) {
      resetBondDraft();
    }
  }, [bondDraft.sourceId, bondDraft.state, bondDraft.targetId, resetBondDraft, tableRows]);
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
        if (!stageZeroPresetBundleKey) {
          setStageZeroPresetBundleKey("personal_cashflow");
        }
      }
    },
    [clearRuntimeIssue, stageZeroPresetBundleKey, stageZeroPresetSelected]
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
            ...(branchIdScope ? { branch_id: branchIdScope } : {}),
            idempotency_key: nextIdempotencyKey("planet-stage0"),
          }),
        });
        if (!response.ok) {
          throw await apiErrorFromResponse(response, `Planetu se nepodařilo vytvořit: ${response.status}`);
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
        setStageZeroPresetBundleKey("");
        setStageZeroSchemaDraft(createStageZeroSchemaDraft());
        setStageZeroDraggedSchemaKey("");
        setStageZeroSetupOpen(true);
      } catch (createError) {
        setRuntimeError(createError?.message || "Planetu se nepodařilo vytvořit.");
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
      branchIdScope,
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
  const handleStageZeroQuickCreatePlanet = useCallback(() => {
    if (!runBuilderGuard(PLANET_BUILDER_ACTION.START_DRAG_PLANET)) return;
    if (!runBuilderGuard(PLANET_BUILDER_ACTION.DROP_PLANET)) return;
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
    const center = {
      x: viewport.left + viewport.width * 0.5,
      y: viewport.top + viewport.height * 0.5,
      viewport,
    };
    void handleStageZeroDropPlanet(center);
  }, [handleStageZeroDropPlanet, runBuilderGuard]);

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
      const contractRead = await apiFetch(
        `${buildTableContractUrl(API_BASE, targetTableId, galaxyId)}${branchIdScope ? `&branch_id=${encodeURIComponent(branchIdScope)}` : ""}`
      );
      if (!contractRead.ok) {
        throw await apiErrorFromResponse(contractRead, `Kontrakt planety nelze načíst: ${contractRead.status}`);
      }
      return contractRead.json();
    },
    [branchIdScope, galaxyId]
  );

  const handleStageZeroCommitPreset = useCallback(async () => {
    if (
      !galaxyId ||
      !selectedTableId ||
      !selectedTable ||
      !stageZeroAllSchemaStepsDone ||
      stageZeroCommitBusy ||
      !stageZeroPresetBundleKey
    ) {
      return;
    }
    if (!runBuilderGuard(PLANET_BUILDER_ACTION.COMMIT_PRESET, { schemaComplete: stageZeroAllSchemaStepsDone })) return;
    setStageZeroCommitBusy(true);
    setStageZeroCommitError("");
    setBusy(true);
    clearRuntimeIssue();
    try {
      const applyResponse = await apiFetch(buildPresetsApplyUrl(API_BASE), {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          bundle_key: stageZeroPresetBundleKey,
          mode: "commit",
          conflict_strategy: "skip",
          seed_rows: true,
          galaxy_id: galaxyId,
          ...(branchIdScope ? { branch_id: branchIdScope } : {}),
          idempotency_key: nextIdempotencyKey("stage0-preset-commit"),
        }),
      });
      if (!applyResponse.ok) {
        throw await apiErrorFromResponse(applyResponse, `Preset se nepodarilo aplikovat: ${applyResponse.status}`);
      }

      await refreshProjection({ silent: true });
      setStageZeroSetupOpen(false);
      setQuickGridOpen(true);
    } catch (commitError) {
      setStageZeroCommitError(commitError?.message || "Preset se nepodarilo aplikovat.");
      setRuntimeError(commitError?.message || "Preset se nepodařilo aplikovat.");
    } finally {
      setStageZeroCommitBusy(false);
      setBusy(false);
    }
  }, [
    clearRuntimeIssue,
    galaxyId,
    branchIdScope,
    refreshProjection,
    runBuilderGuard,
    selectedTable,
    selectedTableId,
    setRuntimeError,
    stageZeroAllSchemaStepsDone,
    stageZeroCommitBusy,
    stageZeroPresetBundleKey,
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
        body: JSON.stringify(buildParserPayload(trimmed, galaxyId, branchIdScope)),
      });
      if (!response.ok) {
        throw await apiErrorFromResponse(response, `Parser command failed: ${response.status}`);
      }
      return response.json().catch(() => ({}));
    },
    [branchIdScope, galaxyId]
  );
  const trackParserAttempt = useCallback((details) => {
    setParserTelemetry((prev) => recordParserTelemetry(prev, details));
  }, []);

  const handleCreateLink = useCallback(
    async (payload) => {
      if (!galaxyId || !payload?.sourceId || !payload?.targetId) return;
      if (String(payload.sourceId) === String(payload.targetId)) return;
      const normalizedBondType = normalizeBondType(payload?.type || "RELATION");

      const sourceAsteroid = asteroidById.get(String(payload.sourceId));
      const targetAsteroid = asteroidById.get(String(payload.targetId));
      const sourceEventSeq = sourceAsteroid?.current_event_seq;
      const expectedSourceEventSeq = Number.isInteger(sourceEventSeq) && sourceEventSeq > 0 ? sourceEventSeq : null;
      const targetEventSeq = targetAsteroid?.current_event_seq;
      const expectedTargetEventSeq = Number.isInteger(targetEventSeq) && targetEventSeq > 0 ? targetEventSeq : null;
      let parserAttempted = false;
      let fallbackAttempted = false;
      let parserFailure = null;
      let parserTelemetryRecorded = false;

      setBusy(true);
      clearRuntimeIssue();
      try {
        const parserCommand =
          normalizedBondType === "RELATION"
            ? buildLinkMoonsCommand({
                sourceId: payload.sourceId,
                targetId: payload.targetId,
              })
            : "";
        if (parserCommand && normalizedBondType === "RELATION") {
          parserAttempted = true;
          try {
            await executeParserCommand(parserCommand);
            trackParserAttempt({ action: "LINK", parserOk: true });
            parserTelemetryRecorded = true;
            await refreshProjection({ silent: true });
            return true;
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
            type: normalizedBondType,
            galaxy_id: galaxyId,
            ...(branchIdScope ? { branch_id: branchIdScope } : {}),
            idempotency_key: nextIdempotencyKey("link"),
            ...(expectedSourceEventSeq !== null ? { expected_source_event_seq: expectedSourceEventSeq } : {}),
            ...(expectedTargetEventSeq !== null ? { expected_target_event_seq: expectedTargetEventSeq } : {}),
          }),
        });
        if (!response.ok) {
          throw await apiErrorFromResponse(response, `Vazbu se nepodařilo vytvořit: ${response.status}`);
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
        return true;
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
          setRuntimeError(buildOccConflictMessage(createError, "vytvoření vazby"));
          await refreshProjection({ silent: true });
        } else {
          reportContractViolationWithRepair(createError, {
            fallbackMessage: createError?.message || "Vazbu se nepodařilo vytvořit.",
            operation: "link",
          });
        }
        return false;
      } finally {
        setBusy(false);
      }
    },
    [
      asteroidById,
      clearRuntimeIssue,
      executeParserCommand,
      galaxyId,
      branchIdScope,
      parserExecutionMode,
      refreshProjection,
      reportContractViolationWithRepair,
      setRuntimeError,
      trackParserAttempt,
    ]
  );
  const handleRequestBondPreview = useCallback(async () => {
    if (!galaxyId) return;
    const sourceId = String(bondDraft.sourceId || "").trim();
    const targetId = String(bondDraft.targetId || "").trim();
    const bondType = normalizeBondType(bondDraft.type || "RELATION");
    if (!sourceId || !targetId) return;
    if (
      !applyBondTransition(VISUAL_BUILDER_EVENT.REQUEST_BOND_PREVIEW, {
        sourceId,
        targetId,
        type: bondType,
      })
    ) {
      return;
    }

    setBondPreviewBusy(true);
    clearRuntimeIssue();
    try {
      const sourceAsteroid = asteroidById.get(sourceId);
      const targetAsteroid = asteroidById.get(targetId);
      const sourceEventSeq = sourceAsteroid?.current_event_seq;
      const expectedSourceEventSeq = Number.isInteger(sourceEventSeq) && sourceEventSeq > 0 ? sourceEventSeq : null;
      const targetEventSeq = targetAsteroid?.current_event_seq;
      const expectedTargetEventSeq = Number.isInteger(targetEventSeq) && targetEventSeq > 0 ? targetEventSeq : null;
      const response = await apiFetch(`${API_BASE}/bonds/validate`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          operation: "create",
          source_civilization_id: sourceId,
          target_civilization_id: targetId,
          type: bondType,
          galaxy_id: galaxyId,
          ...(branchIdScope ? { branch_id: branchIdScope } : {}),
          ...(expectedSourceEventSeq !== null ? { expected_source_event_seq: expectedSourceEventSeq } : {}),
          ...(expectedTargetEventSeq !== null ? { expected_target_event_seq: expectedTargetEventSeq } : {}),
        }),
      });
      if (!response.ok) {
        throw await apiErrorFromResponse(response, `Bond preview selhal: ${response.status}`);
      }
      const previewPayload = await response.json().catch(() => ({}));
      const previewDecision = String(previewPayload?.decision || "").toUpperCase();
      const previewBlocking = Boolean(previewPayload?.blocking);
      const applied = applyBondTransition(
        VISUAL_BUILDER_EVENT.APPLY_BOND_PREVIEW_RESULT,
        {
          previewDecision,
          previewBlocking,
        },
        (next) => ({
          ...next,
          preview: previewPayload,
        })
      );
      if (!applied) return;
      const previewReasons = Array.isArray(previewPayload?.reasons) ? previewPayload.reasons : [];
      const rejectCodes = previewReasons.map((reason) => String(reason?.code || reason?.reason || "unknown"));
      const previewCrossPlanet = Boolean(
        previewPayload?.cross_planet ||
        previewReasons.some((reason) =>
          String(reason?.code || reason?.reason || "")
            .toUpperCase()
            .includes("CROSS_PLANET")
        )
      );
      if (previewDecision === "REJECT" || previewBlocking) {
        trackWorkspaceEvent("bond_preview_rejected", {
          source_civilization_id: sourceId,
          target_civilization_id: targetId,
          reject_codes: rejectCodes,
          blocking_count: previewReasons.length,
          cross_planet: previewCrossPlanet,
        });
        if (previewCrossPlanet) {
          const sourcePlanetId = asteroidById.get(sourceId)?.table_id || null;
          const targetPlanetId = asteroidById.get(targetId)?.table_id || null;
          trackWorkspaceEvent("cross_planet_blocked", {
            source_planet_id: sourcePlanetId,
            target_planet_id: targetPlanetId,
            reason_code: rejectCodes[0] || "cross_planet_blocked",
          });
        }
      } else if (previewDecision === "WARN") {
        trackWorkspaceEvent("bond_preview_warned", {
          source_civilization_id: sourceId,
          target_civilization_id: targetId,
          reject_codes: rejectCodes,
          blocking_count: previewReasons.length,
          cross_planet: previewCrossPlanet,
        });
      } else {
        trackWorkspaceEvent("bond_preview_allowed", {
          source_civilization_id: sourceId,
          target_civilization_id: targetId,
          cross_planet: previewCrossPlanet,
        });
      }
      if (previewDecision === "REJECT" || previewBlocking) {
        const firstReason = Array.isArray(previewPayload?.reasons) ? previewPayload.reasons[0] : null;
        setRuntimeError(String(firstReason?.message || "Bond preview operation blocked by validation rules."));
      }
    } catch (previewError) {
      reportContractViolationWithRepair(previewError, {
        fallbackMessage: previewError?.message || "Bond preview selhal.",
        operation: "bond_preview",
      });
      setBondDraft((prev) => ({
        ...prev,
        state: VISUAL_BUILDER_BOND_STATE.BOND_BLOCKED,
      }));
    } finally {
      setBondPreviewBusy(false);
    }
  }, [
    applyBondTransition,
    asteroidById,
    bondDraft.sourceId,
    bondDraft.targetId,
    bondDraft.type,
    clearRuntimeIssue,
    galaxyId,
    branchIdScope,
    reportContractViolationWithRepair,
    setRuntimeError,
    trackWorkspaceEvent,
  ]);
  const handleCommitBondDraft = useCallback(async () => {
    const sourceId = String(bondDraft.sourceId || "").trim();
    const targetId = String(bondDraft.targetId || "").trim();
    const bondType = normalizeBondType(bondDraft.type || "RELATION");
    const previewDecision = String(bondDraft.preview?.decision || "").toUpperCase();
    const previewBlocking = Boolean(bondDraft.preview?.blocking);
    if (
      !applyBondTransition(VISUAL_BUILDER_EVENT.CONFIRM_BOND_COMMIT, {
        sourceId,
        targetId,
        type: bondType,
        previewDecision,
        previewBlocking,
      })
    ) {
      return;
    }

    setBondCommitBusy(true);
    const committed = await handleCreateLink({
      sourceId,
      targetId,
      type: bondType,
    });
    if (!committed) {
      setBondDraft((prev) => ({
        ...prev,
        state: VISUAL_BUILDER_BOND_STATE.BOND_BLOCKED,
      }));
      setBondCommitBusy(false);
      return;
    }
    const applied = applyBondTransition(
      VISUAL_BUILDER_EVENT.RUNTIME_REFRESH,
      {
        converged: true,
      },
      (next) => ({
        ...next,
      })
    );
    if (!applied) {
      setBondCommitBusy(false);
      return;
    }
    setBondCommitBusy(false);
    setTimeout(() => {
      resetBondDraft();
    }, 200);
  }, [
    applyBondTransition,
    bondDraft.preview?.blocking,
    bondDraft.preview?.decision,
    bondDraft.sourceId,
    bondDraft.targetId,
    bondDraft.type,
    handleCreateLink,
    resetBondDraft,
  ]);

  const handleCreateRow = useCallback(
    async (value) => {
      if (!galaxyId || !selectedTableId) return false;
      const trimmed = String(value || "").trim();
      if (!trimmed) return false;

      setBusy(true);
      setPendingCreate(true);
      clearRuntimeIssue();
      try {
        // Grid write path must be deterministic for selected planet.
        // Parser-first may place row outside active planet via semantic inference.
        if (parserExecutionMode.ingest) {
          const parserCommand = buildIngestMoonCommand({
            value: trimmed,
            tableName: selectedTable?.name || tableDisplayName(selectedTable),
          });
          const parserBody = await executeParserCommand(parserCommand);
          const parserAsteroids = Array.isArray(parserBody?.asteroids) ? parserBody.asteroids : [];
          const asteroidId = parserAsteroids[0]?.id ? String(parserAsteroids[0].id) : "";
          trackParserAttempt({ action: "INGEST", parserOk: true });
          await refreshProjection({ silent: true });
          if (asteroidId) {
            setSelectedAsteroidId(asteroidId);
          }
          return true;
        }

        const tableContract = await loadTableContract(selectedTableId);
        const minerals = buildMoonCreateMinerals({
          label: trimmed,
          contract: tableContract,
        });
        if (!Object.prototype.hasOwnProperty.call(minerals, "label")) {
          minerals.label = trimmed;
        }
        const createPayload = {
          label: trimmed,
          minerals,
          planet_id: selectedTableId,
          galaxy_id: galaxyId,
          ...(branchIdScope ? { branch_id: branchIdScope } : {}),
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
          throw await apiErrorFromResponse(response, `Civilizaci se nepodařilo vytvořit: ${response.status}`);
        }
        const payload = await response.json().catch(() => ({}));
        const asteroidId = payload?.moon_id
          ? String(payload.moon_id)
          : payload?.civilization_id
            ? String(payload.civilization_id)
            : payload?.id
              ? String(payload.id)
              : "";

        await refreshProjection({ silent: true });
        if (asteroidId) {
          setSelectedAsteroidId(asteroidId);
        }
        return true;
      } catch (createError) {
        if (parserExecutionMode.ingest) {
          trackParserAttempt({
            action: "INGEST",
            parserOk: false,
            parserError: createError,
            fallbackUsed: false,
            fallbackOk: null,
          });
        }
        reportContractViolationWithRepair(createError, {
          fallbackMessage: createError?.message || "Civilizaci se nepodařilo vytvořit.",
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
      branchIdScope,
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
          ...(branchIdScope ? { branch_id: branchIdScope } : {}),
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
          throw await apiErrorFromResponse(response, `Civilizaci se nepodařilo upravit: ${response.status}`);
        }
        await refreshProjection({ silent: true });
      } catch (updateError) {
        if (isOccConflictError(updateError)) {
          setRuntimeError(buildOccConflictMessage(updateError, "úprava civilizace"));
          await refreshProjection({ silent: true });
        } else {
          reportContractViolationWithRepair(updateError, {
            fallbackMessage: updateError?.message || "Civilizaci se nepodařilo upravit.",
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
    [
      asteroidById,
      clearRuntimeIssue,
      galaxyId,
      branchIdScope,
      refreshProjection,
      reportContractViolationWithRepair,
      setRuntimeError,
    ]
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
          if (branchIdScope) {
            url.searchParams.set("branch_id", branchIdScope);
          }
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
          throw await apiErrorFromResponse(response, `Civilizaci se nepodařilo zhasnout: ${response.status}`);
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
          setRuntimeError(buildOccConflictMessage(deleteError, "zhasnutí civilizace"));
          await refreshProjection({ silent: true });
        } else {
          reportContractViolationWithRepair(deleteError, {
            fallbackMessage: deleteError?.message || "Civilizaci se nepodařilo zhasnout.",
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
      branchIdScope,
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
          ...(branchIdScope ? { branch_id: branchIdScope } : {}),
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
            ...(branchIdScope ? { branch_id: branchIdScope } : {}),
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
          throw await apiErrorFromResponse(response, `Nerost se nepodařilo uložit: ${response.status}`);
        }
        await refreshProjection({ silent: true });
        return true;
      } catch (metadataError) {
        if (isOccConflictError(metadataError)) {
          setRuntimeError(buildOccConflictMessage(metadataError, "úprava nerostu"));
          await refreshProjection({ silent: true });
        } else {
          reportContractViolationWithRepair(metadataError, {
            fallbackMessage: metadataError?.message || "Nerost se nepodařilo uložit.",
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
    [
      asteroidById,
      clearRuntimeIssue,
      galaxyId,
      branchIdScope,
      refreshProjection,
      reportContractViolationWithRepair,
      setRuntimeError,
    ]
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
      branchId: branchIdScope,
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
      trackWorkspaceEvent("guided_repair_applied", {
        civilization_id: targetId,
        moon_id: targetId,
        planet_id: selectedTableId || null,
        strategy_key: activeSuggestion.strategy_key || null,
        repair_id: activeSuggestion.repair_id || activeSuggestion.id || null,
      });
    } catch (applyError) {
      appendRepairAudit(
        buildGuidedRepairAuditRecord(activeSuggestion, {
          stage: "failed",
          errorMessage: applyError?.message || "Guided repair failed.",
        })
      );
      trackWorkspaceEvent("guided_repair_failed", {
        civilization_id: targetId,
        moon_id: targetId,
        planet_id: selectedTableId || null,
        strategy_key: activeSuggestion.strategy_key || null,
        repair_id: activeSuggestion.repair_id || activeSuggestion.id || null,
      });
      if (isOccConflictError(applyError)) {
        setRuntimeError(buildOccConflictMessage(applyError, "guided repair"));
        await refreshProjection({ silent: true });
      } else {
        reportContractViolationWithRepair(applyError, {
          fallbackMessage: applyError?.message || "Guided repair se nepodařilo aplikovat.",
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
    branchIdScope,
    refreshProjection,
    repairSuggestion,
    reportContractViolationWithRepair,
    selectedTableId,
    setRuntimeError,
    trackWorkspaceEvent,
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
  const closeContextMenu = useCallback(() => {
    setContextMenu((prev) => (prev.open ? { ...prev, open: false } : prev));
  }, []);
  const handleOpenContext = useCallback(({ kind = "", id = "", label = "", x = 0, y = 0 } = {}) => {
    const viewportWidth = typeof window !== "undefined" ? window.innerWidth : 1600;
    const viewportHeight = typeof window !== "undefined" ? window.innerHeight : 900;
    const menuWidth = 220;
    const menuHeight = 170;
    const clampedX = clamp(Number(x || 0), 8, Math.max(8, viewportWidth - menuWidth - 8));
    const clampedY = clamp(Number(y || 0), 8, Math.max(8, viewportHeight - menuHeight - 8));
    setContextMenu({
      open: true,
      kind: String(kind || ""),
      id: String(id || ""),
      label: String(label || ""),
      x: clampedX,
      y: clampedY,
    });
  }, []);
  const handleContextAction = useCallback(
    async (actionKey) => {
      const targetId = String(contextMenu.id || "").trim();
      const targetKind = String(contextMenu.kind || "").trim();
      closeContextMenu();
      if (!targetId) return;
      if (actionKey === "focus_table" && targetKind === "table") {
        handlePlanetSelect(targetId, { source: "context" });
        return;
      }
      if (actionKey === "focus_asteroid" && targetKind === "asteroid") {
        setSelectedAsteroidId(targetId);
        setQuickGridOpen(true);
        return;
      }
      if (actionKey === "open_grid") {
        if (targetKind === "table") {
          handlePlanetSelect(targetId, { source: "context" });
        } else if (targetKind === "asteroid") {
          setSelectedAsteroidId(targetId);
        }
        setQuickGridOpen(true);
        return;
      }
      if (actionKey === "extinguish_asteroid" && targetKind === "asteroid" && !workspaceInteractionLocked) {
        await handleDeleteRow(targetId);
      }
    },
    [
      closeContextMenu,
      contextMenu.id,
      contextMenu.kind,
      handleDeleteRow,
      handlePlanetSelect,
      workspaceInteractionLocked,
    ]
  );
  const handlePromoteSelectedBranch = useCallback(async () => {
    const targetBranchId = String(selectedBranchId || "").trim();
    if (!galaxyId || !targetBranchId || branchPromoteBusy) return;
    const approved =
      typeof window === "undefined"
        ? true
        : window.confirm("Promote branch do main timeline? Tato akce uzavře branch a přehraje její eventy.");
    if (!approved) return;
    setBusy(true);
    setBranchPromoteBusy(true);
    setBranchPromoteSummary("");
    clearRuntimeIssue();
    try {
      const response = await apiFetch(buildBranchPromoteUrl(API_BASE, targetBranchId, galaxyId), {
        method: "POST",
      });
      if (!response.ok) {
        throw await apiErrorFromResponse(response, `Promote branch selhal: ${response.status}`);
      }
      const promotePayload = await response.json().catch(() => ({}));
      const promotedEventsCount = Number.isFinite(Number(promotePayload?.promoted_events_count))
        ? Number(promotePayload.promoted_events_count)
        : null;
      selectBranch("");
      setBranchPromoteSummary(
        promotedEventsCount === null
          ? "Branch byl promotnut do main timeline."
          : `Branch byl promotnut (${promotedEventsCount} eventů).`
      );
      await refreshProjection({ silent: true });
      if (typeof onRefreshScopes === "function") {
        await onRefreshScopes();
      }
    } catch (promoteError) {
      setRuntimeError(promoteError?.message || "Branch se nepodařilo promotnout.");
    } finally {
      setBranchPromoteBusy(false);
      setBusy(false);
    }
  }, [
    selectedBranchId,
    galaxyId,
    branchPromoteBusy,
    clearRuntimeIssue,
    selectBranch,
    refreshProjection,
    onRefreshScopes,
    setRuntimeError,
  ]);
  const handleCreateBranch = useCallback(async () => {
    const name = String(branchCreateName || "").trim();
    if (!galaxyId || !name || branchCreateBusy) return;
    setBusy(true);
    setBranchCreateBusy(true);
    setBranchPromoteSummary("");
    clearRuntimeIssue();
    try {
      const response = await apiFetch(`${API_BASE}/branches`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name,
          galaxy_id: galaxyId,
        }),
      });
      if (!response.ok) {
        throw await apiErrorFromResponse(response, `Create branch selhal: ${response.status}`);
      }
      const payload = await response.json().catch(() => ({}));
      const createdBranchId = String(payload?.id || "").trim();
      if (createdBranchId) {
        selectBranch(createdBranchId);
      }
      setBranchCreateName("");
      if (typeof onRefreshScopes === "function") {
        await onRefreshScopes();
      }
      await refreshProjection({ silent: true });
      setBranchPromoteSummary(createdBranchId ? "Branch byl vytvořen a aktivován." : "Branch byl vytvořen.");
    } catch (createError) {
      setRuntimeError(createError?.message || "Branch se nepodařilo vytvořit.");
    } finally {
      setBranchCreateBusy(false);
      setBusy(false);
    }
  }, [
    branchCreateName,
    galaxyId,
    branchCreateBusy,
    clearRuntimeIssue,
    onRefreshScopes,
    refreshProjection,
    selectBranch,
    setRuntimeError,
  ]);

  useEffect(() => {
    if (!contextMenu.open) return undefined;
    const handleKeyDown = (event) => {
      if (event.key === "Escape") {
        closeContextMenu();
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [closeContextMenu, contextMenu.open]);

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
        const message = applyError?.message || "Star Core profil se nepodařilo uzamknout.";
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
          onOpenContext={handleOpenContext}
          onLinkStart={(draft) => setLinkDraft(draft)}
          onLinkMove={(nextPoint) =>
            setLinkDraft((prev) => {
              if (!prev) return prev;
              return { ...prev, to: nextPoint };
            })
          }
          onLinkComplete={(payload) => {
            setLinkDraft(null);
            primeBondDraftFromLink(payload);
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
              <div style={{ fontSize: "clamp(18px, 3vw, 24px)", fontWeight: 800 }}>Nejdřív nastav zákony hvězdy</div>
              <div style={{ fontSize: "var(--dv-fs-sm)", opacity: 0.9, lineHeight: "var(--dv-lh-base)" }}>
                Hvězda určuje fyzikální zákon celé galaxie. Dokud není Star Core uzamčený, není bezpečné zakládat první
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
                    label: "Zákaz tvrdého mazání (soft-delete only)",
                    impact: "Historie metrik zůstane konzistentní i po odstranění dat.",
                    done: starPolicy?.no_hard_delete !== false,
                  },
                  {
                    key: "occ",
                    label: "OCC ochrana souběhu",
                    impact: "Dva zápisy nepřepíšou stejný záznam bez varování.",
                    done: starPolicy?.occ_enforced !== false,
                  },
                  {
                    key: "idempotency",
                    label: "Idempotence příkazů",
                    impact: "Opakovaný request nevytvoří duplicitní data při retry.",
                    done: starPolicy?.idempotency_supported !== false,
                  },
                  {
                    key: "physical_profile",
                    label: "Fyzikální profil planety",
                    impact: "Určí, jak planety mění velikost, zář a degradaci při zátěži.",
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
                  Otevřít Star Heart Dashboard
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
                Prázdný vesmír čeká na první planetu
              </div>
              <div style={{ fontSize: "var(--dv-fs-sm)", opacity: 0.88, lineHeight: "var(--dv-lh-base)" }}>
                Planeta je kontejner pro data. Nejdřív ji umístíme do prostoru, potom jí nastavíme základní zákony a
                schéma.
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
                Otevřít stavebnici
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
              Tohle je tvá stavebnice. Vezmi Planetu a přetáhni ji kamkoliv do prázdného prostoru.
            </div>
            <StageZeroDraggablePlanetCard disabled={stageZeroCreating} />
            <button
              type="button"
              data-testid="stage0-quick-create-planet-button"
              onClick={handleStageZeroQuickCreatePlanet}
              disabled={stageZeroCreating}
              style={{
                border: "1px solid rgba(114, 219, 252, 0.5)",
                background: "linear-gradient(120deg, #21bbea, #44d8ff)",
                color: "#072737",
                borderRadius: 10,
                padding: "9px 10px",
                fontWeight: 700,
                cursor: stageZeroCreating ? "wait" : "pointer",
              }}
            >
              {stageZeroCreating ? "Vytvarim planetu..." : "Vytvorit planetu doprostred"}
            </button>
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
            Zhmotňuji planetu v prostoru...
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
              Výborně. <strong>{stageZeroPlanetName || "Planeta"}</strong> slouží jako kontejner pro civilizaci (řádky
              dat). Aby v ní nebyl chaos, nastavíme základní schéma krok za krokem.
            </div>
            {!stageZeroPresetSelected ? (
              <>
                <div style={{ fontSize: "var(--dv-fs-xs)", opacity: 0.82 }}>
                  Vesmír nebudujeme od nuly, používáme prověřené nákresy. Vyber si pro začátek Cashflow.
                </div>
                {stageZeroPresetCatalogLoading ? (
                  <div style={{ fontSize: "var(--dv-fs-xs)", opacity: 0.72 }}>Nacitam katalog presetu...</div>
                ) : null}
                {stageZeroPresetCatalogError ? (
                  <div style={{ fontSize: "var(--dv-fs-xs)", color: "#ffc08f" }}>
                    {stageZeroPresetCatalogError}. Pokracuji se statickym fallback katalogem.
                  </div>
                ) : null}
                <div style={{ display: "grid", gap: 8 }}>
                  {stageZeroPresetCards.map((preset) => {
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
                          setStageZeroPresetBundleKey(String(preset.bundleKey || preset.key || ""));
                          setStageZeroSchemaDraft(createStageZeroSchemaDraft());
                          setStageZeroDraggedSchemaKey("");
                          setStageZeroCommitError("");
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
                          boxShadow:
                            !locked && stageZeroPresetBundleKey === String(preset.bundleKey || preset.key || "")
                              ? "0 0 24px rgba(121, 242, 255, 0.38)"
                              : locked
                                ? "none"
                                : "0 0 18px rgba(98, 223, 255, 0.24)",
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
                    Stavební plán: skládej schéma z Lego dílků (klik nebo drag & drop).
                  </div>
                  <div style={{ display: "flex", justifyContent: "space-between", gap: 8, alignItems: "center" }}>
                    <div style={{ fontSize: "var(--dv-fs-xs)", opacity: 0.72 }}>
                      Aktivni preset:{" "}
                      <strong>
                        {stageZeroPresetCards.find(
                          (item) => String(item.bundleKey || item.key || "") === String(stageZeroPresetBundleKey || "")
                        )?.label ||
                          stageZeroPresetBundleKey ||
                          "neznamy"}
                      </strong>
                    </div>
                    <button
                      type="button"
                      data-testid="stage0-change-preset-button"
                      onClick={() => {
                        setStageZeroPresetSelected(false);
                        setStageZeroSchemaDraft(createStageZeroSchemaDraft());
                        setStageZeroDraggedSchemaKey("");
                        setStageZeroCommitError("");
                      }}
                      style={{
                        border: "1px solid rgba(114, 219, 252, 0.5)",
                        background: "rgba(8, 22, 36, 0.72)",
                        color: "#d7f7ff",
                        borderRadius: 8,
                        padding: "6px 8px",
                        fontSize: "var(--dv-fs-xs)",
                        cursor: "pointer",
                      }}
                    >
                      Zmenit preset
                    </button>
                  </div>
                  <div style={{ fontSize: "var(--dv-fs-xs)", opacity: 0.72 }}>
                    Vizuální odezva planety: {stageZeroSchemaSummary.completed}/{stageZeroSchemaSummary.total} dílků •
                    zář +{Math.round(stageZeroVisualBoost.emissiveBoost * 100)}%
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
                          : "Slot prázdný: přetáhni díl sem nebo klikni na díl v trayi."}
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
                        {done ? "Přidáno ✓" : `+ ${step.blockLabel}`}
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
                  <div style={{ fontSize: "var(--dv-fs-xs)", opacity: 0.86 }}>Průběžný preview planety</div>
                  {stageZeroSchemaPreview.map((item) => (
                    <div key={item.key} style={{ fontSize: "var(--dv-fs-xs)", opacity: item.done ? 0.96 : 0.58 }}>
                      {item.done ? "✓" : "○"} {item.label} <span style={{ opacity: 0.74 }}>({item.type})</span>
                    </div>
                  ))}
                  <div style={{ fontSize: "var(--dv-fs-xs)", opacity: 0.72 }}>
                    Po zažehnutí jádra se vloží 3 ukázkové civilizační řádky do gridu.
                  </div>
                </div>

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
                    {stageZeroAllSchemaStepsDone
                      ? "Plan je kompletni. Vytvori se struktura o 3 zakonech a nasypou se 3 ukazkove zaznamy."
                      : "Dokonci schema kroky, pak muzes zazehnout jadro."}
                  </div>
                  {stageZeroCommitDisabledReason ? (
                    <div style={{ fontSize: "var(--dv-fs-xs)", color: "#ffc08f" }}>{stageZeroCommitDisabledReason}</div>
                  ) : null}
                  {stageZeroCommitError ? (
                    <div style={{ fontSize: "var(--dv-fs-xs)", color: "#ffb4b4" }}>{stageZeroCommitError}</div>
                  ) : null}
                  <button
                    type="button"
                    data-testid="stage0-ignite-core-button"
                    onClick={() => {
                      void handleStageZeroCommitPreset();
                    }}
                    disabled={Boolean(stageZeroCommitDisabledReason)}
                    style={{
                      border: "1px solid rgba(130, 233, 255, 0.64)",
                      background: "linear-gradient(120deg, #35c1ea, #8cecff)",
                      color: "#062535",
                      borderRadius: 10,
                      padding: "9px 12px",
                      fontWeight: 800,
                      cursor: stageZeroCommitDisabledReason ? "not-allowed" : "pointer",
                      opacity: stageZeroCommitDisabledReason ? 0.64 : 1,
                    }}
                  >
                    {stageZeroCommitBusy ? "Aplikuji..." : "Zažehnout Jádro"}
                  </button>
                </div>
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
                Zavřít panel
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
                Obnovit poslední validní krok ({planetBuilderRecoveryState})
              </button>
            ) : null}
          </aside>
        )}

        <BondBuilderPanel
          open={Boolean(selectedTableId)}
          visualBuilderState={visualBuilderState}
          options={bondDraftOptions}
          selectedAsteroidId={selectedAsteroidId}
          bondState={bondDraft.state}
          sourceId={bondDraft.sourceId}
          targetId={bondDraft.targetId}
          bondType={bondDraft.type}
          preview={bondDraft.preview}
          previewBusy={bondPreviewBusy}
          commitBusy={bondCommitBusy}
          onStartDraft={handleStartBondDraft}
          onSourceChange={handleStartBondDraft}
          onTargetChange={handleSelectBondTarget}
          onTypeChange={handleSelectBondType}
          onRequestPreview={() => {
            void handleRequestBondPreview();
          }}
          onCommit={() => {
            void handleCommitBondDraft();
          }}
          onCancel={resetBondDraft}
        />

        <WorkspaceSidebar
          galaxy={galaxy}
          branches={branches}
          selectedBranchId={selectedBranchId}
          onSelectBranch={(branchId) => {
            selectBranch(branchId);
            setBranchPromoteSummary("");
            if (!branchId) {
              setBranchCreateName("");
            }
          }}
          branchCreateName={branchCreateName}
          onBranchCreateNameChange={setBranchCreateName}
          branchCreateBusy={branchCreateBusy}
          onCreateBranch={() => {
            void handleCreateBranch();
          }}
          branchPromoteBusy={branchPromoteBusy}
          branchPromoteSummary={branchPromoteSummary}
          onPromoteBranch={() => {
            void handlePromoteSelectedBranch();
          }}
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
          moonImpact={moonImpact}
          moonImpactLoading={moonImpactLoading}
          moonImpactError={moonImpactError}
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
        {contextMenu.open ? (
          <>
            <div
              role="button"
              tabIndex={-1}
              aria-label="Close context menu"
              onClick={closeContextMenu}
              onContextMenu={(event) => {
                event.preventDefault();
                closeContextMenu();
              }}
              style={{ position: "fixed", inset: 0, zIndex: 62 }}
            />
            <div
              role="menu"
              style={{
                position: "fixed",
                left: contextMenu.x,
                top: contextMenu.y,
                zIndex: 63,
                width: 216,
                borderRadius: 10,
                border: "1px solid rgba(112, 207, 240, 0.36)",
                background: "rgba(4, 12, 22, 0.95)",
                color: "#def8ff",
                boxShadow: "0 0 24px rgba(31, 128, 176, 0.28)",
                padding: 6,
                display: "grid",
                gap: 6,
              }}
            >
              <div style={{ fontSize: "var(--dv-fs-2xs)", opacity: 0.78, padding: "2px 4px" }}>
                {contextMenu.kind === "table" ? "PLANET MENU" : "CIVILIZATION MENU"}:{" "}
                <strong>{contextMenu.label || contextMenu.id}</strong>
              </div>
              {contextMenu.kind === "table" ? (
                <>
                  <button
                    type="button"
                    onClick={() => void handleContextAction("focus_table")}
                    style={contextMenuButtonStyle}
                  >
                    Fokus planety
                  </button>
                  <button
                    type="button"
                    onClick={() => void handleContextAction("open_grid")}
                    style={contextMenuButtonStyle}
                  >
                    Otevřít grid
                  </button>
                </>
              ) : null}
              {contextMenu.kind === "asteroid" ? (
                <>
                  <button
                    type="button"
                    onClick={() => void handleContextAction("focus_asteroid")}
                    style={contextMenuButtonStyle}
                  >
                    Fokus civilizace
                  </button>
                  <button
                    type="button"
                    onClick={() => void handleContextAction("open_grid")}
                    style={contextMenuButtonStyle}
                  >
                    Otevřít grid
                  </button>
                  <button
                    type="button"
                    onClick={() => void handleContextAction("extinguish_asteroid")}
                    disabled={workspaceInteractionLocked}
                    style={{ ...contextMenuButtonStyle, borderColor: "rgba(255, 161, 185, 0.4)", color: "#ffd2df" }}
                  >
                    Zhasnout civilizaci
                  </button>
                </>
              ) : null}
            </div>
          </>
        ) : null}

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
          runtimeError={error}
          onClose={() => setQuickGridOpen(false)}
          readGridCell={readGridCell}
        />

        <LinkHoverTooltip hoveredLink={hoveredLink} />
        <DragOverlay>{stageZeroDragging ? <StageZeroDragGhost /> : null}</DragOverlay>
      </DndContext>
    </main>
  );
}
