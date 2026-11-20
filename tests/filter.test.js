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
