const test = require('node:test');
const assert = require('node:assert/strict');
const { messageEmoji } = require('../.test-build/features/chat/models/messageEmoji');
const {
  emojiInsertionCapacity,
  insertEmoji,
} = require('../.test-build/features/chat/models/messageDraft');

test('single emoji messages include skin tones, joined families, flags, and presentation variants', () => {
  for (const emoji of ['❤️', '❤', '👍🏽', '👨‍👩‍👧‍👦', '🇺🇸', '1️⃣', '🧑‍💻']) {
    assert.equal(messageEmoji(` ${emoji} `), emoji);
  }
});

test('ordinary text and multiple emojis keep normal message rendering', () => {
  for (const text of ['', ' ', '1', '#', 'Hi 😊', '😊😊', '👍 🥳', '\uD83D', 'a'.repeat(2000)]) {
    assert.equal(messageEmoji(text), undefined);
  }
});

test('picker capacity agrees with insertion at a stale caret inside a surrogate pair', () => {
  const draft = 'a'.repeat(1998) + '😀';
  for (const selection of [
    { start: 1999, end: 1999 },
    { start: 1999, end: 2000 },
    { start: 1998, end: 1999 },
  ]) {
    for (const emoji of ['❤', '😀', '👍🏽', '🧑‍💻']) {
      assert.equal(
        !!insertEmoji(draft, emoji, selection),
        emoji.length <= emojiInsertionCapacity(draft, selection),
      );
    }
  }
  assert.equal(insertEmoji(draft, '😁', { start: 1999, end: 2000 }).text, 'a'.repeat(1998) + '😁');
});

test('complex emoji insertion preserves selection and enforces message length', () => {
  const emoji = '👨‍👩‍👧‍👦';
  const draft = 'a'.repeat(2000);
  const selection = { start: 2000 - emoji.length, end: 2000 };
  const result = insertEmoji(draft, emoji, selection);
  assert.equal(result.text.length, 2000);
  assert(result.text.endsWith(emoji));
  assert.deepEqual(result.selection, { start: 2000, end: 2000 });
  assert.equal(insertEmoji(draft, emoji, { start: 2000, end: 2000 }), undefined);
});
