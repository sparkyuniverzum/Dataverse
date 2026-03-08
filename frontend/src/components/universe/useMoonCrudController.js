import { useCallback, useState } from "react";

import {
  apiErrorFromResponse,
  apiFetch,
  buildCivilizationWriteRouteCandidates,
  buildOccConflictMessage,
  buildTableContractUrl,
  isOccConflictError,
  shouldFallbackToMoonAlias,
} from "../../lib/dataverseApi";
import { buildExtinguishMoonCommand } from "../../lib/builderParserCommand";
import { buildMoonCreateMinerals } from "./moonWriteDefaults";
import { mergeMetadataValue, parseMetadataLiteral } from "./rowWriteUtils";

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
        const [primaryCreateUrl, legacyCreateUrl] = buildCivilizationWriteRouteCandidates(apiBase, {
          operation: "create",
        });
        let response = await apiFetch(primaryCreateUrl, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(createPayload),
        });
        if (shouldFallbackToMoonAlias(response.status)) {
          response = await apiFetch(legacyCreateUrl, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(createPayload),
          });
        }
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
        const [primaryMutateUrl, legacyMutateUrl] = buildCivilizationWriteRouteCandidates(apiBase, {
          operation: "mutate",
          civilizationId: targetId,
        });
        let response = await apiFetch(primaryMutateUrl, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(mutatePayload),
        });
        if (shouldFallbackToMoonAlias(response.status)) {
          response = await apiFetch(legacyMutateUrl, {
            method: "PATCH",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(mutatePayload),
          });
        }
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
      const expectedEventSeq = Number.isInteger(asteroid?.current_event_seq)
        ? Number(asteroid.current_event_seq)
        : null;
      let parserAttempted = false;
      let fallbackAttempted = false;
      let parserFailure = null;
      let parserTelemetryRecorded = false;

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
            trackParserAttempt({ action: "EXTINGUISH", parserOk: true });
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

        fallbackAttempted = true;
        const extinguishIdempotencyKey = nextIdempotencyKey("extinguish");
        const [primaryExtinguishBaseUrl, legacyExtinguishBaseUrl] = buildCivilizationWriteRouteCandidates(apiBase, {
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
        let response = await apiFetch(buildExtinguishUrl(primaryExtinguishBaseUrl), {
          method: "PATCH",
        });
        if (shouldFallbackToMoonAlias(response.status)) {
          response = await apiFetch(buildExtinguishUrl(legacyExtinguishBaseUrl), {
            method: "PATCH",
          });
        }

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
            fallbackUsed: fallbackAttempted,
            fallbackOk: fallbackAttempted ? false : null,
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

        const [primaryMineralUrl, legacyMineralUrl] = buildCivilizationWriteRouteCandidates(apiBase, {
          operation: "mutate_mineral",
          civilizationId: targetId,
          mineralKey: metadataKey,
        });
        let response = await apiFetch(primaryMineralUrl, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(mineralMutatePayload),
        });
        if (shouldFallbackToMoonAlias(response.status)) {
          response = await apiFetch(legacyMineralUrl, {
            method: "PATCH",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(mineralMutatePayload),
          });
        }
        if (shouldFallbackToMoonAlias(response.status)) {
          const nextMetadata = mergeMetadataValue(currentMetadata, metadataKey, rawValue);
          const mutatePayload = {
            metadata: nextMetadata,
            minerals: nextMetadata,
            galaxy_id: galaxyId,
            ...(branchIdScope ? { branch_id: branchIdScope } : {}),
            idempotency_key: nextIdempotencyKey("metadata-fallback"),
            ...(expectedEventSeq !== null ? { expected_event_seq: expectedEventSeq } : {}),
          };
          const [primaryMutateUrl, legacyMutateUrl] = buildCivilizationWriteRouteCandidates(apiBase, {
            operation: "mutate",
            civilizationId: targetId,
          });
          response = await apiFetch(primaryMutateUrl, {
            method: "PATCH",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(mutatePayload),
          });
          if (shouldFallbackToMoonAlias(response.status)) {
            response = await apiFetch(legacyMutateUrl, {
              method: "PATCH",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify(mutatePayload),
            });
          }
        }
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
