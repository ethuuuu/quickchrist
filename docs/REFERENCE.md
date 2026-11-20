# REFERENCE.md — code to copy

Each section is `## R<number> — <file path>`. Copy ONLY the code between the
``` fence lines into that file. Do not copy the fences or the heading.
Do not change the code. If you think something is wrong, write it in
PROGRESS.md under "Questions for the human" instead of changing it.

---

## R1 — package.json

Copy this, THEN run the install commands from AGENTS.md §3 (they add the
"dependencies" and "devDependencies" sections for you).

```json
{
  "name": "campus-route",
  "private": true,
  "version": "0.1.0",
  "type": "module",
  "engines": { "node": ">=20" },
  "scripts": {
    "dev": "vite",
    "build": "vite build",
    "preview": "vite preview",
    "test": "node --test"
  }
}
```

---

## R2 — vite.config.js

```js
import { defineConfig } from 'vite';
import basicSsl from '@vitejs/plugin-basic-ssl';

// basicSsl gives the dev server HTTPS. Phones only allow GPS on HTTPS pages.
// host: true makes the server reachable from the phone on the same network.
// base: './' makes the build work from any folder (for example GitHub Pages).
export default defineConfig({
  base: './',
  plugins: [basicSsl()],
  server: { host: true, port: 5173 },
  preview: { host: true, port: 4173 },
  build: {
    target: 'es2020',
    sourcemap: false,
    cssCodeSplit: false,
  },
});
```

---

## R3 — .gitignore

```
node_modules/
dist/
.DS_Store
*.log
.env*
```

---

## R4 — PROGRESS.md

```markdown
Current phase: 0
Status: not started

## Completed phases
(none yet)

## Notes for the next session
-

## Questions for the human
-
```

---

## R5 — src/config.js

```js
// Every tunable number lives here. Never hard-code these values elsewhere.
export const CONFIG = {
  // HUMAN FILLS IN: [lat, lon] of the campus main gate. Leave null until given.
  // Agents must never guess this value.
  DEFAULT_CENTER: null,
  DEFAULT_ZOOM: 17,
  MAX_ZOOM: 19,

  TILES: {
    light: {
      url: 'https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}.png',
      subdomains: 'abcd',
      maxNativeZoom: 19,
      attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors &copy; <a href="https://carto.com/attributions">CARTO</a>',
    },
    dark: {
      url: 'https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}.png',
      subdomains: 'abcd',
      maxNativeZoom: 19,
      attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors &copy; <a href="https://carto.com/attributions">CARTO</a>',
    },
  },

  // Average walking speed in metres per second (about 4.7 km/h).
  WALK_SPEED_MPS: 1.3,

  GPS: {
    ACCURACY_MAX_M: 20,      // fixes worse than this are ignored while recording
    NODE_ACCURACY_MAX_M: 12, // marking a junction or place needs at least this accuracy
    MIN_STEP_M: 3,           // ignore fixes closer than this to the last kept fix
    MAX_SPEED_MPS: 4,        // ignore jumps faster than a brisk walk
    TIMEOUT_MS: 15000,
  },

  GRAPH: {
    SNAP_RADIUS_M: 10,  // a new junction this close to an old one reuses the old one
    RDP_EPSILON_M: 2,   // path simplification tolerance
    MIN_EDGE_M: 3,      // shorter paths are not saved
  },

  ROUTE: {
    START_SNAP_MAX_M: 80, // "Your location" must be this close to a mapped point
  },

  UNDO_LIMIT: 30,

  STORAGE: {
    GRAPH: 'cr.workingGraph.v1',
    RECENT: 'cr.recent.v1',
  },
};
```

---

## R6 — src/geo.js

```js
// Geometry helpers. Pure: no browser APIs.
// A "point" is an array [lat, lon] or [lat, lon, ele].

const EARTH_RADIUS_M = 6371008.8;
const toRad = (deg) => (deg * Math.PI) / 180;

// Great-circle distance in metres between two lat/lon positions.
export function haversineM(lat1, lon1, lat2, lon2) {
  const dLat = toRad(lat2 - lat1);
  const dLon = toRad(lon2 - lon1);
  const s =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLon / 2) ** 2;
  return 2 * EARTH_RADIUS_M * Math.asin(Math.min(1, Math.sqrt(s)));
}

// Total length in metres of a list of points.
export function polylineLengthM(points) {
  let total = 0;
  for (let i = 1; i < points.length; i++) {
    total += haversineM(points[i - 1][0], points[i - 1][1], points[i][0], points[i][1]);
  }
  return total;
}

// Flat x/y in metres around (lat0, lon0). Accurate enough inside a campus.
export function makeProjector(lat0, lon0) {
  const kx = Math.cos(toRad(lat0)) * 111320;
  const ky = 110540;
  return (lat, lon) => [(lon - lon0) * kx, (lat - lat0) * ky];
}

// Distance from point p to segment a-b, all as [x, y] in metres.
function pointSegmentDistance(p, a, b) {
  const dx = b[0] - a[0];
  const dy = b[1] - a[1];
  const len2 = dx * dx + dy * dy;
  let t = len2 === 0 ? 0 : ((p[0] - a[0]) * dx + (p[1] - a[1]) * dy) / len2;
  t = Math.max(0, Math.min(1, t));
  return Math.hypot(p[0] - (a[0] + t * dx), p[1] - (a[1] + t * dy));
}

// Ramer–Douglas–Peucker simplification. Removes points that lie within
// epsilonM metres of the line between their neighbours. Always keeps the
// first and last point. Uses a stack instead of recursion (safe for long walks).
export function simplifyRDP(points, epsilonM) {
  if (points.length <= 2) return points.slice();
  const project = makeProjector(points[0][0], points[0][1]);
  const xy = points.map((p) => project(p[0], p[1]));
  const keep = new Uint8Array(points.length);
  keep[0] = 1;
  keep[points.length - 1] = 1;
  const stack = [[0, points.length - 1]];
  while (stack.length > 0) {
    const [start, end] = stack.pop();
    let maxDist = -1;
    let index = -1;
    for (let i = start + 1; i < end; i++) {
      const d = pointSegmentDistance(xy[i], xy[start], xy[end]);
      if (d > maxDist) {
        maxDist = d;
        index = i;
      }
    }
    if (maxDist > epsilonM) {
      keep[index] = 1;
      stack.push([start, index], [index, end]);
    }
  }
  return points.filter((_, i) => keep[i] === 1);
}
```

---

## R7 — src/heap.js

```js
// Binary min-heap. push(key, val) adds; pop() returns { key, val } with the
// smallest key, or undefined when empty. Keys and values live in two parallel
// arrays so no object is created per push.
export class MinHeap {
  constructor() {
    this.keys = [];
    this.vals = [];
  }

  get size() {
    return this.keys.length;
  }

  push(key, val) {
    const k = this.keys;
    const v = this.vals;
    let i = k.length;
    k.push(key);
    v.push(val);
    // Sift up: move the new item toward the root while it is smaller than its parent.
    while (i > 0) {
      const parent = (i - 1) >> 1;
      if (k[parent] <= key) break;
      k[i] = k[parent];
      v[i] = v[parent];
      i = parent;
    }
    k[i] = key;
    v[i] = val;
  }

  pop() {
    const k = this.keys;
    const v = this.vals;
    if (k.length === 0) return undefined;
    const top = { key: k[0], val: v[0] };
    const lastKey = k.pop();
    const lastVal = v.pop();
    const n = k.length;
    if (n > 0) {
      // Sift down: put the last item at the root, then move it down past smaller children.
      let i = 0;
      for (;;) {
        let child = 2 * i + 1;
        if (child >= n) break;
        if (child + 1 < n && k[child + 1] < k[child]) child++;
        if (k[child] >= lastKey) break;
        k[i] = k[child];
        v[i] = v[child];
        i = child;
      }
      k[i] = lastKey;
      v[i] = lastVal;
    }
    return top;
  }
}
```

---

## R8 — src/cost.js

```js
// Turns an edge into a routing cost. Pure.
// fromId is the node we leave from. 'shortest' ignores it, but uphill/downhill
// profiles added later need the direction, so keep the parameter.
export const PROFILES = ['shortest'];

export function edgeCost(edge, fromId, profile) {
  switch (profile) {
    case 'shortest':
      return edge.length_m;
    default:
      throw new Error(`Unknown routing profile: ${profile}`);
  }
}
```

---

## R9 — src/graph.js

```js
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
```

---

## R10 — src/router.js

```js
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
```

---

## R11 — src/format.js

```js
// Human-readable distance and time. Pure.
export function formatDistance(m) {
  if (!Number.isFinite(m) || m < 0) return '';
  if (m < 10) return `${Math.round(m)} m`;
  const r = Math.round(m / 10) * 10;
  if (r < 1000) return `${r} m`;
  return `${(m / 1000).toFixed(1)} km`;
}

export function formatWalk(m, speedMps) {
  const seconds = m / speedMps;
  if (seconds < 60) return 'Under 1 min walk';
  return `${Math.round(seconds / 60)} min walk`;
}
```

---

## R12 — src/searchIndex.js

```js
// Place search scoring. Pure.
export function normalize(s) {
  return String(s)
    .toLowerCase()
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, ' ')
    .trim();
}

