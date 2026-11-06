const { test } = require('node:test');
const assert = require('node:assert/strict');
const {
  ContactsViewModel,
} = require('../.test-build/features/contacts/viewmodels/ContactsViewModel');
const {
  ContactEditorViewModel,
} = require('../.test-build/features/contacts/viewmodels/ContactEditorViewModel');
const {
  ContactFailure,
  normalizeContactEmail,
} = require('../.test-build/features/contacts/models/contact');
const flush = () => new Promise((resolve) => setImmediate(resolve));
const point = { latitude: 28.5, longitude: -81.3, timestamp: Date.now(), accuracy: 5 };
const request = { id: 'a_b', fromId: 'a', fromName: 'Alice', fromEmail: 'alice@example.com' };
const contact = {
  id: 'a',
  peerId: 'a',
  name: 'Friend',
  fullName: 'Alice',
  email: 'alice@example.com',
  birthday: '2000-01-01',
  profileLocation: 'Orlando',
};
function repository(overrides = {}) {
  return {
    observe: (_id, next) => {
      next([contact]);
      return () => {};
    },
    add: async () => ({ id: 'legacy', name: 'Legacy' }),
    ...overrides,
  };
}
test('email normalization and request form reject invalid input and prevent duplicate submissions', async () => {
  assert.equal(normalizeContactEmail(' Alice@Example.com '), 'alice@example.com');
  assert.throws(() => normalizeContactEmail('bad/name@example.com'));
  let finish;
  const calls = [];
  const model = new ContactsViewModel(
    repository({
      sendRequest: async (_id, email) => {
        calls.push(email);
        await new Promise((resolve) => (finish = resolve));
      },
    }),
    'me',
  );
  model.start();
  model.openForm();
  model.setEmail('invalid');
  await model.sendRequest();
  assert.equal(calls.length, 0);
  model.setEmail(' Alice@Example.com ');
  const pending = model.sendRequest();
  await model.sendRequest();
  assert.equal(calls.length, 1);
  assert.equal(model.getSnapshot().busy, true);
  finish();
  await pending;
  assert.equal(calls[0], 'alice@example.com');
  assert.equal(model.getSnapshot().formOpen, false);
  assert.match(model.getSnapshot().notice, /sent/);
  model.dispose();
});
test('each outgoing contact request confirms once across screens, including requests from the map', async (t) => {
  const requests = [];
  const confirmations = [];
  const model = new ContactsViewModel(
    repository({
      sendRequest: async (_id, email) => requests.push(email),
      sendRequestToUser: async (_id, peer) => requests.push(peer),
    }),
    'me',
  );
  t.after(() => model.dispose());
  model.start();
  const observe = () => model.observeNotices((message) => confirmations.push(message));
  const leave = observe();
  const leaveSecondObserver = observe();
  model.openForm();
  model.setEmail('friend@example.com');
  await model.sendRequest();
  leave();
  leaveSecondObserver();
  const leaveNextScreen = observe();
  model.closeMapUser();
  assert.deepEqual(confirmations, ['Contact request sent.']);

  model.setShowNearby(true);
  model.selectSharedUser({
    id: 'another-friend',
    nickname: 'Another friend',
    ...point,
    expiresAt: Date.now() + 60_000,
  });
  await model.requestSelectedUser();
  await model.requestSelectedUser();
  leaveNextScreen();
  const leaveOnReturn = observe();
  t.after(leaveOnReturn);
  assert.deepEqual(requests, ['friend@example.com', 'another-friend']);
  assert.deepEqual(confirmations, ['Contact request sent.', 'Contact request sent.']);
});
test('requests notify once and only confirmed responses remove a pending request', async () => {
  let notify;
  let fail = true;
  let calls = 0;
  const model = new ContactsViewModel(
    repository({
      observeRequests: (_id, next) => {
        notify = next;
        return () => {};
      },
      respond: async () => {
        calls++;
        if (fail) throw new ContactFailure('Offline');
      },
    }),
    'me',
  );
  model.start();
  notify([request]);
  assert.equal(model.getSnapshot().inboxOpen, true);
  model.closeInbox();
  notify([request]);
  assert.equal(model.getSnapshot().inboxOpen, false);
  await model.respond(request, true);
  assert.equal(model.getSnapshot().requests.length, 1);
  assert.match(model.getSnapshot().error, /Offline/);
  fail = false;
  await model.respond(request, false);
  assert.equal(model.getSnapshot().requests.length, 0);
  assert.equal(calls, 2);
  model.dispose();
});
test('presence is automatic and background revocation wins over an in-flight location publish', async (t) => {
  let finish;
  const writes = [];
  let stopped = 0;
  const model = new ContactsViewModel(
    repository({
      observeNearby: (_id, _point, next) => {
        next([]);
        return () => stopped++;
      },
      publishPresence: async (_id, value) => {
        writes.push(value);
        if (value) await new Promise((resolve) => (finish = resolve));
      },
    }),
    'me',
  );
  t.after(() => model.dispose());
  model.start();
  model.setPosition(point, true);
  assert.equal(writes.length, 1);
  model.setShowNearby(true);
  assert.equal(writes.length, 1);
  model.setShowNearby(false);
  model.setPosition(null, false);
  finish();
  await flush();
  assert.deepEqual(writes, [point, null]);
  model.setPosition(null, false);
  assert.equal(stopped, 1);
});
test('late request results and presence observers cannot cross disposal', async () => {
  let finish;
  let notify;
  const model = new ContactsViewModel(
    repository({
      sendRequest: async () => new Promise((resolve) => (finish = resolve)),
      observeRequests: (_id, next) => {
        notify = next;
        return () => {};
      },
    }),
    'me',
  );
  model.start();
  model.openForm();
  model.setEmail('friend@example.com');
  const pending = model.sendRequest();
  model.dispose();
  const before = model.getSnapshot();
  finish();
  await pending;
  notify([request]);
  assert.equal(model.getSnapshot(), before);
});
test('contact nickname selection focuses a recent shared location and reports missing sharing', async () => {
  let shared = true;
  const model = new ContactsViewModel(
    repository({
      sharedLocation: async () =>
        shared
          ? {
              id: 'a',
              nickname: 'Alice',
              avatarUrl: null,
              latitude: 28,
              longitude: -81,
              expiresAt: Date.now() + 60000,
            }
          : null,
    }),
    'me',
  );
  model.start();
  model.setShowNearby(true);
  await model.locateContact(contact);
  assert.equal(model.getSnapshot().focus.nickname, 'Friend');
  const first = model.getSnapshot().focus.revision;
  await model.locateContact(contact);
  assert.ok(model.getSnapshot().focus.revision > first);
  shared = false;
  await model.locateContact(contact);
  assert.match(model.getSnapshot().error, /not sharing/);
  model.dispose();
});
test('contact editor changes only the private nickname and never overwrites a dirty draft', async () => {
  let notify;
  const saves = [];
  const model = new ContactEditorViewModel(
    repository({
      observe: (_id, next) => {
        notify = next;
        next([contact]);
        return () => {};
      },
      observeDetails: (_id, value, next) => {
        next(value);
        return () => {};
      },
      rename: async (...args) => saves.push(args),
    }),
    'me',
    'a',
  );
  model.start();
  model.setNickname(' Best friend ');
  notify([{ ...contact, name: 'Server name' }]);
  await flush();
  assert.equal(model.getSnapshot().nickname, ' Best friend ');
  await model.save();
  assert.equal(saves[0][2], 'Best friend');
  assert.equal(model.getSnapshot().contact.birthday, '2000-01-01');
  assert.equal(model.getSnapshot().done, true);
  model.dispose();
});
test('saving an unchanged contact nickname finishes without a Firestore write', async () => {
  let writes = 0;
  const model = new ContactEditorViewModel(repository({ rename: async () => writes++ }), 'me', 'a');
  model.start();
  model.setNickname(' ' + contact.name + ' ');
  await model.save();
  assert.equal(writes, 0);
  assert.equal(model.getSnapshot().done, true);
  model.dispose();
});
test('contact deletion waits for success and errors remain editable', async () => {
  let fail = true;
  const model = new ContactEditorViewModel(
    repository({
      remove: async () => {
        if (fail) throw new ContactFailure('Offline');
      },
    }),
    'me',
    'a',
  );
  model.start();
  await model.remove();
  assert.equal(model.getSnapshot().done, false);
  assert.match(model.getSnapshot().error, /Offline/);
  fail = false;
  await model.remove();
  assert.equal(model.getSnapshot().done, true);
  model.dispose();
});
test('map selection validates identities and expiry; existing contacts can never receive another request', async () => {
  let notifyNearby, notifyContacts;
  const calls = [];
  const stranger = {
    id: 'b',
    nickname: 'Bob',
    avatarUrl: null,
    latitude: 28,
    longitude: -81,
    expiresAt: Date.now() + 60000,
  };
  const model = new ContactsViewModel(
    repository({
      observe: (_id, next) => {
        notifyContacts = next;
        next([]);
        return () => {};
      },
      observeNearby: (_id, _point, next) => {
        notifyNearby = next;
        next([stranger]);
        return () => {};
      },
      sendRequestToUser: async (...args) => calls.push(args),
    }),
    'me',
  );
  model.start();
  model.setPosition(point, true);
  model.setShowNearby(true);
  model.selectMapUser('unknown');
  assert.equal(model.getSnapshot().selectedUser, null);
  model.selectMapUser('b');
  assert.equal(model.getSnapshot().selectedUser.nickname, 'Bob');
  notifyContacts([{ id: 'b', peerId: 'b', name: 'My friend' }]);
  await model.requestSelectedUser();
  assert.equal(calls.length, 0);
  notifyContacts([]);
  await model.requestSelectedUser();
  assert.deepEqual(calls, [['me', 'b']]);
  await model.requestSelectedUser();
  assert.equal(calls.length, 1);
  model.closeMapUser();
  notifyNearby([{ ...stranger, expiresAt: Date.now() - 1 }]);
  model.selectMapUser('b');
  assert.equal(model.getSnapshot().selectedUser, null);
  model.dispose();
});
test('map requests prevent duplicate taps, show recoverable errors, and ignore results after sign-out', async () => {
  let finish;
  let calls = 0;
  const stranger = {
    id: 'b',
    nickname: 'Bob',
    avatarUrl: null,
    latitude: 28,
    longitude: -81,
    expiresAt: Date.now() + 60000,
  };
  const model = new ContactsViewModel(
    repository({
      observe: (_id, next) => {
        next([]);
        return () => {};
      },
      observeNearby: (_id, _point, next) => {
        next([stranger]);
        return () => {};
      },
      sendRequestToUser: async () => {
        calls++;
        await new Promise((resolve) => (finish = resolve));
      },
    }),
    'me',
  );
  model.start();
  model.setPosition(point, true);
  model.setShowNearby(true);
  model.selectMapUser('b');
  const pending = model.requestSelectedUser();
  await model.requestSelectedUser();
  model.closeMapUser();
  assert.equal(calls, 1);
  assert.equal(model.getSnapshot().mapRequestBusy, true);
  assert.ok(model.getSnapshot().selectedUser);
  model.dispose();
  const snapshot = model.getSnapshot();
  finish();
  await pending;
  assert.equal(model.getSnapshot(), snapshot);
});
test('contact location focus survives returning from the contact manager to the map', async () => {
  const model = new ContactsViewModel(
    repository({
      sharedLocation: async () => ({
        id: 'a',
        nickname: 'Alice',
        avatarUrl: null,
        latitude: 28,
        longitude: -81,
        expiresAt: Date.now() + 60000,
      }),
    }),
    'me',
  );
  model.start();
  model.setShowNearby(true);
  await model.locateContact(contact);
  model.setPosition(null, false);
  assert.equal(model.getSnapshot().focus.id, 'a');
  assert.equal(model.getSnapshot().focus.nickname, 'Friend');
  model.dispose();
});
test('failed map requests stay editable and retry successfully without changing the selected identity', async () => {
  let fail = true;
  const stranger = {
    id: 'b',
    nickname: 'Bob',
    avatarUrl: null,
    latitude: 28,
    longitude: -81,
    expiresAt: Date.now() + 60000,
  };
  const model = new ContactsViewModel(
    repository({
      observe: (_id, next) => {
        next([]);
        return () => {};
      },
      observeNearby: (_id, _point, next) => {
        next([stranger]);
        return () => {};
      },
      sendRequestToUser: async () => {
        if (fail) throw new ContactFailure('Offline');
      },
    }),
    'me',
  );
  model.start();
  model.setPosition(point, true);
  model.setShowNearby(true);
  model.selectMapUser('b');
  await model.requestSelectedUser();
  assert.match(model.getSnapshot().mapRequestError, /Offline/);
  assert.equal(model.getSnapshot().mapRequestBusy, false);
  assert.equal(model.getSnapshot().selectedUser.id, 'b');
  fail = false;
  await model.requestSelectedUser();
  assert.equal(model.getSnapshot().mapRequestError, '');
  assert.deepEqual(model.getSnapshot().requestedUserIds, ['b']);
  model.dispose();
});
test('Show Nearby Users starts and stops nearby subscriptions instead of querying while switched off', () => {
  let subscriptions = 0,
    stops = 0;
  const model = new ContactsViewModel(
    repository({
      observeNearby: (_uid, _point, next) => {
        subscriptions++;
        next([
          {
            id: 'b',
            nickname: 'Bob',
            avatarUrl: null,
            latitude: 28,
            longitude: -81,
            expiresAt: Date.now() + 60000,
          },
        ]);
        return () => stops++;
      },
    }),
    'me',
  );
  model.start();
  model.setPosition(point, true);
  assert.equal(subscriptions, 0);
  model.setShowNearby(true);
  assert.equal(subscriptions, 1);
  assert.equal(model.getSnapshot().nearby.length, 1);
  model.setShowNearby(false);
  assert.equal(stops, 1);
  assert.equal(model.getSnapshot().nearby.length, 0);
  model.dispose();
});
test('stopped nearby listeners cannot restore users or errors after sharing is disabled or a new query starts', () => {
  const listeners = [];
  const model = new ContactsViewModel(
    repository({
      observeNearby: (_uid, _point, next, error) => {
        listeners.push({ next, error });
        return () => {};
      },
    }),
    'me',
  );
  const user = {
    id: 'b',
    nickname: 'Bob',
    avatarUrl: null,
    latitude: 28,
    longitude: -81,
    expiresAt: Date.now() + 60000,
  };
  model.start();
  model.setPosition(point, true);
  model.setShowNearby(true);
  listeners[0].next([user]);
  model.setShowNearby(false);
  const off = model.getSnapshot();
  listeners[0].next([user]);
  listeners[0].error(new ContactFailure('Late error'));
  assert.equal(model.getSnapshot(), off);
  model.setPosition({ ...point, timestamp: point.timestamp + 1000 }, true);
  assert.equal(model.getSnapshot(), off, 'idle GPS fixes do not redraw unchanged contact state');
  model.setShowNearby(true);
  listeners[1].next([{ ...user, nickname: 'Current' }]);
  listeners[0].next([user]);
  assert.equal(model.getSnapshot().nearby[0].nickname, 'Current');
  model.dispose();
});
test('equivalent nearby snapshots preserve the map and user-card references without extra rendering', () => {
  let emit;
  const user = {
    id: 'b',
    nickname: 'Bob',
    avatarUrl: null,
    latitude: 28,
    longitude: -81,
    expiresAt: Date.now() + 60000,
  };
  const model = new ContactsViewModel(
    repository({
      observeNearby: (_id, _point, next) => {
        emit = next;
        return () => {};
      },
    }),
    'me',
  );
  model.start();
  model.setPosition(point, true);
  model.setShowNearby(true);
  emit([user]);
  model.selectMapUser('b');
  const snapshot = model.getSnapshot();
  emit([{ ...user }]);
  assert.equal(model.getSnapshot(), snapshot);
  emit([{ ...user, nickname: 'Updated', expiresAt: user.expiresAt + 60000 }]);
  assert.equal(model.getSnapshot().selectedUser.nickname, 'Updated');
  model.dispose();
});
test('accepted map requests clear their pending badge so a deleted contact can be requested again', async () => {
  let contacts;
  let calls = 0;
  const user = {
    id: 'b',
    nickname: 'Bob',
    avatarUrl: null,
    latitude: 28,
    longitude: -81,
    expiresAt: Date.now() + 60000,
  };
  const model = new ContactsViewModel(
    repository({
      observe: (_id, next) => {
        contacts = next;
        next([]);
        return () => {};
      },
      observeNearby: (_id, _point, next) => {
        next([user]);
        return () => {};
      },
      sendRequestToUser: async () => {
        calls++;
      },
    }),
    'me',
  );
  model.start();
  model.setPosition(point, true);
  model.setShowNearby(true);
  model.selectMapUser('b');
  await model.requestSelectedUser();
  contacts([{ id: 'b', peerId: 'b', name: 'Bob' }]);
  assert.deepEqual(model.getSnapshot().requestedUserIds, []);
  contacts([]);
  await model.requestSelectedUser();
  assert.equal(calls, 2);
  model.dispose();
});

