function toFiniteNumber(value, fallback = 0) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
}

function clamp(value, min, max) {
  return Math.max(min, Math.min(max, value));
}

export function resolveStarCoreExteriorVisualModel({ model = null, exteriorState = null } = {}) {
  const haloIntensity = clamp(toFiniteNumber(model?.visual?.haloIntensity, 0.42), 0.2, 0.92);
  const orbitOpacity = clamp(toFiniteNumber(model?.visual?.orbitOpacity, 0.52), 0.22, 0.92);
  const runtimeTempo = clamp(toFiniteNumber(model?.visual?.runtimeTempo, 0.4), 0, 1);
  const pulseIntensity = clamp(toFiniteNumber(model?.visual?.pulseIntensity, 0.3), 0, 1);
  const domainDensity = clamp(toFiniteNumber(model?.visual?.domainDensity, 0.24), 0, 1);
  const isApproached = Boolean(exteriorState?.approached);
  const isSelected = Boolean(exteriorState?.selected);

  if (exteriorState?.unavailable) {
    return {
      governanceRingColor: "#ffb36a",
      governanceRingOpacity: 0.52,
      secondaryRingColor: "#ffd1a6",
      secondaryRingOpacity: 0.3,
      shellOpacity: 0.12,
      cageOpacity: 0.26,
      orbitCueOpacity: 0,
      tacticalGridIntensity: 0.18,
      labelColor: "#ffe1bb",
      descriptorColor: "#ffd29a",
      pulseScale: 0.035,
      pulseSpeed: 0.7,
      bloomIntensity: 1.1,
      orbitRadiusPrimary: 3.15,
      orbitRadiusSecondary: 2.55,
      starEmissiveIntensity: isApproached ? 1.32 : isSelected ? 1.18 : 1.04,
      runtimeArcOpacity: 0.18,
      domainShellOpacity: 0.1,
    };
  }

  if (exteriorState?.loading || exteriorState?.lockVisualState === "stabilizing") {
    return {
      governanceRingColor: "#9de7ff",
      governanceRingOpacity: 0.58,
      secondaryRingColor: "#d1f4ff",
      secondaryRingOpacity: 0.36,
      shellOpacity: 0.14,
      cageOpacity: 0.3,
      orbitCueOpacity: 0.14,
      tacticalGridIntensity: 0.22,
      labelColor: "#e6fbff",
      descriptorColor: "#bcefff",
      pulseScale: 0.055 + pulseIntensity * 0.02,
      pulseSpeed: 0.92 + runtimeTempo * 0.25,
      bloomIntensity: 1.22,
      orbitRadiusPrimary: 3.24,
      orbitRadiusSecondary: 2.7,
      starEmissiveIntensity: isApproached ? 1.44 : isSelected ? 1.3 : 1.14,
      runtimeArcOpacity: 0.22 + runtimeTempo * 0.14,
      domainShellOpacity: 0.12 + domainDensity * 0.08,
    };
  }

  if (exteriorState?.unlocked) {
    return {
      governanceRingColor: "#ffbf76",
      governanceRingOpacity: 0.82,
      secondaryRingColor: "#ffdca7",
      secondaryRingOpacity: 0.48,
      shellOpacity: 0.17,
      cageOpacity: 0.4,
      orbitCueOpacity: 0.16,
      tacticalGridIntensity: 0.24,
      labelColor: "#fff0cf",
      descriptorColor: "#ffd398",
      pulseScale: 0.08 + pulseIntensity * 0.04,
      pulseSpeed: 1.14 + runtimeTempo * 0.36,
      bloomIntensity: 1.42,
      orbitRadiusPrimary: 3.5,
      orbitRadiusSecondary: 2.82,
      starEmissiveIntensity: isApproached ? 1.72 : isSelected ? 1.58 : 1.38,
      runtimeArcOpacity: 0.28 + runtimeTempo * 0.2,
      domainShellOpacity: 0.16 + domainDensity * 0.1,
    };
  }

  return {
    governanceRingColor: "#7ee8ff",
    governanceRingOpacity: 0.78,
    secondaryRingColor: "#c9f7ff",
    secondaryRingOpacity: 0.44,
    shellOpacity: 0.16,
    cageOpacity: 0.38,
    orbitCueOpacity: clamp(orbitOpacity * 0.9, 0.28, 0.84),
    tacticalGridIntensity: 0.24 + haloIntensity * 0.18,
    labelColor: "#eefcff",
    descriptorColor: "#9aefff",
    pulseScale: 0.04 + pulseIntensity * 0.025,
    pulseSpeed: 0.84 + runtimeTempo * 0.24,
    bloomIntensity: 1.18 + haloIntensity * 0.26,
    orbitRadiusPrimary: 3.3,
    orbitRadiusSecondary: 2.76,
    starEmissiveIntensity: isApproached ? 1.62 : isSelected ? 1.46 : 1.3,
    runtimeArcOpacity: 0.18 + runtimeTempo * 0.14,
    domainShellOpacity: 0.12 + domainDensity * 0.1,
  };
}
