const test = require('node:test');
const assert = require('node:assert/strict');
const { continuesMessageRun } = require('../.test-build/features/chat/models/messageLayout');
const message = (fromId, time) => ({
  id: String(time),
  fromId,
  time,
  text: 'Hello',
  pending: false,
});

test('message runs separate senders and gaps longer than five minutes', () => {
  const first = message('alice', new Date(2026, 10, 6, 12).getTime());
  assert.equal(continuesMessageRun(undefined, first), false);
  assert.equal(continuesMessageRun(first, message('alice', first.time + 300_000)), true);
  assert.equal(continuesMessageRun(first, message('alice', first.time + 300_001)), false);
  assert.equal(continuesMessageRun(first, message('bob', first.time + 1000)), false);
  assert.equal(continuesMessageRun(first, message('alice', first.time - 1)), false);
});

test('message runs keep the date separator visible across local midnight', () => {
  const before = message('alice', new Date(2026, 10, 6, 23, 59).getTime());
  const after = message('alice', new Date(2026, 10, 7, 0, 1).getTime());
  assert.equal(continuesMessageRun(before, after), false);
});
