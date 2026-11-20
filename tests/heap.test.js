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
