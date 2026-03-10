import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { DndContext, DragOverlay, PointerSensor, useSensor, useSensors } from "@dnd-kit/core";

import {
  API_BASE,
  apiErrorFromResponse,
  apiFetch,
  buildOccConflictMessage,
  buildMoonImpactUrl,
  buildPlanetExtinguishUrl,
  buildPresetsApplyUrl,
  buildPresetsCatalogUrl,
  buildParserPayload,
  buildTaskExecuteBatchUrl,
  buildTableContractUrl,
  buildStarCorePolicyLockUrl,
  isOccConflictError,
} from "../../lib/dataverseApi";
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
import { ParserComposerModal } from "./ParserComposerModal";
import { resolveEntityLaws, resolveLinkLaws, resolveStarCoreProfile } from "./lawResolver";
import { resolveParserComposerModel } from "./parserComposerContract";
import QuickGridOverlay from "./QuickGridOverlay";
import StarHeartDashboard from "./StarHeartDashboard";
import UniverseCanvas from "./UniverseCanvas";
import { useUniverseRuntimeSync } from "./useUniverseRuntimeSync";
import WorkspaceSidebar from "./WorkspaceSidebar";
import { WorkspaceContextMenu } from "./WorkspaceContextMenu";
import BondBuilderPanel from "./BondBuilderPanel";
import { resolveDragCenter, StageZeroDraggablePlanetCard, StageZeroDragGhost, StageZeroDropZone } from "./StageZeroDnd";
import { buildStageZeroPlanetName, mapDropPointToPlanetPosition } from "./stageZeroUtils";
import {
  STAGE_ZERO_CASHFLOW_STEPS,
  STAGE_ZERO_PRESET_CARDS,
  buildStageZeroCameraMicroNudgeKey,
  buildStageZeroSchemaPreview,
  createStageZeroSchemaDraft,
  isStageZeroStepUnlocked,
  resolveStageZeroStepsForArchetype,
  resolveStageZeroPlanetVisualBoost,
  summarizeStageZeroSchemaDraft,
} from "./stageZeroBuilder";
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
import {
  buildPlanetBuilderConsistencyMessage,
  shouldWarnPlanetBuilderConsistency,
} from "./planetBuilderConsistencyGuard";
import { resolvePlanetBuilderUiState } from "./planetBuilderUiState";
import {
  observeReducedMotionPreference,
  readReducedMotionPreference,
  resolvePreviewSeverityColor,
  resolveWorkspaceKeyboardAction,
} from "./previewAccessibility";
import { useRuntimeConnectivityState } from "./runtimeConnectivityState";
import { buildContractViolationMessage } from "./workspaceContractExplainability";
import {
  buildGuidedRepairApplyFailEvent,
  buildGuidedRepairApplyOkEvent,
  buildGuidedRepairSuggestedEvent,
  buildMoonImpactErrorEvent,
  buildMoonImpactLoadEvent,
  buildMoonImpactReadyEvent,
} from "./workflowEventBridge";
import { readWorkspaceUiState, writeWorkspaceUiState } from "./workspaceUiPersistence";
import { collectGridColumns, normalizeText, readGridCell, valueToLabel } from "./workspaceFormatters";
import { resolveNavigationState, resolveVisualBuilderState } from "./visualBuilderStateMachine";
import { useCommandBarController } from "./useCommandBarController";
import { useMoonCrudController } from "./useMoonCrudController";
import { useBondDraftController } from "./useBondDraftController";
import { useBranchTimelineController } from "./useBranchTimelineController";
import { StageZeroSetupPanel } from "./StageZeroSetupPanel";
import { StageZeroSetupPanelProvider } from "./StageZeroSetupPanelContext";
import { buildMergedTableContractPayload } from "./tableContractMerge";
import { resolveDraftRailState } from "./draftRailContract";
import { resolveGridCanvasTruthModel } from "./gridCanvasTruthContract";
import { resolveBranchSelectionTransition, resolveBranchVisibilityModel } from "./branchVisibilityContract";
import { formatSelectedTableLabel, resolveSelectionInspectorModel } from "./selectionInspectorContract";
import {
  resolveContextActionPlan,
  resolveContextMenuPlacement,
  resolveMoonSelectionPatch,
} from "./selectionContextContract";
import { resolveWorkspaceStateContract } from "./workspaceStateContract";
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
const STAGE_ZERO_ASSEMBLY_MODE = Object.freeze({
  LEGO: "lego",
  MANUAL: "manual",
});

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
  onRefreshScopes = null,
  minimalShell = false,
}) {
  const galaxyId = String(galaxy?.id || "");
  const runtimeConnectivity = useRuntimeConnectivityState();
  const selectedBranchId = useUniverseStore((state) => String(state.selectedBranchId || ""));
  const selectBranch = useUniverseStore((state) => state.selectBranch);
  const branchVisibility = useMemo(
    () => resolveBranchVisibilityModel({ branches, selectedBranchId }),
    [branches, selectedBranchId]
  );
  const branchIdScope = branchVisibility.selectedBranchId || null;

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
    recentStreamEvents,
    setRuntimeError,
    clearRuntimeError,
    refreshProjection,
    refreshStarTelemetry,
  } = useUniverseRuntimeSync({ galaxyId, branchId: branchIdScope });

  const [busy, setBusy] = useState(false);
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
  const [runtimeWorkflowEvents, setRuntimeWorkflowEvents] = useState([]);
  const [stageZeroFlow, setStageZeroFlow] = useState(STAGE_ZERO_FLOW.INTRO);
  const [stageZeroDragging, setStageZeroDragging] = useState(false);
  const [stageZeroDropHover, setStageZeroDropHover] = useState(false);
  const [stageZeroCreating, setStageZeroCreating] = useState(false);
  const [stageZeroSetupOpen, setStageZeroSetupOpen] = useState(false);
  const [stageZeroPlanetName, setStageZeroPlanetName] = useState("");
  const [stageZeroPresetSelected, setStageZeroPresetSelected] = useState(false);
  const [stageZeroPresetBundleKey, setStageZeroPresetBundleKey] = useState("");
  const [stageZeroAssemblyMode, setStageZeroAssemblyMode] = useState(STAGE_ZERO_ASSEMBLY_MODE.LEGO);
  const [stageZeroPresetCatalog, setStageZeroPresetCatalog] = useState([]);
  const [stageZeroPresetCatalogLoading, setStageZeroPresetCatalogLoading] = useState(false);
  const [stageZeroPresetCatalogError, setStageZeroPresetCatalogError] = useState("");
  const [stageZeroSchemaDraft, setStageZeroSchemaDraft] = useState(() => createStageZeroSchemaDraft());
  const [stageZeroDraggedSchemaKey, setStageZeroDraggedSchemaKey] = useState("");
  const [stageZeroCommitBusy, setStageZeroCommitBusy] = useState(false);
  const [stageZeroCommitError, setStageZeroCommitError] = useState("");
  const [workspaceUiHydrated, setWorkspaceUiHydrated] = useState(false);
  const [planetBuilderLastValidState, setPlanetBuilderLastValidState] = useState(PLANET_BUILDER_STATE.IDLE);
  const [moonImpact, setMoonImpact] = useState(null);
  const [moonImpactLoading, setMoonImpactLoading] = useState(false);
  const [moonImpactError, setMoonImpactError] = useState("");
  const [selectedTableContract, setSelectedTableContract] = useState(null);
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
    setRuntimeWorkflowEvents([]);
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
    if (branchVisibility.shouldResetSelection) {
      selectBranch("");
    }
  }, [branchVisibility.shouldResetSelection, selectBranch]);

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
  const stageZeroPresetCards = useMemo(() => {
    if (Array.isArray(stageZeroPresetCatalog) && stageZeroPresetCatalog.length > 0) {
      return stageZeroPresetCatalog.map((preset) => ({
        key: String(preset?.key || ""),
        bundleKey: String(preset?.bundle_key || preset?.key || ""),
        label: String(preset?.name || preset?.key || "Preset"),
        archetype: String(preset?.archetype || "stream"),
        locked: !preset?.is_unlocked,
        lockReason: String(preset?.lock_reason || ""),
      }));
    }
    return STAGE_ZERO_PRESET_CARDS.map((preset) => ({
      ...preset,
      bundleKey: String(preset?.key || ""),
    }));
  }, [stageZeroPresetCatalog]);
  const stageZeroSelectedPreset = useMemo(
    () =>
      stageZeroPresetCards.find(
        (item) => String(item.bundleKey || item.key || "") === String(stageZeroPresetBundleKey || "")
      ) || null,
    [stageZeroPresetBundleKey, stageZeroPresetCards]
  );
  const stageZeroSteps = useMemo(
    () => resolveStageZeroStepsForArchetype(stageZeroSelectedPreset?.archetype),
    [stageZeroSelectedPreset?.archetype]
  );
  const stageZeroSchemaSummary = useMemo(
    () => summarizeStageZeroSchemaDraft(stageZeroSchemaDraft, stageZeroSteps),
    [stageZeroSchemaDraft, stageZeroSteps]
  );
  const stageZeroAllSchemaStepsDone = stageZeroSchemaSummary.allDone;
  const stageZeroSchemaPreview = useMemo(
    () => buildStageZeroSchemaPreview(stageZeroSchemaDraft, stageZeroSteps),
    [stageZeroSchemaDraft, stageZeroSteps]
  );
  const stageZeroCommitDisabledReason = useMemo(() => {
    if (stageZeroCommitBusy) return "Aplikace presetu prave probiha.";
    if (!stageZeroPresetBundleKey) return "Nejdriv vyber preset.";
    if (!stageZeroAllSchemaStepsDone) return "Dokonci vsechny schema kroky.";
    return "";
  }, [stageZeroAllSchemaStepsDone, stageZeroCommitBusy, stageZeroPresetBundleKey]);
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
  const planetBuilderUiState = useMemo(
    () =>
      resolvePlanetBuilderUiState({
        planetBuilderState,
        recoveryState: planetBuilderRecoveryState,
        stageZeroCreating,
        stageZeroDropMode,
        stageZeroCommitBusy,
        selectedTableId,
        selectedAsteroidId,
        stageZeroPresetSelected,
        hasPlanets,
        legacyStageZeroActive: stageZeroActive,
        legacySetupOpen: stageZeroSetupOpen,
      }),
    [
      hasPlanets,
      planetBuilderRecoveryState,
      planetBuilderState,
      selectedAsteroidId,
      selectedTableId,
      stageZeroActive,
      stageZeroCommitBusy,
      stageZeroCreating,
      stageZeroDropMode,
      stageZeroPresetSelected,
      stageZeroSetupOpen,
    ]
  );
  const stageZeroUiVisibility = planetBuilderUiState.visibility;
  const workspaceInteractionLocked = planetBuilderUiState.workspaceInteractionLocked;
  const stageZeroVisualBoost = useMemo(
    () =>
      resolveStageZeroPlanetVisualBoost(stageZeroSchemaDraft, {
        enabled: planetBuilderUiState.setupPanelOpen && stageZeroPresetSelected,
        steps: stageZeroSteps,
      }),
    [planetBuilderUiState.setupPanelOpen, stageZeroPresetSelected, stageZeroSchemaDraft, stageZeroSteps]
  );
  const stageZeroCameraMicroNudgeKey = useMemo(
    () =>
      buildStageZeroCameraMicroNudgeKey({
        setupOpen: planetBuilderUiState.setupPanelOpen,
        presetSelected: stageZeroPresetSelected,
        tableId: selectedTableId,
        completed: stageZeroSchemaSummary.completed,
      }),
    [planetBuilderUiState.setupPanelOpen, selectedTableId, stageZeroPresetSelected, stageZeroSchemaSummary.completed]
  );

  useEffect(() => {
    if (planetBuilderState !== PLANET_BUILDER_STATE.ERROR_RECOVERABLE) {
      setPlanetBuilderLastValidState(planetBuilderState);
    }
  }, [planetBuilderState]);

  useEffect(() => {
    if (!import.meta.env.DEV) return;
    if (!shouldWarnPlanetBuilderConsistency({ violations: planetBuilderUiState.invariantViolations })) return;
    console.warn(
      buildPlanetBuilderConsistencyMessage({
        violations: planetBuilderUiState.invariantViolations,
        state: planetBuilderUiState.state,
        effectiveState: planetBuilderUiState.effectiveState,
      })
    );
  }, [planetBuilderUiState.effectiveState, planetBuilderUiState.invariantViolations, planetBuilderUiState.state]);

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
    const waitingForProjectionBootstrap = planetBuilderUiState.stageZeroActive && quickGridOpen && loading;
    if (waitingForProjectionBootstrap) {
      return;
    }
    if (!planetBuilderUiState.stageZeroActive) {
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
    if (planetBuilderUiState.stageZeroRequiresStarLock) {
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
  }, [
    loading,
    planetBuilderUiState.stageZeroActive,
    planetBuilderUiState.stageZeroRequiresStarLock,
    quickGridOpen,
    stageZeroFlow,
  ]);

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

  const appendRuntimeWorkflowEvent = useCallback((eventItem) => {
    if (!eventItem || typeof eventItem !== "object") return;
    const eventId = String(eventItem.id || "").trim();
    if (!eventId) return;
    setRuntimeWorkflowEvents((prev) => {
      if (prev.some((item) => String(item?.id || "").trim() === eventId)) return prev;
      return [eventItem, ...prev].slice(0, 48);
    });
  }, []);

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
      appendRuntimeWorkflowEvent(
        buildMoonImpactLoadEvent({
          planetLabel: selectedTableId,
        })
      );
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
          appendRuntimeWorkflowEvent(
            buildMoonImpactReadyEvent({
              planetLabel: selectedTableId,
              payload,
            })
          );
        }
      } catch (loadError) {
        if (!cancelled) {
          setMoonImpact(null);
          setMoonImpactError(String(loadError?.message || "Moon impact nelze načíst"));
          appendRuntimeWorkflowEvent(
            buildMoonImpactErrorEvent({
              planetLabel: selectedTableId,
              errorMessage: loadError?.message || "Moon impact nelze načíst",
            })
          );
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
  }, [appendRuntimeWorkflowEvent, branchIdScope, galaxyId, selectedTableId]);

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
          planetBuilderUiState.builderTargetEnabled && String(selectedTableId || "") === String(node.id || "");
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
      planetBuilderUiState.builderTargetEnabled,
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
  const loadSelectedTableContract = useCallback(
    async (tableId) => {
      const targetTableId = String(tableId || "").trim();
      if (!targetTableId || !galaxyId) {
        setSelectedTableContract(null);
        return null;
      }
      const response = await apiFetch(
        `${buildTableContractUrl(API_BASE, targetTableId, galaxyId)}${branchIdScope ? `&branch_id=${encodeURIComponent(branchIdScope)}` : ""}`
      );
      if (!response.ok) {
        throw await apiErrorFromResponse(response, `Kontrakt planety nelze nacist: ${response.status}`);
      }
      const body = await response.json().catch(() => null);
      setSelectedTableContract(body && typeof body === "object" ? body : null);
      return body;
    },
    [branchIdScope, galaxyId]
  );
  useEffect(() => {
    if (!selectedTableId || !galaxyId) {
      setSelectedTableContract(null);
      return;
    }
    let cancelled = false;
    loadSelectedTableContract(selectedTableId).catch(() => {
      if (!cancelled) setSelectedTableContract(null);
    });
    return () => {
      cancelled = true;
    };
  }, [galaxyId, loadSelectedTableContract, selectedTableId]);
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
  const gridCanvasTruth = useMemo(
    () =>
      resolveGridCanvasTruthModel({
        selectedTableId,
        selectedCivilizationId: selectedAsteroidId,
        tableRows,
        quickGridOpen,
      }),
    [quickGridOpen, selectedAsteroidId, selectedTableId, tableRows]
  );

  useEffect(() => {
    if (gridCanvasTruth.shouldClearScopedCivilization) {
      setSelectedAsteroidId("");
      return;
    }
    if (
      gridCanvasTruth.shouldAutoSelectFirstCivilization &&
      gridCanvasTruth.firstSelectableCivilizationId &&
      gridCanvasTruth.firstSelectableCivilizationId !== String(selectedAsteroidId || "").trim()
    ) {
      setSelectedAsteroidId(gridCanvasTruth.firstSelectableCivilizationId);
    }
  }, [
    gridCanvasTruth.firstSelectableCivilizationId,
    gridCanvasTruth.shouldAutoSelectFirstCivilization,
    gridCanvasTruth.shouldClearScopedCivilization,
    selectedAsteroidId,
  ]);

  const selectionInspectorModel = useMemo(
    () =>
      resolveSelectionInspectorModel({
        selectedTable,
        selectedCivilizationId: gridCanvasTruth.selectedCivilizationId,
        civilizationRows: tableRows,
        civilizationById: asteroidById,
        moonImpact,
      }),
    [asteroidById, gridCanvasTruth.selectedCivilizationId, moonImpact, selectedTable, tableRows]
  );
  const selectedAsteroidLabel = selectionInspectorModel.selectedCivilizationLabel;
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
        selectedAsteroidId: gridCanvasTruth.selectedCivilizationId,
        selectedCivilizationId: gridCanvasTruth.selectedCivilizationId,
        quickGridOpen,
      }),
    [gridCanvasTruth.selectedCivilizationId, quickGridOpen, selectedTableId]
  );
  const planetMoonGuidance = useMemo(
    () =>
      resolvePlanetMoonCausalGuidance({
        planetBuilderNarrative,
        stageZeroActive: planetBuilderUiState.stageZeroActive,
        stageZeroSetupOpen: planetBuilderUiState.setupPanelOpen,
        stageZeroPresetSelected,
        stageZeroSchemaSummary,
        stageZeroAllSchemaStepsDone,
        stageZeroCommitBusy,
        quickGridOpen,
        selectedTable,
        selectedPlanetNode: selectedTableNode,
        selectedMoonNode: gridCanvasTruth.selectedCivilizationId ? selectedAsteroidNode : null,
        selectedMoonLabel: selectedAsteroidLabel,
        stageZeroStepDefinitions: STAGE_ZERO_CASHFLOW_STEPS,
      }),
    [
      planetBuilderNarrative,
      planetBuilderUiState.setupPanelOpen,
      planetBuilderUiState.stageZeroActive,
      quickGridOpen,
      selectedAsteroidLabel,
      gridCanvasTruth.selectedCivilizationId,
      selectedAsteroidNode,
      selectedTable,
      selectedTableNode,
      stageZeroAllSchemaStepsDone,
      stageZeroCommitBusy,
      stageZeroPresetSelected,
      stageZeroSchemaSummary,
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
        appendRuntimeWorkflowEvent(
          buildGuidedRepairSuggestedEvent({
            suggestion,
          })
        );
      }
      setRuntimeError(suggestion ? `${message} | ${buildGuidedRepairMessage(suggestion)}` : message);
    },
    [appendRepairAudit, appendRuntimeWorkflowEvent, setRuntimeError]
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
        if (!stageZeroPresetBundleKey) {
          const fallbackPreset =
            stageZeroPresetCards.find((item) => !item?.locked) ||
            STAGE_ZERO_PRESET_CARDS.find((item) => !item?.locked) ||
            null;
          const fallbackBundleKey = String(fallbackPreset?.bundleKey || fallbackPreset?.key || "").trim();
          if (fallbackBundleKey) {
            setStageZeroPresetBundleKey(fallbackBundleKey);
            setStageZeroSchemaDraft(
              createStageZeroSchemaDraft(resolveStageZeroStepsForArchetype(fallbackPreset?.archetype))
            );
          }
        }
      }
    },
    [clearRuntimeIssue, stageZeroPresetBundleKey, stageZeroPresetCards, stageZeroPresetSelected]
  );

  const handleCreatePlanetAtDrop = useCallback(
    async (dropPayload, { allowOutsideStageZero = false, openSetupPanel = true } = {}) => {
      if (!galaxyId || stageZeroCreating) return;
      if (
        !allowOutsideStageZero &&
        (!planetBuilderUiState.stageZeroActive || planetBuilderUiState.stageZeroRequiresStarLock)
      ) {
        return;
      }
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
        if (openSetupPanel) {
          setStageZeroFlow(STAGE_ZERO_FLOW.COMPLETE);
          setStageZeroPresetSelected(false);
          setStageZeroPresetBundleKey("");
          setStageZeroSchemaDraft(createStageZeroSchemaDraft());
          setStageZeroDraggedSchemaKey("");
          setStageZeroSetupOpen(true);
        } else {
          setStageZeroSetupOpen(false);
        }
        return { ok: true, message: `Planeta '${planetName}' byla vytvorena.` };
      } catch (createError) {
        setRuntimeError(createError?.message || "Planetu se nepodařilo vytvořit.");
        if (!allowOutsideStageZero) {
          setStageZeroFlow(STAGE_ZERO_FLOW.BLUEPRINT);
        }
        return { ok: false, message: createError?.message || "Planetu se nepodarilo vytvorit." };
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
      planetBuilderUiState.stageZeroActive,
      planetBuilderUiState.stageZeroRequiresStarLock,
      refreshProjection,
      setRuntimeError,
      stageZeroCreating,
      branchIdScope,
      tableNodes.length,
    ]
  );
  const resolveWorkspaceViewportCenter = useCallback(() => {
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
    return {
      x: viewport.left + viewport.width * 0.5,
      y: viewport.top + viewport.height * 0.5,
      viewport,
    };
  }, []);

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
      void handleCreatePlanetAtDrop({
        ...(center || fallbackPoint),
        viewport,
      });
    },
    [handleCreatePlanetAtDrop, runBuilderGuard, stageZeroCreating]
  );
  const handleStageZeroQuickCreatePlanet = useCallback(() => {
    if (!runBuilderGuard(PLANET_BUILDER_ACTION.START_DRAG_PLANET)) return;
    if (!runBuilderGuard(PLANET_BUILDER_ACTION.DROP_PLANET)) return;
    const center = resolveWorkspaceViewportCenter();
    void handleCreatePlanetAtDrop(center);
  }, [handleCreatePlanetAtDrop, resolveWorkspaceViewportCenter, runBuilderGuard]);
  const handleAddPlanetFromSidebar = useCallback(() => {
    if (!galaxyId || stageZeroCreating) return;
    const center = resolveWorkspaceViewportCenter();
    void handleCreatePlanetAtDrop(center, { allowOutsideStageZero: true, openSetupPanel: false });
  }, [galaxyId, handleCreatePlanetAtDrop, resolveWorkspaceViewportCenter, stageZeroCreating]);
  const handleCreatePlanetFromOverlay = useCallback(async () => {
    if (!galaxyId || stageZeroCreating) {
      return { ok: false, message: "Planetu ted nelze vytvorit." };
    }
    const center = resolveWorkspaceViewportCenter();
    return handleCreatePlanetAtDrop(center, { allowOutsideStageZero: true, openSetupPanel: false });
  }, [galaxyId, handleCreatePlanetAtDrop, resolveWorkspaceViewportCenter, stageZeroCreating]);
  const handleExtinguishPlanet = useCallback(
    async (tableId) => {
      const targetTableId = String(tableId || "").trim();
      if (!galaxyId || !targetTableId) {
        return { ok: false, message: "Vyber planetu pro extinguish." };
      }
      const targetTable =
        (Array.isArray(tables) ? tables : []).find((item) => String(item?.table_id || "") === String(targetTableId)) ||
        null;
      const targetRowsCount =
        targetTable && Array.isArray(targetTable?.members)
          ? targetTable.members.length
          : targetTableId === String(selectedTableId || "")
            ? tableRows.length
            : 0;
      if (targetRowsCount > 0) {
        return { ok: false, message: "Extinguish planety je povoleny jen pro prazdnou planetu (0 civilizaci)." };
      }

      setBusy(true);
      clearRuntimeIssue();
      try {
        const response = await apiFetch(
          buildPlanetExtinguishUrl(API_BASE, targetTableId, {
            galaxyId,
            ...(branchIdScope ? { branchId: branchIdScope } : {}),
          }),
          { method: "PATCH" }
        );
        if (!response.ok) {
          throw await apiErrorFromResponse(response, `Extinguish planety selhal: ${response.status}`);
        }
        await response.json().catch(() => null);
        await refreshProjection({ silent: true });
        setSelectedTableId("");
        setSelectedAsteroidId("");
        setQuickGridOpen(false);
        return { ok: true, message: "Planeta byla extinguishnuta." };
      } catch (extinguishError) {
        return { ok: false, message: extinguishError?.message || "Extinguish planety selhal." };
      } finally {
        setBusy(false);
      }
    },
    [
      branchIdScope,
      clearRuntimeIssue,
      galaxyId,
      refreshProjection,
      selectedTableId,
      setQuickGridOpen,
      setSelectedAsteroidId,
      setSelectedTableId,
      tableRows.length,
      tables,
    ]
  );
  const handleApplyTableContractFromOverlay = useCallback(
    async (fields = []) => {
      const targetTableId = String(selectedTableId || "").trim();
      if (!galaxyId || !targetTableId) {
        return { ok: false, message: "Vyber planetu pro contract update." };
      }
      const normalizedFields = (Array.isArray(fields) ? fields : [])
        .map((item) => ({
          fieldKey: String(item?.fieldKey || "").trim(),
          fieldType: String(item?.fieldType || "string")
            .trim()
            .toLowerCase(),
        }))
        .filter((item) => Boolean(item.fieldKey));
      if (!normalizedFields.length) {
        return { ok: false, message: "Schema composer je prazdny." };
      }

      setBusy(true);
      clearRuntimeIssue();
      try {
        const existingContract =
          selectedTableContract && String(selectedTable?.table_id || "") === String(targetTableId)
            ? selectedTableContract
            : await loadSelectedTableContract(targetTableId).catch(() => null);
        const payload = buildMergedTableContractPayload({
          galaxyId,
          existingContract,
          composerFields: normalizedFields,
        });
        const response = await apiFetch(`${API_BASE}/contracts/${targetTableId}`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        });
        if (!response.ok) {
          throw await apiErrorFromResponse(response, `Schema kontrakt se nepodarilo ulozit: ${response.status}`);
        }
        await response.json().catch(() => null);
        await refreshProjection({ silent: true });
        await loadSelectedTableContract(targetTableId).catch(() => null);
        return { ok: true, message: "Schema kontrakt byl ulozen." };
      } catch (contractError) {
        return { ok: false, message: contractError?.message || "Schema kontrakt se nepodarilo ulozit." };
      } finally {
        setBusy(false);
      }
    },
    [
      clearRuntimeIssue,
      galaxyId,
      loadSelectedTableContract,
      refreshProjection,
      selectedTable,
      selectedTableContract,
      selectedTableId,
    ]
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
      if (!isStageZeroStepUnlocked(targetIndex, stageZeroSchemaDraft, stageZeroSteps)) return;
      if (stageZeroDraggedSchemaKey && stageZeroDraggedSchemaKey !== normalizedKey) {
        return;
      }
      handleStageZeroSchemaStep(normalizedKey);
    },
    [
      handleStageZeroSchemaStep,
      stageZeroDraggedSchemaKey,
      stageZeroPresetSelected,
      stageZeroSchemaDraft,
      stageZeroSteps,
    ]
  );
  const handleStageZeroSelectPreset = useCallback(
    (preset) => {
      const locked = Boolean(preset?.locked);
      if (locked) return;
      if (!runBuilderGuard(PLANET_BUILDER_ACTION.SELECT_PRESET)) return;
      setStageZeroPresetSelected(true);
      setStageZeroPresetBundleKey(String(preset?.bundleKey || preset?.key || ""));
      setStageZeroSchemaDraft(createStageZeroSchemaDraft(resolveStageZeroStepsForArchetype(preset?.archetype)));
      setStageZeroAssemblyMode(STAGE_ZERO_ASSEMBLY_MODE.LEGO);
      setStageZeroDraggedSchemaKey("");
      setStageZeroCommitError("");
    },
    [runBuilderGuard]
  );
  const handleStageZeroChangePreset = useCallback(() => {
    setStageZeroPresetSelected(false);
    setStageZeroSchemaDraft(createStageZeroSchemaDraft());
    setStageZeroAssemblyMode(STAGE_ZERO_ASSEMBLY_MODE.LEGO);
    setStageZeroDraggedSchemaKey("");
    setStageZeroCommitError("");
  }, []);
  const handleCloseStageZeroSetupPanel = useCallback(() => {
    setStageZeroSetupOpen(false);
    setStageZeroDraggedSchemaKey("");
  }, []);

  const handleStageZeroCommitPreset = useCallback(
    async ({ manualFields = [] } = {}) => {
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
      if (!runBuilderGuard(PLANET_BUILDER_ACTION.COMMIT_PRESET, { schemaComplete: stageZeroAllSchemaStepsDone }))
        return;
      setStageZeroCommitBusy(true);
      setStageZeroCommitError("");
      setBusy(true);
      clearRuntimeIssue();
      try {
        if (stageZeroAssemblyMode === STAGE_ZERO_ASSEMBLY_MODE.MANUAL) {
          const validManualFields = (Array.isArray(manualFields) ? manualFields : [])
            .map((item) => ({
              fieldKey: String(item?.fieldKey || "").trim(),
              fieldType:
                String(item?.fieldType || "string")
                  .trim()
                  .toLowerCase() || "string",
            }))
            .filter((item) => Boolean(item.fieldKey));
          if (!validManualFields.length) {
            throw new Error("V rucnim rezimu dopln alespon jeden schema dilek.");
          }
          const existingContract =
            selectedTableContract && String(selectedTable?.table_id || "") === String(selectedTableId)
              ? selectedTableContract
              : await loadSelectedTableContract(selectedTableId).catch(() => null);
          const payload = buildMergedTableContractPayload({
            galaxyId,
            existingContract,
            composerFields: validManualFields,
          });
          const upsertResponse = await apiFetch(`${API_BASE}/contracts/${selectedTableId}`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(payload),
          });
          if (!upsertResponse.ok) {
            throw await apiErrorFromResponse(
              upsertResponse,
              `Schema kontrakt se nepodarilo ulozit: ${upsertResponse.status}`
            );
          }
        } else {
          const applyResponse = await apiFetch(buildPresetsApplyUrl(API_BASE), {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              bundle_key: stageZeroPresetBundleKey,
              mode: "commit",
              conflict_strategy: "skip",
              seed_rows: true,
              galaxy_id: galaxyId,
              planet_id: selectedTableId,
              ...(branchIdScope ? { branch_id: branchIdScope } : {}),
              idempotency_key: nextIdempotencyKey("stage0-preset-commit"),
            }),
          });
          if (!applyResponse.ok) {
            throw await apiErrorFromResponse(applyResponse, `Preset se nepodarilo aplikovat: ${applyResponse.status}`);
          }
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
    },
    [
      clearRuntimeIssue,
      galaxyId,
      branchIdScope,
      refreshProjection,
      runBuilderGuard,
      selectedTable,
      selectedTableContract,
      selectedTableId,
      setRuntimeError,
      stageZeroAllSchemaStepsDone,
      stageZeroAssemblyMode,
      stageZeroCommitBusy,
      stageZeroPresetBundleKey,
      loadSelectedTableContract,
    ]
  );
  const stageZeroSetupPanelValue = useMemo(
    () => ({
      stageZeroPlanetName,
      stageZeroPresetSelected,
      stageZeroPresetCatalogLoading,
      stageZeroPresetCatalogError,
      stageZeroPresetCards,
      stageZeroPresetBundleKey,
      stageZeroAssemblyMode,
      stageZeroSchemaDraft,
      stageZeroSteps,
      stageZeroDraggedSchemaKey,
      stageZeroSchemaSummary,
      stageZeroVisualBoost,
      stageZeroSchemaPreview,
      stageZeroAllSchemaStepsDone,
      stageZeroCommitDisabledReason,
      stageZeroCommitError,
      stageZeroCommitBusy,
      stageZeroExistingContract: selectedTableContract,
      onClearCommitError: () => setStageZeroCommitError(""),
      onSelectPreset: handleStageZeroSelectPreset,
      onChangePreset: handleStageZeroChangePreset,
      onSchemaBlockDragStart: handleStageZeroSchemaBlockDragStart,
      onSchemaBlockDragEnd: handleStageZeroSchemaBlockDragEnd,
      onSchemaStep: handleStageZeroSchemaStep,
      onSchemaBlockDrop: handleStageZeroSchemaBlockDrop,
      onResetDraggedSchemaKey: handleStageZeroSchemaBlockDragEnd,
      onAssemblyModeChange: setStageZeroAssemblyMode,
      onCommitPreset: handleStageZeroCommitPreset,
    }),
    [
      handleStageZeroChangePreset,
      handleStageZeroCommitPreset,
      handleStageZeroSchemaBlockDragEnd,
      handleStageZeroSchemaBlockDragStart,
      handleStageZeroSchemaBlockDrop,
      handleStageZeroSchemaStep,
      handleStageZeroSelectPreset,
      selectedTableContract,
      stageZeroAllSchemaStepsDone,
      stageZeroAssemblyMode,
      stageZeroCommitBusy,
      stageZeroCommitDisabledReason,
      stageZeroCommitError,
      stageZeroDraggedSchemaKey,
      stageZeroPlanetName,
      stageZeroPresetBundleKey,
      stageZeroPresetCards,
      stageZeroPresetCatalogError,
      stageZeroPresetCatalogLoading,
      stageZeroPresetSelected,
      stageZeroSchemaDraft,
      stageZeroSchemaPreview,
      stageZeroSchemaSummary,
      stageZeroSteps,
      stageZeroVisualBoost,
    ]
  );

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
  const executeTaskBatch = useCallback(
    async ({ tasks, mode = "preview", idempotencyKey = null }) => {
      const payload = {
        mode,
        tasks: Array.isArray(tasks) ? tasks : [],
        galaxy_id: galaxyId || null,
        ...(branchIdScope ? { branch_id: branchIdScope } : {}),
        ...(idempotencyKey ? { idempotency_key: idempotencyKey } : {}),
      };
      const response = await apiFetch(buildTaskExecuteBatchUrl(API_BASE), {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      if (!response.ok) {
        throw await apiErrorFromResponse(response, `Task batch ${mode} failed: ${response.status}`);
      }
      return response.json().catch(() => ({}));
    },
    [branchIdScope, galaxyId]
  );
  const trackParserAttempt = useCallback((details) => {
    setParserTelemetry((prev) => recordParserTelemetry(prev, details));
  }, []);
  const {
    commandBarOpen,
    commandInput,
    commandPreview,
    commandPreviewBusy,
    commandExecuteBusy,
    commandError,
    commandResultSummary,
    commandResolveSummary,
    commandResolveTableId,
    commandInputRef,
    setCommandInput,
    setCommandResolveTableId,
    handleOpenCommandBar,
    handleCloseCommandBar,
    handleBuildCommandPreview,
    handleResolveCommandAmbiguity,
    handleExecuteCommandBar,
    resetCommandBarState,
  } = useCommandBarController({
    apiBase: API_BASE,
    galaxyId,
    branchIdScope,
    selectedTableId,
    selectedTable,
    selectedTableLabel: selectionInspectorModel.selectedTableLabel,
    selectedAsteroidLabel,
    tableNodes,
    tableById,
    executeTaskBatch,
    trackParserAttempt,
    clearRuntimeIssue,
    refreshProjection,
    nextIdempotencyKey,
  });
  useEffect(() => {
    resetCommandBarState();
  }, [galaxyId, resetCommandBarState]);

  const {
    pendingCreate,
    pendingRowOps,
    handleCreateRow,
    handleUpdateRow,
    handleDeleteRow,
    handleUpsertMetadata,
    resetMoonCrudState,
  } = useMoonCrudController({
    apiBase: API_BASE,
    galaxyId,
    branchIdScope,
    selectedTableId,
    selectedAsteroidId,
    asteroidById,
    setSelectedAsteroidId,
    setBusy,
    clearRuntimeIssue,
    refreshProjection,
    reportContractViolationWithRepair,
    setRuntimeError,
    executeParserCommand,
    trackParserAttempt,
    parserExecutionMode,
    nextIdempotencyKey,
  });
  const {
    bondDraft,
    bondPreviewBusy,
    bondCommitBusy,
    handleStartBondDraft,
    handleSelectBondTarget,
    handleSelectBondType,
    primeBondDraftFromLink,
    handleRequestBondPreview,
    handleCommitBondDraft,
    resetBondDraft,
    resetBondDraftState,
  } = useBondDraftController({
    apiBase: API_BASE,
    galaxyId,
    branchIdScope,
    asteroidById,
    tableRows,
    setBusy,
    clearRuntimeIssue,
    refreshProjection,
    reportContractViolationWithRepair,
    setRuntimeError,
    executeParserCommand,
    trackParserAttempt,
    trackWorkspaceEvent,
    parserExecutionMode,
    nextIdempotencyKey,
  });
  const {
    branchPromoteBusy,
    branchPromoteSummary,
    setBranchPromoteSummary,
    branchCreateName,
    setBranchCreateName,
    branchCreateBusy,
    resetBranchTimelineState,
    handlePromoteSelectedBranch,
    handleCreateBranch,
  } = useBranchTimelineController({
    apiBase: API_BASE,
    galaxyId,
    selectedBranchId: branchVisibility.selectedBranchId,
    setBusy,
    clearRuntimeIssue,
    refreshProjection,
    onRefreshScopes,
    setRuntimeError,
    selectBranch,
  });
  const draftRailState = useMemo(
    () =>
      resolveDraftRailState({
        command: {
          commandBarOpen,
          commandInput,
          commandPreview,
          commandPreviewBusy,
          commandExecuteBusy,
          commandError,
          commandResultSummary,
          commandResolveSummary,
          selectedTableId,
        },
        bond: {
          bondDraft,
          bondPreviewBusy,
          bondCommitBusy,
        },
      }),
    [
      bondCommitBusy,
      bondDraft,
      bondPreviewBusy,
      commandBarOpen,
      commandError,
      commandExecuteBusy,
      commandInput,
      commandPreview,
      commandPreviewBusy,
      commandResolveSummary,
      commandResultSummary,
      selectedTableId,
    ]
  );
  const parserComposer = useMemo(
    () =>
      resolveParserComposerModel({
        draftState: draftRailState,
        tableNodes,
        commandResolveTableId,
      }),
    [commandResolveTableId, draftRailState, tableNodes]
  );
  const visualBuilderState = useMemo(
    () =>
      resolveVisualBuilderState({
        loading,
        runtimeError: error,
        navigationState: visualBuilderNavigationState,
        bondState: draftRailState.bond.state,
        planetBuilderState,
      }),
    [draftRailState.bond.state, error, loading, planetBuilderState, visualBuilderNavigationState]
  );
  const workspaceState = useMemo(
    () =>
      resolveWorkspaceStateContract({
        scope: {
          galaxyId,
          selectedBranchId: branchVisibility.selectedBranchId,
          historicalMode: false,
        },
        selection: {
          selectedTableId,
          selectedAsteroidId: gridCanvasTruth.selectedCivilizationId,
          quickGridOpen,
        },
        draft: {
          commandBarOpen: draftRailState.command.open,
          commandPreviewBusy: draftRailState.command.previewBusy,
          commandExecuteBusy: draftRailState.command.executeBusy,
          commandError: draftRailState.command.error,
          pendingCreate,
          pendingRowOps,
          bondDraftState: draftRailState.bond.state,
          bondPreviewBusy: draftRailState.bond.previewBusy,
          bondCommitBusy: draftRailState.bond.commitBusy,
          branchCreateBusy,
          branchPromoteBusy,
          stageZeroCommitBusy,
        },
        sync: {
          loading,
          error,
          runtimeConnectivity,
        },
      }),
    [
      branchCreateBusy,
      branchPromoteBusy,
      draftRailState.bond.commitBusy,
      draftRailState.bond.previewBusy,
      draftRailState.bond.state,
      draftRailState.command.error,
      draftRailState.command.executeBusy,
      draftRailState.command.open,
      draftRailState.command.previewBusy,
      error,
      galaxyId,
      loading,
      pendingCreate,
      pendingRowOps,
      quickGridOpen,
      runtimeConnectivity,
      gridCanvasTruth.selectedCivilizationId,
      branchVisibility.selectedBranchId,
      selectedTableId,
      stageZeroCommitBusy,
    ]
  );
  useEffect(() => {
    resetMoonCrudState();
    resetBondDraftState();
  }, [galaxyId, resetBondDraftState, resetMoonCrudState]);
  useEffect(() => {
    resetBranchTimelineState();
  }, [galaxyId, resetBranchTimelineState]);

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
      appendRuntimeWorkflowEvent(
        buildGuidedRepairApplyOkEvent({
          suggestion: activeSuggestion,
        })
      );
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
      appendRuntimeWorkflowEvent(
        buildGuidedRepairApplyFailEvent({
          suggestion: activeSuggestion,
          errorMessage: applyError?.message || "Guided repair failed.",
        })
      );
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
    appendRuntimeWorkflowEvent,
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
  const handleMoonSelect = useCallback(
    (moonId, { openGrid = false } = {}) => {
      const selectionPatch = resolveMoonSelectionPatch({
        moonId,
        previousQuickGridOpen: quickGridOpen,
        openGrid,
      });
      setSelectedAsteroidId(selectionPatch.selectedAsteroidId);
      setQuickGridOpen(selectionPatch.quickGridOpen);
    },
    [quickGridOpen]
  );
  const closeContextMenu = useCallback(() => {
    setContextMenu((prev) => (prev.open ? { ...prev, open: false } : prev));
  }, []);
  const handleOpenContext = useCallback(({ kind = "", id = "", label = "", x = 0, y = 0 } = {}) => {
    setContextMenu(
      resolveContextMenuPlacement({
        kind,
        id,
        label,
        x,
        y,
        viewportWidth: typeof window !== "undefined" ? window.innerWidth : 1600,
        viewportHeight: typeof window !== "undefined" ? window.innerHeight : 900,
      })
    );
  }, []);
  const handleContextAction = useCallback(
    async (actionKey) => {
      const plan = resolveContextActionPlan({
        actionKey,
        contextMenu,
        interactionLocked: workspaceInteractionLocked,
        previousQuickGridOpen: quickGridOpen,
      });
      closeContextMenu();
      if (plan.type === "noop") return;
      if (plan.type === "selection") {
        if (Object.prototype.hasOwnProperty.call(plan.patch || {}, "selectedTableId")) {
          setSelectedTableId(String(plan.patch.selectedTableId || ""));
        }
        if (Object.prototype.hasOwnProperty.call(plan.patch || {}, "selectedAsteroidId")) {
          setSelectedAsteroidId(String(plan.patch.selectedAsteroidId || ""));
        }
        if (Object.prototype.hasOwnProperty.call(plan.patch || {}, "quickGridOpen")) {
          setQuickGridOpen(Boolean(plan.patch.quickGridOpen));
        }
        return;
      }
      if (plan.type === "delete_asteroid") {
        await handleDeleteRow(plan.targetId);
      }
    },
    [closeContextMenu, contextMenu, handleDeleteRow, quickGridOpen, workspaceInteractionLocked]
  );
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
      if (commandBarOpen) return;
      const action = resolveWorkspaceKeyboardAction(event, {
        canOpenGrid: Boolean(selectedTableId) && !workspaceInteractionLocked,
        canOpenStarHeart: true,
        quickGridOpen,
        starHeartOpen,
        stageZeroSetupOpen: planetBuilderUiState.setupPanelOpen,
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
    commandBarOpen,
    planetBuilderUiState.setupPanelOpen,
    starHeartOpen,
    workspaceInteractionLocked,
  ]);

  const selectedTableLabel = selectionInspectorModel.selectedTableLabel || formatSelectedTableLabel(selectedTable);
  const guidanceSeverityColor = resolvePreviewSeverityColor(planetMoonGuidance.severity);

  return (
    <main
      ref={workspaceRef}
      data-testid="workspace-root"
      data-workspace-attention={workspaceState.overallAttention}
      data-workspace-branch-mode={workspaceState.scope.branchMode}
      data-workspace-time-mode={workspaceState.scope.timeMode}
      data-workspace-selection={workspaceState.selection.selectionKind}
      data-workspace-surface-mode={workspaceState.mode.surfaceMode}
      data-workspace-draft={workspaceState.draft.hasActiveDraft ? "active" : "idle"}
      data-workspace-active-rail={draftRailState.activeRail}
      data-workspace-sync-attention={workspaceState.sync.attention}
      data-reduced-motion={reducedMotion ? "true" : "false"}
      aria-label="Dataverse workspace"
      style={{ width: "100vw", height: "100vh", position: "relative", overflow: "hidden", background: "#020205" }}
    >
      <div style={{ position: "fixed", left: 12, top: 12, zIndex: 62, display: "grid", gap: 6 }}>
        <button
          type="button"
          data-testid="workspace-open-command-bar"
          onClick={handleOpenCommandBar}
          style={{
            border: "1px solid rgba(118, 209, 243, 0.42)",
            background: "rgba(5, 14, 26, 0.9)",
            color: "#d9f8ff",
            borderRadius: 10,
            padding: "8px 10px",
            fontSize: "var(--dv-fs-xs)",
            cursor: "pointer",
          }}
        >
          Prikazovy radek (Ctrl/Cmd+K)
        </button>
        {draftRailState.summary ? (
          <div
            data-testid="workspace-command-result-summary"
            style={{
              border: "1px solid rgba(118, 209, 243, 0.3)",
              background: "rgba(6, 18, 30, 0.74)",
              color: "#d9f8ff",
              borderRadius: 8,
              padding: "6px 8px",
              fontSize: "var(--dv-fs-2xs)",
              maxWidth: 320,
            }}
          >
            {draftRailState.summary}
          </div>
        ) : null}
      </div>

      <ParserComposerModal
        composer={parserComposer}
        commandInputRef={commandInputRef}
        commandInput={commandInput}
        onCommandInputChange={setCommandInput}
        onPreview={() => {
          void handleBuildCommandPreview();
        }}
        onExecute={() => {
          void handleExecuteCommandBar();
        }}
        onClose={handleCloseCommandBar}
        onResolveToActivePlanet={() => {
          void handleResolveCommandAmbiguity();
        }}
        onResolveTableChange={setCommandResolveTableId}
        onResolveToPickedPlanet={() => {
          void handleResolveCommandAmbiguity(commandResolveTableId);
        }}
      />

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
          selectedAsteroidId={gridCanvasTruth.selectedCivilizationId}
          cameraFocusOffset={planetBuilderUiState.cameraFocusOffset}
          cameraMicroNudgeKey={stageZeroCameraMicroNudgeKey}
          linkDraft={linkDraft}
          builderDropActive={stageZeroUiVisibility.dropZone}
          builderDropHover={stageZeroDropHover}
          hideMouseGuide={minimalShell}
          reducedMotion={reducedMotion}
          onSelectStar={handleStarSelect}
          onOpenStarControlCenter={handleOpenStarHeartDashboard}
          onClearStarFocus={handleClearStarFocus}
          onSelectTable={(tableId) => handlePlanetSelect(tableId, { source: "canvas" })}
          onSelectAsteroid={(asteroidId) => {
            handleMoonSelect(asteroidId);
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
          <StageZeroSetupPanelProvider value={stageZeroSetupPanelValue}>
            <StageZeroSetupPanel onClose={handleCloseStageZeroSetupPanel} />
          </StageZeroSetupPanelProvider>
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
          selectedAsteroidId={gridCanvasTruth.selectedCivilizationId}
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
          branches={branchVisibility.visibleBranches}
          selectedBranchId={branchVisibility.selectedBranchId}
          onSelectBranch={(branchId) => {
            const transition = resolveBranchSelectionTransition({
              nextBranchId: branchId,
              branchCreateName,
            });
            selectBranch(transition.selectedBranchId);
            if (transition.shouldClearPromoteSummary) {
              setBranchPromoteSummary("");
            }
            if (transition.shouldClearBranchCreateName) {
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
          selectionInspector={selectionInspectorModel}
          moonImpactLoading={moonImpactLoading}
          moonImpactError={moonImpactError}
          onSelectTable={(tableId) => handlePlanetSelect(tableId, { source: "sidebar" })}
          onSelectMoon={(moonId) => {
            handleMoonSelect(moonId);
          }}
          onOpenGrid={() => setQuickGridOpen(true)}
          onAddPlanet={() => {
            void handleAddPlanetFromSidebar();
          }}
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
          runtimeConnectivity={runtimeConnectivity}
        />
        <WorkspaceContextMenu
          contextMenu={contextMenu}
          interactionLocked={workspaceInteractionLocked}
          onClose={closeContextMenu}
          onAction={handleContextAction}
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
          selectedTableId={selectedTableId}
          tableOptions={tables}
          tableContract={selectedTableContract}
          backendStreamEvents={recentStreamEvents}
          runtimeWorkflowEvents={runtimeWorkflowEvents}
          tableRows={tableRows}
          gridColumns={gridColumns}
          gridFilteredRows={gridFilteredRows}
          gridSearchQuery={gridSearchQuery}
          onGridSearchChange={setGridSearchQuery}
          onSelectTable={(tableId) => handlePlanetSelect(tableId, { source: "grid" })}
          onCreatePlanet={handleCreatePlanetFromOverlay}
          onExtinguishPlanet={handleExtinguishPlanet}
          onApplyTableContract={handleApplyTableContractFromOverlay}
          selectedAsteroidId={gridCanvasTruth.selectedCivilizationId}
          onSelectRow={(rowId) => {
            handleMoonSelect(rowId);
          }}
          onCreateRow={handleCreateRow}
          onUpdateRow={handleUpdateRow}
          onDeleteRow={handleDeleteRow}
          onUpsertMetadata={handleUpsertMetadata}
          pendingCreate={pendingCreate}
          pendingRowOps={pendingRowOps}
          busy={busy}
          runtimeError={error}
          runtimeConnectivity={runtimeConnectivity}
          onClose={() => setQuickGridOpen(false)}
          readGridCell={readGridCell}
        />

        <LinkHoverTooltip hoveredLink={hoveredLink} />
        <DragOverlay>{stageZeroDragging ? <StageZeroDragGhost /> : null}</DragOverlay>
      </DndContext>
    </main>
  );
}
