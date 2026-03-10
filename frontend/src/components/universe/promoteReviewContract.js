function normalizeText(value) {
  return String(value || "").trim();
}

export function resolvePromoteReviewModel({
  selectedBranchId = "",
  selectedBranchLabel = "",
  branchPromoteBusy = false,
  branchPromoteSummary = "",
  reviewOpen = false,
} = {}) {
  const branchId = normalizeText(selectedBranchId);
  const branchLabel = normalizeText(selectedBranchLabel) || branchId || "Main timeline";
  const summary = normalizeText(branchPromoteSummary);
  const open = Boolean(reviewOpen);
  const busy = Boolean(branchPromoteBusy);
  const hasBranch = Boolean(branchId);
  const mode = open ? "review" : "idle";
  const cinematicMode = open ? "promote_review" : "default";

  return {
    open,
    mode,
    cinematicMode,
    busy,
    hasBranch,
    branchId,
    branchLabel,
    title: hasBranch ? `Promote Review: ${branchLabel}` : "Promote Review",
    badgeLabel: hasBranch ? `Reality transfer · ${branchLabel}` : "Reality transfer",
    summary,
    blockingReason: hasBranch ? "" : "Vyber branch, ktery chces promotnout do main timeline.",
    canOpen: hasBranch && !busy,
    canConfirm: open && hasBranch && !busy,
    surfaceTone: busy ? "promoting" : open ? "review" : "idle",
    checklist: [
      {
        id: "scope",
        label: hasBranch ? `Zdroj: branch ${branchLabel}` : "Zdroj branch neni vybran",
        state: hasBranch ? "ready" : "blocked",
      },
      {
        id: "target",
        label: "Cil: main timeline",
        state: "ready",
      },
      {
        id: "impact",
        label: "Akce prehraje branch eventy do hlavni reality a uzavre branch.",
        state: hasBranch ? "warn" : "blocked",
      },
    ],
  };
}