function scoreText(text, q) {
  const t = normalize(text);
  if (!t) return 0;
  if (t === q) return 100;
  if (t.startsWith(q)) return 80;
  if (t.split(' ').some((w) => w.startsWith(q))) return 60;
  if (t.includes(q)) return 40;
  return 0;
}

// places: any iterable of place objects. recentIds: newest first.
export function searchPlaces(places, query, recentIds = [], limit = 8) {
  const list = [...places];
  const q = normalize(query);

  if (!q) {
    const rank = new Map(recentIds.map((id, i) => [id, i]));
    return list
      .sort((a, b) => (rank.get(a.id) ?? 1e9) - (rank.get(b.id) ?? 1e9) || a.name.localeCompare(b.name))
      .slice(0, limit);
  }

  const scored = [];
  for (const p of list) {
    let s = scoreText(p.name, q);
    for (const alias of p.aliases ?? []) s = Math.max(s, scoreText(alias, q) - 5);
    if (s > 0) {
      if (recentIds.includes(p.id)) s += 3;
      scored.push([s, p]);
    }
  }
  scored.sort((x, y) => y[0] - x[0] || x[1].name.localeCompare(y[1].name));
  return scored.slice(0, limit).map((x) => x[1]);
}
```

---

## R13 — src/recorder/filter.js

```js
// Decides whether a GPS fix is good enough to keep while recording. Pure.
import { haversineM } from '../geo.js';

// prev: last kept fix or null. cfg: CONFIG.GPS.
// Returns { ok: true, reason: null } or { ok: false, reason: 'accuracy' | 'too-close' | 'too-fast' }.
export function shouldAcceptFix(prev, fix, cfg) {
  if (!Number.isFinite(fix.accuracy) || fix.accuracy > cfg.ACCURACY_MAX_M) return { ok: false, reason: 'accuracy' };
  if (!prev) return { ok: true, reason: null };
  const d = haversineM(prev.lat, prev.lon, fix.lat, fix.lon);
  if (d < cfg.MIN_STEP_M) return { ok: false, reason: 'too-close' };
  const dt = (fix.ts - prev.ts) / 1000;
  if (dt > 0 && d / dt > cfg.MAX_SPEED_MPS) return { ok: false, reason: 'too-fast' };
  return { ok: true, reason: null };
}
```

---

## R14 — src/store.js

```js
// Tiny state store. Pure.
export function createStore(initial) {
  let state = initial;
  const subs = new Set();
  return {
    get: () => state,
    set(patch) {
      state = { ...state, ...patch };
      // Reads `state` on every call, so a nested set() never leaves a subscriber with old data.
      for (const fn of [...subs]) fn(state);
    },
    subscribe(fn) {
      subs.add(fn);
      return () => subs.delete(fn);
    },
  };
}
```

---

## R15 — tests

### R15a — tests/geo.test.js

```js
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { haversineM, polylineLengthM, simplifyRDP } from '../src/geo.js';

test('haversineM: one degree of longitude at the equator is about 111195 m', () => {
  const d = haversineM(0, 0, 0, 1);
  assert.ok(Math.abs(d - 111195) < 2, `got ${d}`);
});

test('haversineM: same point is 0', () => {
  assert.equal(haversineM(12.9, 77.4, 12.9, 77.4), 0);
});

test('polylineLengthM: adds up segments', () => {
  const d = polylineLengthM([[0, 0], [0, 1], [0, 2]]);
  assert.ok(Math.abs(d - 2 * 111195) < 4, `got ${d}`);
});

test('simplifyRDP: drops a point on a straight line', () => {
  const pts = [[12.9, 77.4, null], [12.9, 77.4005, null], [12.9, 77.401, null]];
  assert.equal(simplifyRDP(pts, 2).length, 2);
});

test('simplifyRDP: keeps a corner', () => {
  const pts = [[12.9, 77.4, null], [12.9005, 77.4005, null], [12.9, 77.401, null]];
  assert.equal(simplifyRDP(pts, 2).length, 3);
});

test('simplifyRDP: keeps first and last points exactly', () => {
  const pts = [[12.9, 77.4, 800], [12.90001, 77.40001, null], [12.9, 77.401, 801]];
  const out = simplifyRDP(pts, 2);
  assert.deepEqual(out[0], pts[0]);
  assert.deepEqual(out[out.length - 1], pts[2]);
});
```

### R15b — tests/heap.test.js

```js
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { MinHeap } from '../src/heap.js';

test('MinHeap pops keys in ascending order', () => {
  const h = new MinHeap();
  const keys = [5, 1, 9, 3, 3, 0, 7, 2, 8, 6, 4];
  for (const k of keys) h.push(k, `v${k}`);
  const out = [];
  while (h.size > 0) out.push(h.pop().key);
  assert.deepEqual(out, [...keys].sort((a, b) => a - b));
});

test('MinHeap keeps values with their keys', () => {
  const h = new MinHeap();
  h.push(2, 'b');
  h.push(1, 'a');
  assert.deepEqual(h.pop(), { key: 1, val: 'a' });
});

test('MinHeap pop on empty returns undefined', () => {
  assert.equal(new MinHeap().pop(), undefined);
});
```

### R15c — tests/router.test.js

```js
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { loadGraph } from '../src/graph.js';
import { shortestPath, routePolyline } from '../src/router.js';

// Test-only coordinates on a small grid. Not real campus locations.
const A = [12.9, 77.4];
const B = [12.9, 77.401];
const C = [12.901, 77.401];
const D = [12.902, 77.4];
const E = [12.905, 77.405];
const node = (id, [lat, lon]) => ({ id, lat, lon, ele: null, kind: 'junction' });
const edge = (id, a, b, pa, pb) => ({ id, a, b, points: [[...pa, null], [...pb, null]], tags: {} });

function fixture(extraEdges = []) {
  const { graph, errors } = loadGraph({
    version: 1,
    nodes: [node('A', A), node('B', B), node('C', C), node('D', D), node('E', E)],
    edges: [
      edge('AB', 'A', 'B', A, B),
      edge('BC', 'B', 'C', B, C),
      edge('AD', 'A', 'D', A, D),
      edge('DC', 'D', 'C', D, C),
      ...extraEdges,
    ],
    places: [],
  });
  assert.deepEqual(errors, []);
  return graph;
}

test('picks the shorter of two ways round', () => {
  const r = shortestPath(fixture(), 'A', 'C');
  assert.deepEqual(r.nodeIds, ['A', 'B', 'C']);
  assert.ok(r.lengthM > 200 && r.lengthM < 240, `got ${r.lengthM}`);
});

test('works backwards along two-way edges', () => {
  assert.deepEqual(shortestPath(fixture(), 'C', 'A').nodeIds, ['C', 'B', 'A']);
});

test('returns null when there is no path', () => {
  assert.equal(shortestPath(fixture(), 'A', 'E'), null);
});

test('returns null for unknown nodes', () => {
  assert.equal(shortestPath(fixture(), 'A', 'nope'), null);
});

test('same start and goal gives an empty route', () => {
  const r = shortestPath(fixture(), 'A', 'A');
  assert.equal(r.steps.length, 0);
  assert.equal(r.lengthM, 0);
});

test('uses a direct shortcut when one exists', () => {
  const g = fixture([edge('AC', 'A', 'C', A, C)]);
  assert.deepEqual(shortestPath(g, 'A', 'C').nodeIds, ['A', 'C']);
});

test('routePolyline runs in walking order without duplicate joins', () => {
  const g = fixture();
  const r = shortestPath(g, 'C', 'A');
  const line = routePolyline(g, r.steps);
  assert.equal(line.length, 3);
  assert.deepEqual(line[0], C);
  assert.deepEqual(line[2], A);
});
```

### R15d — tests/graph.test.js

```js
import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  loadGraph, graphToJSON, snapOrCreateNode, addEdgeFromFixes, addPlace, nearestNode,
} from '../src/graph.js';
import { shortestPath } from '../src/router.js';

const CFG = { RDP_EPSILON_M: 2, MIN_EDGE_M: 3 };
const base = () => loadGraph({
  version: 1,
  nodes: [
    { id: 'A', lat: 12.9, lon: 77.4, ele: null, kind: 'junction' },
    { id: 'B', lat: 12.9, lon: 77.401, ele: null, kind: 'junction' },
    { id: 'A2', lat: 12.900018, lon: 77.4, ele: null, kind: 'junction' },
  ],
  edges: [],
  places: [],
}).graph;

test('rejects the wrong version', () => {
  const { errors } = loadGraph({ version: 2 });
  assert.equal(errors.length, 1);
});

test('skips an edge that points at an unknown node', () => {
  const { graph, errors } = loadGraph({
    version: 1,
    nodes: [{ id: 'A', lat: 12.9, lon: 77.4, ele: null, kind: 'junction' }],
    edges: [{ id: 'e1', a: 'A', b: 'Z', points: [[12.9, 77.4], [12.9, 77.401]] }],
    places: [],
  });
  assert.equal(errors.length, 1);
  assert.equal(graph.edges.size, 0);
});

