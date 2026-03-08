import * as THREE from "three";

import { clamp } from "./sceneMath";

export const PHASE_ORDER = Object.freeze(["CALM", "ACTIVE", "OVERLOADED", "DORMANT", "CORRODING", "CRITICAL"]);

export const PHASE_DISPLAY_NAMES = Object.freeze({
  CALM: "Klid",
  ACTIVE: "Aktivní",
  CONVERGING: "Přepočítává se",
  OVERLOADED: "Přetíženo",
  DORMANT: "Spící",
  CORRODING: "Korodující",
  CRITICAL: "Kritický stav",
});

const PHASE_VISUAL_PRESETS = Object.freeze({
  CALM: Object.freeze({
    tint: "#8fdfff",
    emissive: "#4fcfff",
    rim: "#7fe4ff",
    aura: "#8adfff",
    label: "#9edfff",
    roughness: 0.26,
    metalness: 0.5,
    spinMultiplier: 1,
    pulseMultiplier: 1,
  }),
  CONVERGING: Object.freeze({
    tint: "#e0f8ff",
    emissive: "#ffffff",
    rim: "#c8f6ff",
    aura: "#c1f0ff",
    label: "#ffffff",
    roughness: 0.3,
    metalness: 0.5,
    spinMultiplier: 1.0,
    pulseMultiplier: 1.8,
  }),
  ACTIVE: Object.freeze({
    tint: "#c5fdff",
    emissive: "#7effff",
    rim: "#9ff5ff",
    aura: "#95ebff",
    label: "#bffcff",
    roughness: 0.22,
    metalness: 0.56,
    spinMultiplier: 1.2,
    pulseMultiplier: 1.3,
  }),
  OVERLOADED: Object.freeze({
    tint: "#ffd7a8",
    emissive: "#ffae57",
    rim: "#ffca79",
    aura: "#ffbf7a",
    label: "#ffd29d",
    roughness: 0.36,
    metalness: 0.46,
    spinMultiplier: 1.12,
    pulseMultiplier: 1.18,
  }),
  DORMANT: Object.freeze({
    tint: "#a7bccf",
    emissive: "#7c9fbe",
    rim: "#96b5cf",
    aura: "#89aac9",
    label: "#b2c7d8",
    roughness: 0.44,
    metalness: 0.38,
    spinMultiplier: 0.7,
    pulseMultiplier: 0.62,
  }),
  CORRODING: Object.freeze({
    tint: "#dfb3a0",
    emissive: "#d47f59",
    rim: "#d5987a",
    aura: "#cc8e74",
    label: "#f0b79e",
    roughness: 0.62,
    metalness: 0.2,
    spinMultiplier: 0.76,
    pulseMultiplier: 0.8,
  }),
  CRITICAL: Object.freeze({
    tint: "#ffc0ba",
    emissive: "#ff5d5d",
    rim: "#ff8f78",
    aura: "#ff8a90",
    label: "#ff8f8f",
    roughness: 0.7,
    metalness: 0.12,
    spinMultiplier: 0.86,
    pulseMultiplier: 1.7,
  }),
});

const LEGACY_STATUS_TO_PHASE = Object.freeze({
  GREEN: "CALM",
  YELLOW: "OVERLOADED",
  RED: "CRITICAL",
});

export function normalizePhase(phase) {
  const normalized = String(phase || "")
    .trim()
    .toUpperCase();
  if (!normalized) return "CALM";
  if (PHASE_VISUAL_PRESETS[normalized]) return normalized;
  if (LEGACY_STATUS_TO_PHASE[normalized]) return LEGACY_STATUS_TO_PHASE[normalized];
  return "CALM";
}

export function phaseFromLegacyStatus(status) {
  return normalizePhase(status);
}

export function phaseSeverity(phase) {
  const normalized = normalizePhase(phase);
  const index = PHASE_ORDER.indexOf(normalized);
  return index < 0 ? 0 : index;
}

function resolvePhaseColorBySeverity(severity) {
  if (severity >= phaseSeverity("CRITICAL")) return "#ff5f5f";
  if (severity >= phaseSeverity("CORRODING")) return "#d7875b";
  if (severity >= phaseSeverity("OVERLOADED")) return "#ffbe57";
  if (severity >= phaseSeverity("ACTIVE")) return "#7effff";
  if (severity >= phaseSeverity("DORMANT")) return "#94aeca";
  return "#64d9ff";
}

