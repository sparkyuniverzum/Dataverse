import { clamp } from "./sceneMath";
import { signatureColorFromSeed } from "./sceneStyling";

export function buildConstellationClusters(tableNodes) {
  const buckets = new Map();
  (Array.isArray(tableNodes) ? tableNodes : []).forEach((node) => {
    const name = String(node?.entityName || "Uncategorized").trim() || "Uncategorized";
    if (!buckets.has(name)) {
      buckets.set(name, []);
    }
    buckets.get(name).push(node);
  });

  return [...buckets.entries()]
    .map(([name, nodes]) => {
      const validNodes = nodes.filter((node) => Array.isArray(node?.position) && node.position.length >= 3);
      if (!validNodes.length) return null;

      const center = validNodes.reduce(
        (acc, node) => {
          acc[0] += Number(node.position[0] || 0);
          acc[1] += Number(node.position[1] || 0);
          acc[2] += Number(node.position[2] || 0);
          return acc;
        },
        [0, 0, 0]
      );
      center[0] /= validNodes.length;
      center[1] /= validNodes.length;
      center[2] /= validNodes.length;

      let maxDistance = 0;
      validNodes.forEach((node) => {
        const dx = Number(node.position[0] || 0) - center[0];
        const dy = Number(node.position[1] || 0) - center[1];
        const dz = Number(node.position[2] || 0) - center[2];
        const radial = Math.sqrt(dx * dx + dy * dy + dz * dz) + Number(node.radius || 0);
        maxDistance = Math.max(maxDistance, radial);
      });

      const radius = clamp(maxDistance + 26, 52, 360);
      const base = signatureColorFromSeed(`constellation:${name}`);
      const glow = base.clone().offsetHSL(0, -0.08, 0.03).getStyle();
      const rim = base.clone().offsetHSL(0, 0.06, 0.14).getStyle();
      return {
        id: `cluster:${name}`,
        name,
        planetCount: validNodes.length,
        center,
        radius,
        glow,
        rim,
      };
    })
    .filter(Boolean)
    .sort((a, b) => a.name.localeCompare(b.name));
}
