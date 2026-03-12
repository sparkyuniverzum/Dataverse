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
  const selectedObject = navigationModel.selectedObject;
  const selectedLabel = selectedObject?.label || "";
  const isStarCore = selectedObject?.id === "star-core" || selectedLabel === "Srdce hvězdy";

  if (navigationModel.mode === "approach_active") {
    return {
      title: `Přibližuješ se k objektu ${selectedLabel}`.trim(),
      hint: isStarCore
        ? "Probíhá vstup do governance vrstvy. Esc tě vrátí o krok zpět."
        : "Esc tě vrátí o krok zpět. Ještě nejsi uvnitř další vrstvy.",
    };
  }
  if (navigationModel.mode === "object_selected") {
    return {
      title: `Vybraný objekt: ${selectedLabel || "objekt"}`,
      hint: isStarCore
        ? "Dvojklik spustí přiblížení a vstup do nitra Srdce hvězdy. Radar i scéna drží stejný selection focus."
        : "Dvojklik spustí přiblížení. Radar i scéna drží stejný selection focus.",
    };
  }
  return {
    title: "Volná navigace galaxií",
    hint: "Klik vybere objekt. Dvojklik spustí přiblížení. Myší měníš směr pohledu.",
  };
}

function resolveInteriorPrompt(interiorModel, lockTransitionModel) {
  if (interiorModel.phase === "star_core_interior_entry") {
    return {
      title: "Vstupuješ do nitra Srdce hvězdy",
      hint: "Jádro se otevírá. Za okamžik zvolíš ústavu prostoru.",
    };
  }
  if (interiorModel.phase === "constitution_select") {
    return {
      title: interiorModel.explainability?.headline || "Vyber ústavu prostoru",
      hint: interiorModel.explainability?.body || "Každý režim mění puls, barvu a chování budoucí galaxie.",
    };
  }
  return {
    title: lockTransitionModel?.title || interiorModel.explainability?.headline || "Star Core command",
    hint: lockTransitionModel?.hint || interiorModel.explainability?.body || "",
  };
}

function headingToArrow(headingDegrees) {
  const rotation = Number.isFinite(Number(headingDegrees)) ? Number(headingDegrees) : 0;
  return `rotate(${rotation} 50 50)`;
}

