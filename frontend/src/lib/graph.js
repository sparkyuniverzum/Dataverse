/**
 * Checks if adding a new edge from sourceId to targetId creates a cycle in a directed graph.
 * @param {string} sourceId The ID of the source node for the new edge.
 * @param {string} targetId The ID of the target node for the new edge.
 * @param {Array<[string, string]>} edges An array of existing edges, where each edge is a [from, to] pair.
 * @returns {boolean} True if a cycle is detected, false otherwise.
 */
export function isCyclic(sourceId, targetId, edges) {
  if (!sourceId || !targetId) return false;
  if (sourceId === targetId) return true;

  const adj = new Map();
  // Build adjacency list from existing edges
  for (const [from, to] of edges) {
    if (!adj.has(from)) adj.set(from, []);
    adj.get(from).push(to);
  }

  // We want to see if we can get from the potential *target* back to the potential *source*
  // through the existing graph. If a path exists, adding the new edge (source -> target)
  // would close the loop and create a cycle.
  const queue = [targetId];
  const visited = new Set([targetId]);

  while (queue.length > 0) {
    const currentNode = queue.shift();

    if (currentNode === sourceId) {
      return true; // Cycle detected! A path exists from target back to source.
    }

    const neighbors = adj.get(currentNode) || [];
    for (const neighbor of neighbors) {
      if (!visited.has(neighbor)) {
        visited.add(neighbor);
        queue.push(neighbor);
      }
    }
  }

  return false;
}
