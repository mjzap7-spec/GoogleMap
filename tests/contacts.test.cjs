const assert = require('node:assert/strict');
const { test } = require('node:test');
const {
  ContactsViewModel,
} = require('../.test-build/features/contacts/viewmodels/ContactsViewModel');
const { ContactFailure } = require('../.test-build/features/contacts/models/contact');
const Module = require('node:module');

function adapterFixture() {
  const auth = { currentUser: { uid: 'owner' } };
  let changed, listenerError;
  const writes = [];
  const filename =
    require.resolve('../.test-build/features/contacts/data/FirebaseContactRepository');
  delete require.cache[filename];
  const original = Module._load;
  Module._load = function (request, ...args) {
    if (request === '../../../config/firebase/client')
      return { getFirebaseAuth: () => auth, getFirebaseApp: () => ({}) };
    if (request === 'firebase/firestore')
      return {
        getFirestore: () => ({}),
        collection: (db, ...path) => path.join('/'),
        doc: (path) => ({ path, id: 'saved' }),
        serverTimestamp: () => 'server-time',
        setDoc: async (ref, data) => {
          writes.push({ ref, data });
        },
        onSnapshot: (path, options, next, error) => {
          changed = next;
          listenerError = error;
          assert.equal(path, 'users/owner/contacts');
          assert.equal(options.includeMetadataChanges, true);
          return () => {};
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
  return {
    repository,
    auth,
    writes,
    emit: (docs) => changed({ docs }),
    fail: (error) => listenerError(error),
  };
}

test('contact adapter writes only a trimmed name and server timestamp under the signed-in owner', async () => {
  const f = adapterFixture();
  assert.deepEqual(await f.repository.add('owner', ' Alex '), { id: 'saved', name: 'Alex' });
  assert.deepEqual(f.writes, [
    {
      ref: { path: 'users/owner/contacts', id: 'saved' },
      data: { name: 'Alex', createdAt: 'server-time' },
    },
  ]);
  await assert.rejects(f.repository.add('other', 'Alex'), /session changed/);
  await assert.rejects(f.repository.add('owner', '   '), /contact name/);
  assert.equal(f.writes.length, 1);
});
test('contact adapter sorts acknowledged names and ignores pending writes and switched accounts', () => {
  const f = adapterFixture();
  let contacts, error;
  f.repository.observe(
    'owner',
    (value) => {
      contacts = value;
    },
    (value) => {
      error = value;
    },
  );
  const row = (id, name, pending = false) => ({
    id,
    data: () => ({ name }),
    metadata: { hasPendingWrites: pending },
  });
  f.emit([row('b', 'Blair'), row('a', 'Alex'), row('p', 'Pending', true), row('bad', null)]);
  assert.deepEqual(
    contacts.map((item) => item.name),
    ['Alex', 'Blair'],
  );
  f.fail({ code: 'permission-denied' });
  assert.match(error.message, /Firestore rules/);
  f.auth.currentUser = { uid: 'other' };
  f.emit([row('x', 'Other account')]);
  assert.deepEqual(
    contacts.map((item) => item.name),
    ['Alex', 'Blair'],
  );
});

test('unchanged Firestore metadata does not redraw contacts but nickname changes still arrive', () => {
  const f = adapterFixture();
  const updates = [];
  f.repository.observe('owner', (contacts) => updates.push(contacts), assert.fail);
  const row = (name) => ({
    id: 'a',
    data: () => ({ name }),
    metadata: { hasPendingWrites: false },
  });
  f.emit([row('Alex')]);
  f.emit([row('Alex')]);
  f.emit([{ ...row('New nickname'), metadata: { hasPendingWrites: true } }]);
  assert.equal(updates.length, 1);
  f.emit([row('New nickname')]);
  assert.equal(updates.length, 2);
  assert.equal(updates[1][0].name, 'New nickname');
  f.emit([]);
  assert.deepEqual(updates[2], []);
});

test('Firestore precondition errors distinguish a real missing index from retained connection settings', () => {
  const f = adapterFixture();
  let error;
  f.repository.observe(
    'owner',
    () => {},
    (value) => {
      error = value;
    },
  );
  f.fail({
    code: 'failed-precondition',
    message: 'The query requires an index. You can create it here.',
  });
  assert.match(error.message, /Firestore indexes/);
  f.fail({
    code: 'failed-precondition',
    message: 'initializeFirestore() has already been called with different options.',
  });
  assert.match(error.message, /Reload the app.*connection settings/);
  f.fail({
    code: 'failed-precondition',
    message: 'Firestore has already been started and its settings can no longer be changed.',
  });
  assert.match(error.message, /Reload the app.*connection settings/);
  f.fail({ code: 'failed-precondition', message: 'Database not ready' });
  assert.match(error.message, /not ready/);
  assert.doesNotMatch(error.message, /indexes/);
});

function fixture(add) {
  const stored = [];
  let changed,
    failed,
    stopped = 0,
    calls = 0;
  const repository = {
    observe: (uid, success, error) => {
      assert.equal(uid, 'owner');
      changed = success;
      failed = error;
      success([...stored]);
      return () => {
        stopped++;
      };
    },
    add: async (uid, name) => {
      assert.equal(uid, 'owner');
      calls++;
      if (add) return add(name);
      const contact = { id: String(calls), name };
      stored.push(contact);
      changed([...stored]);
      return contact;
    },
  };
  const vm = new ContactsViewModel(repository, 'owner');
  vm.start();
  return {
    vm,
    repository,
    emit: (value) => changed(value),
    fail: (error) => failed(error),
    calls: () => calls,
    stopped: () => stopped,
  };
}
test('contacts validate names, trim successful saves, and survive reopening through the repository', async () => {
  const f = fixture();
  f.vm.openForm();
  f.vm.setName('   ');
  await f.vm.save();
  assert.equal(f.calls(), 0);
  f.vm.setName('x'.repeat(101));
  await f.vm.save();
  assert.equal(f.calls(), 0);
  f.vm.setName('  Alex Morgan  ');
  await f.vm.save();
  assert.deepEqual(f.vm.getSnapshot().contacts, [{ id: '1', name: 'Alex Morgan' }]);
  assert.equal(f.vm.getSnapshot().formOpen, false);
  assert.equal(f.vm.getSnapshot().name, '');
  f.vm.dispose();
  const reopened = new ContactsViewModel(f.repository, 'owner');
  reopened.start();
  assert.equal(reopened.getSnapshot().contacts[0].name, 'Alex Morgan');
  reopened.dispose();
});
test('contact save blocks duplicate taps, preserves listener updates, and deduplicates its acknowledged row', async () => {
  let finish;
  const f = fixture(
    () =>
      new Promise((resolve) => {
        finish = resolve;
      }),
  );
  f.vm.openForm();
  f.vm.setName('Alex');
  const pending = f.vm.save();
  await f.vm.save();
  f.vm.cancel();
  f.vm.setName('changed');
  f.vm.start();
  assert.equal(f.calls(), 1);
  assert.equal(f.vm.getSnapshot().name, 'Alex');
  f.emit([
    { id: 'a', name: 'Alex' },
    { id: 'b', name: 'Blair' },
  ]);
  finish({ id: 'a', name: 'Alex' });
  await pending;
  assert.equal(f.vm.getSnapshot().contacts.length, 2);
  assert.equal(f.vm.getSnapshot().busy, false);
});
test('failed contacts stay editable and can be retried without displaying a false save', async () => {
  const f = fixture(async () => {
    throw new ContactFailure('No permission');
  });
  f.vm.openForm();
  f.vm.setName('Alex');
  await f.vm.save();
  assert.equal(f.vm.getSnapshot().contacts.length, 0);
  assert.equal(f.vm.getSnapshot().formOpen, true);
  assert.equal(f.vm.getSnapshot().name, 'Alex');
  assert.equal(f.vm.getSnapshot().error, 'No permission');
  f.vm.cancel();
  assert.equal(f.vm.getSnapshot().name, '');
});
test('contact listener errors can retry and disposed users ignore late reads and saves', async () => {
  let finish;
  const f = fixture(
    () =>
      new Promise((resolve) => {
        finish = resolve;
      }),
  );
  f.fail(new ContactFailure('Offline'));
  assert.equal(f.vm.getSnapshot().loading, false);
  f.vm.start();
  assert.equal(f.vm.getSnapshot().loadError, '');
  f.vm.openForm();
  f.vm.setName('Alex');
  const pending = f.vm.save();
  f.vm.dispose();
  const before = f.vm.getSnapshot();
  f.emit([{ id: 'other-user', name: 'Other' }]);
  finish({ id: 'a', name: 'Alex' });
  await pending;
  assert.equal(f.vm.getSnapshot(), before);
  assert.equal(f.stopped(), 2);
});

test('contact lifecycle notifications open the inbox, survive closing, and dismiss only after acknowledgement', async () => {
  let events,
    stopped = false;
  const dismissed = [];
  const model = new ContactsViewModel(
    {
      observe: (_, next) => {
        next([]);
        return () => {};
      },
      add: async () => {
        throw new Error('unused');
      },
      observeEvents: (_, next) => {
        events = next;
        return () => {
          stopped = true;
        };
      },
      dismissEvent: async (_, id) => {
        dismissed.push(id);
      },
    },
    'alice',
  );
  model.start();
  events([{ id: 'accepted', name: 'Bob', kind: 'accepted' }]);
  assert.equal(model.getSnapshot().inboxOpen, true);
  model.closeInbox();
  events([{ id: 'accepted', name: 'Bob', kind: 'accepted' }]);
  assert.equal(model.getSnapshot().inboxOpen, false);
  events([
    { id: 'accepted', name: 'Bob', kind: 'accepted' },
    { id: 'removed', name: 'Bob', kind: 'removed' },
  ]);
  assert.equal(model.getSnapshot().inboxOpen, true);
  await model.dismissEvent('accepted');
  assert.deepEqual(dismissed, ['accepted']);
  assert.deepEqual(
    model.getSnapshot().events.map((item) => item.id),
    ['removed'],
  );
  model.dispose();
  assert.equal(stopped, true);
  events([]);
  assert.equal(model.getSnapshot().events.length, 1);
});

test('failed notification listeners can reconnect after backend activation without leaving stale map errors', () => {
  let fail,
    emit,
    subscriptions = 0;
  const model = new ContactsViewModel(
    {
      observe: (_, next) => {
        next([]);
        return () => {};
      },
      add: async () => {
        throw new Error('unused');
      },
      observeEvents: (_, next, error) => {
        subscriptions++;
        emit = next;
        fail = error;
        return () => {};
      },
    },
    'alice',
  );
  model.start();
  fail(new ContactFailure('Permission denied'));
  assert.equal(model.getSnapshot().error, '');
  assert.equal(model.getSnapshot().notificationError, 'Permission denied');
  model.openInbox();
  assert.equal(subscriptions, 2);
  emit([]);
  assert.equal(model.getSnapshot().notificationError, '');
  assert.equal(model.getSnapshot().inboxOpen, true);
  model.dispose();
});