test('graphToJSON round-trips', () => {
  const g = base();
  addEdgeFromFixes(g, 'A', 'B', [], {}, CFG);
  const again = loadGraph(JSON.parse(JSON.stringify(graphToJSON(g))));
  assert.deepEqual(again.errors, []);
  assert.equal(again.graph.nodes.size, 3);
  assert.equal(again.graph.edges.size, 1);
});

test('snapOrCreateNode reuses a node about 4 m away', () => {
  const g = base();
  const r = snapOrCreateNode(g, 12.90004 + 0.000001, 77.401, null, 'junction', 10);
  assert.equal(r.created, false);
  assert.equal(r.node.id, 'B');
});

test('snapOrCreateNode creates a node 50 m away', () => {
  const g = base();
  const r = snapOrCreateNode(g, 12.90045, 77.401, null, 'junction', 10);
  assert.equal(r.created, true);
  assert.equal(g.nodes.size, 4);
  assert.deepEqual(g.adj.get(r.node.id), []);
});

test('addEdgeFromFixes refuses a loop to the same node', () => {
  assert.equal(addEdgeFromFixes(base(), 'A', 'A', [], {}, CFG).reason, 'same-node');
});

test('addEdgeFromFixes refuses a path shorter than MIN_EDGE_M', () => {
  assert.equal(addEdgeFromFixes(base(), 'A', 'A2', [], {}, CFG).reason, 'too-short');
});

test('addEdgeFromFixes saves an edge that routing can use', () => {
  const g = base();
  const fixes = [{ lat: 12.90002, lon: 77.4005, alt: null, accuracy: 5, ts: 0 }];
  const r = addEdgeFromFixes(g, 'A', 'B', fixes, { stairs: true }, CFG);
  assert.equal(r.ok, true);
  assert.deepEqual(r.edge.points[0].slice(0, 2), [12.9, 77.4]);
  assert.deepEqual(r.edge.points[r.edge.points.length - 1].slice(0, 2), [12.9, 77.401]);
  assert.equal(r.edge.tags.stairs, true);
  assert.deepEqual(shortestPath(g, 'A', 'B').nodeIds, ['A', 'B']);
});

test('addPlace marks its node as a place', () => {
  const g = base();
  const p = addPlace(g, 'B', '  Block A ', 'academic', false);
  assert.equal(p.name, 'Block A');
  assert.equal(g.nodes.get('B').kind, 'place');
});

test('nearestNode respects the distance limit', () => {
  const g = base();
  assert.equal(nearestNode(g, 12.9, 77.40005, 10).node.id, 'A');
  assert.equal(nearestNode(g, 12.95, 77.45, 10), null);
});
```

### R15e — tests/format.test.js

```js
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { formatDistance, formatWalk } from '../src/format.js';

test('formatDistance', () => {
  assert.equal(formatDistance(4.4), '4 m');
  assert.equal(formatDistance(123), '120 m');
  assert.equal(formatDistance(995), '1.0 km');
  assert.equal(formatDistance(1530), '1.5 km');
});

test('formatWalk', () => {
  assert.equal(formatWalk(30, 1.3), 'Under 1 min walk');
  assert.equal(formatWalk(420, 1.3), '5 min walk');
});
```

### R15f — tests/search.test.js

```js
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { searchPlaces, normalize } from '../src/searchIndex.js';

const places = [
  { id: 'p1', name: 'Main Auditorium', aliases: [], category: 'academic', outside: false },
  { id: 'p2', name: 'Block A', aliases: ['A block'], category: 'academic', outside: false },
  { id: 'p3', name: 'Kengeri Metro Station', aliases: ['metro'], category: 'transport', outside: true },
];

test('normalize strips accents and punctuation', () => {
  assert.equal(normalize('  Café-Block '), 'cafe block');
});

test('matches the start of a word', () => {
  assert.equal(searchPlaces(places, 'aud')[0].id, 'p1');
});

test('matches aliases', () => {
  assert.equal(searchPlaces(places, 'a block')[0].id, 'p2');
  assert.equal(searchPlaces(places, 'metro')[0].id, 'p3');
});

test('no match gives an empty list', () => {
  assert.deepEqual(searchPlaces(places, 'zzz'), []);
});

test('empty query lists recent places first', () => {
  assert.equal(searchPlaces(places, '', ['p3'])[0].id, 'p3');
});
```

### R15g — tests/filter.test.js

```js
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { shouldAcceptFix } from '../src/recorder/filter.js';

const CFG = { ACCURACY_MAX_M: 20, MIN_STEP_M: 3, MAX_SPEED_MPS: 4 };
const prev = { lat: 12.9, lon: 77.4, accuracy: 5, ts: 0 };

test('rejects inaccurate fixes', () => {
  assert.equal(shouldAcceptFix(null, { ...prev, accuracy: 30 }, CFG).reason, 'accuracy');
});

test('accepts the first good fix', () => {
  assert.equal(shouldAcceptFix(null, prev, CFG).ok, true);
});

test('rejects a fix 1 m away', () => {
  assert.equal(shouldAcceptFix(prev, { ...prev, lat: 12.900009, ts: 1000 }, CFG).reason, 'too-close');
});

test('rejects a 100 m jump in one second', () => {
  assert.equal(shouldAcceptFix(prev, { ...prev, lat: 12.9009, ts: 1000 }, CFG).reason, 'too-fast');
});

test('accepts a normal walking step', () => {
  assert.equal(shouldAcceptFix(prev, { ...prev, lat: 12.90009, ts: 5000 }, CFG).ok, true);
});
```

### R15h — tests/store.test.js

```js
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createStore } from '../src/store.js';

test('set merges and notifies; unsubscribe stops notifications', () => {
  const store = createStore({ a: 1, b: 1 });
  const seen = [];
  const off = store.subscribe((s) => seen.push(s.a));
  store.set({ a: 2 });
  off();
  store.set({ a: 3 });
  assert.deepEqual(seen, [2]);
  assert.deepEqual(store.get(), { a: 3, b: 1 });
});
```

---

## R16 — index.html

```html
<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover">
  <meta name="theme-color" content="#FFFFFF" media="(prefers-color-scheme: light)">
  <meta name="theme-color" content="#1C232C" media="(prefers-color-scheme: dark)">
  <title>Campus Route</title>
</head>
<body data-mode="navigate" data-sheet="closed">
  <div id="map" aria-label="Campus map"></div>

  <header class="topbar">
    <div class="search" role="search">
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" aria-hidden="true"><circle cx="11" cy="11" r="7"/><path d="M20 20l-4-4"/></svg>
      <input id="search-input" type="search" placeholder="Where to?" autocomplete="off" enterkeyhint="go" aria-label="Search places" aria-controls="search-results">
      <button id="menu-btn" class="icon-btn" aria-label="Menu" aria-expanded="false" aria-controls="menu">
        <svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><circle cx="12" cy="5" r="1.8"/><circle cx="12" cy="12" r="1.8"/><circle cx="12" cy="19" r="1.8"/></svg>
      </button>
    </div>
    <ul id="search-results" class="results" hidden></ul>
  </header>

  <div id="menu" class="menu" hidden>
    <button id="menu-mapper" aria-pressed="false">Mapper mode</button>
    <button id="menu-fit">Show whole map</button>
    <button id="menu-export">Export map data</button>
    <button id="menu-import">Import map data</button>
    <button id="menu-discard" hidden>Discard local edits</button>
  </div>

  <button id="locate-btn" class="fab" aria-label="Show my location">
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" aria-hidden="true"><circle cx="12" cy="12" r="7"/><circle cx="12" cy="12" r="2.5" fill="currentColor" stroke="none"/><path d="M12 2v3M12 19v3M2 12h3M19 12h3"/></svg>
  </button>

  <section id="route-sheet" class="sheet" data-open="false" aria-label="Route" aria-live="polite">
    <div class="sheet-grip"></div>
    <div class="ends">
      <button id="from-btn" class="end"><span class="end-label">From</span><span id="from-name" class="end-name">Your location</span></button>
      <button id="to-btn" class="end"><span class="end-label">To</span><span id="to-name" class="end-name"></span></button>
      <button id="swap-btn" class="icon-btn" aria-label="Swap start and destination">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M8 20V4L4 8M8 4l4 4M16 4v16l-4-4M16 20l4-4"/></svg>
      </button>
    </div>
    <p id="route-walk" class="route-walk" hidden></p>
    <p id="route-dist" class="route-dist" hidden></p>
    <p id="route-msg" class="route-msg" hidden></p>
    <div class="sheet-actions"><button id="route-close-btn" class="btn btn-quiet">Close</button></div>
  </section>

  <section id="mapper-panel" class="panel" data-open="false" aria-label="Mapper">
    <div class="sheet-grip"></div>
    <p id="gps-status" class="gps-status" data-quality="none">Waiting for GPS…</p>
    <div id="walk-idle-row" class="row">
      <button id="walk-start-btn" class="btn btn-primary">Start walk here</button>
      <button id="undo-btn" class="btn">Undo last change</button>
    </div>
    <div id="walk-active-row" class="row" hidden>
      <button id="junction-btn" class="btn btn-primary">Mark junction</button>
      <button id="walk-stop-btn" class="btn">End walk here</button>
    </div>
    <div id="tag-row" class="chips" hidden>
      <button id="tag-stairs" class="chip" aria-pressed="false">Stairs</button>
      <button id="tag-steep" class="chip" aria-pressed="false">Steep</button>
      <button id="walk-discard-btn" class="btn btn-quiet">Discard walk</button>
    </div>
    <button id="place-open-btn" class="btn btn-wide">Add a place here</button>
    <div id="place-form" class="place-form" hidden>
      <input id="place-name" type="text" placeholder="Place name, for example Block A" maxlength="60" aria-label="Place name">
      <select id="place-category" aria-label="Place type"></select>
      <label class="check"><input id="place-outside" type="checkbox"> Off campus</label>
      <div class="row">
        <button id="place-save-btn" class="btn btn-primary">Save place</button>
        <button id="place-cancel-btn" class="btn">Cancel</button>
      </div>
    </div>
    <div class="sheet-actions"><button id="mapper-exit-btn" class="btn btn-quiet">Done mapping</button></div>
  </section>

  <div id="toast" class="toast" role="status" data-show="false"></div>
  <input id="import-file" type="file" accept="application/json,.json" hidden>
  <script type="module" src="/src/main.js"></script>
