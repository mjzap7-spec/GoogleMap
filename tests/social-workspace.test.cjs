const { test } = require('node:test');
const assert = require('node:assert/strict');
const { DismissalReceipts } = require('../.test-build/shared/feedback/DismissalReceipts');
const { conversationList } = require('../.test-build/features/chat/models/conversations');
test('a nested sender badge combines both private transcripts and opens the one with unread messages', () => {
  const {
    memberKey,
    selectConversation,
  } = require('../.test-build/features/chat/models/conversations');
  const contact = { id: 'bob', peerId: 'bob', name: 'Bob', requestId: 'request' };
  const room = { id: 'family', name: 'Family', joinedIds: ['me', 'bob'] };
  const member = memberKey('family', 'bob');
  const activity = new Map([[member, { latest: { id: 'p', time: 50, text: 'Group private' } }]]);
  const preview = [{ peerId: 'bob', requestId: 'request', time: 30, text: 'Direct' }];
  const counts = new Map([
    ['group:family', 1],
    ['direct:request', 3],
    [member, 2],
  ]);
  const row = () => conversationList('me', [contact], [room], preview, activity, counts)[0];
  assert.equal(row().unread, 1);
  assert.equal(row().members[0].unread, 5);
  assert.equal(selectConversation(row().members[0]).key, member);
  counts.delete(member);
  assert.equal(selectConversation(row().members[0]).key, 'contact:bob');
  assert.equal(row().members[0].unread, 3);
});

test('duplicate conversation aliases, removed memberships and stale listeners cannot inflate the toolbar badge', () => {
  const {
    UnreadChatsViewModel,
  } = require('../.test-build/features/chat/viewmodels/UnreadChatsViewModel');
  const { threadKey } = require('../.test-build/features/chat/models/chat');
  let receipts;
  const callbacks = new Map();
  const model = new UnreadChatsViewModel(
    {
      receipts: (_, next) => {
        receipts = next;
        next(new Map());
        return () => {};
      },
      unread: (_, peer, after, next) => {
        callbacks.set(threadKey(peer), next);
        return () => {};
      },
    },
    'me',
  );
  const contact = { id: 'bob', peerId: 'bob', requestId: 'request' };
  const group = { id: 'family', joinedIds: ['me', 'bob'] };
  model.start();
  model.sync([contact, contact], [group, group]);
  assert.equal(callbacks.size, 3);
  const key = threadKey({ groupId: 'family', memberId: 'bob' }),
    old = callbacks.get(key);
  old(3);
  callbacks.get('direct:request')(2);
  callbacks.get('direct:request')(2);
  assert.equal(model.getSnapshot().total, 5);
  receipts(new Map([[key, { seconds: 10, nanoseconds: 7 }]]));
  callbacks.get(key)(1);
  old(3);
  assert.equal(model.getSnapshot().total, 3);
  model.sync([contact], []);
  callbacks.get(key)(6);
  assert.equal(model.getSnapshot().total, 2);
  model.stop();
  callbacks.get('direct:request')(4);
  assert.equal(model.getSnapshot().total, 0);
});
const { screenHelp } = require('../.test-build/features/help/models/helpTopics');
const {
  ContactEditorViewModel,
} = require('../.test-build/features/contacts/viewmodels/ContactEditorViewModel');

test('a dismissed alert stays dismissed across restarts for its own account and occurrence', async () => {
  const values = new Map();
  const storage = {
    async getItem(key) {
      return values.get(key) ?? null;
    },
    async setItem(key, value) {
      values.set(key, value);
    },
    async removeItem(key) {
      values.delete(key);
    },
  };
  const first = new DismissalReceipts(storage);
  await first.set('alice', 'map-offline', true);
  const restarted = new DismissalReceipts(storage);
  assert.equal(await restarted.has('alice', 'map-offline'), true);
  assert.equal(await restarted.has('bob', 'map-offline'), false);
  assert.equal(await restarted.has('alice', 'profile-offline'), false);
  await restarted.set('alice', 'map-offline', false);
  assert.equal(await new DismissalReceipts(storage).has('alice', 'map-offline'), false);
});

