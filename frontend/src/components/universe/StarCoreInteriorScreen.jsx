import { useRef, useState } from "react";

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
  if (option?.id === "rust") return "Otevre proud rustu a zrychli prvni vetve.";
  if (option?.id === "rovnovaha") return "Udrzi prvni prostor citelny, stabilni a pripraveny na navazani.";
  if (option?.id === "straz") return "Zpevni governance obal a postavi integritu nad tempo.";
  if (option?.id === "archiv") return "Zklidni jadro pro opatrny, pametovy rezim.";
  return option?.effectHint || "Urci dalsi chovani prostoru.";
}

function formatCount(value) {
  const numeric = Number(value);
  if (!Number.isFinite(numeric)) return "0";
  return Intl.NumberFormat("cs-CZ", { maximumFractionDigits: 0 }).format(Math.max(0, Math.floor(numeric)));
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

function resolvePolarPosition(angleDeg, radiusX, radiusY) {
  const theta = ((Number(angleDeg) || 0) * Math.PI) / 180;
  return {
    left: `${50 + Math.cos(theta) * radiusX}%`,
    top: `${50 + Math.sin(theta) * radiusY}%`,
  };
}

function renderTelemetryMarkers(visualModel) {
  return (
    <>
      {visualModel.domainSegments.map((segment) => {
        const position = resolvePolarPosition(segment.angleDeg, 38, 31);
        return (
          <span
            key={`domain-segment-${segment.key}`}
            data-testid="ritual-domain-segment"
            aria-hidden="true"
            style={{
              position: "absolute",
              left: position.left,
              top: position.top,
              width: `${2.4 + segment.intensity * 3.6}rem`,
              height: "0.1rem",
              borderRadius: "999px",
              transform: `translate(-50%, -50%) rotate(${segment.angleDeg + 90}deg)`,
              background: `linear-gradient(90deg, ${visualModel.theme.tonePrimary}, transparent 80%)`,
              opacity: 0.18 + segment.intensity * 0.34,
              boxShadow: `0 0 10px ${visualModel.theme.tonePrimary}`,
              zIndex: 12,
              pointerEvents: "none",
            }}
          />
        );
      })}

      {visualModel.pulseBeacons.map((beacon) => {
        const position = resolvePolarPosition(beacon.angleDeg, 45, 24);
        return (
          <span
            key={`pulse-beacon-${beacon.key}`}
            data-testid="ritual-pulse-beacon"
            aria-hidden="true"
            style={{
              position: "absolute",
              left: position.left,
              top: position.top,
              width: "0.22rem",
              height: "0.22rem",
              borderRadius: "50%",
              transform: "translate(-50%, -50%)",
              background: visualModel.theme.toneSecondary,
              boxShadow: `0 0 10px ${visualModel.theme.toneSecondary}`,
              opacity: 0.16 + visualModel.pulseStrength * 0.34,
              zIndex: 12,
              pointerEvents: "none",
            }}
          />
        );
      })}

      {visualModel.planetaryNodes.map((node) => {
        const position = resolvePolarPosition(node.angleDeg, 41, 20);
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
              background: "radial-gradient(circle, rgba(231, 247, 255, 0.92), rgba(102, 205, 255, 0.26) 72%)",
              opacity: 0.18 + visualModel.planetActivity * 0.24,
              zIndex: 12,
              pointerEvents: "none",
            }}
          />
        );
      })}
    </>
  );
}

