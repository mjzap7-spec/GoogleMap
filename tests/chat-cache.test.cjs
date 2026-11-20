const { test } = require('node:test');
const assert = require('node:assert/strict');
const Module = require('node:module');

function fixture() {
  const subscriptions = [];
  const filename =
    require.resolve('../.test-build/features/chat/data/firebase/FirebaseChatRepository');
  delete require.cache[filename];
  const original = Module._load;
  Module._load = function (request, ...args) {
    if (request === '../../../../config/firebase/client') return {};
    if (request === 'firebase/firestore')
      return {
        collection: (_db, ...path) => path.join('/'),
        doc: (_db, ...path) => path.join('/'),
        query: (ref) => ref,
        orderBy: () => {},
        where: () => {},
        Timestamp: class {},
        limit: () => {},
        onSnapshot: (ref, options, next, fail) => {
          assert.equal(options.includeMetadataChanges, true);
          const current = { ref, next, fail, stopped: false };
          subscriptions.push(current);
          return () => {
            current.stopped = true;
          };
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

test('unread keeps cached messages visible and clears only on a confirmed empty snapshot', () => {
  const { repo, subscriptions } = fixture();
  const values = [];
  repo.unread('me', { peerId: 'bob', requestId: 'request' }, undefined, (count) =>
    values.push(count),
  );
  const { next } = subscriptions[0];
  next(snapshot(true, [message]));
  next(snapshot(true));
  assert.deepEqual(values, [1]);
  next(snapshot(false));
  assert.deepEqual(values, [1, 0]);
});

test('unread counts missed calls once, removes answered calls live, and releases call listeners on read', () => {
  const { repo, subscriptions } = fixture();
  const counts = [];
  const stop = repo.unread('me', { peerId: 'bob', requestId: 'request' }, undefined, (count) =>
    counts.push(count),
  );
  const id = 'abcdefghijklmnopqrst';
  const callMessage = {
    ...message,
    id: 'call_' + id,
    data: () => ({ ...message.data(), text: 'Voice interview invitation' }),
  };
  subscriptions[0].next(snapshot(false, [message, callMessage]));
  assert.deepEqual(counts, [1]); // No temporary unread badge for an already handled call.
  assert.equal(subscriptions[1].ref, 'interviewCalls/' + id);
  const emitCall = (call) => subscriptions[1].next({ data: () => call });
  emitCall({ toId: 'me', status: 'ringing' });
  assert.equal(counts.at(-1), 2);
  emitCall({ toId: 'me', status: 'ended' });
  assert.equal(counts.at(-1), 2); // The same call is never counted twice.
  emitCall({ toId: 'me', status: 'accepted', answer: {} });
  assert.equal(counts.at(-1), 1);
  emitCall({ toId: 'me', status: 'ended', answer: {} });
  assert.equal(counts.at(-1), 1);
  emitCall({ toId: 'me', status: 'declined' });
  assert.equal(counts.at(-1), 1);
  subscriptions[0].next(snapshot(false));
  assert.equal(counts.at(-1), 0);
  assert.equal(subscriptions[1].stopped, true);
  emitCall({ toId: 'me', status: 'ended' });
  assert.equal(counts.at(-1), 0);
  stop();
  assert.equal(subscriptions[0].stopped, true);
});
