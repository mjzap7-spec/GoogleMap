const { test } = require('node:test');
const assert = require('node:assert/strict');
const { StoredChatHistory } = require('../.test-build/features/chat/data/StoredChatHistory');
const { DeviceChatRepository } = require('../.test-build/features/chat/data/DeviceChatRepository');
const { ChatViewModel } = require('../.test-build/features/chat/viewmodels/ChatViewModel');
const { historyFilter } = require('../.test-build/features/chat/models/localChatHistory');
const tick = () => new Promise((done) => setImmediate(done));
function storage() {
  const values = new Map();
  return {
    values,
    getItem: async (key) => values.get(key) ?? null,
    setItem: async (key, value) => {
      values.set(key, value);
    },
  };
}
function snapshot(repo, uid) {
  return new Promise((resolve, reject) => {
    const stop = repo.observe(
      uid,
      (value) => {
        stop();
        resolve(value);
      },
      reject,
    );
  });
}
test('device history persists per account and conversation without storing message bodies', async () => {
  const disk = storage();
  const history = new StoredChatHistory(disk);
  await history.hide('alice', 'group:g', ['m1', 'm2', 'm1']);
  const reopened = new StoredChatHistory(disk);
  assert.deepEqual((await snapshot(reopened, 'alice'))['group:g'].hiddenIds, ['m1', 'm2']);
  assert.deepEqual(await snapshot(reopened, 'bob'), {});
  assert.deepEqual(await snapshot(new StoredChatHistory(storage()), 'alice'), {});
  assert.equal(disk.values.size, 1);
});
test('concurrent local deletes and clears merge; cutoff uses precise message time, never wall clock', async () => {
  const history = new StoredChatHistory(storage());
  await Promise.all([
    history.hide('a', 'g', ['one']),
    history.hide('a', 'g', ['two']),
    history.clear('a', 'g', { seconds: 2, nanoseconds: 50 }, ['pending']),
    history.clear('a', 'g', { seconds: 1, nanoseconds: 0 }, []),
  ]);
  const state = (await snapshot(history, 'a')).g;
  const hidden = historyFilter(state);
  assert.deepEqual(state.hiddenIds, ['one', 'two', 'pending']);
  assert.equal(hidden({ id: 'old-unloaded', createdAt: { seconds: 2, nanoseconds: 49 } }), true);
  assert.equal(hidden({ id: 'equal', createdAt: { seconds: 2, nanoseconds: 50 } }), true);
  assert.equal(hidden({ id: 'new', createdAt: { seconds: 2, nanoseconds: 51 } }), false);
  assert.equal(hidden({ id: 'pending' }), true);
  assert.equal(hidden({ id: 'new-pending' }), false);
});
test('storage failures keep history unchanged, surface errors, and allow retry', async () => {
  const disk = storage();
  const history = new StoredChatHistory(disk);
  await history.hide('a', 'g', ['one']);
  const save = disk.setItem;
  disk.setItem = async () => {
    throw Error('full');
  };
  await assert.rejects(history.hide('a', 'g', ['two']), /full/);
  assert.deepEqual((await snapshot(history, 'a')).g.hiddenIds, ['one']);
  disk.setItem = save;
  await history.hide('a', 'g', ['two']);
  assert.deepEqual((await snapshot(history, 'a')).g.hiddenIds, ['one', 'two']);
});
test('a failed local read never briefly exposes deleted remote messages; unrelated changes do not restart a chat', async () => {
  const disk = storage();
  let resolve;
  disk.getItem = () =>
    new Promise((done) => {
      resolve = done;
    });
  const history = new StoredChatHistory(disk);
  const queries = [];
  const remote = {
    messages: (...args) => {
      queries.push(args);
      return () => {};
    },
  };
  const repo = new DeviceChatRepository(remote, history);
  const results = [];
  const stop = repo.messages(
    'a',
    { groupId: 'g', senderName: 'A' },
    10,
    (rows) => results.push(rows),
    () => {},
  );
  assert.equal(queries.length, 0);
  resolve(JSON.stringify([['group:g', { hiddenIds: ['one'] }]]));
  await tick();
  assert.deepEqual(queries[0][5].hiddenIds, ['one']);
  await history.hide('a', 'group:other', ['two']);
  assert.equal(queries.length, 1);
  await history.hide('a', 'group:g', ['three']);
  queries[0][3](['stale']);
  assert.deepEqual(results, []);
  queries[1][3](['current']);
  assert.deepEqual(results, [['current']]);
  stop();
  queries[1][3](['late']);
  assert.equal(results.length, 1);
});
test('local history read errors block transcript subscription instead of revealing hidden history', async () => {
  const history = new StoredChatHistory({
    getItem: async () => {
      throw Error('disk');
    },
  });
  let queried = false;
  let failed = false;
  const repo = new DeviceChatRepository(
    {
      messages: () => {
        queried = true;
      },
    },
    history,
  );
  const stop = repo.messages(
    'a',
    { groupId: 'g', senderName: 'A' },
    10,
    () => {},
    () => {
      failed = true;
    },
  );
  await tick();
  stop();
  assert.equal(queried, false);
  assert.equal(failed, true);
});
test('multi-delete and clear make zero remote mutations and preserve arrivals during confirmation', async () => {
  const history = new StoredChatHistory(storage());
  let emit;
  const writes = [];
  const repo = {
    messages: (_u, _p, _c, next) => {
      emit = next;
      return () => {};
    },
    readByOthers: () => () => {},
    messageIds: (_u, _p, next) => {
      next(['newest', 'own', 'other']);
      return () => {};
    },
    remove: (...args) => writes.push(args),
    send: (...args) => writes.push(args),
    edit: (...args) => writes.push(args),
    markRead: (...args) => writes.push(args),
    shareRead: (...args) => writes.push(args),
  };
  const vm = new ChatViewModel(repo, 'alice', { groupId: 'g', senderName: 'A' }, history);
  vm.start();
  const row = (id, seconds, fromId = 'bob') => ({
    id,
    fromId,
    text: id,
    time: seconds * 1000,
    createdAt: { seconds, nanoseconds: 0 },
    pending: false,
  });
  emit([row('newest', 3), row('own', 2, 'alice'), row('other', 1)]);
  vm.beginSelection('other');
  vm.toggleSelection('own');
  assert.deepEqual(vm.getSnapshot().selectedIds, ['other', 'own']);
  vm.toggleSelection('own');
  vm.selectAll();
  assert.equal(vm.getSnapshot().selectedIds.length, 3);
  await vm.deleteLocal(['other', 'own']);
  assert.deepEqual(
    vm.getSnapshot().messages.map((m) => m.id),
    ['newest'],
  );
  assert.equal(vm.getSnapshot().selecting, false);
  const target = vm.prepareClear();
  emit([row('arrived-while-confirming', 4), row('newest', 3)]);
  await vm.clearLocal(target);
  assert.deepEqual(
    vm.getSnapshot().messages.map((m) => m.id),
    ['arrived-while-confirming'],
  );
  assert.deepEqual(writes, []);
  vm.stop();
});
test('local delete failure retains selected messages and the draft for retry', async () => {
  let emit;
  const vm = new ChatViewModel(
    {
      messages: (_u, _p, _c, next) => {
        emit = next;
        return () => {};
      },
      readByOthers: () => () => {},
    },
    'alice',
    { groupId: 'g', senderName: 'A' },
    {
      hide: async () => {
        throw Error('disk full');
      },
    },
  );
  vm.start();
  emit([{ id: 'a', fromId: 'bob', text: 'Hello', time: 1, pending: false }]);
  vm.setDraft('Keep my draft');
  vm.beginSelection('a');
  assert.equal(await vm.deleteLocal(['a']), false);
  assert.equal(vm.getSnapshot().messages.length, 1);
  assert.deepEqual(vm.getSnapshot().selectedIds, ['a']);
  assert.equal(vm.getSnapshot().draft, 'Keep my draft');
  assert.match(vm.getSnapshot().actionError, /this device/);
  vm.stop();
});
