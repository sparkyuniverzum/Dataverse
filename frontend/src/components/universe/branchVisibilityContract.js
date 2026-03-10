function normalizeText(value) {
  return String(value || "").trim();
}

export function normalizeVisibleBranches(branches = []) {
  const source = Array.isArray(branches) ? branches : [];
  return source
    .filter((item) => item && !item.deleted_at)
    .map((branch) => {
      const id = normalizeText(branch?.id);
      if (!id) return null;
      const label = normalizeText(branch?.name ?? branch?.label) || id;
      return {
        id,
        label,
      };
    })
    .filter(Boolean);
}

export function resolveBranchVisibilityModel({ branches = [], selectedBranchId = "" } = {}) {
  const visibleBranches = normalizeVisibleBranches(branches);
  const normalizedSelectedBranchId = normalizeText(selectedBranchId);
  const selectedBranch = visibleBranches.find((branch) => branch.id === normalizedSelectedBranchId) || null;
  const hasSelectedBranch = Boolean(selectedBranch);
  const effectiveSelectedBranchId = hasSelectedBranch ? selectedBranch.id : "";
  const selectedBranchLabel = hasSelectedBranch ? selectedBranch.label : "Main timeline";

  return {
    visibleBranches,
    activeBranchCount: visibleBranches.length,
    selectedBranchId: effectiveSelectedBranchId,
    selectedBranchLabel,
    scopeLabel: hasSelectedBranch ? `Branch: ${selectedBranchLabel}` : "Main timeline",
    branchMode: hasSelectedBranch ? "branch" : "main",
    hasSelectedBranch,
    shouldResetSelection: Boolean(normalizedSelectedBranchId) && !hasSelectedBranch,
  };
}

export function resolveBranchSelectionTransition({ nextBranchId = "", branchCreateName = "" } = {}) {
  const normalizedNextBranchId = normalizeText(nextBranchId);
  return {
    selectedBranchId: normalizedNextBranchId,
    shouldClearPromoteSummary: true,
    shouldClearBranchCreateName: !normalizedNextBranchId && Boolean(normalizeText(branchCreateName)),
  };
}
