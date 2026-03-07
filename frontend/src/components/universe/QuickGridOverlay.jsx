import { useEffect, useMemo, useState } from "react";

import { tableDisplayName } from "./workspaceFormatters";

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
};

function safeJson(value) {
  try {
    return JSON.stringify(value);
  } catch {
    return String(value ?? "");
  }
}

function shortValue(value, max = 56) {
  if (value === null) return "null";
  if (typeof value === "undefined") return "undefined";
  const text =
    typeof value === "string"
      ? value
      : typeof value === "number" || typeof value === "boolean"
        ? String(value)
        : safeJson(value);
  if (text.length <= max) return text;
  return `${text.slice(0, max - 1)}…`;
}

function normalizeLifecycle(selectedRow) {
  if (!selectedRow || typeof selectedRow !== "object") {
    return {
      state: "UNKNOWN",
      healthScore: "n/a",
      violationCount: 0,
      eventSeq: "n/a",
      archived: false,
    };
  }
  const archived = selectedRow.is_deleted === true;
  const state = String(selectedRow.state || (archived ? "ARCHIVED" : "ACTIVE")).toUpperCase();
  return {
    state,
    healthScore: Number.isFinite(Number(selectedRow.health_score)) ? Number(selectedRow.health_score) : "n/a",
    violationCount: Number.isFinite(Number(selectedRow.violation_count)) ? Number(selectedRow.violation_count) : 0,
    eventSeq: Number.isFinite(Number(selectedRow.current_event_seq)) ? Number(selectedRow.current_event_seq) : "n/a",
    archived,
  };
}

function collectMineralEntries(selectedRow) {
  if (!selectedRow || typeof selectedRow !== "object") return [];
  const facts = Array.isArray(selectedRow.facts) ? selectedRow.facts : [];
  const metadata =
    selectedRow.metadata && typeof selectedRow.metadata === "object" && !Array.isArray(selectedRow.metadata)
      ? selectedRow.metadata
      : {};
  const byKey = new Map();

  facts.forEach((fact) => {
    const key = String(fact?.key || "").trim();
    if (!key) return;
    const errors = Array.isArray(fact?.errors) ? fact.errors : [];
    byKey.set(key, {
      key,
      source: String(fact?.source || "facts"),
      valueType: String(fact?.value_type || typeof fact?.typed_value || "unknown"),
      valuePreview: shortValue(fact?.typed_value),
      status: String(fact?.status || (errors.length ? "invalid" : "valid")),
      errorsCount: errors.length,
    });
  });

  Object.entries(metadata).forEach(([key, value]) => {
    if (byKey.has(key)) return;
    byKey.set(key, {
      key,
      source: "metadata",
      valueType: typeof value,
      valuePreview: shortValue(value),
      status: "valid",
      errorsCount: 0,
    });
  });

  return [...byKey.values()].sort((a, b) => a.key.localeCompare(b.key));
}

