function phaseLabel(value) {
  const phase = String(value || "")
    .trim()
    .toUpperCase();
  if (phase === "ACTIVE") return "aktivni";
  if (phase === "OVERLOADED") return "pretizena";
  if (phase === "DORMANT") return "uspana";
  if (phase === "CORRODING") return "koroduje";
  if (phase === "CRITICAL") return "kriticka";
  if (phase === "CALM") return "klidna";
  return "neznama";
}

export function resolvePlanetTopologyLabels(item, state) {
  const base = {
    title: String(item?.label || "Planeta"),
    subtitle: String(item?.subtitle || ""),
    detail: `Stav: ${phaseLabel(item?.statusLabel)} / kvalita ${Math.max(0, Number(item?.qualityScore) || 0)}%`,
  };

  if (state?.approached) {
    return {
      ...base,
      detail: `Priblizeni aktivni / ${phaseLabel(item?.statusLabel)} / ${Math.max(0, Number(item?.rows) || 0)} radku`,
    };
  }

  if (state?.selected) {
    return {
      ...base,
      detail: `Vybrana planeta / ${phaseLabel(item?.statusLabel)} / schema ${Math.max(0, Number(item?.complexity) || 0)}`,
    };
  }

  return base;
}
