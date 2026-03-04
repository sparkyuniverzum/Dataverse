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
import UniverseCanvas from "./UniverseCanvas";

const DEFAULT_CAMERA_STATE = {
  position: [0, 120, 340],
  minDistance: 36,
  maxDistance: 1800,
};

function normalizeText(value) {
  return String(value || "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .trim();
}

function valueToLabel(value) {
  if (typeof value === "string") return value;
  if (typeof value === "number" || typeof value === "boolean") return String(value);
  if (value && typeof value === "object") {
    try {
      return JSON.stringify(value);
    } catch {
      return String(value);
    }
  }
  return "";
}

function tableDisplayName(table) {
  if (!table) return "Tabulka";
  const constellation = String(table.constellation_name || "").trim();
  const planet = String(table.planet_name || "").trim();
  if (constellation && planet) return `${constellation} > ${planet}`;
  return String(table.name || table.planet_name || "Tabulka");
}

function collectGridColumns(rows) {
  const keys = new Set(["value"]);
  (Array.isArray(rows) ? rows : []).forEach((row) => {
    const metadata = row?.metadata && typeof row.metadata === "object" ? row.metadata : {};
    const calculated = row?.calculated_values && typeof row.calculated_values === "object" ? row.calculated_values : {};
    Object.keys(metadata).forEach((key) => keys.add(String(key)));
    Object.keys(calculated).forEach((key) => keys.add(String(key)));
  });
  return [...keys];
}

function readGridCell(row, column) {
  if (column === "value") return valueToLabel(row?.value);
  const metadata = row?.metadata && typeof row.metadata === "object" ? row.metadata : {};
  if (Object.prototype.hasOwnProperty.call(metadata, column)) {
    return valueToLabel(metadata[column]);
  }
  const calculated = row?.calculated_values && typeof row.calculated_values === "object" ? row.calculated_values : {};
  if (Object.prototype.hasOwnProperty.call(calculated, column)) {
    return valueToLabel(calculated[column]);
  }
  return "";
}

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
      const normalizedSnapshot = normalizeSnapshot(snapshotBody || {});
      const nextTables = Array.isArray(tablesBody?.tables) ? tablesBody.tables : [];

      setSnapshot(normalizedSnapshot);
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

  const tableLinks = useMemo(() => layout.tableLinks || [], [layout.tableLinks]);
  const asteroidLinks = useMemo(() => layout.asteroidLinks || [], [layout.asteroidLinks]);

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

      <aside
        style={{
          position: "fixed",
          right: 12,
          top: 12,
          zIndex: 56,
          width: "min(360px, calc(100vw - 24px))",
          borderRadius: 14,
          border: "1px solid rgba(96, 189, 223, 0.32)",
          background: "rgba(5, 13, 24, 0.82)",
          color: "#d9f8ff",
          backdropFilter: "blur(12px)",
          boxShadow: "0 0 24px rgba(34, 132, 182, 0.2)",
          padding: "10px 10px",
          display: "grid",
          gap: 8,
        }}
      >
        <div style={{ fontSize: "var(--dv-fs-xs)", letterSpacing: "var(--dv-tr-wide)", opacity: 0.84 }}>SIDEBAR</div>
        <div style={{ fontSize: "var(--dv-fs-sm)" }}>
          Galaxie: <strong>{galaxy?.name || "n/a"}</strong>
        </div>
        <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
          <span style={hudBadgeStyle}>Planety {tableNodes.length}</span>
          <span style={hudBadgeStyle}>Mesice {snapshot.asteroids.length}</span>
          <span style={hudBadgeStyle}>Vazby {snapshot.bonds.length}</span>
          {loading ? <span style={{ ...hudBadgeStyle, color: "#9de7ff" }}>Nacitam...</span> : null}
          {busy ? <span style={{ ...hudBadgeStyle, color: "#ffd59c" }}>Ukladam...</span> : null}
        </div>

        <label style={{ display: "grid", gap: 4 }}>
          <span style={{ fontSize: "var(--dv-fs-2xs)", opacity: 0.76, letterSpacing: "var(--dv-tr-wide)" }}>AKTIVNI PLANETA</span>
          <select
            value={selectedTableId}
            onChange={(event) => {
              setSelectedTableId(String(event.target.value || ""));
              setSelectedAsteroidId("");
            }}
            style={selectStyle}
          >
            {tableNodes.map((node) => (
              <option key={node.id} value={node.id}>
                {node.entityName} &gt; {node.label}
              </option>
            ))}
          </select>
        </label>

        <div style={{ fontSize: "var(--dv-fs-xs)", opacity: 0.82 }}>
          {selectedTable ? `Tabulka: ${tableDisplayName(selectedTable)}` : "Vyber planetu kliknutim v prostoru."}
        </div>
        {selectedAsteroidLabel ? (
          <div style={{ fontSize: "var(--dv-fs-xs)", opacity: 0.82 }}>
            Vybrany mesic: <strong>{selectedAsteroidLabel}</strong>
          </div>
        ) : null}

        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 6 }}>
          <button type="button" onClick={() => setQuickGridOpen(true)} disabled={!selectedTableId} style={actionButtonStyle}>
            Otevrit grid
          </button>
          <button
            type="button"
            onClick={() => {
              void loadUniverse();
            }}
            disabled={loading}
            style={ghostButtonStyle}
          >
            {loading ? "..." : "Refresh"}
          </button>
          <button type="button" onClick={onBackToGalaxies} style={ghostButtonStyle}>
            Vyber galaxie
          </button>
          <button
            type="button"
            onClick={onLogout}
            style={{ ...ghostButtonStyle, borderColor: "rgba(255, 161, 185, 0.4)", color: "#ffd2df" }}
          >
            Logout
          </button>
        </div>

        {error ? (
          <div
            style={{
              fontSize: "var(--dv-fs-xs)",
              color: "#ffb7c9",
              borderTop: "1px solid rgba(255, 134, 170, 0.22)",
              paddingTop: 6,
              lineHeight: "var(--dv-lh-base)",
            }}
          >
            {error}
          </div>
        ) : null}
      </aside>

      {quickGridOpen ? (
        <section
          style={{
            position: "fixed",
            left: "50%",
            top: "50%",
            transform: "translate(-50%, -50%)",
            zIndex: 58,
            width: "min(1320px, calc(100vw - 20px))",
            height: "min(84vh, 920px)",
            borderRadius: 14,
            border: "1px solid rgba(101, 194, 227, 0.38)",
            background: "rgba(4, 12, 24, 0.92)",
            backdropFilter: "blur(12px)",
            boxShadow: "0 0 30px rgba(34, 136, 188, 0.24)",
            padding: 12,
            display: "grid",
            gridTemplateRows: "auto auto 1fr",
            gap: 10,
          }}
        >
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 10, flexWrap: "wrap" }}>
            <div>
              <div style={{ fontSize: "var(--dv-fs-xs)", opacity: 0.7, letterSpacing: "var(--dv-tr-wide)" }}>
                Planeta / Tabulka
              </div>
              <div style={{ fontSize: "var(--dv-fs-xl)", fontWeight: 700 }}>
                {selectedTable ? tableDisplayName(selectedTable) : "Tabulka"}
              </div>
              <div style={{ fontSize: "var(--dv-fs-xs)", opacity: 0.76 }}>
                Radky {gridFilteredRows.length}/{tableRows.length}
              </div>
            </div>
            <div style={{ display: "flex", gap: 6, flexWrap: "wrap", justifyContent: "flex-end" }}>
              <button type="button" style={{ ...hudButtonStyle, background: "rgba(14, 40, 62, 0.92)" }}>
                Grid
              </button>
              <button type="button" onClick={() => setQuickGridOpen(false)} style={ghostButtonStyle}>
                3D Vesmír
              </button>
            </div>
          </div>

          <div
            style={{
              display: "grid",
              gridTemplateColumns: "1fr auto",
              gap: 8,
              alignItems: "center",
              border: "1px solid rgba(96, 186, 220, 0.22)",
              borderRadius: 10,
              background: "rgba(6, 18, 30, 0.52)",
              padding: "7px 8px",
            }}
          >
            <input
              value={gridSearchQuery}
              onChange={(event) => setGridSearchQuery(event.target.value)}
              placeholder="Filtr radku a bunek..."
              style={inputStyle}
            />
            <span style={{ ...hudBadgeStyle, fontSize: "var(--dv-fs-xs)" }}>
              sloupce {gridColumns.length}
            </span>
          </div>

          <div
            style={{
              overflow: "auto",
              minHeight: 240,
              border: "1px solid rgba(96, 186, 220, 0.26)",
              borderRadius: 8,
              background: "rgba(5, 15, 27, 0.58)",
            }}
          >
            <table style={{ width: "100%", borderCollapse: "separate", borderSpacing: 0, minWidth: 820 }}>
              <thead>
                <tr>
                  {gridColumns.map((column, index) => (
                    <th
                      key={column}
                      style={{
                        position: "sticky",
                        top: 0,
                        left: index === 0 ? 0 : undefined,
                        zIndex: index === 0 ? 3 : 2,
                        background: "rgba(8, 18, 32, 0.98)",
                        color: "#cbeef8",
                        borderBottom: "1px solid rgba(95, 177, 207, 0.32)",
                        padding: "7px 8px",
                        textAlign: "left",
                        fontSize: "var(--dv-fs-2xs)",
                        letterSpacing: "var(--dv-tr-medium)",
                        minWidth: column === "value" ? 240 : 170,
                      }}
                    >
                      {column === "value" ? "mesic" : column}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {gridFilteredRows.map((row) => (
                  <tr key={String(row.id)}>
                    {gridColumns.map((column, index) => (
                      <td
                        key={`${row.id}:${column}`}
                        style={{
                          position: index === 0 ? "sticky" : "relative",
                          left: index === 0 ? 0 : undefined,
                          zIndex: index === 0 ? 1 : 0,
                          borderBottom: "1px solid rgba(95, 177, 207, 0.14)",
                          background: index === 0 ? "rgba(7, 18, 30, 0.95)" : "rgba(7, 18, 30, 0.72)",
                          color: "#dff8ff",
                          padding: "6px 8px",
                          fontSize: "var(--dv-fs-sm)",
                          lineHeight: "var(--dv-lh-base)",
                        }}
                      >
                        {readGridCell(row, column) || "—"}
                      </td>
                    ))}
                  </tr>
                ))}
                {!gridFilteredRows.length ? (
                  <tr>
                    <td
                      colSpan={gridColumns.length || 1}
                      style={{
                        padding: "14px 10px",
                        color: "#b8d7e5",
                        fontSize: "var(--dv-fs-sm)",
                        opacity: 0.86,
                      }}
                    >
                      Žádné řádky pro aktuální filtr.
                    </td>
                  </tr>
                ) : null}
              </tbody>
            </table>
          </div>
        </section>
      ) : null}

      {hoveredLink ? (
        <div
          style={{
            position: "fixed",
            left: (hoveredLink.x || 18) + 12,
            top: (hoveredLink.y || 18) + 12,
            zIndex: 47,
            pointerEvents: "none",
            borderRadius: 10,
            border: "1px solid rgba(112, 214, 246, 0.42)",
            background: "rgba(6, 14, 26, 0.92)",
            color: "#dcf8ff",
            fontSize: "var(--dv-fs-sm)",
            lineHeight: "var(--dv-lh-base)",
            padding: "7px 9px",
            maxWidth: 320,
            boxShadow: "0 0 18px rgba(72, 198, 255, 0.18)",
            backdropFilter: "blur(6px)",
          }}
        >
          <div style={{ fontWeight: 700 }}>{hoveredLink.type}</div>
          <div style={{ marginTop: 2 }}>
            {hoveredLink.sourceConstellation}/{hoveredLink.sourcePlanet} -&gt; {hoveredLink.targetConstellation}/
            {hoveredLink.targetPlanet}
          </div>
          <div style={{ marginTop: 2, opacity: 0.8 }}>
            Uzly: {hoveredLink.sourceLabel} -&gt; {hoveredLink.targetLabel}
          </div>
        </div>
      ) : null}
    </main>
  );
}

