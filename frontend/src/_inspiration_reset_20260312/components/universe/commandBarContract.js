import { normalizeText } from "./workspaceFormatters";

export function inferCommandAction(command) {
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

export function buildCommandPreviewModel(command, { selectedTableLabel = "", selectedAsteroidLabel = "" } = {}) {
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

export function buildCommandAmbiguityHints(tasks, { selectedTableId = "", selectedTableName = "" } = {}) {
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

export function patchTaskToSelectedPlanet(task, { selectedTableId = "", selectedTableName = "" } = {}) {
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

export function summarizeTaskRebind(previousTasks, nextTasks, selectedTableId) {
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
