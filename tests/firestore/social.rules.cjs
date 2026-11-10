const { test, before, beforeEach, after } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const {
  initializeTestEnvironment,
  assertFails,
  assertSucceeds,
} = require('@firebase/rules-unit-testing');
const {
  doc,
  setDoc,
  getDoc,
  getDocs,
  collection,
  query,
  where,
  orderBy,
  startAt,
  endAt,
  limit,
  writeBatch,
  updateDoc,
  onSnapshot,
  arrayUnion,
  arrayRemove,
  increment,
  deleteDoc,
  serverTimestamp,
  Timestamp,
} = require('firebase/firestore');
const { geohashForLocation } = require('geofire-common');
const projectId = 'demo-google-map-social';
let env;
function db(uid) {
  return env
    .authenticatedContext(uid, { email: uid + '@example.com', email_verified: true })
    .firestore();
}
const names = { alice: 'Alice', bob: 'Bob', eve: 'Eve' };
before(async () => {
  const host = process.env.FIRESTORE_EMULATOR_HOST;
  if (!host || !/^127\.0\.0\.1:8085$|^localhost:8085$/.test(host))
    throw new Error('Rules tests require the local emulator on port 8085.');
  env = await initializeTestEnvironment({
    projectId,
    firestore: {
      host: '127.0.0.1',
      port: 8085,
      rules: fs.readFileSync(path.join(__dirname, '../../firestore.rules'), 'utf8'),
    },
  });
});
beforeEach(async () => {
  await env.clearFirestore();
  await env.withSecurityRulesDisabled(async (context) => {
    for (const uid of Object.keys(names)) {
      await setDoc(doc(context.firestore(), 'users', uid), {
        fullName: names[uid],
        birthday: '2000-01-01',
        location: 'Orlando, Florida, United States',
        avatarUrl: null,
        createdAt: Timestamp.now(),
      });
      await setDoc(doc(context.firestore(), 'contactDirectory', uid + '@example.com'), {
        uid,
        email: uid + '@example.com',
        fullName: names[uid],
        avatarUrl: null,
        updatedAt: Timestamp.now(),
      });
    }
  });
});
after(async () => {
  await env?.cleanup();
});
test('optional phone is owner-only, including after contact acceptance, and validates stored format', async () => {
  const alice = db('alice');
  const phone = doc(alice, 'users', 'alice', 'private', 'phone');
  await assertSucceeds(setDoc(phone, { phoneNumber: '+12025550123' }));
  assert.equal((await assertSucceeds(getDoc(phone))).data().phoneNumber, '+12025550123');
  await request();
  await accept();
  await assertSucceeds(getDoc(doc(db('bob'), 'users', 'alice')));
  await assertFails(getDoc(doc(db('bob'), 'users', 'alice', 'private', 'phone')));
  await assertFails(
    setDoc(doc(db('bob'), 'users', 'alice', 'private', 'phone'), { phoneNumber: '' }),
  );
  await assertFails(
    getDoc(doc(env.unauthenticatedContext().firestore(), 'users', 'alice', 'private', 'phone')),
  );
  for (const phoneNumber of ['123', '1'.repeat(16), 'invalid', 12025550123, null])
    await assertFails(setDoc(phone, { phoneNumber }));
  await assertFails(setDoc(phone, { phoneNumber: '+12025550123', verified: true }));
  await assertFails(setDoc(phone, {}));
  await assertFails(updateDoc(doc(alice, 'users', 'alice'), { phoneNumber: '+12025550123' }));
  await assertSucceeds(setDoc(phone, { phoneNumber: '' }));
  await assertSucceeds(deleteDoc(phone));
});

test('profile and optional phone save atomically; onboarding still requires name, birthday and location', async () => {
  const database = db('new-user');
  const profilePath = doc(database, 'users', 'new-user');
  const phonePath = doc(database, 'users', 'new-user', 'private', 'phone');
  const complete = {
    fullName: 'New user',
    birthday: '2000-01-01',
    location: 'Orlando',
    avatarUrl: null,
    createdAt: serverTimestamp(),
  };
  for (const field of ['fullName', 'birthday', 'location']) {
    const batch = writeBatch(database);
    batch.set(profilePath, { ...complete, [field]: '' });
    batch.set(phonePath, { phoneNumber: '+12025550123' });
    await assertFails(batch.commit());
    assert.equal((await getDoc(phonePath)).exists(), false);
  }
  await assertSucceeds(setDoc(profilePath, complete));
  const batch = writeBatch(database);
  batch.update(profilePath, { fullName: 'New name' });
  batch.set(phonePath, { phoneNumber: '+12025550123' });
  await assertSucceeds(batch.commit());
  assert.equal((await getDoc(profilePath)).data().fullName, 'New name');
});
function pending() {
  return {
    fromId: 'alice',
    toId: 'bob',
    fromName: 'Alice',
    fromEmail: 'alice@example.com',
    toEmail: 'bob@example.com',
    status: 'pending',
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  };
}
async function request() {
  await setDoc(doc(db('alice'), 'contactRequests', 'alice_bob'), pending());
}
async function accept() {
  const database = db('bob');
  const batch = writeBatch(database);
  batch.update(doc(database, 'contactRequests', 'alice_bob'), {
    status: 'accepted',
    updatedAt: serverTimestamp(),
  });
  batch.set(doc(database, 'users', 'bob', 'contacts', 'alice'), {
    name: 'Alice',
    peerId: 'alice',
    requestId: 'alice_bob',
    createdAt: serverTimestamp(),
  });
  batch.set(doc(database, 'users', 'alice', 'contacts', 'bob'), {
    name: 'Bob',
    peerId: 'bob',
    requestId: 'alice_bob',
    createdAt: serverTimestamp(),
  });
  return batch.commit();
}
test('exact email lookup is available but directory scans and private profiles are blocked', async () => {
  await assertSucceeds(getDoc(doc(db('alice'), 'contactDirectory', 'bob@example.com')));
  await assertFails(getDocs(collection(db('alice'), 'contactDirectory')));
  await assertFails(getDoc(doc(db('alice'), 'users', 'bob')));
  await assertFails(
    setDoc(doc(db('alice'), 'contactDirectory', 'bob@example.com'), {
      uid: 'alice',
      email: 'bob@example.com',
      fullName: 'Alice',
      avatarUrl: null,
      updatedAt: serverTimestamp(),
    }),
  );
});
test(
  'an open contact editor receives live profile edits from its connected peer',
  { timeout: 20000 },
  async (t) => {
    await request();
    await accept();
    const alice = db('alice'),
      bob = db('bob');
    const client = require('../../.test-build/config/firebase/client');
    t.mock.method(client, 'getFirebaseAuth', () => ({ currentUser: { uid: 'alice' } }));
    const {
      FirebaseContactRepository,
    } = require('../../.test-build/features/contacts/data/FirebaseContactRepository');
    const repo = new FirebaseContactRepository();
    t.mock.method(repo, 'database', () => alice);
    let stop;
    try {
      const result = await new Promise((resolve, reject) => {
        let changed = false;
        stop = repo.observeDetails(
          'alice',
          { id: 'bob', peerId: 'bob', requestId: 'alice_bob', name: 'Walking buddy' },
          (contact) => {
            if (contact.profileLocation === 'Miami') resolve(contact);
            if (
              !changed &&
              contact.email === 'bob@example.com' &&
              contact.profileLocation === 'Orlando, Florida, United States'
            ) {
              changed = true;
              void updateDoc(doc(bob, 'users', 'bob'), { location: 'Miami' }).catch(reject);
            }
          },
          reject,
        );
      });
      assert.equal(result.name, 'Walking buddy');
      assert.equal(result.email, 'bob@example.com');
    } finally {
      stop?.();
    }
  },
);
function until(model, ready) {
  if (ready(model.getSnapshot())) return Promise.resolve();
  return new Promise((resolve, reject) => {
    const stop = model.subscribe(() => {
      if (ready(model.getSnapshot())) {
        stop();
        clearTimeout(timer);
        resolve();
      }
    });
    const timer = setTimeout(() => {
      stop();
      reject(Error('Realtime snapshot timed out'));
    }, 7000);
  });
}

