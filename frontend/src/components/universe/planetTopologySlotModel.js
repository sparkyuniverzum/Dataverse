function clamp(value, min, max) {
  return Math.max(min, Math.min(max, value));
}

function normalizeText(value, fallback = "") {
  const text = String(value || "").trim();
  return text || fallback;
}

function lawPresetToSlotCount(lawPreset) {
  const preset = normalizeText(lawPreset, "balanced").toLowerCase();
  if (preset === "strict") return 4;
  if (preset === "archive") return 3;
  if (preset === "growth") return 6;
  return 5;
}

function paletteForState({ locked, profileMode }) {
  if (!locked) {
    return {
      ring: "#ffcb82",
      glow: "#ffd9a1",
      core: "#7de9ff",
    };
  }
  if (
    String(profileMode || "")
      .trim()
      .toLowerCase() === "locked"
  ) {
    return {
      ring: "#8edfff",
      glow: "#c8f4ff",
      core: "#7dd8ff",
    };
  }
  return {
    ring: "#9ddcff",
    glow: "#d8f3ff",
    core: "#8bdfff",
  };
}

export function buildEmptyGalaxyOrbitSlots({ starModel = null } = {}) {
  const policy = starModel?.policy || {};
  const visual = starModel?.visual || {};
  const locked =
    String(policy.lock_status || "")
      .trim()
      .toLowerCase() === "locked";
  const slotCount = lawPresetToSlotCount(policy.law_preset);
  const baseRadius = locked ? 7.2 : 6.4;
  const radiusSpread = locked ? 1.6 : 1.2;
  const palette = paletteForState({ locked, profileMode: policy.profile_mode });
  const pulseFactor = clamp(Number(visual.pulseSpeed || 1), 0.7, 1.8);

  return Array.from({ length: slotCount }, (_, index) => {
    const theta = (index / slotCount) * Math.PI * 2 - Math.PI / 2;
    const ringOffset = (index % 2 === 0 ? -1 : 1) * radiusSpread * 0.35;
    const radius = baseRadius + ringOffset;
    const x = Math.cos(theta) * radius;
    const z = Math.sin(theta) * radius * 0.82;
    return {
      id: `orbit-slot-${index + 1}`,
      type: "planet-slot",
      label: `Orbit slot ${index + 1}`,
      subtitle: locked ? "Pripraveno pro planetu" : "Ceka na uzamceni politik",
      statusLabel: locked ? "READY" : "LOCK_REQUIRED",
      position: [x, 0, z],
      size: locked ? 1.28 : 1.1,
      orbitRadius: 1.5 + (index % 3) * 0.28,
      approachDistance: 6.2,
      pulseSpeed: pulseFactor,
      emissiveBoost: locked ? 0.44 : 0.2,
      alertPressure: locked ? 0.08 : 0.34,
      corrosionLevel: 0,
      crackIntensity: 0,
      qualityScore: locked ? 100 : 0,
      complexity: 0,
      bondLoad: 0,
      rows: 0,
      palette: {
        primary: "rgba(0,0,0,0)",
        accent: palette.ring,
        alert: palette.glow,
      },
      slotState: locked ? "ready" : "locked",
      source: null,
    };
  });
}