</body>
</html>
```

---

## R17 — src/styles/app.css

```css
:root {
  --c-ink: #18222E;
  --c-ink-2: #4A5868;
  --c-surface: #FFFFFF;
  --c-surface-2: #EEF2F5;
  --c-line: #D5DCE3;
  --c-route: #2348C9;
  --c-on-route: #FFFFFF;
  --c-here: #E4A11B;
  --c-rec: #CF3A2B;
  --c-ok: #2E8B57;
  --c-path: #7A8796;

  --font: 'Atkinson Hyperlegible', system-ui, -apple-system, 'Segoe UI', Roboto, sans-serif;
  --fs-s: 13px;
  --fs-m: 16px;
  --fs-l: 20px;
  --fs-xl: 28px;

  --r-pill: 999px;
  --r-sheet: 20px;
  --r-btn: 12px;
  --shadow-float: 0 1px 2px rgba(16, 24, 40, 0.18), 0 0 0 1px rgba(16, 24, 40, 0.06);

  --ease-out: cubic-bezier(0.2, 0.8, 0.2, 1);
  --t-fast: 160ms;
  --t-med: 240ms;

  --safe-top: env(safe-area-inset-top, 0px);
  --safe-bottom: env(safe-area-inset-bottom, 0px);
  color-scheme: light;
}

@media (prefers-color-scheme: dark) {
  :root {
    --c-ink: #E7ECF1;
    --c-ink-2: #A5B1BE;
    --c-surface: #1C232C;
    --c-surface-2: #26303B;
    --c-line: #354150;
    --c-route: #7B93FF;
    --c-on-route: #0D1433;
    --c-here: #F2B53A;
    --c-rec: #F0685A;
    --c-ok: #4CC38A;
    --c-path: #8C99A8;
    --shadow-float: 0 1px 2px rgba(0, 0, 0, 0.5), 0 0 0 1px rgba(255, 255, 255, 0.06);
    color-scheme: dark;
  }
}

* { box-sizing: border-box; }
html, body { margin: 0; height: 100%; }
body {
  font: 400 var(--fs-m) / 1.4 var(--font);
  color: var(--c-ink);
  background: var(--c-surface-2);
  overflow: hidden;
  -webkit-tap-highlight-color: transparent;
}
button, input, select { font: inherit; color: inherit; }
button { cursor: pointer; touch-action: manipulation; }
:focus-visible { outline: 3px solid var(--c-route); outline-offset: 2px; }
[hidden] { display: none !important; }

/* Map */
#map { position: fixed; inset: 0; background: var(--c-surface-2); }
.leaflet-container { font: inherit; background: var(--c-surface-2); }
.leaflet-control-attribution { font-size: 10px; }
.leaflet-container .leaflet-control-attribution { background: var(--c-surface); color: var(--c-ink-2); opacity: 0.9; }
.leaflet-control-attribution a { color: var(--c-ink-2); }
.leaflet-bottom { transition: transform var(--t-med) var(--ease-out); }
body[data-sheet="open"] .leaflet-bottom { transform: translateY(calc(-1 * var(--sheet-h, 0px))); }

/* Search */
.topbar { position: fixed; z-index: 1000; top: calc(var(--safe-top) + 12px); left: 12px; right: 12px; }
.search {
  display: flex; align-items: center; gap: 8px; height: 48px; padding: 0 4px 0 16px;
  background: var(--c-surface); border-radius: var(--r-pill); box-shadow: var(--shadow-float);
}
.search:focus-within { box-shadow: var(--shadow-float), 0 0 0 2px var(--c-route); }
body[data-mode="mapper"] .search { box-shadow: var(--shadow-float), inset 0 0 0 2px var(--c-rec); }
.search > svg { flex: none; width: 20px; height: 20px; color: var(--c-ink-2); }
.search input { flex: 1; min-width: 0; height: 100%; border: 0; background: transparent; outline: none; }
.search input::-webkit-search-cancel-button { display: none; }
.search input:disabled { color: var(--c-ink-2); }

.icon-btn {
  display: grid; place-items: center; flex: none; width: 44px; height: 44px;
  border: 0; border-radius: 50%; background: transparent; color: var(--c-ink);
}
.icon-btn svg { width: 22px; height: 22px; }

.results {
  list-style: none; margin: 8px 0 0; padding: 6px; max-height: min(60vh, 420px); overflow-y: auto;
  background: var(--c-surface); border-radius: 16px; box-shadow: var(--shadow-float);
}
.result { display: block; width: 100%; padding: 10px 12px; border: 0; border-radius: 10px; background: transparent; text-align: left; }
.result:active { background: var(--c-surface-2); }
.result-name { display: block; font-weight: 700; }
.result-meta { display: block; font-size: var(--fs-s); color: var(--c-ink-2); }
.results-empty { padding: 12px; color: var(--c-ink-2); }

/* Menu */
.menu {
  position: fixed; z-index: 1100; top: calc(var(--safe-top) + 68px); right: 12px; min-width: 220px; padding: 6px;
  background: var(--c-surface); border-radius: 16px; box-shadow: var(--shadow-float);
  transform-origin: top right; animation: pop var(--t-fast) var(--ease-out);
}
.menu button {
  display: flex; justify-content: space-between; gap: 16px; width: 100%; min-height: 44px; padding: 10px 12px;
  border: 0; border-radius: 10px; background: transparent; text-align: left;
}
.menu button:active { background: var(--c-surface-2); }
.menu button[aria-pressed="true"]::after { content: 'On'; color: var(--c-route); font-weight: 700; }
@keyframes pop { from { opacity: 0; transform: scale(0.96); } to { opacity: 1; transform: none; } }

/* Locate button */
.fab {
  position: fixed; z-index: 1000; right: 12px; bottom: calc(var(--safe-bottom) + 24px);
  display: grid; place-items: center; width: 52px; height: 52px;
  border: 0; border-radius: 50%; background: var(--c-surface); color: var(--c-ink); box-shadow: var(--shadow-float);
  transition: transform var(--t-med) var(--ease-out);
}
.fab svg { width: 24px; height: 24px; }
body[data-sheet="open"] .fab { transform: translateY(calc(-1 * var(--sheet-h, 0px))); }

/* Sheets */
.sheet, .panel {
  position: fixed; z-index: 1000; left: 0; right: 0; bottom: 0; max-height: 70vh; overflow-y: auto;
  padding: 10px 16px calc(var(--safe-bottom) + 16px);
  background: var(--c-surface); border-top: 1px solid var(--c-line);
  border-radius: var(--r-sheet) var(--r-sheet) 0 0;
  transform: translateY(105%); visibility: hidden;
  transition: transform var(--t-med) var(--ease-out), visibility 0s linear var(--t-med);
  will-change: transform;
}
.sheet[data-open="true"], .panel[data-open="true"] {
  transform: none; visibility: visible;
  transition: transform var(--t-med) var(--ease-out), visibility 0s;
}
.sheet-grip { width: 36px; height: 4px; margin: 0 auto 12px; border-radius: 2px; background: var(--c-line); }

