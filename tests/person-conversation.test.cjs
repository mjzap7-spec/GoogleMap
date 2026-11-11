const { test } = require('node:test');
const assert = require('node:assert/strict');
const { personConversation } = require('../.test-build/features/chat/models/personConversation');
const {
  conversationList,
  resolveConversation,
  selectConversation,
  memberKey,
} = require('../.test-build/features/chat/models/conversations');
const {
  GroupChatActivityViewModel,
} = require('../.test-build/features/chat/viewmodels/GroupChatActivityViewModel');

const contact = { id: 'saved-bob', peerId: 'bob', requestId: 'request', name: 'Bob' };
const family = { id: 'family', name: 'Family', joinedIds: ['me', 'bob'] };
const friends = { id: 'friends', name: 'Friends', joinedIds: ['me', 'bob'] };
const latest = (time) => ({ latest: { id: 'message', text: 'Existing history', time } });
const resolve = (groups, previews, activity, counts = new Map(), contacts = [contact]) =>
  personConversation('me', 'bob', contacts, groups, previews, activity, counts);

test('a map shortcut opens the same read group-member history as the Chats list', () => {
  const activity = new Map([[memberKey('family', 'bob'), latest(50)]]);
  const entry = resolve([family], [], activity);
  const rows = conversationList('me', [contact], [family], [], activity);
  assert.equal(entry.status, 'ready');
  assert.deepEqual(entry.selection, selectConversation(rows[0].members[0]));
  assert.deepEqual(resolveConversation(rows, entry.selection).target, {
    groupId: 'family',
    memberId: 'bob',
  });
});

test('opening waits for candidate histories instead of choosing an empty contact prematurely', () => {
  const activity = new Map();
  assert.equal(resolve([family, friends], [], activity).status, 'loading');
  activity.set(memberKey('family', 'bob'), {});
  assert.equal(resolve([family, friends], [], activity).status, 'loading');
  activity.set(memberKey('friends', 'bob'), latest(50));
  assert.equal(resolve([family, friends], [], activity).selection.groupId, 'friends');
});

test('the most recent private conversation wins across groups, ignoring room activity', () => {
  const activity = new Map([
    [memberKey('family', 'bob'), latest(20)],
    [memberKey('friends', 'bob'), latest(50)],
    ['group:family', latest(100)],
  ]);
  assert.equal(resolve([family, friends], [], activity).selection.groupId, 'friends');
  assert.equal(resolve([friends, family], [], activity).selection.groupId, 'friends');
  const direct = [{ requestId: 'request', peerId: 'bob', time: 60 }];
  assert.deepEqual(resolve([family, friends], direct, activity).selection, {
    key: 'contact:saved-bob',
  });
});

test('unread conversations take priority and reading never retargets an already open thread', () => {
  const key = memberKey('family', 'bob');
  const activity = new Map([[key, latest(20)]]);
  const previews = [{ requestId: 'request', peerId: 'bob', time: 60 }];
  const counts = new Map([[key, 2]]);
  const entry = resolve([family], previews, activity, counts);
  assert.equal(entry.selection.key, key);
  counts.clear();
  const rows = conversationList('me', [contact], [family], previews, activity, counts);
  assert.equal(resolveConversation(rows, entry.selection).target.groupId, 'family');
  assert.equal(resolve([family], previews, activity, counts).selection.key, 'contact:saved-bob');
});

test('failed history loads remain retryable rather than silently opening another transcript', () => {
  const key = memberKey('family', 'bob');
  const activity = new Map([[key, { failed: true }]]);
  assert.equal(resolve([family], [], activity).status, 'error');
  activity.set(key, latest(50));
  assert.equal(resolve([family], [], activity).selection.key, key);
});

test('empty histories can start a conversation and former members do not gain chat access', () => {
  const activity = new Map([[memberKey('family', 'bob'), {}]]);
  assert.equal(resolve([family], [], activity).selection.key, 'contact:saved-bob');
  assert.equal(resolve([family], [], activity, new Map(), []).selection.groupId, 'family');
  for (const joinedIds of [['bob'], ['me']]) {
    assert.equal(
      resolve([{ ...family, joinedIds }], [], new Map(), new Map(), []).status,
      'unavailable',
    );
  }
  assert.equal(
    personConversation('me', 'me', [], [family], [], activity, new Map()).status,
    'unavailable',
  );
});

test('activity distinguishes the first empty snapshot from a pending history without repeating updates', () => {
  const callbacks = new Map();
  const model = new GroupChatActivityViewModel(
    {
      members: () => () => {},
      messages: (_uid, peer, _limit, next) => {
        if (peer.memberId) callbacks.set(memberKey(peer.groupId, peer.memberId), next);
        return () => {};
      },
    },
    'me',
  );
  model.sync([family]);
  const key = memberKey('family', 'bob');
  assert.equal(resolve([family], [], model.getSnapshot().entries).status, 'loading');
  callbacks.get(key)([]);
  assert.equal(resolve([family], [], model.getSnapshot().entries).status, 'ready');
  const snapshot = model.getSnapshot();
  callbacks.get(key)([]);
  assert.equal(model.getSnapshot(), snapshot);
  model.stop();
});

test('background activity releases listeners, retains previews, and refreshes membership on resume', () => {
  const watches = [];
  const subscribe = (next) => {
    const watch = { next, stopped: false };
    watches.push(watch);
    return () => {
      watch.stopped = true;
    };
  };
  const model = new GroupChatActivityViewModel(
    {
      members: (_uid, _groupId, next) => subscribe(next),
      messages: (_uid, _peer, _limit, next) => subscribe(next),
    },
    'me',
  );
  model.sync([family]);
  assert.equal(watches.length, 3);
  watches[2].next([{ id: 'old', text: 'Hello', time: 10 }]);
  const cached = model.getSnapshot();
  model.pause();
  assert.ok(watches.every((watch) => watch.stopped));
  assert.equal(model.getSnapshot(), cached, 'backgrounding does not blank the chat list');
  watches[2].next([{ id: 'late', text: 'Ignore callback', time: 20 }]);
  assert.equal(model.getSnapshot(), cached);
  model.sync([family]);
  assert.equal(watches.length, 6);
  model.sync([family]);
  assert.equal(watches.length, 6, 'unchanged group snapshots do not duplicate listeners');
  watches[5].next([{ id: 'new', text: 'Fresh', time: 30 }]);
  assert.equal(model.getSnapshot().entries.get(memberKey('family', 'bob')).latest.id, 'new');
  model.pause();
  model.sync([]);
  assert.equal(
    model.getSnapshot().entries.size,
    0,
    'removed memberships cannot retain cached entries after pause',
  );
  model.stop();
});
