const { test } = require('node:test');
const assert = require('node:assert/strict');
const { selectSnapshot } = require('../.test-build/shared/mvvm/selectSnapshot');
const { shallowEqual } = require('../.test-build/shared/mvvm/shallowEqual');
const {
  ContactsViewModel,
} = require('../.test-build/features/contacts/viewmodels/ContactsViewModel');
const {
  selectContactDirectory,
  selectContactList,
  selectContactOverlays,
} = require('../.test-build/features/contacts/viewmodels/contactSelectors');
const {
  createConversationProjection,
} = require('../.test-build/features/chat/models/conversationProjection');
const {
  selectConversation,
  memberKey,
} = require('../.test-build/features/chat/models/conversations');

test('500 location updates leave contact, chat and overlay snapshots stable; relevant changes arrive immediately', () => {
  let state = new ContactsViewModel({}, 'me').getSnapshot();
  const snapshots = [selectContactDirectory, selectContactList, selectContactOverlays].map(
    (select) => selectSnapshot(() => state, select, shallowEqual),
  );
  const initial = snapshots.map((read) => read());
  for (let index = 0; index < 500; index++) {
    state = {
      ...state,
      nearby: [{ id: 'person', latitude: index / 10000 }],
      focus: { revision: index },
    };
    snapshots.forEach((read, index) => assert.equal(read(), initial[index]));
  }
  state = { ...state, email: 'someone@example.com', formOpen: true };
  assert.equal(snapshots[0](), initial[0]);
  assert.equal(snapshots[1](), initial[1]);
  assert.equal(snapshots[2]().formOpen, true);
  state = { ...state, contacts: [{ id: 'person', name: 'New name' }] };
  snapshots.forEach((read) => assert.equal(read().contacts[0].name, 'New name'));
  state = { ...state, loadError: 'offline' };
  snapshots.forEach((read) => assert.equal(read().loadError, 'offline'));
  state = { ...state, events: [{ id: 'accepted' }], actionId: 'locate:person' };
  assert.equal(snapshots[1]().events[0].id, 'accepted');
  assert.equal(snapshots[1]().actionId, 'locate:person');
});

test('one new message reorders a 500-chat list while retaining the other 499 row identities', () => {
  const project = createConversationProjection();
  const contacts = Array.from({ length: 500 }, (_, i) => ({
    id: String(i),
    peerId: 'u' + i,
    requestId: 'r' + i,
    name: 'User ' + i,
  }));
  const first = project('me', contacts, [], []);
  assert.equal(
    project(
      'me',
      contacts.map((c) => ({ ...c })),
      [],
      [],
    ),
    first,
  );
  const next = project(
    'me',
    contacts,
    [],
    [{ peerId: 'u250', requestId: 'r250', time: 1000, text: 'Hello' }],
    new Map(),
    new Map([['direct:r250', 1]]),
  );
  assert.equal(next[0].key, 'contact:250');
  assert.equal(next[0].unread, 1);
  const previousByKey = new Map(first.map((row) => [row.key, row]));
  assert.equal(next.filter((row) => row !== previousByKey.get(row.key)).length, 1);
});

test('projection refreshes avatars, edits, membership and private-chat targets without stale selection', () => {
  const project = createConversationProjection();
  const contact = {
    id: 'bob',
    peerId: 'bob',
    requestId: 'r1',
    name: 'Bob',
    avatarUrl: 'https://example.com/old.png',
  };
  const group = { id: 'friends', name: 'Friends', joinedIds: ['me', 'bob', 'amy'] };
  const key = memberKey('friends', 'bob');
  const activity = new Map([[key, { latest: { id: 'm', time: 10, text: 'Group private' } }]]);
  const first = project('me', [contact], [group], [], activity);
  const second = project(
    'me',
    [{ ...contact, name: 'Bobby', avatarUrl: 'https://example.com/new.png' }],
    [group],
    [],
    activity,
  );
  const bob = second[0].members.find((m) => m.name === 'Bobby');
  assert.equal(bob.avatarUrl, 'https://example.com/new.png');
  assert.equal(
    second[0].members.find((m) => m.target.memberId === 'amy'),
    first[0].members.find((m) => m.target.memberId === 'amy'),
  );
  const direct = [{ peerId: 'bob', requestId: 'r1', text: 'Direct', time: 20 }];
  const third = project('me', [contact], [group], direct, activity);
  assert.equal(
    selectConversation(third[0].members.find((m) => m.target.memberId === 'bob')).key,
    'contact:bob',
  );
  const edited = project('me', [contact], [group], [{ ...direct[0], text: 'Edited' }], activity);
  assert.equal(edited[0].members[0].preview.text, 'Edited');
  const removed = project(
    'me',
    [contact],
    [{ ...group, joinedIds: ['me', 'amy'] }],
    direct,
    activity,
  );
  assert.equal(removed.find((r) => r.key === 'group:friends').members.length, 1);
  assert.ok(removed.some((r) => r.key === 'contact:bob'));
  const otherAccount = project('other', [contact], [], direct);
  assert.notEqual(
    otherAccount.find((r) => r.key === 'contact:bob'),
    removed.find((r) => r.key === 'contact:bob'),
  );
  assert.deepEqual(project('other', [], [], []), []);
});