test('chat sidebar includes contacts and only joined groups, independent of display name', () => {
  const person = { id: 'bob', peerId: 'bob', requestId: 'invite', name: 'Friends' };
  const group = { id: 'bob', name: 'Friends', joinedIds: ['alice'] };
  const preview = { requestId: 'invite', text: 'Meet here', time: 1000 };
  const rows = conversationList(
    'alice',
    [person, { id: 'self', peerId: 'alice', requestId: 'legacy', name: 'Me' }],
    [group, { id: 'not-joined', name: 'Others', joinedIds: ['bob'] }],
    [preview],
  );
  assert.deepEqual(
    rows.map((row) => row.key),
    ['contact:bob', 'group:bob'],
  );
  assert.equal(rows[0].preview.text, 'Meet here');
  assert.equal(
    conversationList('alice', [person], [{ ...group, joinedIds: ['bob'] }], [preview]).length,
    1,
  );
});

test('member rows follow joined membership rather than GPS, saved contacts or received invitations', () => {
  const {
    memberConversations,
    memberKey,
  } = require('../.test-build/features/chat/models/conversations');
  const group = { id: 'walking', memberIds: ['alice', 'bob', 'eve'], joinedIds: ['alice', 'bob'] };
  const self = { id: 'alice', fullName: 'Alice' };
  const cards = [
    { id: 'bob', name: 'Bob', avatarUrl: null },
    { id: 'eve', name: 'Eve', avatarUrl: null },
  ];
  const rows = memberConversations(group, cards, [], self);
  const otherMembers = memberConversations(group, cards, [{ peerId: 'bob', name: 'Alice' }], self, {
    includeSelf: false,
  });
  assert.deepEqual(
    otherMembers.map((row) => row.target.memberId),
    ['bob'],
  );
  assert.deepEqual(
    memberConversations({ ...group, joinedIds: ['alice'] }, cards, [], self, {
      includeSelf: false,
    }),
    [],
  );
  assert.deepEqual(
    rows.map((r) => r.name),
    ['Alice', 'Bob'],
  );
  assert.deepEqual(rows[1].target, { groupId: 'walking', memberId: 'bob' });
  assert.equal(rows[1].key, memberKey('walking', 'bob'));
  assert.deepEqual(memberConversations(group, cards, [], { id: 'eve' }), []);
  assert.equal(
    memberConversations(group, cards, [{ peerId: 'bob', name: 'Bobby' }], self)[1].name,
    'Bobby',
  );
});

test('shared contacts appear inside joined rooms, and activity reorders both levels without switching the open thread', () => {
  const {
    memberKey,
    resolveConversation,
    selectConversation,
    visibleConversations,
  } = require('../.test-build/features/chat/models/conversations');
  const contacts = ['ben', 'zoe', 'dan'].map((id) => ({
    id: id + '-contact',
    peerId: id,
    name: id,
    requestId: id + '-request',
  }));
  const groups = [
    {
      id: 'hike',
      name: 'Hiking',
      memberIds: ['me', 'ben', 'zoe', 'dan'],
      joinedIds: ['me', 'ben', 'zoe'],
    },
    { id: 'book', name: 'Books', joinedIds: ['me', 'ben'] },
  ];
  const activity = new Map();
  const previews = [{ requestId: 'dan-request', text: 'Direct', time: 10 }];
  const list = () => conversationList('me', contacts, groups, previews, activity);
  const keys = (rows) => rows.map((r) => r.key);
  assert.deepEqual(keys(list()), ['contact:dan-contact', 'group:book', 'group:hike']);
  const zoe = memberKey('hike', 'zoe');
  activity.set(zoe, { latest: { id: 'p1', text: 'Meet at noon', time: 20, fromId: 'me' } });
  assert.deepEqual(keys(list()), ['group:hike', 'contact:dan-contact', 'group:book']);
  assert.deepEqual(keys(list()[0].members), [zoe, memberKey('hike', 'ben')]);
  assert.equal(list()[0].preview, undefined);
  assert.deepEqual(keys(visibleConversations(list(), undefined, 'zoe')), ['group:hike', zoe]);
  const reading = selectConversation(list()[0].members[0]);
  previews.push({ requestId: 'zoe-request', text: 'Another thread', time: 30 });
  assert.deepEqual(resolveConversation(list(), reading).target, {
    groupId: 'hike',
    memberId: 'zoe',
  });
  assert.deepEqual(resolveConversation(list(), selectConversation(list()[0].members[0])).target, {
    peerId: 'zoe',
    requestId: 'zoe-request',
  });
  assert.equal(
    resolveConversation(list(), { key: 'contact:ben-contact', groupId: 'book' }).groupId,
    'book',
  );
  activity.set('group:book', { latest: { id: 'g1', text: 'Hello everyone', time: 40 } });
  assert.equal(list()[0].key, 'group:book');
  assert.equal(list()[0].preview.text, 'Hello everyone');
  previews[0] = { ...previews[0], time: 50 };
  assert.equal(list()[0].key, 'contact:dan-contact');
  groups[0].joinedIds = ['me', 'ben'];
  assert.deepEqual(resolveConversation(list(), { key: 'contact:zoe-contact' }).target, {
    peerId: 'zoe',
    requestId: 'zoe-request',
  });
  assert.equal(resolveConversation(list(), reading), undefined);
});

