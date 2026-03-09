import { useDraggable, useDroppable } from "@dnd-kit/core";

export function StageZeroDraggablePlanetCard({ disabled = false }) {
  const { attributes, listeners, setNodeRef, transform, isDragging } = useDraggable({
    id: "stage0:planet-item",
    disabled,
  });

  const translateStyle = transform
    ? { transform: `translate3d(${Math.round(transform.x)}px, ${Math.round(transform.y)}px, 0)` }
    : null;

  return (
    <button
      data-testid="stage0-draggable-planet-card"
      ref={setNodeRef}
      type="button"
      {...attributes}
      {...listeners}
      disabled={disabled}
      style={{
        border: "1px solid rgba(137, 231, 255, 0.56)",
        background: "radial-gradient(circle at 50% 35%, rgba(90, 218, 255, 0.42), rgba(16, 70, 102, 0.82))",
        color: "#dfffff",
        borderRadius: 12,
        padding: "14px 10px",
        fontWeight: 700,
        cursor: disabled ? "not-allowed" : "grab",
        textAlign: "left",
        display: "grid",
        gap: 4,
        boxShadow: isDragging ? "0 0 24px rgba(105, 230, 255, 0.44)" : "0 0 14px rgba(105, 230, 255, 0.2)",
        opacity: disabled ? 0.6 : 1,
        ...translateStyle,
      }}
    >
      <span style={{ fontSize: "var(--dv-fs-sm)" }}>Planeta</span>
      <span style={{ fontSize: "var(--dv-fs-xs)", opacity: 0.82 }}>Základní datový kontejner</span>
    </button>
  );
}

export function StageZeroDropZone({ active = false }) {
  const { setNodeRef, isOver } = useDroppable({
    id: "stage0:canvas-drop-zone",
    disabled: !active,
  });
  if (!active) return null;
  return (
    <div
      ref={setNodeRef}
      data-testid="stage0-drop-zone"
      data-stage-zero-drop-zone="true"
      style={{
        position: "fixed",
        inset: 0,
        zIndex: 57,
        pointerEvents: "auto",
        border: isOver ? "2px solid rgba(125, 226, 255, 0.74)" : "2px dashed rgba(125, 226, 255, 0.36)",
        boxShadow: isOver ? "inset 0 0 48px rgba(89, 209, 255, 0.24)" : "inset 0 0 24px rgba(89, 209, 255, 0.1)",
        opacity: isOver ? 1 : 0.82,
        transition: "opacity 160ms ease, border-color 180ms ease, box-shadow 180ms ease",
      }}
    />
  );
}

export function StageZeroDragGhost() {
  return (
    <div
      style={{
        width: 160,
        borderRadius: 12,
        border: "1px solid rgba(144, 233, 255, 0.66)",
        background: "radial-gradient(circle at 50% 35%, rgba(103, 226, 255, 0.34), rgba(12, 54, 78, 0.44))",
        color: "#defdff",
        padding: "12px 10px",
        backdropFilter: "blur(3px)",
        boxShadow: "0 0 26px rgba(97, 221, 255, 0.32)",
        opacity: 0.86,
        pointerEvents: "none",
      }}
    >
      <div style={{ fontSize: "var(--dv-fs-sm)", fontWeight: 700 }}>Hologram planety</div>
      <div style={{ fontSize: "var(--dv-fs-xs)", opacity: 0.82 }}>Pusť mě do prostoru</div>
    </div>
  );
}

export function resolveDragCenter(event) {
  const translated = event?.active?.rect?.current?.translated;
  const initial = event?.active?.rect?.current?.initial;
  const rect = translated || initial;
  if (!rect) return null;
  return {
    x: Number(rect.left) + Number(rect.width) / 2,
    y: Number(rect.top) + Number(rect.height) / 2,
  };
}
