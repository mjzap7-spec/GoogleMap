const { test } = require('node:test');
const assert = require('node:assert/strict');
const { locationFreshness } = require('../.test-build/features/map/models/locationFreshness');
const { mapPeople } = require('../.test-build/features/map/models/mapPeople');

test('location status never calls an expired or unknown update live', () => {
  const now = 100000;
  assert.equal(locationFreshness({ expiresAt: now }, now).kind, 'unavailable');
  assert.equal(locationFreshness({ expiresAt: now + 1 }, now).kind, 'unknown');
  assert.equal(
    locationFreshness({ expiresAt: now + 1, updatedAt: now - 59000 }, now).kind,
    'current',
  );
  assert.equal(
    locationFreshness({ expiresAt: now + 1, updatedAt: now - 60000 }, now).kind,
    'stale',
  );
  assert.equal(
    locationFreshness({ expiresAt: now + 1, updatedAt: now + 100 }, now).values.seconds,
    0,
  );
});

test('map filters preserve authorized sources, contact nicknames, timestamps and matching trips', () => {
  const now = Date.now();
  const person = (id) => ({
    id,
    nickname: id,
    avatarUrl: null,
    latitude: 1,
    longitude: 2,
    updatedAt: now,
    expiresAt: now + 10000,
  });
  const nearby = [person('alice'), person('bob'), { ...person('expired'), expiresAt: now - 1 }];
  const route = [
    [
      { latitude: 1, longitude: 2, timestamp: now },
      { latitude: 1, longitude: 2.1, timestamp: now + 1 },
    ],
  ];
  const groups = [{ ...person('carol'), trip: true, groupId: 'friends', trail: route }];
  const contacts = [{ id: 'bob', peerId: 'bob', name: 'Best friend' }];
  const filtered = (filter) =>
    mapPeople(true, 'self', nearby, groups, { ...groups[0], revision: 1 }, null, contacts, filter);
  assert.deepEqual(
    filtered('contacts').users.map((p) => p.id),
    ['bob'],
  );
  assert.equal(filtered('contacts').users[0].nickname, 'Best friend');
  assert.equal(filtered('contacts').users[0].updatedAt, now);
  assert.equal(filtered('contacts').focus, null);
  assert.equal(filtered('contacts').sharedTrail, undefined);
  assert.deepEqual(
    filtered('groups').users.map((p) => p.id),
    ['carol'],
  );
  assert.deepEqual(filtered('groups').sharedTrail, route);
  assert.deepEqual(
    filtered('nearby').users.map((p) => p.id),
    ['alice', 'bob'],
  );
  assert.equal(filtered('all').users.length, 3);
  assert.equal(
    mapPeople(false, 'self', nearby, groups, null, null, contacts, 'all').users.length,
    0,
  );
});
