const { test } = require('node:test');
const assert = require('node:assert/strict');
const { messageStatus } = require('../.test-build/features/chat/models/messageStatus');
const { ChatViewModel } = require('../.test-build/features/chat/viewmodels/ChatViewModel');
const time = (seconds, nanoseconds = 0) => ({ seconds, nanoseconds });
const flush = () => new Promise((resolve) => setImmediate(resolve));

test('checks distinguish pending, sent and read using confirmed nanosecond timestamps', () => {
  const sent = { pending: false, createdAt: time(10, 2) };
  assert.equal(messageStatus({ ...sent, pending: true }, time(20)), 'sending');
  assert.equal(messageStatus({ pending: false }, time(20)), 'sent');
  assert.equal(messageStatus(sent), 'sent');
  assert.equal(messageStatus(sent, time(10, 1)), 'sent');
  assert.equal(messageStatus(sent, time(10, 2)), 'read');
  assert.equal(messageStatus(sent, time(11)), 'read');
});

function fixture() {
  const reads = [],
    writes = [],
    transcripts = [];
  const repo = {
    messages: (_uid, _peer, _count, next) => {
      const watch = { next, stopped: false };
      transcripts.push(watch);
      return () => {
        watch.stopped = true;
      };
    },
    readByOthers: (_uid, _peer, next, fail) => {
      const watch = { next, fail, stopped: false };
      reads.push(watch);
      return () => {
        watch.stopped = true;
      };
    },
    shareRead: (_uid, _peer, through) =>
      new Promise((resolve, reject) => writes.push({ through, resolve, reject })),
  };
  const model = new ChatViewModel(repo, 'alice', { peerId: 'bob', requestId: 'alice_bob' });
  return { model, reads, writes, transcripts };
}

test('live receipts advance checks without regressing or changing the transcript; stale listeners stop', () => {
  const { model, reads, transcripts } = fixture();
  model.start();
  transcripts[0].next([{ id: 'message', text: 'Hello', pending: false }]);
  reads[0].next(time(10, 5));
  reads[0].next(time(10, 4));
  assert.deepEqual(model.getSnapshot().readThrough, time(10, 5));
  reads[0].fail();
  assert.equal(model.getSnapshot().messages.length, 1);
  assert.ok(model.getSnapshot().receiptError);
  model.stop();
  reads[0].next(time(40));
  assert.equal(reads[0].stopped, true);
  assert.equal(transcripts[0].stopped, true);
  assert.deepEqual(model.getSnapshot().readThrough, time(10, 5));
});

test('visible receipts coalesce while saving, skip duplicate writes and cannot continue after leaving', async () => {
  const { model, writes } = fixture();
  model.start();
  model.markVisibleRead(time(10));
  model.markVisibleRead(time(10));
  model.markVisibleRead(time(11));
  model.markVisibleRead(time(12));
  assert.equal(writes.length, 1);
  writes[0].resolve();
  await flush();
  assert.equal(writes.length, 2);
  assert.deepEqual(writes[1].through, time(12));
  writes[1].resolve();
  await flush();
  model.markVisibleRead(time(12));
  assert.equal(writes.length, 2);
  model.markVisibleRead(time(13));
  model.markVisibleRead(time(14));
  model.stop();
  writes[2].resolve();
  await flush();
  model.markVisibleRead(time(15));
  assert.equal(writes.length, 3);
});

test('reopening a previously read chat republishes shared evidence and failed writes can retry', async () => {
  const { model, writes } = fixture();
  model.start();
  model.markVisibleRead(time(10));
  writes[0].reject(Error('offline'));
  await flush();
  assert.ok(model.getSnapshot().receiptError);
  model.start();
  assert.equal(model.getSnapshot().receiptError, '');
  model.markVisibleRead(time(10));
  assert.equal(writes.length, 2);
  writes[1].resolve();
  await flush();
  model.stop();
});
