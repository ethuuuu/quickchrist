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
