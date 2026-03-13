import StarCoreInteriorScene3d from "./starCoreInteriorScene3d.jsx";
import { resolveStarCoreInteriorVisualModel } from "./starCoreInteriorVisualModel.js";

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

function resolveOrbitalPosition(index, total, radiusX = 40, radiusY = 29, angleOffset = -90) {
  const count = Math.max(total, 1);
  const theta = ((index / count) * 360 + angleOffset) * (Math.PI / 180);
  return {
    left: `${50 + Math.cos(theta) * radiusX}%`,
    top: `${50 + Math.sin(theta) * radiusY}%`,
  };
}

function resolvePolarPosition(angleDeg, radiusX, radiusY) {
  const theta = (Number(angleDeg) || 0) * (Math.PI / 180);
  return {
    left: `${50 + Math.cos(theta) * radiusX}%`,
    top: `${50 + Math.sin(theta) * radiusY}%`,
  };
}

function formatRate(value) {
  const numeric = Number(value);
  if (!Number.isFinite(numeric)) return "0.0";
  return numeric.toFixed(1);
}

function formatCount(value) {
  const numeric = Number(value);
  if (!Number.isFinite(numeric)) return "0";
  return Intl.NumberFormat("cs-CZ", { maximumFractionDigits: 0 }).format(Math.max(0, Math.floor(numeric)));
}

function formatPercent(value) {
  const numeric = Number(value);
  if (!Number.isFinite(numeric)) return "0";
  return String(Math.round(Math.max(0, Math.min(1, numeric)) * 100));
}

function buildActionProps({ onPress = () => {}, disabled = false } = {}) {
  function invoke() {
    if (disabled) return;
    onPress();
  }

  function handleKeyDown(event) {
    if (disabled) return;
    if (event.key !== "Enter" && event.key !== " ") return;
    event.preventDefault();
    onPress();
  }

  return {
    role: "button",
    tabIndex: disabled ? -1 : 0,
    "aria-disabled": disabled ? "true" : "false",
    onClick: invoke,
    onKeyDown: handleKeyDown,
  };
}

function renderConstitutionNode(option, index, total, selected, onSelectConstitution) {
  const position = resolveOrbitalPosition(index, total);
  const interactiveProps = buildActionProps({
    onPress: () => onSelectConstitution(option.id),
    disabled: false,
  });

  return (
    <div
      key={option.id}
      data-testid={`constitution-option-${option.id}`}
      {...interactiveProps}
      style={{
        position: "absolute",
        left: position.left,
        top: position.top,
        transform: "translate(-50%, -50%)",
        width: selected ? "9.8rem" : "8.1rem",
        height: selected ? "9.8rem" : "8.1rem",
        borderRadius: "50%",
        border: `1px solid ${selected ? option.tonePrimary : "rgba(121, 214, 255, 0.2)"}`,
        background: selected
          ? `radial-gradient(circle at 50% 34%, ${option.toneSecondary}77, rgba(4, 11, 28, 0.82) 76%)`
          : "radial-gradient(circle at 50% 34%, rgba(118, 227, 255, 0.1), rgba(3, 10, 24, 0.74) 78%)",
        boxShadow: selected ? `0 0 56px ${option.tonePrimary}88` : "0 0 20px rgba(126, 232, 255, 0.16)",
        display: "grid",
        placeItems: "center",
        textAlign: "center",
        color: "#edf8ff",
        cursor: "pointer",
        userSelect: "none",
        transition: "all 430ms cubic-bezier(0.2, 0.9, 0.2, 1)",
        zIndex: selected ? 24 : 18,
      }}
    >
      <div style={{ display: "grid", gap: "0.22rem", paddingInline: "0.8rem" }}>
        <strong style={{ fontSize: selected ? "1.04rem" : "0.88rem", lineHeight: 1.08 }}>{option.title}</strong>
        <span style={{ fontSize: "0.58rem", letterSpacing: "0.14em", color: option.tonePrimary, fontWeight: 700 }}>
          {selected ? "AKTIVNI PROUD" : "USTAVA"}
        </span>
      </div>
    </div>
  );
}

