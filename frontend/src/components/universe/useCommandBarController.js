import { useCallback, useEffect, useRef, useState } from "react";

import { apiErrorFromResponse, apiFetch, buildParserPayload, buildParserPlanUrl } from "../../lib/dataverseApi";
import { normalizeText, tableDisplayName } from "./workspaceFormatters";

function inferCommandAction(command) {
  const normalized = String(command || "")
    .trim()
    .toLowerCase();
  if (!normalized) return "OTHER";
  if (
    normalized.includes(" + ") ||
    normalized.includes("propoj") ||
    normalized.includes("vazb") ||
    normalized.includes("link")
  ) {
    return "LINK";
  }
  if (normalized.includes("zhasn") || normalized.includes("extinguish") || normalized.includes("archive")) {
    return "EXTINGUISH";
  }
  if (normalized.includes(":=") || normalized.includes("uprav") || normalized.includes("nastav")) {
    return "OTHER";
  }
  return "INGEST";
}

function buildCommandPreviewModel(command, { selectedTableLabel = "", selectedAsteroidLabel = "" } = {}) {
  const trimmed = String(command || "").trim();
  const action = inferCommandAction(trimmed);
  const entities = [...trimmed.matchAll(/"([^"]+)"/g)].map((match) => String(match[1] || "").trim()).filter(Boolean);
  const normalizedEntities = [...new Set(entities)].slice(0, 4);
  const warnings = [];
  if (!trimmed) {
    warnings.push("Prazdny prikaz nelze zpracovat.");
  }
  if (!selectedTableLabel) {
    warnings.push("Neni vybrana planeta; parser muze zvolit jiny kontext.");
  }
  return {
    command: trimmed,
    action,
    entities: normalizedEntities,
    selectedTableLabel: String(selectedTableLabel || ""),
    selectedAsteroidLabel: String(selectedAsteroidLabel || ""),
    warnings,
  };
}

