import { useCallback, useEffect, useState } from "react";

import {
  apiErrorFromResponse,
  apiFetch,
  buildOccConflictMessage,
  isOccConflictError,
  normalizeBondType,
} from "../../lib/dataverseApi";
import { buildLinkMoonsCommand } from "../../lib/builderParserCommand";
import {
  buildVisualBuilderTransitionMessage,
  evaluateBondFlowTransition,
  VISUAL_BUILDER_BOND_STATE,
  VISUAL_BUILDER_EVENT,
} from "./visualBuilderStateMachine";

export function useBondDraftController({
  apiBase,
  galaxyId,
  branchIdScope,
  asteroidById,
  tableRows,
  setBusy,
  clearRuntimeIssue,
  refreshProjection,
  reportContractViolationWithRepair,
  setRuntimeError,
  executeParserCommand,
  trackParserAttempt,
  trackWorkspaceEvent,
  parserExecutionMode,
  nextIdempotencyKey,
}) {
  const [bondDraft, setBondDraft] = useState({
    state: VISUAL_BUILDER_BOND_STATE.BOND_IDLE,
    sourceId: "",
    targetId: "",
    type: "RELATION",
    preview: null,
    lastValidState: VISUAL_BUILDER_BOND_STATE.BOND_IDLE,
  });
  const [bondPreviewBusy, setBondPreviewBusy] = useState(false);
  const [bondCommitBusy, setBondCommitBusy] = useState(false);

  const resetBondDraft = useCallback(() => {
    setBondDraft({
      state: VISUAL_BUILDER_BOND_STATE.BOND_IDLE,
      sourceId: "",
      targetId: "",
      type: "RELATION",
      preview: null,
      lastValidState: VISUAL_BUILDER_BOND_STATE.BOND_IDLE,
    });
    setBondPreviewBusy(false);
    setBondCommitBusy(false);
  }, []);

  const applyBondTransition = useCallback(
    (event, payload, patchDraft = null) => {
      let transitionApplied = false;
      setBondDraft((prev) => {
        const result = evaluateBondFlowTransition({
          state: prev.state,
          event,
          payload: payload || {},
          lastValidState: prev.lastValidState,
        });
        if (!result.allowed) {
          setRuntimeError(buildVisualBuilderTransitionMessage(result));
          return prev;
        }
        transitionApplied = true;
        const baseNext = {
          ...prev,
          state: result.next_state,
          lastValidState:
            result.next_state === VISUAL_BUILDER_BOND_STATE.BOND_BLOCKED ? prev.lastValidState : result.next_state,
        };
        return typeof patchDraft === "function" ? patchDraft(baseNext) : baseNext;
      });
      return transitionApplied;
    },
    [setRuntimeError]
  );

  const handleStartBondDraft = useCallback(
    (sourceId) => {
      const nextSourceId = String(sourceId || "").trim();
      if (!nextSourceId) return;
      const startResult = evaluateBondFlowTransition({
        state: VISUAL_BUILDER_BOND_STATE.BOND_IDLE,
        event: VISUAL_BUILDER_EVENT.START_BOND_DRAFT,
        payload: { sourceId: nextSourceId },
      });
      if (!startResult.allowed) {
        setRuntimeError(buildVisualBuilderTransitionMessage(startResult));
        return;
      }
      clearRuntimeIssue();
      setBondDraft((prev) => ({
        state: startResult.next_state,
        sourceId: nextSourceId,
        targetId: "",
        type: normalizeBondType(prev.type || "RELATION"),
        preview: null,
        lastValidState: startResult.next_state,
      }));
    },
    [clearRuntimeIssue, setRuntimeError]
  );

  const handleSelectBondTarget = useCallback(
    (targetId) => {
      const nextTargetId = String(targetId || "").trim();
      clearRuntimeIssue();
      applyBondTransition(
        VISUAL_BUILDER_EVENT.SELECT_BOND_TARGET,
        { sourceId: bondDraft.sourceId, targetId: nextTargetId },
        (next) => ({
          ...next,
          targetId: nextTargetId,
          preview: null,
        })
      );
    },
    [applyBondTransition, bondDraft.sourceId, clearRuntimeIssue]
  );

  const handleSelectBondType = useCallback((nextType) => {
    setBondDraft((prev) => ({
      ...prev,
      type: normalizeBondType(nextType || "RELATION"),
      preview: null,
    }));
  }, []);

  const primeBondDraftFromLink = useCallback(
    (payload) => {
      const sourceId = String(payload?.sourceId || "").trim();
      const targetId = String(payload?.targetId || "").trim();
      if (!sourceId || !targetId) return;
      const startResult = evaluateBondFlowTransition({
        state: VISUAL_BUILDER_BOND_STATE.BOND_IDLE,
        event: VISUAL_BUILDER_EVENT.START_BOND_DRAFT,
        payload: { sourceId },
      });
      if (!startResult.allowed) {
        setRuntimeError(buildVisualBuilderTransitionMessage(startResult));
        return;
      }
      const targetResult = evaluateBondFlowTransition({
        state: startResult.next_state,
        event: VISUAL_BUILDER_EVENT.SELECT_BOND_TARGET,
        payload: { sourceId, targetId },
      });
      if (!targetResult.allowed) {
        setRuntimeError(buildVisualBuilderTransitionMessage(targetResult));
        return;
      }
      clearRuntimeIssue();
      setBondDraft({
        state: targetResult.next_state,
        sourceId,
        targetId,
        type: "RELATION",
        preview: null,
        lastValidState: targetResult.next_state,
      });
    },
    [clearRuntimeIssue, setRuntimeError]
  );

  useEffect(() => {
    if (bondDraft.state === VISUAL_BUILDER_BOND_STATE.BOND_IDLE) return;
    const rowIds = new Set((Array.isArray(tableRows) ? tableRows : []).map((row) => String(row?.id || "")));
    const hasSource = rowIds.has(String(bondDraft.sourceId || ""));
    const hasTarget = !bondDraft.targetId || rowIds.has(String(bondDraft.targetId || ""));
    if (!hasSource || !hasTarget) {
      resetBondDraft();
    }
  }, [bondDraft.sourceId, bondDraft.state, bondDraft.targetId, resetBondDraft, tableRows]);

  const handleCreateLink = useCallback(
    async (payload) => {
      if (!galaxyId || !payload?.sourceId || !payload?.targetId) return false;
      if (String(payload.sourceId) === String(payload.targetId)) return false;
      const normalizedBondType = normalizeBondType(payload?.type || "RELATION");

      const sourceAsteroid = asteroidById.get(String(payload.sourceId));
      const targetAsteroid = asteroidById.get(String(payload.targetId));
      const sourceEventSeq = sourceAsteroid?.current_event_seq;
      const expectedSourceEventSeq = Number.isInteger(sourceEventSeq) && sourceEventSeq > 0 ? sourceEventSeq : null;
      const targetEventSeq = targetAsteroid?.current_event_seq;
      const expectedTargetEventSeq = Number.isInteger(targetEventSeq) && targetEventSeq > 0 ? targetEventSeq : null;
      let parserAttempted = false;
      let fallbackAttempted = false;
      let parserFailure = null;
      let parserTelemetryRecorded = false;

      setBusy(true);
      clearRuntimeIssue();
      try {
        const parserCommand =
          normalizedBondType === "RELATION"
            ? buildLinkMoonsCommand({
                sourceId: payload.sourceId,
                targetId: payload.targetId,
              })
            : "";
        if (parserCommand && normalizedBondType === "RELATION") {
          parserAttempted = true;
          try {
            await executeParserCommand(parserCommand);
            trackParserAttempt({ action: "LINK", parserOk: true });
            parserTelemetryRecorded = true;
            await refreshProjection({ silent: true });
            return true;
          } catch (parserError) {
            parserFailure = parserError;
            if (parserExecutionMode.link) {
              throw parserError;
            }
          }
        }

        fallbackAttempted = true;
        const response = await apiFetch(`${apiBase}/bonds/link`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            source_id: payload.sourceId,
            target_id: payload.targetId,
            type: normalizedBondType,
            galaxy_id: galaxyId,
            ...(branchIdScope ? { branch_id: branchIdScope } : {}),
            idempotency_key: nextIdempotencyKey("link"),
            ...(expectedSourceEventSeq !== null ? { expected_source_event_seq: expectedSourceEventSeq } : {}),
            ...(expectedTargetEventSeq !== null ? { expected_target_event_seq: expectedTargetEventSeq } : {}),
          }),
        });
        if (!response.ok) {
          throw await apiErrorFromResponse(response, `Vazbu se nepodařilo vytvořit: ${response.status}`);
        }
        if (parserAttempted) {
          trackParserAttempt({
            action: "LINK",
            parserOk: false,
            parserError: parserFailure,
            fallbackUsed: true,
            fallbackOk: true,
          });
          parserTelemetryRecorded = true;
        }
        await refreshProjection({ silent: true });
        return true;
      } catch (createError) {
        if (parserAttempted && !parserTelemetryRecorded) {
          trackParserAttempt({
            action: "LINK",
            parserOk: false,
            parserError: parserFailure || createError,
            fallbackUsed: fallbackAttempted,
            fallbackOk: fallbackAttempted ? false : null,
          });
          parserTelemetryRecorded = true;
        }
        if (isOccConflictError(createError)) {
          setRuntimeError(buildOccConflictMessage(createError, "vytvoření vazby"));
          await refreshProjection({ silent: true });
        } else {
          reportContractViolationWithRepair(createError, {
            fallbackMessage: createError?.message || "Vazbu se nepodařilo vytvořit.",
            operation: "link",
          });
        }
        return false;
      } finally {
        setBusy(false);
      }
    },
    [
      apiBase,
      asteroidById,
      branchIdScope,
      clearRuntimeIssue,
      executeParserCommand,
      galaxyId,
      nextIdempotencyKey,
      parserExecutionMode,
      refreshProjection,
      reportContractViolationWithRepair,
      setBusy,
      setRuntimeError,
      trackParserAttempt,
    ]
  );

  const handleRequestBondPreview = useCallback(async () => {
    if (!galaxyId) return;
    const sourceId = String(bondDraft.sourceId || "").trim();
    const targetId = String(bondDraft.targetId || "").trim();
    const bondType = normalizeBondType(bondDraft.type || "RELATION");
    if (!sourceId || !targetId) return;
    if (
      !applyBondTransition(VISUAL_BUILDER_EVENT.REQUEST_BOND_PREVIEW, {
        sourceId,
        targetId,
        type: bondType,
      })
    ) {
      return;
    }

    setBondPreviewBusy(true);
    clearRuntimeIssue();
    try {
      const sourceAsteroid = asteroidById.get(sourceId);
      const targetAsteroid = asteroidById.get(targetId);
      const sourceEventSeq = sourceAsteroid?.current_event_seq;
      const expectedSourceEventSeq = Number.isInteger(sourceEventSeq) && sourceEventSeq > 0 ? sourceEventSeq : null;
      const targetEventSeq = targetAsteroid?.current_event_seq;
      const expectedTargetEventSeq = Number.isInteger(targetEventSeq) && targetEventSeq > 0 ? targetEventSeq : null;
      const response = await apiFetch(`${apiBase}/bonds/validate`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          operation: "create",
          source_civilization_id: sourceId,
          target_civilization_id: targetId,
          type: bondType,
          galaxy_id: galaxyId,
          ...(branchIdScope ? { branch_id: branchIdScope } : {}),
          ...(expectedSourceEventSeq !== null ? { expected_source_event_seq: expectedSourceEventSeq } : {}),
          ...(expectedTargetEventSeq !== null ? { expected_target_event_seq: expectedTargetEventSeq } : {}),
        }),
      });
      if (!response.ok) {
        throw await apiErrorFromResponse(response, `Bond preview selhal: ${response.status}`);
      }
      const previewPayload = await response.json().catch(() => ({}));
      const previewDecision = String(previewPayload?.decision || "").toUpperCase();
      const previewBlocking = Boolean(previewPayload?.blocking);
      const applied = applyBondTransition(
        VISUAL_BUILDER_EVENT.APPLY_BOND_PREVIEW_RESULT,
        {
          previewDecision,
          previewBlocking,
        },
        (next) => ({
          ...next,
          preview: previewPayload,
        })
      );
      if (!applied) return;
      const previewReasons = Array.isArray(previewPayload?.reasons) ? previewPayload.reasons : [];
      const rejectCodes = previewReasons.map((reason) => String(reason?.code || reason?.reason || "unknown"));
      const previewCrossPlanet = Boolean(
        previewPayload?.cross_planet ||
        previewReasons.some((reason) =>
          String(reason?.code || reason?.reason || "")
            .toUpperCase()
            .includes("CROSS_PLANET")
        )
      );
      if (previewDecision === "REJECT" || previewBlocking) {
        trackWorkspaceEvent("bond_preview_rejected", {
          source_civilization_id: sourceId,
          target_civilization_id: targetId,
          reject_codes: rejectCodes,
          blocking_count: previewReasons.length,
          cross_planet: previewCrossPlanet,
        });
        if (previewCrossPlanet) {
          const sourcePlanetId = asteroidById.get(sourceId)?.table_id || null;
          const targetPlanetId = asteroidById.get(targetId)?.table_id || null;
          trackWorkspaceEvent("cross_planet_blocked", {
            source_planet_id: sourcePlanetId,
            target_planet_id: targetPlanetId,
            reason_code: rejectCodes[0] || "cross_planet_blocked",
          });
        }
      } else if (previewDecision === "WARN") {
        trackWorkspaceEvent("bond_preview_warned", {
          source_civilization_id: sourceId,
          target_civilization_id: targetId,
          reject_codes: rejectCodes,
          blocking_count: previewReasons.length,
          cross_planet: previewCrossPlanet,
        });
      } else {
        trackWorkspaceEvent("bond_preview_allowed", {
          source_civilization_id: sourceId,
          target_civilization_id: targetId,
          cross_planet: previewCrossPlanet,
        });
      }
      if (previewDecision === "REJECT" || previewBlocking) {
        const firstReason = Array.isArray(previewPayload?.reasons) ? previewPayload.reasons[0] : null;
        setRuntimeError(String(firstReason?.message || "Bond preview operation blocked by validation rules."));
      }
    } catch (previewError) {
      reportContractViolationWithRepair(previewError, {
        fallbackMessage: previewError?.message || "Bond preview selhal.",
        operation: "bond_preview",
      });
      setBondDraft((prev) => ({
        ...prev,
        state: VISUAL_BUILDER_BOND_STATE.BOND_BLOCKED,
      }));
    } finally {
      setBondPreviewBusy(false);
    }
  }, [
    apiBase,
    applyBondTransition,
    asteroidById,
    bondDraft.sourceId,
    bondDraft.targetId,
    bondDraft.type,
    branchIdScope,
    clearRuntimeIssue,
    galaxyId,
    reportContractViolationWithRepair,
    setRuntimeError,
    trackWorkspaceEvent,
  ]);

  const handleCommitBondDraft = useCallback(async () => {
    const sourceId = String(bondDraft.sourceId || "").trim();
    const targetId = String(bondDraft.targetId || "").trim();
    const bondType = normalizeBondType(bondDraft.type || "RELATION");
    const previewDecision = String(bondDraft.preview?.decision || "").toUpperCase();
    const previewBlocking = Boolean(bondDraft.preview?.blocking);
    if (
      !applyBondTransition(VISUAL_BUILDER_EVENT.CONFIRM_BOND_COMMIT, {
        sourceId,
        targetId,
        type: bondType,
        previewDecision,
        previewBlocking,
      })
    ) {
      return;
    }

    setBondCommitBusy(true);
    const committed = await handleCreateLink({
      sourceId,
      targetId,
      type: bondType,
    });
    if (!committed) {
      setBondDraft((prev) => ({
        ...prev,
        state: VISUAL_BUILDER_BOND_STATE.BOND_BLOCKED,
      }));
      setBondCommitBusy(false);
      return;
    }
    const applied = applyBondTransition(
      VISUAL_BUILDER_EVENT.RUNTIME_REFRESH,
      {
        converged: true,
      },
      (next) => ({
        ...next,
      })
    );
    if (!applied) {
      setBondCommitBusy(false);
      return;
    }
    setBondCommitBusy(false);
    setTimeout(() => {
      resetBondDraft();
    }, 200);
  }, [
    applyBondTransition,
    bondDraft.preview?.blocking,
    bondDraft.preview?.decision,
    bondDraft.sourceId,
    bondDraft.targetId,
    bondDraft.type,
    handleCreateLink,
    resetBondDraft,
  ]);

  return {
    bondDraft,
    bondPreviewBusy,
    bondCommitBusy,
    handleStartBondDraft,
    handleSelectBondTarget,
    handleSelectBondType,
    primeBondDraftFromLink,
    handleRequestBondPreview,
    handleCommitBondDraft,
    resetBondDraft,
    resetBondDraftState: resetBondDraft,
  };
}