.ends { display: grid; grid-template-columns: 1fr 44px; gap: 6px 8px; align-items: center; }
#from-btn { grid-column: 1; grid-row: 1; }
#to-btn { grid-column: 1; grid-row: 2; }
#swap-btn { grid-column: 2; grid-row: 1 / span 2; }
.end {
  display: flex; align-items: baseline; gap: 12px; width: 100%; min-height: 44px; padding: 8px 12px;
  border: 0; border-radius: var(--r-btn); background: var(--c-surface-2); text-align: left;
}
.end-label { flex: none; width: 40px; font-size: var(--fs-s); color: var(--c-ink-2); }
.end-name { font-weight: 700; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.route-walk { margin: 16px 0 0; font-size: var(--fs-xl); font-weight: 700; line-height: 1.1; letter-spacing: -0.01em; }
.route-dist { margin: 4px 0 0; color: var(--c-ink-2); }
.route-msg { margin: 12px 0 0; padding: 10px 12px; border-radius: var(--r-btn); background: var(--c-surface-2); }
.sheet-actions { display: flex; justify-content: flex-end; margin-top: 8px; }

/* Buttons */
.btn {
  min-height: 48px; padding: 0 16px; border: 1px solid var(--c-line); border-radius: var(--r-btn);
  background: var(--c-surface); font-weight: 700;
}
.btn-primary { border-color: transparent; background: var(--c-route); color: var(--c-on-route); }
.btn-quiet { border-color: transparent; background: transparent; color: var(--c-ink-2); }
.btn-wide { width: 100%; margin-top: 8px; }
.btn:disabled { opacity: 0.45; }
.btn:active, .chip:active { transform: scale(0.98); }
.row { display: grid; grid-template-columns: 1fr 1fr; gap: 8px; margin-top: 8px; }
.chips { display: flex; align-items: center; gap: 8px; margin-top: 8px; }
.chips .btn-quiet { margin-left: auto; }
.chip { min-height: 40px; padding: 0 14px; border: 1px solid var(--c-line); border-radius: var(--r-pill); background: transparent; }
.chip[aria-pressed="true"] { border-color: var(--c-ink); background: var(--c-ink); color: var(--c-surface); }

/* Mapper panel */
.gps-status { display: flex; align-items: center; gap: 8px; margin: 0; font-weight: 700; }
.gps-status::before { content: ''; width: 10px; height: 10px; border-radius: 50%; background: var(--c-ink-2); }
.gps-status[data-quality="good"]::before { background: var(--c-ok); }
.gps-status[data-quality="fair"]::before { background: var(--c-here); }
.gps-status[data-quality="weak"]::before { background: var(--c-rec); }
.place-form { display: grid; gap: 8px; margin-top: 8px; }
.place-form input[type="text"], .place-form select {
  min-height: 44px; padding: 0 12px; border: 1px solid var(--c-line); border-radius: var(--r-btn); background: var(--c-surface-2);
}
.check { display: flex; align-items: center; gap: 8px; min-height: 44px; }
.check input { width: 20px; height: 20px; }

/* Toast */
.toast {
  position: fixed; z-index: 1200; left: 50%; top: calc(var(--safe-top) + 72px); max-width: calc(100% - 32px);
  padding: 10px 14px; border-radius: var(--r-btn); background: var(--c-ink); color: var(--c-surface); font-size: var(--fs-s);
  transform: translate(-50%, -8px); opacity: 0; pointer-events: none;
  transition: opacity var(--t-fast) linear, transform var(--t-fast) var(--ease-out);
}
.toast[data-show="true"] { opacity: 1; transform: translate(-50%, 0); }

@media (prefers-reduced-motion: reduce) {
  *, *::before, *::after { animation-duration: 1ms !important; transition-duration: 1ms !important; }
}
```

---

## R18 — src/map/mapView.js

```js
// The ONLY file that knows about Leaflet. Everything else talks to the map
// through the functions returned by createMapView(). To swap map engines
// later, rewrite this file and keep the same returned functions.
import * as L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import { CONFIG } from '../config.js';

function cssVar(name) {
  return getComputedStyle(document.documentElement).getPropertyValue(name).trim();
}

export function createMapView(container, { onPlaceTap = () => {} } = {}) {
  const map = L.map(container, {
    zoomControl: false,
    attributionControl: false,
    preferCanvas: true,
    maxZoom: CONFIG.MAX_ZOOM,
  });
  L.control.attribution({ position: 'bottomleft', prefix: false }).addTo(map);

  // Panes control stacking. Route above paths; user dot above route.
  // pointer-events none lets taps fall through to the place dots below.
  map.createPane('routePane');
  map.getPane('routePane').style.zIndex = '420';
  map.getPane('routePane').style.pointerEvents = 'none';
  map.createPane('userPane');
  map.getPane('userPane').style.zIndex = '450';
  map.getPane('userPane').style.pointerEvents = 'none';

  // Canvas draws many shapes cheaply. SVG is used only for the route, so it can animate.
  const canvas = L.canvas({ padding: 0.3, tolerance: 8 });
  const routeSvg = L.svg({ pane: 'routePane', padding: 0.3 });
  const userCanvas = L.canvas({ pane: 'userPane', padding: 0.3 });

  const darkQuery = window.matchMedia('(prefers-color-scheme: dark)');
  const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)');

  const pathsLayer = L.layerGroup().addTo(map);
  const placesLayer = L.layerGroup().addTo(map);
  const traceLayer = L.layerGroup().addTo(map);
  const routeLayer = L.layerGroup().addTo(map);
  const userLayer = L.layerGroup().addTo(map);

  let tiles = null;
  let lastGraph = null;
  let showJunctions = false;
  let lastUser = null;
  let userDot = null;
  let userRing = null;
  let trace = null;
  let routeToken = 0;
  let lastRoute = null;

  function applyTiles() {
    const t = darkQuery.matches ? CONFIG.TILES.dark : CONFIG.TILES.light;
    if (tiles) map.removeLayer(tiles);
    tiles = L.tileLayer(t.url, {
      attribution: t.attribution,
      subdomains: t.subdomains,
      maxNativeZoom: t.maxNativeZoom,
      maxZoom: CONFIG.MAX_ZOOM,
      detectRetina: false,
      keepBuffer: 1,
    }).addTo(map);
  }

  function redrawGraph() {
    pathsLayer.clearLayers();
    placesLayer.clearLayers();
    if (!lastGraph) return;
    const pathColor = cssVar('--c-path');
    const ink = cssVar('--c-ink');
    const ink2 = cssVar('--c-ink-2');
    const surface = cssVar('--c-surface');

    for (const e of lastGraph.edges.values()) {
      L.polyline(e.points.map((p) => [p[0], p[1]]), {
        renderer: canvas, color: pathColor, weight: 3, opacity: 0.8,
        dashArray: e.tags.stairs ? '2 6' : null, interactive: false,
      }).addTo(pathsLayer);
    }
    if (showJunctions) {
      for (const n of lastGraph.nodes.values()) {
        L.circleMarker([n.lat, n.lon], {
          renderer: canvas, radius: 4, color: ink2, weight: 2, fillColor: surface, fillOpacity: 1, interactive: false,
        }).addTo(pathsLayer);
      }
    }
    for (const p of lastGraph.places.values()) {
      const n = lastGraph.nodes.get(p.node);
      if (!n) continue;
      const dot = L.circleMarker([n.lat, n.lon], {
        renderer: canvas, radius: 7, color: surface, weight: 2, fillColor: ink, fillOpacity: 1,
      });
      dot.on('click', () => onPlaceTap(p.id));
      dot.addTo(placesLayer);
    }
  }

  function setGraph(graph, opts = {}) {
    lastGraph = graph;
    if (typeof opts.showJunctions === 'boolean') showJunctions = opts.showJunctions;
    redrawGraph();
  }

  function fitAll() {
    if (lastGraph && lastGraph.nodes.size > 0) {
      const lls = [...lastGraph.nodes.values()].map((n) => [n.lat, n.lon]);
      map.fitBounds(L.latLngBounds(lls), { padding: [40, 40], maxZoom: 18 });
    } else if (CONFIG.DEFAULT_CENTER) {
      map.setView(CONFIG.DEFAULT_CENTER, CONFIG.DEFAULT_ZOOM);
    } else {
      map.setView([12.97, 77.59], 11); // Bengaluru overview until the campus centre is configured
    }
  }

  // Draws the line from start to end by animating stroke-dashoffset on one SVG path.
  function animateDraw(el) {
    if (!el || typeof el.getTotalLength !== 'function') return;
    const len = el.getTotalLength();
    if (!len) return;
    el.style.strokeDasharray = String(len);
    el.style.strokeDashoffset = String(len);
    el.getBoundingClientRect(); // make the browser apply the start state before the transition
    el.style.transition = 'stroke-dashoffset 650ms cubic-bezier(0.2, 0.8, 0.2, 1)';
    el.style.strokeDashoffset = '0';
    const reset = () => {
      el.style.transition = '';
      el.style.strokeDasharray = '';
      el.style.strokeDashoffset = '';
    };
    el.addEventListener('transitionend', reset, { once: true });
    map.once('zoomstart', reset); // zooming changes the path length, so stop the effect
  }

  function drawRoute(latlngs, animate) {
    routeLayer.clearLayers();
    const route = cssVar('--c-route');
    const surface = cssVar('--c-surface');
    L.polyline(latlngs, {
      renderer: routeSvg, color: surface, weight: 11, opacity: 0.9, lineCap: 'round', lineJoin: 'round', interactive: false,
    }).addTo(routeLayer);
    const line = L.polyline(latlngs, {
      renderer: routeSvg, color: route, weight: 6, lineCap: 'round', lineJoin: 'round', interactive: false,
    }).addTo(routeLayer);
    L.circleMarker(latlngs[0], {
      renderer: routeSvg, radius: 7, color: route, weight: 3, fillColor: surface, fillOpacity: 1, interactive: false,
    }).addTo(routeLayer);
    L.circleMarker(latlngs[latlngs.length - 1], {
      renderer: routeSvg, radius: 8, color: surface, weight: 3, fillColor: route, fillOpacity: 1, interactive: false,
    }).addTo(routeLayer);
    if (animate && !reduceMotion.matches) animateDraw(line.getElement());
  }

  // fit: move the map to show the whole route first. bottomPad: pixels hidden by the sheet.
  function showRoute(latlngs, { fit = true, animate = true, bottomPad = 0 } = {}) {
    if (!latlngs || latlngs.length < 2) {
      clearRoute();
      return;
    }
    lastRoute = latlngs;
    const token = ++routeToken;
    if (!fit) {
      drawRoute(latlngs, false);
      return;
    }
    routeLayer.clearLayers();
    let drawn = false;
    const draw = () => {
      if (drawn || token !== routeToken) return; // a newer route replaced this one
      drawn = true;
      drawRoute(latlngs, animate);
    };
    map.once('moveend', draw);
    map.fitBounds(L.latLngBounds(latlngs), {
      paddingTopLeft: [32, 96],
      paddingBottomRight: [32, bottomPad + 24],
      maxZoom: 18,
    });
    setTimeout(draw, 450); // fallback when the map did not need to move
  }

  function clearRoute() {
    routeToken++;
    lastRoute = null;
    routeLayer.clearLayers();
  }

  function setUser(lat, lon, accuracyM) {
    lastUser = { lat, lon, accuracyM };
    const ll = [lat, lon];
    if (!userDot) {
      const here = cssVar('--c-here');
      const surface = cssVar('--c-surface');
      userRing = L.circle(ll, {
        renderer: userCanvas, radius: accuracyM, color: here, weight: 1, opacity: 0.6, fillColor: here, fillOpacity: 0.12, interactive: false,
      }).addTo(userLayer);
      userDot = L.circleMarker(ll, {
        renderer: userCanvas, radius: 7, color: surface, weight: 3, fillColor: here, fillOpacity: 1, interactive: false,
      }).addTo(userLayer);
      return;
    }
    userRing.setLatLng(ll);
    userRing.setRadius(accuracyM);
    userDot.setLatLng(ll);
  }

  function centerOn(lat, lon, zoom) {
    map.setView([lat, lon], zoom ?? Math.max(map.getZoom(), CONFIG.DEFAULT_ZOOM), { animate: true });
  }

  function startTrace(latlngs = []) {
    clearTrace();
    trace = L.polyline(latlngs, { renderer: canvas, color: cssVar('--c-rec'), weight: 4, interactive: false }).addTo(traceLayer);
  }

  function addTracePoint(lat, lon) {
    if (trace) trace.addLatLng([lat, lon]);
  }

  function clearTrace() {
    traceLayer.clearLayers();
    trace = null;
  }

  darkQuery.addEventListener('change', () => {
    applyTiles();
    redrawGraph();
    userLayer.clearLayers();
    userDot = null;
    userRing = null;
    if (lastUser) setUser(lastUser.lat, lastUser.lon, lastUser.accuracyM);
    if (lastRoute) drawRoute(lastRoute, false);
    if (trace) {
      const lls = trace.getLatLngs();
      startTrace(lls);
    }
  });

  applyTiles();
  fitAll();

  return { setGraph, fitAll, showRoute, clearRoute, setUser, centerOn, startTrace, addTracePoint, clearTrace };
}
```

---

## R19 — src/location.js

```js
// One shared GPS watcher for the whole app.
// Listeners get { type: 'fix', fix } or { type: 'error', code, message }.
import { CONFIG } from './config.js';

