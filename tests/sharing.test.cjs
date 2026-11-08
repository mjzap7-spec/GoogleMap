const { test } = require('node:test');
const assert = require('node:assert/strict');
const {
  SharingViewModel,
} = require('../.test-build/features/contacts/viewmodels/SharingViewModel');
const flush = () => new Promise((resolve) => setImmediate(resolve));
test('a long shared trip keeps the latest 500 points in recording order and omits older history', () => {
  const { sharedTripTrail } = require('../.test-build/features/contacts/models/sharing');
  const points = Array.from({ length: 1400 }, (_, timestamp) => ({ timestamp }));
  const legs = [points.slice(0, 200), points.slice(200, 1000), points.slice(1000)];
  assert.deepEqual(sharedTripTrail(legs, 120), [points.slice(900, 1000), points.slice(1000)]);
  assert.deepEqual(sharedTripTrail(legs, 1100), [points.slice(1100)]);
  assert.deepEqual(sharedTripTrail(legs, 1500), []);
});
test('group search includes memberships and active listings and drops a left group when retired', () => {
  const { groupList } = require('../.test-build/features/contacts/models/sharing');
  const active = Array.from({ length: 80 }, (_, i) => ({
    id: String(i),
    name: 'Family ' + i,
    memberIds: ['alice'],
    joinedIds: i % 2 ? [] : ['alice'],
    ownerId: 'owner',
  }));
  const directory = [
    { id: '79', name: 'Family 79', discoverable: true },
    { id: 'left', name: 'Family reunion', discoverable: true },
  ];
  assert.equal(groupList(active, directory, '').length, 81);
  assert.deepEqual(
    groupList(active, directory, '   FAMILY 79 ').map((g) => g.id),
    ['79'],
  );
  assert.deepEqual(
    groupList(active, directory, 'reunion').map((g) => g.id),
    ['left'],
  );
  assert.deepEqual(groupList(active, directory.slice(0, 1), 'reunion'), []);
});
const user = { id: 'alice', fullName: 'Alice', avatarUrl: null };
test('group sections follow the creator account across search, invites, joins and leaves', () => {
  const { groupList, groupSections } = require('../.test-build/features/contacts/models/sharing');
  const mine = {
    id: 'a',
    name: 'Park walk',
    ownerId: 'alice',
    joinedIds: ['alice'],
    memberIds: ['alice'],
  };
  const theirs = {
    id: 'b',
    name: 'Park run',
    ownerId: 'bob',
    joinedIds: ['bob'],
    memberIds: ['bob', 'alice'],
  };
  const directory = [mine, theirs].map(({ id, name }) => ({
    id,
    name,
    creatorName: 'Alex',
    discoverable: true,
  }));
  const sections = (groups, filter = '') =>
    groupSections(groupList(groups, directory, filter), 'alice').map((s) => [
      s.key,
      s.data.map((g) => g.id),
    ]);
  assert.deepEqual(sections([mine, theirs]), [
    ['own', ['a']],
    ['other', ['b']],
  ]);
  assert.deepEqual(sections([mine, { ...theirs, joinedIds: ['alice', 'bob'] }]), sections([mine]));
  assert.deepEqual(sections([mine], ' RUN '), [['other', ['b']]]);
  assert.deepEqual(sections([mine], 'missing'), []);
});
test('joined, invited and previously left rows use the same directory metadata', () => {
  const { groupList } = require('../.test-build/features/contacts/models/sharing');
  const summary = {
    id: 'family',
    name: 'Family',
    creatorName: 'Alice',
    createdAt: 1234,
    memberCount: 1,
    discoverable: true,
  };
  const group = {
    id: 'family',
    name: 'Family',
    ownerId: 'alice',
    memberIds: ['alice', 'bob'],
    joinedIds: ['alice'],
  };
  const [invited] = groupList([group], [summary], '');
  assert.equal(invited.creatorName, 'Alice');
  assert.equal(invited.createdAt, 1234);
  assert.equal(invited.memberCount, 1);
  const [joined] = groupList([{ ...group, joinedIds: ['alice', 'bob'] }], [summary], '');
  assert.equal(joined.memberCount, 2);
  assert.deepEqual(groupList([], [summary], ''), [summary]);
});
const group = {
  id: 'family',
  name: 'Family',
  ownerId: 'alice',
  memberIds: ['alice', 'bob'],
  joinedIds: ['alice', 'bob'],
};
function fixture(overrides = {}) {
  const writes = [];
  let preferences, groups, locations;
  const repository = {
    observeDirectory: (_, next) => {
      next([]);
      return () => {};
    },
    observePreferences: (_, next) => {
      preferences = next;
      next({ nearby: false, groups: false });
      return () => {};
    },
    observeGroups: (_, next) => {
      groups = next;
      next([group]);
      return () => {};
    },
    observeLocations: (_, id, next) => {
      locations = next;
      return () => {};
    },
    publish: async (...args) => {
      writes.push(args);
    },
    savePreferences: async () => {},
    ...overrides,
  };
  const model = new SharingViewModel(repository, user);
  model.start();
  return {
    model,
    writes,
    preferences: (value) => preferences(value),
    groups: (value) => groups(value),
    locations: (value) => locations(value),
  };
}

