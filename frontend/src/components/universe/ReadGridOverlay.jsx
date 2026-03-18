import { useDeferredValue } from "react";

function panelStyle() {
  return {
    borderRadius: "1.2rem",
    border: "1px solid rgba(118, 211, 255, 0.18)",
    background: "linear-gradient(180deg, rgba(4, 10, 24, 0.94), rgba(3, 7, 17, 0.9))",
    boxShadow: "0 18px 48px rgba(0, 0, 0, 0.34)",
  };
}

export default function ReadGridOverlay({
  isOpen = false,
  civilizations = [],
  bonds = [],
  query = "",
  selectedCivilizationId = "",
  onClose = () => {},
  onQueryChange = () => {},
  onSelectCivilization = () => {},
}) {
  const deferredQuery = useDeferredValue(query);
  if (!isOpen) return null;

  const normalizedQuery = String(deferredQuery || "")
    .trim()
    .toLowerCase();
  const filteredRows = civilizations.filter((item) => {
    if (!normalizedQuery) return true;
    return [item.value, item.table_name, item.planet_name, item.constellation_name, item.id]
      .map((value) => String(value || "").toLowerCase())
      .some((value) => value.includes(normalizedQuery));
  });

  const selectedRow = filteredRows.find((item) => item.id === selectedCivilizationId) || null;

  return (
    <section
      data-testid="read-grid"
      aria-label="Read-only grid"
      style={{
        position: "absolute",
        left: "1rem",
        right: "1rem",
        bottom: "1rem",
        zIndex: 31,
        display: "grid",
        gridTemplateColumns: "minmax(0, 1.45fr) minmax(280px, 0.8fr)",
        gap: "0.9rem",
        alignItems: "start",
      }}
    >
      <div style={{ ...panelStyle(), padding: "1rem", display: "grid", gap: "0.8rem" }}>
        <div style={{ display: "flex", justifyContent: "space-between", gap: "1rem", alignItems: "center" }}>
          <div style={{ display: "grid", gap: "0.16rem" }}>
            <strong style={{ color: "#effbff" }}>Read Grid</strong>
            <span style={{ color: "rgba(200, 225, 244, 0.72)", fontSize: "0.78rem" }}>
              Civilizace a vazby nad canonical snapshot truth.
            </span>
          </div>
          <button
            type="button"
            onClick={onClose}
            style={{
              borderRadius: "999px",
              border: "1px solid rgba(120, 210, 255, 0.24)",
              background: "rgba(5, 12, 28, 0.72)",
              color: "#eef9ff",
              padding: "0.5rem 0.8rem",
              cursor: "pointer",
            }}
          >
            Zavrit
          </button>
        </div>

        <div style={{ display: "flex", gap: "0.75rem", flexWrap: "wrap", alignItems: "center" }}>
          <input
            data-testid="read-grid-query"
            type="text"
            value={query}
            onChange={(event) => onQueryChange(event.target.value)}
            placeholder="Filtr civilizaci..."
            style={{
              minWidth: "240px",
              flex: "1 1 320px",
              borderRadius: "0.95rem",
              border: "1px solid rgba(117, 209, 255, 0.2)",
              background: "rgba(2, 9, 20, 0.92)",
              color: "#f1fbff",
              padding: "0.76rem 0.9rem",
            }}
          />
          <span
            style={{ color: "rgba(208, 228, 242, 0.7)", fontSize: "0.78rem" }}
          >{`Rows: ${filteredRows.length}`}</span>
          <span style={{ color: "rgba(208, 228, 242, 0.7)", fontSize: "0.78rem" }}>{`Bonds: ${bonds.length}`}</span>
        </div>

        <div style={{ display: "grid", gap: "0.45rem", maxHeight: "26rem", overflow: "auto", paddingRight: "0.15rem" }}>
          {filteredRows.map((item) => {
            const selected = item.id === selectedCivilizationId;
            return (
              <button
                key={item.id}
                type="button"
                data-testid="read-grid-row"
                onClick={() => onSelectCivilization(item)}
                style={{
                  textAlign: "left",
                  display: "grid",
                  gap: "0.18rem",
                  padding: "0.8rem 0.9rem",
                  borderRadius: "0.95rem",
                  border: `1px solid ${selected ? "rgba(255, 214, 127, 0.32)" : "rgba(117, 208, 255, 0.12)"}`,
                  background: selected ? "rgba(43, 30, 8, 0.72)" : "rgba(6, 12, 26, 0.58)",
                  color: "#ecfbff",
                  cursor: "pointer",
                }}
              >
                <strong style={{ fontSize: "0.9rem" }}>{String(item.value || item.id || "Civilizace")}</strong>
                <span style={{ fontSize: "0.76rem", color: "rgba(210, 231, 244, 0.72)" }}>
                  {`${String(item.planet_name || item.table_name || "Neznama planeta")} / ${String(item.constellation_name || "Bez souhvezdi")}`}
                </span>
                <span style={{ fontSize: "0.74rem", color: "rgba(183, 222, 245, 0.62)" }}>
                  {`Alerty: ${Number(item.error_count || 0)} | Event seq: ${Number(item.current_event_seq || 0)}`}
                </span>
              </button>
            );
          })}
          {!filteredRows.length ? (
            <div
              style={{
                borderRadius: "0.95rem",
                border: "1px dashed rgba(117, 209, 255, 0.22)",
                padding: "1rem",
                color: "rgba(209, 228, 243, 0.72)",
              }}
            >
              Snapshot momentalne neobsahuje zadne civilizace pro tento filtr.
            </div>
          ) : null}
        </div>
      </div>

      <div style={{ ...panelStyle(), padding: "1rem", display: "grid", gap: "0.75rem" }}>
        <strong style={{ color: "#effbff" }}>Vybrany detail</strong>
        {selectedRow ? (
          <>
            <div style={{ display: "grid", gap: "0.18rem" }}>
              <span style={{ color: "rgba(255, 237, 188, 0.9)", fontSize: "0.84rem" }}>{selectedRow.value}</span>
              <span style={{ color: "rgba(209, 230, 242, 0.72)", fontSize: "0.78rem" }}>{selectedRow.id}</span>
            </div>
            <div style={{ color: "rgba(219, 238, 251, 0.8)", fontSize: "0.82rem", lineHeight: 1.5 }}>
              {`Planeta: ${String(selectedRow.planet_name || selectedRow.table_name || "Neznama")}`}
              <br />
              {`Tabulka: ${String(selectedRow.table_name || selectedRow.table_id || "Neznama")}`}
              <br />
              {`Aktivni alerty: ${Array.isArray(selectedRow.active_alerts) ? selectedRow.active_alerts.length : 0}`}
            </div>
          </>
        ) : (
          <div style={{ color: "rgba(209, 228, 243, 0.7)", fontSize: "0.82rem", lineHeight: 1.5 }}>
            Klikni na radek a Read Grid prepne selection zpet do workspace.
          </div>
        )}
      </div>
    </section>
  );
}
