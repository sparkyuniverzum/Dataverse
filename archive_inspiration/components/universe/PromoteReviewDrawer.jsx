import {
  createFloatingDrawerStyle,
  createGhostButtonStyle,
  createPanelCardStyle,
  createPrimaryButtonStyle,
  SURFACE_TONE,
} from "./surfaceVisualTokens";
import { resolveSurfaceCopy } from "./operatingCenterUxContract";

const panelStyle = createFloatingDrawerStyle(SURFACE_TONE.PROMOTE);
const ghostButtonStyle = createGhostButtonStyle(SURFACE_TONE.PROMOTE);
const primaryButtonStyle = createPrimaryButtonStyle(SURFACE_TONE.PROMOTE);

export function PromoteReviewDrawer({ review, onClose, onConfirm }) {
  if (!review?.open) return null;
  const copy = resolveSurfaceCopy("promote");

  return (
    <aside data-testid="promote-review-drawer" style={panelStyle}>
      <div style={{ display: "grid", gap: 4 }}>
        <div style={{ fontSize: "var(--dv-fs-2xs)", letterSpacing: "0.18em", opacity: 0.78 }}>{copy.eyebrow}</div>
        <div style={{ fontSize: "var(--dv-fs-lg)", fontWeight: 700 }}>{review.title}</div>
        <div style={{ fontSize: "var(--dv-fs-xs)", opacity: 0.82 }}>{copy.subtitle}</div>
      </div>

      <div
        style={createPanelCardStyle({
          border: "1px solid rgba(255, 204, 138, 0.2)",
          background: "rgba(44, 28, 14, 0.48)",
        })}
      >
        <div style={{ fontSize: "var(--dv-fs-xs)", opacity: 0.9 }}>
          Vetev: <strong>{review.branchLabel}</strong>
        </div>
        <div style={{ fontSize: "var(--dv-fs-xs)", opacity: 0.82 }}>
          Cil: <strong>hlavni timeline</strong>
        </div>
        <div style={{ fontSize: "var(--dv-fs-xs)", opacity: 0.82 }}>
          Rezim: <strong>{review.badgeLabel}</strong>
        </div>
      </div>

      <div style={{ display: "grid", gap: 6 }}>
        {review.checklist.map((item) => (
          <div
            key={item.id}
            style={{
              borderRadius: 10,
              border:
                item.state === "blocked"
                  ? "1px solid rgba(255, 132, 132, 0.28)"
                  : item.state === "warn"
                    ? "1px solid rgba(255, 198, 116, 0.24)"
                    : "1px solid rgba(136, 226, 176, 0.22)",
              background:
                item.state === "blocked"
                  ? "rgba(61, 18, 26, 0.46)"
                  : item.state === "warn"
                    ? "rgba(61, 38, 10, 0.4)"
                    : "rgba(15, 48, 29, 0.34)",
              padding: "8px 10px",
              fontSize: "var(--dv-fs-xs)",
            }}
          >
            {item.label}
          </div>
        ))}
      </div>

      {review.blockingReason ? (
        <div
          data-testid="promote-review-blocking"
          style={{
            borderRadius: 10,
            border: "1px solid rgba(255, 132, 132, 0.28)",
            background: "rgba(61, 18, 26, 0.46)",
            padding: "9px 10px",
            fontSize: "var(--dv-fs-xs)",
          }}
        >
          {review.blockingReason}
        </div>
      ) : null}

      {review.summary ? (
        <div
          data-testid="promote-review-summary"
          style={{
            borderRadius: 10,
            border: "1px solid rgba(131, 208, 255, 0.24)",
            background: "rgba(13, 32, 53, 0.44)",
            padding: "9px 10px",
            fontSize: "var(--dv-fs-xs)",
          }}
        >
          Posledni vysledek: {review.summary}
        </div>
      ) : null}

      <div style={{ display: "flex", gap: 8, justifyContent: "flex-end", flexWrap: "wrap" }}>
        <button type="button" data-testid="promote-review-close" onClick={onClose} style={ghostButtonStyle}>
          {copy.closeLabel}
        </button>
        <button
          type="button"
          data-testid="promote-review-confirm"
          onClick={() => void onConfirm?.()}
          disabled={!review.canConfirm}
          style={{
            ...primaryButtonStyle,
            border: "1px solid rgba(255, 208, 124, 0.5)",
            cursor: review.busy ? "wait" : "pointer",
            opacity: review.canConfirm ? 1 : 0.56,
          }}
        >
          {review.busy ? "Promotuji..." : "Potvrdit reality transfer"}
        </button>
      </div>
    </aside>
  );
}
