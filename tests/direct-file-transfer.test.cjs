const { Buffer } = require('node:buffer');
const { test } = require('node:test');
const assert = require('node:assert/strict');
const { openFileChannel } = require('../.test-build/features/chat/data/webrtc/FileDataChannel');
const {
  DirectTransfersViewModel,
} = require('../.test-build/features/chat/viewmodels/DirectTransfersViewModel');
const {
  directTransferId,
  DIRECT_FILE_PREFIX,
} = require('../.test-build/features/chat/models/directTransfer');
const tick = () => new Promise((resolve) => setImmediate(resolve));
const {
  fileDescription,
  fileTransferError,
} = require('../.test-build/features/chat/models/fileSignaling');
const id = 'abcdefghijklmnopqrst';
const record = {
  id,
  fromId: 'alice',
  toId: 'bob',
  name: 'video.mp4',
  mime: 'video/mp4',
  size: 4096,
  status: 'offered',
  expiresAt: Date.now() + 60000,
  offer: { type: 'offer', sdp: 'offer' },
};

function rtc(alreadyOpen = false) {
  const peers = [],
    configs = [];
  class Events {
    listeners = {};
    addEventListener(name, fn) {
      (this.listeners[name] ??= []).push(fn);
    }
    emit(name, value = {}) {
      for (const fn of this.listeners[name] ?? []) fn(value);
    }
  }
  class Channel extends Events {
    label = 'private-file-v1';
    readyState = alreadyOpen ? 'open' : 'connecting';
    bufferedAmount = 0;
    sent = [];
    send(data) {
      this.sent.push(data);
      queueMicrotask(() => this.other?.emit('message', { data }));
    }
    close() {
      this.readyState = 'closed';
      this.emit('close');
    }
  }
  class RTCPeerConnection extends Events {
    connectionState = 'new';
    constructor(config) {
      super();
      peers.push(this);
      configs.push(config);
    }
    createDataChannel() {
      return (this.channel = new Channel());
    }
    async createOffer() {
      return { type: 'offer', sdp: 'offer' };
    }
    async createAnswer() {
      return { type: 'answer', sdp: 'answer' };
    }
    async setLocalDescription(value) {
      // Reproduce the native runtime: description getters on a custom prototype.
      this.localDescription = new (class RTCSessionDescription {
        get type() {
          return value.type;
        }
        get sdp() {
          return value.sdp;
        }
      })();
    }
    async setRemoteDescription() {}
    async addIceCandidate() {}
    close() {
      this.closed = true;
    }
  }
  return {
    runtime: { RTCPeerConnection },
    peers,
    configs,
    connect(emitOpen = true) {
      const outgoing = peers[0].channel,
        incoming = new Channel();
      incoming.other = outgoing;
      outgoing.other = incoming;
      peers[1].emit('datachannel', { channel: incoming });
      outgoing.readyState = incoming.readyState = 'open';
      if (emitOpen) {
        outgoing.emit('open');
        incoming.emit('open');
      }
      return incoming;
    },
  };
}

test('native offer and answer serialize as plain Firestore data, including getter-only descriptions', async () => {
  const fake = rtc();
  const common = {
    size: 3,
    signal: new AbortController().signal,
    candidate() {},
    progress() {},
    complete() {},
    fail() {},
  };
  const sender = openFileChannel(fake.runtime, { ...common, source: {} });
  const receiver = openFileChannel(fake.runtime, { ...common, sink: {} });
  try {
    const offer = await sender.offer();
    const answer = await receiver.answer(offer);
    assert.equal(Object.getPrototypeOf(offer), Object.prototype);
    assert.equal(Object.getPrototypeOf(answer), Object.prototype);
    assert.deepEqual(offer, { type: 'offer', sdp: 'offer' });
    assert.deepEqual(answer, { type: 'answer', sdp: 'answer' });
    assert.deepEqual(fileDescription(fake.peers[0].localDescription, 'offer'), offer);
    assert.throws(() => fileDescription(null, 'offer'));
    assert.throws(() => fileDescription({ type: 'answer', sdp: 'wrong type' }, 'offer'));
  } finally {
    sender.close();
    receiver.close();
  }
});

