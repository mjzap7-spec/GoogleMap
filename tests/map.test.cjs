const { test } = require('node:test');
const assert = require('node:assert/strict');
const { labelExpression } = require('../.test-build/features/map/models/map');
const { MapViewModel } = require('../.test-build/features/map/viewmodels/MapViewModel');
const { StoredMapPreferences } = require('../.test-build/features/map/data/StoredMapPreferences');
const flush = () => new Promise((resolve) => setImmediate(resolve));
test('map language persists, ignores invalid values, and a late preference read cannot override a selection', async () => {
  let finish;
  const writes = [];
  const model = new MapViewModel({
    readLanguage: () =>
      new Promise((resolve) => {
        finish = resolve;
      }),
    writeLanguage: async (value) => {
      writes.push(value);
    },
  });
  model.start();
  model.setLanguage('es');
  finish('de');
  await flush();
  assert.equal(model.getSnapshot().language, 'es');
  assert.deepEqual(writes, ['es']);
  model.setLanguage('invalid');
  assert.equal(model.getSnapshot().language, 'es');
  model.dispose();
  const values = new Map();
  const preferences = new StoredMapPreferences({
    getItem: async (key) => values.get(key) ?? null,
    setItem: async (key, value) => {
      values.set(key, value);
    },
  });
  await preferences.writeLanguage('ja');
  assert.equal(await preferences.readLanguage(), 'ja');
  assert.deepEqual(labelExpression('es').slice(0, 3), [
    'coalesce',
    ['get', 'name:es'],
    ['get', 'name_es'],
  ]);
});
