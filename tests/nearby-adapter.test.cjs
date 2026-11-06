const { test } = require('node:test');
const assert = require('node:assert/strict');
const Module = require('node:module');
const flush = () => new Promise((resolve) => setImmediate(resolve));
async function fixture(t, offset = 0, tokenRefresh) {
  t.mock.timers.enable({ apis: ['setTimeout', 'setInterval', 'Date'], now: 1800000000000 });
  const listeners = [],
    updates = [],
    errors = [];
  const writes = [];
  const auth = {
    currentUser: {
      uid: 'me',
      getIdTokenResult:
        tokenRefresh ??
        (async () => ({ issuedAtTime: new Date(Date.now() + offset).toISOString() })),
    },
  };
  const filename =
    require.resolve('../.test-build/features/contacts/data/FirebaseContactRepository');
  delete require.cache[filename];
  const original = Module._load;
  Module._load = function (request, ...args) {
    if (request === '../../../config/firebase/client')
      return { getFirebaseAuth: () => auth, getFirebaseApp: () => ({}) };
    if (request === 'geofire-common')
      return {
        geohashQueryBounds: () => [
          ['a', 'b'],
          ['b', 'c'],
        ],
        distanceBetween: (a, b) => Math.abs(a[0] - b[0]) * 111,
        geohashForLocation: () => 'testhash00',
      };
    if (request === 'firebase/firestore')
      return {
        getFirestore: () => ({}),
        doc: (_db, ...parts) => parts.join('/'),
        getDoc: async () => ({ data: () => ({ fullName: 'Me', avatarUrl: null }) }),
        setDoc: async (ref, data) => {
          writes.push({ ref, data });
        },
        serverTimestamp: () => 'server-time',
        collection: () => 'sharedLocations',
        query: (...parts) => parts,
        where: (...parts) => parts,
        orderBy: (...parts) => parts,
        startAt: (v) => v,
        endAt: (v) => v,
        limit: (v) => v,
        onSnapshot: (q, options, next, error) => {
          assert.equal(options.includeMetadataChanges, true);
          const listener = {
            q,
            next: (snap) => next({ metadata: { fromCache: false }, ...snap }),
            error,
            stopped: false,
          };
          listeners.push(listener);
          return () => {
            listener.stopped = true;
          };
        },
      };
    return original.call(this, request, ...args);
  };
  let repository;
  try {
    repository = new (require(filename).FirebaseContactRepository)();
  } finally {
    Module._load = original;
  }
  const stop = repository.observeNearby(
    'me',
    { latitude: 28.5, longitude: -81.3 },
    (value) => updates.push(value),
    (value) => errors.push(value),
  );
  t.after(stop);
  const row = (id, latitude = 28.5, bucket = Math.floor((Date.now() + offset) / 120000)) => ({
    id,
    data: () => ({ nickname: id, avatarUrl: null, latitude, longitude: -81.3, bucket }),
  });
  await flush();
  return { listeners, updates, errors, stop, row, repository, writes };
}
test('nearby discovery waits for all ranges, deduplicates peers and filters self, distant and expired locations', async (t) => {
  const f = await fixture(t);
  const bucket = Math.floor(Date.now() / 120000);
  f.listeners[0].next({
    docs: [f.row('me'), f.row('bob'), f.row('far', 30), f.row('expired', 28.5, bucket - 3)],
  });
  assert.equal(f.updates.length, 0);
  f.listeners[1].next({ docs: [f.row('bob')] });
  assert.deepEqual(
    f.updates.at(-1).map((user) => user.id),
    ['bob'],
  );
});
test('failed nearby listener reconnects in the same bucket and ignores callbacks from the old query', async (t) => {
  const f = await fixture(t);
  f.listeners[0].error({ code: 'permission-denied' });
  f.listeners[1].next({ docs: [] });
  assert.equal(f.errors.length, 1);
  assert.equal(f.errors[0].message, 'Nearby access was denied. Tap Retry.');
  assert.deepEqual(
    f.updates,
    [[]],
    'a failed range clears markers and partial results cannot restore them',
  );
  t.mock.timers.tick(2000);
  await flush();
  assert.equal(f.listeners.length, 4, 'retry does not wait for the two-minute bucket rollover');
  assert.ok(f.listeners[0].stopped && f.listeners[1].stopped);
  f.listeners[2].next({ docs: [f.row('bob')] });
  f.listeners[3].next({ docs: [] });
  assert.deepEqual(
    f.updates.at(-1).map((user) => user.id),
    ['bob'],
  );
  f.listeners[0].next({ docs: [f.row('old')] });
  f.listeners[1].error({ code: 'failed-precondition' });
  assert.equal(f.errors.length, 1);
  assert.deepEqual(
    f.updates.at(-1).map((user) => user.id),
    ['bob'],
  );
});
test('cached public coordinates cannot restore a marker after it was withdrawn', async (t) => {
  const f = await fixture(t);
  f.listeners[0].next({ docs: [f.row('bob')] });
  f.listeners[1].next({ docs: [] });
  assert.equal(f.updates.at(-1)[0].id, 'bob');
  f.listeners[0].next({ docs: [] });
  f.listeners[0].next({ docs: [f.row('bob')], metadata: { fromCache: true } });
  assert.deepEqual(f.updates.at(-1), []);
});
test('nearby retry backs off and unsubscribing cancels pending reconnection', async (t) => {
  const f = await fixture(t);
  f.listeners[0].error({ code: 'unavailable' });
  f.listeners[1].error({ code: 'unavailable' });
  t.mock.timers.tick(2000);
  await flush();
  assert.equal(f.listeners.length, 4);
  f.listeners[2].error({ code: 'unavailable' });
  t.mock.timers.tick(3999);
  assert.equal(f.listeners.length, 4);
  t.mock.timers.tick(1);
  await flush();
  assert.equal(f.listeners.length, 6);
  f.listeners[4].error({ code: 'unavailable' });
  f.stop();
  t.mock.timers.tick(120000);
  await flush();
  assert.equal(f.listeners.length, 6);
  assert.ok(f.listeners.every((listener) => listener.stopped));
});

test('a device clock fifteen minutes behind still queries and publishes current server leases', async (t) => {
  const offset = 15 * 60000;
  const f = await fixture(t, offset);
  const serverBucket = Math.floor((Date.now() + offset) / 120000);
  assert.deepEqual(f.listeners[0].q[1], ['bucket', 'in', [serverBucket - 1, serverBucket]]);
  f.listeners[0].next({ docs: [f.row('bob')] });
  f.listeners[1].next({ docs: [] });
  const user = f.updates.at(-1)[0];
  assert.equal(user.id, 'bob');
  assert.equal(user.expiresAt, (serverBucket + 2) * 120000 - offset);
  assert.ok(user.expiresAt > Date.now());
  await f.repository.publishPresence('me', { latitude: 28.5, longitude: -81.3 });
  assert.equal(f.writes[0].data.bucket, serverBucket);
});

test('finishing clock synchronization after sharing stops cannot create a nearby listener', async (t) => {
  let finish;
  const f = await fixture(
    t,
    0,
    () =>
      new Promise((resolve) => {
        finish = resolve;
      }),
  );
  assert.equal(f.listeners.length, 0);
  f.stop();
  finish({ issuedAtTime: new Date(Date.now()).toISOString() });
  await flush();
  assert.equal(f.listeners.length, 0);
});