test(
  'device-only multi-delete and clear preserve Firebase and the other device in every chat type',
  { timeout: 60000 },
  async (t) => {
    const {
      FirebaseChatRepository,
    } = require('../../.test-build/features/chat/data/FirebaseChatRepository');
    const {
      DeviceChatRepository,
    } = require('../../.test-build/features/chat/data/DeviceChatRepository');
    const { StoredChatHistory } = require('../../.test-build/features/chat/data/StoredChatHistory');
    const { ChatViewModel } = require('../../.test-build/features/chat/viewmodels/ChatViewModel');
    const { threadKey } = require('../../.test-build/features/chat/models/chat');
    await request();
    await accept();
    await env.withSecurityRulesDisabled(async (context) =>
      setDoc(doc(context.firestore(), 'privateGroups', 'local-history'), {
        name: 'Local history',
        ownerId: 'alice',
        memberIds: ['alice', 'bob'],
        joinedIds: ['alice', 'bob'],
      }),
    );
    const alice = db('alice'),
      bob = db('bob');
    const writer = new FirebaseChatRepository(() => alice),
      remote = new FirebaseChatRepository(() => bob);
    const disk = new Map();
    const storage = {
      getItem: async (key) => disk.get(key) ?? null,
      setItem: async (key, value) => {
        disk.set(key, value);
      },
    };
    const history = new StoredChatHistory(storage);
    const local = new DeviceChatRepository(remote, history);
    const contexts = [
      [
        { peerId: 'bob', requestId: 'alice_bob' },
        { peerId: 'alice', requestId: 'alice_bob' },
        ['contactRequests', 'alice_bob'],
      ],
      [
        { groupId: 'local-history', senderName: 'Alice' },
        { groupId: 'local-history', senderName: 'Bob' },
        ['privateGroups', 'local-history'],
      ],
      [
        { groupId: 'local-history', memberId: 'bob' },
        { groupId: 'local-history', memberId: 'alice' },
        ['privateGroups', 'local-history', 'memberChats', 'alice', 'with', 'bob'],
      ],
    ];
    for (const [toBob, toAlice, parent] of contexts) {
      const device = new ChatViewModel(local, 'bob', toAlice, history);
      const otherDevice = new ChatViewModel(remote, 'bob', toAlice);
      device.start();
      otherDevice.start();
      t.after(device.stop);
      t.after(otherDevice.stop);
      await writer.send('alice', toBob, 'Original');
      await until(device, (s) => s.messages.some((m) => m.text === 'Original' && m.createdAt));
      const original = device.getSnapshot().messages[0];
      await remote.send('bob', toAlice, 'Reply', original.id);
      await writer.send('alice', toBob, 'Newest');
      await until(
        device,
        (s) =>
          s.messages.length === 3 && s.messages[0].text === 'Newest' && s.messages[0].createdAt,
      );
      const newest = device.getSnapshot().messages[0];
      const readStored = async () =>
        (await getDocs(collection(alice, ...parent, 'messages'))).docs.map((d) => [d.id, d.data()]);
      const before = await readStored();
      assert.equal(await device.deleteLocal([original.id, newest.id]), true);
      await until(device, (s) => s.messages.length === 1 && s.messages[0].reply?.unavailable);
      await until(
        otherDevice,
        (s) => s.messages.length === 3 && s.messages.some((m) => m.reply?.text === 'Original'),
      );
      assert.deepEqual(await readStored(), before);
      const selectionIds = () =>
        new Promise((resolve, reject) => {
          const stop = local.messageIds(
            'bob',
            toAlice,
            (ids) => {
              stop();
              resolve(ids);
            },
            reject,
          );
        });
      assert.deepEqual(
        await selectionIds(),
        device.getSnapshot().messages.map((m) => m.id),
      );
      let unread;
      const badge = {
        getSnapshot: () => unread,
        subscribe: (notify) =>
          local.unread(
            'bob',
            toAlice,
            undefined,
            (value) => {
              unread = value;
              notify();
            },
            () => {},
          ),
      };
      await until(badge, (count) => count === 0);
      if ('peerId' in toAlice) {
        let previews;
        const list = {
          getSnapshot: () => previews,
          subscribe: (notify) =>
            local.inbox(
              'bob',
              (value) => {
                previews = value;
                notify();
              },
              () => {},
            ),
        };
        await until(list, (rows) => rows?.length === 0);
      }
      const target = device.prepareClear();
      // A new arrival while the confirmation is open must survive the clear.
      await writer.send('alice', toBob, 'New arrival');
      await until(device, (s) => s.messages.some((m) => m.text === 'New arrival' && m.createdAt));
      const beforeClear = await readStored();
      await device.clearLocal(target);
      await until(device, (s) => s.messages.length === 1 && s.messages[0].text === 'New arrival');
      unread = undefined;
      await until(badge, (count) => count === 1);
      assert.deepEqual(await readStored(), beforeClear);
      await until(otherDevice, (s) => s.messages.length === 4);
      const reopened = new ChatViewModel(
        new DeviceChatRepository(remote, new StoredChatHistory(storage)),
        'bob',
        toAlice,
      );
      reopened.start();
      t.after(reopened.stop);
      await until(
        reopened,
        (s) => !s.loading && s.messages.length === 1 && s.messages[0].text === 'New arrival',
      );
      // A clear cutoff hides unloaded older history without downloading every old message.
      const cutoff = device.prepareClear();
      await history.clear('bob', threadKey(toAlice), cutoff.through, cutoff.ids);
      await until(device, (s) => !s.loading && s.messages.length === 0 && !s.more);
      assert.equal((await readStored()).length, 4);
      assert.deepEqual(await selectionIds(), []);
      device.stop();
      otherDevice.stop();
      reopened.stop();
    }
  },
);

test(
  'reply, edit and delete sync for all chat types with author-only mutations and live quotes',
  { timeout: 60000 },
  async (t) => {
    const {
      FirebaseChatRepository,
    } = require('../../.test-build/features/chat/data/FirebaseChatRepository');
    const { ChatViewModel } = require('../../.test-build/features/chat/viewmodels/ChatViewModel');
    await request();
    await accept();
    await env.withSecurityRulesDisabled(async (context) => {
      await setDoc(doc(context.firestore(), 'privateGroups', 'actions'), {
        name: 'Actions',
        ownerId: 'alice',
        memberIds: ['alice', 'bob', 'eve'],
        joinedIds: ['alice', 'bob'],
      });
    });
    const alice = db('alice'),
      bob = db('bob'),
      eve = db('eve');
    const writer = new FirebaseChatRepository(() => alice),
      reader = new FirebaseChatRepository(() => bob);
    const contexts = [
      [
        { peerId: 'bob', requestId: 'alice_bob' },
        { peerId: 'alice', requestId: 'alice_bob' },
        ['contactRequests', 'alice_bob'],
      ],
      [
        { groupId: 'actions', senderName: 'Alice' },
        { groupId: 'actions', senderName: 'Bob' },
        ['privateGroups', 'actions'],
      ],
      [
        { groupId: 'actions', memberId: 'bob' },
        { groupId: 'actions', memberId: 'alice' },
        ['privateGroups', 'actions', 'memberChats', 'alice', 'with', 'bob'],
      ],
    ];
    for (const [toBob, toAlice, parent] of contexts) {
      const model = new ChatViewModel(reader, 'bob', toAlice);
      const inbox = new ChatViewModel(reader, 'bob');
      model.start();
      inbox.start();
      t.after(model.stop);
      t.after(inbox.stop);
      await writer.send('alice', toBob, 'Original');
      await until(model, (s) => s.messages.some((m) => m.text === 'Original' && m.createdAt));
      const first = model.getSnapshot().messages.find((m) => m.text === 'Original');
      const original = doc(alice, ...parent, 'messages', first.id);
      await reader.send('bob', toAlice, 'Reply', first.id);
      await until(model, (s) =>
        s.messages.some((m) => m.text === 'Reply' && m.reply?.text === 'Original'),
      );
      await assertFails(
        updateDoc(doc(bob, ...parent, 'messages', first.id), {
          text: 'forged',
          editedAt: serverTimestamp(),
        }),
      );
      await assertFails(deleteDoc(doc(bob, ...parent, 'messages', first.id)));
      await assertFails(deleteDoc(doc(eve, ...parent, 'messages', first.id)));
      await assertFails(writer.send('alice', toBob, 'Bad reference', 'missing'));
      await assertFails(writer.send('alice', toBob, 'Bad path', 'invalid/path'));
      await assertFails(updateDoc(original, { text: ' ', editedAt: serverTimestamp() }));
      await assertFails(
        updateDoc(original, {
          text: 'edited',
          createdAt: serverTimestamp(),
          editedAt: serverTimestamp(),
        }),
      );
      await assertFails(updateDoc(original, { fromId: 'bob', editedAt: serverTimestamp() }));
      await writer.edit('alice', toBob, first.id, 'Corrected');
      await until(model, (s) =>
        s.messages.some((m) => m.text === 'Reply' && m.reply?.text === 'Corrected'),
      );
      assert.equal(model.getSnapshot().messages.find((m) => m.id === first.id).time, first.time);
      assert.equal(model.getSnapshot().messages.find((m) => m.id === first.id).edited, true);
      await writer.send('alice', toBob, 'Newest');
      await until(model, (s) => s.messages.some((m) => m.text === 'Newest' && m.createdAt));
      const newest = model.getSnapshot().messages.find((m) => m.text === 'Newest');
      // A narrow window exercises quotes whose originals have scrolled out of the transcript.
      let narrow = [];
      const narrowModel = {
        getSnapshot: () => narrow,
        subscribe: (notify) => {
          return reader.messages(
            'bob',
            toAlice,
            2,
            (rows) => {
              narrow = rows;
              notify();
            },
            () => {},
          );
        },
      };
      await until(narrowModel, (rows) =>
        rows.some((m) => m.text === 'Reply' && m.reply?.text === 'Corrected'),
      );
      await writer.remove('alice', toBob, first.id);
      await until(
        model,
        (s) =>
          !s.messages.some((m) => m.id === first.id) &&
          s.messages.some((m) => m.reply?.unavailable),
      );
      await writer.edit('alice', toBob, newest.id, 'Latest edit');
      await until(model, (s) =>
        s.messages.some((m) => m.id === newest.id && m.text === 'Latest edit'),
      );
      if ('peerId' in toBob) {
        await until(inbox, (s) => s.previews.some((p) => p.text === 'Latest edit'));
        assert.equal(inbox.getSnapshot().previews[0].time, newest.time);
      }
      let unread = -1;
      const countModel = {
        getSnapshot: () => unread,
        subscribe: (notify) =>
          reader.unread(
            'bob',
            toAlice,
            undefined,
            (count) => {
              unread = count;
              notify();
            },
            () => {},
          ),
      };
      await until(countModel, (count) => count === 1);
      await writer.remove('alice', toBob, newest.id);
      await until(model, (s) => !s.messages.some((m) => m.id === newest.id));
      unread = -1;
      await until(countModel, (count) => count === 0);
      if ('peerId' in toBob) await until(inbox, (s) => s.previews.some((p) => p.text === ''));
      await assert.rejects(writer.edit('alice', toBob, first.id, 'resurrect'), /unavailable/);
      model.stop();
      inbox.stop();
    }
  },
);

