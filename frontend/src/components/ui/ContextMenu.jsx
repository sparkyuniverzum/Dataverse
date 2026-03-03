export default function ContextMenu({ menu, onClose, onAction }) {
  if (!menu) return null;

  const actions = menu.kind === "asteroid"
    ? [
        { id: "focus", label: "Fokus" },
        { id: "edit", label: "Upravit nerosty/suroviny" },
        { id: "extinguish", label: "Zhasnout mesic (Soft Delete)" },
      ]
    : [
        { id: "focus", label: "Vstoupit do souhvezdi" },
        { id: "back", label: "Zpet na galaxii" },
      ];

  return (
    <>
      <div
        role="presentation"
        onClick={onClose}
        style={{
          position: "fixed",
          inset: 0,
          zIndex: 45,
        }}
      />
      <div
        style={{
          position: "fixed",
          left: menu.x,
          top: menu.y,
          zIndex: 46,
          width: 220,
          borderRadius: 12,
          border: "1px solid rgba(107, 200, 233, 0.4)",
          background: "rgba(5, 13, 23, 0.94)",
          backdropFilter: "blur(8px)",
          overflow: "hidden",
          boxShadow: "0 0 24px rgba(52, 159, 212, 0.2)",
        }}
      >
        <div style={{ padding: "8px 10px", fontSize: "var(--dv-fs-xs)", color: "#a7dced", opacity: 0.84 }}>
          {menu.kind === "asteroid" ? "Mesic" : "Souhvezdi / Entita"}: {menu.label}
        </div>
        {actions.map((item) => (
          <button
            key={item.id}
            type="button"
            onClick={() => onAction(item.id, menu)}
            style={{
              width: "100%",
              border: "none",
              borderTop: "1px solid rgba(101, 186, 214, 0.16)",
              background: "transparent",
              color: "#d9f6ff",
              padding: "9px 10px",
              textAlign: "left",
              cursor: "pointer",
            }}
          >
            {item.label}
          </button>
        ))}
      </div>
    </>
  );
}
