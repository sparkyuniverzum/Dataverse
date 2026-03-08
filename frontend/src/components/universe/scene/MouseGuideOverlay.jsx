import { useEffect, useState } from "react";
import { useMouseGuideContent } from "./mouseGuideOverlayContent";

export function MouseGuideOverlay({ level, hoveredNode }) {
  const [expanded, setExpanded] = useState(false);
  const t = useMouseGuideContent();

  const isTablesLevel = level < 3;
  const levelContent = isTablesLevel ? t.level2 : t.level3;
  const { title, lines, compactHint } = levelContent;

  const dynamicTip = hoveredNode
    ? hoveredNode.kind === "table"
      ? levelContent.hoverTip.table(hoveredNode.label)
      : levelContent.hoverTip.moon(hoveredNode.label)
    : compactHint;

  useEffect(() => {
    setExpanded(false);
  }, [level]);

  return (
    <div
      style={{
        position: "fixed",
        left: 12,
        bottom: 154,
        zIndex: 32,
        width: "min(360px, calc(100vw - 24px))",
        pointerEvents: "auto",
        borderRadius: 12,
        border: "1px solid rgba(109, 209, 241, 0.36)",
        background: "rgba(4, 12, 22, 0.78)",
        color: "#dcf8ff",
        padding: "7px 9px",
        boxShadow: "0 0 20px rgba(53, 164, 214, 0.22)",
        backdropFilter: "blur(7px)",
      }}
    >
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 8 }}>
        <div style={{ fontSize: "var(--dv-fs-xs)", letterSpacing: "var(--dv-tr-wide)", opacity: 0.86 }}>{title}</div>
        <button
          type="button"
          onClick={() => setExpanded((prev) => !prev)}
          style={{
            border: "1px solid rgba(108, 207, 239, 0.34)",
            borderRadius: 8,
            background: "rgba(7, 20, 34, 0.86)",
            color: "#cfefff",
            padding: "3px 7px",
            fontSize: "var(--dv-fs-xs)",
            cursor: "pointer",
          }}
        >
          {expanded ? t.buttons.minimize : t.buttons.expand}
        </button>
      </div>
      <div style={{ fontSize: "var(--dv-fs-sm)", marginTop: 5, color: "#9fe6ff", lineHeight: "var(--dv-lh-base)" }}>
        {dynamicTip}
      </div>
      {expanded ? (
        <div style={{ marginTop: 4, display: "grid", gap: 3 }}>
          {lines.map((item) => (
            <div key={item} style={{ fontSize: "var(--dv-fs-xs)", opacity: 0.9, lineHeight: "var(--dv-lh-base)" }}>
              {item}
            </div>
          ))}
        </div>
      ) : null}
    </div>
  );
}
