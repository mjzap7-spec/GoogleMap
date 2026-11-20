const { test } = require('node:test');
const assert = require('node:assert/strict');
const { UnreadAttention } = require('../.test-build/features/chat/models/UnreadAttention');
const id = 'abcdefghijklmnopqrst';
const call = { id: 'call_' + id, text: 'Video interview invitation' };
function fixture() {
  const watches = [],
    counts = [];
  const model = new UnreadAttention(
    'bob',
    (id, next) => {
      const value = { id, next, stopped: false };
      watches.push(value);
      return () => {
        value.stopped = true;
      };
    },
    (n) => counts.push(n),
  );
  return { model, watches, counts };
}
test('only incoming unattended calls contribute; declined, missing and outgoing calls do not', () => {
  const f = fixture();
  f.model.sync([call]);
  const emit = f.watches[0].next;
  for (const value of [
    undefined,
    { toId: 'alice', status: 'ended' },
    { toId: 'bob', status: 'declined' },
    { toId: 'bob', status: 'accepted' },
  ]) {
    emit(value);
    assert.equal(f.counts.at(-1), 0);
  }
  emit({ toId: 'bob', status: 'busy' });
  assert.equal(f.counts.at(-1), 1);
  emit({ toId: 'bob', status: 'ended' });
  assert.equal(f.counts.at(-1), 1);
  emit({ toId: 'bob', status: 'ended', answer: {} });
  assert.equal(f.counts.at(-1), 0);
  f.model.stop();
});
test('snapshot refreshes reuse call listeners and removed or stopped callbacks cannot restore badges', () => {
  const f = fixture();
  f.model.sync([call]);
  f.model.sync([call]);
  assert.equal(f.watches.length, 1);
  f.model.sync([]);
  f.watches[0].next({ toId: 'bob', status: 'ended' });
  assert.equal(f.counts.at(-1), 0);
  assert.equal(f.watches[0].stopped, true);
  f.model.sync([call]);
  f.model.stop();
  f.watches[1].next({ toId: 'bob', status: 'ended' });
  assert.equal(f.counts.at(-1), 0);
  assert.equal(f.watches[1].stopped, true);
});
test('ordinary unread files and messages count once, cap at 99+, and malformed call IDs never open listeners', () => {
  const f = fixture();
  f.model.sync([
    { id: 'call_bad', text: call.text },
    { id: 'file', text: '[[direct-file:v1]]' + id },
  ]);
  assert.equal(f.counts.at(-1), 2);
  assert.equal(f.watches.length, 0);
  f.model.sync(Array.from({ length: 120 }, (_, index) => ({ id: String(index), text: 'hello' })));
  assert.equal(f.counts.at(-1), 100);
  f.model.stop();
});