const listeners = new Set();
let watchId = null;
let last = null;

function emit(event) {
  for (const fn of listeners) fn(event);
}

function handlePosition(pos) {
  const c = pos.coords;
  last = {
    lat: c.latitude,
    lon: c.longitude,
    alt: Number.isFinite(c.altitude) ? c.altitude : null,
    accuracy: c.accuracy,
    ts: pos.timestamp,
  };
  emit({ type: 'fix', fix: last });
}

function handleError(err) {
  emit({ type: 'error', code: err.code, message: err.message });
}

export function startLocation() {
  if (watchId !== null) return true;
  if (!('geolocation' in navigator)) {
    emit({ type: 'error', code: 0, message: 'This browser cannot read GPS.' });
    return false;
  }
  if (!window.isSecureContext) {
    emit({ type: 'error', code: 0, message: 'GPS needs a secure page. Open the https:// address.' });
    return false;
  }
  watchId = navigator.geolocation.watchPosition(handlePosition, handleError, {
    enableHighAccuracy: true,
    maximumAge: 0,
    timeout: CONFIG.GPS.TIMEOUT_MS,
  });
  return true;
}

export function stopLocation() {
  if (watchId !== null) navigator.geolocation.clearWatch(watchId);
  watchId = null;
}

export function onLocation(fn) {
  listeners.add(fn);
  return () => listeners.delete(fn);
}

export function lastFix() {
  return last;
}
```

---

## R20 — src/storage.js

```js
// Phone storage and file import/export.
import { CONFIG } from './config.js';

