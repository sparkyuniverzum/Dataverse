function normalizeText(value) {
  return String(value || "").trim();
}

export function resolveParserComposerModel({ draftState = null, tableNodes = [], commandResolveTableId = "" } = {}) {
  const command =
    draftState && typeof draftState === "object" && draftState.command && typeof draftState.command === "object"
      ? draftState.command
      : {};
  const preview = command.preview && typeof command.preview === "object" ? command.preview : null;
  const ambiguityHints = Array.isArray(preview?.ambiguityHints) ? preview.ambiguityHints : [];
  const previewTasks = Array.isArray(preview?.tasks) ? preview.tasks : [];
  const previewCivilizations = Array.isArray(preview?.previewExecution?.result?.civilizations)
    ? preview.previewExecution.result.civilizations.length
    : 0;
  const previewBonds = Array.isArray(preview?.previewExecution?.result?.bonds)
    ? preview.previewExecution.result.bonds.length
    : 0;
  const resolveOptions = (Array.isArray(tableNodes) ? tableNodes : []).map((node) => ({
    id: String(node?.id || ""),
    label: `${String(node?.entityName || "")} > ${String(node?.label || "")}`.trim(),
  }));

  return {
    open: command.open === true,
    input: normalizeText(command.input),
    canPreview: command.canPreview === true,
    canExecute: command.canExecute === true,
    previewBusy: command.previewBusy === true,
    executeBusy: command.executeBusy === true,
    busy: command.busy === true,
    error: normalizeText(command.error),
    resolveSummary: normalizeText(command.resolveSummary),
    emptyStateMessage: "Vloz prikaz a klikni na Nahled.",
    preview: preview
      ? {
          action: normalizeText(preview.action),
          taskCount: previewTasks.length,
          selectedTableLabel: normalizeText(preview.selectedTableLabel),
          civilizationsCount: previewCivilizations,
          bondsCount: previewBonds,
          entities: Array.isArray(preview.entities) ? preview.entities : [],
          warnings: Array.isArray(preview.warnings) ? preview.warnings : [],
          ambiguityHints,
        }
      : null,
    resolve: {
      tableId: normalizeText(commandResolveTableId),
      options: resolveOptions,
      showAction: command.showResolveAction === true,
      showResolveToActivePlanet: command.showResolveToActivePlanet === true,
      showResolvePlanetPicker: command.showResolvePlanetPicker === true,
      canPickPlanet: Boolean(normalizeText(commandResolveTableId)) && command.busy !== true,
    },
  };
}