test('departed or expired nearby users disappear from markers and the open user card', () => {
  let emit;
  const user = {
    id: 'b',
    nickname: 'Bob',
    avatarUrl: null,
    latitude: 28,
    longitude: -81,
    expiresAt: Date.now() + 60000,
  };
  const model = new ContactsViewModel(
    repository({
      observeNearby: (_id, _point, next) => {
        emit = next;
        return () => {};
      },
    }),
    'me',
  );
  model.start();
  model.setPosition(point, true);
  model.setShowNearby(true);
  emit([user]);
  model.selectMapUser('b');
  assert.equal(model.getSnapshot().selectedUser.id, 'b');
  emit([]);
  assert.equal(model.getSnapshot().selectedUser, null);
  emit([user]);
  model.selectMapUser('b');
  emit([{ ...user, expiresAt: Date.now() - 1 }]);
  assert.deepEqual(model.getSnapshot().nearby, []);
  assert.equal(model.getSnapshot().selectedUser, null);
  model.dispose();
});

test('nearby Retry restarts discovery and republishes the current GPS point without restarting contacts', async () => {
  let subscriptions = 0,
    contactSubscriptions = 0,
    stopped = 0;
  const published = [];
  const model = new ContactsViewModel(
    repository({
      observe: (_id, next) => {
        contactSubscriptions++;
        next([]);
        return () => {};
      },
      observeNearby: (_id, _point, _next, error) => {
        subscriptions++;
        error(new ContactFailure('Offline'));
        return () => stopped++;
      },
      publishPresence: async (_id, fix) => {
        published.push(fix);
      },
    }),
    'me',
  );
  model.start();
  model.setPosition(point, true);
  model.setShowNearby(true);
  await flush();
  assert.equal(model.getSnapshot().nearbyError, 'Offline');
  model.retryNearby();
  await flush();
  assert.equal(subscriptions, 2);
  assert.equal(stopped, 1);
  assert.equal(contactSubscriptions, 1);
  assert.deepEqual(published, [point, point]);
  model.setShowNearby(false);
  model.retryNearby();
  assert.equal(subscriptions, 2, 'Retry does not enable nearby discovery');
  model.dispose();
});