test('stop all sharing cancels a trip immediately, survives a failed save and confirms a retry', async () => {
  let rejectSave, resolveSave;
  const saves = [];
  const f = fixture({
    savePreferences: (...args) => {
      saves.push(args);
      return new Promise((resolve, reject) => {
        rejectSave = reject;
        resolveSave = resolve;
      });
    },
  });
  try {
    f.preferences({ nearby: false, groups: true });
    f.model.setPosition({ latitude: 28, longitude: -81, timestamp: Date.now() }, [], true);
    f.model.startTrip(group);
    await flush();
    const pending = f.model.stopAllSharing();
    assert.equal(f.model.getSnapshot().tripGroupId, '');
    assert.deepEqual(f.model.getSnapshot().preferences, { nearby: false, groups: false });
    assert.equal(f.model.getSnapshot().stopPending, true);
    f.preferences({ nearby: true, groups: false });
    assert.equal(
      f.model.getSnapshot().preferences.nearby,
      false,
      'old remote state cannot restart publishing',
    );
    rejectSave(new Error('offline'));
    await pending;
    assert.equal(f.model.getSnapshot().notice, '');
    assert.equal(f.model.getSnapshot().stopPending, true);
    f.model.startTrip(group);
    assert.equal(f.model.getSnapshot().tripGroupId, '');
    await flush();
    assert.equal(f.writes.at(-1)[2], null);
    assert.deepEqual(saves[0], ['alice', { nearby: false, groups: false }, true]);
    const retry = f.model.stopAllSharing();
    f.preferences({ nearby: false, groups: false });
    resolveSave();
    await retry;
    assert.equal(f.model.getSnapshot().stopPending, false);
    assert.equal(f.model.getSnapshot().error, '');
    assert.equal(f.model.getSnapshot().notice, 'Location and trip sharing stopped.');
    assert.equal(saves.length, 2);
  } finally {
    f.model.dispose();
  }
});

test('a confirmed stop clears the pending state and ordinary sharing audience', async () => {
  const f = fixture();
  try {
    f.preferences({ nearby: true, groups: false });
    await f.model.stopAllSharing();
    assert.equal(f.model.getSnapshot().stopPending, false);
    assert.equal(f.model.getSnapshot().notice, 'Location and trip sharing stopped.');
    assert.deepEqual(f.model.getSnapshot().preferences, { nearby: false, groups: false });
  } finally {
    f.model.dispose();
  }
});
test('the group restriction switches audiences and the main sharing switch allows a complete opt-out', () => {
  const {
    sharingAudience,
    changeSharingAudience,
  } = require('../.test-build/features/contacts/models/sharing');
  const nearby = { nearby: true, groups: false },
    groupOnly = { nearby: false, groups: true },
    hidden = { nearby: false, groups: false };
  assert.deepEqual(sharingAudience(), nearby);
  assert.deepEqual(sharingAudience({ nearby: true, groups: true }), groupOnly);
  assert.deepEqual(changeSharingAudience(nearby, 'groups', true), groupOnly);
  assert.deepEqual(changeSharingAudience(groupOnly, 'groups', false), nearby);
  assert.deepEqual(changeSharingAudience(groupOnly, 'sharing', false), hidden);
  assert.deepEqual(changeSharingAudience(nearby, 'sharing', false), hidden);
  assert.deepEqual(changeSharingAudience(hidden, 'groups', false), hidden);
  assert.deepEqual(changeSharingAudience(hidden, 'groups', true), groupOnly);
  assert.deepEqual(changeSharingAudience(hidden, 'sharing', true), nearby);
  assert.deepEqual(sharingAudience(hidden), hidden);
});

