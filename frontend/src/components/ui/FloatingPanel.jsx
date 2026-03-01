import { useCallback, useEffect, useMemo, useRef, useState } from "react";

import { normalizePanelRect } from "../../store/useUniverseStore";

export default function FloatingPanel({
  id,
  title,
  config,
  onPatch,
  minimizedDockIndex = 0,
  hideCollapsedHandle = false,
  children,
}) {
  const rect = useMemo(() => normalizePanelRect(config?.rect), [config?.rect]);
  const collapsed = Boolean(config?.collapsed);
  const [dragging, setDragging] = useState(false);
  const dragRef = useRef({ x: 0, y: 0, offsetX: 0, offsetY: 0 });

  const beginDrag = useCallback(
    (event) => {
      event.preventDefault();
      dragRef.current = {
        x: rect.x,
        y: rect.y,
        offsetX: event.clientX - rect.x,
        offsetY: event.clientY - rect.y,
      };
      setDragging(true);
    },
    [rect.x, rect.y]
  );

  useEffect(() => {
    if (!dragging) return undefined;
    const onMove = (event) => {
      const nextX = Math.max(8, event.clientX - dragRef.current.offsetX);
      const nextY = Math.max(8, event.clientY - dragRef.current.offsetY);
      onPatch(id, { rect: { ...rect, x: nextX, y: nextY } });
    };
    const onUp = () => setDragging(false);

    window.addEventListener("mousemove", onMove);
    window.addEventListener("mouseup", onUp);
    return () => {
      window.removeEventListener("mousemove", onMove);
      window.removeEventListener("mouseup", onUp);
    };
  }, [dragging, id, onPatch, rect]);

  if (collapsed) {
    if (hideCollapsedHandle) return null;
    const safeDockIndex = Math.max(0, minimizedDockIndex);
    return (
      <button
        type="button"
        onClick={() => onPatch(id, { collapsed: false })}
        style={{
          position: "fixed",
          right: 18,
          bottom: 18 + safeDockIndex * 48,
          zIndex: 62,
          border: "1px solid rgba(103, 210, 244, 0.45)",
          background: "rgba(8, 17, 31, 0.95)",
          color: "#d8f7ff",
          borderRadius: 999,
          padding: "8px 14px",
          fontSize: 13,
          fontWeight: 700,
          cursor: "pointer",
          boxShadow: "0 0 16px rgba(44, 169, 219, 0.26)",
        }}
      >
        {title}
      </button>
    );
  }

  return (
    <section
      style={{
        position: "fixed",
        left: rect.x,
        top: rect.y,
        width: rect.width,
        height: rect.height,
        zIndex: 40,
        borderRadius: 12,
        border: "1px solid rgba(99, 194, 228, 0.35)",
        background: "rgba(4, 11, 21, 0.84)",
        color: "#d9f8ff",
        backdropFilter: "blur(8px)",
        display: "grid",
        gridTemplateRows: "34px minmax(0, 1fr)",
        resize: "both",
        overflow: "hidden",
        minWidth: 260,
        minHeight: 120,
        boxShadow: "0 0 30px rgba(48, 151, 201, 0.18)",
      }}
      onMouseUp={(event) => {
        const panel = event.currentTarget;
        if (!(panel instanceof HTMLElement)) return;
        onPatch(id, {
          rect: {
            ...rect,
            width: panel.offsetWidth,
            height: panel.offsetHeight,
          },
        });
      }}
    >
      <header
        onMouseDown={beginDrag}
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          padding: "0 10px",
          borderBottom: "1px solid rgba(90, 170, 205, 0.28)",
          cursor: dragging ? "grabbing" : "grab",
          userSelect: "none",
        }}
      >
        <span style={{ fontSize: 12, fontWeight: 700, letterSpacing: 0.3, color: "#d7f7ff" }}>{title}</span>
        <button
          type="button"
          onMouseDown={(event) => event.stopPropagation()}
          onClick={() => onPatch(id, { collapsed: true })}
          style={{
            border: "1px solid rgba(106, 194, 231, 0.32)",
            borderRadius: 999,
            background: "rgba(8, 18, 30, 0.84)",
            color: "#ceeffa",
            padding: "2px 8px",
            fontSize: 11,
            cursor: "pointer",
          }}
        >
          Min
        </button>
      </header>

      <div style={{ minHeight: 0, overflow: "auto", padding: 10 }}>{children}</div>
    </section>
  );
}