function renderMetricRunes({ visualModel, interiorModel }) {
  const runtimeTelemetry = interiorModel.telemetry?.runtime || {};
  const domainTelemetry = interiorModel.telemetry?.domains || {};
  const planetTelemetry = interiorModel.telemetry?.planetPhysics || {};
  const pulseTelemetry = interiorModel.telemetry?.pulse || {};
  const metrics = [
    {
      key: "tok",
      label: "Tok",
      value: `${formatRate(runtimeTelemetry.writesPerMinute)}/min`,
      intensity: visualModel.runtimeTempo,
    },
    {
      key: "udalosti",
      label: "Udalosti",
      value: formatCount(visualModel.eventsCount),
      intensity: visualModel.eventHaloOpacity,
    },
    {
      key: "domeny",
      label: "Domeny",
      value: formatCount(domainTelemetry.items?.length || 0),
      intensity: visualModel.domainDensity,
    },
    {
      key: "planety",
      label: "Planety",
      value: formatCount(planetTelemetry.itemCount),
      intensity: visualModel.planetActivity,
    },
    {
      key: "aktivita",
      label: "Aktivita",
      value: `${formatPercent(visualModel.planetActivity)}%`,
      intensity: visualModel.pulseStrength,
    },
    {
      key: "seq",
      label: "Event seq",
      value: formatCount(pulseTelemetry.lastEventSeq),
      intensity: visualModel.chamberDepth,
    },
  ];

  return (
    <div
      data-testid="ritual-live-telemetry"
      style={{
        position: "absolute",
        left: "50%",
        bottom: "2.8rem",
        transform: "translateX(-50%)",
        display: "flex",
        gap: "1rem",
        justifyContent: "center",
        alignItems: "flex-end",
        flexWrap: "wrap",
        zIndex: 22,
      }}
    >
      {metrics.map((metric, index) => (
        <div key={metric.key} style={{ display: "grid", gap: "0.3rem", justifyItems: "center", minWidth: "4.9rem" }}>
          <span style={{ fontSize: "0.54rem", letterSpacing: "0.11em", color: "rgba(204, 229, 247, 0.74)" }}>
            {metric.label.toUpperCase()}
          </span>
          <div
            aria-hidden="true"
            style={{
              width: "3.9rem",
              height: "0.17rem",
              borderRadius: "999px",
              background: `linear-gradient(90deg, ${visualModel.theme.tonePrimary}, transparent)`,
              boxShadow: `0 0 ${8 + metric.intensity * 22}px ${visualModel.theme.toneSecondary}`,
              opacity: 0.33 + metric.intensity * 0.64,
              transform: `scaleX(${0.44 + metric.intensity * 0.56}) rotate(${(index - 2) * 2.3}deg)`,
            }}
          />
          <span style={{ fontSize: "0.66rem", color: "#d8f4ff", letterSpacing: "0.03em" }}>{metric.value}</span>
        </div>
      ))}
    </div>
  );
}

function renderTelemetryMarkers(visualModel) {
  return (
    <>
      {visualModel.domainSegments.map((segment) => {
        const position = resolvePolarPosition(segment.angleDeg, 42, 33);
        return (
          <span
            key={`domain-segment-${segment.key}`}
            data-testid="ritual-domain-segment"
            aria-hidden="true"
            style={{
              position: "absolute",
              left: position.left,
              top: position.top,
              width: `${2 + segment.intensity * 4.2}rem`,
              height: "0.16rem",
              borderRadius: "999px",
              transform: `translate(-50%, -50%) rotate(${segment.angleDeg + 90}deg)`,
              background: `linear-gradient(90deg, ${visualModel.theme.tonePrimary}, transparent 86%)`,
              boxShadow: `0 0 18px ${visualModel.theme.tonePrimary}`,
              opacity: 0.22 + segment.intensity * 0.4,
              zIndex: 14,
            }}
          />
        );
      })}

      {visualModel.pulseBeacons.map((beacon) => {
        const position = resolvePolarPosition(beacon.angleDeg, 48, 28);
        return (
          <span
            key={`pulse-beacon-${beacon.key}`}
            data-testid="ritual-pulse-beacon"
            aria-hidden="true"
            style={{
              position: "absolute",
              left: position.left,
              top: position.top,
              width: "0.3rem",
              height: "0.3rem",
              borderRadius: "50%",
              transform: "translate(-50%, -50%)",
              background: visualModel.theme.toneSecondary,
              boxShadow: `0 0 14px ${visualModel.theme.toneSecondary}`,
              opacity: 0.28 + visualModel.pulseStrength * 0.52,
              zIndex: 14,
            }}
          />
        );
      })}

      {visualModel.planetaryNodes.map((node) => {
        const position = resolvePolarPosition(node.angleDeg, 47, 23);
        return (
          <span
            key={`planet-node-${node.key}`}
            data-testid="ritual-planet-node"
            aria-hidden="true"
            style={{
              position: "absolute",
              left: position.left,
              top: position.top,
              width: `${node.size}rem`,
              height: `${node.size}rem`,
              borderRadius: "50%",
              transform: "translate(-50%, -50%)",
              border: `1px solid ${visualModel.theme.orbitStroke}`,
              background: "radial-gradient(circle, rgba(230, 247, 255, 0.95), rgba(116, 216, 255, 0.34) 72%)",
              opacity: 0.38 + visualModel.planetActivity * 0.48,
              zIndex: 14,
            }}
          />
        );
      })}
    </>
  );
}

