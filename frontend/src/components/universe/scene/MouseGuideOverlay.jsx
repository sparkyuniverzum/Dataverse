import { useEffect, useState } from "react";

export function MouseGuideOverlay({ level, hoveredNode }) {
  const [expanded, setExpanded] = useState(false);
  const isTablesLevel = level < 3;
  const title = isTablesLevel ? "L2 objekty: Souhvezdi / Planety" : "L3 objekty: Mesice";
  const lines = isTablesLevel
    ? [
        "Levy klik na planetu: otevres tabulku a jeji mesice.",
        "Pravy klik na planetu: akce (vstoupit/zpet).",
        "Male body kolem planety jsou mesice (nahled).",
        "Tazenim pozadi otacis kamerou, koleckem zoomujes.",
      ]
    : [
        "Levy klik na mesic: otevres detail radku tabulky.",
        "Pravy klik na mesic: akce (upravit/zhasnout).",
        "Nova vazba: pretahni mesic na mesic (prave tlacitko).",
        "Vazbu vyberes klikem na svetelnou krivku nebo jeji popisek.",
      ];

  const hoverTip = hoveredNode
    ? hoveredNode.kind === "table"
      ? `Objekt ${hoveredNode.label}: levy klik otevre detail, pravy klik otevre akce.`
      : `Objekt ${hoveredNode.label}: levy klik detail, pravy klik akce, pretazenim vytvoris vazbu.`
    : isTablesLevel
      ? "Najed mysi na planetu a hned uvidis, co muzes udelat."
      : "Propojeni mezi mesici vytvoris pretazenim.";
  const compactHint = isTablesLevel
    ? "LMB planeta: otevres tabulku. RMB: akce."
    : "LMB mesic: detail radku. RMB: akce.";

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
          {expanded ? "Min" : "?"}
        </button>
      </div>
      <div style={{ fontSize: "var(--dv-fs-sm)", marginTop: 5, color: "#9fe6ff", lineHeight: "var(--dv-lh-base)" }}>
        {hoveredNode ? hoverTip : compactHint}
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
