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
