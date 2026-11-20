const { test } = require('node:test');
const assert = require('node:assert/strict');
const Module = require('node:module');

test('transfer context checks ignore absent cached documents but reject confirmed revocation', () => {
  const subscriptions = [];
  let failed = 0,
    received = 0;
  class Timestamp {
    toMillis() {
      return Date.now() + 60000;
    }
  }
  const original = Module._load;
  Module._load = function (request, ...args) {
    if (request.endsWith('/config/firebase/client'))
      return {
        getFirebaseAuth: () => ({ currentUser: { uid: 'alice' } }),
        getFirebaseApp: () => ({}),
      };
    if (request.endsWith('/ServerClock'))
      return {
        ServerClock: class {
          localDeadline(value) {
            return value;
          }
        },
      };
    if (request === './FirebaseChatRepository') return {};
    if (request === 'firebase/firestore')
      return {
        getFirestore: () => ({}),
        Timestamp,
        doc: (_, ...path) => path.join('/'),
        onSnapshot(ref, next, fail) {
          const value = { ref, next, fail, stopped: false };
          subscriptions.push(value);
          return () => {
            value.stopped = true;
          };
        },
      };
    return original.call(this, request, ...args);
  };
  try {
    const {
      FirebaseTransferRepository,
    } = require('../.test-build/features/chat/data/firebase/FirebaseTransferRepository');
    const repo = new FirebaseTransferRepository();
    const stop = repo.watch(
      'alice',
      'abcdefghijklmnopqrst',
      () => {
        received++;
      },
      () => {
        failed++;
      },
    );
    subscriptions[0].next({
      data: () => ({
        kind: 'contact',
        contextId: 'request',
        fromId: 'alice',
        toId: 'bob',
        expiresAt: new Timestamp(),
      }),
    });
    const absent = { exists: () => false, metadata: { fromCache: true }, data: () => undefined };
    subscriptions[1].next(absent);
    subscriptions[2].next(absent);
    assert.equal(failed, 0);
    assert.equal(received, 1);
    subscriptions[1].next({
      exists: () => true,
      metadata: { fromCache: false },
      data: () => ({ status: 'accepted' }),
    });
    subscriptions[2].next({
      exists: () => true,
      metadata: { fromCache: false },
      data: () => ({ requestId: 'request' }),
    });
    assert.equal(failed, 0);
    subscriptions[2].next({ ...absent, metadata: { fromCache: false } });
    assert.equal(failed, 1);
    assert.ok(subscriptions.every((value) => value.stopped));
    stop();
  } finally {
    Module._load = original;
  }
});