test('map visibility matches all eight viewer, sender and membership combinations', () => {
  const { mapPeople } = require('../.test-build/features/map/models/mapPeople');
  const { changeSharingAudience } = require('../.test-build/features/contacts/models/sharing');
  const person = {
    id: 'A',
    nickname: 'A',
    avatarUrl: null,
    latitude: 28,
    longitude: -81,
    expiresAt: Date.now() + 60000,
  };
  const privateFix = { ...person, groupId: 'friends', trip: false, trail: [] };
  for (const [sameGroup, showNearby, groupsOnly, visible] of [
    [true, true, true, true],
    [true, true, false, true],
    [true, false, true, false],
    [true, false, false, false],
    [false, true, true, false],
    [false, true, false, true],
    [false, false, true, false],
    [false, false, false, false],
  ]) {
    const audience = changeSharingAudience({ nearby: false, groups: true }, 'groups', groupsOnly);
    const nearby = audience.nearby ? [person] : [];
    const groupLocations = audience.groups && sameGroup ? [privateFix] : [];
    const result = mapPeople(showNearby, 'B', nearby, groupLocations, null, null, []);
    assert.deepEqual(
      result.users.map((row) => row.id),
      visible ? ['A'] : [],
      JSON.stringify({ sameGroup, showNearby, groupsOnly }),
    );
  }
  const focus = {
    ...privateFix,
    revision: 1,
    trip: true,
    trail: [[{ latitude: 28, longitude: -81, timestamp: 200 }]],
  };
  assert.deepEqual(mapPeople(false, 'B', [person], [privateFix], focus, focus, []), {
    users: [],
    focus: null,
    sharedTrail: undefined,
  });
});
test('a completed switch save preserves a newer sharing preference from another device', async (t) => {
  let finish;
  const f = fixture({
    savePreferences: () =>
      new Promise((resolve) => {
        finish = resolve;
      }),
  });
  t.after(f.model.dispose);
  const on = { nearby: false, groups: true };
  const off = { nearby: true, groups: false };
  const saving = f.model.savePreferences(on);
  f.preferences(on);
  f.preferences(off);
  finish();
  await saving;
  assert.deepEqual(f.model.getSnapshot().preferences, off);
});
test('private sharing is opt-in and backgrounding revokes an in-flight publish', async () => {
  let release;
  const writes = [];
  const f = fixture({
    publish: async (...args) => {
      writes.push(args);
      if (args[2])
        await new Promise((resolve) => {
          release = resolve;
        });
    },
  });
  const point = { latitude: 28.5, longitude: -81.3, timestamp: Date.now() };
  f.model.setPosition(point, [[point]], true);
  await flush();
  assert.equal(writes.length, 0);
  f.preferences({ nearby: false, groups: true });
  await flush();
  assert.ok(writes[0][2]);
  assert.deepEqual(
    writes[0][3],
    [],
    'ordinary location updates omit the automatically recorded path',
  );
  f.model.setPosition(point, [], false);
  release();
  await flush();
  assert.equal(writes.at(-1)[2], null);
  f.model.dispose();
});
test('trip sharing targets a joined group, excludes earlier history and stops sharing its path', async () => {
  const f = fixture();
  f.model.startTrip(group);
  assert.match(f.model.getSnapshot().error, /GPS/);
  const point = { latitude: 28.5, longitude: -81.3, timestamp: Date.now() };
  f.model.setPosition(point, [[{ ...point, timestamp: 1 }]], true);
  f.model.startTrip(group);
  await flush();
  assert.equal(f.writes.at(-1)[4], true);
  assert.deepEqual(f.writes.at(-1)[3], []);
  f.model.stopTrip();
  await flush();
  assert.equal(f.writes.at(-1)[2], null);
  assert.equal(f.model.getSnapshot().tripGroupId, '');
  f.model.dispose();
});
test('leaving a group clears selected locations and stale callbacks cannot restore them', () => {
  const f = fixture();
  f.model.selectGroup(group.id);
  const location = {
    id: 'bob',
    nickname: 'Bob',
    avatarUrl: null,
    latitude: 1,
    longitude: 1,
    expiresAt: Date.now() + 60000,
    trip: true,
    trail: [],
  };
  f.locations([location]);
  assert.equal(f.model.focusMember('bob'), true);
  assert.equal(f.model.getSnapshot().focus.groupId, group.id);
  f.groups([]);
  assert.equal(f.model.getSnapshot().focus, null);
  assert.deepEqual(f.model.getSnapshot().locations, []);
  f.locations([location]);
  assert.deepEqual(f.model.getSnapshot().locations, []);
  f.model.dispose();
});

