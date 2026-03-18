function pillStyle(active = false) {
  return {
    display: "inline-flex",
    alignItems: "center",
    gap: "0.4rem",
    padding: "0.48rem 0.8rem",
    borderRadius: "999px",
    border: active ? "1px solid rgba(255, 213, 122, 0.4)" : "1px solid rgba(114, 207, 255, 0.18)",
    background: active ? "rgba(50, 28, 7, 0.58)" : "rgba(3, 9, 22, 0.58)",
    color: active ? "#fff2d0" : "#dff6ff",
    fontSize: "0.76rem",
    letterSpacing: "0.02em",
    backdropFilter: "blur(12px)",
  };
}

function actionStyle(disabled = false) {
  return {
    borderRadius: "999px",
    border: `1px solid ${disabled ? "rgba(108, 148, 170, 0.18)" : "rgba(121, 214, 255, 0.28)"}`,
    background: disabled ? "rgba(35, 48, 58, 0.54)" : "rgba(4, 12, 28, 0.72)",
    color: disabled ? "rgba(196, 214, 227, 0.52)" : "#eef8ff",
    padding: "0.62rem 0.95rem",
    fontSize: "0.78rem",
    letterSpacing: "0.04em",
    cursor: disabled ? "default" : "pointer",
  };
}

export default function OperatorDock({
  galaxyName = "Galaxie",
  isOnline = true,
  isCommandEnabled = false,
  isGridOpen = false,
  isCommandOpen = false,
  onToggleCommandBar = () => {},
  onToggleGrid = () => {},
  onLogout = async () => {},
}) {
  return (
    <section
      data-testid="operator-dock"
      aria-label="Operator dock"
      style={{
        position: "absolute",
        top: "1rem",
        right: "1rem",
        zIndex: 30,
        display: "grid",
        gap: "0.65rem",
        justifyItems: "end",
      }}
    >
      <div style={{ display: "flex", gap: "0.55rem", flexWrap: "wrap", justifyContent: "flex-end" }}>
        <span style={pillStyle()}>{`Galaxie: ${galaxyName}`}</span>
        <span data-testid="operator-connectivity" style={pillStyle(!isOnline)}>
          {isOnline ? "Online" : "Offline"}
        </span>
      </div>

      <div
        style={{
          display: "flex",
          gap: "0.55rem",
          flexWrap: "wrap",
          justifyContent: "flex-end",
          padding: "0.68rem",
          borderRadius: "1rem",
          border: "1px solid rgba(117, 206, 255, 0.16)",
          background: "linear-gradient(180deg, rgba(5, 12, 28, 0.82), rgba(4, 8, 19, 0.72))",
          backdropFilter: "blur(14px)",
        }}
      >
        <button
          type="button"
          data-testid="operator-command-toggle"
          disabled={!isCommandEnabled}
          onClick={onToggleCommandBar}
          style={actionStyle(!isCommandEnabled)}
        >
          {isCommandOpen ? "Zavrit Command" : "Command Bar"}
        </button>
        <button type="button" data-testid="operator-grid-toggle" onClick={onToggleGrid} style={actionStyle(false)}>
          {isGridOpen ? "Zavrit Grid" : "Read Grid"}
        </button>
        <button type="button" data-testid="operator-logout" onClick={() => void onLogout()} style={actionStyle(false)}>
          Logout
        </button>
      </div>
    </section>
  );
}
