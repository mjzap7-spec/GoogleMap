const { test } = require('node:test');
const assert = require('node:assert/strict');
const { ChatViewModel } = require('../.test-build/features/chat/viewmodels/ChatViewModel');
function fixture() {
  let emit;
  const calls = [];
  const repo = {
    messages: (_u, _p, _n, next) => {
      emit = next;
      return () => {};
    },
    readByOthers: () => () => {},
    send: async (...args) => calls.push(['send', ...args]),
    edit: async (...args) => calls.push(['edit', ...args]),
    remove: async (...args) => calls.push(['remove', ...args]),
  };
  const vm = new ChatViewModel(repo, 'alice', { groupId: 'g', senderName: 'Alice' });
  vm.start();
  const rows = [
    { id: 'own', fromId: 'alice', text: 'Original', time: 1, pending: false },
    { id: 'other', fromId: 'bob', text: 'Hello', time: 2, pending: false },
    { id: 'pending', fromId: 'alice', text: 'Sending', time: 3, pending: true },
  ];
  emit(rows);
  return { vm, repo, calls, emit, rows };
}
test('reply sends a reference and keeps the draft when cancelled', async () => {
  const { vm, calls } = fixture();
  vm.setDraft('My draft');
  vm.reply('other');
  vm.cancelAction();
  assert.equal(vm.getSnapshot().draft, 'My draft');
  vm.reply('other');
  await vm.send();
  assert.deepEqual(calls[0].slice(-2), ['My draft', 'other']);
  assert.equal(vm.getSnapshot().draft, '');
  assert.equal(vm.getSnapshot().replying, undefined);
});
test('sending clears the composer immediately and restores the draft and reply on failure', async () => {
  const { vm, repo } = fixture();
  let reject;
  repo.send = () =>
    new Promise((_, fail) => {
      reject = fail;
    });
  vm.setDraft('Keep this reply');
  vm.reply('other');
  const sending = vm.send();
  assert.equal(vm.getSnapshot().draft, '');
  assert.equal(vm.getSnapshot().sending, true);
  reject(Error('offline'));
  await sending;
  assert.equal(vm.getSnapshot().draft, 'Keep this reply');
  assert.equal(vm.getSnapshot().replying.id, 'other');
  assert.equal(vm.getSnapshot().sending, false);
});

test('editing preserves an unsent draft and restores it on cancel or save', async () => {
  const { vm, calls } = fixture();
  vm.setDraft('Unsent draft');
  vm.edit('own');
  assert.equal(vm.getSnapshot().draft, 'Original');
  vm.setDraft('Change');
  vm.cancelAction();
  assert.equal(vm.getSnapshot().draft, 'Unsent draft');
  vm.edit('own');
  vm.setDraft('Updated');
  await vm.send();
  assert.equal(calls[0][0], 'edit');
  assert.deepEqual(calls[0].slice(-2), ['own', 'Updated']);
  assert.equal(vm.getSnapshot().draft, 'Unsent draft');
  assert.equal(vm.getSnapshot().editing, undefined);
});
test('pending and other-authored messages cannot be edited or deleted', async () => {
  const { vm, calls } = fixture();
  for (const id of ['other', 'pending', 'missing']) {
    vm.edit(id);
    await vm.remove(id);
  }
  vm.reply('pending');
  assert.equal(vm.getSnapshot().editing, undefined);
  assert.equal(vm.getSnapshot().replying, undefined);
  assert.deepEqual(calls, []);
});
test('failed edits retain the draft, cancel target and visible error despite incoming snapshots', async () => {
  const { vm, repo, emit, rows } = fixture();
  repo.edit = async () => {
    throw Error('offline');
  };
  vm.edit('own');
  vm.setDraft('Retry this');
  await vm.send();
  emit([...rows]);
  assert.equal(vm.getSnapshot().draft, 'Retry this');
  assert.equal(vm.getSnapshot().editing.id, 'own');
  assert.ok(vm.getSnapshot().actionError.includes('edited'));
  assert.equal(vm.getSnapshot().sending, false);
});
test('duplicate saves are ignored and a confirmed deletion cancels its active reply', async () => {
  const { vm, repo, calls } = fixture();
  let resolve;
  repo.edit = () =>
    new Promise((done) => {
      resolve = done;
      calls.push('editing');
    });
  vm.edit('own');
  vm.setDraft('Edited');
  const saving = vm.send();
  vm.setDraft('late');
  vm.cancelAction();
  await vm.send();
  assert.equal(vm.getSnapshot().draft, 'Edited');
  assert.deepEqual(calls, ['editing']);
  resolve();
  await saving;
  vm.reply('own');
  await vm.remove('own');
  assert.equal(vm.getSnapshot().replying, undefined);
  assert.equal(vm.getSnapshot().deletingId, undefined);
});