test('a shared trip publishes accumulated walking steps and flushes the newest fix, even if movement stops', async (t) => {
  t.mock.timers.enable({ apis: ['Date', 'setTimeout'], now: Date.now() });
  const f = fixture();
  t.after(f.model.dispose);
  f.groups([group, { ...group, id: 'other' }]);
  const fix = (meters) => ({
    latitude: 28 + meters / 111000,
    longitude: -81,
    timestamp: Date.now(),
  });
  const send = (meters) => f.model.setPosition(fix(meters), [], true);
  send(0);
  f.model.startTrip(group);
  await flush();
  for (const meters of [2, 4, 6, 8]) {
    t.mock.timers.tick(250);
    send(meters);
  }
  assert.equal(f.writes.length, 1);
  t.mock.timers.tick(1000);
  await flush();
  assert.equal(f.writes.length, 2);
  assert.equal(f.writes.at(-1)[2].latitude, fix(8).latitude);
  assert.ok(f.writes.every((write) => write[1] === group.id));
  send(16);
  f.model.stopTrip();
  t.mock.timers.tick(3000);
  await flush();
  assert.equal(f.writes.length, 3);
  assert.equal(f.writes.at(-1)[2], null);
});

test('a stale fix cannot start a live marker and a current fix at the same coordinates restores it', async (t) => {
  const f = fixture();
  t.after(f.model.dispose);
  const point = { latitude: 28, longitude: -81, timestamp: Date.now() - 90000 };
  f.model.setPosition(point, [], true);
  f.model.startTrip(group);
  await flush();
  assert.ok(f.writes.every((write) => !write[2]));
  t.mock.timers.enable({ apis: ['Date', 'setTimeout'], now: Date.now() });
  f.model.setPosition({ ...point, timestamp: Date.now() }, [], true);
  t.mock.timers.tick(2000);
  await flush();
  assert.equal(f.writes.at(-1)[2].latitude, 28);
  assert.equal(f.writes.at(-1)[4], true);
});

test('trip paths appear automatically for members and stay separate across travelers and GPS gaps', () => {
  const { mapPeople } = require('../.test-build/features/map/models/mapPeople');
  const point = (x) => ({ latitude: x, longitude: 0, timestamp: Date.now() });
  const traveler = (id, x) => ({
    ...point(x),
    id,
    nickname: id,
    avatarUrl: null,
    groupId: 'family',
    trip: true,
    expiresAt: Date.now() + 60000,
    trail: [[point(x), point(x + 0.001)]],
  });
  const alice = traveler('alice', 28),
    bob = traveler('bob', 29);
  const get = (rows, focus = null) => mapPeople(true, 'me', [], rows, focus, null, []);
  const rows = [
    traveler('me', 30),
    { ...alice, trip: false, latitude: 0 },
    alice,
    bob,
    { ...traveler('old', 10), expiresAt: Date.now() - 1 },
  ];
  const result = get(rows);
  assert.deepEqual(
    result.users.map((u) => [u.id, u.latitude, u.trip]),
    [
      ['alice', 28, true],
      ['bob', 29, true],
    ],
  );
  assert.deepEqual(result.sharedTrail, [alice.trail[0], bob.trail[0]]);
  assert.equal(result.focus, null);
  const following = get(rows, { ...bob, revision: 1 });
  assert.equal(following.focus.id, 'bob');
  assert.deepEqual(following.sharedTrail, bob.trail);
  assert.equal(get([{ ...alice, trip: false }]).sharedTrail, undefined);
});

