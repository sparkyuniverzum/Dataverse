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

export default function WorkspaceSidebar({
  galaxy,
  tableNodes,
  asteroidCount,
  bondCount,
  loading,
  busy,
  error,
  starRuntime,
  starDomains,
  starPulseLastEventSeq,
  selectedTableId,
  selectedTableLabel,
  selectedAsteroidLabel,
  onSelectTable,
  onOpenGrid,
  onRefresh,
  onBackToGalaxies,
  onLogout,
}) {
  const topDomains = (Array.isArray(starDomains) ? starDomains : []).slice(0, 3);
  const hotEventTypes = Array.isArray(starRuntime?.hot_event_types) ? starRuntime.hot_event_types.slice(0, 3) : [];

  return (
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
        <span style={hudBadgeStyle}>Mesice {asteroidCount}</span>
        <span style={hudBadgeStyle}>Vazby {bondCount}</span>
        <span style={hudBadgeStyle}>Star seq {Number.isFinite(Number(starPulseLastEventSeq)) ? Number(starPulseLastEventSeq) : 0}</span>
        {loading ? <span style={{ ...hudBadgeStyle, color: "#9de7ff" }}>Nacitam...</span> : null}
        {busy ? <span style={{ ...hudBadgeStyle, color: "#ffd59c" }}>Ukladam...</span> : null}
      </div>

      <div
        style={{
          border: "1px solid rgba(84, 194, 238, 0.2)",
          background: "rgba(3, 12, 24, 0.8)",
          borderRadius: 10,
          padding: "8px 9px",
          display: "grid",
          gap: 6,
        }}
      >
        <div style={{ fontSize: "var(--dv-fs-2xs)", letterSpacing: "var(--dv-tr-wide)", opacity: 0.78 }}>
          SOURCE CORE
        </div>
        <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
          <span style={hudBadgeStyle}>
            Write/min{" "}
            <strong>
              {Number.isFinite(Number(starRuntime?.writes_per_minute))
                ? Number(starRuntime.writes_per_minute).toFixed(2)
                : "0.00"}
            </strong>
          </span>
          <span style={hudBadgeStyle}>Events {Number.isFinite(Number(starRuntime?.events_count)) ? Number(starRuntime.events_count) : 0}</span>
          <span style={hudBadgeStyle}>Entity hot {Number.isFinite(Number(starRuntime?.hot_entities_count)) ? Number(starRuntime.hot_entities_count) : 0}</span>
        </div>
        {hotEventTypes.length ? (
          <div style={{ fontSize: "var(--dv-fs-2xs)", opacity: 0.86 }}>
            Typy: <strong>{hotEventTypes.join(" · ")}</strong>
          </div>
        ) : null}
        {topDomains.length ? (
          <div style={{ display: "grid", gap: 4 }}>
            {topDomains.map((domain) => {
              const name = String(domain?.domain_name || "Uncategorized");
              const status = String(domain?.status || "GREEN").toUpperCase();
              const intensity = Math.max(0, Math.min(1, Number(domain?.activity_intensity || 0)));
              const eventCount = Number.isFinite(Number(domain?.events_count)) ? Number(domain.events_count) : 0;
              return (
                <div key={name} style={{ fontSize: "var(--dv-fs-2xs)", display: "grid", gap: 2 }}>
                  <div style={{ display: "flex", justifyContent: "space-between", gap: 8 }}>
                    <span>
                      {name} · <strong>{eventCount}</strong>
                    </span>
                    <span style={{ color: status === "RED" ? "#ff8ead" : status === "YELLOW" ? "#ffd48d" : "#92f1c9" }}>{status}</span>
                  </div>
                  <div
                    style={{
                      height: 4,
                      borderRadius: 999,
                      background: "rgba(99, 170, 208, 0.24)",
                      overflow: "hidden",
                    }}
                  >
                    <div
                      style={{
                        width: `${Math.round(intensity * 100)}%`,
                        height: "100%",
                        background:
                          status === "RED"
                            ? "linear-gradient(90deg, #ff7f96, #ff5778)"
                            : status === "YELLOW"
                              ? "linear-gradient(90deg, #ffca7b, #ffab51)"
                              : "linear-gradient(90deg, #67dbff, #83ffce)",
                      }}
                    />
                  </div>
                </div>
              );
            })}
          </div>
        ) : null}
      </div>

      <label style={{ display: "grid", gap: 4 }}>
        <span style={{ fontSize: "var(--dv-fs-2xs)", opacity: 0.76, letterSpacing: "var(--dv-tr-wide)" }}>AKTIVNI PLANETA</span>
        <select
          value={selectedTableId}
          onChange={(event) => onSelectTable(String(event.target.value || ""))}
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
        {selectedTableLabel || "Vyber planetu kliknutim v prostoru."}
      </div>
      {selectedAsteroidLabel ? (
        <div style={{ fontSize: "var(--dv-fs-xs)", opacity: 0.82 }}>
          Vybrany mesic: <strong>{selectedAsteroidLabel}</strong>
        </div>
      ) : null}

      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 6 }}>
        <button type="button" onClick={onOpenGrid} disabled={!selectedTableId} style={actionButtonStyle}>
          Otevrit grid
        </button>
        <button type="button" onClick={onRefresh} disabled={loading} style={ghostButtonStyle}>
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
  );
}
