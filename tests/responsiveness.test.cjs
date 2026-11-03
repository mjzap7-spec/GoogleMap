const { test } = require('node:test');
const assert = require('node:assert/strict');
const {
  OpenMeteoCityRepository,
} = require('../.test-build/features/auth/data/OpenMeteoCityRepository');
const { ProfileViewModel } = require('../.test-build/features/auth/viewmodels/ProfileViewModel');

const result = {
  results: [
    { id: 1, name: 'Orlando', admin1: 'Florida', country: 'United States', feature_code: 'PPL' },
  ],
};
test('city cache avoids repeated requests, expires, and protects cached results from mutation', async () => {
  let calls = 0;
  let now = 0;
  const cities = new OpenMeteoCityRepository(
    async () => {
      calls++;
      return { ok: true, json: async () => result };
    },
    () => now,
  );
  const first = await cities.search('Orlando');
  first[0].label = 'modified';
  first.length = 0;
  const second = await cities.search('  ORLANDO  ');
  assert.equal(calls, 1);
  assert.equal(second[0].label, 'Orlando, Florida, United States');
  now = 5 * 60 * 1000;
  await cities.search('Orlando');
  assert.equal(calls, 2);
});

test('failed city requests are not cached and aborted queries never start a request', async () => {
  let calls = 0;
  const cities = new OpenMeteoCityRepository(async () => {
    calls++;
    if (calls === 1) throw new Error('offline');
    return { ok: true, json: async () => result };
  });
  await assert.rejects(cities.search('Orlando'));
  await cities.search('Orlando');
  assert.equal(calls, 2);
  const controller = new AbortController();
  controller.abort();
  await assert.rejects(cities.search('Orlando', controller.signal));
  assert.equal(calls, 2);
});

test('city cache has a fixed limit and evicts the least recently used query', async () => {
  let calls = 0;
  const cities = new OpenMeteoCityRepository(async () => {
    calls++;
    return { ok: true, json: async () => result };
  });
  for (let i = 0; i < 32; i++) await cities.search(`city-${i}`);
  await cities.search('city-0');
  await cities.search('new-city');
  await cities.search('city-0');
  assert.equal(calls, 33);
  await cities.search('city-1');
  assert.equal(calls, 34);
});

test('unchanged profiles skip backend writes; an edit saves once, then skips again', async () => {
  let writes = 0;
  const model = new ProfileViewModel(
    {
      saveProfile: async () => {
        writes++;
        return null;
      },
    },
    { pick: async () => null },
    { search: async () => [] },
    {
      id: 'one',
      email: 'person@example.com',
      fullName: 'Alex',
      birthday: '2000-01-01',
      location: 'Orlando, Florida, United States',
    },
  );
  await model.save();
  assert.equal(writes, 0);
  assert.match(model.getSnapshot().notice, /up to date/);
  model.setFullName('Alex Taylor');
  await model.save();
  assert.equal(writes, 1);
  await model.save();
  assert.equal(writes, 1);
  model.dispose();
});