test('database failure after picking releases the file, hides provider details, and permits another try', async () => {
  const f = fixture();
  f.repository.create = async () => {
    throw Error(
      'Function WriteBatch.set() invalid RTCSessionDescription in fileTransfers/private-id',
    );
  };
  await f.model.send();
  assert.equal(f.model.getSnapshot().error, 'Could not transfer the file. Please try again.');
  assert.equal(f.model.getSnapshot().busy, false);
  assert.equal(f.counts().sourceClosed, 1);
  f.repository.create = async () => record;
  await f.model.send();
  assert.equal(f.model.getSnapshot().error, '');
  assert.equal(f.model.getSnapshot().active.id, id);
  f.model.stop();
  assert.equal(
    fileTransferError(Error('Choose a file up to 100 MB.')),
    'Choose a file up to 100 MB.',
  );
});

test('large encrypted data-channel transfer uses bounded chunks and acknowledges actual writes; no TURN', async () => {
  const fake = rtc(),
    data = Uint8Array.from({ length: 2 * 1024 * 1024 + 7 }, (_, n) => n % 251);
  const received = [];
  let sentDone = 0,
    receivedDone = 0,
    finalProgress = 0,
    failure;
  const common = {
    size: data.length,
    signal: new AbortController().signal,
    candidate() {},
    progress() {},
    fail(e) {
      failure = e;
    },
  };
  const sender = openFileChannel(fake.runtime, {
    ...common,
    source: { read: async (offset, length) => data.slice(offset, offset + length) },
    progress(n) {
      finalProgress = n;
    },
    complete() {
      sentDone++;
    },
  });
  const receiver = openFileChannel(fake.runtime, {
    ...common,
    sink: {
      async write(bytes) {
        received.push(bytes);
      },
    },
    complete() {
      receivedDone++;
    },
  });
  try {
    await sender.applyAnswer(await receiver.answer(await sender.offer()));
    fake.connect();
    for (let i = 0; i < 300 && !sentDone && !failure; i++)
      await new Promise((resolve) => setTimeout(resolve, 10));
    assert.equal(failure, undefined);
    assert.equal(sentDone, 1);
    assert.equal(receivedDone, 1);
    assert.equal(finalProgress, data.length);
    assert.deepEqual(Buffer.concat(received), Buffer.from(data));
    assert.ok(
      fake.peers[0].channel.sent
        .filter((x) => x instanceof ArrayBuffer)
        .every((x) => x.byteLength <= 16384),
    );
    assert.deepEqual(fake.configs[0], { iceServers: [{ urls: 'stun:stun.l.google.com:19302' }] });
  } finally {
    sender.close();
    receiver.close();
  }
});

test('sender backpressure stops at 256 KB until disk acknowledgements arrive', async () => {
  const fake = rtc();
  let release,
    reads = 0;
  const common = {
    size: 1024 * 1024,
    signal: new AbortController().signal,
    candidate() {},
    progress() {},
    complete() {},
    fail() {},
  };
  const sender = openFileChannel(fake.runtime, {
    ...common,
    source: {
      async read(_, length) {
        reads++;
        return new Uint8Array(length);
      },
    },
  });
  const receiver = openFileChannel(fake.runtime, {
    ...common,
    sink: {
      write() {
        return new Promise((resolve) => {
          release = resolve;
        });
      },
    },
  });
  fake.connect();
  await tick();
  await tick();
  assert.equal(reads, 16);
  sender.close();
  receiver.close();
  release();
});

test('oversize or premature completion frames never mark a received file complete', async () => {
  const fake = rtc();
  let complete = 0,
    failed = 0,
    writes = 0;
  const common = {
    size: 3,
    signal: new AbortController().signal,
    candidate() {},
    progress() {},
    complete() {
      complete++;
    },
    fail() {
      failed++;
    },
  };
  const sender = openFileChannel(fake.runtime, {
    ...common,
    source: { read: async () => new Uint8Array(0) },
  });
  const receiver = openFileChannel(fake.runtime, {
    ...common,
    sink: {
      async write() {
        writes++;
      },
    },
  });
  const incoming = fake.connect();
  incoming.emit('message', { data: new Uint8Array(4).buffer });
  await tick();
  assert.equal(complete, 0);
  assert.ok(failed);
  assert.equal(writes, 0);
  sender.close();
  receiver.close();
});

