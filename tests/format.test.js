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