test('selection hands off to reply or edit while preserving the unsent draft', () => {
  const { vm } = fixture();
  vm.setDraft('Keep this');
  vm.beginSelection('other');
  assert.deepEqual(vm.getSnapshot().selectedIds, ['other']);
  vm.reply('other');
  assert.equal(vm.getSnapshot().selecting, false);
  assert.equal(vm.getSnapshot().replying.id, 'other');
  assert.equal(vm.getSnapshot().draft, 'Keep this');
  vm.beginSelection('own');
  vm.edit('own');
  assert.equal(vm.getSnapshot().selecting, false);
  assert.equal(vm.getSnapshot().draft, 'Original');
  vm.cancelAction();
  assert.equal(vm.getSnapshot().draft, 'Keep this');
  vm.stop();
});

test('select all includes unloaded history, retains it across snapshots and excludes later arrivals', () => {
  const { vm, repo, emit } = fixture();
  const rows = Array.from({ length: 120 }, (_, i) => ({
    id: 'm' + i,
    fromId: 'bob',
    text: 'Message',
    time: 200 - i,
    pending: false,
  }));
  let complete;
  let stopped = 0;
  repo.messageIds = (_u, _p, next) => {
    complete = next;
    return () => stopped++;
  };
  emit(rows.slice(0, 51));
  vm.beginSelection('m0');
  vm.selectAll();
  assert.equal(vm.getSnapshot().selectingAll, true);
  complete(rows.map((m) => m.id));
  assert.equal(stopped, 1);
  assert.equal(vm.getSnapshot().selectedIds.length, 120);
  emit(rows.slice(0, 51));
  assert.equal(vm.getSnapshot().selectedIds.length, 120);
  const arrival = { ...rows[0], id: 'later', time: 201 };
  emit([arrival, ...rows.slice(0, 50)]);
  assert.equal(vm.getSnapshot().selectedIds.length, 120);
  assert.equal(vm.getSnapshot().selectedIds.includes('later'), false);
  assert.equal(vm.getSnapshot().allSelected, false);
  vm.toggleSelection('m2');
  assert.equal(vm.getSnapshot().selectedIds.length, 119);
  // Remove a selected loaded message remotely; retain unloaded IDs.
  emit([arrival, ...rows.slice(0, 51).filter((m) => m.id !== 'm1')]);
  assert.equal(vm.getSnapshot().selectedIds.length, 118);
  vm.stop();
});

test('select-all cancellation, stop and failure retain safe selection state and ignore late callbacks', () => {
  const { vm, repo, emit } = fixture();
  const rows = Array.from({ length: 51 }, (_, i) => ({
    id: 'm' + i,
    text: 'Message',
    time: 100 - i,
    pending: false,
  }));
  let complete, fail;
  let stops = 0;
  repo.messageIds = (_u, _p, next, error) => {
    complete = next;
    fail = error;
    return () => stops++;
  };
  emit(rows);
  vm.beginSelection('m0');
  vm.selectAll();
  fail();
  assert.deepEqual(vm.getSnapshot().selectedIds, ['m0']);
  assert.equal(vm.getSnapshot().selectingAll, false);
  assert.match(vm.getSnapshot().actionError, /select all/);
  vm.selectAll();
  vm.cancelSelection();
  complete(['late']);
  assert.deepEqual(vm.getSnapshot().selectedIds, []);
  assert.equal(vm.getSnapshot().selecting, false);
  vm.beginSelection('m0');
  vm.selectAll();
  vm.stop();
  complete(['late']);
  assert.deepEqual(vm.getSnapshot().selectedIds, ['m0']);
  assert.equal(vm.getSnapshot().selectingAll, false);
  assert.equal(stops, 3);
});

