function frameStyle(screenModel) {
  return {
    width: "min(1180px, calc(100vw - 2rem))",
    minHeight: "min(760px, calc(100vh - 2rem))",
    display: "grid",
    gridTemplateRows: "auto 1fr auto",
    gap: "1rem",
    padding: "clamp(1rem, 2vw, 1.8rem)",
    borderRadius: "1.8rem",
    border: "1px solid rgba(112, 207, 255, 0.16)",
    background:
      "radial-gradient(circle at 50% 12%, rgba(255, 177, 89, 0.16), transparent 16%), radial-gradient(circle at 50% 42%, rgba(69, 191, 255, 0.12), transparent 32%), linear-gradient(180deg, rgba(5, 12, 24, 0.98) 0%, rgba(4, 9, 19, 0.97) 58%, rgba(4, 8, 17, 0.99) 100%)",
    boxShadow: "0 30px 140px rgba(0, 0, 0, 0.52)",
    transform: `translateY(${screenModel.isEntering ? "24px" : screenModel.isReturning ? "-18px" : "0"}) scale(${screenModel.isEntering ? 0.985 : 1})`,
    opacity: screenModel.isEntering || screenModel.isReturning ? 0.78 : 1,
    transition: "transform 260ms ease, opacity 260ms ease",
    overflow: "hidden",
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

function sentenceCase(value) {
  const normalized = String(value || "").trim();
  if (!normalized) return "";
  return normalized.charAt(0).toUpperCase() + normalized.slice(1).toLowerCase();
}

function toneLabel(option) {
  if (option?.profileKey === "ORIGIN") return "Tonalita: stabilni modry puls";
  if (option?.profileKey === "FLUX") return "Tonalita: teply proud rustu";
  if (option?.profileKey === "SENTINEL") return "Tonalita: chladna strazni aura";
  if (option?.profileKey === "ARCHIVE") return "Tonalita: utlumeny archivni klid";
  return "Tonalita: backend rizeny rezim";
}

function densityLabel(option) {
  if (option?.physicalProfileKey === "FORGE") return "Hustota energie: vysoka";
  if (option?.physicalProfileKey === "BALANCE") return "Hustota energie: vyrovnana";
  if (option?.physicalProfileKey === "ARCHIVE") return "Hustota energie: utlumeny rezim";
  return "Hustota energie: canonical signal";
}

function pulseLabel(option) {
  const pulse = sentenceCase(option?.pulseHint);
  return pulse ? `Puls hvezdy: ${pulse}` : "Puls hvezdy: canonical signal";
}

function constitutionEffectLine(option) {
  if (option?.id === "rust") return "Otevre proud rustu a rychlejsi tvorbu prvnich drah.";
  if (option?.id === "rovnovaha") return "Udrzi prvni prostor citelny, stabilni a pripraveny na navazani.";
  if (option?.id === "straz") return "Zpevni governance obal a postavi integritu nad tempo.";
  if (option?.id === "archiv") return "Zklidni jadro a pripravi prostor pro opatrny, pametovy rezim.";
  return option?.effectHint || "Urci dalsi chovani prostoru.";
}

function resolveCopy(interiorModel, lockTransitionModel) {
  if (interiorModel.phase === "star_core_interior_entry") {
    return {
      eyebrow: "STAR CORE INTERIOR",
      title: "Srdce hvezdy se otevira",
      body: "Prostor utichne a governance komora se rozvine kolem jadra.",
    };
  }
  if (interiorModel.isFirstOrbitReady) {
    return {
      eyebrow: "FIRST ORBIT READY",
      title: interiorModel.explainability?.headline || "Politiky jsou uzamceny.",
      body: interiorModel.explainability?.body || "Prvni obezna draha je pripravena jako dalsi fyzicky krok prostoru.",
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
    body: interiorModel.explainability?.body || "Kazdy rezim meni puls, tonalitu a hustotu prvni vrstvy galaxie.",
  };
}

function resolveSelectionPrompt(option) {
  if (!option) {
    return {
      title: "Nejdriv se ustali rezim jadra",
      body: "Vyber rezim, ktery nejlepe popise, jak ma Srdce hvezdy pusobit na prvni prostor.",
    };
  }
  return {
    title: `${option.title} urci prvni charakter prostoru`,
    body: constitutionEffectLine(option),
  };
}

function resolveStageTheme(interiorModel, focusedConstitution) {
  const tonePrimary = focusedConstitution?.tonePrimary || "#7ee8ff";
  const toneSecondary = focusedConstitution?.toneSecondary || "#82ffd4";

  if (interiorModel.isFirstOrbitReady) {
    return {
      halo: "rgba(126, 232, 255, 0.22)",
      glow: "rgba(126, 232, 255, 0.14)",
      ring: "rgba(143, 232, 255, 0.42)",
      orbit: "rgba(143, 232, 255, 0.72)",
      tonePrimary,
      toneSecondary,
    };
  }
  if (interiorModel.isLockPending) {
    return {
      halo: "rgba(255, 218, 145, 0.24)",
      glow: "rgba(255, 218, 145, 0.18)",
      ring: "rgba(255, 214, 120, 0.46)",
      orbit: "rgba(255, 214, 120, 0.76)",
      tonePrimary: "#ffd27b",
      toneSecondary: "#ffefb6",
    };
  }
  return {
    halo: `${tonePrimary}22`,
    glow: `${toneSecondary}22`,
    ring: `${tonePrimary}66`,
    orbit: `${tonePrimary}aa`,
    tonePrimary,
    toneSecondary,
  };
}

function resolveNodePosition(index, total) {
  const count = Math.max(total, 1);
  const theta = (index / count) * Math.PI * 2 - Math.PI / 2;
  const radiusX = 34;
  const radiusY = 28;
  return {
    left: `${50 + Math.cos(theta) * radiusX}%`,
    top: `${50 + Math.sin(theta) * radiusY}%`,
  };
}

function renderConstitutionNode(option, index, total, selected, onSelectConstitution) {
  const position = resolveNodePosition(index, total);
  return (
    <button
      key={option.id}
      type="button"
      data-testid={`constitution-option-${option.id}`}
      onClick={() => onSelectConstitution(option.id)}
      style={{
        position: "absolute",
        left: position.left,
        top: position.top,
        transform: "translate(-50%, -50%)",
        width: selected ? "132px" : "116px",
        minHeight: selected ? "132px" : "116px",
        padding: "0.9rem",
        borderRadius: "999px",
        border: `1px solid ${selected ? option.tonePrimary : "rgba(127, 220, 255, 0.18)"}`,
        background: selected
          ? `radial-gradient(circle at 50% 35%, ${option.toneSecondary}66, rgba(8, 18, 33, 0.96) 72%)`
          : "radial-gradient(circle at 50% 35%, rgba(126, 232, 255, 0.16), rgba(6, 14, 28, 0.94) 72%)",
        boxShadow: selected ? `0 0 28px ${option.tonePrimary}55` : "0 0 18px rgba(126, 232, 255, 0.12)",
        color: "#edf7ff",
        display: "grid",
        alignContent: "center",
        gap: "0.35rem",
        textAlign: "center",
        cursor: "pointer",
        backdropFilter: "blur(12px)",
      }}
    >
      <strong style={{ fontSize: selected ? "0.98rem" : "0.9rem" }}>{option.title}</strong>
      <span style={{ color: option.tonePrimary, fontSize: "0.68rem", letterSpacing: "0.08em" }}>
        {selected ? "AKTIVNI VOLBA" : option.recommended ? "DOPORUCENO" : "REZIM"}
      </span>
    </button>
  );
}

function renderSignalChip(text, align = "left", tone = "#dff6ff") {
  return (
    <span
      style={{
        justifySelf: align,
        width: "fit-content",
        padding: "0.45rem 0.72rem",
        borderRadius: "999px",
        border: "1px solid rgba(127, 220, 255, 0.16)",
        background: "rgba(5, 12, 24, 0.52)",
        color: tone,
        fontSize: "0.78rem",
        letterSpacing: "0.06em",
        backdropFilter: "blur(10px)",
      }}
    >
      {text}
    </span>
  );
}

function renderConstitutionSelectView({
  constitutionOptions,
  focusedConstitution,
  interiorModel,
  lockTransitionModel,
  onSelectConstitution,
  onConfirmPolicyLock,
}) {
  const selectionPrompt = resolveSelectionPrompt(focusedConstitution);
  const stageTheme = resolveStageTheme(interiorModel, focusedConstitution);
  const isPolicyLockPhase = interiorModel.phase === "policy_lock_ready" || interiorModel.isLockPending;

  return (
    <section
      data-testid="constitution-select-surface"
      style={{
        position: "relative",
        minHeight: "31rem",
        display: "grid",
        gridTemplateColumns: "minmax(280px, 1fr) minmax(360px, 1.2fr) minmax(280px, 1fr)",
        alignItems: "center",
        gap: "1rem",
      }}
    >
      <div style={{ display: "grid", gap: "0.9rem", alignContent: "start" }}>
        {renderSignalChip("CONSTITUTION SELECT")}
        <div
          data-testid="constitution-selection-focus"
          style={{
            display: "grid",
            gap: "0.8rem",
            padding: "1rem",
            borderRadius: "1.2rem",
            border: `1px solid ${stageTheme.tonePrimary}33`,
            background: "linear-gradient(180deg, rgba(8, 16, 31, 0.88), rgba(5, 10, 21, 0.94))",
            boxShadow: `0 0 40px ${stageTheme.glow}`,
          }}
        >
          <span style={{ color: stageTheme.tonePrimary, fontSize: "0.78rem", letterSpacing: "0.12em" }}>
            {focusedConstitution?.id === interiorModel.recommendedConstitutionId ? "DOPORUCENY FOKUS" : "AKTIVNI FOKUS"}
          </span>
          <strong style={{ fontSize: "1.28rem", color: "#fff2d7", lineHeight: 1.1 }}>{selectionPrompt.title}</strong>
          <span style={{ color: "rgba(223, 239, 255, 0.78)", lineHeight: 1.6 }}>{selectionPrompt.body}</span>
          {focusedConstitution ? (
            <div style={{ display: "grid", gap: "0.45rem", color: "rgba(214, 235, 255, 0.8)", fontSize: "0.84rem" }}>
              <span>{pulseLabel(focusedConstitution)}</span>
              <span>{toneLabel(focusedConstitution)}</span>
              <span>{densityLabel(focusedConstitution)}</span>
            </div>
          ) : null}
        </div>
      </div>

      <div
        style={{
          position: "relative",
          minHeight: "31rem",
          display: "grid",
          placeItems: "center",
        }}
      >
        <div
          aria-hidden="true"
          style={{
            position: "absolute",
            inset: "10% 14%",
            borderRadius: "50%",
            border: `1px solid ${stageTheme.ring}`,
            boxShadow: `0 0 40px ${stageTheme.glow}, inset 0 0 24px ${stageTheme.glow}`,
          }}
        />
        <div
          aria-hidden="true"
          style={{
            position: "absolute",
            inset: "18% 22%",
            borderRadius: "50%",
            border: `1px solid ${stageTheme.orbit}`,
            transform: "rotateX(68deg)",
            opacity: 0.86,
          }}
        />
        <div
          aria-hidden="true"
          style={{
            position: "absolute",
            inset: "28% 32%",
            borderRadius: "50%",
            background: `radial-gradient(circle at 50% 45%, ${stageTheme.toneSecondary}aa, ${stageTheme.tonePrimary}33 38%, rgba(4, 10, 21, 0.05) 70%)`,
            boxShadow: `0 0 80px ${stageTheme.halo}, 0 0 140px ${stageTheme.glow}`,
            filter: "blur(1px)",
          }}
        />
        {constitutionOptions.map((option, index) =>
          renderConstitutionNode(
            option,
            index,
            constitutionOptions.length,
            focusedConstitution?.id === option.id,
            onSelectConstitution
          )
        )}
        <div
          style={{
            position: "relative",
            width: "220px",
            height: "220px",
            borderRadius: "50%",
            display: "grid",
            placeItems: "center",
            background: `radial-gradient(circle at 50% 38%, ${stageTheme.toneSecondary}, ${stageTheme.tonePrimary}66 34%, rgba(5, 10, 20, 0.2) 68%)`,
            boxShadow: `0 0 60px ${stageTheme.glow}, inset 0 0 28px rgba(255, 255, 255, 0.05)`,
            border: `1px solid ${stageTheme.ring}`,
          }}
        >
          <div style={{ display: "grid", gap: "0.4rem", textAlign: "center", maxWidth: "10rem" }}>
            <span style={{ color: "rgba(245, 248, 255, 0.92)", fontSize: "0.8rem", letterSpacing: "0.12em" }}>
              STAR CORE
            </span>
            <strong style={{ color: "#fff4de", fontSize: "1.18rem", lineHeight: 1.12 }}>
              {focusedConstitution?.title || "Vyber ustavu"}
            </strong>
            <span style={{ color: "rgba(224, 239, 255, 0.74)", fontSize: "0.78rem", lineHeight: 1.45 }}>
              {focusedConstitution?.subtitle || "Rezim se projevi pulzem a tonalitou prostoru."}
            </span>
          </div>
        </div>
      </div>

      <div style={{ display: "grid", gap: "0.9rem", alignContent: "start", justifyItems: "end" }}>
        {renderSignalChip(`Vliv: ${constitutionEffectLine(focusedConstitution)}`, "end", "#ffe7bf")}
        {renderSignalChip(
          interiorModel.explainability?.headline || "Vyber ustavu prostoru",
          "end",
          stageTheme.tonePrimary
        )}
        {interiorModel.errorMessage ? (
          <div
            style={{
              width: "100%",
              padding: "0.9rem 1rem",
              borderRadius: "1rem",
              border: "1px solid rgba(255, 168, 145, 0.28)",
              background: "rgba(39, 13, 10, 0.44)",
              color: "#ffc9b8",
              lineHeight: 1.45,
            }}
          >
            {interiorModel.errorMessage}
          </div>
        ) : null}
        {isPolicyLockPhase && lockTransitionModel?.actionLabel ? (
          <button
            type="button"
            data-testid="star-core-primary-action"
            disabled={Boolean(lockTransitionModel.disabled)}
            onClick={onConfirmPolicyLock}
            style={{ ...actionButtonStyle(true, Boolean(lockTransitionModel.disabled)), minWidth: "18rem" }}
          >
            {lockTransitionModel.actionLabel}
          </button>
        ) : null}
      </div>
    </section>
  );
}

function renderFirstOrbitReadyView({ selectedConstitution, interiorModel, lockTransitionModel, onReturnToSpace }) {
  const stageTheme = resolveStageTheme(interiorModel, selectedConstitution);

  return (
    <section
      data-testid="first-orbit-ready-surface"
      style={{
        position: "relative",
        minHeight: "30rem",
        display: "grid",
        gridTemplateColumns: "minmax(0, 1.25fr) minmax(280px, 0.75fr)",
        alignItems: "center",
        gap: "1rem",
      }}
    >
      <div
        style={{
          position: "relative",
          minHeight: "30rem",
          display: "grid",
          placeItems: "center",
          overflow: "hidden",
        }}
      >
        <div
          aria-hidden="true"
          style={{
            position: "absolute",
            width: "26rem",
            height: "26rem",
            borderRadius: "50%",
            border: `1px solid ${stageTheme.ring}`,
            boxShadow: `0 0 40px ${stageTheme.glow}`,
          }}
        />
        <div
          aria-hidden="true"
          style={{
            position: "absolute",
            width: "34rem",
            height: "12rem",
            borderRadius: "50%",
            border: `1px solid ${stageTheme.orbit}`,
            transform: "rotateX(72deg)",
            boxShadow: `0 0 22px ${stageTheme.orbit}`,
          }}
        />
        <div
          aria-hidden="true"
          style={{
            position: "absolute",
            width: "34rem",
            height: "12rem",
            borderRadius: "50%",
            border: "1px solid rgba(255,255,255,0.08)",
            transform: "rotateX(72deg) rotateZ(12deg)",
          }}
        />
        <div
          style={{
            position: "relative",
            width: "220px",
            height: "220px",
            borderRadius: "50%",
            display: "grid",
            placeItems: "center",
            background: `radial-gradient(circle at 50% 38%, ${stageTheme.toneSecondary}, ${stageTheme.tonePrimary}66 34%, rgba(5, 10, 20, 0.2) 68%)`,
            boxShadow: `0 0 60px ${stageTheme.glow}`,
            border: `1px solid ${stageTheme.ring}`,
          }}
        >
          <div style={{ display: "grid", gap: "0.4rem", textAlign: "center", maxWidth: "11rem" }}>
            <span style={{ color: "rgba(245, 248, 255, 0.92)", fontSize: "0.8rem", letterSpacing: "0.12em" }}>
              FIRST ORBIT
            </span>
            <strong style={{ color: "#fff4de", fontSize: "1.22rem", lineHeight: 1.08 }}>Politiky jsou uzamceny.</strong>
            <span style={{ color: "rgba(224, 239, 255, 0.76)", fontSize: "0.8rem", lineHeight: 1.45 }}>
              Prvni draha uz existuje jako fyzicky signal dalsiho kroku.
            </span>
          </div>
        </div>
        {selectedConstitution ? (
          <div
            style={{
              position: "absolute",
              left: "12%",
              bottom: "14%",
              width: "14rem",
              display: "grid",
              gap: "0.45rem",
              padding: "0.95rem 1rem",
              borderRadius: "1rem",
              border: "1px solid rgba(255, 204, 136, 0.18)",
              background: "rgba(33, 19, 8, 0.28)",
              color: "#ffe8bf",
            }}
          >
            <span style={{ fontSize: "0.78rem", letterSpacing: "0.1em" }}>POTVRZENA USTAVA</span>
            <strong>{selectedConstitution.title}</strong>
            <span style={{ color: "rgba(255, 232, 191, 0.78)", lineHeight: 1.45 }}>
              {constitutionEffectLine(selectedConstitution)}
            </span>
          </div>
        ) : null}
      </div>

      <div
        style={{
          display: "grid",
          gap: "0.9rem",
          alignContent: "center",
          justifyItems: "end",
        }}
      >
        {renderSignalChip("FIRST ORBIT READY", "end", stageTheme.tonePrimary)}
        {renderSignalChip(interiorModel.explainability?.body || "Governance zaklad je potvrzen.", "end", "#dff6ff")}
        <button
          type="button"
          data-testid="star-core-primary-action"
          disabled={Boolean(lockTransitionModel?.disabled)}
          onClick={onReturnToSpace}
          style={{ ...actionButtonStyle(true, Boolean(lockTransitionModel?.disabled)), minWidth: "18rem" }}
        >
          {lockTransitionModel?.actionLabel || "Vratit se do prostoru"}
        </button>
      </div>
    </section>
  );
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
  const canReturn = interiorModel.phase !== "policy_lock_transition";
  const focusedConstitution =
    selectedConstitution ||
    constitutionOptions.find((option) => option.id === interiorModel.selectedConstitutionId) ||
    constitutionOptions.find((option) => option.id === interiorModel.recommendedConstitutionId) ||
    constitutionOptions[0] ||
    null;
  const showSelectionSurface =
    interiorModel.phase === "constitution_select" || interiorModel.phase === "policy_lock_ready";

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
        </header>

        {showSelectionSurface
          ? renderConstitutionSelectView({
              constitutionOptions,
              focusedConstitution,
              interiorModel,
              lockTransitionModel,
              onSelectConstitution,
              onConfirmPolicyLock,
            })
          : null}

        {interiorModel.isFirstOrbitReady
          ? renderFirstOrbitReadyView({
              selectedConstitution,
              interiorModel,
              lockTransitionModel,
              onReturnToSpace,
            })
          : null}

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