const inputStyle = {
  width: "100%",
  borderRadius: 9,
  border: "1px solid rgba(112, 205, 238, 0.24)",
  background: "rgba(4, 10, 18, 0.92)",
  color: "#ddf7ff",
  padding: "8px 10px",
  fontSize: "var(--dv-fs-sm)",
  letterSpacing: "var(--dv-tr-tight)",
  lineHeight: "var(--dv-lh-base)",
  outline: "none",
  boxSizing: "border-box",
  transition: "border-color 160ms ease, box-shadow 160ms ease, background-color 160ms ease",
};

const actionButtonStyle = {
  border: "1px solid rgba(114, 219, 252, 0.5)",
  background: "linear-gradient(120deg, #21bbea, #44d8ff)",
  color: "#072737",
  borderRadius: 10,
  padding: "8px 11px",
  fontWeight: 700,
  letterSpacing: "var(--dv-tr-tight)",
  lineHeight: "var(--dv-lh-base)",
  cursor: "pointer",
  boxShadow: "0 0 14px rgba(55, 178, 224, 0.2)",
  transition: "transform 120ms ease, box-shadow 180ms ease, filter 180ms ease",
};

const ghostButtonStyle = {
  border: "1px solid rgba(113, 202, 234, 0.3)",
  background: "rgba(7, 18, 32, 0.86)",
  color: "#d5f5ff",
  borderRadius: 9,
  padding: "8px 10px",
  fontSize: "var(--dv-fs-sm)",
  lineHeight: "var(--dv-lh-base)",
  cursor: "pointer",
  transition: "border-color 160ms ease, background-color 160ms ease, box-shadow 180ms ease",
};

