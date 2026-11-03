const { test } = require('node:test');
const assert = require('node:assert/strict');
const { StoredProfileCache } = require('../.test-build/features/auth/data/StoredProfileCache');
const { createFirebaseFixture } = require('./helpers/firebaseSdkFixture.cjs');
const profile = {
  fullName: 'Alex',
  birthday: '2000-01-01',
  location: 'Orlando, Florida, United States',
  avatarUrl: null,
};
const flush = () => new Promise((resolve) => setImmediate(resolve));

test('profile cache isolates users, rejects expired/malformed data, and removes incomplete profiles', async () => {
  let now = 1000;
  const values = new Map();
  const storage = {
    getItem: async (key) => values.get(key) ?? null,
    setItem: async (key, value) => {
      values.set(key, value);
    },
    removeItem: async (key) => {
      values.delete(key);
    },
  };
  const cache = new StoredProfileCache(storage, () => now);
  await cache.write('one', profile);
  assert.deepEqual(await cache.read('one'), profile);
  assert.equal(await cache.read('two'), null);
  now += 8 * 24 * 60 * 60 * 1000;
  assert.equal(await cache.read('one'), null);
  await cache.write('one', profile);
  await cache.write('one', { ...profile, birthday: '' });
  assert.equal(await cache.read('one'), null);
  values.set('google-map:profile:v1:one', '{bad');
  assert.equal(await cache.read('one'), null);
});
test('cached profile renders before the server, then yields to fresh fields and survives an offline listener', async () => {
  const writes = [];
  const fixture = createFirebaseFixture({
    profileCache: {
      read: async () => profile,
      write: async (...args) => {
        writes.push(args);
      },
    },
  });
  const updates = [];
  const stop = fixture.repository.observeSession(
    (user) => updates.push(user),
    () => {},
  );
  fixture.authChanged(fixture.user);
  await flush();
  assert.equal(updates.at(-1).profileStatus, 'ready');
  assert.equal(updates.at(-1).fullName, 'Alex');
  fixture.profileChanged({ ...profile, fullName: 'Updated' }, { fromCache: false });
  assert.equal(updates.at(-1).fullName, 'Updated');
  assert.equal(writes.at(-1)[0], fixture.user.uid);
  fixture.profileError();
  assert.equal(updates.at(-1).profileStatus, 'ready');
  stop();
});
test('late profile cache never overwrites a server result or crosses an account change', async () => {
  let finish;
  const fixture = createFirebaseFixture({
    profileCache: {
      read: () =>
        new Promise((resolve) => {
          finish = resolve;
        }),
      write: async () => {},
    },
  });
  const updates = [];
  const stop = fixture.repository.observeSession(
    (user) => updates.push(user),
    () => {},
  );
  fixture.authChanged(fixture.user);
  fixture.profileChanged({ ...profile, fullName: 'Fresh' }, { fromCache: false });
  finish(profile);
  await flush();
  assert.equal(updates.at(-1).fullName, 'Fresh');
  fixture.authChanged({ ...fixture.user, uid: 'other' });
  fixture.authChanged(null);
  finish(profile);
  await flush();
  assert.equal(updates.at(-1), null);
  stop();
});
