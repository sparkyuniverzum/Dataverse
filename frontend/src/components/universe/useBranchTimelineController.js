import { useCallback, useState } from "react";

import { apiErrorFromResponse, apiFetch, buildBranchPromoteUrl } from "../../lib/dataverseApi";
import { buildBranchTimelineSummary } from "./timelineRewriteContract";

export function useBranchTimelineController({
  apiBase,
  galaxyId,
  selectedBranchId,
  setBusy,
  clearRuntimeIssue,
  refreshProjection,
  onRefreshScopes,
  setRuntimeError,
  selectBranch,
}) {
  const [branchPromoteBusy, setBranchPromoteBusy] = useState(false);
  const [branchPromoteSummary, setBranchPromoteSummary] = useState("");
  const [branchCreateName, setBranchCreateName] = useState("");
  const [branchCreateBusy, setBranchCreateBusy] = useState(false);
  const [branchPromoteReviewOpen, setBranchPromoteReviewOpen] = useState(false);
  const resetBranchTimelineState = useCallback(() => {
    setBranchPromoteBusy(false);
    setBranchPromoteSummary("");
    setBranchCreateName("");
    setBranchCreateBusy(false);
    setBranchPromoteReviewOpen(false);
  }, []);

  const openBranchPromoteReview = useCallback(() => {
    if (!String(selectedBranchId || "").trim() || branchPromoteBusy) return;
    clearRuntimeIssue();
    setBranchPromoteReviewOpen(true);
  }, [branchPromoteBusy, clearRuntimeIssue, selectedBranchId]);

  const closeBranchPromoteReview = useCallback(() => {
    if (branchPromoteBusy) return;
    setBranchPromoteReviewOpen(false);
  }, [branchPromoteBusy]);

  const handlePromoteSelectedBranch = useCallback(async () => {
    const targetBranchId = String(selectedBranchId || "").trim();
    if (!galaxyId || !targetBranchId || branchPromoteBusy) return;
    setBusy(true);
    setBranchPromoteBusy(true);
    setBranchPromoteSummary("");
    clearRuntimeIssue();
    try {
      const response = await apiFetch(buildBranchPromoteUrl(apiBase, targetBranchId, galaxyId), {
        method: "POST",
      });
      if (!response.ok) {
        throw await apiErrorFromResponse(response, `Promote branch selhal: ${response.status}`);
      }
      const promotePayload = await response.json().catch(() => ({}));
      const promotedEventsCount = Number.isFinite(Number(promotePayload?.promoted_events_count))
        ? Number(promotePayload.promoted_events_count)
        : null;
      selectBranch("");
      setBranchPromoteSummary(buildBranchTimelineSummary({ mode: "promote", promotedEventsCount }));
      setBranchPromoteReviewOpen(false);
      await refreshProjection({ silent: true });
      if (typeof onRefreshScopes === "function") {
        await onRefreshScopes();
      }
    } catch (promoteError) {
      setRuntimeError(promoteError?.message || "Branch se nepodařilo promotnout.");
    } finally {
      setBranchPromoteBusy(false);
      setBusy(false);
    }
  }, [
    apiBase,
    branchPromoteBusy,
    clearRuntimeIssue,
    galaxyId,
    onRefreshScopes,
    refreshProjection,
    selectBranch,
    selectedBranchId,
    setBusy,
    setRuntimeError,
  ]);

  const handleCreateBranch = useCallback(async () => {
    const name = String(branchCreateName || "").trim();
    if (!galaxyId || !name || branchCreateBusy) return;
    setBusy(true);
    setBranchCreateBusy(true);
    setBranchPromoteSummary("");
    clearRuntimeIssue();
    try {
      const response = await apiFetch(`${apiBase}/branches`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name,
          galaxy_id: galaxyId,
        }),
      });
      if (!response.ok) {
        throw await apiErrorFromResponse(response, `Create branch selhal: ${response.status}`);
      }
      const payload = await response.json().catch(() => ({}));
      const createdBranchId = String(payload?.id || "").trim();
      if (createdBranchId) {
        selectBranch(createdBranchId);
      }
      setBranchCreateName("");
      if (typeof onRefreshScopes === "function") {
        await onRefreshScopes();
      }
      await refreshProjection({ silent: true });
      setBranchPromoteSummary(buildBranchTimelineSummary({ mode: "create", createdBranchId }));
    } catch (createError) {
      setRuntimeError(createError?.message || "Branch se nepodařilo vytvořit.");
    } finally {
      setBranchCreateBusy(false);
      setBusy(false);
    }
  }, [
    apiBase,
    branchCreateBusy,
    branchCreateName,
    clearRuntimeIssue,
    galaxyId,
    onRefreshScopes,
    refreshProjection,
    selectBranch,
    setBusy,
    setRuntimeError,
  ]);

  return {
    branchPromoteBusy,
    branchPromoteReviewOpen,
    branchPromoteSummary,
    setBranchPromoteSummary,
    branchCreateName,
    setBranchCreateName,
    branchCreateBusy,
    resetBranchTimelineState,
    openBranchPromoteReview,
    closeBranchPromoteReview,
    handlePromoteSelectedBranch,
    handleCreateBranch,
  };
}