test('waiting for Accept does not time out the network; accepted stalled connections do', async (t) => {
  t.mock.timers.enable({ apis: ['setInterval', 'Date'], now: 1000 });
  const fake = rtc();
  let failed = 0;
  const session = openFileChannel(fake.runtime, {
    size: 3,
    source: {},
    signal: new AbortController().signal,
    candidate() {},
    progress() {},
    complete() {},
    fail() {
      failed++;
    },
  });
  t.mock.timers.tick(120000);
  assert.equal(failed, 0);
  await session.applyAnswer({ type: 'answer', sdp: 'answer' });
  t.mock.timers.tick(31000);
  assert.equal(failed, 1);
  assert.equal(fake.peers[0].closed, true);
  session.close();
});

function fixture(uid = 'alice', devicePatch = {}, automatic = false) {
  let listener,
    options,
    applied = 0,
    picks = 0,
    sourceClosed = 0,
    sinkClosed = 0,
    saves = 0;
  const endings = [];
  const repository = {
    async create() {
      return record;
    },
    watch(_, __, next) {
      listener = next;
      return () => {};
    },
    async accept() {},
    async finish(_, __, status) {
      endings.push(status);
    },
    async candidate() {},
    candidates() {
      return () => {};
    },
  };
  const device = {
    async pick() {
      picks++;
      return {
        ...record,
        close() {
          sourceClosed++;
        },
      };
    },
    async receive() {
      return {
        async write() {},
        async save() {
          saves++;
        },
        close() {
          sinkClosed++;
        },
      };
    },
    ...devicePatch,
  };
  const model = new DirectTransfersViewModel(
    repository,
    device,
    {
      open(value) {
        options = value;
        return {
          async offer() {
            return record.offer;
          },
          async answer() {
            return { type: 'answer', sdp: 'answer' };
          },
          async applyAnswer() {
            applied++;
          },
          async candidate() {},
          close() {},
        };
      },
    },
    uid,
    { peerId: uid === 'alice' ? 'bob' : 'alice', requestId: 'r' },
    automatic,
  );
  return {
    model,
    repository,
    endings,
    emit(value = record) {
      listener(value);
    },
    get options() {
      return options;
    },
    counts: () => ({ picks, sourceClosed, sinkClosed, saves, applied }),
  };
}

test('duplicate sends open one picker and only recipient can accept', async () => {
  let resolve;
  const f = fixture('alice', {
    pick: () =>
      new Promise((r) => {
        resolve = r;
      }),
  });
  const pending = f.model.send();
  await f.model.send();
  f.model.sync([{ text: DIRECT_FILE_PREFIX + id }]);
  f.emit();
  await f.model.accept(id);
  resolve(undefined);
  await pending;
  assert.equal(f.options, undefined);
  f.model.stop();
});

test('leaving while selecting a large file closes the late disk handle without an invitation', async () => {
  let resolve,
    closed = 0,
    created = 0;
  const f = fixture('alice', {
    pick: () =>
      new Promise((r) => {
        resolve = r;
      }),
  });
  f.repository.create = async () => {
    created++;
    return record;
  };
  const pending = f.model.send();
  f.model.stop();
  resolve({
    ...record,
    close() {
      closed++;
    },
  });
  await pending;
  assert.equal(closed, 1);
  assert.equal(created, 0);
});

test('received files can only be saved after verified completion; cancel discards temporary data', async () => {
  const f = fixture('bob');
  f.model.sync([{ text: DIRECT_FILE_PREFIX + id }]);
  f.emit();
  await f.model.save(id);
  assert.equal(f.counts().saves, 0);
  await f.model.accept(id);
  await f.model.save(id);
  assert.equal(f.counts().saves, 0);
  f.options.progress(1000);
  assert.equal(f.model.getSnapshot().active.bytes, 1000);
  f.options.complete();
  await f.model.save(id);
  assert.equal(f.counts().saves, 1);
  assert.deepEqual(f.endings, []); // Only sender confirms completed, after disk acknowledgement.
  f.model.cancel(id);
  assert.equal(f.counts().sinkClosed, 1);
  f.model.stop();
});

