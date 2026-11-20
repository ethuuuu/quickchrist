// The walking network: load, validate, save, and edit. Pure.
// In memory: { nodes: Map, edges: Map, places: Map, adj: Map<nodeId, [{ to, edgeId }]> }
import { haversineM, polylineLengthM, simplifyRDP } from './geo.js';

export const NODE_KINDS = ['junction', 'place'];
export const PLACE_CATEGORIES = ['academic', 'food', 'hostel', 'sports', 'admin', 'transport', 'other'];
export const CATEGORY_LABELS = {
  academic: 'Academic block',
  food: 'Food and café',
  hostel: 'Hostel',
  sports: 'Sports',
  admin: 'Office',
  transport: 'Bus, metro or gate',
  other: 'Other',
};

const isNum = (x) => typeof x === 'number' && Number.isFinite(x);
const isLat = (x) => isNum(x) && x >= -90 && x <= 90;
const isLon = (x) => isNum(x) && x >= -180 && x <= 180;
const isPoint = (p) => Array.isArray(p) && isLat(p[0]) && isLon(p[1]);
const round = (x, decimals) => {
  const f = 10 ** decimals;
  return Math.round(x * f) / f;
};

let idCounter = 0;
export function newId(prefix) {
  idCounter = (idCounter + 1) % 1679616;
  return `${prefix}_${Date.now().toString(36)}${idCounter.toString(36)}${Math.random().toString(36).slice(2, 6)}`;
}

export function emptyGraph() {
  return { nodes: new Map(), edges: new Map(), places: new Map(), adj: new Map() };
}

// Builds an in-memory graph from parsed graph.json. Broken items are skipped
// and described in `errors`, so one bad line never breaks the whole app.
export function loadGraph(json) {
  const g = emptyGraph();
  const errors = [];
  if (!json || json.version !== 1) {
    errors.push('version must be 1');
    return { graph: g, errors };
  }

  for (const n of json.nodes ?? []) {
    if (typeof n?.id !== 'string' || g.nodes.has(n.id)) { errors.push(`node: bad or duplicate id ${n?.id}`); continue; }
    if (!isLat(n.lat) || !isLon(n.lon)) { errors.push(`node ${n.id}: bad coordinates`); continue; }
    if (!NODE_KINDS.includes(n.kind)) { errors.push(`node ${n.id}: bad kind`); continue; }
    g.nodes.set(n.id, { id: n.id, lat: n.lat, lon: n.lon, ele: isNum(n.ele) ? n.ele : null, kind: n.kind });
  }

  for (const e of json.edges ?? []) {
    if (typeof e?.id !== 'string' || g.edges.has(e.id)) { errors.push(`edge: bad or duplicate id ${e?.id}`); continue; }
    if (!g.nodes.has(e.a) || !g.nodes.has(e.b) || e.a === e.b) { errors.push(`edge ${e.id}: bad end nodes`); continue; }
    if (!Array.isArray(e.points) || e.points.length < 2 || !e.points.every(isPoint)) { errors.push(`edge ${e.id}: bad points`); continue; }
    const points = e.points.map((p) => [p[0], p[1], isNum(p[2]) ? p[2] : null]);
    const length_m = isNum(e.length_m) && e.length_m > 0 ? e.length_m : polylineLengthM(points);
    const tags = { stairs: e.tags?.stairs === true, steep: e.tags?.steep === true };
    g.edges.set(e.id, { id: e.id, a: e.a, b: e.b, points, length_m, tags });
  }

  for (const p of json.places ?? []) {
    if (typeof p?.id !== 'string' || g.places.has(p.id)) { errors.push(`place: bad or duplicate id ${p?.id}`); continue; }
    if (typeof p.name !== 'string' || p.name.trim() === '') { errors.push(`place ${p.id}: missing name`); continue; }
    if (!g.nodes.has(p.node)) { errors.push(`place ${p.id}: unknown node`); continue; }
    g.places.set(p.id, {
      id: p.id,
      name: p.name.trim(),
      node: p.node,
      category: PLACE_CATEGORIES.includes(p.category) ? p.category : 'other',
      aliases: Array.isArray(p.aliases) ? p.aliases.filter((a) => typeof a === 'string' && a.trim() !== '') : [],
      outside: p.outside === true,
    });
  }

  rebuildAdjacency(g);
  return { graph: g, errors };
}

