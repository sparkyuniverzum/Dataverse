function normalizeHexTone(value, fallback) {
  const tone = String(value || "").trim();
  if (/^#[0-9a-fA-F]{6}$/.test(tone)) return tone;
  return fallback;
}

function withAlpha(hex, alpha) {
  const normalized = normalizeHexTone(hex, "#7ee8ff");
  const safeAlpha = Math.max(0, Math.min(1, Number(alpha) || 0));
  const suffix = Math.round(safeAlpha * 255)
    .toString(16)
    .padStart(2, "0");
  return `${normalized}${suffix}`;
}

function defaultTheme() {
  return {
    tonePrimary: "#7ee8ff",
    toneSecondary: "#82ffd4",
    chamberGlow: "rgba(126, 232, 255, 0.18)",
    chamberBeam: "rgba(255, 196, 116, 0.16)",
    orbitStroke: "rgba(126, 232, 255, 0.74)",
    ringStroke: "rgba(126, 232, 255, 0.42)",
    orbitFill: "rgba(126, 232, 255, 0.14)",
    coreGradient:
      "radial-gradient(circle at 50% 38%, rgba(130, 255, 212, 0.95), rgba(126, 232, 255, 0.54) 34%, rgba(5, 10, 20, 0.18) 70%)",
    shellGradient:
      "radial-gradient(circle at 50% 14%, rgba(255, 188, 107, 0.18), transparent 22%), linear-gradient(180deg, rgba(5, 12, 24, 0.98) 0%, rgba(4, 9, 19, 0.97) 58%, rgba(4, 8, 17, 0.99) 100%)",
  };
}

function resolveThemeFromConstitution(constitution) {
  const tonePrimary = normalizeHexTone(constitution?.tonePrimary, "#7ee8ff");
  const toneSecondary = normalizeHexTone(constitution?.toneSecondary, "#82ffd4");
  return {
    tonePrimary,
    toneSecondary,
    chamberGlow: withAlpha(tonePrimary, 0.18),
    chamberBeam: withAlpha(toneSecondary, 0.2),
    orbitStroke: withAlpha(tonePrimary, 0.72),
    ringStroke: withAlpha(tonePrimary, 0.38),
    orbitFill: withAlpha(toneSecondary, 0.12),
    coreGradient: `radial-gradient(circle at 50% 38%, ${withAlpha(
      toneSecondary,
      0.95
    )}, ${withAlpha(tonePrimary, 0.54)} 34%, rgba(5, 10, 20, 0.18) 70%)`,
    shellGradient: `radial-gradient(circle at 50% 14%, ${withAlpha(
      toneSecondary,
      0.18
    )}, transparent 22%), linear-gradient(180deg, rgba(5, 12, 24, 0.98) 0%, rgba(4, 9, 19, 0.97) 58%, rgba(4, 8, 17, 0.99) 100%)`,
  };
}

function resolveStageCopy(phase, explainability) {
  if (phase === "star_core_interior_entry") {
    return {
      eyebrow: "STAR CORE INTERIOR",
      title: "Srdce hvezdy se otevira",
      body: "Komora se sklada kolem jadra a stahuje pozornost do jedineho governance ohniska.",
    };
  }
  if (phase === "policy_lock_transition") {
    return {
      eyebrow: "POLICY LOCK",
      title: explainability?.headline || "Prstenec se uzamyka",
      body: explainability?.body || "Governance vrstva se sevira a stabilizuje dalsi smer prostoru.",
    };
  }
  if (phase === "first_orbit_ready") {
    return {
      eyebrow: "FIRST ORBIT READY",
      title: explainability?.headline || "Politiky jsou uzamceny.",
      body: explainability?.body || "Prvni draha je potvrzena jako dalsi fyzicky krok prostoru.",
    };
  }
  if (phase === "policy_lock_ready") {
    return {
      eyebrow: "POLICY LOCK",
      title: explainability?.headline || "Zvoleny rezim je pripraven",
      body: explainability?.body || "Jadro se zklidnilo. Zbyva jediny krok: fyzicky uzamknout governance prstenec.",
    };
  }
  return {
    eyebrow: "CONSTITUTION SELECT",
    title: explainability?.headline || "Vyber rezim jadra",
    body: explainability?.body || "Kazdy proud meni tonalitu, puls a hustotu prvni vrstvy prostoru.",
  };
}

export function resolveStarCoreInteriorVisualModel({
  interiorModel = null,
  selectedConstitution = null,
  screenModel = null,
} = {}) {
  const phase = String(interiorModel?.phase || "constitution_select").trim() || "constitution_select";
  const theme = selectedConstitution ? resolveThemeFromConstitution(selectedConstitution) : defaultTheme();
  const phaseCopy = resolveStageCopy(phase, interiorModel?.explainability || {});
  const orbitalCount = Array.isArray(interiorModel?.availableConstitutions)
    ? interiorModel.availableConstitutions.length
    : 0;

  return {
    phase,
    phaseCopy,
    theme,
    orbitalCount,
    showSelectionOrbit: phase === "constitution_select" || phase === "policy_lock_ready",
    showLockRing: phase === "policy_lock_ready" || phase === "policy_lock_transition" || phase === "first_orbit_ready",
    showFirstOrbit: phase === "first_orbit_ready",
    lockRingScale: phase === "policy_lock_transition" ? 0.92 : phase === "first_orbit_ready" ? 0.88 : 1,
    chamberOpacity: screenModel?.isEntering || screenModel?.isReturning ? 0.78 : 1,
    stageLabel:
      phase === "policy_lock_ready"
        ? "Ritual lock"
        : phase === "policy_lock_transition"
          ? "Lock transition"
          : phase === "first_orbit_ready"
            ? "First orbit"
            : "Constitution field",
  };
}
