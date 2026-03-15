export function clamp(value, min, max) {
  return Math.max(min, Math.min(max, value));
}

export function setBodyCursor(cursor) {
  if (typeof document === "undefined" || !document.body) return;
  document.body.style.cursor = cursor;
}

export function curvePoints(start, end, arc = 0.24, segments = 40) {
  const control = [
    (start[0] + end[0]) * 0.5,
    (start[1] + end[1]) * 0.5 + arc * Math.max(16, Math.abs(start[0] - end[0]) + Math.abs(start[2] - end[2])),
    (start[2] + end[2]) * 0.5,
  ];
  const points = [];
  for (let i = 0; i <= segments; i += 1) {
    const t = i / segments;
    const inv = 1 - t;
    points.push([
      inv * inv * start[0] + 2 * inv * t * control[0] + t * t * end[0],
      inv * inv * start[1] + 2 * inv * t * control[1] + t * t * end[1],
      inv * inv * start[2] + 2 * inv * t * control[2] + t * t * end[2],
    ]);
  }
  return points;
}

export function hashText(input) {
  const text = String(input || "");
  let hash = 2166136261;
  for (let i = 0; i < text.length; i += 1) {
    hash ^= text.charCodeAt(i);
    hash = Math.imul(hash, 16777619);
  }
  return hash >>> 0;
}

export function createRng(seedText) {
  let seed = hashText(seedText) || 1;
  return () => {
    seed += 0x6d2b79f5;
    let t = seed;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export function samplePath(points, t) {
  const safe = Array.isArray(points) ? points : [];
  if (!safe.length) return [0, 0, 0];
  if (safe.length === 1) return safe[0];
  const total = safe.length - 1;
  const clampedT = Math.max(0, Math.min(0.9999, t));
  const scaled = clampedT * total;
  const i = Math.floor(scaled);
  const frac = scaled - i;
  const p0 = safe[i];
  const p1 = safe[Math.min(i + 1, total)];
  return [p0[0] + (p1[0] - p0[0]) * frac, p0[1] + (p1[1] - p0[1]) * frac, p0[2] + (p1[2] - p0[2]) * frac];
}