const selectStyle = {
  ...inputStyle,
  padding: "6px 8px",
  appearance: "none",
  backgroundImage:
    "linear-gradient(45deg, transparent 50%, rgba(181, 236, 255, 0.78) 50%), linear-gradient(135deg, rgba(181, 236, 255, 0.78) 50%, transparent 50%)",
  backgroundPosition: "calc(100% - 14px) calc(50% - 2px), calc(100% - 9px) calc(50% - 2px)",
  backgroundSize: "5px 5px, 5px 5px",
  backgroundRepeat: "no-repeat",
  paddingRight: 24,
};

const hudBadgeStyle = {
  border: "1px solid rgba(101, 191, 223, 0.3)",
  background: "rgba(8, 18, 31, 0.85)",
  color: "#d8f6ff",
  borderRadius: 999,
  padding: "4px 9px",
  fontSize: "var(--dv-fs-2xs)",
  letterSpacing: "var(--dv-tr-normal)",
  lineHeight: "var(--dv-lh-compact)",
};

const hudButtonStyle = {
  border: "1px solid rgba(109, 198, 228, 0.3)",
  background: "rgba(7, 16, 29, 0.85)",
  color: "#d7f7ff",
  borderRadius: 999,
  fontSize: "var(--dv-fs-2xs)",
  letterSpacing: "var(--dv-tr-normal)",
  padding: "5px 10px",
  cursor: "pointer",
  transition: "border-color 160ms ease, background-color 160ms ease, box-shadow 180ms ease",
};
