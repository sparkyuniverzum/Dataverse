export default function AppConnectivityNotice({ notice = null }) {
  if (!notice) return null;
  const tone = String(notice?.tone || "info").toLowerCase();
  return (
    <div
      data-testid="app-connectivity-notice"
      style={{
        position: "fixed",
        top: 14,
        left: "50%",
        transform: "translateX(-50%)",
        zIndex: 120,
        width: "min(620px, calc(100vw - 28px))",
        borderRadius: 12,
        border: tone === "warn" ? "1px solid rgba(255, 194, 142, 0.36)" : "1px solid rgba(108, 206, 240, 0.32)",
        background: tone === "warn" ? "rgba(42, 24, 8, 0.88)" : "rgba(6, 18, 30, 0.84)",
        color: tone === "warn" ? "#ffd5a3" : "#d9f8ff",
        padding: "10px 12px",
        boxShadow: "0 0 24px rgba(0, 0, 0, 0.24)",
        backdropFilter: "blur(8px)",
        display: "grid",
        gap: 4,
      }}
    >
      <div style={{ fontSize: "var(--dv-fs-xs)", letterSpacing: "var(--dv-tr-wide)", opacity: 0.84 }}>
        <strong>{String(notice?.title || "Stav pripojeni")}</strong>
      </div>
      <div style={{ fontSize: "var(--dv-fs-sm)", lineHeight: "var(--dv-lh-base)" }}>
        {String(notice?.message || "")}
      </div>
    </div>
  );
}
