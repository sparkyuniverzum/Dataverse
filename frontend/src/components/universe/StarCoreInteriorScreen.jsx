function frameStyle(screenModel) {
  return {
    width: "min(1180px, calc(100vw - 2rem))",
    minHeight: "min(760px, calc(100vh - 2rem))",
    display: "grid",
    gridTemplateRows: "auto 1fr auto",
    gap: "1.2rem",
    padding: "clamp(1rem, 2vw, 1.8rem)",
    borderRadius: "1.5rem",
    border: "1px solid rgba(127, 220, 255, 0.18)",
    background:
      "radial-gradient(circle at 50% 14%, rgba(255, 182, 87, 0.16), transparent 18%), linear-gradient(180deg, rgba(7, 13, 26, 0.98) 0%, rgba(5, 10, 20, 0.96) 58%, rgba(4, 8, 17, 0.98) 100%)",
    boxShadow: "0 30px 120px rgba(0, 0, 0, 0.52)",
    transform: `translateY(${screenModel.isEntering ? "24px" : screenModel.isReturning ? "-20px" : "0"}) scale(${screenModel.isEntering ? 0.985 : 1})`,
    opacity: screenModel.isEntering || screenModel.isReturning ? 0.78 : 1,
    transition: "transform 260ms ease, opacity 260ms ease",
  };
}

function actionButtonStyle(primary, disabled) {
  return {
    borderRadius: "999px",
    border: primary ? "1px solid rgba(138, 224, 255, 0.24)" : "1px solid rgba(138, 224, 255, 0.18)",
    background: primary
      ? disabled
        ? "rgba(55, 81, 102, 0.45)"
        : "linear-gradient(90deg, rgba(134, 223, 255, 0.95), rgba(255, 201, 124, 0.92))"
      : "rgba(9, 18, 35, 0.76)",
    color: primary ? (disabled ? "rgba(221, 238, 255, 0.56)" : "#042136") : "#e1f6ff",
    padding: "0.82rem 1.08rem",
    fontWeight: primary ? 700 : 600,
    cursor: disabled ? "default" : "pointer",
    opacity: disabled ? 0.7 : 1,
  };
}

function resolveCopy(interiorModel, lockTransitionModel) {
  if (interiorModel.phase === "star_core_interior_entry") {
    return {
      eyebrow: "STAR CORE INTERIOR",
      title: "Srdce hvezdy se otevira",
      body: "Opoustis Galaxy Space a vstupujes do samostatne governance vrstvy.",
    };
  }
  if (interiorModel.isFirstOrbitReady) {
    return {
      eyebrow: "FIRST ORBIT READY",
      title: interiorModel.explainability?.headline || "Governance zaklad je potvrzen",
      body: interiorModel.explainability?.body || "Prvni obezna draha je pripravena pro dalsi navazani.",
    };
  }
  if (interiorModel.isLockPending || interiorModel.canConfirmLock) {
    return {
      eyebrow: "POLICY LOCK",
      title: lockTransitionModel?.title || interiorModel.explainability?.headline || "Ustava je pripravena",
      body: lockTransitionModel?.hint || interiorModel.explainability?.body || "",
    };
  }
  return {
    eyebrow: "CONSTITUTION SELECT",
    title: interiorModel.explainability?.headline || "Vyber ustavu prostoru",
    body: interiorModel.explainability?.body || "Kazdy rezim meni tonalitu, puls a dalsi smer rozvoje galaxie.",
  };
}

function constitutionCardStyle(selected) {
  return {
    display: "grid",
    gap: "0.5rem",
    padding: "1rem",
    borderRadius: "1rem",
    border: selected ? "1px solid rgba(255, 206, 136, 0.42)" : "1px solid rgba(126, 219, 255, 0.14)",
    background: selected
      ? "linear-gradient(180deg, rgba(24, 39, 60, 0.94), rgba(17, 26, 39, 0.92))"
      : "linear-gradient(180deg, rgba(11, 20, 35, 0.88), rgba(8, 14, 26, 0.9))",
    color: "#edf7ff",
    textAlign: "left",
    cursor: "pointer",
  };
}

