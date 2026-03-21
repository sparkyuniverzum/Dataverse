import { useState } from "react";

import {
  API_BASE,
  apiErrorFromResponse,
  apiFetch,
  buildParserPlanUrl,
  buildTaskBatchPayload,
  buildTaskExecuteBatchUrl,
} from "../../lib/dataverseApi";
import GalaxySelectionHud from "./GalaxySelectionHud.jsx";
import OperatorDock from "./OperatorDock.jsx";
import ReadGridOverlay from "./ReadGridOverlay.jsx";
import WorkspaceCommandBar from "./WorkspaceCommandBar.jsx";
import UniverseCanvas from "./UniverseCanvas.jsx";

function createIdempotencyKey(prefix) {
  if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") {
    return crypto.randomUUID();
  }
  return `${prefix}-${Date.now()}`;
}

function normalizeCommandPreview(payload) {
  const source = payload && typeof payload === "object" ? payload : {};
  const tasks = Array.isArray(source.atomic_tasks)
    ? source.atomic_tasks
    : Array.isArray(source.tasks)
      ? source.tasks
      : [];
  const becauseChain = Array.isArray(source.because_chain)
    ? source.because_chain
    : Array.isArray(source.becauseChain)
      ? source.becauseChain
      : [];
  const expectedEvents = Array.isArray(source.expected_events)
    ? source.expected_events
    : Array.isArray(source.expectedEvents)
      ? source.expectedEvents
      : [];
  const riskFlags = Array.isArray(source.risk_flags)
    ? source.risk_flags
    : Array.isArray(source.riskFlags)
      ? source.riskFlags
      : [];
  return {
    tasks,
    becauseChain: becauseChain.map((item) => String(item || "")).filter(Boolean),
    expectedEvents: expectedEvents.map((item) => String(item || "")).filter(Boolean),
    riskFlags: riskFlags.map((item) => String(item || "")).filter(Boolean),
    resolvedCommand: String(source.resolved_command || source.resolvedCommand || "").trim(),
    payload: source,
  };
}

function findPlanetObjectIdForCivilization(civilization, spaceObjects = []) {
  const tableId = String(civilization?.table_id || "").trim();
  if (!tableId) return "";
  const planetObject = (Array.isArray(spaceObjects) ? spaceObjects : []).find((item) => item.id === tableId);
  return planetObject?.id || "";
}