function renderRitualChamber({
  screenModel,
  interiorModel,
  visualModel,
  constitutionOptions,
  focusedConstitution,
  onSelectConstitution,
  onConfirmPolicyLock,
  onReturnToSpace,
  lockTransitionModel,
}) {
  const isEntryDive = Boolean(screenModel?.isEntering);
  const isPolicyLockPhase = interiorModel.phase === "policy_lock_ready" || interiorModel.isLockPending;
  const lockDisabled =
    Boolean(lockTransitionModel?.disabled) || interiorModel.phase === "policy_lock_transition" || isEntryDive;
  const governanceSignal = interiorModel.governanceSignal || {};
  const primaryActionProps = buildActionProps({
    onPress: interiorModel.isFirstOrbitReady ? onReturnToSpace : onConfirmPolicyLock,
    disabled: lockDisabled,
  });
  const returnActionProps = buildActionProps({
    onPress: onReturnToSpace,
    disabled: interiorModel.phase === "policy_lock_transition" || isEntryDive,
  });

  return (
    <div
      data-testid="ritual-chamber-spatial-root"
      style={{
        position: "relative",
        width: "100%",
        height: "100%",
        display: "grid",
        placeItems: "center",
        perspective: "1600px",
      }}
    >
      <div
        data-testid="ritual-chamber-abyss"
        aria-hidden="true"
        style={{
          position: "absolute",
          inset: "-12% -14%",
          background:
            "radial-gradient(circle at 50% 52%, rgba(128, 230, 255, 0.22), rgba(7, 18, 38, 0.86) 33%, rgba(1, 8, 20, 0.97) 74%, rgba(0, 2, 8, 1) 100%)",
          opacity: 0.84 + visualModel.shellGlowOpacity * 0.12,
        }}
      />

      <div
        data-testid="constitution-selection-focus"
        style={{
          position: "absolute",
          top: "8.2%",
          left: "50%",
          transform: "translateX(-50%)",
          display: "grid",
          gap: "0.45rem",
          justifyItems: "center",
          textAlign: "center",
          zIndex: 25,
        }}
      >
        <span style={{ color: visualModel.theme.tonePrimary, fontSize: "0.64rem", letterSpacing: "0.14em" }}>
          {visualModel.phaseCopy.eyebrow}
        </span>
        <strong style={{ color: "#f3fbff", fontSize: "1.72rem", lineHeight: 1.08 }}>
          {focusedConstitution ? focusedConstitution.title : visualModel.phaseCopy.title}
        </strong>
        <span style={{ color: "rgba(223, 240, 255, 0.74)", fontSize: "0.84rem", maxWidth: "35rem" }}>
          {focusedConstitution ? constitutionEffectLine(focusedConstitution) : visualModel.phaseCopy.body}
        </span>
      </div>

      {interiorModel.errorMessage ? (
        <span
          style={{
            position: "absolute",
            top: "18%",
            left: "50%",
            transform: "translateX(-50%)",
            color: "#ffd4c8",
            fontSize: "0.72rem",
            letterSpacing: "0.07em",
            textShadow: "0 0 18px rgba(255, 138, 108, 0.42)",
            zIndex: 25,
          }}
        >
          {interiorModel.errorMessage}
        </span>
      ) : null}

      {visualModel.showFirstOrbit ? (
        <span
          data-testid="first-orbit-ready-surface"
          style={{
            position: "absolute",
            top: "20.2%",
            left: "50%",
            transform: "translateX(-50%)",
            color: "#effbff",
            fontSize: "0.62rem",
            letterSpacing: "0.16em",
            textShadow: `0 0 12px ${visualModel.theme.tonePrimary}`,
            zIndex: 25,
          }}
        >
          POTVRZENA USTAVA
        </span>
      ) : null}

      {isEntryDive ? (
        <div
          data-testid="star-core-entry-dive-overlay"
          style={{
            position: "absolute",
            top: "21%",
            left: "50%",
            transform: "translateX(-50%)",
            display: "grid",
            gap: "0.38rem",
            justifyItems: "center",
            zIndex: 26,
            pointerEvents: "none",
          }}
        >
          <span style={{ color: visualModel.theme.toneSecondary, fontSize: "0.58rem", letterSpacing: "0.16em" }}>
            PRUNIK DO JADRA
          </span>
          <span style={{ color: "rgba(218, 236, 252, 0.76)", fontSize: "0.72rem", letterSpacing: "0.08em" }}>
            Stabilizuji orientaci v srdci hvezdy
          </span>
        </div>
      ) : null}

      <div
        data-testid="ritual-chamber-core"
        style={{
          position: "relative",
          width: "46rem",
          height: "46rem",
          display: "grid",
          placeItems: "center",
        }}
      >
        <div style={{ position: "absolute", inset: 0, borderRadius: "50%", overflow: "hidden" }}>
          <StarCoreInteriorScene3d visualModel={visualModel} screenModel={screenModel} />
        </div>

        {renderTelemetryMarkers(visualModel)}

        {visualModel.showLockRing ? (
          <div
            data-testid="ritual-lock-ring"
            aria-hidden="true"
            style={{
              position: "absolute",
              width: `${24 * visualModel.lockRingScale}rem`,
              height: `${24 * visualModel.lockRingScale}rem`,
              borderRadius: "50%",
              border: `1px solid ${visualModel.theme.ringStroke}`,
              boxShadow: `0 0 26px ${visualModel.theme.chamberGlow}`,
              zIndex: 13,
            }}
          />
        ) : null}

        {visualModel.showSelectionOrbit && !isEntryDive
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

        {visualModel.showFirstOrbit ? (
          <div
            data-testid="first-orbit-ring"
            aria-hidden="true"
            style={{
              position: "absolute",
              width: "35rem",
              height: "12rem",
              borderRadius: "50%",
              border: `1px solid ${visualModel.theme.orbitStroke}`,
              boxShadow: `0 0 28px ${visualModel.theme.orbitStroke}`,
              transform: "rotateX(74deg) rotateZ(10deg)",
              zIndex: 19,
            }}
          />
        ) : null}

        <div
          style={{
            position: "absolute",
            inset: 0,
            pointerEvents: "none",
            display: "grid",
            placeItems: "center",
            zIndex: 20,
          }}
        >
          <div
            style={{ display: "grid", gap: "0.38rem", justifyItems: "center", textAlign: "center", maxWidth: "16rem" }}
          >
            <span style={{ color: "rgba(234, 244, 255, 0.84)", fontSize: "0.64rem", letterSpacing: "0.14em" }}>
              {visualModel.stageLabel.toUpperCase()}
            </span>
            <strong style={{ color: "#fff4de", fontSize: "1.32rem", lineHeight: 1.05 }}>
              {focusedConstitution?.title || "AKTIVNI JADRO"}
            </strong>
            <span style={{ color: "rgba(212, 233, 252, 0.7)", fontSize: "0.63rem", letterSpacing: "0.08em" }}>
              {pulseLabel(focusedConstitution)} / {toneLabel(focusedConstitution)} / {densityLabel(focusedConstitution)}
            </span>
          </div>
        </div>

        {isPolicyLockPhase && lockTransitionModel?.actionLabel && !isEntryDive ? (
          <div
            data-testid="star-core-primary-action"
            {...primaryActionProps}
            style={{
              position: "absolute",
              bottom: "8.2rem",
              width: "8.4rem",
              height: "8.4rem",
              borderRadius: "50%",
              border: `1px solid ${lockDisabled ? "rgba(122, 178, 209, 0.3)" : visualModel.theme.toneSecondary}`,
              background: lockDisabled
                ? "radial-gradient(circle at 50% 36%, rgba(95, 126, 152, 0.24), rgba(4, 10, 24, 0.8) 74%)"
                : "radial-gradient(circle at 50% 36%, rgba(255, 208, 132, 0.36), rgba(4, 10, 24, 0.8) 74%)",
              boxShadow: lockDisabled ? "0 0 16px rgba(116, 174, 203, 0.26)" : "0 0 42px rgba(255, 210, 142, 0.56)",
              color: lockDisabled ? "rgba(202, 224, 241, 0.64)" : "#fff7e7",
              display: "grid",
              placeItems: "center",
              textAlign: "center",
              padding: "0.95rem",
              fontSize: "0.67rem",
              lineHeight: 1.3,
              letterSpacing: "0.06em",
              cursor: lockDisabled ? "default" : "pointer",
              zIndex: 27,
            }}
          >
            {lockTransitionModel.actionLabel}
          </div>
        ) : null}

        {visualModel.showFirstOrbit && !isEntryDive ? (
          <div
            data-testid="star-core-primary-action"
            {...primaryActionProps}
            style={{
              position: "absolute",
              top: "5.4rem",
              width: "7.4rem",
              height: "7.4rem",
              borderRadius: "50%",
              border: `1px solid ${visualModel.theme.tonePrimary}`,
              background: "radial-gradient(circle at 50% 36%, rgba(148, 233, 255, 0.44), rgba(3, 10, 23, 0.82) 74%)",
              boxShadow: `0 0 48px ${visualModel.theme.chamberGlow}`,
              color: "#ecfbff",
              display: "grid",
              placeItems: "center",
              textAlign: "center",
              padding: "0.82rem",
              fontSize: "0.63rem",
              lineHeight: 1.3,
              letterSpacing: "0.08em",
              cursor: "pointer",
              zIndex: 27,
            }}
          >
            {lockTransitionModel?.actionLabel || "Vratit se do prostoru"}
          </div>
        ) : null}
      </div>

      <div
        style={{
          position: "absolute",
          right: "2.2rem",
          top: "2.2rem",
          display: "grid",
          gap: "0.54rem",
          justifyItems: "end",
          zIndex: 30,
        }}
      >
        <div
          data-testid="star-core-return-action"
          {...returnActionProps}
          style={{
            width: "4.3rem",
            height: "4.3rem",
            borderRadius: "50%",
            border: `1px solid ${
              interiorModel.phase === "policy_lock_transition"
                ? "rgba(118, 163, 191, 0.34)"
                : visualModel.theme.tonePrimary
            }`,
            boxShadow: `0 0 24px ${visualModel.theme.chamberGlow}`,
            background: "radial-gradient(circle at 50% 34%, rgba(111, 219, 255, 0.2), rgba(2, 8, 20, 0.8) 76%)",
            color: "#def4ff",
            display: "grid",
            placeItems: "center",
            fontSize: "0.55rem",
            letterSpacing: "0.08em",
            textAlign: "center",
            cursor: interiorModel.phase === "policy_lock_transition" || isEntryDive ? "default" : "pointer",
            opacity: interiorModel.phase === "policy_lock_transition" || isEntryDive ? 0.56 : 1,
            lineHeight: 1.2,
          }}
        >
          OPUSTIT
          <br />
          JADRO
        </div>
        <span style={{ color: "rgba(205, 226, 244, 0.68)", fontSize: "0.58rem", letterSpacing: "0.12em" }}>
          GOV {String(governanceSignal.lockStatus || "draft").toUpperCase()} / V
          {formatCount(governanceSignal.policyVersion)}
        </span>
      </div>

      {renderMetricRunes({ visualModel, interiorModel })}
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
        transition: "opacity 420ms ease",
        overflow: "hidden",
      }}
    >
      {renderRitualChamber({
        screenModel,
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
          bottom: "1.35rem",
          left: "2rem",
          right: "2rem",
          display: "flex",
          justifyContent: "space-between",
          color: "rgba(194, 220, 240, 0.42)",
          fontSize: "0.66rem",
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
