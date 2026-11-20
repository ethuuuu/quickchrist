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