export default function GalaxySelectionHud({
  model,
  navigationModel,
  radarModel,
  interiorModel = { phase: "closed", isOpen: false },
  selectedConstitution = null,
  lockTransitionModel = null,
  onConfirmPolicyLock = () => {},
  onReturnToSpace = () => {},
}) {
  const prompt = interiorModel.isOpen
    ? resolveInteriorPrompt(interiorModel, lockTransitionModel)
    : resolvePrompt(navigationModel);

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
          {interiorModel.isOpen && selectedConstitution ? (
            <span style={{ color: "rgba(162, 232, 255, 0.82)", fontSize: "0.8rem" }}>
              {`Ústava: ${selectedConstitution.title} • ${selectedConstitution.subtitle}`}
            </span>
          ) : null}
          {navigationModel.selectedObject ? (
            <span style={{ color: "rgba(162, 232, 255, 0.82)", fontSize: "0.8rem" }}>
              {`Fokus: ${navigationModel.selectedObject.label}${navigationModel.selectedObject.subtitle ? ` • ${navigationModel.selectedObject.subtitle}` : ""}`}
            </span>
          ) : null}
          {model.errorHint ? <span style={{ color: "#ffc9b8", fontSize: "0.84rem" }}>{model.errorHint}</span> : null}
          {interiorModel.errorMessage ? (
            <span style={{ color: "#ffc9b8", fontSize: "0.84rem" }}>{interiorModel.errorMessage}</span>
          ) : null}
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
          width: "7.4rem",
          height: "7.4rem",
          padding: "0.32rem",
          borderRadius: "999px",
          background: "rgba(3, 9, 20, 0.18)",
          backdropFilter: "blur(6px)",
        }}
      >
        <svg
          viewBox="0 0 100 100"
          role="img"
          aria-label="Radarové pole galaxie"
          style={{ width: "100%", height: "100%" }}
        >
          <circle cx="50" cy="50" r="42" fill="rgba(5, 13, 28, 0.28)" stroke="rgba(107, 214, 255, 0.22)" />
          <circle cx="50" cy="50" r="4.8" fill="#ffd894" opacity="0.95" />
          <g transform={headingToArrow(radarModel.headingDegrees)}>
            <polygon points="50,12 45,26 55,26" fill="#8fe8ff" opacity="0.95" />
          </g>
          {radarModel.markers.map((marker) => (
            <circle
              key={marker.id}
              cx={marker.x}
              cy={marker.y}
              r={marker.type === "star" ? 0 : marker.selected ? 4 : 2.7}
              fill={marker.type === "star" ? "#ffd894" : marker.selected ? "#8fe8ff" : "#c7f4ff"}
              opacity={marker.selected ? 1 : 0.82}
            />
          ))}
        </svg>
      </section>

      {interiorModel.isOpen ? (
        <section
          data-testid="star-core-lock-affordance"
          aria-label="Command affordance Srdce hvězdy"
          style={{
            position: "absolute",
            left: "50%",
            bottom: "1.25rem",
            transform: "translateX(-50%)",
            zIndex: 3,
            minWidth: "24rem",
            maxWidth: "min(42rem, calc(100vw - 2rem))",
            display: "grid",
            gap: "0.6rem",
            padding: "0.9rem 1rem",
            borderRadius: "1.1rem",
            border: "1px solid rgba(110, 204, 255, 0.18)",
            background: "linear-gradient(180deg, rgba(5, 10, 23, 0.78), rgba(2, 7, 16, 0.54))",
            backdropFilter: "blur(16px)",
            color: "#edf7ff",
          }}
        >
          <span style={{ fontSize: "0.78rem", letterSpacing: "0.08em", color: "rgba(165, 233, 255, 0.82)" }}>
            STAR CORE COMMAND
          </span>
          <strong style={{ fontSize: "1rem" }}>
            {lockTransitionModel?.title || interiorModel.explainability?.headline || "Star Core command"}
          </strong>
          <span style={{ color: "rgba(223, 239, 255, 0.76)", fontSize: "0.88rem", lineHeight: 1.42 }}>
            {lockTransitionModel?.hint || interiorModel.explainability?.body || ""}
          </span>
          <div style={{ display: "flex", gap: "0.7rem", flexWrap: "wrap" }}>
            {lockTransitionModel?.actionLabel ? (
              <button
                type="button"
                data-testid="star-core-primary-action"
                disabled={Boolean(lockTransitionModel.disabled)}
                onClick={interiorModel.isFirstOrbitReady ? onReturnToSpace : onConfirmPolicyLock}
                style={{
                  borderRadius: "999px",
                  border: "1px solid rgba(138, 224, 255, 0.24)",
                  background: lockTransitionModel.disabled
                    ? "rgba(55, 81, 102, 0.45)"
                    : "linear-gradient(90deg, rgba(134, 223, 255, 0.95), rgba(255, 201, 124, 0.92))",
                  color: lockTransitionModel.disabled ? "rgba(221, 238, 255, 0.56)" : "#042136",
                  padding: "0.7rem 1.05rem",
                  fontWeight: 700,
                  cursor: lockTransitionModel.disabled ? "default" : "pointer",
                }}
              >
                {lockTransitionModel.actionLabel}
              </button>
            ) : null}
            {interiorModel.phase !== "policy_lock_transition" ? (
              <button
                type="button"
                data-testid="star-core-secondary-action"
                onClick={onReturnToSpace}
                style={{
                  borderRadius: "999px",
                  border: "1px solid rgba(138, 224, 255, 0.18)",
                  background: "rgba(7, 17, 36, 0.62)",
                  color: "#dff6ff",
                  padding: "0.7rem 1.05rem",
                  fontWeight: 600,
                  cursor: "pointer",
                }}
              >
                Vrátit se do prostoru
              </button>
            ) : null}
          </div>
        </section>
      ) : null}
    </>
  );
}