test('chat activity listens once per joined thread, releases former members and rejects stale callbacks', () => {
  const {
    GroupChatActivityViewModel,
  } = require('../.test-build/features/chat/viewmodels/GroupChatActivityViewModel');
  const { memberKey } = require('../.test-build/features/chat/models/conversations');
  const listeners = [];
  const listen = (peer, next, fail) => {
    const entry = { peer, next, fail, stopped: false };
    listeners.push(entry);
    return () => {
      entry.stopped = true;
    };
  };
  const model = new GroupChatActivityViewModel(
    {
      members: (_uid, group, next, fail) => listen({ group }, next, fail),
      messages: (uid, peer, limit, next, fail) => {
        assert.equal(uid, 'me');
        assert.equal(limit, 1);
        return listen(peer, next, fail);
      },
    },
    'me',
  );
  const group = { id: 'hike', joinedIds: ['me', 'zoe'] };
  model.sync([group, { id: 'other', joinedIds: ['zoe'] }]);
  model.sync([group]);
  assert.equal(listeners.length, 3);
  const member = listeners.find((l) => l.peer.memberId === 'zoe');
  const key = memberKey('hike', 'zoe');
  member.next([{ id: 'm1', text: 'Hi', time: 42 }]);
  assert.equal(model.getSnapshot().entries.get(key).latest.time, 42);
  member.fail();
  model.sync([group], true);
  assert.equal(listeners.length, 4);
  assert.equal(member.stopped, true);
  listeners[3].next([{ id: 'm2', time: 43 }]);
  model.sync([{ ...group, joinedIds: ['me'] }]);
  assert.equal(listeners[3].stopped, true);
  member.next([{ id: 'late', time: 100 }]);
  assert.equal(model.getSnapshot().entries.has(key), false);
  model.stop();
  assert.ok(listeners.every((l) => l.stopped));
});

test('help opens the relevant topic for the screen and selected Contacts tab', () => {
  assert.equal(screenHelp('/contacts', 'groups'), 'Private groups');
  assert.equal(screenHelp('/contacts'), 'Contacts and requests');
  assert.equal(screenHelp('/contact/bob'), 'Edit contact');
  assert.equal(screenHelp('/chat/bob'), 'Chats');
  assert.equal(screenHelp('/profile'), 'Settings');
});

test('the contact editor paints cached details, streams profile changes and ignores events after disposal', () => {
  let emit,
    finish,
    reads = 0,
    stops = 0;
  const row = { id: 'bob', peerId: 'bob', requestId: 'invite', name: 'Bobby' };
  const editor = new ContactEditorViewModel(
    {
      observe() {
        assert.fail('editor subscribed to the repository again');
      },
      observeDetails(_uid, _row, next) {
        reads++;
        finish = next;
        return () => {
          stops++;
        };
      },
    },
    'alice',
    'bob',
    (_uid, listener) => {
      emit = listener;
      listener([row]);
      return () => {};
    },
  );
  editor.start();
  assert.equal(editor.getSnapshot().loading, false);
  assert.equal(editor.getSnapshot().nickname, 'Bobby');
  editor.setNickname('B');
  emit([row]);
  finish({ ...row, profileLocation: 'Orlando' });
  assert.equal(editor.getSnapshot().contact.profileLocation, 'Orlando');
  finish({ ...row, profileLocation: 'Boston' });
  emit([{ ...row, name: 'Robert' }]);
  assert.equal(editor.getSnapshot().nickname, 'B');
  assert.equal(editor.getSnapshot().contact.profileLocation, 'Boston');
  assert.equal(reads, 1);
  editor.dispose();
  finish({ ...row, profileLocation: 'Late' });
  assert.equal(editor.getSnapshot().contact.profileLocation, 'Boston');
  assert.equal(stops, 1);
});