export function loadWorkingGraph() {
  try {
    const raw = localStorage.getItem(CONFIG.STORAGE.GRAPH);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

// Returns false when storage is full or blocked.
export function saveWorkingGraph(json) {
  try {
    localStorage.setItem(CONFIG.STORAGE.GRAPH, JSON.stringify(json));
    return true;
  } catch {
    return false;
  }
}

export function clearWorkingGraph() {
  try {
    localStorage.removeItem(CONFIG.STORAGE.GRAPH);
  } catch {
    /* nothing to clear */
  }
}

export function loadRecent() {
  try {
    const list = JSON.parse(localStorage.getItem(CONFIG.STORAGE.RECENT) ?? '[]');
    return Array.isArray(list) ? list.filter((x) => typeof x === 'string') : [];
  } catch {
    return [];
  }
}

export function pushRecent(placeId) {
  const list = [placeId, ...loadRecent().filter((id) => id !== placeId)].slice(0, 8);
  try {
    localStorage.setItem(CONFIG.STORAGE.RECENT, JSON.stringify(list));
  } catch {
    /* recent places are optional */
  }
}

export function downloadJSON(obj, filename) {
  const blob = new Blob([JSON.stringify(obj)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.append(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

export async function readJSONFile(file) {
  return JSON.parse(await file.text());
}
```

---

## R21 — src/ui/toast.js

```js
let timer = 0;

export function toast(text, ms = 2800) {
  const el = document.getElementById('toast');
  el.textContent = text;
  el.dataset.show = 'true';
  clearTimeout(timer);
  timer = setTimeout(() => {
    el.dataset.show = 'false';
  }, ms);
}
```

---

## R22 — src/recorder/recorder.js

```js
// Mapper-mode state machine.
// States: 'off' (navigate mode), 'ready' (mapper open, standing), 'walking'.
// It edits the graph in place and reports through onChange(event), where
// event.type is 'state' | 'point' | 'walk-started' | 'node-marked' | 'place-saved'
// | 'walk-ended' | 'walk-discarded' | 'undo', and event.graphChanged says whether
// the graph must be saved and redrawn.
import { CONFIG } from '../config.js';
import { onLocation, startLocation, lastFix } from '../location.js';
import { shouldAcceptFix } from './filter.js';
import { snapOrCreateNode, addEdgeFromFixes, addPlace, graphToJSON, loadGraph } from '../graph.js';

export function createRecorder({ getGraph, setGraph, onChange }) {
  let state = 'off';
  let segment = null; // { fromNodeId, fixes: [], tags: { stairs, steep } }
  let lastAccepted = null;
  let wakeLock = null;
  let unsubscribe = null;
  const undoStack = [];

  function emit(event) {
    onChange({ graphChanged: false, ...event });
  }

  // A recent fix accurate enough to place a junction or place.
  function goodFix() {
    const f = lastFix();
    if (!f) return null;
    if (Date.now() - f.ts > 10000) return null;
    if (f.accuracy > CONFIG.GPS.NODE_ACCURACY_MAX_M) return null;
    return f;
  }

  function newSegment(fromNodeId) {
    segment = { fromNodeId, fixes: [], tags: { stairs: false, steep: false } };
    lastAccepted = null;
  }

  function pushUndo() {
    undoStack.push(JSON.stringify(graphToJSON(getGraph())));
    if (undoStack.length > CONFIG.UNDO_LIMIT) undoStack.shift();
  }

  function handleLocation(ev) {
    if (ev.type !== 'fix' || state !== 'walking') return;
    if (!shouldAcceptFix(lastAccepted, ev.fix, CONFIG.GPS).ok) return;
    lastAccepted = ev.fix;
    segment.fixes.push(ev.fix);
    emit({ type: 'point', fix: ev.fix });
  }

  // Keeps the screen on while walking. Android stops GPS for web pages when the screen is off.
  async function lockScreen() {
    try {
      if ('wakeLock' in navigator && !wakeLock) {
        wakeLock = await navigator.wakeLock.request('screen');
        wakeLock.addEventListener('release', () => {
          wakeLock = null;
        });
      }
    } catch {
      wakeLock = null;
    }
  }

  function unlockScreen() {
    if (wakeLock) wakeLock.release().catch(() => {});
    wakeLock = null;
  }

  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'visible' && state === 'walking') lockScreen();
  });

  function enter() {
    if (state !== 'off') return;
    state = 'ready';
    startLocation();
    unsubscribe = onLocation(handleLocation);
    emit({ type: 'state' });
  }

  function exit() {
    if (state === 'off') return;
    if (state === 'walking') discardWalk();
    state = 'off';
    if (unsubscribe) unsubscribe();
    unsubscribe = null;
    emit({ type: 'state' });
  }

  function startWalk() {
    if (state !== 'ready') return { ok: false, reason: 'not-ready' };
    const fix = goodFix();
    if (!fix) return { ok: false, reason: 'weak-gps' };
    pushUndo();
    const { node, created } = snapOrCreateNode(getGraph(), fix.lat, fix.lon, fix.alt, 'junction', CONFIG.GRAPH.SNAP_RADIUS_M);
    if (!created) undoStack.pop();
    newSegment(node.id);
    state = 'walking';
    lockScreen();
    emit({ type: 'walk-started', node, graphChanged: created });
    return { ok: true, node, created };
  }

  // Ends the current segment at the current position. placeInfo turns the point into a place.
  function markNode(placeInfo) {
    if (state !== 'walking') return { ok: false, reason: 'not-walking' };
    const fix = goodFix();
    if (!fix) return { ok: false, reason: 'weak-gps' };
    const g = getGraph();
    pushUndo();
    const kind = placeInfo ? 'place' : 'junction';
    const { node, created } = snapOrCreateNode(g, fix.lat, fix.lon, fix.alt, kind, CONFIG.GRAPH.SNAP_RADIUS_M);
    const edge = addEdgeFromFixes(g, segment.fromNodeId, node.id, segment.fixes, segment.tags, CONFIG.GRAPH);
    const place = placeInfo ? addPlace(g, node.id, placeInfo.name, placeInfo.category, placeInfo.outside) : null;
    const changed = created || edge.ok || place !== null;
    if (!changed) undoStack.pop();
    newSegment(node.id);
    emit({ type: 'node-marked', node, graphChanged: changed });
    return { ok: true, node, created, edge, place };
  }

  function savePlace(placeInfo) {
    if (state === 'walking') return markNode(placeInfo);
    if (state !== 'ready') return { ok: false, reason: 'not-ready' };
    const fix = goodFix();
    if (!fix) return { ok: false, reason: 'weak-gps' };
    const g = getGraph();
    pushUndo();
    const { node, created } = snapOrCreateNode(g, fix.lat, fix.lon, fix.alt, 'place', CONFIG.GRAPH.SNAP_RADIUS_M);
    const place = addPlace(g, node.id, placeInfo.name, placeInfo.category, placeInfo.outside);
    emit({ type: 'place-saved', node, graphChanged: true });
    return { ok: true, node, created, edge: null, place };
  }

  function stopWalk() {
    const r = markNode(null);
    if (!r.ok) return r;
    segment = null;
    state = 'ready';
    unlockScreen();
    emit({ type: 'walk-ended' });
    return r;
  }

  function discardWalk() {
    if (state !== 'walking') return;
    segment = null;
    state = 'ready';
    unlockScreen();
    emit({ type: 'walk-discarded' });
  }

  function setTag(name, on) {
    if (state !== 'walking' || !(name in segment.tags)) return;
    segment.tags[name] = on === true;
    emit({ type: 'state' });
  }

  function undo() {
    if (state !== 'ready' || undoStack.length === 0) return false;
    const { graph } = loadGraph(JSON.parse(undoStack.pop()));
    setGraph(graph);
    emit({ type: 'undo', graphChanged: true });
    return true;
  }

  return {
    getState: () => state,
    getTags: () => (segment ? { ...segment.tags } : { stairs: false, steep: false }),
    canUndo: () => state === 'ready' && undoStack.length > 0,
    enter, exit, startWalk, markNode, savePlace, stopWalk, discardWalk, setTag, undo,
  };
}
```

---

## R23 — src/ui/mapperPanel.js

```js
import { CONFIG } from '../config.js';
import { onLocation } from '../location.js';
import { PLACE_CATEGORIES, CATEGORY_LABELS } from '../graph.js';

const REASONS = {
  'weak-gps': 'GPS is too weak to mark a point here. Wait until the dot turns green.',
  'not-walking': 'Start a walk first.',
  'not-ready': 'Finish or discard the current walk first.',
};

const EDGE_REASONS = {
  'same-node': 'You ended where this path started, so it was not saved. On loops, mark a junction partway round.',
  'too-short': 'That path was too short to save.',
  'missing-node': 'That path could not be saved.',
};

function describe(r) {
  const parts = [];
  if (r.place) parts.push(`Saved “${r.place.name}”.`);
  if (r.edge) {
    if (r.edge.ok) {
      parts.push(`Path saved, ${Math.round(r.edge.edge.length_m)} m.`);
      if (r.edge.parallel) parts.push('It is a second route between the same two points.');
    } else {
      parts.push(EDGE_REASONS[r.edge.reason] ?? 'Path not saved.');
    }
  }
  if (!r.created) parts.push('Joined a point you already mapped.');
  return parts.join(' ');
}

export function initMapperPanel(recorder, { onExit, toast }) {
  const $ = (id) => document.getElementById(id);
  const panel = $('mapper-panel');
  const status = $('gps-status');
  const placeForm = $('place-form');
  const placeOpenBtn = $('place-open-btn');
  const placeName = $('place-name');
  const placeCategory = $('place-category');
  const placeOutside = $('place-outside');

  for (const c of PLACE_CATEGORIES) {
    const opt = document.createElement('option');
    opt.value = c;
    opt.textContent = CATEGORY_LABELS[c];
    placeCategory.append(opt);
  }

  onLocation((ev) => {
    if (ev.type !== 'fix') return;
    const a = Math.round(ev.fix.accuracy);
    status.textContent = `GPS accurate to ${a} m`;
    status.dataset.quality =
      a <= CONFIG.GPS.NODE_ACCURACY_MAX_M ? 'good' : a <= CONFIG.GPS.ACCURACY_MAX_M ? 'fair' : 'weak';
  });

  function ok(result) {
    if (result.ok) return true;
    toast(REASONS[result.reason] ?? 'That did not work. Try again.');
    return false;
  }

  function closePlaceForm() {
    placeForm.hidden = true;
    placeOpenBtn.hidden = false;
    placeName.value = '';
    placeOutside.checked = false;
    render();
  }

  $('walk-start-btn').addEventListener('click', () => {
    const r = recorder.startWalk();
    if (ok(r)) toast(r.created ? 'Walk started at a new junction.' : 'Walk started from a point you already mapped.');
  });

  $('junction-btn').addEventListener('click', () => {
    const r = recorder.markNode(null);
    if (ok(r)) toast(describe(r));
  });

  $('walk-stop-btn').addEventListener('click', () => {
    const r = recorder.stopWalk();
    if (ok(r)) toast(`Walk ended. ${describe(r)}`);
  });

  $('walk-discard-btn').addEventListener('click', () => {
    if (!confirm('Discard the path since your last junction?')) return;
    recorder.discardWalk();
    toast('Walk discarded.');
  });

  $('undo-btn').addEventListener('click', () => {
    if (recorder.undo()) toast('Last change undone.');
  });

  for (const name of ['stairs', 'steep']) {
    $(`tag-${name}`).addEventListener('click', () => recorder.setTag(name, !recorder.getTags()[name]));
  }

  placeOpenBtn.addEventListener('click', () => {
    placeForm.hidden = false;
    placeOpenBtn.hidden = true;
    placeName.focus();
    render();
  });

  $('place-cancel-btn').addEventListener('click', closePlaceForm);

  $('place-save-btn').addEventListener('click', () => {
    const name = placeName.value.trim();
    if (!name) {
      toast('Type a name for this place first.');
      placeName.focus();
      return;
    }
    const r = recorder.savePlace({ name, category: placeCategory.value, outside: placeOutside.checked });
    if (!ok(r)) return;
    toast(describe(r));
    closePlaceForm();
  });

  $('mapper-exit-btn').addEventListener('click', () => {
    if (recorder.getState() === 'walking') {
      toast('End or discard the walk first.');
      return;
    }
    onExit();
  });

  function render() {
    const st = recorder.getState();
    const open = st !== 'off';
    panel.dataset.open = String(open);
    $('walk-idle-row').hidden = st !== 'ready';
    $('walk-active-row').hidden = st !== 'walking';
    $('tag-row').hidden = st !== 'walking';
    $('undo-btn').disabled = !recorder.canUndo();
    const tags = recorder.getTags();
    $('tag-stairs').setAttribute('aria-pressed', String(tags.stairs));
    $('tag-steep').setAttribute('aria-pressed', String(tags.steep));
    if (open) {
      document.body.dataset.sheet = 'open';
      document.body.style.setProperty('--sheet-h', `${panel.offsetHeight}px`);
    }
  }

  render();
  return { render };
}
```

---

## R24 — src/main.js

```js
import '@fontsource/atkinson-hyperlegible/400.css';
import '@fontsource/atkinson-hyperlegible/700.css';
import './styles/app.css';
import { CONFIG } from './config.js';
import { createStore } from './store.js';
import { emptyGraph, loadGraph, graphToJSON, nearestNode } from './graph.js';
import { shortestPath, routePolyline } from './router.js';
import { createMapView } from './map/mapView.js';
import { startLocation, onLocation } from './location.js';
import { loadWorkingGraph, saveWorkingGraph, clearWorkingGraph, downloadJSON, readJSONFile } from './storage.js';
import { createRecorder } from './recorder/recorder.js';
import { initMapperPanel } from './ui/mapperPanel.js';
import { initSearch } from './ui/search.js';
import { initSheet } from './ui/sheet.js';
import { initMenu } from './ui/menu.js';
import { toast } from './ui/toast.js';

const GPS_ERRORS = {
  1: 'Location is blocked. Allow location for this site in Chrome settings, then reload.',
  2: 'No GPS signal. Step into the open or wait a moment.',
  3: 'Still waiting for GPS…',
};

async function readGraphJSON() {
  const local = loadWorkingGraph();
  if (local) return { json: local, local: true };
  const res = await fetch(`${import.meta.env.BASE_URL}graph.json`, { cache: 'no-cache' });
  if (!res.ok) throw new Error(`graph.json: HTTP ${res.status}`);
  return { json: await res.json(), local: false };
}

// Turns a route end ({ type: 'gps' } or { type: 'place', placeId }) into a node id.
function resolveEnd(end, graph, user) {
  if (end.type === 'place') {
    const place = graph.places.get(end.placeId);
    return place ? { nodeId: place.node, msg: null } : { nodeId: null, msg: 'That place is no longer on the map.' };
  }
  if (!user) return { nodeId: null, msg: 'Finding your location…' };
  const hit = nearestNode(graph, user.lat, user.lon, CONFIG.ROUTE.START_SNAP_MAX_M);
  return hit
    ? { nodeId: hit.node.id, msg: null }
    : { nodeId: null, msg: 'You are away from the mapped paths. Choose a start place instead.' };
}

async function boot() {
  const store = createStore({
    graph: emptyGraph(),
    graphVersion: 0,
    usingLocalEdits: false,
    mode: 'navigate',
    user: null,
    from: { type: 'gps' },
    to: null,
    route: null,
    routeMsg: null,
    searchTarget: 'to',
  });

  const mapView = createMapView(document.getElementById('map'), {
    onPlaceTap: (placeId) => {
      if (store.get().mode === 'navigate') store.set({ to: { type: 'place', placeId } });
    },
  });

  let recorder = null;
  let panel = null;

  // Saves the graph, bumps the version (which re-runs routing), and redraws.
  function persistGraph() {
    const s = store.get();
    store.set({ graphVersion: s.graphVersion + 1, usingLocalEdits: true });
    if (!saveWorkingGraph(graphToJSON(s.graph))) toast('Phone storage is full. Export your map data now.');
    mapView.setGraph(s.graph, { showJunctions: s.mode === 'mapper' });
  }

  function setMode(mode) {
    store.set({ mode, to: mode === 'mapper' ? null : store.get().to });
    document.body.dataset.mode = mode;
    mapView.setGraph(store.get().graph, { showJunctions: mode === 'mapper' });
    if (mode === 'mapper') {
      recorder.enter();
      toast('Mapper mode on. Stand at a junction and tap Start walk here.');
    } else {
      recorder.exit();
    }
  }

  // 1. Load map data: phone edits first, otherwise the shipped graph.json.
  try {
    const { json, local } = await readGraphJSON();
    const { graph, errors } = loadGraph(json);
    if (errors.length > 0) console.warn('Map data problems:', errors);
    store.set({ graph, usingLocalEdits: local });
  } catch (err) {
    console.error(err);
    toast('Could not load map data. Check your connection and reload.');
  }
  mapView.setGraph(store.get().graph, { showJunctions: false });
  mapView.fitAll();

  // 2. GPS.
  let centerOnNextFix = false;
  let lastErrorText = '';
  let lastErrorAt = 0;
  onLocation((ev) => {
    if (ev.type === 'fix') {
      store.set({ user: ev.fix });
      mapView.setUser(ev.fix.lat, ev.fix.lon, ev.fix.accuracy);
      if (centerOnNextFix) {
        centerOnNextFix = false;
        mapView.centerOn(ev.fix.lat, ev.fix.lon);
      }
      return;
    }
    const text = GPS_ERRORS[ev.code] || ev.message;
    const now = Date.now();
    if (text && (text !== lastErrorText || now - lastErrorAt > 30000)) {
      lastErrorText = text;
      lastErrorAt = now;
      toast(text);
    }
  });

  document.getElementById('locate-btn').addEventListener('click', () => {
    const user = store.get().user;
    if (user) {
      mapView.centerOn(user.lat, user.lon);
    } else {
      centerOnNextFix = true;
      startLocation();
      toast('Finding your location…');
    }
  });

  // 3. Routing. Re-runs only when the start node, goal node, or graph actually change.
  let lastKey = '';
  let lastFitKey = '';
  store.subscribe((s) => {
    if (s.mode !== 'navigate' || !s.to) {
      if (lastKey !== '') {
        lastKey = '';
        lastFitKey = '';
        mapView.clearRoute();
        store.set({ route: null, routeMsg: null });
      }
      return;
    }
    if (s.from.type === 'gps' || s.to.type === 'gps') startLocation();

    const a = resolveEnd(s.from, s.graph, s.user);
    const b = resolveEnd(s.to, s.graph, s.user);
    const key = `${a.nodeId}|${b.nodeId}|${a.msg}|${b.msg}|${s.graphVersion}`;
    if (key === lastKey) return;
    lastKey = key;

    const msg = a.msg || b.msg;
    if (msg) {
      mapView.clearRoute();
      store.set({ route: null, routeMsg: msg });
      return;
    }
    const result = shortestPath(s.graph, a.nodeId, b.nodeId, 'shortest');
    if (!result) {
      mapView.clearRoute();
      store.set({ route: null, routeMsg: 'No mapped path connects these two places yet.' });
      return;
    }
    if (result.steps.length === 0) {
      mapView.clearRoute();
      store.set({ route: result, routeMsg: 'You are already there.' });
      return;
    }

    // Only move the map when the user picked new ends, not when GPS drifts.
    const fitKey = `${JSON.stringify(s.from)}|${JSON.stringify(s.to)}`;
    const fit = fitKey !== lastFitKey;
    lastFitKey = fitKey;
    const sheetH = Math.max(document.getElementById('route-sheet').offsetHeight, 220);
    mapView.showRoute(routePolyline(s.graph, result.steps), { fit, animate: fit, bottomPad: sheetH });
    store.set({ route: result, routeMsg: null });
  });

  // 4. Mapper mode.
  recorder = createRecorder({
    getGraph: () => store.get().graph,
    setGraph: (graph) => store.set({ graph }),
    onChange: (ev) => {
      if (ev.type === 'point') {
        mapView.addTracePoint(ev.fix.lat, ev.fix.lon);
        return;
      }
      if (ev.graphChanged) persistGraph();
      if (recorder.getState() === 'walking') {
        if (ev.type === 'walk-started' || ev.type === 'node-marked') mapView.startTrace([[ev.node.lat, ev.node.lon]]);
      } else {
        mapView.clearTrace();
      }
      panel.render();
    },
  });
  panel = initMapperPanel(recorder, { onExit: () => setMode('navigate'), toast });

  // 5. Navigate UI and menu.
  initSearch(store);
  initSheet(store, { onClose: () => store.set({ to: null }) });
  initMenu(store, {
    onToggleMapper: () => {
      const mode = store.get().mode;
      if (mode === 'mapper' && recorder.getState() === 'walking') {
        toast('End or discard the walk first.');
        return;
      }
      setMode(mode === 'mapper' ? 'navigate' : 'mapper');
    },
    onFitAll: () => mapView.fitAll(),
    onExport: () => {
      downloadJSON(graphToJSON(store.get().graph), 'graph.json');
      toast('Exported graph.json. Put it in the project’s public folder to ship it.');
    },
    onImport: async (file) => {
      try {
        const json = await readJSONFile(file);
        if (json?.version !== 1) {
          toast('That file is not Campus Route map data.');
          return;
        }
        const { graph, errors } = loadGraph(json);
        store.set({ graph });
        persistGraph();
        mapView.fitAll();
        toast(errors.length > 0 ? `Imported. Skipped ${errors.length} broken items.` : 'Imported map data.');
      } catch {
        toast('Could not read that file. Choose a graph.json exported from this app.');
      }
    },
    onDiscard: () => {
      clearWorkingGraph();
      window.location.reload();
    },
  });
}

boot();
```

---

## R25 — .github/workflows/deploy.yml (optional)

Only create this if the human asked for GitHub Pages. The human must set
the repo's Settings → Pages → Source to "GitHub Actions".

```yaml
name: Deploy to GitHub Pages

on:
  push:
    branches: [main]
  workflow_dispatch:

permissions:
  contents: read
  pages: write
  id-token: write

concurrency:
  group: pages
  cancel-in-progress: true

jobs:
  deploy:
    runs-on: ubuntu-latest
    environment:
      name: github-pages
      url: ${{ steps.deployment.outputs.page_url }}
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version: 22
          cache: npm
      - run: npm ci
      - run: npm test
      - run: npm run build
      - uses: actions/configure-pages@v5
      - uses: actions/upload-pages-artifact@v3
        with:
          path: dist
      - id: deployment
        uses: actions/deploy-pages@v4
```
