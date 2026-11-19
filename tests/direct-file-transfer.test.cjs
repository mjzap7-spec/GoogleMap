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

function rtc() {
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
    readyState = 'open';
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
      this.localDescription = value;
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
    connect() {
      const outgoing = peers[0].channel,
        incoming = new Channel();
      incoming.other = outgoing;
      outgoing.other = incoming;
      peers[1].emit('datachannel', { channel: incoming });
      outgoing.emit('open');
      incoming.emit('open');
      return incoming;
    },
  };
}

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

function fixture(uid = 'alice', devicePatch = {}) {
  let listener,
    options,
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
          async applyAnswer() {},
          async candidate() {},
          close() {},
        };
      },
    },
    uid,
    { peerId: uid === 'alice' ? 'bob' : 'alice', requestId: 'r' },
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
    counts: () => ({ picks, sourceClosed, sinkClosed, saves }),
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
