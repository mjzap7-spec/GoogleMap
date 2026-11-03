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
    limit(50),
  );
  const result = await assertSucceeds(getDocs(q));
  assert.equal(result.size, 1);
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