function buildCommandAmbiguityHints(tasks, { selectedTableId = "", selectedTableName = "" } = {}) {
  const parsedTasks = Array.isArray(tasks) ? tasks : [];
  const hints = [];
  const selectedTableIdNormalized = String(selectedTableId || "").trim();
  const selectedTableNameNormalized = normalizeText(selectedTableName || "");
  const actions = [
    ...new Set(
      parsedTasks
        .map((task) =>
          String(task?.action || "")
            .trim()
            .toUpperCase()
        )
        .filter(Boolean)
    ),
  ];
  if (actions.length > 1) {
    hints.push({
      severity: "warning",
      message: "Plan kombinuje vice typu akci. Pred potvrzenim over dopad.",
    });
  }
  parsedTasks.forEach((task) => {
    const action = String(task?.action || "")
      .trim()
      .toUpperCase();
    const target = String(task?.target || "").trim();
    const params = task?.params && typeof task.params === "object" ? task.params : {};
    const taskTableId = String(params.table_id || params.planet_id || "").trim();
    const taskTableName = normalizeText(params.table_name || "");

    if ((action === "INGEST" || action === "EXTINGUISH") && !target && !taskTableId && !taskTableName) {
      hints.push({
        severity: "warning",
        message: `Uloha ${action} nema explicitni cil. Parser muze zvolit jiny kontext.`,
      });
    }

    if (selectedTableIdNormalized && taskTableId && taskTableId !== selectedTableIdNormalized) {
      hints.push({
        severity: "blocking",
        message: `Uloha ${action} miri na jinou planetu (${taskTableId}) nez je aktivni vyber.`,
      });
      return;
    }

    if (
      selectedTableNameNormalized &&
      taskTableName &&
      selectedTableNameNormalized !== taskTableName &&
      action !== "LINK"
    ) {
      hints.push({
        severity: "warning",
        message: `Uloha ${action} uvadi odlisny table_name (${params.table_name}).`,
      });
    }
  });

  if (!selectedTableIdNormalized && actions.includes("INGEST")) {
    hints.push({
      severity: "warning",
      message: "Neni vybrana planeta; ingest muze vytvorit radek mimo aktualni fokus.",
    });
  }

  const seen = new Set();
  return hints.filter((hint) => {
    const key = `${hint.severity}:${hint.message}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

function patchTaskToSelectedPlanet(task, { selectedTableId = "", selectedTableName = "" } = {}) {
  const action = String(task?.action || "")
    .trim()
    .toUpperCase();
  const selectedId = String(selectedTableId || "").trim();
  if (!selectedId || action === "LINK") return task;
  const params = task?.params && typeof task.params === "object" ? task.params : {};
  const taskTableId = String(params.table_id || params.planet_id || "").trim();
  if (taskTableId && taskTableId === selectedId) return task;
  return {
    ...task,
    params: {
      ...params,
      table_id: selectedId,
      planet_id: selectedId,
      ...(selectedTableName ? { table_name: selectedTableName } : {}),
    },
  };
}

function summarizeTaskRebind(previousTasks, nextTasks, selectedTableId) {
  const prev = Array.isArray(previousTasks) ? previousTasks : [];
  const next = Array.isArray(nextTasks) ? nextTasks : [];
  const selected = String(selectedTableId || "").trim();
  if (!selected || !prev.length || !next.length) return "";

  let patchedCount = 0;
  const remappedPairs = new Set();
  const len = Math.min(prev.length, next.length);
  for (let i = 0; i < len; i += 1) {
    const beforeParams = prev[i]?.params && typeof prev[i].params === "object" ? prev[i].params : {};
    const afterParams = next[i]?.params && typeof next[i].params === "object" ? next[i].params : {};
    const beforeId = String(beforeParams.table_id || beforeParams.planet_id || "").trim();
    const afterId = String(afterParams.table_id || afterParams.planet_id || "").trim();
    if (afterId === selected && beforeId !== selected) {
      patchedCount += 1;
      if (beforeId) remappedPairs.add(`${beforeId} -> ${selected}`);
    }
  }

  if (!patchedCount) return "";
  const pairList = [...remappedPairs];
  return pairList.length
    ? `Pregenerovano: ${patchedCount} uloh (${pairList.join(", ")}).`
    : `Pregenerovano: ${patchedCount} uloh na planetu ${selected}.`;
}

export function useCommandBarController({
  apiBase,
  galaxyId,
  branchIdScope,
  selectedTableId,
  selectedTable,
  selectedAsteroidLabel,
  tableNodes,
  tableById,
  executeTaskBatch,
  trackParserAttempt,
  clearRuntimeIssue,
  refreshProjection,
  nextIdempotencyKey,
}) {
  const [commandBarOpen, setCommandBarOpen] = useState(false);
  const [commandInput, setCommandInput] = useState("");
  const [commandPreview, setCommandPreview] = useState(null);
  const [commandPreviewBusy, setCommandPreviewBusy] = useState(false);
  const [commandExecuteBusy, setCommandExecuteBusy] = useState(false);
  const [commandError, setCommandError] = useState("");
  const [commandResultSummary, setCommandResultSummary] = useState("");
  const [commandResolveSummary, setCommandResolveSummary] = useState("");
  const [commandResolveTableId, setCommandResolveTableId] = useState("");
  const commandInputRef = useRef(null);

  const resetCommandBarState = useCallback(() => {
    setCommandBarOpen(false);
    setCommandInput("");
    setCommandPreview(null);
    setCommandPreviewBusy(false);
    setCommandExecuteBusy(false);
    setCommandError("");
    setCommandResultSummary("");
    setCommandResolveSummary("");
    setCommandResolveTableId("");
  }, []);

  const handleOpenCommandBar = useCallback(() => {
    setCommandBarOpen(true);
    setCommandError("");
    setCommandResolveSummary("");
    setCommandResolveTableId(String(selectedTableId || tableNodes[0]?.id || ""));
  }, [selectedTableId, tableNodes]);

  const handleCloseCommandBar = useCallback(() => {
    setCommandBarOpen(false);
    setCommandPreviewBusy(false);
    setCommandExecuteBusy(false);
    setCommandResolveSummary("");
    setCommandResolveTableId("");
  }, []);

  const handleBuildCommandPreview = useCallback(async () => {
    const trimmed = String(commandInput || "").trim();
    if (!trimmed) return;
    const actionHint = inferCommandAction(trimmed);
    setCommandPreviewBusy(true);
    setCommandError("");
    setCommandResolveSummary("");
    try {
      const previewBase = buildCommandPreviewModel(trimmed, {
        selectedTableLabel: selectedTable ? `Tabulka: ${tableDisplayName(selectedTable)}` : "",
        selectedAsteroidLabel,
      });
      const planResponse = await apiFetch(buildParserPlanUrl(apiBase), {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(buildParserPayload(trimmed, galaxyId, branchIdScope)),
      });
      if (!planResponse.ok) {
        throw await apiErrorFromResponse(planResponse, `Parser plan selhal: ${planResponse.status}`);
      }
      const planBody = await planResponse.json().catch(() => ({}));
      const tasks = Array.isArray(planBody?.tasks) ? planBody.tasks : [];
      if (!tasks.length) {
        throw new Error("Parser plan nevratil zadne ulohy.");
      }
      const ambiguityHints = buildCommandAmbiguityHints(tasks, {
        selectedTableId,
        selectedTableName: selectedTable?.name || "",
      });
      let previewExecution;
      try {
        previewExecution = await executeTaskBatch({ tasks, mode: "preview" });
      } catch (previewExecutionError) {
        throw new Error(previewExecutionError?.message || "Backend preview selhal.");
      }
      setCommandPreview({
        ...previewBase,
        tasks,
        ambiguityHints,
        previewExecution,
      });
      if (!selectedTableId) {
        setCommandResolveTableId(String(tableNodes[0]?.id || ""));
      }
      trackParserAttempt({ action: actionHint, parserOk: true });
    } catch (previewError) {
      trackParserAttempt({
        action: actionHint,
        parserOk: false,
        parserError: previewError,
        fallbackUsed: false,
        fallbackOk: null,
      });
      setCommandPreview(null);
      const rawMessage = String(previewError?.message || "").trim();
      const normalizedMessage = rawMessage.toLowerCase();
      if (normalizedMessage.includes("parser plan")) {
        setCommandError(rawMessage || "Parser plan selhal.");
      } else if (normalizedMessage.includes("task batch preview") || normalizedMessage.includes("backend preview")) {
        setCommandError(rawMessage || "Backend preview selhal.");
      } else {
        setCommandError(rawMessage || "Nahled se nepodarilo ziskat.");
      }
    } finally {
      setCommandPreviewBusy(false);
    }
  }, [
    apiBase,
    branchIdScope,
    commandInput,
    executeTaskBatch,
    galaxyId,
    selectedAsteroidLabel,
    selectedTableId,
    selectedTable,
    tableNodes,
    trackParserAttempt,
  ]);

  const handleResolveCommandAmbiguity = useCallback(
    async (forcedTableId = "") => {
      if (!commandPreview) return;
      const resolvedTableId = String(forcedTableId || selectedTableId || commandResolveTableId || "").trim();
      if (!resolvedTableId) {
        setCommandError("Vyber planetu, na kterou se ma plan navazat.");
        return;
      }
      const resolvedTable = tableById.get(resolvedTableId) || null;
      const selectedTableName = resolvedTable?.name || "";
      const patchedTasks = (Array.isArray(commandPreview.tasks) ? commandPreview.tasks : []).map((task) =>
        patchTaskToSelectedPlanet(task, {
          selectedTableId: resolvedTableId,
          selectedTableName,
        })
      );
      setCommandPreviewBusy(true);
      setCommandError("");
      try {
        const ambiguityHints = buildCommandAmbiguityHints(patchedTasks, {
          selectedTableId: resolvedTableId,
          selectedTableName,
        });
        const previewExecution = await executeTaskBatch({ tasks: patchedTasks, mode: "preview" });
        const resolveSummary = summarizeTaskRebind(commandPreview.tasks, patchedTasks, resolvedTableId);
        setCommandPreview((prev) => {
          if (!prev) return prev;
          return {
            ...prev,
            selectedTableLabel: resolvedTable ? `Tabulka: ${tableDisplayName(resolvedTable)}` : prev.selectedTableLabel,
            tasks: patchedTasks,
            ambiguityHints,
            previewExecution,
          };
        });
        setCommandResolveTableId(resolvedTableId);
        setCommandResolveSummary(resolveSummary);
      } catch (resolveError) {
        setCommandError(resolveError?.message || "Backend preview selhal po uprave planu.");
      } finally {
        setCommandPreviewBusy(false);
      }
    },
    [commandPreview, commandResolveTableId, executeTaskBatch, selectedTableId, tableById]
  );

  const handleExecuteCommandBar = useCallback(async () => {
    const trimmed = String(commandInput || "").trim();
    if (!trimmed || commandExecuteBusy || !commandPreview?.tasks?.length) return;

    setCommandExecuteBusy(true);
    setCommandError("");
    clearRuntimeIssue();
    try {
      const commitBody = await executeTaskBatch({
        tasks: commandPreview.tasks,
        mode: "commit",
        idempotencyKey: nextIdempotencyKey("command-bar-commit"),
      });
      await refreshProjection({ silent: true });
      const result = commitBody?.result && typeof commitBody.result === "object" ? commitBody.result : {};
      const tasksCount = Array.isArray(result?.tasks) ? result.tasks.length : 0;
      const civilizationsCount = Array.isArray(result?.civilizations) ? result.civilizations.length : 0;
      const bondsCount = Array.isArray(result?.bonds) ? result.bonds.length : 0;
      setCommandResultSummary(
        `Prikaz proveden: uloh ${tasksCount}, civilizaci ${civilizationsCount}, vazeb ${bondsCount}.`
      );
      setCommandBarOpen(false);
      setCommandInput("");
      setCommandPreview(null);
      setCommandResolveSummary("");
    } catch (executeError) {
      setCommandError(executeError?.message || "Prikaz se nepodarilo vykonat.");
    } finally {
      setCommandExecuteBusy(false);
    }
  }, [
    clearRuntimeIssue,
    commandExecuteBusy,
    commandInput,
    commandPreview,
    executeTaskBatch,
    nextIdempotencyKey,
    refreshProjection,
  ]);

  useEffect(() => {
    const onKeyDown = (event) => {
      const key = String(event?.key || "").toLowerCase();
      const openShortcut = (event.metaKey || event.ctrlKey) && !event.altKey && key === "k";
      if (openShortcut) {
        event.preventDefault();
        setCommandBarOpen(true);
        setCommandError("");
        return;
      }
      if (commandBarOpen && key === "escape") {
        event.preventDefault();
        handleCloseCommandBar();
      }
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [commandBarOpen, handleCloseCommandBar]);

  useEffect(() => {
    if (!commandBarOpen) return;
    if (typeof commandInputRef.current?.focus === "function") {
      commandInputRef.current.focus();
    }
  }, [commandBarOpen]);

  return {
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
  };
}