test('only the viewer enables nearby display; every active signed-in peer publishes automatically', async (t) => {
  const presence = new Map(),
    watchers = new Map();
  const notify = () => {
    for (const [owner, next] of watchers)
      next([...presence.values()].filter((user) => user.id !== owner));
  };
  const repo = repository({
    observe: (_id, next) => {
      next([]);
      return () => {};
    },
    publishPresence: async (id, fix) => {
      if (fix)
        presence.set(id, {
          id,
          nickname: id,
          avatarUrl: null,
          latitude: fix.latitude,
          longitude: fix.longitude,
          expiresAt: Date.now() + 120000,
        });
      else presence.delete(id);
      notify();
    },
    observeNearby: (id, _point, next) => {
      watchers.set(id, next);
      notify();
      return () => watchers.delete(id);
    },
  });
  const viewer = new ContactsViewModel(repo, 'viewer');
  const peer = new ContactsViewModel(repo, 'peer');
  t.after(() => {
    viewer.dispose();
    peer.dispose();
  });
  viewer.start();
  peer.start();
  viewer.setPosition(point, true);
  peer.setPosition({ ...point, latitude: point.latitude + 0.001 }, true);
  await flush();
  assert.equal(peer.getSnapshot().showNearby, false);
  assert.ok(presence.has('peer'), 'peer publishes even with nearby display off');
  viewer.setShowNearby(true);
  assert.deepEqual(
    viewer.getSnapshot().nearby.map((user) => user.id),
    ['peer'],
  );
  assert.deepEqual(peer.getSnapshot().nearby, []);
  viewer.setShowNearby(false);
  assert.ok(presence.has('viewer'), 'hiding markers does not remove the viewer presence');
  viewer.setShowNearby(true);
  peer.setPosition(null, false);
  await flush();
  assert.deepEqual(viewer.getSnapshot().nearby, [], 'backgrounded peers disappear');
});