test('select all verifies even a short cached chat and disposes synchronous subscriptions', () => {
  const { vm, repo, rows } = fixture();
  let stopped = false;
  repo.messageIds = (_u, _p, next) => {
    next([...rows.map((m) => m.id), 'not-cached']);
    return () => {
      stopped = true;
    };
  };
  vm.beginSelection('own');
  vm.selectAll();
  assert.equal(vm.getSnapshot().selectedIds.length, 4);
  assert.equal(stopped, true);
  assert.equal(vm.getSnapshot().allSelected, true);
  vm.toggleSelection('other');
  assert.equal(vm.getSnapshot().selectedIds.length, 3);
  assert.equal(vm.getSnapshot().allSelected, false);
  vm.stop();
});

test('checked message and header checkboxes toggle off without removing messages or losing the draft', () => {
  const { vm, repo, rows, calls } = fixture();
  let queries = 0;
  repo.messageIds = (_u, _p, next) => {
    queries++;
    next(rows.map((m) => m.id));
    return () => {};
  };
  vm.setDraft('Keep my draft');
  vm.beginSelection('own');
  vm.toggleSelection('own');
  assert.deepEqual(vm.getSnapshot().selectedIds, []);
  assert.equal(vm.getSnapshot().selecting, false);
  vm.beginSelection('own');
  assert.deepEqual(vm.getSnapshot().selectedIds, ['own']);
  vm.selectAll();
  assert.equal(vm.getSnapshot().allSelected, true);
  vm.selectAll();
  assert.deepEqual(vm.getSnapshot().selectedIds, []);
  assert.equal(vm.getSnapshot().allSelected, false);
  assert.equal(queries, 1, 'deselecting requires no network query');
  assert.equal(vm.getSnapshot().selecting, false);
  vm.beginSelection('own');
  vm.selectAll();
  assert.equal(vm.getSnapshot().selectedIds.length, rows.length);
  assert.equal(queries, 2);
  assert.equal(vm.getSnapshot().draft, 'Keep my draft');
  assert.equal(vm.getSnapshot().messages.length, rows.length);
  assert.deepEqual(calls, []);
  vm.stop();
});

test('repeated header tap or manual deselection cancels pending select-all and ignores its late result', () => {
  const { vm, repo } = fixture();
  let complete;
  let stopped = 0;
  repo.messageIds = (_u, _p, next) => {
    complete = next;
    return () => stopped++;
  };
  vm.beginSelection('own');
  vm.selectAll();
  vm.selectAll();
  complete(['own', 'other']);
  assert.deepEqual(vm.getSnapshot().selectedIds, []);
  assert.equal(vm.getSnapshot().selectingAll, false);
  assert.equal(vm.getSnapshot().selecting, false);
  vm.beginSelection('own');
  vm.selectAll();
  vm.toggleSelection('own');
  complete(['own', 'other']);
  assert.deepEqual(vm.getSnapshot().selectedIds, []);
  assert.equal(vm.getSnapshot().selectingAll, false);
  assert.equal(vm.getSnapshot().selecting, false);
  assert.equal(stopped, 2);
  vm.stop();
});

test('selection cannot remain open after its last message disappears or select all returns empty', () => {
  const { vm, repo, emit, rows } = fixture();
  vm.setDraft('Draft survives');
  vm.beginSelection('own');
  vm.toggleSelection('other');
  vm.toggleSelection('own');
  assert.equal(vm.getSnapshot().selecting, true, 'one selection remains');
  emit(rows.filter((m) => m.id !== 'other'));
  assert.equal(vm.getSnapshot().selecting, false);
  assert.deepEqual(vm.getSnapshot().selectedIds, []);
  vm.beginSelection('own');
  repo.messageIds = (_u, _p, next) => {
    next([]);
    return () => {};
  };
  vm.selectAll();
  assert.equal(vm.getSnapshot().selecting, false);
  assert.equal(vm.getSnapshot().allSelected, false);
  emit([]);
  vm.beginSelection();
  assert.equal(vm.getSnapshot().selecting, false, 'an empty chat cannot enter selection');
  assert.equal(vm.getSnapshot().draft, 'Draft survives');
  vm.stop();
});
