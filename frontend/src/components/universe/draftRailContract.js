import { VISUAL_BUILDER_BOND_STATE } from "./visualBuilderStateMachine";

function normalizeText(value) {
  return String(value || "").trim();
}

export function resolveCommandDraftState({
  commandBarOpen = false,
  commandInput = "",
  commandPreview = null,
  commandPreviewBusy = false,
  commandExecuteBusy = false,
  commandError = "",
  commandResultSummary = "",
  commandResolveSummary = "",
  selectedTableId = "",
} = {}) {
  const normalizedInput = normalizeText(commandInput);
  const preview = commandPreview && typeof commandPreview === "object" ? commandPreview : null;
  const ambiguityHints = Array.isArray(preview?.ambiguityHints) ? preview.ambiguityHints : [];
  const hasBlockingHints = ambiguityHints.some(
    (hint) =>
      String(hint?.severity || "")
        .trim()
        .toLowerCase() === "blocking"
  );
  const previewCommand = normalizeText(preview?.command);

  return {
    open: Boolean(commandBarOpen),
    input: normalizedInput,
    preview,
    previewBusy: Boolean(commandPreviewBusy),
    executeBusy: Boolean(commandExecuteBusy),
    busy: Boolean(commandPreviewBusy || commandExecuteBusy),
    error: normalizeText(commandError),
    resultSummary: normalizeText(commandResultSummary),
    resolveSummary: normalizeText(commandResolveSummary),
    hasPreview: Boolean(preview),
    hasBlockingHints,
    previewStale: Boolean(preview && previewCommand !== normalizedInput),
    canPreview: Boolean(normalizedInput) && !commandPreviewBusy && !commandExecuteBusy,
    canExecute: Boolean(
      normalizedInput &&
      preview &&
      !commandPreviewBusy &&
      !commandExecuteBusy &&
      !hasBlockingHints &&
      previewCommand === normalizedInput
    ),
    showResolveAction: Boolean(hasBlockingHints),
    showResolveToActivePlanet: Boolean(hasBlockingHints && normalizeText(selectedTableId)),
    showResolvePlanetPicker: Boolean(hasBlockingHints && !normalizeText(selectedTableId)),
  };
}

export function resolveBondDraftRailState({ bondDraft = null, bondPreviewBusy = false, bondCommitBusy = false } = {}) {
  const safeBondDraft = bondDraft && typeof bondDraft === "object" ? bondDraft : {};
  const state = normalizeText(safeBondDraft.state) || VISUAL_BUILDER_BOND_STATE.BOND_IDLE;
  return {
    state,
    sourceId: normalizeText(safeBondDraft.sourceId),
    targetId: normalizeText(safeBondDraft.targetId),
    type: normalizeText(safeBondDraft.type) || "RELATION",
    preview: safeBondDraft.preview && typeof safeBondDraft.preview === "object" ? safeBondDraft.preview : null,
    previewBusy: Boolean(bondPreviewBusy),
    commitBusy: Boolean(bondCommitBusy),
    busy: Boolean(bondPreviewBusy || bondCommitBusy),
    hasDraft: state !== VISUAL_BUILDER_BOND_STATE.BOND_IDLE || bondPreviewBusy || bondCommitBusy,
  };
}

export function resolveDraftRailState({ command = {}, bond = {} } = {}) {
  const commandState = resolveCommandDraftState(command);
  const bondState = resolveBondDraftRailState(bond);
  return {
    command: commandState,
    bond: bondState,
    activeRail: commandState.open ? "command" : bondState.hasDraft ? "bond" : "idle",
    hasActiveDraft: Boolean(commandState.open || bondState.hasDraft),
    hasBlockingIssue: Boolean(commandState.error || commandState.hasBlockingHints),
    summary: commandState.resultSummary || commandState.resolveSummary || "",
  };
}