function renderMetricRunes(visualModel) {
  return (
    <div
      data-testid="ritual-live-telemetry"
      style={{
        position: "absolute",
        left: "50%",
        bottom: "1.45rem",
        transform: "translateX(-50%)",
        display: "flex",
        gap: "0.8rem",
        justifyContent: "center",
        alignItems: "flex-end",
        flexWrap: "wrap",
        zIndex: 20,
        pointerEvents: "none",
      }}
    >
      {visualModel.metricStreams.map((metric) => (
        <div
          key={metric.key}
          style={{ display: "grid", gap: "0.24rem", justifyItems: "center", minWidth: "4.7rem", color: "#d9efff" }}
        >
          <span style={{ fontSize: "0.54rem", letterSpacing: "0.12em", color: "rgba(200, 225, 245, 0.72)" }}>
            {metric.label.toUpperCase()}
          </span>
          <div
            style={{
              width: "3.8rem",
              height: "0.16rem",
              borderRadius: "999px",
              background: `linear-gradient(90deg, ${visualModel.theme.tonePrimary}, transparent 92%)`,
              boxShadow: `0 0 ${8 + metric.intensity * 20}px ${visualModel.theme.toneSecondary}`,
              transform: `scaleX(${0.38 + metric.intensity * 0.62})`,
              opacity: 0.28 + metric.intensity * 0.7,
            }}
          />
          <span style={{ fontSize: "0.65rem", letterSpacing: "0.04em" }}>{metric.value}</span>
        </div>
      ))}
    </div>
  );
}