test('declining an unaccepted invitation allocates no file and marks it declined', async () => {
  const f = fixture('bob');
  f.model.sync([{ text: DIRECT_FILE_PREFIX + id }]);
  f.emit();
  f.model.cancel(id);
  await tick();
  assert.deepEqual(f.endings, ['declined']);
  assert.equal(f.options, undefined);
  f.model.stop();
});

test('sender completes history only after peer acknowledges completion; stop preserves completed history', async () => {
  const f = fixture();
  await f.model.send();
  f.options.progress(record.size);
  f.options.complete();
  await tick();
  assert.deepEqual(f.endings, ['completed']);
  assert.equal(f.counts().sourceClosed, 1);
  f.model.stop();
  assert.deepEqual(f.endings, ['completed']);
});

test('remote cancellation aborts active transfer and releases selected file', async () => {
  const f = fixture();
  await f.model.send();
  f.emit({ ...record, status: 'cancelled' });
  assert.equal(f.options.signal.aborted, true);
  assert.equal(f.counts().sourceClosed, 1);
  assert.equal(f.model.getSnapshot().busy, false);
  f.model.stop();
});

test('file invitation parsing rejects malformed identifiers', () => {
  assert.equal(directTransferId(DIRECT_FILE_PREFIX + id), id);
  assert.equal(directTransferId(DIRECT_FILE_PREFIX + '../other'), undefined);
});

test('cancelling preparation closes a late selected file and sends no invitation', async () => {
  let resolve,
    closed = 0,
    created = 0;
  const f = fixture('alice', {
    pick: () =>
      new Promise((r) => {
        resolve = r;
      }),
  });
  f.repository.create = async () => {
    created++;
    return record;
  };
  const pending = f.model.send();
  f.model.cancel('');
  resolve({
    ...record,
    close() {
      closed++;
    },
  });
  await pending;
  assert.equal(closed, 1);
  assert.equal(created, 0);
  assert.equal(f.model.getSnapshot().busy, false);
  f.model.stop();
});

test('losing an acceptance race does not terminate another device transfer', async () => {
  const f = fixture('bob');
  f.repository.accept = async () => {
    throw Error('File invitation is no longer available.');
  };
  f.model.sync([{ text: DIRECT_FILE_PREFIX + id }]);
  f.emit();
  await f.model.accept(id);
  assert.equal(f.counts().sinkClosed, 1);
  assert.deepEqual(f.endings, []);
  f.model.stop();
  assert.deepEqual(f.endings, []);
});

test('configured relay reaches the file peer; cancelled credential loading never opens a peer', async () => {
  const {
    openRelayedFileChannel,
  } = require('../.test-build/features/chat/data/webrtc/RelayedFileChannel');
  const fake = rtc();
  const common = {
    size: 3,
    source: {},
    signal: new AbortController().signal,
    candidate() {},
    progress() {},
    complete() {},
    fail() {},
  };
  const servers = [
    { urls: 'turn:relay.example:3478', username: 'short-lived', credential: 'test' },
  ];
  const session = openRelayedFileChannel(fake.runtime, common, Promise.resolve(servers));
  await session.offer();
  assert.deepEqual(fake.configs[0].iceServers, servers);
  session.close();
  let resolve;
  const abort = new AbortController();
  const cancelled = openRelayedFileChannel(
    fake.runtime,
    { ...common, signal: abort.signal },
    new Promise((r) => {
      resolve = r;
    }),
  );
  abort.abort();
  resolve(servers);
  await assert.rejects(cancelled.offer(), /cancelled/i);
  assert.equal(fake.peers.length, 1);
});

