import { resolveStarCoreInteriorVisualModel } from "./starCoreInteriorVisualModel.js";

function actionButtonStyle(primary, disabled) {
  return {
    borderRadius: "999px",
    border: primary ? "1px solid rgba(138, 224, 255, 0.24)" : "1px solid rgba(138, 224, 255, 0.18)",
    background: primary
      ? disabled
        ? "rgba(55, 81, 102, 0.45)"
        : "linear-gradient(90deg, rgba(134, 223, 255, 0.95), rgba(255, 201, 124, 0.92))"
      : "rgba(9, 18, 35, 0.26)",
    color: primary ? (disabled ? "rgba(221, 238, 255, 0.56)" : "#042136") : "#e1f6ff",
    padding: "0.75rem 1.2rem",
    fontWeight: primary ? 700 : 600,
    cursor: disabled ? "default" : "pointer",
    opacity: disabled ? 0.7 : 1,
    backdropFilter: "blur(10px)",
    transition: "all 220ms ease",
    fontSize: "0.88rem",
    letterSpacing: "0.04em",
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

function resolveNodePosition(index, total) {
  const count = Math.max(total, 1);
  const theta = (index / count) * Math.PI * 2 - Math.PI / 2;
  const radiusX = 38;
  const radiusY = 32;
  return {
    left: `${50 + Math.cos(theta) * radiusX}%`,
    top: `${50 + Math.sin(theta) * radiusY}%`,
  };
}

function renderSignalChip(text, tone = "#dff6ff", extraStyle = {}) {
  return (
    <span
      style={{
        width: "fit-content",
        padding: "0.4rem 0.7rem",
        borderRadius: "999px",
        border: "1px solid rgba(127, 220, 255, 0.12)",
        background: "rgba(5, 12, 24, 0.42)",
        color: tone,
        fontSize: "0.74rem",
        letterSpacing: "0.08em",
        backdropFilter: "blur(8px)",
        ...extraStyle,
      }}
    >
      {text}
    </span>
  );
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
        width: selected ? "160px" : "130px",
        minHeight: selected ? "160px" : "130px",
        padding: "1rem",
        borderRadius: "50%",
        border: `1px solid ${selected ? option.tonePrimary : "rgba(127, 220, 255, 0.14)"}`,
        background: selected
          ? `radial-gradient(circle at 50% 35%, ${option.toneSecondary}44, rgba(8, 18, 33, 0.88) 72%)`
          : "radial-gradient(circle at 50% 35%, rgba(126, 232, 255, 0.08), rgba(6, 14, 28, 0.82) 72%)",
        boxShadow: selected ? `0 0 40px ${option.tonePrimary}44` : "0 0 12px rgba(126, 232, 255, 0.08)",
        color: "#edf7ff",
        display: "grid",
        alignContent: "center",
        gap: "0.2rem",
        textAlign: "center",
        cursor: "pointer",
        backdropFilter: "blur(14px)",
        transition: "all 350ms cubic-bezier(0.23, 1, 0.32, 1)",
        zIndex: selected ? 10 : 5,
      }}
    >
      <strong style={{ fontSize: selected ? "1.05rem" : "0.85rem", letterSpacing: "0.02em" }}>{option.title}</strong>
      <span style={{ color: option.tonePrimary, fontSize: "0.62rem", letterSpacing: "0.1em", fontWeight: 700 }}>
        {selected ? "AKTIVNI VOLBA" : "REZIM"}
      </span>
    </button>
  );
}