test(
  'sent checks become read in realtime for direct, group and private-member chats with participant-only receipts',
  { timeout: 30000 },
  async (t) => {
    const {
      FirebaseChatRepository,
    } = require('../../.test-build/features/chat/data/FirebaseChatRepository');
    const { ChatViewModel } = require('../../.test-build/features/chat/viewmodels/ChatViewModel');
    const { messageStatus } = require('../../.test-build/features/chat/models/messageStatus');
    const alice = db('alice'),
      bob = db('bob'),
      eve = db('eve');
    await request();
    await accept();
    await env.withSecurityRulesDisabled(async (context) => {
      await setDoc(doc(context.firestore(), 'privateGroups', 'checks'), {
        name: 'Checks',
        ownerId: 'alice',
        memberIds: ['alice', 'bob', 'eve'],
        joinedIds: ['alice', 'bob'],
      });
    });
    const contexts = [
      [
        { peerId: 'bob', requestId: 'alice_bob' },
        { peerId: 'alice', requestId: 'alice_bob' },
        ['contactRequests', 'alice_bob'],
      ],
      [
        { groupId: 'checks', senderName: 'Alice' },
        { groupId: 'checks', senderName: 'Bob' },
        ['privateGroups', 'checks'],
      ],
      [
        { groupId: 'checks', memberId: 'bob' },
        { groupId: 'checks', memberId: 'alice' },
        ['privateGroups', 'checks', 'memberChats', 'alice', 'with', 'bob'],
      ],
    ];
    const writer = new FirebaseChatRepository(() => alice),
      reader = new FirebaseChatRepository(() => bob);
    for (const [toBob, toAlice, path] of contexts) {
      const sender = new ChatViewModel(writer, 'alice', toBob),
        recipient = new ChatViewModel(reader, 'bob', toAlice);
      t.after(sender.stop);
      t.after(recipient.stop);
      sender.start();
      recipient.start();
      await writer.send('alice', toBob, 'First');
      await until(sender, (s) =>
        s.messages.some((m) => m.text === 'First' && !m.pending && m.createdAt),
      );
      const first = sender.getSnapshot().messages[0];
      assert.equal(messageStatus(first, sender.getSnapshot().readThrough), 'sent');
      // Reading one's own message must never count as the recipient reading it.
      await writer.shareRead('alice', toBob, first.createdAt);
      assert.equal(messageStatus(first, sender.getSnapshot().readThrough), 'sent');
      await until(recipient, (s) => s.messages.some((m) => m.id === first.id && m.createdAt));
      recipient.markVisibleRead(first.createdAt);
      await until(sender, (s) => messageStatus(first, s.readThrough) === 'read');
      await writer.send('alice', toBob, 'Second');
      await until(sender, (s) =>
        s.messages.some((m) => m.text === 'Second' && m.createdAt && !m.pending),
      );
      const second = sender.getSnapshot().messages.find((m) => m.text === 'Second');
      assert.equal(messageStatus(second, sender.getSnapshot().readThrough), 'sent');
      recipient.markVisibleRead(second.createdAt);
      await until(sender, (s) => messageStatus(second, s.readThrough) === 'read');
      const receipt = doc(bob, ...path, 'reads', 'bob');
      await assertSucceeds(getDoc(doc(alice, ...path, 'reads', 'bob')));
      await assertFails(getDocs(collection(eve, ...path, 'reads')));
      await assertFails(setDoc(doc(alice, ...path, 'reads', 'bob'), { through: second.createdAt }));
      await assertFails(setDoc(receipt, { through: Timestamp.fromMillis(Date.now() + 86400000) }));
      await assertFails(setDoc(receipt, { through: first.createdAt }));
      await assertFails(deleteDoc(receipt));
      await assertSucceeds(reader.shareRead('bob', toAlice, first.createdAt));
      assert.equal(messageStatus(second, sender.getSnapshot().readThrough), 'read');
      sender.stop();
      recipient.stop();
    }
    // The private unread-badge records remain private even between contacts.
    await assertFails(getDocs(collection(alice, 'users', 'bob', 'chatReads')));
    await env.withSecurityRulesDisabled(async (context) => {
      await updateDoc(doc(context.firestore(), 'privateGroups', 'checks'), {
        joinedIds: ['alice', 'bob', 'eve'],
      });
    });
    await assertSucceeds(getDocs(collection(eve, 'privateGroups', 'checks', 'reads')));
    await assertFails(
      getDocs(
        collection(eve, 'privateGroups', 'checks', 'memberChats', 'alice', 'with', 'bob', 'reads'),
      ),
    );
    await env.withSecurityRulesDisabled(async (context) => {
      await updateDoc(doc(context.firestore(), 'privateGroups', 'checks'), {
        joinedIds: ['alice', 'eve'],
      });
    });
    await assertFails(getDocs(collection(bob, 'privateGroups', 'checks', 'reads')));
    await assertFails(
      getDocs(
        collection(eve, 'privateGroups', 'checks', 'memberChats', 'alice', 'with', 'bob', 'reads'),
      ),
    );
    const remove = writeBatch(alice);
    remove.delete(doc(alice, 'users', 'alice', 'contacts', 'bob'));
    remove.delete(doc(alice, 'users', 'bob', 'contacts', 'alice'));
    await remove.commit();
    await assertFails(getDocs(collection(bob, 'contactRequests', 'alice_bob', 'reads')));
  },
);
test(
  'unread badges count incoming direct, group and member messages and sync the read boundary across devices',
  { timeout: 25000 },
  async (t) => {
    const {
      FirebaseChatRepository,
    } = require('../../.test-build/features/chat/data/FirebaseChatRepository');
    const {
      UnreadChatsViewModel,
    } = require('../../.test-build/features/chat/viewmodels/UnreadChatsViewModel');
    const { threadKey } = require('../../.test-build/features/chat/models/chat');
    const alice = db('alice'),
      bob = db('bob');
    const writer = new FirebaseChatRepository(() => alice),
      reader = new FirebaseChatRepository(() => bob);
    await request();
    await accept();
    await createListedGroup(alice, 'walk', 'Walk');
    const join = writeBatch(bob);
    join.update(doc(bob, 'privateGroups', 'walk'), {
      memberIds: arrayUnion('bob'),
      joinedIds: arrayUnion('bob'),
    });
    join.update(doc(bob, 'groupDirectory', 'walk'), { memberCount: increment(1) });
    await join.commit();
    const bobPeer = { peerId: 'bob', requestId: 'alice_bob' },
      alicePeer = { peerId: 'alice', requestId: 'alice_bob' };
    const room = { groupId: 'walk', senderName: 'Alice' },
      privatePeer = { groupId: 'walk', memberId: 'bob' };
    const contacts = [{ id: 'alice', name: 'Alice', ...alicePeer }],
      groups = [{ id: 'walk', joinedIds: ['alice', 'bob'] }];
    const model = new UnreadChatsViewModel(reader, 'bob');
    const secondDb = db('bob'),
      second = new UnreadChatsViewModel(new FirebaseChatRepository(() => secondDb), 'bob');
    for (const m of [model, second]) {
      m.sync(contacts, groups);
      m.start();
      t.after(m.stop);
    }
    await writer.send('alice', bobPeer, 'First');
    const [first] = (await getDocs(collection(bob, 'contactRequests', 'alice_bob', 'messages')))
      .docs;
    await writer.send('alice', bobPeer, 'Second');
    await reader.send('bob', alicePeer, 'My reply');
    await writer.send('alice', room, 'Group hello');
    await writer.send('alice', privatePeer, 'Member hello');
    await Promise.all([model, second].map((m) => until(m, (s) => s.total === 4)));
    assert.equal(model.getSnapshot().counts.get(threadKey(alicePeer)), 2);
    // Reading the first direct message must keep the later one and the other two threads unread.
    model.markRead(alicePeer, first.data().createdAt);
    await Promise.all([model, second].map((m) => until(m, (s) => s.total === 3)));
    assert.equal(second.getSnapshot().counts.get(threadKey(alicePeer)), 1);
    assert.equal(second.getSnapshot().counts.get(threadKey(room)), 1);
    assert.equal(
      second.getSnapshot().counts.get(threadKey({ groupId: 'walk', memberId: 'alice' })),
      1,
    );
    const ordered = await getDocs(
      query(
        collection(bob, 'contactRequests', 'alice_bob', 'messages'),
        orderBy('createdAt', 'desc'),
        limit(1),
      ),
    );
    await reader.markRead('bob', alicePeer, ordered.docs[0].data().createdAt);
    await until(model, (s) => s.total === 2);
    await assertSucceeds(reader.markRead('bob', alicePeer, first.data().createdAt));
    const path = ['users', 'bob', 'chatReads', threadKey(alicePeer)];
    await assertFails(setDoc(doc(bob, ...path), { through: first.data().createdAt }));
    await assertFails(getDoc(doc(alice, ...path)));
    await assertFails(setDoc(doc(alice, ...path), { through: serverTimestamp() }));
    await assertFails(
      setDoc(doc(bob, ...path), { through: Timestamp.fromMillis(Date.now() + 86400000) }),
    );
    second.stop();
    second.start();
    await until(second, (s) => s.total === 2 && !s.counts.has(threadKey(alicePeer)));
    model.sync(contacts, []);
    assert.equal(model.getSnapshot().total, 0);
  },
);

