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