// Plain object ready for JSON.stringify (the graph.json format).
export function graphToJSON(g) {
  return {
    version: 1,
    nodes: [...g.nodes.values()],
    edges: [...g.edges.values()],
    places: [...g.places.values()],
  };
}

function linkEdge(g, edge) {
  g.adj.get(edge.a).push({ to: edge.b, edgeId: edge.id });
  g.adj.get(edge.b).push({ to: edge.a, edgeId: edge.id });
}

export function rebuildAdjacency(g) {
  g.adj = new Map();
  for (const id of g.nodes.keys()) g.adj.set(id, []);
  for (const edge of g.edges.values()) linkEdge(g, edge);
}

// Nearest node within maxM metres, or null.
export function nearestNode(g, lat, lon, maxM = Infinity) {
  let best = null;
  let bestDist = maxM;
  for (const n of g.nodes.values()) {
    const d = haversineM(lat, lon, n.lat, n.lon);
    if (d <= bestDist) {
      best = n;
      bestDist = d;
    }
  }
  return best ? { node: best, distM: bestDist } : null;
}

// Reuses a node within snapRadiusM, otherwise creates one.
// If kind is 'place', a reused node becomes a place node.
export function snapOrCreateNode(g, lat, lon, ele, kind, snapRadiusM) {
  const hit = nearestNode(g, lat, lon, snapRadiusM);
  if (hit) {
    if (kind === 'place') hit.node.kind = 'place';
    return { node: hit.node, created: false };
  }
  const node = {
    id: newId('n'),
    lat: round(lat, 6),
    lon: round(lon, 6),
    ele: isNum(ele) ? round(ele, 1) : null,
    kind,
  };
  g.nodes.set(node.id, node);
  g.adj.set(node.id, []);
  return { node, created: true };
}

// Turns recorded fixes between two nodes into a saved edge.
// cfg needs RDP_EPSILON_M and MIN_EDGE_M.
// Returns { ok: true, edge, parallel } or { ok: false, reason }.
export function addEdgeFromFixes(g, fromId, toId, fixes, tags, cfg) {
  if (fromId === toId) return { ok: false, reason: 'same-node' };
  const a = g.nodes.get(fromId);
  const b = g.nodes.get(toId);
  if (!a || !b) return { ok: false, reason: 'missing-node' };

  const raw = [
    [a.lat, a.lon, a.ele],
    ...fixes.map((f) => [f.lat, f.lon, isNum(f.alt) ? f.alt : null]),
    [b.lat, b.lon, b.ele],
  ];
  const points = simplifyRDP(raw, cfg.RDP_EPSILON_M).map((p) => [
    round(p[0], 6),
    round(p[1], 6),
    isNum(p[2]) ? round(p[2], 1) : null,
  ]);
  const length_m = round(polylineLengthM(points), 1);
  if (length_m < cfg.MIN_EDGE_M) return { ok: false, reason: 'too-short' };

  const parallel = g.adj.get(fromId).some((x) => x.to === toId);
  const edge = {
    id: newId('e'),
    a: fromId,
    b: toId,
    points,
    length_m,
    tags: { stairs: tags?.stairs === true, steep: tags?.steep === true },
  };
  g.edges.set(edge.id, edge);
  linkEdge(g, edge);
  return { ok: true, edge, parallel };
}

export function addPlace(g, nodeId, name, category, outside) {
  const place = {
    id: newId('p'),
    name: String(name).trim(),
    node: nodeId,
    category: PLACE_CATEGORIES.includes(category) ? category : 'other',
    aliases: [],
    outside: outside === true,
  };
  g.places.set(place.id, place);
  const node = g.nodes.get(nodeId);
  if (node) node.kind = 'place';
  return place;
}