test('a large unread backlog caps the badge and reading older messages leaves newer arrivals unread', async (t) => {
  const {
    FirebaseChatRepository,
  } = require('../../.test-build/features/chat/data/FirebaseChatRepository');
  const {
    UnreadChatsViewModel,
  } = require('../../.test-build/features/chat/viewmodels/UnreadChatsViewModel');
  await request();
  await accept();
  const peer = { peerId: 'alice', requestId: 'alice_bob' };
  const start = Date.now() - 20000;
  await env.withSecurityRulesDisabled(async (ctx) => {
    const database = ctx.firestore(),
      batch = writeBatch(database);
    for (let i = 0; i < 110; i++) {
      batch.set(doc(database, 'contactRequests', 'alice_bob', 'messages', String(i)), {
        fromId: i < 105 ? 'alice' : 'bob',
        text: 'Test ' + i,
        createdAt: Timestamp.fromMillis(start + i),
      });
    }
    await batch.commit();
  });
  const database = db('bob');
  const unread = new UnreadChatsViewModel(new FirebaseChatRepository(() => database), 'bob');
  unread.sync([{ id: 'alice', ...peer }], []);
  unread.start();
  t.after(unread.stop);
  await until(unread, (s) => s.total === 100);
  unread.markRead(peer, Timestamp.fromMillis(start + 3));
  unread.markRead(peer, Timestamp.fromMillis(start + 100));
  await until(unread, (s) => s.total === 4);
});