test('a slow write in another group cannot delay a trip, and a pending trip write cannot undo Stop', async (t) => {
  const blockedGroup = Promise.withResolvers(),
    tripWrite = Promise.withResolvers();
  const writes = [];
  const f = fixture({
    publish: async (_user, id, point, _trail, trip) => {
      writes.push({ id, point, trip });
      if (id === 'other') await blockedGroup.promise;
      if (trip) await tripWrite.promise;
    },
  });
  t.after(f.model.dispose);
  f.groups([{ ...group, id: 'other' }, group]);
  f.preferences({ nearby: false, groups: true });
  f.model.setPosition({ latitude: 28, longitude: -81, timestamp: Date.now() }, [], true);
  f.model.startTrip(group);
  await flush();
  assert.ok(writes.some((w) => w.id === 'family' && w.trip));
  f.model.stopTrip();
  tripWrite.resolve();
  await flush();
  assert.equal(writes.filter((w) => w.id === 'family').at(-1).trip, false);
  blockedGroup.resolve();
  await flush();
});

test('first usable GPS fix publishes immediately even when tracking started before a fix arrived', async () => {
  const f = fixture();
  f.preferences({ nearby: false, groups: true });
  f.model.setPosition(null, [], true);
  await flush();
  assert.equal(f.writes.length, 0);
  const point = { latitude: 28.5, longitude: -81.3, timestamp: Date.now() };
  f.model.setPosition(point, [], true);
  await flush();
  assert.equal(f.writes.length, 1);
  assert.equal(f.writes[0][2], point);
  f.model.dispose();
});

test('all joined groups stream to the map before selection, and departed subscriptions cannot restore markers', (t) => {
  const callbacks = [];
  const f = fixture({
    observeLocations: (_, id, next, error) => {
      const feed = { id, next, error, stopped: false };
      callbacks.push(feed);
      return () => {
        feed.stopped = true;
      };
    },
  });
  t.after(f.model.dispose);
  const other = { ...group, id: 'other', joinedIds: ['alice', 'charlie'] };
  const invite = { ...group, id: 'invite', joinedIds: ['bob'] };
  f.groups([group, other, invite]);
  assert.deepEqual(
    callbacks.map((feed) => feed.id),
    ['family', 'other'],
  );
  assert.equal(f.model.getSnapshot().selectedId, '');
  const bob = { id: 'bob', expiresAt: Date.now() + 60000 };
  const charlie = { ...bob, id: 'charlie' };
  callbacks[0].next([bob, { ...bob, id: 'outsider' }]);
  callbacks[1].next([charlie]);
  assert.deepEqual(
    f.model.getSnapshot().locations.map((row) => row.id),
    ['bob', 'charlie'],
  );
  f.model.selectGroup('other');
  f.model.selectGroup('');
  assert.equal(callbacks.length, 2);
  assert.ok(f.model.focusMember('bob'));
  f.groups([other, invite]);
  assert.ok(callbacks[0].stopped);
  assert.equal(f.model.getSnapshot().focus, null);
  f.groups([group, other]);
  callbacks[0].next([bob]);
  callbacks[0].error(new Error('old error'));
  assert.deepEqual(
    f.model.getSnapshot().locations.map((row) => row.id),
    ['charlie'],
  );
  assert.equal(f.model.getSnapshot().error, '');
  callbacks[2].next([bob]);
  assert.ok(f.model.focusMember('bob'));
  callbacks[2].next([]);
  assert.equal(f.model.getSnapshot().focus, null);
  assert.ok(f.model.focusMember('charlie'));
});

test('repeated start taps and unchanged auth refreshes do not restart sharing or trigger writes', async () => {
  const f = fixture();
  f.model.setPosition({ latitude: 28.5, longitude: -81.3, timestamp: Date.now() }, [], true);
  f.model.startTrip(group);
  await flush();
  const count = f.writes.length;
  f.model.startTrip(group);
  f.model.setUser({ ...user });
  await flush();
  assert.equal(f.writes.length, count);
  f.model.dispose();
});