test('incoming offers receive automatically once, persist before acknowledging, and save after the session ends', async () => {
  let accepted = 0,
    kept = 0,
    saved = 0,
    closed = 0;
  const file = {
    uri: 'file:///private/photo.png',
    async save() {
      saved++;
    },
  };
  const f = fixture(
    'bob',
    {
      async receive() {
        return {
          async write() {},
          async keep(uid, transfer) {
            assert.equal(uid, 'bob');
            assert.equal(transfer, id);
            kept++;
            return file;
          },
          async save() {},
          close() {
            closed++;
          },
        };
      },
    },
    true,
  );
  f.repository.accept = async () => {
    accepted++;
  };
  f.model.sync([{ text: DIRECT_FILE_PREFIX + id }]);
  f.emit();
  f.emit();
  await tick();
  assert.equal(accepted, 1);
  await f.options.complete();
  assert.equal(kept, 1);
  assert.equal(closed, 1);
  assert.equal(f.model.getSnapshot().files[id].uri, file.uri);
  f.emit({ ...record, status: 'completed' });
  assert.equal(f.model.getSnapshot().busy, false);
  await f.model.save(id);
  await f.model.send(); // A later transfer must not remove the previously received file.
  await f.model.save(id);
  assert.equal(saved, 2);
  f.model.stop();
});

test('completed local files restore on reopening, while late restores after leaving release their previews', async () => {
  let resolve,
    releases = 0,
    saved = 0;
  const file = {
    uri: 'blob:private',
    async save() {
      saved++;
    },
    release() {
      releases++;
    },
  };
  const f = fixture('bob', { find: async () => file });
  f.model.sync([{ text: DIRECT_FILE_PREFIX + id }]);
  f.emit({ ...record, status: 'completed' });
  await tick();
  assert.equal(f.model.getSnapshot().files[id].uri, file.uri);
  await f.model.save(id);
  assert.equal(saved, 1);
  f.model.stop();
  assert.equal(releases, 1);
  const late = fixture('bob', {
    find: () =>
      new Promise((r) => {
        resolve = r;
      }),
  });
  late.model.sync([{ text: DIRECT_FILE_PREFIX + id }]);
  late.emit();
  late.model.stop();
  resolve(file);
  await tick();
  assert.deepEqual(late.model.getSnapshot().files, {});
  assert.equal(releases, 2);
});

test('automatic receiving ignores outgoing and expired invitations', async () => {
  const f = fixture('alice', {}, true);
  f.model.sync([{ text: DIRECT_FILE_PREFIX + id }]);
  f.emit();
  await tick();
  assert.equal(f.options, undefined);
  f.model.stop();
  const expired = fixture('bob', {}, true);
  expired.model.sync([{ text: DIRECT_FILE_PREFIX + id }]);
  expired.emit({ ...record, expiresAt: 1 });
  await tick();
  assert.equal(expired.options, undefined);
  expired.model.stop();
});

test('sender completion waits until recipient flushes and persists the received file', async () => {
  const fake = rtc();
  let flush,
    persist,
    senderDone = false,
    saved = false;
  const common = {
    size: 3,
    signal: new AbortController().signal,
    candidate() {},
    progress() {},
    fail(message) {
      assert.fail(message);
    },
  };
  const sender = openFileChannel(fake.runtime, {
    ...common,
    source: {
      async read() {
        return Uint8Array.of(1, 2, 3);
      },
    },
    complete() {
      senderDone = true;
    },
  });
  const receiver = openFileChannel(fake.runtime, {
    ...common,
    sink: {
      async write() {},
      finish() {
        return new Promise((resolve) => {
          flush = resolve;
        });
      },
    },
    complete() {
      return new Promise((resolve) => {
        persist = () => {
          saved = true;
          resolve();
        };
      });
    },
  });
  try {
    fake.connect();
    await tick();
    assert.equal(senderDone, false);
    assert.equal(persist, undefined);
    flush();
    await tick();
    assert.equal(senderDone, false);
    assert.equal(saved, false);
    persist();
    await tick();
    assert.equal(saved, true);
    assert.equal(senderDone, true);
  } finally {
    sender.close();
    receiver.close();
  }
});

