import { toAsOfIso } from "../../lib/dataverseApi";
import { normalizeVisibleBranches } from "./branchVisibilityContract";

function normalizeText(value) {
  return String(value || "").trim();
}

function formatHistoricalAsOfLabel(asOfIso) {
  if (!asOfIso) return "Current timeline";
  const date = new Date(asOfIso);
  if (Number.isNaN(date.getTime())) return "Historical inspect";
  return `Historical inspect @ ${date.toISOString()}`;
}

export function resolveHistoricalInspectActivation({ draftAsOf = "" } = {}) {
  const normalizedDraftAsOf = normalizeText(draftAsOf);
  const asOfIso = toAsOfIso(normalizedDraftAsOf);
  if (!asOfIso) {
    return {
      nextAsOf: "",
      asOfIso: null,
      error: "Time travel vyzaduje validni datum a cas.",
    };
  }
  return {
    nextAsOf: normalizedDraftAsOf,
    asOfIso,
    error: "",
  };
}

export function resolveCompareTimeTravelModel({
  selectedBranchId = "",
  branches = [],
  compareBranchId = "",
  historicalAsOf = "",
} = {}) {
  const normalizedSelectedBranchId = normalizeText(selectedBranchId);
  const normalizedCompareBranchId = normalizeText(compareBranchId);
  const normalizedHistoricalAsOf = normalizeText(historicalAsOf);
  const asOfIso = toAsOfIso(normalizedHistoricalAsOf);
  const historicalMode = Boolean(asOfIso);

  const compareBranches = normalizeVisibleBranches(branches).filter(
    (branch) => branch.id !== normalizedSelectedBranchId
  );
  const compareTarget = compareBranches.find((branch) => branch.id === normalizedCompareBranchId) || null;
  const effectiveCompareBranchId = compareTarget ? compareTarget.id : "";
  const currentScopeLabel = normalizedSelectedBranchId ? `branch ${normalizedSelectedBranchId}` : "main";

  return {
    historicalMode,
    asOfIso,
    historicalAsOf: normalizedHistoricalAsOf,
    historicalLabel: formatHistoricalAsOfLabel(asOfIso),
    compareBranches,
    compareBranchId: effectiveCompareBranchId,
    compareMode: Boolean(compareTarget),
    compareSummary: compareTarget
      ? `Compare aktivni: ${currentScopeLabel} vs branch ${compareTarget.label}`
      : "Compare vypnuto.",
    shouldResetCompareBranch: Boolean(normalizedCompareBranchId) && !compareTarget,
  };
}

export function resolveScopedRuntimeConnectivity(
  runtimeConnectivity = null,
  { historicalMode = false, asOfIso = null } = {}
) {
  const base = runtimeConnectivity && typeof runtimeConnectivity === "object" ? runtimeConnectivity : {};
  if (!historicalMode) {
    return base;
  }
  const baseBadge = normalizeText(base.badgeLabel) || "online";
  return {
    ...base,
    writeBlocked: true,
    badgeLabel: `${baseBadge} · historical`,
    sidebarMessage: `Historical inspect (${asOfIso || "as_of"}) je pouze pro cteni. Zapisy jsou docasne blokovane.`,
  };
}
