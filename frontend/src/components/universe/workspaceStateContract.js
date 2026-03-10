export const WORKSPACE_ATTENTION = Object.freeze({
  GREEN: "green",
  ORANGE: "orange",
  RED: "red",
});

export const WORKSPACE_TIME_MODE = Object.freeze({
  CURRENT: "current",
  HISTORICAL: "historical",
});

export function resolveWorkspaceScopeState({ galaxyId = "", selectedBranchId = "", historicalMode = false } = {}) {
  const normalizedGalaxyId = String(galaxyId || "").trim();
  const normalizedBranchId = String(selectedBranchId || "").trim();
  const timeMode = historicalMode ? WORKSPACE_TIME_MODE.HISTORICAL : WORKSPACE_TIME_MODE.CURRENT;
  return {
    galaxyId: normalizedGalaxyId,
    branchId: normalizedBranchId,
    branchMode: normalizedBranchId ? "branch" : "main",
    hasGalaxy: Boolean(normalizedGalaxyId),
    hasBranch: Boolean(normalizedBranchId),
    timeMode,
    historicalMode: timeMode === WORKSPACE_TIME_MODE.HISTORICAL,
    attention: normalizedBranchId ? WORKSPACE_ATTENTION.ORANGE : WORKSPACE_ATTENTION.GREEN,
  };
}

export function resolveWorkspaceSelectionState({
  selectedTableId = "",
  selectedAsteroidId = "",
  quickGridOpen = false,
} = {}) {
  const normalizedTableId = String(selectedTableId || "").trim();
  const normalizedAsteroidId = String(selectedAsteroidId || "").trim();
  const selectionKind = normalizedAsteroidId ? "civilization" : normalizedTableId ? "planet" : "none";
  return {
    selectedTableId: normalizedTableId,
    selectedCivilizationId: normalizedAsteroidId,
    selectionKind,
    hasPlanetSelection: Boolean(normalizedTableId),
    hasCivilizationSelection: Boolean(normalizedAsteroidId),
    quickGridOpen: Boolean(quickGridOpen),
    quickGridMode: quickGridOpen ? "grid" : "canvas",
    attention: quickGridOpen ? WORKSPACE_ATTENTION.ORANGE : WORKSPACE_ATTENTION.GREEN,
  };
}

export function resolveWorkspaceDraftState({
  commandBarOpen = false,
  commandPreviewBusy = false,
  commandExecuteBusy = false,
  commandError = "",
  pendingCreate = false,
  pendingRowOps = false,
  bondDraftState = "",
  bondPreviewBusy = false,
  bondCommitBusy = false,
  branchCreateBusy = false,
  branchPromoteBusy = false,
  branchPromoteReviewOpen = false,
  stageZeroCommitBusy = false,
} = {}) {
  const normalizedBondDraftState = String(bondDraftState || "")
    .trim()
    .toLowerCase();
  const hasCommandDraft = Boolean(commandBarOpen || commandPreviewBusy || commandExecuteBusy);
  const hasBondDraft = Boolean(
    normalizedBondDraftState && normalizedBondDraftState !== "bond_idle" && normalizedBondDraftState !== "idle"
  );
  const hasRowDraft = Boolean(pendingCreate || pendingRowOps);
  const hasBranchDraft = Boolean(branchCreateBusy || branchPromoteBusy || branchPromoteReviewOpen);
  const hasActiveDraft = Boolean(
    hasCommandDraft ||
    hasBondDraft ||
    hasRowDraft ||
    hasBranchDraft ||
    stageZeroCommitBusy ||
    bondPreviewBusy ||
    bondCommitBusy
  );
  const hasBlockingIssue = Boolean(String(commandError || "").trim());
  return {
    hasActiveDraft,
    hasCommandDraft,
    hasBondDraft,
    hasRowDraft,
    hasBranchDraft,
    commandBarOpen: Boolean(commandBarOpen),
    commandPreviewBusy: Boolean(commandPreviewBusy),
    commandExecuteBusy: Boolean(commandExecuteBusy),
    bondDraftState: normalizedBondDraftState || "idle",
    bondPreviewBusy: Boolean(bondPreviewBusy),
    bondCommitBusy: Boolean(bondCommitBusy),
    pendingCreate: Boolean(pendingCreate),
    pendingRowOps: Boolean(pendingRowOps),
    branchCreateBusy: Boolean(branchCreateBusy),
    branchPromoteBusy: Boolean(branchPromoteBusy),
    branchPromoteReviewOpen: Boolean(branchPromoteReviewOpen),
    stageZeroCommitBusy: Boolean(stageZeroCommitBusy),
    attention: hasBlockingIssue
      ? WORKSPACE_ATTENTION.RED
      : hasActiveDraft
        ? WORKSPACE_ATTENTION.ORANGE
        : WORKSPACE_ATTENTION.GREEN,
  };
}

export function resolveWorkspaceSyncState({ loading = false, error = "", runtimeConnectivity = null } = {}) {
  const runtimeStatus = runtimeConnectivity?.status ? String(runtimeConnectivity.status).toLowerCase() : "unknown";
  const writeBlocked = Boolean(runtimeConnectivity?.writeBlocked);
  const hasError = Boolean(String(error || "").trim());
  const isLoading = Boolean(loading);
  return {
    loading: isLoading,
    error: String(error || "").trim(),
    runtimeStatus,
    writeBlocked,
    isOnline: runtimeConnectivity?.isOnline !== false,
    attention:
      hasError || writeBlocked
        ? WORKSPACE_ATTENTION.RED
        : isLoading
          ? WORKSPACE_ATTENTION.ORANGE
          : WORKSPACE_ATTENTION.GREEN,
  };
}

export function resolveWorkspaceStateContract(input = {}) {
  const scope = resolveWorkspaceScopeState(input.scope);
  const selection = resolveWorkspaceSelectionState(input.selection);
  const draft = resolveWorkspaceDraftState(input.draft);
  const sync = resolveWorkspaceSyncState(input.sync);
  const overallAttention = [scope.attention, selection.attention, draft.attention, sync.attention].includes(
    WORKSPACE_ATTENTION.RED
  )
    ? WORKSPACE_ATTENTION.RED
    : [scope.attention, selection.attention, draft.attention, sync.attention].includes(WORKSPACE_ATTENTION.ORANGE)
      ? WORKSPACE_ATTENTION.ORANGE
      : WORKSPACE_ATTENTION.GREEN;

  return {
    scope,
    selection,
    draft,
    sync,
    overallAttention,
    mode: {
      branchMode: scope.branchMode,
      timeMode: scope.timeMode,
      surfaceMode: selection.quickGridMode,
    },
  };
}