test('accepted contacts exchange live messages with private inbox previews; outsiders and forged senders are rejected', async () => {
  const {
    FirebaseChatRepository,
  } = require('../../.test-build/features/chat/data/FirebaseChatRepository');
  const { ChatViewModel } = require('../../.test-build/features/chat/viewmodels/ChatViewModel');
  const alice = db('alice'),
    bob = db('bob'),
    eve = db('eve');
  const aliceRepo = new FirebaseChatRepository(() => alice),
    bobRepo = new FirebaseChatRepository(() => bob);
  const bobPeer = { peerId: 'bob', requestId: 'alice_bob' },
    alicePeer = { peerId: 'alice', requestId: 'alice_bob' };
  await request();
  await assertFails(aliceRepo.send('alice', bobPeer, 'too early'));
  await accept();
  const sender = new ChatViewModel(aliceRepo, 'alice', bobPeer);
  const receiver = new ChatViewModel(bobRepo, 'bob', alicePeer);
  const inbox = new ChatViewModel(bobRepo, 'bob');
  try {
    receiver.start();
    inbox.start();
    const received = until(receiver, (s) =>
      s.messages.some((m) => m.text === 'Hello Bob' && m.fromId === 'alice' && m.time > 0),
    );
    const preview = until(inbox, (s) =>
      s.previews.some((m) => m.peerId === 'alice' && m.text === 'Hello Bob'),
    );
    sender.setDraft('  Hello Bob  ');
    await Promise.all([sender.send(), received, preview]);
    assert.equal(sender.getSnapshot().draft, '');
    await assertSucceeds(bobRepo.send('bob', alicePeer, 'Hello Alice'));
    assert.equal(
      (await getDoc(doc(alice, 'users', 'alice', 'chatInbox', 'bob'))).data().text,
      'Hello Alice',
    );
    const thread = ['contactRequests', 'alice_bob', 'messages'];
    await assertFails(getDocs(collection(eve, ...thread)));
    await assertFails(getDoc(doc(eve, 'users', 'bob', 'chatInbox', 'alice')));
    await assertFails(
      setDoc(doc(bob, ...thread, 'forged'), {
        fromId: 'alice',
        text: 'forged',
        createdAt: serverTimestamp(),
      }),
    );
    await assertFails(aliceRepo.send('alice', bobPeer, '   '));
    await assertFails(aliceRepo.send('alice', bobPeer, 'x'.repeat(2001)));
    await assertFails(
      setDoc(doc(alice, 'users', 'bob', 'chatInbox', 'alice'), {
        messageId: 'fake',
        text: 'forged',
        updatedAt: serverTimestamp(),
      }),
    );
    const remove = writeBatch(alice);
    remove.delete(doc(alice, 'users', 'alice', 'contacts', 'bob'));
    remove.delete(doc(alice, 'users', 'bob', 'contacts', 'alice'));
    await remove.commit();
    await assertFails(aliceRepo.send('alice', bobPeer, 'after removal'));
    await assertFails(getDocs(collection(bob, ...thread)));
  } finally {
    receiver.stop();
    inbox.stop();
    sender.stop();
  }
});
test('only real sender identity can create a request and recipient can read pending notifications', async () => {
  await assertFails(
    setDoc(doc(db('alice'), 'contactRequests', 'alice_bob'), {
      ...pending(),
      fromEmail: 'eve@example.com',
    }),
  );
  await assertFails(
    setDoc(doc(db('alice'), 'contactRequests', 'alice_bob'), { ...pending(), fromName: 'Eve' }),
  );
  await assertSucceeds(request());
  const result = await assertSucceeds(
    getDocs(
      query(
        collection(db('bob'), 'contactRequests'),
        where('toId', '==', 'bob'),
        where('status', '==', 'pending'),
        limit(100),
      ),
    ),
  );
  assert.equal(result.size, 1);
  await assertFails(getDoc(doc(db('eve'), 'contactRequests', 'alice_bob')));
  await assertFails(
    updateDoc(doc(db('alice'), 'contactRequests', 'alice_bob'), {
      status: 'accepted',
      updatedAt: serverTimestamp(),
    }),
  );
});
test('acceptance atomically creates both contacts and grants read-only profile access', async () => {
  await request();
  await assertFails(
    updateDoc(doc(db('bob'), 'contactRequests', 'alice_bob'), {
      status: 'accepted',
      updatedAt: serverTimestamp(),
    }),
  );
  await assertSucceeds(accept());
  await assertSucceeds(getDoc(doc(db('alice'), 'users', 'bob')));
  await assertSucceeds(getDoc(doc(db('bob'), 'users', 'alice')));
  await assertFails(getDoc(doc(db('eve'), 'users', 'bob')));
  await assertSucceeds(
    updateDoc(doc(db('alice'), 'users', 'alice', 'contacts', 'bob'), { name: 'My friend' }),
  );
  await assertFails(
    updateDoc(doc(db('bob'), 'users', 'alice', 'contacts', 'bob'), { name: 'Changed by peer' }),
  );
  await assertFails(updateDoc(doc(db('alice'), 'users', 'bob'), { birthday: '1990-01-01' }));
  await assertFails(
    updateDoc(doc(db('alice'), 'users', 'alice', 'contacts', 'bob'), { peerId: 'eve' }),
  );
});
test('decline creates no relationship and forged contacts cannot bypass consent', async () => {
  await request();
  await assertSucceeds(
    updateDoc(doc(db('bob'), 'contactRequests', 'alice_bob'), {
      status: 'declined',
      updatedAt: serverTimestamp(),
    }),
  );
  await assertFails(getDoc(doc(db('alice'), 'users', 'bob')));
  await assertFails(
    setDoc(doc(db('alice'), 'users', 'alice', 'contacts', 'bob'), {
      name: 'Bob',
      peerId: 'bob',
      requestId: 'alice_bob',
      createdAt: serverTimestamp(),
    }),
  );
  await assertFails(setDoc(doc(db('alice'), 'contactRequests', 'alice_bob'), { ...pending() }));
});
test('removing contact must remove both links and immediately revoke private profile access', async () => {
  await request();
  await accept();
  await assertFails(deleteDoc(doc(db('alice'), 'users', 'alice', 'contacts', 'bob')));
  const database = db('alice');
  const batch = writeBatch(database);
  batch.delete(doc(database, 'users', 'alice', 'contacts', 'bob'));
  batch.delete(doc(database, 'users', 'bob', 'contacts', 'alice'));
  await assertSucceeds(batch.commit());
  await assertFails(getDoc(doc(db('alice'), 'users', 'bob')));
  await assertFails(getDoc(doc(db('bob'), 'users', 'alice')));
});
test('shared location is owner-written, fresh, bounded-query readable, and removable', async () => {
  const bucket = Math.floor(Date.now() / 120000);
  const location = {
    nickname: 'Alice',
    avatarUrl: null,
    latitude: 28.53834,
    longitude: -81.37924,
    geohash: geohashForLocation([28.53834, -81.37924]),
    bucket,
    updatedAt: serverTimestamp(),
  };
  await assertFails(setDoc(doc(db('eve'), 'sharedLocations', 'alice'), location));
  await assertFails(
    setDoc(doc(db('alice'), 'sharedLocations', 'alice'), { ...location, latitude: 100 }),
  );
  await assertSucceeds(setDoc(doc(db('alice'), 'sharedLocations', 'alice'), location));
  await assertSucceeds(getDoc(doc(db('bob'), 'sharedLocations', 'alice')));
  await assertFails(getDocs(query(collection(db('bob'), 'sharedLocations'), limit(50))));
  const q = query(
    collection(db('bob'), 'sharedLocations'),
    where('bucket', 'in', [bucket - 1, bucket]),
    orderBy('geohash'),
    startAt(''),
    endAt('zzzzzzzzzz'),
    limit(200),
  );
  const result = await assertSucceeds(getDocs(q));
  assert.equal(result.size, 1);
  await assertFails(getDocs(query(q, limit(201))));
  await env.withSecurityRulesDisabled(async (context) => {
    await updateDoc(doc(context.firestore(), 'sharedLocations', 'alice'), { bucket: bucket - 3 });
  });
  await assertFails(getDoc(doc(db('bob'), 'sharedLocations', 'alice')));
  await assertSucceeds(deleteDoc(doc(db('alice'), 'sharedLocations', 'alice')));
});
test('map requests target fresh visible identities without revealing recipient email before consent', async () => {
  const database = db('alice');
  const reference = doc(database, 'contactRequests', 'alice_bob');
  await assertFails(setDoc(reference, { ...pending(), toEmail: '' }));
  await setDoc(doc(db('bob'), 'sharedLocations', 'bob'), {
    nickname: 'Bob',
    avatarUrl: null,
    latitude: 28,
    longitude: -81,
    geohash: geohashForLocation([28, -81]),
    bucket: Math.floor(Date.now() / 120000),
    updatedAt: serverTimestamp(),
  });
  await assertSucceeds(setDoc(reference, { ...pending(), toEmail: '' }));
  assert.equal((await getDoc(reference)).data().toEmail, '');
  await assertFails(getDoc(doc(database, 'users', 'bob')));
  await assertFails(
    updateDoc(doc(db('bob'), 'contactRequests', 'alice_bob'), {
      status: 'declined',
      toEmail: 'eve@example.com',
      updatedAt: serverTimestamp(),
    }),
  );
  const recipient = db('bob');
  const batch = writeBatch(recipient);
  batch.update(doc(recipient, 'contactRequests', 'alice_bob'), {
    status: 'accepted',
    toEmail: 'bob@example.com',
    updatedAt: serverTimestamp(),
  });
  batch.set(doc(recipient, 'users', 'alice', 'contacts', 'bob'), {
    name: 'Bob',
    peerId: 'bob',
    requestId: 'alice_bob',
    createdAt: serverTimestamp(),
  });
  batch.set(doc(recipient, 'users', 'bob', 'contacts', 'alice'), {
    name: 'Alice',
    peerId: 'alice',
    requestId: 'alice_bob',
    createdAt: serverTimestamp(),
  });
  await assertSucceeds(batch.commit());
  assert.equal((await getDoc(reference)).data().toEmail, 'bob@example.com');
  await assertSucceeds(getDoc(doc(database, 'users', 'bob')));
});

test('contact events require the real atomic acceptance or removal and only the recipient can dismiss', async () => {
  await request();
  const database = db('bob');
  const event = (kind) => ({
    kind,
    actorId: 'bob',
    name: 'Bob',
    requestId: 'alice_bob',
    createdAt: serverTimestamp(),
  });
  const ref = doc(database, 'users', 'alice', 'contactEvents', 'accepted');
  await assertFails(setDoc(ref, event('accepted')));
  const batch = writeBatch(database);
  batch.update(doc(database, 'contactRequests', 'alice_bob'), {
    status: 'accepted',
    updatedAt: serverTimestamp(),
  });
  batch.set(doc(database, 'users', 'bob', 'contacts', 'alice'), {
    name: 'Alice',
    peerId: 'alice',
    requestId: 'alice_bob',
    createdAt: serverTimestamp(),
  });
  batch.set(doc(database, 'users', 'alice', 'contacts', 'bob'), {
    name: 'Bob',
    peerId: 'bob',
    requestId: 'alice_bob',
    createdAt: serverTimestamp(),
  });
  batch.set(ref, event('accepted'));
  await assertSucceeds(batch.commit());
  await assertSucceeds(getDoc(doc(db('alice'), 'users', 'alice', 'contactEvents', 'accepted')));
  await assertFails(getDoc(doc(db('eve'), 'users', 'alice', 'contactEvents', 'accepted')));
  await assertFails(deleteDoc(ref));
  await assertFails(
    setDoc(doc(database, 'users', 'alice', 'contactEvents', 'fake'), event('removed')),
  );
  const removal = writeBatch(database);
  removal.delete(doc(database, 'users', 'bob', 'contacts', 'alice'));
  removal.delete(doc(database, 'users', 'alice', 'contacts', 'bob'));
  removal.set(doc(database, 'users', 'alice', 'contactEvents', 'removed'), event('removed'));
  await assertSucceeds(removal.commit());
  await assertFails(
    setDoc(doc(database, 'users', 'alice', 'contactEvents', 'replay'), event('removed')),
  );
  await assertSucceeds(deleteDoc(doc(db('alice'), 'users', 'alice', 'contactEvents', 'accepted')));
});

