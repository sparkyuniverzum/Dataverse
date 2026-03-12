function chipStyle() {
  return {
    display: "inline-flex",
    alignItems: "center",
    gap: "0.4rem",
    padding: "0.42rem 0.78rem",
    borderRadius: "999px",
    border: "1px solid rgba(110, 204, 255, 0.22)",
    background: "rgba(4, 11, 26, 0.58)",
    color: "#d9f7ff",
    fontSize: "0.77rem",
    letterSpacing: "0.02em",
    backdropFilter: "blur(14px)",
  };
}

function panelStyle() {
  return {
    display: "grid",
    gap: "0.35rem",
    padding: "0.95rem 1rem",
    borderRadius: "1rem",
    border: "1px solid rgba(112, 205, 255, 0.16)",
    background: "linear-gradient(180deg, rgba(4, 10, 23, 0.74) 0%, rgba(3, 7, 17, 0.46) 100%)",
    color: "#eef7ff",
    backdropFilter: "blur(18px)",
  };
}

function resolvePrompt(navigationModel) {
  if (navigationModel.mode === "approach_active") {
    return {
      title: `Přibližuješ se k objektu ${navigationModel.selectedObject?.label || ""}`.trim(),
      hint: "Esc tě vrátí o krok zpět. Ještě nejsi uvnitř další vrstvy.",
    };
  }
  if (navigationModel.mode === "object_selected") {
    return {
      title: `Vybraný objekt: ${navigationModel.selectedObject?.label || "objekt"}`,
      hint: "Dvojklik spustí přiblížení. Radar i scéna drží stejný selection focus.",
    };
  }
  return {
    title: "Volná navigace galaxií",
    hint: "Klik vybere objekt. Dvojklik spustí přiblížení. Myší měníš směr pohledu.",
  };
}

function headingToArrow(headingDegrees) {
  const rotation = Number.isFinite(Number(headingDegrees)) ? Number(headingDegrees) : 0;
  return `rotate(${rotation} 50 50)`;
}

export default function GalaxySelectionHud({ model, navigationModel, radarModel }) {
  const prompt = resolvePrompt(navigationModel);

  return (
    <>
      <section
        data-testid="galaxy-selection-hud"
        aria-label="HUD hlavního prostoru galaxie"
        style={{
          position: "absolute",
          top: "1rem",
          left: "1rem",
          zIndex: 3,
          display: "grid",
          gap: "0.7rem",
          maxWidth: "24rem",
        }}
      >
        <div style={{ display: "flex", flexWrap: "wrap", gap: "0.55rem" }}>
          <span style={chipStyle()}>{`Galaxie: ${model.galaxyName}`}</span>
          <span style={chipStyle()}>{model.globalStage}</span>
          <span style={chipStyle()}>{model.syncLabel}</span>
        </div>
        <div style={panelStyle()}>
          <strong style={{ fontSize: "0.96rem" }}>{prompt.title}</strong>
          <span style={{ color: "rgba(223, 239, 255, 0.76)", fontSize: "0.88rem", lineHeight: 1.42 }}>
            {prompt.hint}
          </span>
          {navigationModel.selectedObject ? (
            <span style={{ color: "rgba(162, 232, 255, 0.82)", fontSize: "0.8rem" }}>
              {`Fokus: ${navigationModel.selectedObject.label}${navigationModel.selectedObject.subtitle ? ` • ${navigationModel.selectedObject.subtitle}` : ""}`}
            </span>
          ) : null}
          {model.errorHint ? <span style={{ color: "#ffc9b8", fontSize: "0.84rem" }}>{model.errorHint}</span> : null}
        </div>
      </section>

      <section
        data-testid="galaxy-radar"
        aria-label="Radar galaxie"
        style={{
          position: "absolute",
          right: "1rem",
          bottom: "1rem",
          zIndex: 3,
          width: "min(18rem, calc(100vw - 2rem))",
          display: "grid",
          gap: "0.55rem",
          padding: "0.85rem 0.92rem",
          borderRadius: "1.1rem",
          border: "1px solid rgba(126, 217, 255, 0.12)",
          background: "linear-gradient(180deg, rgba(3, 9, 20, 0.56) 0%, rgba(3, 7, 16, 0.42) 100%)",
          color: "#f2f8ff",
          backdropFilter: "blur(10px)",
        }}
      >
        <div style={{ display: "flex", justifyContent: "space-between", gap: "0.75rem", alignItems: "center" }}>
          <div style={{ fontSize: "0.75rem", letterSpacing: "0.12em", opacity: 0.62, textTransform: "uppercase" }}>
            Radar galaxie
          </div>
          <div style={{ fontSize: "0.74rem", color: "rgba(212, 233, 255, 0.72)" }}>{radarModel.galaxyName}</div>
        </div>
        <svg
          viewBox="0 0 100 100"
          role="img"
          aria-label="Radarové pole galaxie"
          style={{ width: "100%", aspectRatio: "1 / 1" }}
        >
          <circle cx="50" cy="50" r="42" fill="rgba(5, 13, 28, 0.72)" stroke="rgba(107, 214, 255, 0.24)" />
          <circle cx="50" cy="50" r="28" fill="none" stroke="rgba(107, 214, 255, 0.14)" />
          <line x1="50" y1="8" x2="50" y2="92" stroke="rgba(107, 214, 255, 0.08)" />
          <line x1="8" y1="50" x2="92" y2="50" stroke="rgba(107, 214, 255, 0.08)" />
          <g transform={headingToArrow(radarModel.headingDegrees)}>
            <polygon points="50,14 46,25 54,25" fill="#8fe8ff" opacity="0.9" />
          </g>
          {radarModel.markers.map((marker) => (
            <circle
              key={marker.id}
              cx={marker.x}
              cy={marker.y}
              r={marker.type === "star" ? 4.8 : marker.selected ? 4.2 : 3.1}
              fill={marker.type === "star" ? "#ffd894" : marker.selected ? "#8fe8ff" : "#c7f4ff"}
              opacity={marker.selected ? 1 : 0.82}
            />
          ))}
        </svg>
        <div style={{ display: "grid", gap: "0.22rem" }}>
          <strong style={{ fontSize: "0.9rem" }}>
            {navigationModel.selectedObject
              ? `Cíl radaru: ${navigationModel.selectedObject.label}`
              : "Hlavní prostor je volný"}
          </strong>
          <span style={{ color: "rgba(220, 237, 255, 0.72)", fontSize: "0.82rem", lineHeight: 1.35 }}>
            {navigationModel.mode === "approach_active"
              ? "Radar drží přiblížení na stejný objekt jako kamera."
              : "Radar ukazuje směr pohledu, hvězdu a aktuální výběr."}
          </span>
        </div>
      </section>
    </>
  );
}