export function resolvePlanetPhaseVisual({ phase, isConverging, corrosionLevel, crackIntensity, hue, saturation }) {
  const normalizedPhase = isConverging ? "CONVERGING" : normalizePhase(phase);
  const preset = PHASE_VISUAL_PRESETS[normalizedPhase] || PHASE_VISUAL_PRESETS.CALM;
  const corrosion = clamp(Number(corrosionLevel) || 0, 0, 1);
  const cracks = clamp(Number(crackIntensity) || 0, 0, 1);
  const safeHue = clamp(Number(hue) || 0.58, 0, 1);
  const safeSaturation = clamp(Number(saturation) || 0.66, 0, 1);
  const hslBase = new THREE.Color().setHSL(safeHue, safeSaturation, 0.58);
  const tint = new THREE.Color(preset.tint).lerp(hslBase, 0.42 + corrosion * 0.16).getStyle();
  const emissive = new THREE.Color(preset.emissive).lerp(hslBase, 0.3).getStyle();
  const rim = new THREE.Color(preset.rim).lerp(hslBase, 0.24).getStyle();
  const aura = new THREE.Color(preset.aura).lerp(hslBase, 0.18).getStyle();

  return {
    phase: normalizedPhase,
    labelText: PHASE_DISPLAY_NAMES[normalizedPhase] || normalizedPhase,
    tint,
    emissive,
    rim,
    aura,
    label: preset.label,
    roughness: clamp(preset.roughness + corrosion * 0.22 + cracks * 0.08, 0.16, 0.85),
    metalness: clamp(preset.metalness - corrosion * 0.2, 0.06, 0.72),
    spinMultiplier: preset.spinMultiplier,
    pulseMultiplier: preset.pulseMultiplier,
    corrosionOverlayOpacity: clamp(0.05 + corrosion * 0.34, 0.05, 0.42),
    corrosionOverlayColor: corrosion >= 0.55 ? "#b05d3a" : "#8f6a49",
    crackOpacity: clamp(cracks * 0.86 + corrosion * 0.2, 0, 0.92),
    crackColor: normalizedPhase === "CRITICAL" ? "#ff9b7a" : "#cc8a66",
  };
}

export function resolveMoonPhaseVisual({ phase, isConverging, corrosionLevel, crackIntensity, hue, saturation }) {
  const base = resolvePlanetPhaseVisual({
    phase,
    isConverging,
    corrosionLevel,
    crackIntensity,
    hue,
    saturation,
  });
  return {
    ...base,
    roughness: clamp(base.roughness + 0.05, 0.22, 0.9),
    metalness: clamp(base.metalness - 0.08, 0.05, 0.5),
    crackOpacity: clamp(base.crackOpacity * 0.7, 0, 0.78),
    spinMultiplier: clamp(base.spinMultiplier * 1.08, 0.6, 1.8),
    pulseMultiplier: clamp(base.pulseMultiplier * 1.05, 0.6, 2),
  };
}

export function resolveLinkPhaseVisual({
  sourcePhase,
  targetPhase,
  sourceIsConverging = false,
  targetIsConverging = false,
  sourceCorrosionLevel = 0,
  targetCorrosionLevel = 0,
  flow = 0,
  stress = 0,
}) {
  const source = normalizePhase(sourcePhase);
  const target = normalizePhase(targetPhase);
  const isConverging = sourceIsConverging || targetIsConverging;
  const sourceSeverity = phaseSeverity(source);
  const targetSeverity = phaseSeverity(target);
  const dominantSeverity = Math.max(sourceSeverity, targetSeverity);
  const corrosion = clamp(Math.max(Number(sourceCorrosionLevel) || 0, Number(targetCorrosionLevel) || 0), 0, 1);
  const safeFlow = clamp(Number(flow) || 0, 0, 1);
  const safeStress = clamp(Number(stress) || 0, 0, 1);
  const baseColor = resolvePhaseColorBySeverity(dominantSeverity);
  const dominantColor = isConverging ? "#e0f8ff" : baseColor;
  const pulseColor = new THREE.Color(dominantColor).lerp(new THREE.Color("#ffffff"), isConverging ? 0.5 : 0.28).getStyle();
  const dominantPhase = PHASE_ORDER[dominantSeverity] || "CALM";

  return {
    dominantPhase,
    labelText: isConverging ? PHASE_DISPLAY_NAMES.CONVERGING : PHASE_DISPLAY_NAMES[dominantPhase] || dominantPhase,
    color: dominantColor,
    pulseColor,
    severity: dominantSeverity,
    widthMultiplier: clamp(1 + safeFlow * 0.18 + dominantSeverity * 0.08 + corrosion * 0.08, 0.9, 1.7),
    speedMultiplier: clamp(1 + safeFlow * 0.45 + safeStress * 0.22 + (dominantSeverity >= 5 ? 0.2 : 0) + (isConverging ? 0.5 : 0), 0.82, 3.0),
    opacityMultiplier: clamp(1 + safeFlow * 0.08 + dominantSeverity * 0.05 - corrosion * 0.04, 0.86, 1.3),
    pulseMultiplier: clamp(1 + safeFlow * 0.35 + safeStress * 0.24 + corrosion * 0.1 + (isConverging ? 0.8 : 0), 0.9, 3.5),
    sourcePhase: source,
    targetPhase: target,
  };
}