test('decline notifications require the real recipient and an atomic pending-to-declined transition', async () => {
  await request();
  const database = db('bob');
  const event = {
    kind: 'declined',
    actorId: 'bob',
    name: 'Bob',
    requestId: 'alice_bob',
    createdAt: serverTimestamp(),
  };
  const ref = doc(database, 'users', 'alice', 'contactEvents', 'declined');
  await assertFails(setDoc(ref, event));
  const batch = writeBatch(database);
  batch.update(doc(database, 'contactRequests', 'alice_bob'), {
    status: 'declined',
    updatedAt: serverTimestamp(),
  });
  batch.set(ref, event);
  await assertSucceeds(batch.commit());
  await assertSucceeds(getDoc(doc(db('alice'), 'users', 'alice', 'contactEvents', 'declined')));
  await assertFails(setDoc(doc(database, 'users', 'alice', 'contactEvents', 'replay'), event));
  assert.equal(
    (await getDoc(doc(db('alice'), 'users', 'alice', 'contacts', 'bob'))).exists(),
    false,
  );
});

function createListedGroup(database, id, name) {
  const batch = writeBatch(database);
  batch.set(doc(database, 'privateGroups', id), {
    name,
    ownerId: 'alice',
    memberIds: ['alice'],
    joinedIds: ['alice'],
  });
  batch.set(doc(database, 'privateGroups', id, 'members', 'alice'), {
    name: 'Alice',
    avatarUrl: null,
  });
  batch.set(doc(database, 'groupDirectory', id), {
    name,
    active: true,
    creatorName: 'Alice',
    createdAt: serverTimestamp(),
    memberCount: 1,
  });
  return batch.commit();
}
test('directory discovery, uninvited join, live group messages, leave and rejoin', async () => {
  const {
    FirebaseChatRepository,
  } = require('../../.test-build/features/chat/data/FirebaseChatRepository');
  const alice = db('alice'),
    bob = db('bob'),
    eve = db('eve'),
    id = 'discoverable';
  const thread = { groupId: id, senderName: 'Alice' };
  const a = new FirebaseChatRepository(() => alice),
    b = new FirebaseChatRepository(() => bob);
  let stopDirectory, stopMessages;
  try {
    const discovered = new Promise((resolve, reject) => {
      stopDirectory = onSnapshot(
        query(collection(bob, 'groupDirectory'), where('active', '==', true)),
        (s) => {
          if (s.docs.some((d) => d.id === id)) resolve(s.docs.find((d) => d.id === id).data());
        },
        reject,
      );
    });
    await createListedGroup(alice, id, 'Friends');
    const summary = await discovered;
    assert.ok(summary.createdAt.toMillis() > 0);
    assert.deepEqual(summary, {
      active: true,
      name: 'Friends',
      creatorName: 'Alice',
      createdAt: summary.createdAt,
      memberCount: 1,
    });
    const directoryDoc = doc(bob, 'groupDirectory', id);
    await assertFails(updateDoc(directoryDoc, { memberCount: 3 }));
    const privateDoc = doc(bob, 'privateGroups', id);
    const messages = collection(bob, 'privateGroups', id, 'messages');
    await assertFails(getDoc(privateDoc));
    await assertFails(getDocs(messages));
    await assertFails(
      updateDoc(privateDoc, { memberIds: arrayUnion('eve'), joinedIds: arrayUnion('eve') }),
    );
    const join = () => {
      const batch = writeBatch(bob);
      batch.update(privateDoc, { memberIds: arrayUnion('bob'), joinedIds: arrayUnion('bob') });
      batch.update(directoryDoc, { memberCount: increment(1) });
      return batch.commit();
    };
    await assertFails(
      updateDoc(privateDoc, { memberIds: arrayUnion('bob'), joinedIds: arrayUnion('bob') }),
    );
    await assertSucceeds(join());
    assert.equal((await getDoc(directoryDoc)).data().memberCount, 2);
    await assertFails(updateDoc(directoryDoc, { creatorName: 'Bob' }));
    await assertFails(updateDoc(directoryDoc, { createdAt: serverTimestamp() }));
    const received = new Promise((resolve, reject) => {
      stopMessages = b.messages(
        'bob',
        { groupId: id, senderName: 'Bob' },
        50,
        (rows) => {
          if (rows.length) resolve(rows[0]);
        },
        reject,
      );
    });
    await assertSucceeds(a.send('alice', thread, 'Hello group'));
    assert.equal((await received).senderName, 'Alice');
    stopMessages();
    stopMessages = undefined;
    await assertFails(b.send('bob', thread, 'Spoofed'));
    await assertFails(getDocs(collection(eve, 'privateGroups', id, 'messages')));
    const leave = writeBatch(bob);
    leave.update(privateDoc, { memberIds: arrayRemove('bob'), joinedIds: arrayRemove('bob') });
    leave.update(directoryDoc, { memberCount: increment(-1) });
    await assertSucceeds(leave.commit());
    assert.equal((await getDoc(directoryDoc)).data().memberCount, 1);
    await assertFails(getDocs(messages));
    await assertFails(b.send('bob', { groupId: id, senderName: 'Bob' }, 'No longer joined'));
    await assertSucceeds(join());
    assert.equal((await getDocs(messages)).size, 1);
  } finally {
    stopDirectory?.();
    stopMessages?.();
  }
});
test(
  'all joined members see group chat and roster; only a pair can exchange its group-private messages',
  { timeout: 25000 },
  async () => {
    const {
      FirebaseChatRepository,
    } = require('../../.test-build/features/chat/data/FirebaseChatRepository');
    const id = 'three-people';
    const alice = db('alice'),
      bob = db('bob'),
      eve = db('eve');
    const a = new FirebaseChatRepository(() => alice),
      b = new FirebaseChatRepository(() => bob);
    await assertSucceeds(createListedGroup(alice, id, 'Walking'));
    const cards = (database) => collection(database, 'privateGroups', id, 'members');
    await assertFails(getDocs(cards(eve)));
    for (const [database, uid] of [
      [bob, 'bob'],
      [eve, 'eve'],
    ]) {
      const batch = writeBatch(database);
      batch.update(doc(database, 'privateGroups', id), {
        memberIds: arrayUnion(uid),
        joinedIds: arrayUnion(uid),
      });
      batch.update(doc(database, 'groupDirectory', id), { memberCount: increment(1) });
      batch.set(doc(cards(database), uid), { name: names[uid], avatarUrl: null });
      await assertSucceeds(batch.commit());
    }
    assert.deepEqual(
      (await getDocs(cards(eve))).docs.map((d) => d.id),
      ['alice', 'bob', 'eve'],
    );
    await assertFails(setDoc(doc(cards(bob), 'alice'), { name: 'Bob', avatarUrl: null }));
    await assertFails(getDoc(doc(eve, 'users', 'alice')));
    await assertSucceeds(a.send('alice', { groupId: id, senderName: 'Alice' }, 'For everyone'));
    const room = collection(eve, 'privateGroups', id, 'messages');
    assert.equal((await getDocs(room)).docs[0].data().text, 'For everyone');
    const pair = (database) =>
      collection(database, 'privateGroups', id, 'memberChats', 'alice', 'with', 'bob', 'messages');
    let stop;
    try {
      const received = new Promise((resolve, reject) => {
        stop = b.messages(
          'bob',
          { groupId: id, memberId: 'alice' },
          10,
          (rows) => {
            if (rows.length) resolve(rows[0].text);
          },
          reject,
        );
      });
      await assertSucceeds(a.send('alice', { groupId: id, memberId: 'bob' }, 'Only for Bob'));
      assert.equal(await received, 'Only for Bob');
    } finally {
      stop?.();
    }
    await assertSucceeds(b.send('bob', { groupId: id, memberId: 'alice' }, 'Only for Alice'));
    const {
      GroupChatActivityViewModel,
    } = require('../../.test-build/features/chat/viewmodels/GroupChatActivityViewModel');
    const { conversationList } = require('../../.test-build/features/chat/models/conversations');
    const group = { id, name: 'Walking', joinedIds: ['alice', 'bob', 'eve'] };
    const aliceList = new GroupChatActivityViewModel(a, 'alice');
    const eveList = new GroupChatActivityViewModel(new FirebaseChatRepository(() => eve), 'eve');
    const firstMember = (uid, state) =>
      conversationList(uid, [], [group], [], state.entries)[0].members[0];
    try {
      aliceList.sync([group]);
      eveList.sync([group]);
      await until(
        aliceList,
        (state) => firstMember('alice', state).preview?.text === 'Only for Alice',
      );
      const e = new FirebaseChatRepository(() => eve);
      await assertSucceeds(e.send('eve', { groupId: id, memberId: 'alice' }, 'Private from Eve'));
      await Promise.all([
        until(
          aliceList,
          (state) => firstMember('alice', state).preview?.text === 'Private from Eve',
        ),
        until(eveList, (state) => firstMember('eve', state).preview?.text === 'Private from Eve'),
      ]);
      assert.equal(firstMember('alice', aliceList.getSnapshot()).target.memberId, 'eve');
      assert.equal(firstMember('eve', eveList.getSnapshot()).target.memberId, 'alice');
    } finally {
      aliceList.stop();
      eveList.stop();
    }
    const messages = await getDocs(pair(alice));
    assert.equal(messages.size, 2);
    assert.equal((await getDocs(room)).size, 1);
    await assertFails(getDocs(pair(eve)));
    await assertFails(getDoc(doc(pair(eve), messages.docs[0].id)));
    await assertFails(
      setDoc(doc(pair(eve)), { fromId: 'eve', text: 'Intrude', createdAt: serverTimestamp() }),
    );
    await assertFails(
      setDoc(doc(pair(bob)), { fromId: 'alice', text: 'Spoof', createdAt: serverTimestamp() }),
    );
    await assertFails(a.send('alice', { groupId: id, memberId: 'outsider' }, 'Not a member'));
    const leave = writeBatch(bob);
    leave.update(doc(bob, 'privateGroups', id), {
      memberIds: arrayRemove('bob'),
      joinedIds: arrayRemove('bob'),
    });
    leave.update(doc(bob, 'groupDirectory', id), { memberCount: increment(-1) });
    leave.delete(doc(cards(bob), 'bob'));
    await assertSucceeds(leave.commit());
    await assertFails(getDocs(pair(bob)));
    await assertFails(a.send('alice', { groupId: id, memberId: 'bob' }, 'Left'));
  },
);
test('only a notification recipient may acknowledge its current occurrence', async () => {
  await request();
  const ref = doc(db('bob'), 'contactRequests', 'alice_bob');
  const version = Math.floor((await getDoc(ref)).data().updatedAt.toMillis());
  await assertFails(updateDoc(ref, { ackFor: version - 1 }));
  await assertFails(
    updateDoc(doc(db('alice'), 'contactRequests', 'alice_bob'), { ackFor: version }),
  );
  await assertSucceeds(updateDoc(ref, { ackFor: version }));
  assert.equal((await getDoc(ref)).data().status, 'pending');
  await assertSucceeds(accept());
});
test('invitations and directory joins require explicit membership before location access', async () => {
  const owner = db('alice');
  const peer = db('bob');
  const group = doc(owner, 'privateGroups', 'family');
  await assertSucceeds(createListedGroup(owner, 'family', 'Family'));
  await assertFails(updateDoc(group, { memberIds: ['alice', 'eve'] }));
  await request();
  await accept();
  await assertSucceeds(updateDoc(group, { memberIds: ['alice', 'bob'] }));
  const listing = doc(peer, 'groupDirectory', 'family');
  assert.equal((await getDoc(listing)).data().memberCount, 1);
  await assertSucceeds(getDoc(doc(peer, 'privateGroups', 'family')));
  await assertFails(getDocs(collection(peer, 'privateGroups', 'family', 'live')));
  await assertFails(
    updateDoc(doc(peer, 'privateGroups', 'family'), { joinedIds: ['alice', 'bob', 'eve'] }),
  );
  const joining = writeBatch(peer);
  joining.update(doc(peer, 'privateGroups', 'family'), { joinedIds: ['alice', 'bob'] });
  joining.update(listing, { memberCount: increment(1) });
  await assertSucceeds(joining.commit());
  const live = doc(owner, 'privateGroups', 'family', 'live', 'alice');
  const payload = {
    nickname: 'Alice',
    avatarUrl: null,
    latitude: 28.5,
    longitude: -81.3,
    trip: true,
    trail: '[]',
    updatedAt: serverTimestamp(),
  };
  await assertSucceeds(setDoc(live, payload));
  await assertSucceeds(
    getDocs(query(collection(peer, 'privateGroups', 'family', 'live'), limit(10))),
  );
  await assertFails(getDoc(doc(db('eve'), 'privateGroups', 'family', 'live', 'alice')));
  await assertFails(
    setDoc(doc(peer, 'privateGroups', 'family', 'live', 'alice'), { ...payload, nickname: 'Bob' }),
  );
  const history = doc(peer, 'users', 'bob', 'formerGroups', 'family');
  await assertFails(setDoc(history, { name: 'Family' }));
  const departure = writeBatch(peer);
  departure.update(doc(peer, 'privateGroups', 'family'), {
    memberIds: ['alice'],
    joinedIds: ['alice'],
  });
  departure.delete(doc(peer, 'privateGroups', 'family', 'live', 'bob'));
  departure.update(listing, { memberCount: increment(-1) });
  departure.set(history, { name: 'Family' });
  await assertSucceeds(departure.commit());
  assert.deepEqual((await assertSucceeds(getDoc(history))).data(), { name: 'Family' });
  await assertFails(getDoc(doc(owner, 'users', 'bob', 'formerGroups', 'family')));
  await assertFails(getDoc(doc(peer, 'privateGroups', 'family')));
  await assertFails(getDoc(doc(peer, 'privateGroups', 'family', 'live', 'alice')));
  await assertSucceeds(updateDoc(group, { memberIds: ['alice', 'bob'] }));
  const rejoin = writeBatch(peer);
  rejoin.update(doc(peer, 'privateGroups', 'family'), { joinedIds: ['alice', 'bob'] });
  rejoin.delete(history);
  rejoin.update(listing, { memberCount: increment(1) });
  await assertSucceeds(rejoin.commit());
  assert.equal((await getDoc(history)).exists(), false);
  const retire = writeBatch(owner);
  retire.delete(group);
  retire.set(doc(owner, 'groupDirectory', 'family'), { active: false });
  await assertSucceeds(retire.commit());
  await assertFails(createListedGroup(owner, 'family', 'Reused'));
  await assertFails(getDoc(live));
});

