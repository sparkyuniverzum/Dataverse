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

export default function QuickGridOverlay({
  open,
  selectedTable,
  tableRows,
  gridColumns,
  gridFilteredRows,
  gridSearchQuery,
  onGridSearchChange,
  onClose,
  readGridCell,
}) {
  if (!open) return null;

  return (
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
          <div style={{ fontSize: "var(--dv-fs-xs)", opacity: 0.7, letterSpacing: "var(--dv-tr-wide)" }}>Planeta / Tabulka</div>
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
          <button type="button" onClick={onClose} style={ghostButtonStyle}>
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
          onChange={(event) => onGridSearchChange(event.target.value)}
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
  );
}