function renderConstitutionNodes({
  visualModel,
  constitutionOptions,
  focusedConstitution,
  onSelectConstitution,
  disabled = false,
}) {
  if (!visualModel.showConstitutionField || disabled) return null;
  const action = (constitutionId) => onSelectConstitution(constitutionId);

  return (
    <div
      aria-label="Astrolab ustav"
      style={{
        position: "absolute",
        inset: "14% 16%",
        zIndex: 19,
      }}
    >
      {constitutionOptions.map((option, index) => {
        const glyph = visualModel.constitutionGlyphs[index];
        if (!glyph) return null;
        const position = resolvePolarPosition(glyph.angleDeg, 36, 26);
        const selected = focusedConstitution?.id === option.id;
        const actionProps = buildActionProps({
          onPress: () => action(option.id),
          disabled: false,
        });
        return (
          <div
            key={option.id}
            data-testid={`constitution-option-${option.id}`}
            {...actionProps}
            style={{
              position: "absolute",
              left: position.left,
              top: position.top,
              transform: "translate(-50%, -50%) rotate(45deg)",
              width: selected ? "3.9rem" : "3.3rem",
              height: selected ? "3.9rem" : "3.3rem",
              border: `1px solid ${selected ? option.toneSecondary : option.tonePrimary}`,
              boxShadow: selected ? `0 0 12px ${option.toneSecondary}` : `0 0 4px ${option.tonePrimary}`,
              background: selected
                ? `linear-gradient(160deg, ${option.toneSecondary}66, rgba(2, 9, 20, 0.86))`
                : `linear-gradient(160deg, ${option.tonePrimary}30, rgba(2, 8, 18, 0.75))`,
              display: "grid",
              placeItems: "center",
              cursor: "pointer",
              userSelect: "none",
              transition: "transform 260ms ease, box-shadow 260ms ease",
            }}
          >
            <div
              style={{
                transform: "rotate(-45deg)",
                display: "grid",
                gap: "0.14rem",
                justifyItems: "center",
                textAlign: "center",
                color: "#e9f8ff",
              }}
            >
              <strong style={{ fontSize: selected ? "0.62rem" : "0.58rem", letterSpacing: "0.03em" }}>
                {option.title}
              </strong>
              <span style={{ fontSize: "0.42rem", letterSpacing: "0.12em", color: option.tonePrimary }}>
                {selected ? "AKTIVNI PROUD" : "USTAVA"}
              </span>
            </div>
          </div>
        );
      })}
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
  const pointerStateRef = useRef(null);
  const [astrolabeRotation, setAstrolabeRotation] = useState(0);

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
  const foundationOnly = true;
  const showReactorCore = true;
  const isEntryDive = Boolean(screenModel.isEntering);
  const isPolicyLockPhase = interiorModel.phase === "policy_lock_ready" || interiorModel.isLockPending;
  const lockDisabled =
    Boolean(lockTransitionModel?.disabled) || interiorModel.phase === "policy_lock_transition" || isEntryDive;
  const primaryActionProps = buildActionProps({
    onPress: interiorModel.isFirstOrbitReady ? onReturnToSpace : onConfirmPolicyLock,
    disabled: lockDisabled,
  });
  const returnActionProps = buildActionProps({
    onPress: onReturnToSpace,
    disabled: interiorModel.phase === "policy_lock_transition" || isEntryDive,
  });
  const gestureActive = visualModel.showConstitutionField && !isEntryDive;

  function handleGestureStart(event) {
    if (!gestureActive) return;
    pointerStateRef.current = {
      pointerId: event.pointerId,
      startX: event.clientX,
      baseRotation: astrolabeRotation,
    };
    if (event.currentTarget?.setPointerCapture) {
      event.currentTarget.setPointerCapture(event.pointerId);
    }
  }

  function handleGestureMove(event) {
    const pointerState = pointerStateRef.current;
    if (!pointerState || pointerState.pointerId !== event.pointerId) return;
    const deltaX = event.clientX - pointerState.startX;
    const nextRotation = pointerState.baseRotation + deltaX / 320;
    setAstrolabeRotation(Math.max(-1.4, Math.min(1.4, nextRotation)));
  }

  function handleGestureEnd(event) {
    if (!pointerStateRef.current || pointerStateRef.current.pointerId !== event.pointerId) return;
    pointerStateRef.current = null;
    if (event.currentTarget?.releasePointerCapture) {
      event.currentTarget.releasePointerCapture(event.pointerId);
    }
  }

  return (
    <section
      data-testid="star-core-interior-screen"
      aria-label="Srdce hvezdy"
      style={{
        position: "absolute",
        inset: 0,
        zIndex: 5,
        background: visualModel.theme.shellGradient,
        opacity: visualModel.chamberOpacity,
        overflow: "hidden",
      }}
    >
      <div data-testid="ritual-chamber-core" style={{ position: "absolute", inset: 0 }}>
        <StarCoreInteriorScene3d
          visualModel={visualModel}
          screenModel={screenModel}
          astrolabeRotation={astrolabeRotation}
          foundationOnly={foundationOnly}
          showReactorCore={showReactorCore}
          onSelectConstitution={onSelectConstitution}
        />
      </div>

      {!foundationOnly ? (
        <div
          data-testid="constitution-selection-focus"
          style={{
            position: "absolute",
            top: "7.3%",
            left: "50%",
            transform: "translateX(-50%)",
            display: "grid",
            gap: "0.34rem",
            justifyItems: "center",
            textAlign: "center",
            zIndex: 22,
            pointerEvents: "none",
          }}
        >
          <span style={{ color: visualModel.theme.tonePrimary, fontSize: "0.62rem", letterSpacing: "0.16em" }}>
            {visualModel.phaseCopy.eyebrow}
          </span>
          <strong style={{ color: "#f2faff", fontSize: "2rem", lineHeight: 1.03 }}>
            {focusedConstitution ? focusedConstitution.title : visualModel.phaseCopy.title}
          </strong>
          <span style={{ color: "rgba(220, 238, 252, 0.72)", fontSize: "0.84rem", maxWidth: "43rem" }}>
            {focusedConstitution ? constitutionEffectLine(focusedConstitution) : visualModel.phaseCopy.body}
          </span>
        </div>
      ) : null}

      {isEntryDive ? (
        <div
          data-testid="star-core-entry-dive-overlay"
          style={{
            position: "absolute",
            top: "19%",
            left: "50%",
            transform: "translateX(-50%)",
            display: "grid",
            gap: "0.3rem",
            justifyItems: "center",
            zIndex: 22,
            pointerEvents: "none",
          }}
        >
          <span style={{ color: visualModel.theme.toneSecondary, fontSize: "0.6rem", letterSpacing: "0.16em" }}>
            PRUNIK DO JADRA
          </span>
          <span style={{ color: "rgba(209, 228, 244, 0.76)", fontSize: "0.74rem", letterSpacing: "0.08em" }}>
            Stabilizuji orientaci v centralnim prostoru
          </span>
        </div>
      ) : null}

      {!foundationOnly && visualModel.showFirstOrbit ? (
        <span
          data-testid="first-orbit-ready-surface"
          style={{
            position: "absolute",
            top: "20.6%",
            left: "50%",
            transform: "translateX(-50%)",
            color: "#effbff",
            fontSize: "0.62rem",
            letterSpacing: "0.16em",
            textShadow: `0 0 12px ${visualModel.theme.tonePrimary}`,
            zIndex: 23,
            pointerEvents: "none",
          }}
        >
          POTVRZENA USTAVA
        </span>
      ) : null}

      {!foundationOnly ? (
        <div
          data-testid="astrolabe-gesture-layer"
          aria-hidden="true"
          onPointerDown={handleGestureStart}
          onPointerMove={handleGestureMove}
          onPointerUp={handleGestureEnd}
          onPointerCancel={handleGestureEnd}
          style={{
            position: "absolute",
            left: "50%",
            top: "51%",
            transform: "translate(-50%, -50%)",
            width: "34rem",
            height: "22rem",
            borderRadius: "50%",
            border: "none",
            opacity: gestureActive ? 0.06 : 0,
            zIndex: 15,
            cursor: gestureActive ? "grab" : "default",
          }}
        />
      ) : null}

      {!foundationOnly && visualModel.showFirstOrbit ? (
        <div
          data-testid="first-orbit-ring"
          aria-hidden="true"
          style={{
            position: "absolute",
            left: "50%",
            top: "54%",
            transform: "translate(-50%, -50%) rotateX(76deg) rotateZ(12deg)",
            width: "31rem",
            height: "10rem",
            borderRadius: "50%",
            border: `1px solid ${visualModel.theme.orbitStroke}`,
            boxShadow: `0 0 10px ${visualModel.theme.chamberGlow}`,
            opacity: 0.54,
            zIndex: 14,
            pointerEvents: "none",
          }}
        />
      ) : null}

      {!foundationOnly && visualModel.showLockRing ? (
        <div
          data-testid="ritual-lock-ring"
          aria-hidden="true"
          style={{
            position: "absolute",
            left: "50%",
            top: "50.6%",
            transform: "translate(-50%, -50%)",
            width: `${16.8 * visualModel.lockRingScale}rem`,
            height: `${16.8 * visualModel.lockRingScale}rem`,
            borderRadius: "50%",
            border: `1px solid ${visualModel.theme.ringStroke}`,
            boxShadow: `0 0 10px ${visualModel.theme.chamberGlow}`,
            opacity: 0.22,
            zIndex: 13,
            pointerEvents: "none",
          }}
        />
      ) : null}

      {!foundationOnly
        ? renderConstitutionNodes({
            visualModel,
            constitutionOptions,
            focusedConstitution,
            onSelectConstitution,
            disabled: isEntryDive,
          })
        : null}

      {!foundationOnly ? renderTelemetryMarkers(visualModel) : null}

      {isPolicyLockPhase && lockTransitionModel?.actionLabel && !isEntryDive ? (
        <div
          data-testid="star-core-primary-action"
          {...primaryActionProps}
          style={{
            position: "absolute",
            right: "6.4%",
            top: "59%",
            transform: "translateY(-50%)",
            width: "5rem",
            height: "5rem",
            border: `1px solid ${lockDisabled ? "rgba(128, 166, 190, 0.4)" : visualModel.theme.toneAccent}`,
            background: lockDisabled
              ? "radial-gradient(circle at 50% 36%, rgba(92, 122, 146, 0.26), rgba(2, 9, 20, 0.78) 74%)"
              : `radial-gradient(circle at 50% 36%, ${visualModel.theme.toneAccent}55, rgba(2, 9, 20, 0.78) 74%)`,
            boxShadow: lockDisabled ? "0 0 12px rgba(121, 164, 191, 0.2)" : `0 0 20px ${visualModel.theme.toneAccent}`,
            color: lockDisabled ? "rgba(195, 216, 233, 0.62)" : "#fff7e6",
            display: "grid",
            placeItems: "center",
            textAlign: "center",
            fontSize: "0.55rem",
            lineHeight: 1.25,
            letterSpacing: "0.08em",
            padding: "0.65rem",
            clipPath: "polygon(50% 0%, 82% 18%, 100% 50%, 82% 82%, 50% 100%, 18% 82%, 0% 50%, 18% 18%)",
            cursor: lockDisabled ? "default" : "pointer",
            zIndex: 24,
          }}
        >
          {lockTransitionModel.actionLabel}
        </div>
      ) : null}

      <div
        style={{
          position: "absolute",
          right: "1.8rem",
          top: "1.7rem",
          zIndex: 25,
          display: "grid",
          gap: foundationOnly ? "0" : "0.5rem",
          justifyItems: "end",
        }}
      >
        <div
          data-testid="star-core-return-action"
          {...returnActionProps}
          style={{
            width: "3.3rem",
            height: "3.3rem",
            border: `1px solid ${
              interiorModel.phase === "policy_lock_transition"
                ? "rgba(118, 164, 192, 0.35)"
                : visualModel.theme.tonePrimary
            }`,
            background: "radial-gradient(circle at 50% 30%, rgba(122, 222, 255, 0.25), rgba(2, 8, 20, 0.82) 72%)",
            boxShadow: `0 0 14px ${visualModel.theme.chamberGlow}`,
            color: "#def4ff",
            display: "grid",
            placeItems: "center",
            textAlign: "center",
            fontSize: "0.44rem",
            letterSpacing: "0.09em",
            lineHeight: 1.24,
            clipPath: "polygon(50% 0%, 82% 18%, 100% 50%, 82% 82%, 50% 100%, 18% 82%, 0% 50%, 18% 18%)",
            cursor: interiorModel.phase === "policy_lock_transition" || isEntryDive ? "default" : "pointer",
            opacity: interiorModel.phase === "policy_lock_transition" || isEntryDive ? 0.56 : 1,
          }}
        >
          OPUSTIT
          <br />
          JADRO
        </div>
        {!foundationOnly ? (
          <span style={{ color: "rgba(204, 224, 240, 0.7)", fontSize: "0.56rem", letterSpacing: "0.12em" }}>
            GOV {String(interiorModel.governanceSignal?.lockStatus || "draft").toUpperCase()} / V
            {formatCount(interiorModel.governanceSignal?.policyVersion)}
          </span>
        ) : null}
      </div>

      {!foundationOnly ? (
        <div
          style={{
            position: "absolute",
            left: "1.7rem",
            top: "1.9rem",
            display: "grid",
            gap: "0.26rem",
            color: "rgba(218, 237, 252, 0.72)",
            fontSize: "0.58rem",
            letterSpacing: "0.1em",
            zIndex: 22,
            pointerEvents: "none",
          }}
        >
          <span>{visualModel.hudCoreStatus}</span>
          <span>{visualModel.hudPolicyStatus}</span>
          <span>{pulseLabel(focusedConstitution)}</span>
          <span>
            {toneLabel(focusedConstitution)} / {densityLabel(focusedConstitution)}
          </span>
        </div>
      ) : null}

      {!foundationOnly ? renderMetricRunes(visualModel) : null}

      {!foundationOnly ? (
        <footer
          style={{
            position: "absolute",
            bottom: "1.2rem",
            left: "1.8rem",
            right: "1.8rem",
            display: "flex",
            justifyContent: "space-between",
            color: "rgba(188, 214, 233, 0.42)",
            fontSize: "0.64rem",
            letterSpacing: "0.1em",
            pointerEvents: "none",
            zIndex: 20,
          }}
        >
          <span>{`SCREEN STATE: ${screenModel.stage.toUpperCase()}`}</span>
          <span>{`CANONICAL PHASE: ${interiorModel.phase.toUpperCase()}`}</span>
        </footer>
      ) : null}
    </section>
  );
}