test('sharing preferences disable nearby publishing and require opt-in for ordinary private-group GPS', async (t) => {
  const database = db('alice');
  const {
    FirebaseSharingRepository,
  } = require('../../.test-build/features/contacts/data/FirebaseSharingRepository');
  const repository = new FirebaseSharingRepository();
  t.mock.method(repository, 'database', () => database);
  const prefs = doc(database, 'users', 'alice', 'preferences', 'sharing');
  await assertSucceeds(setDoc(prefs, { nearby: false, groups: false }));
  await assertFails(getDoc(doc(db('bob'), 'users', 'alice', 'preferences', 'sharing')));
  const presence = {
    nickname: 'Alice',
    avatarUrl: null,
    latitude: 28.5,
    longitude: -81.3,
    geohash: geohashForLocation([28.5, -81.3]),
    bucket: Math.floor(Date.now() / 120000),
    updatedAt: serverTimestamp(),
  };
  await assertFails(setDoc(doc(database, 'sharedLocations', 'alice'), presence));
  await createListedGroup(database, 'friends', 'Friends');
  const live = doc(database, 'privateGroups', 'friends', 'live', 'alice');
  const location = {
    nickname: 'Alice',
    avatarUrl: null,
    latitude: 28.5,
    longitude: -81.3,
    trip: false,
    trail: '[]',
    updatedAt: serverTimestamp(),
  };
  await assertFails(setDoc(live, location));
  await assertSucceeds(repository.savePreferences('alice', { nearby: false, groups: true }));
  assert.deepEqual((await getDoc(prefs)).data(), { nearby: false, groups: true });
  await assertSucceeds(setDoc(live, location));
  await createListedGroup(database, 'trip', 'Trip');
  const trip = doc(database, 'privateGroups', 'trip', 'live', 'alice');
  await assertSucceeds(setDoc(trip, { ...location, trip: true }));
  await assertSucceeds(repository.savePreferences('alice', { nearby: false, groups: false }));
  assert.deepEqual((await getDoc(prefs)).data(), { nearby: false, groups: false });
  assert.equal((await getDoc(live)).exists(), false);
  assert.equal((await getDoc(trip)).data().trip, true);
  await assertFails(setDoc(live, location));
  await assertSucceeds(repository.savePreferences('alice', { nearby: false, groups: false }, true));
  assert.equal((await getDoc(trip)).exists(), false, 'Stop all sharing removes active trips too');
  assert.equal((await getDoc(doc(database, 'sharedLocations', 'alice'))).exists(), false);
});

