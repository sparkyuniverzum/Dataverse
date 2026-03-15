import { useCallback, useState } from "react";

import {
  apiErrorFromResponse,
  apiFetch,
  buildOccConflictMessage,
  buildTableContractUrl,
  isOccConflictError,
} from "../../lib/dataverseApi";
import { buildCivilizationWriteRoute } from "../../lib/civilizationRuntimeRouteGate";
import { buildExtinguishMoonCommand } from "../../lib/builderParserCommand";
import { explainLifecycleGuard } from "./civilizationLifecycle";
import { buildMoonCreateMinerals } from "./moonWriteDefaults";
import { parseMetadataLiteral } from "./rowWriteUtils";

export function useMoonCrudController({
  apiBase,
  galaxyId,
  branchIdScope,
  selectedTableId,
  selectedAsteroidId,
  asteroidById,
  setSelectedAsteroidId,
  setBusy,
  clearRuntimeIssue,
  refreshProjection,
  reportContractViolationWithRepair,
  setRuntimeError,
  executeParserCommand,
  trackParserAttempt,
  parserExecutionMode,
  nextIdempotencyKey,
}) {
  const [pendingCreate, setPendingCreate] = useState(false);
  const [pendingRowOps, setPendingRowOps] = useState({});

  const resetMoonCrudState = useCallback(() => {
    setPendingCreate(false);
    setPendingRowOps({});
  }, []);

  const loadTableContract = useCallback(
    async (tableId) => {
      const targetTableId = String(tableId || "").trim();
      if (!galaxyId || !targetTableId) return null;
      const contractRead = await apiFetch(
        `${buildTableContractUrl(apiBase, targetTableId, galaxyId)}${branchIdScope ? `&branch_id=${encodeURIComponent(branchIdScope)}` : ""}`
      );
      if (!contractRead.ok) {
        throw await apiErrorFromResponse(contractRead, `Kontrakt planety nelze načíst: ${contractRead.status}`);
      }
      return contractRead.json();
    },
    [apiBase, branchIdScope, galaxyId]
  );

  const handleCreateRow = useCallback(
    async (value) => {
      if (!galaxyId || !selectedTableId) {
        return { ok: false, message: "Vyber planetu pred vytvorenim civilizace." };
      }
      const trimmed = String(value || "").trim();
      if (!trimmed) return { ok: false, message: "Nazev civilizace je prazdny." };

      setBusy(true);
      setPendingCreate(true);
      clearRuntimeIssue();
      try {
        const tableContract = await loadTableContract(selectedTableId);
        const minerals = buildMoonCreateMinerals({
          label: trimmed,
          contract: tableContract,
        });
        if (!Object.prototype.hasOwnProperty.call(minerals, "label")) {
          minerals.label = trimmed;
        }
        const createPayload = {
          label: trimmed,
          minerals,
          planet_id: selectedTableId,
          galaxy_id: galaxyId,
          ...(branchIdScope ? { branch_id: branchIdScope } : {}),
          idempotency_key: nextIdempotencyKey("ingest"),
        };
        const createUrl = buildCivilizationWriteRoute(apiBase, {
          operation: "create",
        });
        const response = await apiFetch(createUrl, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(createPayload),
        });
        if (!response.ok) {
          throw await apiErrorFromResponse(response, `Civilizaci se nepodařilo vytvořit: ${response.status}`);
        }
        const payload = await response.json().catch(() => ({}));
        const asteroidId = payload?.moon_id
          ? String(payload.moon_id)
          : payload?.civilization_id
            ? String(payload.civilization_id)
            : payload?.id
              ? String(payload.id)
              : "";

        await refreshProjection({ silent: true });
        if (asteroidId) {
          setSelectedAsteroidId(asteroidId);
        }
        return { ok: true, message: `Civilizace '${trimmed}' byla vytvorena.` };
      } catch (createError) {
        reportContractViolationWithRepair(createError, {
          fallbackMessage: createError?.message || "Civilizaci se nepodařilo vytvořit.",
          operation: "create",
        });
        return {
          ok: false,
          message: createError?.message || "Vytvoreni civilizace selhalo. Zkontroluj kontrakt planety.",
        };
      } finally {
        setPendingCreate(false);
        setBusy(false);
      }
    },
    [
      apiBase,
      branchIdScope,
      clearRuntimeIssue,
      galaxyId,
      loadTableContract,
      nextIdempotencyKey,
      refreshProjection,
      reportContractViolationWithRepair,
      selectedTableId,
      setBusy,
      setSelectedAsteroidId,
    ]
  );

  const handleUpdateRow = useCallback(
    async (asteroidId, value) => {
      const targetId = String(asteroidId || "").trim();
      if (!galaxyId || !targetId) {
        return { ok: false, message: "Neni vybrana civilizace pro upravu." };
      }

      const asteroid = asteroidById.get(targetId);
      if (!asteroid) return { ok: false, message: "Civilizace uz neni v aktualni projekci." };
      const mutateGuard = explainLifecycleGuard({ row: asteroid, operation: "mutate" });
      if (!mutateGuard.allowed) {
        return { ok: false, message: mutateGuard.message || "Civilizace nelze upravit v aktualnim lifecycle stavu." };
      }
      const expectedEventSeq = Number.isInteger(asteroid?.current_event_seq)
        ? Number(asteroid.current_event_seq)
        : null;

      setBusy(true);
      setPendingRowOps((prev) => ({ ...prev, [targetId]: "mutate" }));
      clearRuntimeIssue();
      try {
        const mutatePayload = {
          value,
          label: value,
          galaxy_id: galaxyId,
          ...(branchIdScope ? { branch_id: branchIdScope } : {}),
          idempotency_key: nextIdempotencyKey("mutate"),
          ...(expectedEventSeq !== null ? { expected_event_seq: expectedEventSeq } : {}),
        };
        const mutateUrl = buildCivilizationWriteRoute(apiBase, {
          operation: "mutate",
          civilizationId: targetId,
        });
        const response = await apiFetch(mutateUrl, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(mutatePayload),
        });
        if (!response.ok) {
          throw await apiErrorFromResponse(response, `Civilizaci se nepodařilo upravit: ${response.status}`);
        }
        await refreshProjection({ silent: true });
        return { ok: true, message: "Civilizace byla upravena." };
      } catch (updateError) {
        if (isOccConflictError(updateError)) {
          const message = buildOccConflictMessage(updateError, "úprava civilizace");
          setRuntimeError(message);
          await refreshProjection({ silent: true });
          return { ok: false, message };
        }
        reportContractViolationWithRepair(updateError, {
          fallbackMessage: updateError?.message || "Civilizaci se nepodařilo upravit.",
          operation: "mutate",
          civilizationId: targetId,
        });
        return { ok: false, message: updateError?.message || "Uprava civilizace selhala." };
      } finally {
        setPendingRowOps((prev) => {
          const next = { ...prev };
          delete next[targetId];
          return next;
        });
        setBusy(false);
      }
    },
    [
      apiBase,
      asteroidById,
      branchIdScope,
      clearRuntimeIssue,
      galaxyId,
      nextIdempotencyKey,
      refreshProjection,
      reportContractViolationWithRepair,
      setBusy,
      setRuntimeError,
    ]
  );

  const handleDeleteRow = useCallback(
    async (asteroidId) => {
      const targetId = String(asteroidId || "").trim();
      if (!galaxyId || !targetId) return { ok: false, message: "Neni vybrana civilizace pro archivaci." };

      const asteroid = asteroidById.get(targetId);
      if (!asteroid) return { ok: false, message: "Civilizace uz neni v aktualni projekci." };
      const archiveGuard = explainLifecycleGuard({ row: asteroid, operation: "archive" });
      if (!archiveGuard.allowed) {
        return {
          ok: false,
          message: archiveGuard.message || "Civilizaci nelze archivovat v aktualnim lifecycle stavu.",
        };
      }
      const expectedEventSeq = Number.isInteger(asteroid?.current_event_seq)
        ? Number(asteroid.current_event_seq)
        : null;
      let parserAttempted = false;
      let parserFailure = null;
      let parserTelemetryRecorded = false;
      let routeFamilyUsed = "unknown";

      setBusy(true);
      setPendingRowOps((prev) => ({ ...prev, [targetId]: "extinguish" }));
      clearRuntimeIssue();
      try {
        const parserCommand = buildExtinguishMoonCommand({
          asteroidId: targetId,
          asteroidLabel: asteroid?.value,
        });
        if (parserCommand) {
          parserAttempted = true;
          try {
            await executeParserCommand(parserCommand);
            routeFamilyUsed = "parser";
            trackParserAttempt({ action: "EXTINGUISH", parserOk: true, routeFamily: routeFamilyUsed });
            parserTelemetryRecorded = true;
            await refreshProjection({ silent: true });
            if (String(selectedAsteroidId) === targetId) {
              setSelectedAsteroidId("");
            }
            return { ok: true, message: "Civilizace byla archivovana parser cestou." };
          } catch (parserError) {
            parserFailure = parserError;
            if (parserExecutionMode.extinguish) {
              throw parserError;
            }
          }
        }

        const extinguishIdempotencyKey = nextIdempotencyKey("extinguish");
        const extinguishBaseUrl = buildCivilizationWriteRoute(apiBase, {
          operation: "extinguish",
          civilizationId: targetId,
        });
        const buildExtinguishUrl = (baseUrl) => {
          const url = new URL(baseUrl);
          url.searchParams.set("galaxy_id", galaxyId);
          if (branchIdScope) {
            url.searchParams.set("branch_id", branchIdScope);
          }
          url.searchParams.set("idempotency_key", extinguishIdempotencyKey);
          if (expectedEventSeq !== null) {
            url.searchParams.set("expected_event_seq", String(expectedEventSeq));
          }
          return url.toString();
        };
        const response = await apiFetch(buildExtinguishUrl(extinguishBaseUrl), {
          method: "PATCH",
        });
        routeFamilyUsed = "canonical";

        if (!response.ok) {
          throw await apiErrorFromResponse(response, `Civilizaci se nepodařilo zhasnout: ${response.status}`);
        }
        if (parserAttempted) {
          trackParserAttempt({
            action: "EXTINGUISH",
            parserOk: false,
            parserError: parserFailure,
            fallbackUsed: true,
            fallbackOk: true,
            routeFamily: routeFamilyUsed,
          });
          parserTelemetryRecorded = true;
        }

        await refreshProjection({ silent: true });
        if (String(selectedAsteroidId) === targetId) {
          setSelectedAsteroidId("");
        }
        return { ok: true, message: "Civilizace byla archivovana." };
      } catch (deleteError) {
        if (parserAttempted && !parserTelemetryRecorded) {
          trackParserAttempt({
            action: "EXTINGUISH",
            parserOk: false,
            parserError: parserFailure || deleteError,
            fallbackUsed: true,
            fallbackOk: false,
            routeFamily: routeFamilyUsed === "unknown" ? "parser" : routeFamilyUsed,
          });
          parserTelemetryRecorded = true;
        }
        if (isOccConflictError(deleteError)) {
          const message = buildOccConflictMessage(deleteError, "zhasnutí civilizace");
          setRuntimeError(message);
          await refreshProjection({ silent: true });
          return { ok: false, message };
        }
        reportContractViolationWithRepair(deleteError, {
          fallbackMessage: deleteError?.message || "Civilizaci se nepodařilo zhasnout.",
          operation: "extinguish",
          civilizationId: targetId,
        });
        return { ok: false, message: deleteError?.message || "Archivace civilizace selhala." };
      } finally {
        setPendingRowOps((prev) => {
          const next = { ...prev };
          delete next[targetId];
          return next;
        });
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
      selectedAsteroidId,
      setBusy,
      setRuntimeError,
      setSelectedAsteroidId,
      trackParserAttempt,
    ]
  );

  const handleUpsertMetadata = useCallback(
    async (asteroidId, key, rawValue) => {
      const targetId = String(asteroidId || "").trim();
      const metadataKey = String(key || "").trim();
      if (!galaxyId || !targetId || !metadataKey) {
        return { ok: false, message: "Vyber civilizaci a zadej klic nerostu." };
      }

      const asteroid = asteroidById.get(targetId);
      if (!asteroid) return { ok: false, message: "Civilizace uz neni v aktualni projekci." };
      const normalizedMetadataKey = String(metadataKey || "")
        .trim()
        .toLowerCase();
      const mutateGuard = explainLifecycleGuard({ row: asteroid, operation: "mutate" });
      if (!mutateGuard.allowed && normalizedMetadataKey !== "state") {
        return { ok: false, message: mutateGuard.message || "Archivovana civilizace je read-only pro nerosty." };
      }
      if (normalizedMetadataKey === "state") {
        const parsedStateTarget = String(rawValue || "")
          .trim()
          .toUpperCase();
        const lifecycleGuard = explainLifecycleGuard({
          row: asteroid,
          operation: "transition",
          targetState: parsedStateTarget,
        });
        if (!lifecycleGuard.allowed) {
          return { ok: false, message: lifecycleGuard.message || "Lifecycle transition neni povolena." };
        }
      }
      const expectedEventSeq = Number.isInteger(asteroid?.current_event_seq)
        ? Number(asteroid.current_event_seq)
        : null;
      const currentMetadata = asteroid?.metadata && typeof asteroid.metadata === "object" ? asteroid.metadata : {};
      const parsedMineralValue = parseMetadataLiteral(rawValue);
      const removeRequested = typeof parsedMineralValue === "undefined";
      if (removeRequested && !Object.prototype.hasOwnProperty.call(currentMetadata, metadataKey)) {
        return { ok: true, message: `Nerost '${metadataKey}' uz je prazdny.` };
      }

      setBusy(true);
      setPendingRowOps((prev) => ({ ...prev, [targetId]: "metadata" }));
      clearRuntimeIssue();
      try {
        const mineralMutatePayload = {
          remove: removeRequested,
          galaxy_id: galaxyId,
          ...(branchIdScope ? { branch_id: branchIdScope } : {}),
          idempotency_key: nextIdempotencyKey("mineral"),
          ...(expectedEventSeq !== null ? { expected_event_seq: expectedEventSeq } : {}),
        };
        if (!removeRequested) {
          mineralMutatePayload.typed_value = parsedMineralValue;
        }

        const mineralMutateUrl = buildCivilizationWriteRoute(apiBase, {
          operation: "mutate_mineral",
          civilizationId: targetId,
          mineralKey: metadataKey,
        });
        const response = await apiFetch(mineralMutateUrl, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(mineralMutatePayload),
        });
        if (!response.ok) {
          throw await apiErrorFromResponse(response, `Nerost se nepodařilo uložit: ${response.status}`);
        }
        await refreshProjection({ silent: true });
        return {
          ok: true,
          message: removeRequested
            ? `Nerost '${metadataKey}' byl odebran (soft remove).`
            : `Nerost '${metadataKey}' byl ulozen.`,
        };
      } catch (metadataError) {
        if (isOccConflictError(metadataError)) {
          const message = buildOccConflictMessage(metadataError, "úprava nerostu");
          setRuntimeError(message);
          await refreshProjection({ silent: true });
          return { ok: false, message };
        }
        reportContractViolationWithRepair(metadataError, {
          fallbackMessage: metadataError?.message || "Nerost se nepodařilo uložit.",
          operation: "metadata",
          civilizationId: targetId,
        });
        return { ok: false, message: metadataError?.message || `Ulozeni nerostu '${metadataKey}' selhalo.` };
      } finally {
        setPendingRowOps((prev) => {
          const next = { ...prev };
          delete next[targetId];
          return next;
        });
        setBusy(false);
      }
    },
    [
      apiBase,
      asteroidById,
      branchIdScope,
      clearRuntimeIssue,
      galaxyId,
      nextIdempotencyKey,
      refreshProjection,
      reportContractViolationWithRepair,
      setBusy,
      setRuntimeError,
    ]
  );

  return {
    pendingCreate,
    pendingRowOps,
    handleCreateRow,
    handleUpdateRow,
    handleDeleteRow,
    handleUpsertMetadata,
    resetMoonCrudState,
  };
}
