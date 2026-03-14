function formatCount(value) {
  const numeric = Number(value);
  if (!Number.isFinite(numeric)) return "0";
  return String(Math.max(0, Math.round(numeric)));
}

function formatFrame(value) {
  const numeric = Number(value);
  if (!Number.isFinite(numeric)) return "0.0";
  return numeric.toFixed(1);
}

export const FORCED_WARNING_DIAGNOSTICS = Object.freeze({
  frameMs: 24.3,
  programs: 11,
  memory: {
    geometries: 31,
    textures: 14,
  },
  render: {
    calls: 8,
  },
});

export function resolveLabDiagnosticsModel({ diagnostics = null, viewMode = "cinematic", forceWarning = false } = {}) {
  const safeDiagnostics = forceWarning ? FORCED_WARNING_DIAGNOSTICS : diagnostics || {};
  const memory = safeDiagnostics.memory || {};
  const render = safeDiagnostics.render || {};
  const warnings = [];

  if (Number(memory.geometries) > 24) warnings.push("Rust poctu geometrii");
  if (Number(memory.textures) > 12) warnings.push("Rust poctu textur");
  if (Number(safeDiagnostics.programs) > 8) warnings.push("Drift poctu programu");
  if (Number(safeDiagnostics.frameMs) > 20) warnings.push("Riziko frame budgetu");
  if (forceWarning) warnings.unshift("Forced warning pro screenshot gate");

  return {
    viewMode,
    forceWarning,
    warnings,
    rows: [
      { key: "frame", label: "Frame", value: `${formatFrame(safeDiagnostics.frameMs)} ms` },
      { key: "calls", label: "Calls", value: formatCount(render.calls) },
      { key: "geometries", label: "Geometrie", value: formatCount(memory.geometries) },
      { key: "textures", label: "Textury", value: formatCount(memory.textures) },
      { key: "programs", label: "Programy", value: formatCount(safeDiagnostics.programs) },
    ],
  };
}