test('selecting an already visible contact immediately centers on its fresh location without another backend read', async () => {
  const user = {
    id: 'a',
    nickname: 'Alice',
    avatarUrl: null,
    latitude: 28.5,
    longitude: -81.3,
    expiresAt: Date.now() + 60000,
  };
  let reads = 0;
  const model = new ContactsViewModel(
    repository({
      observeNearby: (_id, _point, next) => {
        next([user]);
        return () => {};
      },
      sharedLocation: async () => {
        reads++;
        throw new Error('should use visible location');
      },
    }),
    'me',
  );
  model.start();
  model.setPosition(point, true);
  model.setShowNearby(true);
  const selected = model.locateContact(contact);
  assert.equal(model.getSnapshot().focus.id, 'a');
  assert.equal(model.getSnapshot().focus.nickname, 'Friend');
  const revision = model.getSnapshot().focus.revision;
  await selected;
  await model.locateContact(contact);
  assert.ok(
    model.getSnapshot().focus.revision > revision,
    'reselecting the same contact centers it again',
  );
  assert.equal(reads, 0);
  model.dispose();
});

test('a revoked public location clears an already focused contact and an old listener cannot restore it', async (t) => {
  const location = {
    id: 'a',
    nickname: 'Alice',
    avatarUrl: null,
    ...point,
    expiresAt: Date.now() + 60000,
  };
  let receive;
  let stopped = 0;
  const model = new ContactsViewModel(
    repository({
      sharedLocation: async () => location,
      observeSharedLocation: (_, id, next) => {
        assert.equal(id, 'a');
        receive = next;
        return () => {
          stopped++;
        };
      },
    }),
    'outside',
  );
  t.after(model.dispose);
  model.start();
  model.setShowNearby(true);
  await model.locateContact(contact);
  model.selectMapUser('a');
  assert.equal(model.getSnapshot().focus.id, 'a');
  receive(null);
  receive(location);
  assert.equal(stopped, 1);
  assert.equal(model.getSnapshot().focus, null);
  assert.equal(model.getSnapshot().selectedUser, null);
});

test('switching off hides a pending contact lookup even if viewing is switched on again', async (t) => {
  let resolveLocation;
  let reads = 0;
  const model = new ContactsViewModel(
    repository({
      sharedLocation: () => {
        reads++;
        return new Promise((resolve) => {
          resolveLocation = resolve;
        });
      },
    }),
    'viewer',
  );
  t.after(model.dispose);
  model.start();
  await model.locateContact(contact);
  assert.equal(reads, 0);
  model.setShowNearby(true);
  const lookup = model.locateContact(contact);
  model.setShowNearby(false);
  model.setShowNearby(true);
  resolveLocation({ id: 'a', nickname: 'A', ...point, expiresAt: Date.now() + 60000 });
  await lookup;
  assert.equal(model.getSnapshot().focus, null);
});
