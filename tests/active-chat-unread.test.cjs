const { test } = require('node:test');
const assert = require('node:assert/strict');
const {
  UnreadChatsViewModel,
} = require('../.test-build/features/chat/viewmodels/UnreadChatsViewModel');
const { threadKey } = require('../.test-build/features/chat/models/chat');
const time = (seconds, nanoseconds = 0) => ({ seconds, nanoseconds });
const bob = { peerId: 'bob', requestId: 'alice_bob' };
const eve = { peerId: 'eve', requestId: 'alice_eve' };
const group = { groupId: 'friends', senderName: 'Alice' };
const member = { groupId: 'friends', memberId: 'bob' };
const flush = () => new Promise((resolve) => setImmediate(resolve));

function fixture() {
  let receipts;
  const watches = new Map(),
    writes = [];
  const model = new UnreadChatsViewModel(
    {
      receipts: (_uid, next) => {
        receipts = next;
        next(new Map());
        return () => {};
      },
      unread: (_uid, peer, after, next) => {
        const watch = { after, next, stopped: false };
        const key = threadKey(peer);
        watches.set(key, [...(watches.get(key) ?? []), watch]);
        return () => {
          watch.stopped = true;
        };
      },
      markRead: (_uid, peer, through) =>
        new Promise((resolve, reject) => writes.push({ peer, through, resolve, reject })),
    },
    'alice',
  );
  model.start();
  model.sync(
    [
      { id: 'bob', ...bob },
      { id: 'eve', ...eve },
    ],
    [{ id: 'friends', joinedIds: ['alice', 'bob'] }],
  );
  return {
    model,
    writes,
    receipts: (rows) => receipts(rows),
    watch: (peer) => watches.get(threadKey(peer)).at(-1),
    count: (peer) => model.getSnapshot().counts.get(threadKey(peer)) ?? 0,
  };
}

test('open conversations hide only their own badges before the transcript or receipts arrive', () => {
  for (const peer of [bob, group, member]) {
    const f = fixture();
    f.watch(peer).next(2);
    f.watch(eve).next(3);
    const close = f.model.view(peer);
    const totals = [];
    const stop = f.model.subscribe(() => totals.push(f.model.getSnapshot().total));
    f.watch(peer).next(4);
    f.watch(peer).next(5);
    assert.equal(f.count(peer), 0);
    assert.equal(f.count(eve), 3);
    assert.equal(f.model.getSnapshot().total, 3);
    assert.ok(
      totals.every((value) => value === 3),
      'No transient count for the open chat',
    );
    assert.equal(f.writes.length, 0, 'Opening alone cannot mark unseen messages read');
    close();
    assert.equal(f.count(peer), 5, 'Unseen messages return after leaving or backgrounding');
    f.watch(peer).next(6);
    assert.equal(f.model.getSnapshot().total, 9);
    stop();
    f.model.stop();
  }
});

test('visible messages clear immediately and never reappear while server receipts are delayed', async () => {
  const f = fixture();
  const close = f.model.view(bob);
  const old = f.watch(bob);
  old.next(2);
  f.model.markRead(bob, time(10, 5));
  assert.equal(old.stopped, true);
  assert.deepEqual(f.watch(bob).after, time(10, 5));
  close();
  assert.equal(f.count(bob), 0);
  old.next(2);
  f.receipts(new Map([[threadKey(bob), time(9)]]));
  assert.equal(f.count(bob), 0);
  assert.deepEqual(f.watch(bob).after, time(10, 5));
  f.model.markRead(bob, time(10, 5));
  assert.equal(f.writes.length, 1);
  f.writes[0].resolve();
  await flush();
  f.model.markRead(bob, time(10, 5));
  assert.equal(f.writes.length, 1, 'Duplicate visibility does not repeat a confirmed write');
  f.watch(bob).next(1);
  assert.equal(f.count(bob), 1, 'Newer messages still count after leaving');
  f.model.stop();
});

test('partial reads preserve newer unread messages and another device can advance the cursor', () => {
  const f = fixture();
  const close = f.model.view(bob);
  f.model.markRead(bob, time(10, 1));
  f.watch(bob).next(2);
  assert.equal(f.count(bob), 0);
  close();
  assert.equal(f.count(bob), 2);
  f.receipts(new Map([[threadKey(bob), time(10, 2)]]));
  assert.deepEqual(f.watch(bob).after, time(10, 2));
  f.watch(bob).next(1);
  assert.equal(f.count(bob), 1);
  f.model.stop();
});

test('failed receipt retry retains locally read messages and active-view registration', async () => {
  const f = fixture();
  const close = f.model.view(bob);
  f.model.markRead(bob, time(20));
  f.writes[0].reject(Error('offline'));
  await flush();
  assert.equal(f.model.getSnapshot().failed, true);
  f.model.retry();
  assert.equal(f.writes.length, 2);
  assert.deepEqual(f.watch(bob).after, time(20));
  f.watch(bob).next(1);
  assert.equal(f.count(bob), 0);
  f.writes[1].resolve();
  await flush();
  assert.equal(f.model.getSnapshot().failed, false);
  close();
  assert.equal(f.count(bob), 1);
  f.model.stop();
});

test('view cleanup is idempotent and cannot unhide another mounted viewer or a newer session', () => {
  const f = fixture();
  const old = f.model.view(bob),
    current = f.model.view(bob);
  f.watch(bob).next(3);
  old();
  old();
  assert.equal(f.count(bob), 0);
  current();
  assert.equal(f.count(bob), 3);
  const stale = f.model.view(bob);
  f.model.stop();
  f.model.start();
  const fresh = f.model.view(bob);
  f.watch(bob).next(4);
  stale();
  assert.equal(f.count(bob), 0);
  fresh();
  assert.equal(f.count(bob), 4);
  f.model.stop();
});

test('retry retains an in-flight receipt and ignores its older completion', async () => {
  const f = fixture();
  f.model.markRead(bob, time(20));
  f.model.retry();
  assert.equal(f.writes.length, 2);
  f.writes[0].resolve();
  await flush();
  f.writes[1].reject(Error('offline'));
  await flush();
  assert.equal(f.model.getSnapshot().failed, true);
  f.model.retry();
  assert.equal(f.writes.length, 3);
  assert.deepEqual(f.writes[2].through, time(20));
  f.writes[2].resolve();
  await flush();
  assert.equal(f.model.getSnapshot().failed, false);
  f.model.stop();
});

test('view registered before provider startup survives startup; removal clears counts and stale listeners', () => {
  const f = fixture();
  f.model.stop();
  const close = f.model.view(bob);
  f.model.start();
  const watch = f.watch(bob);
  watch.next(2);
  assert.equal(f.count(bob), 0);
  f.model.sync([], []);
  close();
  watch.next(3);
  assert.equal(f.model.getSnapshot().total, 0);
  f.model.stop();
});