test('picking stages a local file without signaling; Send uses that draft exactly once', async () => {
  const f = fixture();
  let created = 0;
  f.repository.create = async () => {
    created++;
    return record;
  };
  await f.model.pick();
  assert.equal(created, 0);
  assert.equal(f.options, undefined);
  assert.equal(f.model.getSnapshot().draft.name, record.name);
  assert.equal(f.model.getSnapshot().busy, false);
  await Promise.all([f.model.send(), f.model.send()]);
  assert.equal(created, 1);
  assert.equal(f.counts().picks, 1);
  assert.equal(f.model.getSnapshot().draft, undefined);
  f.model.stop();
  assert.equal(f.counts().sourceClosed, 1);
});

test('removing a draft and leaving during the picker close local files without sending', async () => {
  const f = fixture();
  await f.model.pick();
  f.model.clearDraft();
  assert.equal(f.model.getSnapshot().draft, undefined);
  assert.equal(f.counts().sourceClosed, 1);
  f.model.stop();
  let resolve,
    closed = 0;
  const late = fixture('alice', {
    pick: () =>
      new Promise((r) => {
        resolve = r;
      }),
  });
  const pending = late.model.pick();
  late.model.stop();
  resolve({
    ...record,
    close() {
      closed++;
    },
  });
  await pending;
  assert.equal(closed, 1);
  assert.equal(late.options, undefined);
  assert.equal(late.model.getSnapshot().draft, undefined);
});

test('already-open native data channels transfer once even without a later open event', async () => {
  const fake = rtc(true);
  let sent = 0,
    received = 0,
    reads = 0;
  const common = {
    size: 3,
    signal: new AbortController().signal,
    candidate() {},
    progress() {},
    fail(message) {
      assert.fail(message);
    },
  };
  const sender = openFileChannel(fake.runtime, {
    ...common,
    source: {
      async read() {
        reads++;
        return Uint8Array.of(1, 2, 3);
      },
    },
    complete() {
      sent++;
    },
  });
  const receiver = openFileChannel(fake.runtime, {
    ...common,
    sink: {
      async write(bytes) {
        assert.deepEqual([...bytes], [1, 2, 3]);
      },
    },
    complete() {
      received++;
    },
  });
  try {
    fake.connect(false);
    await tick();
    await tick();
    assert.equal(sent, 1);
    assert.equal(received, 1);
    assert.equal(reads, 1);
    fake.peers[0].channel.emit('open');
    await tick();
    assert.equal(reads, 1);
  } finally {
    sender.close();
    receiver.close();
  }
});

test('an answer arriving before create resolves survives sender preparation and applies once', async () => {
  let create, keep;
  const f = fixture('alice', {
    async pick() {
      return {
        ...record,
        close() {},
        keep: () =>
          new Promise((resolve) => {
            keep = resolve;
          }),
      };
    },
  });
  f.repository.create = () =>
    new Promise((resolve) => {
      create = resolve;
    });
  const sending = f.model.send();
  await tick();
  f.model.sync([{ text: DIRECT_FILE_PREFIX + id }]);
  f.emit({ ...record, status: 'accepted', answer: { type: 'answer', sdp: 'early' } });
  create(record);
  await tick();
  assert.equal(f.counts().applied, 0);
  assert.equal(f.model.getSnapshot().records[id].status, 'accepted');
  keep({ uri: 'file:///photo', async save() {} });
  await sending;
  await tick();
  assert.equal(f.counts().applied, 1);
  assert.equal(f.model.getSnapshot().active.phase, 'connecting');
  f.model.stop();
});

test('sender preview persistence failure does not fail the actual file transfer', async () => {
  const f = fixture('alice', {
    async pick() {
      return {
        ...record,
        close() {},
        async keep() {
          throw Error('No storage for duplicate preview');
        },
      };
    },
  });
  await f.model.send();
  assert.equal(f.model.getSnapshot().active.phase, 'waiting');
  assert.equal(f.model.getSnapshot().error, '');
  assert.equal(f.endings.includes('failed'), false);
  f.emit({ ...record, status: 'accepted', answer: { type: 'answer', sdp: 'answer' } });
  await tick();
  assert.equal(f.counts().applied, 1);
  f.model.stop();
});
