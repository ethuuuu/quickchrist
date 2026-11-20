// Dijkstra shortest path with a binary heap and lazy deletion. Pure.
import { MinHeap } from './heap.js';
import { edgeCost } from './cost.js';

// Returns null when no path exists, otherwise
// { nodeIds, steps: [{ edgeId, from, to }], cost, lengthM }.
export function shortestPath(graph, startId, goalId, profile = 'shortest') {
  if (!graph.nodes.has(startId) || !graph.nodes.has(goalId)) return null;
  if (startId === goalId) return { nodeIds: [startId], steps: [], cost: 0, lengthM: 0 };

  const dist = new Map([[startId, 0]]);
  const prev = new Map(); // nodeId -> { from, edgeId }
  const done = new Set();
  const heap = new MinHeap();
  heap.push(0, startId);

  while (heap.size > 0) {
    const { key: d, val: u } = heap.pop();
    if (done.has(u)) continue; // stale heap entry
    done.add(u);
    if (u === goalId) break;

    for (const { to, edgeId } of graph.adj.get(u) ?? []) {
      if (done.has(to)) continue;
      const c = edgeCost(graph.edges.get(edgeId), u, profile);
      if (!Number.isFinite(c) || c < 0) continue; // Infinity means "never use this edge"
      const nd = d + c;
      const old = dist.get(to);
      if (old === undefined || nd < old) {
        dist.set(to, nd);
        prev.set(to, { from: u, edgeId });
        heap.push(nd, to);
      }
    }
  }

  if (!done.has(goalId)) return null;

  const steps = [];
  let cur = goalId;
  while (cur !== startId) {
    const p = prev.get(cur);
    steps.push({ edgeId: p.edgeId, from: p.from, to: cur });
    cur = p.from;
  }
  steps.reverse();

  let lengthM = 0;
  for (const s of steps) lengthM += graph.edges.get(s.edgeId).length_m;

  return { nodeIds: [startId, ...steps.map((s) => s.to)], steps, cost: dist.get(goalId), lengthM };
}

// Joins the edges of a route into one [lat, lon] list, in walking order.
export function routePolyline(graph, steps) {
  const out = [];
  for (const s of steps) {
    const edge = graph.edges.get(s.edgeId);
    const pts = s.from === edge.a ? edge.points : [...edge.points].reverse();
    // Skip the first point of every edge after the first: it equals the previous edge's last point.
    for (let i = out.length > 0 ? 1 : 0; i < pts.length; i++) out.push([pts[i][0], pts[i][1]]);
  }
  return out;
}
