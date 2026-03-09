const contextMenuButtonStyle = {
  border: "1px solid rgba(113, 202, 234, 0.3)",
  background: "rgba(7, 18, 32, 0.86)",
  color: "#d5f5ff",
  borderRadius: 8,
  padding: "7px 9px",
  fontSize: "var(--dv-fs-xs)",
  lineHeight: "var(--dv-lh-base)",
  textAlign: "left",
  cursor: "pointer",
};

export function WorkspaceContextMenu({ contextMenu, interactionLocked = false, onClose, onAction }) {
  if (!contextMenu?.open) return null;

  return (
    <>
      <div
        role="button"
        tabIndex={-1}
        aria-label="Close context menu"
        onClick={onClose}
        onContextMenu={(event) => {
          event.preventDefault();
          onClose();
        }}
        style={{ position: "fixed", inset: 0, zIndex: 62 }}
      />
      <div
        role="menu"
        style={{
          position: "fixed",
          left: contextMenu.x,
          top: contextMenu.y,
          zIndex: 63,
          width: 216,
          borderRadius: 10,
          border: "1px solid rgba(112, 207, 240, 0.36)",
          background: "rgba(4, 12, 22, 0.95)",
          color: "#def8ff",
          boxShadow: "0 0 24px rgba(31, 128, 176, 0.28)",
          padding: 6,
          display: "grid",
          gap: 6,
        }}
      >
        <div style={{ fontSize: "var(--dv-fs-2xs)", opacity: 0.78, padding: "2px 4px" }}>
          {contextMenu.kind === "table" ? "PLANET MENU" : "CIVILIZATION MENU"}:{" "}
          <strong>{contextMenu.label || contextMenu.id}</strong>
        </div>
        {contextMenu.kind === "table" ? (
          <>
            <button type="button" onClick={() => void onAction("focus_table")} style={contextMenuButtonStyle}>
              Fokus planety
            </button>
            <button type="button" onClick={() => void onAction("open_grid")} style={contextMenuButtonStyle}>
              Otevřít grid
            </button>
          </>
        ) : null}
        {contextMenu.kind === "asteroid" ? (
          <>
            <button type="button" onClick={() => void onAction("focus_asteroid")} style={contextMenuButtonStyle}>
              Fokus civilizace
            </button>
            <button type="button" onClick={() => void onAction("open_grid")} style={contextMenuButtonStyle}>
              Otevřít grid
            </button>
            <button
              type="button"
              onClick={() => void onAction("extinguish_asteroid")}
              disabled={interactionLocked}
              style={{ ...contextMenuButtonStyle, borderColor: "rgba(255, 161, 185, 0.4)", color: "#ffd2df" }}
            >
              Zhasnout civilizaci
            </button>
          </>
        ) : null}
      </div>
    </>
  );
}
