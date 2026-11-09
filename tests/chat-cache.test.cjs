const { test } = require('node:test');
const assert = require('node:assert/strict');
const Module = require('node:module');

function fixture() {
  const subscriptions = [];
  const filename = require.resolve('../.test-build/features/chat/data/FirebaseChatRepository');
  delete require.cache[filename];
  const original = Module._load;
  Module._load = function (request, ...args) {
    if (request === '../../../config/firebase/client') return {};
    if (request === 'firebase/firestore')
      return {
        collection: (_db, ...path) => path.join('/'),
        query: (ref) => ref,
        orderBy: () => {},
        limit: () => {},
        onSnapshot: (_ref, options, next, fail) => {
          assert.equal(options.includeMetadataChanges, true);
          subscriptions.push({ next, fail });
          return () => {};
        },
      };
    return original.call(this, request, ...args);
  };
  try {
    const { FirebaseChatRepository } = require(filename);
    return { repo: new FirebaseChatRepository(() => ({})), subscriptions };
  } finally {
    Module._load = original;
  }
}
const snapshot = (fromCache, docs = []) => ({
  empty: !docs.length,
  metadata: { fromCache },
  docs,
});
const message = {
  id: 'saved-message',
  metadata: { hasPendingWrites: false },
  data: () => ({ fromId: 'bob', text: 'Existing message', createdAt: { toMillis: () => 100 } }),
};

test('chat history ignores an empty cache and loads messages before declaring a conversation empty', () => {
  const { repo, subscriptions } = fixture();
  const values = [];
  repo.messages('me', { groupId: 'friends', memberId: 'bob' }, 1, (rows) => values.push(rows));
  const { next } = subscriptions[0];
  next(snapshot(true));
  assert.equal(values.length, 0);
  next(snapshot(false, [message]));
  assert.equal(values[0][0].text, 'Existing message');
  next(snapshot(false));
  assert.deepEqual(values[1], [], 'a confirmed empty thread can still start a new chat');
});

test('cached messages remain immediately usable and local-only deletion stays respected', () => {
  const { repo, subscriptions } = fixture();
  const values = [];
  const peer = { peerId: 'bob', requestId: 'request' };
  repo.messages('me', peer, 1, (rows) => values.push(rows));
  subscriptions[0].next(snapshot(true, [message]));
  assert.equal(values[0][0].id, message.id);
  repo.messages(
    'me',
    peer,
    1,
    (rows) => values.push(rows),
    () => {},
    {
      hiddenIds: [message.id],
    },
  );
  subscriptions[1].next(snapshot(true, [message]));
  assert.deepEqual(values[1], []);
});

test('the direct inbox waits through an empty cache and receives a confirmed empty result', () => {
  const { repo, subscriptions } = fixture();
  const values = [];
  repo.inbox('me', (rows) => values.push(rows));
  subscriptions[0].next(snapshot(true));
  assert.equal(values.length, 0);
  subscriptions[0].next(snapshot(false));
  assert.deepEqual(values, [[]]);
});