export default function GalaxySpaceScreen({
  defaultGalaxy = null,
  connectivity = null,
  model,
  starLayers,
  spaceObjects,
  navigationModel,
  radarModel,
  snapshotProjection,
  isCommandEnabled = false,
  onSelectObject,
  onApproachObject,
  onHeadingChange,
  onClearFocus,
  onFocusCivilization,
  onRefreshWorkspace,
  onLogout = async () => {},
}) {
  const [commandState, setCommandState] = useState({
    isOpen: false,
    command: "",
    preview: null,
    busy: false,
    error: "",
    feedback: "",
  });
  const [gridState, setGridState] = useState({
    isOpen: false,
    query: "",
    selectedCivilizationId: "",
  });

  async function handlePreviewCommand() {
    const galaxyId = String(defaultGalaxy?.id || "").trim();
    const command = String(commandState.command || "").trim();
    if (!galaxyId || !command) return;

    setCommandState((current) => ({
      ...current,
      busy: true,
      error: "",
      feedback: "",
      preview: null,
    }));

    try {
      const response = await apiFetch(buildParserPlanUrl(API_BASE), {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          query: command,
          parser_version: "v2",
          galaxy_id: galaxyId,
        }),
      });
      if (!response.ok) {
        throw await apiErrorFromResponse(response, "Parser preview selhal.");
      }
      const payload = await response.json().catch(() => null);
      const preview = normalizeCommandPreview(payload);
      setCommandState((current) => ({
        ...current,
        busy: false,
        preview,
        feedback: preview.tasks.length
          ? `Preview pripraven. Parser navrhl ${preview.tasks.length} task(s).`
          : "Preview se vratil, ale neobsahuje atomicke tasky.",
      }));
    } catch (error) {
      setCommandState((current) => ({
        ...current,
        busy: false,
        error: String(error?.message || "Preview se nepodarilo vytvorit."),
      }));
    }
  }

  async function handleCommitCommand() {
    const galaxyId = String(defaultGalaxy?.id || "").trim();
    const tasks = Array.isArray(commandState.preview?.tasks) ? commandState.preview.tasks : [];
    if (!galaxyId || !tasks.length) {
      setCommandState((current) => ({
        ...current,
        error: "Commit neni mozny bez preview s atomickymi tasky.",
      }));
      return;
    }

    setCommandState((current) => ({
      ...current,
      busy: true,
      error: "",
      feedback: "Commituji zmenu reality a obnovuji canonical truth...",
    }));

    try {
      const response = await apiFetch(buildTaskExecuteBatchUrl(API_BASE), {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(
          buildTaskBatchPayload({
            tasks,
            mode: "commit",
            galaxyId,
            idempotencyKey: createIdempotencyKey("command-commit"),
          })
        ),
      });
      if (!response.ok) {
        throw await apiErrorFromResponse(response, "Commit batch selhal.");
      }
      await onRefreshWorkspace();
      setGridState((current) => ({ ...current, isOpen: true }));
      setCommandState((current) => ({
        ...current,
        busy: false,
        feedback: "Konvergence potvrzena. Workspace byl obnoven z canonical read modelu.",
      }));
    } catch (error) {
      setCommandState((current) => ({
        ...current,
        busy: false,
        error: String(error?.message || "Commit se nepodarilo dokoncit."),
      }));
    }
  }

  function handleSelectCivilization(row) {
    const civilizationId = String(row?.id || "").trim();
    setGridState((current) => ({
      ...current,
      selectedCivilizationId: civilizationId,
    }));
    const nextObjectId = findPlanetObjectIdForCivilization(row, spaceObjects);
    if (nextObjectId) {
      onFocusCivilization(nextObjectId);
    }
  }

  return (
    <main
      data-testid="workspace-root"
      aria-label="Dataverse workspace"
      style={{
        width: "100vw",
        height: "100vh",
        position: "relative",
        overflow: "hidden",
        background:
          "radial-gradient(circle at 50% 48%, rgba(78, 46, 14, 0.26), transparent 18%), radial-gradient(circle at 50% 50%, rgba(245, 160, 44, 0.08), transparent 28%), radial-gradient(circle at 14% 18%, rgba(33, 82, 132, 0.18), transparent 26%), linear-gradient(180deg, #02050c 0%, #010309 100%)",
      }}
    >
      <div
        aria-hidden="true"
        style={{
          position: "absolute",
          inset: 0,
          backgroundImage:
            "radial-gradient(circle at 50% 50%, rgba(255, 180, 80, 0.11) 0, rgba(255, 180, 80, 0.04) 12%, transparent 30%)",
          filter: "blur(18px)",
          transform: "scale(1.2)",
        }}
      />

      {Object.values(starLayers)
        .flat()
        .map((star) => (
          <span
            key={star.id}
            aria-hidden="true"
            style={{
              position: "absolute",
              top: star.top,
              left: star.left,
              width: star.size,
              height: star.size,
              borderRadius: "999px",
              background: "#f6fbff",
              opacity: star.opacity,
              boxShadow: "0 0 10px rgba(154, 214, 255, 0.26)",
            }}
          />
        ))}

      <UniverseCanvas
        model={model}
        spaceObjects={spaceObjects}
        navigationModel={navigationModel}
        onSelectObject={onSelectObject}
        onApproachObject={onApproachObject}
        onHeadingChange={onHeadingChange}
        onClearFocus={onClearFocus}
      />
      <GalaxySelectionHud model={model} navigationModel={navigationModel} radarModel={radarModel} />
      <OperatorDock
        galaxyName={defaultGalaxy?.name || "Galaxie"}
        isOnline={connectivity?.isOnline !== false}
        isCommandEnabled={isCommandEnabled}
        isGridOpen={gridState.isOpen}
        isCommandOpen={commandState.isOpen}
        onToggleCommandBar={() =>
          setCommandState((current) =>
            isCommandEnabled
              ? { ...current, isOpen: !current.isOpen, error: "" }
              : { ...current, isOpen: true, error: "Command Bar se odemyka az po uzamceni Star Core." }
          )
        }
        onToggleGrid={() => setGridState((current) => ({ ...current, isOpen: !current.isOpen }))}
        onLogout={onLogout}
      />
      <WorkspaceCommandBar
        isOpen={commandState.isOpen}
        command={commandState.command}
        preview={commandState.preview}
        busy={commandState.busy}
        error={commandState.error}
        feedback={commandState.feedback}
        onChange={(nextCommand) =>
          setCommandState((current) => ({
            ...current,
            command: nextCommand,
            error: "",
          }))
        }
        onClose={() =>
          setCommandState((current) => ({
            ...current,
            isOpen: false,
          }))
        }
        onPreview={handlePreviewCommand}
        onCommit={handleCommitCommand}
      />
      <ReadGridOverlay
        isOpen={gridState.isOpen}
        civilizations={snapshotProjection?.civilizations || []}
        bonds={snapshotProjection?.bonds || []}
        query={gridState.query}
        selectedCivilizationId={gridState.selectedCivilizationId}
        onClose={() => setGridState((current) => ({ ...current, isOpen: false }))}
        onQueryChange={(nextQuery) => setGridState((current) => ({ ...current, query: nextQuery }))}
        onSelectCivilization={handleSelectCivilization}
      />
    </main>
  );
}