function renderRitualChamber({
  interiorModel,
  visualModel,
  constitutionOptions,
  focusedConstitution,
  onSelectConstitution,
  onConfirmPolicyLock,
  onReturnToSpace,
  lockTransitionModel,
}) {
  const isPolicyLockPhase = interiorModel.phase === "policy_lock_ready" || interiorModel.isLockPending;

  return (
    <div
      data-testid="ritual-chamber-spatial-root"
      style={{
        position: "relative",
        width: "100%",
        height: "100%",
        display: "grid",
        placeItems: "center",
        perspective: "1200px",
      }}
    >
      {/* Background Ambience */}
      <div
        aria-hidden="true"
        style={{
          position: "absolute",
          width: "50rem",
          height: "50rem",
          borderRadius: "50%",
          background: `radial-gradient(circle, ${visualModel.theme.chamberGlow}, transparent 70%)`,
          filter: "blur(40px)",
          opacity: 0.6,
        }}
      />

      {/* Primary Diegetic Info Layer (Left) */}
      <div
        style={{
          position: "absolute",
          left: "3rem",
          top: "50%",
          transform: "translateY(-50%)",
          display: "grid",
          gap: "1.2rem",
          maxWidth: "22rem",
          zIndex: 20,
        }}
      >
        {renderSignalChip(visualModel.phaseCopy.eyebrow, visualModel.theme.tonePrimary)}
        {visualModel.showFirstOrbit ? (
          <span
            data-testid="first-orbit-ready-surface"
            style={{
              width: "fit-content",
              padding: "0.4rem 0.7rem",
              borderRadius: "999px",
              border: `1px solid ${visualModel.theme.orbitStroke}`,
              background: "rgba(5, 12, 24, 0.52)",
              color: "#e9f8ff",
              fontSize: "0.74rem",
              letterSpacing: "0.1em",
              fontWeight: 700,
              backdropFilter: "blur(8px)",
            }}
          >
            POTVRZENA USTAVA
          </span>
        ) : null}
        <div
          data-testid="constitution-selection-focus"
          style={{
            display: "grid",
            gap: "0.6rem",
          }}
        >
          <h2 style={{ margin: 0, color: "#fff4de", fontSize: "2.2rem", lineHeight: 1.1, letterSpacing: "-0.02em" }}>
            {focusedConstitution ? focusedConstitution.title : visualModel.phaseCopy.title}
          </h2>
          <p style={{ margin: 0, color: "rgba(223, 239, 255, 0.82)", fontSize: "0.95rem", lineHeight: 1.6 }}>
            {focusedConstitution ? constitutionEffectLine(focusedConstitution) : visualModel.phaseCopy.body}
          </p>
        </div>

        {focusedConstitution ? (
          <div
            style={{
              display: "grid",
              gap: "0.5rem",
              padding: "1rem",
              borderRadius: "1rem",
              border: "1px solid rgba(127, 220, 255, 0.08)",
              background: "rgba(5, 12, 24, 0.28)",
              fontSize: "0.82rem",
              color: "rgba(214, 235, 255, 0.7)",
            }}
          >
            <span>{pulseLabel(focusedConstitution)}</span>
            <span>{toneLabel(focusedConstitution)}</span>
            <span>{densityLabel(focusedConstitution)}</span>
          </div>
        ) : null}
      </div>

      {/* Central Spatial Core */}
      <div
        data-testid="ritual-chamber-core"
        style={{
          position: "relative",
          width: "40rem",
          height: "40rem",
          display: "grid",
          placeItems: "center",
        }}
      >
        {/* Orbital Ring (Selection) */}
        <div
          aria-hidden="true"
          style={{
            position: "absolute",
            width: "36rem",
            height: "14rem",
            borderRadius: "50%",
            border: `1px solid ${visualModel.theme.orbitStroke}`,
            background: visualModel.theme.orbitFill,
            transform: "rotateX(76deg)",
            boxShadow: `0 0 30px ${visualModel.theme.chamberGlow}`,
            transition: "all 600ms ease",
          }}
        />

        {visualModel.showLockRing ? (
          <div
            data-testid="ritual-lock-ring"
            aria-hidden="true"
            style={{
              position: "absolute",
              width: `${24 * visualModel.lockRingScale}rem`,
              height: `${24 * visualModel.lockRingScale}rem`,
              borderRadius: "50%",
              border: `2px solid ${visualModel.theme.ringStroke}`,
              boxShadow: `0 0 50px ${visualModel.theme.chamberBeam}, inset 0 0 30px ${visualModel.theme.chamberGlow}`,
              transition: "transform 450ms cubic-bezier(0.34, 1.56, 0.64, 1)",
            }}
          />
        ) : null}

        {visualModel.showSelectionOrbit
          ? constitutionOptions.map((option, index) =>
              renderConstitutionNode(
                option,
                index,
                constitutionOptions.length,
                focusedConstitution?.id === option.id,
                onSelectConstitution
              )
            )
          : null}

        {/* The Heart */}
        <div
          style={{
            position: "relative",
            width: "18rem",
            height: "18rem",
            borderRadius: "50%",
            display: "grid",
            placeItems: "center",
            background: visualModel.theme.coreGradient,
            boxShadow: `0 0 80px ${visualModel.theme.chamberGlow}, 0 0 140px ${visualModel.theme.chamberBeam}`,
            border: `1px solid ${visualModel.theme.ringStroke}`,
            transition: "all 800ms ease",
            zIndex: 15,
          }}
        >
          <div style={{ display: "grid", gap: "0.4rem", textAlign: "center", maxWidth: "12rem" }}>
            <span style={{ color: "rgba(245, 248, 255, 0.85)", fontSize: "0.7rem", letterSpacing: "0.15em" }}>
              {visualModel.stageLabel.toUpperCase()}
            </span>
            <strong style={{ color: "#fff4de", fontSize: "1.4rem", lineHeight: 1.1, letterSpacing: "0.02em" }}>
              {focusedConstitution?.title || "AKTIVNI JADRO"}
            </strong>
          </div>
        </div>

        {visualModel.showFirstOrbit ? (
          <div
            data-testid="first-orbit-ring"
            aria-hidden="true"
            style={{
              position: "absolute",
              width: "34rem",
              height: "12rem",
              borderRadius: "50%",
              border: `1px solid ${visualModel.theme.orbitStroke}`,
              boxShadow: `0 0 30px ${visualModel.theme.orbitStroke}`,
              transform: "rotateX(72deg) rotateZ(12deg)",
              animation: "pulse 4s infinite ease-in-out",
            }}
          />
        ) : null}
      </div>

      {/* Secondary Diegetic Layer (Right) */}
      <div
        style={{
          position: "absolute",
          right: "3rem",
          top: "50%",
          transform: "translateY(-50%)",
          display: "grid",
          gap: "1.5rem",
          justifyItems: "end",
          maxWidth: "20rem",
          zIndex: 20,
        }}
      >
        {interiorModel.errorMessage ? (
          <div
            style={{
              padding: "1rem",
              borderRadius: "1rem",
              border: "1px solid rgba(255, 168, 145, 0.2)",
              background: "rgba(39, 13, 10, 0.4)",
              color: "#ffc9b8",
              fontSize: "0.85rem",
              lineHeight: 1.5,
              backdropFilter: "blur(10px)",
            }}
          >
            {interiorModel.errorMessage}
          </div>
        ) : null}

        {interiorModel.isFirstOrbitReady ? (
          <button
            type="button"
            data-testid="star-core-primary-action"
            disabled={Boolean(lockTransitionModel?.disabled)}
            onClick={onReturnToSpace}
            style={{ ...actionButtonStyle(true, Boolean(lockTransitionModel?.disabled)), minWidth: "16rem" }}
          >
            {lockTransitionModel?.actionLabel || "Vratit se do prostoru"}
          </button>
        ) : null}

        {isPolicyLockPhase && lockTransitionModel?.actionLabel ? (
          <button
            type="button"
            data-testid="star-core-primary-action"
            disabled={Boolean(lockTransitionModel.disabled)}
            onClick={onConfirmPolicyLock}
            style={{ ...actionButtonStyle(true, Boolean(lockTransitionModel.disabled)), minWidth: "16rem" }}
          >
            {lockTransitionModel.actionLabel}
          </button>
        ) : null}

        {renderSignalChip(`PHASE: ${visualModel.stageLabel}`, visualModel.theme.toneSecondary)}
      </div>

      {/* Return Control (Top Right) */}
      <div style={{ position: "absolute", top: "2rem", right: "2rem", zIndex: 30 }}>
        <button
          type="button"
          data-testid="star-core-return-action"
          onClick={onReturnToSpace}
          disabled={interiorModel.phase === "policy_lock_transition"}
          style={actionButtonStyle(false, interiorModel.phase === "policy_lock_transition")}
        >
          Opustit jadro
        </button>
      </div>
    </div>
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

  const constitutionOptions = Array.isArray(interiorModel.availableConstitutions)
    ? interiorModel.availableConstitutions
    : [];
  const focusedConstitution =
    selectedConstitution ||
    constitutionOptions.find((option) => option.id === interiorModel.selectedConstitutionId) ||
    constitutionOptions.find((option) => option.id === interiorModel.recommendedConstitutionId) ||
    constitutionOptions[0] ||
    null;
  const visualModel = resolveStarCoreInteriorVisualModel({
    interiorModel,
    selectedConstitution: focusedConstitution,
    screenModel,
  });

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
        background: visualModel.theme.shellGradient,
        opacity: visualModel.chamberOpacity,
        transition: "opacity 400ms ease",
        overflow: "hidden",
      }}
    >
      {renderRitualChamber({
        interiorModel,
        visualModel,
        constitutionOptions,
        focusedConstitution,
        onSelectConstitution,
        onConfirmPolicyLock,
        onReturnToSpace,
        lockTransitionModel,
      })}

      <footer
        style={{
          position: "absolute",
          bottom: "1.5rem",
          left: "2rem",
          right: "2rem",
          display: "flex",
          justifyContent: "space-between",
          color: "rgba(204, 226, 244, 0.4)",
          fontSize: "0.7rem",
          letterSpacing: "0.1em",
          pointerEvents: "none",
        }}
      >
        <span>{`SCREEN STATE: ${screenModel.stage.toUpperCase()}`}</span>
        <span>{`CANONICAL PHASE: ${interiorModel.phase.toUpperCase()}`}</span>
      </footer>
    </section>
  );
}
