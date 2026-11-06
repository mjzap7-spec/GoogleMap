const { test } = require('node:test');
const assert = require('node:assert/strict');
const { personChats } = require('../.test-build/features/chat/models/personChats');
const { threadKey } = require('../.test-build/features/chat/models/chat');
const {
  insertEmoji,
  MAX_MESSAGE_LENGTH,
} = require('../.test-build/features/chat/models/messageDraft');

const contact = { id: 'contact-bob', peerId: 'bob', requestId: 'request' };
const family = { id: 'family', joinedIds: ['me', 'bob'] };
const friends = { id: 'friends', joinedIds: ['me', 'bob', 'alice'] };
const member = (groupId, memberId = 'bob') => threadKey({ groupId, memberId });

test('sender badges include private group messages and open a thread that contains unread messages', () => {
  const counts = new Map([
    ['direct:request', 2],
    [member('family'), 3],
    [member('friends'), 4],
    ['group:family', 7],
  ]);
  const links = () => personChats('me', [contact, contact], [family, friends, family], counts);
  assert.equal(
    links().get('bob').unread,
    9,
    'room messages and duplicate memberships do not inflate the sender badge',
  );
  assert.deepEqual(links().get('bob').target, { contactId: 'contact-bob' });
  counts.delete('direct:request');
  assert.equal(links().get('bob').unread, 7);
  assert.deepEqual(links().get('bob').target, { groupId: 'family', memberId: 'bob' });
  counts.delete(member('family'));
  assert.deepEqual(links().get('bob').target, { groupId: 'friends', memberId: 'bob' });
  counts.delete(member('friends'));
  assert.equal(links().get('bob').unread, 0);
  assert.deepEqual(links().get('bob').target, { contactId: 'contact-bob' });
});

test('map chat access follows accepted contacts and currently joined group members', () => {
  const counts = new Map([
    [member('family'), 5],
    [member('friends', 'alice'), 1],
  ]);
  const links = personChats('me', [], [family, friends], counts);
  assert.deepEqual(links.get('bob'), { unread: 5, target: { groupId: 'family', memberId: 'bob' } });
  assert.equal(links.get('alice').unread, 1);
  assert.equal(links.has('me'), false);
  assert.equal(links.has('stranger'), false);
  const left = personChats('me', [], [{ ...family, joinedIds: ['bob'] }], counts);
  assert.equal(left.size, 0, 'leaving a group removes its chat access and stale counts');
});

test('emoji insertion honors the caret, selection, repeated picks and stale offsets', () => {
  assert.deepEqual(insertEmoji('Hi there', '😊', { start: 3, end: 3 }), {
    text: 'Hi 😊there',
    selection: { start: 5, end: 5 },
  });
  const first = insertEmoji('Hi there', '👋', { start: 3, end: 8 });
  const second = insertEmoji(first.text, '❤️', first.selection);
  assert.equal(second.text, 'Hi 👋❤️');
  assert.equal(insertEmoji('', '🎉', { start: 99, end: 99 }).text, '🎉');
  assert.equal(insertEmoji('😀', '😊', { start: 1, end: 1 }).text, '😀😊');
  assert.equal(insertEmoji('😀!', '😊', { start: 1, end: 2 }).text, '😊!');
});

test('emoji insertion respects message length without truncating symbols or adjacent text', () => {
  assert.equal(
    insertEmoji('a'.repeat(MAX_MESSAGE_LENGTH - 1), '😀', { start: 1, end: 1 }),
    undefined,
  );
  const draft = 'a'.repeat(MAX_MESSAGE_LENGTH);
  const replacement = insertEmoji(draft, '😀', { start: 5, end: 7 });
  assert.equal(replacement.text.length, MAX_MESSAGE_LENGTH);
  assert.equal(replacement.text.slice(3, 9), 'aa😀aa');
});