test(
  'choosing private groups revokes a live nearby marker for outsiders and blocks stale publishers',
  { timeout: 20000 },
  async (t) => {
    const {
      FirebaseSharingRepository,
    } = require('../../.test-build/features/contacts/data/FirebaseSharingRepository');
    const owner = db('alice'),
      member = db('bob'),
      outside = db('eve');
    const repository = new FirebaseSharingRepository();
    t.mock.method(repository, 'database', () => owner);
    const prefs = doc(owner, 'users', 'alice', 'preferences', 'sharing');
    const marker = doc(owner, 'sharedLocations', 'alice');
    const observed = doc(outside, 'sharedLocations', 'alice');
    const bucket = Math.floor(Date.now() / 120000);
    const coords = {
      nickname: 'Alice',
      avatarUrl: null,
      latitude: 28.5,
      longitude: -81.3,
      updatedAt: serverTimestamp(),
    };
    const payload = {
      ...coords,
      geohash: geohashForLocation([coords.latitude, coords.longitude]),
      bucket,
    };
    await assertSucceeds(setDoc(marker, payload));
    await assertSucceeds(createListedGroup(owner, 'circle', 'Circle'));
    const join = writeBatch(member);
    join.update(doc(member, 'privateGroups', 'circle'), {
      memberIds: arrayUnion('bob'),
      joinedIds: arrayUnion('bob'),
    });
    join.update(doc(member, 'groupDirectory', 'circle'), { memberCount: increment(1) });
    await assertSucceeds(join.commit());
    await assertFails(setDoc(prefs, { nearby: false, groups: true })); // Leaving a public marker behind.
    const both = writeBatch(owner);
    both.set(prefs, { nearby: true, groups: true });
    both.delete(marker);
    await assertFails(both.commit());
    const nearby = query(
      collection(outside, 'sharedLocations'),
      where('bucket', 'in', [bucket - 1, bucket]),
      orderBy('geohash'),
      limit(200),
    );
    const initial = Promise.withResolvers(),
      removed = Promise.withResolvers();
    let visible = false;
    const stop = onSnapshot(
      nearby,
      (snap) => {
        if (snap.docs.some((item) => item.id === 'alice')) {
          visible = true;
          initial.resolve();
        } else if (visible) removed.resolve();
      },
      (reason) => {
        initial.reject(reason);
        removed.reject(reason);
      },
    );
    t.after(stop);
    await initial.promise;
    // Even an older caller supplying both flags gets the more restrictive audience.
    await assertSucceeds(repository.savePreferences('alice', { nearby: true, groups: true }));
    await removed.promise;
    assert.deepEqual((await getDoc(prefs)).data(), { nearby: false, groups: true });
    assert.equal((await getDoc(observed)).exists(), false);
    await assertFails(setDoc(marker, payload));
    const livePath = ['privateGroups', 'circle', 'live', 'alice'];
    // Run the receiving client's actual membership and location listeners on the home map.
    const client = require('../../.test-build/config/firebase/client');
    const {
      SharingViewModel,
    } = require('../../.test-build/features/contacts/viewmodels/SharingViewModel');
    t.mock.method(client, 'getFirebaseAuth', () => ({
      currentUser: {
        uid: 'bob',
        getIdTokenResult: async () => ({ issuedAtTime: new Date().toUTCString() }),
      },
    }));
    const memberRepository = new FirebaseSharingRepository();
    t.mock.method(memberRepository, 'database', () => member);
    const map = new SharingViewModel(memberRepository, { id: 'bob', fullName: 'Bob' });
    map.start();
    t.after(map.dispose);
    await assertSucceeds(setDoc(doc(owner, ...livePath), { ...coords, trip: false, trail: '[]' }));
    await until(map, (state) =>
      state.locations.some(
        (location) => location.id === 'alice' && location.latitude === coords.latitude,
      ),
    );
    assert.equal(map.getSnapshot().selectedId, '');
    assert.equal(map.getSnapshot().preferences.groups, false);
    assert.ok(map.focusMember('alice'));
    await assertFails(getDoc(doc(outside, ...livePath)));
    await assertFails(getDocs(collection(outside, 'privateGroups', 'circle', 'live')));
    await assertSucceeds(repository.savePreferences('alice', { nearby: false, groups: false }));
    await until(map, (state) => !state.locations.length && !state.focus);
    await assertFails(setDoc(marker, payload));
    await assertSucceeds(repository.savePreferences('alice', { nearby: true, groups: false }));
    await assertSucceeds(setDoc(marker, payload));
    // Simulate a preference document left by an older binary before these rules were published.
    await env.withSecurityRulesDisabled((ctx) =>
      setDoc(doc(ctx.firestore(), 'users', 'alice', 'preferences', 'sharing'), {
        nearby: true,
        groups: true,
      }),
    );
    await assertFails(setDoc(marker, payload));
    await assertFails(getDoc(observed));
  },
);

test(
  'another member sees a trip start, move and stop on the map without selecting a group',
  { timeout: 20000 },
  async (t) => {
    const {
      FirebaseSharingRepository,
    } = require('../../.test-build/features/contacts/data/FirebaseSharingRepository');
    const {
      SharingViewModel,
    } = require('../../.test-build/features/contacts/viewmodels/SharingViewModel');
    const { mapPeople } = require('../../.test-build/features/map/models/mapPeople');
    const owner = db('alice'),
      member = db('bob');
    await createListedGroup(owner, 'walk', 'Walk');
    const join = writeBatch(member);
    join.update(doc(member, 'privateGroups', 'walk'), {
      memberIds: arrayUnion('bob'),
      joinedIds: arrayUnion('bob'),
    });
    join.update(doc(member, 'groupDirectory', 'walk'), { memberCount: increment(1) });
    await join.commit();
    const client = require('../../.test-build/config/firebase/client');
    t.mock.method(client, 'getFirebaseAuth', () => ({
      currentUser: {
        uid: 'bob',
        getIdTokenResult: async () => ({ issuedAtTime: new Date().toUTCString() }),
      },
    }));
    const listener = new FirebaseSharingRepository();
    t.mock.method(listener, 'database', () => member);
    const receiver = new SharingViewModel(listener, { id: 'bob', fullName: 'Bob' });
    receiver.start();
    t.after(receiver.dispose);
    await until(receiver, (s) => s.membershipsLoaded && s.groups.some((g) => g.id === 'walk'));
    const group = receiver.getSnapshot().groups.find((g) => g.id === 'walk');
    const writer = new FirebaseSharingRepository();
    t.mock.method(writer, 'database', () => owner);
    const observe = (data) => (_uid, next) => {
      next(data);
      return () => {};
    };
    const sender = new SharingViewModel(
      {
        observeDirectory: observe([]),
        observePreferences: observe({ nearby: false, groups: false }),
        observeGroups: observe([group]),
        observeLocations: () => () => {},
        publish: writer.publish.bind(writer),
      },
      { id: 'alice', fullName: 'Alice', avatarUrl: null },
    );
    sender.start();
    t.after(sender.dispose);
    const seeMap = () =>
      mapPeople(true, 'bob', [], receiver.getSnapshot().locations, null, null, []);
    const at = (lat) => ({ latitude: lat, longitude: -81, timestamp: Date.now(), accuracy: 5 });
    sender.setPosition(at(28), [], true);
    sender.startTrip(group);
    await until(receiver, (s) => s.locations.some((row) => row.id === 'alice' && row.trip));
    assert.equal(receiver.getSnapshot().selectedId, '');
    assert.equal(seeMap().users[0].latitude, 28);
    await assertFails(getDoc(doc(db('eve'), 'privateGroups', 'walk', 'live', 'alice')));
    const first = at(28.0001),
      second = at(28.0002);
    sender.setPosition(first, [[first]], true);
    sender.setPosition(second, [[first, second]], true);
    await until(receiver, (s) => s.locations.some((row) => row.latitude === second.latitude));
    assert.deepEqual(seeMap().sharedTrail, [[first, second]]);
    sender.stopTrip();
    await until(receiver, (s) => !s.locations.length);
    assert.deepEqual(seeMap().users, []);
    assert.equal(seeMap().sharedTrail, undefined);
  },
);

test('joined private-group members can request a contact without publishing a public GPS location', async () => {
  await env.withSecurityRulesDisabled(async (context) => {
    await setDoc(doc(context.firestore(), 'privateGroups', 'shared'), {
      name: 'Shared',
      ownerId: 'alice',
      memberIds: ['alice', 'bob'],
      joinedIds: ['alice', 'bob'],
    });
  });
  await assertSucceeds(
    setDoc(doc(db('alice'), 'contactRequests', 'alice_bob'), {
      ...pending(),
      toEmail: '',
      groupId: 'shared',
    }),
  );
  await assertFails(
    setDoc(doc(db('eve'), 'contactRequests', 'eve_bob'), {
      ...pending(),
      fromId: 'eve',
      fromName: 'Eve',
      fromEmail: 'eve@example.com',
      toEmail: '',
      groupId: 'shared',
    }),
  );
});
