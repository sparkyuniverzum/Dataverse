export default function LinkHoverTooltip({ hoveredLink }) {
  if (!hoveredLink) return null;
  return (
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
  );
}
