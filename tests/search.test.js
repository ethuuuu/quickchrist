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
