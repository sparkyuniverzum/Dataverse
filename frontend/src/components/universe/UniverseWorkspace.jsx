import { useCallback, useEffect, useMemo, useRef, useState } from "react";

import {
  API_BASE,
  apiErrorFromResponse,
  apiFetch,
  buildOccConflictMessage,
  isOccConflictError,
} from "../../lib/dataverseApi";
import { calculateHierarchyLayout } from "../../lib/hierarchy_layout";
import LinkHoverTooltip from "./LinkHoverTooltip";
import QuickGridOverlay from "./QuickGridOverlay";
import { mergeMetadataValue } from "./rowWriteUtils";
import UniverseCanvas from "./UniverseCanvas";
import { useUniverseRuntimeSync } from "./useUniverseRuntimeSync";
import WorkspaceSidebar from "./WorkspaceSidebar";
import {
  collectGridColumns,
  normalizeText,
  readGridCell,
  tableDisplayName,
  valueToLabel,
} from "./workspaceFormatters";

const DEFAULT_CAMERA_STATE = {
  position: [0, 120, 340],
  minDistance: 36,
  maxDistance: 1800,
};

function clamp(value, min, max) {
  return Math.max(min, Math.min(max, value));
}

function nextIdempotencyKey(prefix) {
  const safePrefix = String(prefix || "ui").trim() || "ui";
  if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") {
    return `${safePrefix}-${crypto.randomUUID()}`;
  }
  return `${safePrefix}-${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

export default function UniverseWorkspace({ galaxy, onBackToGalaxies, onLogout, minimalShell = false }) {
  const galaxyId = String(galaxy?.id || "");

  const {
    snapshot,
    tables,
    loading,
    error,
    starRuntime,
    starDomains,
    starPulseByEntity,
    starPulseLastEventSeq,
    setRuntimeError,
    clearRuntimeError,
    refreshProjection,
  } = useUniverseRuntimeSync({ galaxyId });

  const [busy, setBusy] = useState(false);
  const [pendingCreate, setPendingCreate] = useState(false);
  const [pendingRowOps, setPendingRowOps] = useState({});
  const [selectedTableId, setSelectedTableId] = useState("");
  const [selectedAsteroidId, setSelectedAsteroidId] = useState("");
  const [linkDraft, setLinkDraft] = useState(null);
  const [hoveredLink, setHoveredLink] = useState(null);

  const [quickGridOpen, setQuickGridOpen] = useState(false);
  const [gridSearchQuery, setGridSearchQuery] = useState("");

  const layoutRef = useRef({ tablePositions: new Map(), asteroidPositions: new Map() });

  useEffect(() => {
    setPendingCreate(false);
    setPendingRowOps({});
    setSelectedTableId("");
    setSelectedAsteroidId("");
    setQuickGridOpen(false);
    setGridSearchQuery("");
    setLinkDraft(null);
    setHoveredLink(null);
    layoutRef.current = { tablePositions: new Map(), asteroidPositions: new Map() };
  }, [galaxyId]);

  const tableById = useMemo(
    () => new Map((Array.isArray(tables) ? tables : []).map((table) => [String(table.table_id), table])),
    [tables]
  );

  useEffect(() => {
    if (!tables.length) {
      setSelectedTableId("");
      setSelectedAsteroidId("");
      return;
    }
    if (!selectedTableId || !tableById.has(String(selectedTableId))) {
      const first = tables[0];
      setSelectedTableId(first?.table_id ? String(first.table_id) : "");
      setSelectedAsteroidId("");
    }
  }, [selectedTableId, tableById, tables]);

  const asteroidById = useMemo(
    () => new Map((Array.isArray(snapshot.asteroids) ? snapshot.asteroids : []).map((item) => [String(item.id), item])),
    [snapshot.asteroids]
  );
  const domainMetricsByName = useMemo(() => {
    const map = new Map();
    (Array.isArray(starDomains) ? starDomains : []).forEach((domain) => {
      const name = String(domain?.domain_name || "").trim();
      if (!name) return;
      map.set(name, domain);
    });
    return map;
  }, [starDomains]);

  useEffect(() => {
    if (!selectedAsteroidId) return;
    if (!asteroidById.has(String(selectedAsteroidId))) {
      setSelectedAsteroidId("");
    }
  }, [asteroidById, selectedAsteroidId]);

  const layout = useMemo(
    () =>
      calculateHierarchyLayout({
        tables,
        selectedTableId,
        asteroidById,
        previous: layoutRef.current,
      }),
    [asteroidById, selectedTableId, tables]
  );

  useEffect(() => {
    layoutRef.current = {
      tablePositions: layout.tablePositions,
      asteroidPositions: layout.asteroidPositions,
    };
  }, [layout]);

  const tableNodes = useMemo(
    () =>
      layout.tableNodes.map((node) => ({
        ...node,
        position: layout.tablePositions.get(node.id) || [0, 0, 0],
        runtimePulse: starPulseByEntity[String(node.id)] || null,
        runtimeDomain: domainMetricsByName.get(String(node.entityName || "")) || null,
        v1: {
          status: String((domainMetricsByName.get(String(node.entityName || "")) || {}).status || "GREEN"),
          quality_score: Number((domainMetricsByName.get(String(node.entityName || "")) || {}).quality_score ?? 100),
        },
        physics: {
          ...(node.physics || {}),
          stress: clamp(
            Number((domainMetricsByName.get(String(node.entityName || "")) || {}).activity_intensity || 0) * 0.42,
            0,
            1
          ),
          pulseFactor: clamp(
            1 +
              Number((domainMetricsByName.get(String(node.entityName || "")) || {}).activity_intensity || 0) * 0.85 +
              Number((starPulseByEntity[String(node.id)] || {}).intensity || 0) * 0.45,
            0.9,
            2.35
          ),
          emissiveBoost: clamp(
            Number((domainMetricsByName.get(String(node.entityName || "")) || {}).activity_intensity || 0) * 0.58 +
              Number((starPulseByEntity[String(node.id)] || {}).intensity || 0) * 0.36,
            0,
            1
          ),
        },
      })),
    [domainMetricsByName, layout, starPulseByEntity]
  );

  const asteroidNodes = useMemo(
    () =>
      layout.asteroidNodes.map((node) => ({
        ...node,
        position: layout.asteroidPositions.get(node.id) || [0, 0, 0],
        runtimePulse: starPulseByEntity[String(node.id)] || null,
        runtimeDomain: domainMetricsByName.get(String(node.entityName || "")) || null,
        v1: {
          status: String((domainMetricsByName.get(String(node.entityName || "")) || {}).status || "GREEN"),
          quality_score: Number((domainMetricsByName.get(String(node.entityName || "")) || {}).quality_score ?? 100),
        },
        physics: {
          ...(node.physics || {}),
          stress: clamp(
            Number((domainMetricsByName.get(String(node.entityName || "")) || {}).activity_intensity || 0) * 0.36 +
              Number((starPulseByEntity[String(node.id)] || {}).intensity || 0) * 0.32,
            0,
            1
          ),
          pulseFactor: clamp(
            1 +
              Number((domainMetricsByName.get(String(node.entityName || "")) || {}).activity_intensity || 0) * 0.66 +
              Number((starPulseByEntity[String(node.id)] || {}).intensity || 0) * 0.72,
            0.9,
            2.35
          ),
          emissiveBoost: clamp(
            Number((domainMetricsByName.get(String(node.entityName || "")) || {}).activity_intensity || 0) * 0.42 +
              Number((starPulseByEntity[String(node.id)] || {}).intensity || 0) * 0.56,
            0,
            1
          ),
        },
      })),
    [domainMetricsByName, layout, starPulseByEntity]
  );
  const tableNodeById = useMemo(() => new Map(tableNodes.map((node) => [String(node.id), node])), [tableNodes]);
  const asteroidNodeById = useMemo(() => new Map(asteroidNodes.map((node) => [String(node.id), node])), [asteroidNodes]);
  const tableLinks = useMemo(
    () =>
      (layout.tableLinks || []).map((link) => {
        const source = tableNodeById.get(String(link.source));
        const target = tableNodeById.get(String(link.target));
        const sourceActivity = Number(source?.runtimeDomain?.activity_intensity || 0);
        const targetActivity = Number(target?.runtimeDomain?.activity_intensity || 0);
        const linkPulse = starPulseByEntity[String(link.id)] || null;
        const flow = clamp(Math.max(sourceActivity, targetActivity) * 0.9 + Number(linkPulse?.intensity || 0) * 0.6, 0, 1);
        return {
          ...link,
          runtimePulse: linkPulse,
          physics: {
            ...(link.physics || {}),
            flow,
            speedFactor: 1 + flow * 0.7,
            widthFactor: 1 + flow * 0.34,
            pulseSizeFactor: 1 + flow * 0.42,
            opacityFactor: 1 + flow * 0.12,
          },
        };
      }),
    [layout.tableLinks, starPulseByEntity, tableNodeById]
  );
  const asteroidLinks = useMemo(
    () =>
      (layout.asteroidLinks || []).map((link) => {
        const sourcePulse = starPulseByEntity[String(link.source)] || null;
        const targetPulse = starPulseByEntity[String(link.target)] || null;
        const linkPulse = starPulseByEntity[String(link.id)] || null;
        const sourceActivity = Number(asteroidNodeById.get(String(link.source))?.runtimeDomain?.activity_intensity || 0);
        const targetActivity = Number(asteroidNodeById.get(String(link.target))?.runtimeDomain?.activity_intensity || 0);
        const flow = clamp(
          Math.max(sourceActivity, targetActivity) * 0.72 +
            Number(sourcePulse?.intensity || 0) * 0.32 +
            Number(targetPulse?.intensity || 0) * 0.32 +
            Number(linkPulse?.intensity || 0) * 0.46,
          0,
          1
        );
        return {
          ...link,
          runtimePulse: linkPulse,
          physics: {
            ...(link.physics || {}),
            flow,
            speedFactor: 1 + flow * 1.05,
            widthFactor: 1 + flow * 0.48,
            pulseSizeFactor: 1 + flow * 0.7,
            opacityFactor: 1 + flow * 0.16,
          },
        };
      }),
    [asteroidNodeById, layout.asteroidLinks, starPulseByEntity]
  );

  const selectedTable = useMemo(
    () => (selectedTableId ? tableById.get(String(selectedTableId)) || null : null),
    [selectedTableId, tableById]
  );

  const tableRows = useMemo(() => {
    if (!selectedTableId) return [];
    return (snapshot.asteroids || [])
      .filter((item) => String(item.table_id) === String(selectedTableId))
      .sort((a, b) => String(a.id).localeCompare(String(b.id)));
  }, [selectedTableId, snapshot.asteroids]);

  const gridColumns = useMemo(() => collectGridColumns(tableRows), [tableRows]);

  const gridFilteredRows = useMemo(() => {
    const query = normalizeText(gridSearchQuery);
    if (!query) return tableRows;
    return tableRows.filter((row) =>
      gridColumns.some((column) => normalizeText(readGridCell(row, column)).includes(query))
    );
  }, [gridColumns, gridSearchQuery, tableRows]);

  const selectedAsteroidLabel = useMemo(() => {
    if (!selectedAsteroidId) return "";
    const asteroid = asteroidById.get(String(selectedAsteroidId));
    return asteroid ? valueToLabel(asteroid.value) : "";
  }, [asteroidById, selectedAsteroidId]);

  const level = selectedTableId ? 3 : 2;

  const handleCreateLink = useCallback(
    async (payload) => {
      if (!galaxyId || !payload?.sourceId || !payload?.targetId) return;
      if (String(payload.sourceId) === String(payload.targetId)) return;

      const sourceAsteroid = asteroidById.get(String(payload.sourceId));
      const targetAsteroid = asteroidById.get(String(payload.targetId));
      const expectedSourceEventSeq = Number.isInteger(sourceAsteroid?.current_event_seq)
        ? Number(sourceAsteroid.current_event_seq)
        : null;
      const expectedTargetEventSeq = Number.isInteger(targetAsteroid?.current_event_seq)
        ? Number(targetAsteroid.current_event_seq)
        : null;

      setBusy(true);
      clearRuntimeError();
      try {
        const response = await apiFetch(`${API_BASE}/bonds/link`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            source_id: payload.sourceId,
            target_id: payload.targetId,
            type: "RELATION",
            galaxy_id: galaxyId,
            idempotency_key: nextIdempotencyKey("link"),
            ...(expectedSourceEventSeq !== null ? { expected_source_event_seq: expectedSourceEventSeq } : {}),
            ...(expectedTargetEventSeq !== null ? { expected_target_event_seq: expectedTargetEventSeq } : {}),
          }),
        });
        if (!response.ok) {
          throw await apiErrorFromResponse(response, `Vazba se nepodarila vytvorit: ${response.status}`);
        }

        await refreshProjection({ silent: true });
      } catch (createError) {
        if (isOccConflictError(createError)) {
          setRuntimeError(buildOccConflictMessage(createError, "vytvoreni vazby"));
          await refreshProjection({ silent: true });
        } else {
          setRuntimeError(createError?.message || "Vazbu se nepodarilo vytvorit.");
        }
      } finally {
        setBusy(false);
      }
    },
    [asteroidById, clearRuntimeError, galaxyId, refreshProjection, setRuntimeError]
  );

  const handleCreateRow = useCallback(
    async (value) => {
      if (!galaxyId || !selectedTableId) return false;
      const trimmed = String(value || "").trim();
      if (!trimmed) return false;

      setBusy(true);
      setPendingCreate(true);
      clearRuntimeError();
      try {
        const response = await apiFetch(`${API_BASE}/asteroids/ingest`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            value: trimmed,
            metadata: {
              table_id: selectedTableId,
            },
            galaxy_id: galaxyId,
            idempotency_key: nextIdempotencyKey("ingest"),
          }),
        });
        if (!response.ok) {
          throw await apiErrorFromResponse(response, `Mesic se nepodarilo vytvorit: ${response.status}`);
        }
        const payload = await response.json().catch(() => ({}));
        const asteroidId = payload?.id ? String(payload.id) : "";

        await refreshProjection({ silent: true });
        if (asteroidId) {
          setSelectedAsteroidId(asteroidId);
        }
        return true;
      } catch (createError) {
        setRuntimeError(createError?.message || "Mesic se nepodarilo vytvorit.");
        return false;
      } finally {
        setPendingCreate(false);
        setBusy(false);
      }
    },
    [clearRuntimeError, galaxyId, refreshProjection, selectedTableId, setRuntimeError]
  );

  const handleUpdateRow = useCallback(
    async (asteroidId, value) => {
      const targetId = String(asteroidId || "").trim();
      if (!galaxyId || !targetId) return;

      const asteroid = asteroidById.get(targetId);
      if (!asteroid) return;
      const expectedEventSeq = Number.isInteger(asteroid?.current_event_seq) ? Number(asteroid.current_event_seq) : null;

      setBusy(true);
      setPendingRowOps((prev) => ({ ...prev, [targetId]: "mutate" }));
      clearRuntimeError();
      try {
        const response = await apiFetch(`${API_BASE}/asteroids/${targetId}/mutate`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            value,
            galaxy_id: galaxyId,
            idempotency_key: nextIdempotencyKey("mutate"),
            ...(expectedEventSeq !== null ? { expected_event_seq: expectedEventSeq } : {}),
          }),
        });
        if (!response.ok) {
          throw await apiErrorFromResponse(response, `Mesic se nepodarilo upravit: ${response.status}`);
        }
        await refreshProjection({ silent: true });
      } catch (updateError) {
        if (isOccConflictError(updateError)) {
          setRuntimeError(buildOccConflictMessage(updateError, "uprava mesice"));
          await refreshProjection({ silent: true });
        } else {
          setRuntimeError(updateError?.message || "Mesic se nepodarilo upravit.");
        }
      } finally {
        setPendingRowOps((prev) => {
          const next = { ...prev };
          delete next[targetId];
          return next;
        });
        setBusy(false);
      }
    },
    [asteroidById, clearRuntimeError, galaxyId, refreshProjection, setRuntimeError]
  );

  const handleDeleteRow = useCallback(
    async (asteroidId) => {
      const targetId = String(asteroidId || "").trim();
      if (!galaxyId || !targetId) return;

      const asteroid = asteroidById.get(targetId);
      if (!asteroid) return;
      const expectedEventSeq = Number.isInteger(asteroid?.current_event_seq) ? Number(asteroid.current_event_seq) : null;

      setBusy(true);
      setPendingRowOps((prev) => ({ ...prev, [targetId]: "extinguish" }));
      clearRuntimeError();
      try {
        const url = new URL(`${API_BASE}/asteroids/${targetId}/extinguish`);
        url.searchParams.set("galaxy_id", galaxyId);
        url.searchParams.set("idempotency_key", nextIdempotencyKey("extinguish"));
        if (expectedEventSeq !== null) {
          url.searchParams.set("expected_event_seq", String(expectedEventSeq));
        }

        const response = await apiFetch(url.toString(), {
          method: "PATCH",
        });
        if (!response.ok) {
          throw await apiErrorFromResponse(response, `Mesic se nepodarilo zhasnout: ${response.status}`);
        }

        await refreshProjection({ silent: true });
        if (String(selectedAsteroidId) === targetId) {
          setSelectedAsteroidId("");
        }
      } catch (deleteError) {
        if (isOccConflictError(deleteError)) {
          setRuntimeError(buildOccConflictMessage(deleteError, "zhasnuti mesice"));
          await refreshProjection({ silent: true });
        } else {
          setRuntimeError(deleteError?.message || "Mesic se nepodarilo zhasnout.");
        }
      } finally {
        setPendingRowOps((prev) => {
          const next = { ...prev };
          delete next[targetId];
          return next;
        });
        setBusy(false);
      }
    },
    [asteroidById, clearRuntimeError, galaxyId, refreshProjection, selectedAsteroidId, setRuntimeError]
  );

  const handleUpsertMetadata = useCallback(
    async (asteroidId, key, rawValue) => {
      const targetId = String(asteroidId || "").trim();
      const metadataKey = String(key || "").trim();
      if (!galaxyId || !targetId || !metadataKey) return false;

      const asteroid = asteroidById.get(targetId);
      if (!asteroid) return false;
      const expectedEventSeq = Number.isInteger(asteroid?.current_event_seq) ? Number(asteroid.current_event_seq) : null;
      const currentMetadata = asteroid?.metadata && typeof asteroid.metadata === "object" ? asteroid.metadata : {};
      const nextMetadata = mergeMetadataValue(currentMetadata, metadataKey, rawValue);

      setBusy(true);
      setPendingRowOps((prev) => ({ ...prev, [targetId]: "metadata" }));
      clearRuntimeError();
      try {
        const response = await apiFetch(`${API_BASE}/asteroids/${targetId}/mutate`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            metadata: nextMetadata,
            galaxy_id: galaxyId,
            idempotency_key: nextIdempotencyKey("metadata"),
            ...(expectedEventSeq !== null ? { expected_event_seq: expectedEventSeq } : {}),
          }),
        });
        if (!response.ok) {
          throw await apiErrorFromResponse(response, `Nerost se nepodarilo ulozit: ${response.status}`);
        }
        await refreshProjection({ silent: true });
        return true;
      } catch (metadataError) {
        if (isOccConflictError(metadataError)) {
          setRuntimeError(buildOccConflictMessage(metadataError, "uprava nerostu"));
          await refreshProjection({ silent: true });
        } else {
          setRuntimeError(metadataError?.message || "Nerost se nepodarilo ulozit.");
        }
        return false;
      } finally {
        setPendingRowOps((prev) => {
          const next = { ...prev };
          delete next[targetId];
          return next;
        });
        setBusy(false);
      }
    },
    [asteroidById, clearRuntimeError, galaxyId, refreshProjection, setRuntimeError]
  );

  const selectedTableLabel = selectedTable ? `Tabulka: ${tableDisplayName(selectedTable)}` : "";

  return (
    <main style={{ width: "100vw", height: "100vh", position: "relative", overflow: "hidden", background: "#020205" }}>
      <UniverseCanvas
        level={level}
        tableNodes={tableNodes}
        asteroidNodes={asteroidNodes}
        tableLinks={tableLinks}
        asteroidLinks={asteroidLinks}
        cameraState={DEFAULT_CAMERA_STATE}
        selectedTableId={selectedTableId}
        selectedAsteroidId={selectedAsteroidId}
        linkDraft={linkDraft}
        hideMouseGuide={minimalShell}
        onSelectTable={(tableId) => {
          setSelectedTableId(String(tableId || ""));
          setSelectedAsteroidId("");
        }}
        onSelectAsteroid={(asteroidId) => {
          setSelectedAsteroidId(String(asteroidId || ""));
        }}
        onOpenContext={() => {}}
        onLinkStart={(draft) => setLinkDraft(draft)}
        onLinkMove={(nextPoint) =>
          setLinkDraft((prev) => {
            if (!prev) return prev;
            return { ...prev, to: nextPoint };
          })
        }
        onLinkComplete={(payload) => {
          setLinkDraft(null);
          void handleCreateLink(payload);
        }}
        onLinkCancel={() => setLinkDraft(null)}
        onHoverLink={setHoveredLink}
        onLeaveLink={() => setHoveredLink(null)}
        onSelectLink={() => {}}
      />

      <WorkspaceSidebar
        galaxy={galaxy}
        tableNodes={tableNodes}
        asteroidCount={snapshot.asteroids.length}
        bondCount={snapshot.bonds.length}
        loading={loading}
        busy={busy}
        error={error}
        starRuntime={starRuntime}
        starDomains={starDomains}
        starPulseLastEventSeq={starPulseLastEventSeq}
        selectedTableId={selectedTableId}
        selectedTableLabel={selectedTableLabel}
        selectedAsteroidLabel={selectedAsteroidLabel}
        onSelectTable={(tableId) => {
          setSelectedTableId(tableId);
          setSelectedAsteroidId("");
        }}
        onOpenGrid={() => setQuickGridOpen(true)}
        onRefresh={() => {
          void refreshProjection();
        }}
        onBackToGalaxies={onBackToGalaxies}
        onLogout={onLogout}
      />

      <QuickGridOverlay
        open={quickGridOpen}
        selectedTable={selectedTable}
        tableRows={tableRows}
        gridColumns={gridColumns}
        gridFilteredRows={gridFilteredRows}
        gridSearchQuery={gridSearchQuery}
        onGridSearchChange={setGridSearchQuery}
        selectedAsteroidId={selectedAsteroidId}
        onSelectRow={setSelectedAsteroidId}
        onCreateRow={handleCreateRow}
        onUpdateRow={handleUpdateRow}
        onDeleteRow={handleDeleteRow}
        onUpsertMetadata={handleUpsertMetadata}
        pendingCreate={pendingCreate}
        pendingRowOps={pendingRowOps}
        busy={busy}
        onClose={() => setQuickGridOpen(false)}
        readGridCell={readGridCell}
      />

      <LinkHoverTooltip hoveredLink={hoveredLink} />
    </main>
  );
}