export default function StarCoreInteriorScreen({
  screenModel,
  interiorModel,
  selectedConstitution = null,
  lockTransitionModel = null,
  onSelectConstitution = () => {},
  onConfirmPolicyLock = () => {},
  onReturnToSpace = () => {},
}) {
  if (!screenModel?.isVisible) return null;

  const copy = resolveCopy(interiorModel, lockTransitionModel);
  const constitutionOptions = Array.isArray(interiorModel.availableConstitutions)
    ? interiorModel.availableConstitutions
    : [];
  const canRenderConstitutions = interiorModel.canSelectConstitution && constitutionOptions.length > 0;
  const canReturn = interiorModel.phase !== "policy_lock_transition";

  return (
    <section
      data-testid="star-core-interior-screen"
      aria-label="Srdce hvezdy"
      style={{
        position: "absolute",
        inset: 0,
        zIndex: 5,
        display: "grid",
        placeItems: "center",
        padding: "1rem",
        background:
          "linear-gradient(180deg, rgba(2, 5, 11, 0.64) 0%, rgba(2, 6, 12, 0.84) 100%), radial-gradient(circle at 50% 20%, rgba(255, 177, 81, 0.14), transparent 24%)",
      }}
    >
      <div style={frameStyle(screenModel)}>
        <header style={{ display: "grid", gap: "0.8rem" }}>
          <div
            style={{
              display: "flex",
              justifyContent: "space-between",
              gap: "1rem",
              alignItems: "start",
              flexWrap: "wrap",
            }}
          >
            <div style={{ display: "grid", gap: "0.45rem", maxWidth: "44rem" }}>
              <span style={{ color: "rgba(164, 231, 255, 0.84)", fontSize: "0.78rem", letterSpacing: "0.12em" }}>
                {copy.eyebrow}
              </span>
              <h1 style={{ margin: 0, color: "#fff4de", fontSize: "clamp(1.8rem, 4vw, 3rem)", lineHeight: 1.02 }}>
                {copy.title}
              </h1>
              <p style={{ margin: 0, color: "rgba(230, 241, 255, 0.78)", fontSize: "1rem", lineHeight: 1.55 }}>
                {copy.body}
              </p>
            </div>
            <button
              type="button"
              data-testid="star-core-return-action"
              onClick={onReturnToSpace}
              disabled={!canReturn}
              style={actionButtonStyle(false, !canReturn)}
            >
              Zpet do Galaxy Space
            </button>
          </div>

          {selectedConstitution ? (
            <div
              style={{
                width: "fit-content",
                padding: "0.45rem 0.75rem",
                borderRadius: "999px",
                border: "1px solid rgba(255, 204, 136, 0.18)",
                background: "rgba(33, 19, 8, 0.36)",
                color: "#ffe8bf",
                fontSize: "0.85rem",
              }}
            >
              {`Aktivni ustava: ${selectedConstitution.title}`}
            </div>
          ) : null}
        </header>

        <div
          style={{
            display: "grid",
            gridTemplateColumns: canRenderConstitutions ? "minmax(0, 1.45fr) minmax(280px, 0.95fr)" : "1fr",
            gap: "1rem",
            alignItems: "start",
          }}
        >
          <section
            style={{
              display: "grid",
              gap: "1rem",
              minHeight: "20rem",
              padding: "1rem",
              borderRadius: "1.2rem",
              border: "1px solid rgba(126, 219, 255, 0.12)",
              background:
                "radial-gradient(circle at 50% 10%, rgba(255, 182, 79, 0.16), transparent 18%), linear-gradient(180deg, rgba(10, 17, 31, 0.84), rgba(8, 13, 24, 0.94))",
            }}
          >
            <div
              style={{
                display: "grid",
                placeItems: "center",
                minHeight: "15rem",
                borderRadius: "1rem",
                border: "1px dashed rgba(164, 228, 255, 0.18)",
                background:
                  "radial-gradient(circle at 50% 50%, rgba(161, 235, 255, 0.12) 0%, rgba(255, 193, 103, 0.08) 18%, transparent 46%)",
                color: "#dff6ff",
                textAlign: "center",
                padding: "1rem",
              }}
            >
              <div style={{ display: "grid", gap: "0.5rem", maxWidth: "24rem" }}>
                <strong style={{ fontSize: "1.08rem", color: "#fff3d8" }}>Governance interior shell</strong>
                <span style={{ color: "rgba(223, 239, 255, 0.76)", lineHeight: 1.5 }}>
                  Tohle je samostatna pracovni vrstva nad backend `interior` contractem. Neni to dalsi zoom uvnitr
                  `Galaxy Space`.
                </span>
              </div>
            </div>

            {canRenderConstitutions ? (
              <div
                style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))", gap: "0.8rem" }}
              >
                {constitutionOptions.map((option) => (
                  <button
                    key={option.id}
                    type="button"
                    data-testid={`constitution-option-${option.id}`}
                    onClick={() => onSelectConstitution(option.id)}
                    style={constitutionCardStyle(selectedConstitution?.id === option.id)}
                  >
                    <strong style={{ fontSize: "1rem" }}>{option.title}</strong>
                    <span style={{ color: "rgba(224, 239, 255, 0.72)", lineHeight: 1.45 }}>{option.subtitle}</span>
                    <span style={{ color: option.tonePrimary, fontSize: "0.8rem" }}>
                      {option.recommended ? "Doporucena volba" : "Dostupny rezim"}
                    </span>
                  </button>
                ))}
              </div>
            ) : null}
          </section>

          <aside
            style={{
              display: "grid",
              gap: "0.8rem",
              padding: "1rem",
              borderRadius: "1.2rem",
              border: "1px solid rgba(126, 219, 255, 0.12)",
              background: "linear-gradient(180deg, rgba(12, 19, 35, 0.8), rgba(7, 12, 22, 0.94))",
              color: "#edf7ff",
            }}
          >
            <span style={{ color: "rgba(164, 231, 255, 0.84)", fontSize: "0.78rem", letterSpacing: "0.12em" }}>
              RETURN CONTRACT
            </span>
            <strong style={{ fontSize: "1rem" }}>Po zavreni se vratis do Galaxy Space</strong>
            <span style={{ color: "rgba(223, 239, 255, 0.76)", lineHeight: 1.5 }}>
              Fokus zustane na `Star Core`. FE tady nedrzi vlastni workflow pravdu, jen screen transition.
            </span>
            {interiorModel.errorMessage ? (
              <span style={{ color: "#ffc9b8", lineHeight: 1.45 }}>{interiorModel.errorMessage}</span>
            ) : null}
            {lockTransitionModel?.actionLabel ? (
              <button
                type="button"
                data-testid="star-core-primary-action"
                disabled={Boolean(lockTransitionModel.disabled)}
                onClick={interiorModel.isFirstOrbitReady ? onReturnToSpace : onConfirmPolicyLock}
                style={actionButtonStyle(true, Boolean(lockTransitionModel.disabled))}
              >
                {lockTransitionModel.actionLabel}
              </button>
            ) : null}
          </aside>
        </div>

        <footer
          style={{
            display: "flex",
            justifyContent: "space-between",
            gap: "0.75rem",
            flexWrap: "wrap",
            color: "rgba(204, 226, 244, 0.7)",
            fontSize: "0.84rem",
          }}
        >
          <span>{screenModel.stage}</span>
          <span>{`Backend faze: ${interiorModel.phase}`}</span>
        </footer>
      </div>
    </section>
  );
}