export default function QuickGridOverlay({
  open,
  selectedTable,
  tableRows,
  gridColumns,
  gridFilteredRows,
  gridSearchQuery,
  onGridSearchChange,
  selectedAsteroidId,
  onSelectRow,
  onCreateRow,
  onUpdateRow,
  onDeleteRow,
  onUpsertMetadata,
  pendingCreate = false,
  pendingRowOps = {},
  busy = false,
  onClose,
  readGridCell,
}) {
  const [createValue, setCreateValue] = useState("");
  const [editValue, setEditValue] = useState("");
  const [metadataKey, setMetadataKey] = useState("");
  const [metadataValue, setMetadataValue] = useState("");
  const selectedRow = useMemo(
    () => tableRows.find((row) => String(row.id) === String(selectedAsteroidId || "")) || null,
    [selectedAsteroidId, tableRows]
  );
  const selectedLifecycle = useMemo(() => normalizeLifecycle(selectedRow), [selectedRow]);
  const selectedMinerals = useMemo(() => collectMineralEntries(selectedRow), [selectedRow]);

  useEffect(() => {
    if (!open) return;
    if (!selectedRow) {
      setEditValue("");
      setMetadataKey("");
      setMetadataValue("");
      return;
    }
    setEditValue(String(selectedRow?.value ?? ""));
    const metadata = selectedRow?.metadata && typeof selectedRow.metadata === "object" ? selectedRow.metadata : {};
    const firstMetadataKey = Object.keys(metadata)[0] || "";
    setMetadataKey(String(firstMetadataKey));
    setMetadataValue(firstMetadataKey ? String(metadata[firstMetadataKey] ?? "") : "");
  }, [open, selectedRow]);

  if (!open) return null;

  const pendingRowsCount = Object.keys(pendingRowOps || {}).length;

  return (
    <section
      data-testid="quick-grid-overlay"
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
        gridTemplateRows: "auto auto auto auto auto auto auto 1fr",
        gap: 10,
      }}
    >
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "flex-start",
          gap: 10,
          flexWrap: "wrap",
        }}
      >
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
          <button type="button" onClick={onClose} data-testid="quick-grid-close-button" style={ghostButtonStyle}>
            3D Vesmír
          </button>
        </div>
      </div>

      <div
        data-testid="quick-grid-semantic-legend"
        style={{
          border: "1px solid rgba(96, 186, 220, 0.24)",
          borderRadius: 10,
          background: "rgba(6, 18, 30, 0.58)",
          padding: "7px 8px",
          display: "grid",
          gap: 6,
        }}
      >
        <div style={{ fontSize: "var(--dv-fs-2xs)", letterSpacing: "var(--dv-tr-wide)", opacity: 0.82 }}>
          SEMANTIC LEGEND
        </div>
        <div style={{ fontSize: "var(--dv-fs-xs)", opacity: 0.82, lineHeight: "var(--dv-lh-base)" }}>
          Civilizace = zivotni cyklus entity (stav, health, event seq). Nerost = atomicka typed hodnota uvnitr
          civilizace.
        </div>
        <div style={{ fontSize: "var(--dv-fs-2xs)", opacity: 0.74 }}>
          Workflow nerostu: <strong>UPSERT</strong> (ulozit) / <strong>REPAIR</strong> (guided oprava) /{" "}
          <strong>REMOVE_SOFT</strong> (prazdna hodnota).
        </div>
      </div>

      <div
        style={{
          display: "grid",
          gridTemplateColumns: "1fr auto auto",
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
          onChange={(event) => onGridSearchChange(event.target.value)}
          placeholder="Filtr radku a bunek..."
          style={inputStyle}
        />
        <span data-testid="quick-grid-columns-badge" style={{ ...hudBadgeStyle, fontSize: "var(--dv-fs-xs)" }}>
          sloupce {gridColumns.length}
        </span>
        <span data-testid="quick-grid-write-badge" style={{ ...hudBadgeStyle, fontSize: "var(--dv-fs-xs)" }}>
          write {busy ? "..." : "ready"}
        </span>
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
          value={createValue}
          onChange={(event) => setCreateValue(event.target.value)}
          placeholder="Nova hodnota civilizace..."
          style={inputStyle}
          disabled={busy}
        />
        <button
          type="button"
          style={ghostButtonStyle}
          disabled={busy || pendingCreate || !String(createValue || "").trim() || !selectedTable}
          onClick={async () => {
            const ok = await onCreateRow?.(createValue);
            if (ok) {
              setCreateValue("");
            }
          }}
        >
          {pendingCreate ? "Pridavam..." : "Pridat civilizaci"}
        </button>
      </div>

      <div
        style={{
          display: "grid",
          gridTemplateColumns: "1fr auto auto",
          gap: 8,
          alignItems: "center",
          border: "1px solid rgba(96, 186, 220, 0.22)",
          borderRadius: 10,
          background: "rgba(6, 18, 30, 0.52)",
          padding: "7px 8px",
        }}
      >
        <input
          value={editValue}
          onChange={(event) => setEditValue(event.target.value)}
          placeholder={selectedRow ? "Upravit hodnotu vybrane civilizace..." : "Vyber civilizaci v tabulce..."}
          style={inputStyle}
          disabled={busy || !selectedRow}
        />
        <button
          type="button"
          style={ghostButtonStyle}
          disabled={busy || !selectedRow || editValue === String(selectedRow?.value ?? "")}
          onClick={() => {
            void onUpdateRow?.(selectedRow?.id, editValue);
          }}
        >
          {selectedRow && pendingRowOps[String(selectedRow.id)] === "mutate" ? "Ukladam..." : "Ulozit"}
        </button>
        <button
          type="button"
          style={{ ...ghostButtonStyle, borderColor: "rgba(255, 152, 162, 0.45)", color: "#ffd6de" }}
          disabled={busy || !selectedRow}
          onClick={() => {
            void onDeleteRow?.(selectedRow?.id);
          }}
        >
          {selectedRow && pendingRowOps[String(selectedRow.id)] === "extinguish" ? "Zhasinam..." : "Zhasnout"}
        </button>
      </div>

      <div
        style={{
          display: "grid",
          gridTemplateColumns: "minmax(160px, 0.9fr) minmax(200px, 1fr) auto",
          gap: 8,
          alignItems: "center",
          border: "1px solid rgba(96, 186, 220, 0.22)",
          borderRadius: 10,
          background: "rgba(6, 18, 30, 0.52)",
          padding: "7px 8px",
        }}
      >
        <input
          value={metadataKey}
          onChange={(event) => setMetadataKey(event.target.value)}
          placeholder="Nerost / sloupec"
          style={inputStyle}
          disabled={busy || !selectedRow}
        />
        <input
          value={metadataValue}
          onChange={(event) => setMetadataValue(event.target.value)}
          placeholder={selectedRow ? "Hodnota (prazdne = remove_soft)" : "Vyber civilizaci v tabulce..."}
          style={inputStyle}
          disabled={busy || !selectedRow}
        />
        <button
          type="button"
          style={ghostButtonStyle}
          disabled={busy || !selectedRow || !String(metadataKey || "").trim()}
          onClick={async () => {
            const ok = await onUpsertMetadata?.(selectedRow?.id, metadataKey, metadataValue);
            if (ok && !String(metadataValue || "").trim()) {
              setMetadataValue("");
            }
          }}
        >
          {selectedRow && pendingRowOps[String(selectedRow.id)] === "metadata" ? "Ukladam..." : "Ulozit nerost"}
        </button>
      </div>

      <div
        data-testid="quick-grid-civilization-inspector"
        style={{
          border: "1px solid rgba(96, 186, 220, 0.24)",
          borderRadius: 10,
          background: "rgba(6, 18, 30, 0.58)",
          padding: "8px 9px",
          display: "grid",
          gap: 7,
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: 6, flexWrap: "wrap" }}>
          <span style={{ ...hudBadgeStyle, fontSize: "var(--dv-fs-xs)" }}>pending radky {pendingRowsCount || 0}</span>
          <span style={{ ...hudBadgeStyle, fontSize: "var(--dv-fs-xs)" }}>
            vybrana civilizace {selectedRow ? "ano" : "ne"}
          </span>
        </div>
        {!selectedRow ? (
          <div style={{ fontSize: "var(--dv-fs-xs)", opacity: 0.74 }}>
            Vyber civilizaci v tabulce. Inspector pak oddeli lifecycle vs nerosty.
          </div>
        ) : (
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
            <div
              data-testid="quick-grid-lifecycle-panel"
              style={{
                border: "1px solid rgba(95, 183, 218, 0.22)",
                borderRadius: 8,
                background: "rgba(6, 16, 28, 0.64)",
                padding: "7px 8px",
                display: "grid",
                gap: 4,
              }}
            >
              <div style={{ fontSize: "var(--dv-fs-2xs)", letterSpacing: "var(--dv-tr-wide)", opacity: 0.82 }}>
                CIVILIZATION LIFECYCLE
              </div>
              <div style={{ fontSize: "var(--dv-fs-xs)", opacity: 0.88 }}>
                state: <strong>{selectedLifecycle.state}</strong>
              </div>
              <div style={{ fontSize: "var(--dv-fs-2xs)", opacity: 0.8 }}>
                health: {selectedLifecycle.healthScore} | violations: {selectedLifecycle.violationCount}
              </div>
              <div style={{ fontSize: "var(--dv-fs-2xs)", opacity: 0.74 }}>
                event_seq: {selectedLifecycle.eventSeq} | archived: {selectedLifecycle.archived ? "yes" : "no"}
              </div>
            </div>
            <div
              data-testid="quick-grid-mineral-panel"
              style={{
                border: "1px solid rgba(95, 183, 218, 0.22)",
                borderRadius: 8,
                background: "rgba(6, 16, 28, 0.64)",
                padding: "7px 8px",
                display: "grid",
                gap: 4,
              }}
            >
              <div style={{ fontSize: "var(--dv-fs-2xs)", letterSpacing: "var(--dv-tr-wide)", opacity: 0.82 }}>
                MINERAL FACTS
              </div>
              {selectedMinerals.length ? (
                selectedMinerals.slice(0, 8).map((mineral) => (
                  <div key={mineral.key} style={{ fontSize: "var(--dv-fs-2xs)", opacity: 0.82 }}>
                    {mineral.key}: <strong>{mineral.valuePreview}</strong> ({mineral.valueType}) [{mineral.status}]
                    {mineral.errorsCount ? ` errors=${mineral.errorsCount}` : ""}
                  </div>
                ))
              ) : (
                <div style={{ fontSize: "var(--dv-fs-2xs)", opacity: 0.7 }}>Nerosty zatim nejsou k dispozici.</div>
              )}
            </div>
          </div>
        )}
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
                  {column === "value" ? "civilizace" : column}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {gridFilteredRows.map((row) => {
              const rowPendingOp = pendingRowOps[String(row.id)] || null;
              return (
                <tr
                  key={String(row.id)}
                  data-testid="quick-grid-row"
                  onClick={() => onSelectRow?.(String(row.id))}
                  style={{ cursor: "pointer" }}
                >
                  {gridColumns.map((column, index) => (
                    <td
                      key={`${row.id}:${column}`}
                      style={{
                        position: index === 0 ? "sticky" : "relative",
                        left: index === 0 ? 0 : undefined,
                        zIndex: index === 0 ? 1 : 0,
                        borderBottom: "1px solid rgba(95, 177, 207, 0.14)",
                        background:
                          String(selectedAsteroidId || "") === String(row.id)
                            ? "rgba(17, 57, 84, 0.85)"
                            : index === 0
                              ? "rgba(7, 18, 30, 0.95)"
                              : "rgba(7, 18, 30, 0.72)",
                        opacity: rowPendingOp ? 0.72 : 1,
                        color: "#dff8ff",
                        padding: "6px 8px",
                        fontSize: "var(--dv-fs-sm)",
                        lineHeight: "var(--dv-lh-base)",
                      }}
                    >
                      {`${readGridCell(row, column) || "—"}${index === 0 && rowPendingOp ? ` (${rowPendingOp})` : ""}`}
                    </td>
                  ))}
                </tr>
              );
            })}
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
  );
}
