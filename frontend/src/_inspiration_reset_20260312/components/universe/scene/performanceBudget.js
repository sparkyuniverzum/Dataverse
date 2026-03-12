function toFiniteInt(value) {
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) return 0;
  return Math.max(0, Math.floor(parsed));
}

function round(value, precision = 3) {
  const factor = 10 ** precision;
  return Math.round(Number(value) * factor) / factor;
}

export const PREVIEW_PERFORMANCE_BASELINE = Object.freeze({
  frameBudgetMs: 16.7,
  maxNodes: 1400,
  maxLinks: 2600,
  maxWorkUnits: 1850,
  maxFrameP95Ms: 34,
});

export function estimatePreviewWorkUnits({
  planetCount = 0,
  moonCount = 0,
  tableLinkCount = 0,
  moonLinkCount = 0,
  reducedMotion = false,
} = {}) {
  const planets = toFiniteInt(planetCount);
  const moons = toFiniteInt(moonCount);
  const tableLinks = toFiniteInt(tableLinkCount);
  const moonLinks = toFiniteInt(moonLinkCount);

  const nodeUnits = planets * 2.2 + moons * 1.1;
  const linkUnits = tableLinks * 0.8 + moonLinks * 1.05;
  const motionMultiplier = reducedMotion ? 0.68 : 1;
  const postFxMultiplier = reducedMotion ? 0.9 : 1;
  const workUnits = (nodeUnits + linkUnits) * motionMultiplier * postFxMultiplier;
  const estimatedFrameMs = 4.2 + workUnits * 0.0064;

  return {
    planets,
    moons,
    tableLinks,
    moonLinks,
    reducedMotion: Boolean(reducedMotion),
    nodeUnits: round(nodeUnits),
    linkUnits: round(linkUnits),
    workUnits: round(workUnits),
    estimatedFrameMs: round(estimatedFrameMs, 2),
  };
}

export function evaluatePreviewPerformanceBudget(
  input,
  {
    frameBudgetMs = PREVIEW_PERFORMANCE_BASELINE.frameBudgetMs,
    maxNodes = PREVIEW_PERFORMANCE_BASELINE.maxNodes,
    maxLinks = PREVIEW_PERFORMANCE_BASELINE.maxLinks,
    maxWorkUnits = PREVIEW_PERFORMANCE_BASELINE.maxWorkUnits,
    maxFrameP95Ms = PREVIEW_PERFORMANCE_BASELINE.maxFrameP95Ms,
    observedFrameP95Ms = null,
  } = {}
) {
  const estimate = estimatePreviewWorkUnits(input);
  const totalNodes = estimate.planets + estimate.moons;
  const totalLinks = estimate.tableLinks + estimate.moonLinks;
  const p95 = Number.isFinite(Number(observedFrameP95Ms)) ? Number(observedFrameP95Ms) : null;

  const violations = [];
  if (totalNodes > maxNodes) {
    violations.push(`nodes:${totalNodes}>${maxNodes}`);
  }
  if (totalLinks > maxLinks) {
    violations.push(`links:${totalLinks}>${maxLinks}`);
  }
  if (estimate.workUnits > maxWorkUnits) {
    violations.push(`work_units:${estimate.workUnits}>${maxWorkUnits}`);
  }
  if (estimate.estimatedFrameMs > frameBudgetMs) {
    violations.push(`estimated_frame_ms:${estimate.estimatedFrameMs}>${frameBudgetMs}`);
  }
  if (p95 !== null && p95 > maxFrameP95Ms) {
    violations.push(`observed_frame_p95_ms:${round(p95, 2)}>${maxFrameP95Ms}`);
  }

  return {
    pass: violations.length === 0,
    violations,
    estimate,
    limits: {
      frameBudgetMs,
      maxNodes,
      maxLinks,
      maxWorkUnits,
      maxFrameP95Ms,
    },
    observedFrameP95Ms: p95,
  };
}
