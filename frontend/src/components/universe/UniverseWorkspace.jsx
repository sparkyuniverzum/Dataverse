import { useCallback, useEffect, useMemo, useRef, useState } from "react";

import {
  API_BASE,
  apiErrorFromResponse,
  apiFetch,
  buildSnapshotUrl,
  buildTablesUrl,
  normalizeSnapshot,
} from "../../lib/dataverseApi";
import { calculateHierarchyLayout } from "../../lib/hierarchy_layout";
import LinkHoverTooltip from "./LinkHoverTooltip";
import QuickGridOverlay from "./QuickGridOverlay";
import UniverseCanvas from "./UniverseCanvas";
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

export default function UniverseWorkspace({ galaxy, onBackToGalaxies, onLogout, minimalShell = false }) {
  const [snapshot, setSnapshot] = useState({ asteroids: [], bonds: [] });
  const [tables, setTables] = useState([]);
  const [loading, setLoading] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  const [selectedTableId, setSelectedTableId] = useState("");
  const [selectedAsteroidId, setSelectedAsteroidId] = useState("");
  const [linkDraft, setLinkDraft] = useState(null);
  const [hoveredLink, setHoveredLink] = useState(null);

  const [quickGridOpen, setQuickGridOpen] = useState(false);
  const [gridSearchQuery, setGridSearchQuery] = useState("");

  const layoutRef = useRef({ tablePositions: new Map(), asteroidPositions: new Map() });

  const loadUniverse = useCallback(async () => {
    if (!galaxy?.id) return;
    setLoading(true);
    setError("");
    try {
      const [snapshotResponse, tablesResponse] = await Promise.all([
        apiFetch(buildSnapshotUrl(API_BASE, null, galaxy.id, null)),
        apiFetch(buildTablesUrl(API_BASE, null, galaxy.id, null)),
      ]);
      if (!snapshotResponse.ok) {
        throw await apiErrorFromResponse(snapshotResponse, `Universe snapshot failed: ${snapshotResponse.status}`);
      }
      if (!tablesResponse.ok) {
        throw await apiErrorFromResponse(tablesResponse, `Universe tables failed: ${tablesResponse.status}`);
      }

      const snapshotBody = await snapshotResponse.json();
      const tablesBody = await tablesResponse.json();
      const normalized = normalizeSnapshot(snapshotBody || {});
      const nextTables = Array.isArray(tablesBody?.tables) ? tablesBody.tables : [];

      setSnapshot(normalized);
      setTables(nextTables);
    } catch (loadError) {
      setError(loadError.message || "Načtení vesmíru selhalo.");
    } finally {
      setLoading(false);
    }
  }, [galaxy?.id]);

  useEffect(() => {
    setSelectedTableId("");
    setSelectedAsteroidId("");
    setQuickGridOpen(false);
    setGridSearchQuery("");
    setLinkDraft(null);
    setHoveredLink(null);
    layoutRef.current = { tablePositions: new Map(), asteroidPositions: new Map() };
    if (galaxy?.id) {
      void loadUniverse();
    }
  }, [galaxy?.id, loadUniverse]);

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
      })),
    [layout]
  );

  const asteroidNodes = useMemo(
    () =>
      layout.asteroidNodes.map((node) => ({
        ...node,
        position: layout.asteroidPositions.get(node.id) || [0, 0, 0],
      })),
    [layout]
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
      if (!galaxy?.id || !payload?.sourceId || !payload?.targetId) return;
      if (String(payload.sourceId) === String(payload.targetId)) return;

      setBusy(true);
      setError("");
      try {
        const response = await apiFetch(`${API_BASE}/bonds/link`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            source_id: payload.sourceId,
            target_id: payload.targetId,
            type: "RELATION",
            galaxy_id: galaxy.id,
          }),
        });
        if (!response.ok) {
          throw await apiErrorFromResponse(response, `Vazba se nepodařila vytvořit: ${response.status}`);
        }
        await loadUniverse();
      } catch (createError) {
        setError(createError.message || "Vazbu se nepodařilo vytvořit.");
      } finally {
        setBusy(false);
      }
    },
    [galaxy?.id, loadUniverse]
  );

  const selectedTableLabel = selectedTable ? `Tabulka: ${tableDisplayName(selectedTable)}` : "";

  return (
    <main style={{ width: "100vw", height: "100vh", position: "relative", overflow: "hidden", background: "#020205" }}>
      <UniverseCanvas
        level={level}
        tableNodes={tableNodes}
        asteroidNodes={asteroidNodes}
        tableLinks={layout.tableLinks || []}
        asteroidLinks={layout.asteroidLinks || []}
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
        selectedTableId={selectedTableId}
        selectedTableLabel={selectedTableLabel}
        selectedAsteroidLabel={selectedAsteroidLabel}
        onSelectTable={(tableId) => {
          setSelectedTableId(tableId);
          setSelectedAsteroidId("");
        }}
        onOpenGrid={() => setQuickGridOpen(true)}
        onRefresh={() => {
          void loadUniverse();
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
        onClose={() => setQuickGridOpen(false)}
        readGridCell={readGridCell}
      />

      <LinkHoverTooltip hoveredLink={hoveredLink} />
    </main>
  );
}
