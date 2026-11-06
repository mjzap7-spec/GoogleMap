const { test } = require('node:test');
const assert = require('node:assert/strict');
const { readPoints } = require('../scripts/play-route.cjs');
test('saved-route playback keeps GPX coordinates and cumulative times and rejects broken files', () => {
  const path = [
    { lat: 28, lng: -81, delay_sec: 0 },
    { lat: 28.01, lng: -81.02, delay_sec: 3 },
  ];
  assert.deepEqual(readPoints({ path }), path);
  assert.throws(() => readPoints({ path: [path[1], path[0]] }));
  assert.throws(() => readPoints({ path: [path[0], { ...path[1], lng: 999 }] }));
});
test('saved directions join step geometry without replaying shared endpoints', () => {
  const a = { lat: 28, lng: -81 },
    b = { lat: 28.01, lng: -81.01 },
    c = { lat: 28.02, lng: -81.02 };
  const steps = [
    { duration: { value: 5 }, path: [a, b] },
    { duration: { value: 8 }, path: [b, c] },
  ];
  assert.deepEqual(readPoints({ routes: [{ legs: [{ steps }] }] }), [
    { ...a, delay_sec: 0 },
    { ...b, delay_sec: 5 },
    { ...c, delay_sec: 13 },
  ]);
});
