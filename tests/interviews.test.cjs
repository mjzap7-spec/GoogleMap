const { test } = require('node:test');
const assert = require('node:assert/strict');
const {
  InterviewViewModel,
} = require('../.test-build/features/interviews/viewmodels/InterviewViewModel');
const { interviewTarget } = require('../.test-build/features/interviews/models/interview');
const { openPeerMedia } = require('../.test-build/features/interviews/data/PeerCallMedia');
const tick = () => new Promise((resolve) => setImmediate(resolve));
const target = { id: 'bob', name: 'Bob', kind: 'contact', contextId: 'alice_bob' };
const candidate = { candidate: 'candidate:1', sdpMid: '0', sdpMLineIndex: 0 };
function invitation(patch = {}) {
  return {
    id: 'call1',
    fromId: 'bob',
    toId: 'alice',
    fromName: 'Bob',
    fromAvatar: null,
    kind: 'contact',
    contextId: 'alice_bob',
    mode: 'video',
    status: 'ringing',
    offer: { type: 'offer', sdp: 'offer' },
    expiresAt: Date.now() + 60000,
    validUntil: Date.now() + 7200000,
    ...patch,
  };
}
function harness(t) {
  const h = {
    closed: 0,
    opened: 0,
    finished: [],
    sent: [],
    remoteCandidates: [],
    stopped: 0,
    answerApplied: 0,
  };
  h.session = {
    local: { url: 'local' },
    offer: async () => ({ type: 'offer', sdp: 'offer' }),
    answer: async () => ({ type: 'answer', sdp: 'answer' }),
    applyAnswer: async () => {
      h.answerApplied++;
    },
    addCandidate: async (c) => h.remoteCandidates.push(c),
    mute: (v) => {
      h.muted = v;
    },
    camera: (v) => {
      h.camera = v;
    },
    switchCamera() {},
    close() {
      h.closed++;
    },
  };
  h.repo = {
    incoming(_uid, next, fail) {
      h.incoming = next;
      h.incomingFail = fail;
      return () => {
        h.incomingStopped = true;
      };
    },
    async create(uid, name, avatar, who, mode, offer) {
      return invitation({ fromId: uid, fromName: name, toId: who.id, mode, offer });
    },
    watch(_uid, _id, next, fail) {
      h.changed = next;
      h.watchFail = fail;
      return () => {
        h.stopped++;
      };
    },
    async accept(_uid, _id, answer) {
      h.answer = answer;
    },
    async finish(uid, id, status) {
      h.finished.push({ uid, id, status });
    },
    async candidate(_uid, _id, index, c) {
      h.sent.push({ index, ...c });
    },
    candidates(_uid, _id, other, next) {
      h.other = other;
      h.candidate = next;
      return () => {
        h.stopped++;
      };
    },
  };
  h.media = {
    async open(mode, events) {
      h.opened++;
      h.mode = mode;
      h.events = events;
      return h.session;
    },
  };
  h.vm = new InterviewViewModel('alice', () => ({ name: 'Alice', avatar: null }), h.repo, h.media);
  h.vm.start();
  t.after(() => h.vm.stop());
  return h;
}
test('a failed incoming listener recovers and stops retrying in the background', (t) => {
  t.mock.timers.enable({ apis: ['setTimeout'] });
  const h = harness(t);
  const first = h.incoming;
  h.incomingFail();
  assert.equal(h.vm.getSnapshot().listeningError, true);
  t.mock.timers.tick(5000);
  assert.notEqual(h.incoming, first);
  assert.equal(h.vm.getSnapshot().listeningError, false);
  const recovered = h.incoming;
  h.incomingFail();
  h.vm.setForeground(false);
  t.mock.timers.tick(5000);
  assert.equal(h.incoming, recovered);
});

test('interviews target contacts and individual group members, never whole group rooms', () => {
  assert.deepEqual(interviewTarget({ peerId: 'bob', requestId: 'r' }, 'Bob'), {
    id: 'bob',
    name: 'Bob',
    avatarUrl: undefined,
    kind: 'contact',
    contextId: 'r',
  });
  assert.equal(interviewTarget({ groupId: 'g', memberId: 'bob' }, 'Bob').kind, 'group');
  assert.equal(interviewTarget({ groupId: 'g', senderName: 'Alice' }, 'Group'), undefined);
});
test('choosing or declining does not capture media; dismissed invitation does not reopen', (t) => {
  const h = harness(t);
  h.vm.choose(target);
  assert.equal(h.opened, 0);
  h.vm.dismiss();
  h.incoming([invitation()]);
  assert.equal(h.vm.getSnapshot().phase, 'incoming');
  h.vm.decline();
  assert.equal(h.vm.getSnapshot().phase, 'idle');
  h.incoming([invitation()]);
  assert.equal(h.vm.getSnapshot().phase, 'idle');
  assert.equal(h.opened, 0);
  assert.equal(h.finished[0].status, 'declined');
});
test('expired, wrong-recipient and self calls never open media', (t) => {
  const h = harness(t);
  h.vm.choose({ ...target, id: 'alice' });
  h.incoming([invitation({ expiresAt: 1 }), invitation({ id: 'wrong', toId: 'eve' })]);
  assert.equal(h.vm.getSnapshot().phase, 'idle');
  assert.equal(h.opened, 0);
});
test('caller applies answer once, exchanges candidates, controls media, and frees it on hangup', async (t) => {
  const h = harness(t);
  h.vm.choose(target);
  await h.vm.begin('video');
  assert.equal(h.vm.getSnapshot().phase, 'outgoing');
  h.events.candidate(candidate);
  assert.equal(h.sent.length, 1);
  const call = {
    ...h.vm.getSnapshot().call,
    status: 'accepted',
    answer: { type: 'answer', sdp: 'answer' },
  };
  let finishAnswer;
  const applyAnswer = h.session.applyAnswer;
  h.session.applyAnswer = async () => {
    await applyAnswer();
    await new Promise((resolve) => {
      finishAnswer = resolve;
    });
  };
  h.changed(call);
  h.changed(call);
  await tick();
  assert.equal(h.answerApplied, 1);
  assert.equal(h.other, 'bob');
  h.candidate(candidate);
  await tick();
  assert.equal(h.remoteCandidates.length, 0);
  finishAnswer();
  await tick();
  assert.equal(h.remoteCandidates.length, 1);
  h.events.connection('connected');
  assert.equal(h.vm.getSnapshot().phase, 'connected');
  h.vm.toggleMute();
  h.vm.toggleCamera();
  assert.equal(h.muted, true);
  assert.equal(h.camera, false);
  h.vm.hangUp();
  assert.equal(h.closed, 1);
  assert.equal(h.stopped, 2);
  h.events.remote({ url: 'late' });
  assert.equal(h.vm.getSnapshot().remote, undefined);
});
test('receiver requests media only after accepting and publishes an answer', async (t) => {
  const h = harness(t);
  h.incoming([invitation()]);
  assert.equal(h.opened, 0);
  await h.vm.accept();
  assert.equal(h.opened, 1);
  assert.equal(h.answer.type, 'answer');
  assert.equal(h.other, 'bob');
  h.vm.setForeground(false);
  assert.equal(h.closed, 1);
  assert.equal(h.incomingStopped, true);
});
test('recipient reads caller ICE while answering but waits for acceptance before writing ICE', async (t) => {
  const h = harness(t);
  let commit;
  h.repo.accept = () =>
    new Promise((resolve) => {
      commit = resolve;
    });
  h.incoming([invitation()]);
  const accepting = h.vm.accept();
  await tick();
  h.candidate(candidate);
  h.events.candidate(candidate);
  await tick();
  assert.equal(h.remoteCandidates.length, 1);
  assert.equal(h.sent.length, 0);
  commit();
  await accepting;
  assert.equal(h.sent.length, 1);
});

test('a late answer write is closed after cancellation', async (t) => {
  const h = harness(t);
  let commit;
  h.repo.accept = () =>
    new Promise((resolve) => {
      commit = resolve;
    });
  h.incoming([invitation()]);
  const accepting = h.vm.accept();
  await tick();
  h.vm.hangUp();
  commit();
  await accepting;
  assert.equal(h.finished.length, 2);
  assert.equal(h.finished[1].status, 'ended');
  assert.equal(h.vm.getSnapshot().phase, 'ended');
});

test('a late permission response after cancellation immediately stops its tracks', async (t) => {
  const h = harness(t);
  let resolve;
  h.media.open = () =>
    new Promise((r) => {
      resolve = r;
    });
  h.vm.choose(target);
  const starting = h.vm.begin('voice');
  h.vm.hangUp();
  resolve(h.session);
  await starting;
  assert.equal(h.closed, 1);
  assert.equal(h.vm.getSnapshot().phase, 'ended');
});
test('a call committed after cancellation is ended without reopening the UI', async (t) => {
  const h = harness(t);
  let resolve;
  h.repo.create = () =>
    new Promise((r) => {
      resolve = r;
    });
  h.vm.choose(target);
  const starting = h.vm.begin('voice');
  await tick();
  h.vm.hangUp();
  resolve(invitation({ fromId: 'alice', toId: 'bob' }));
  await starting;
  assert.equal(h.finished[0].status, 'ended');
  assert.equal(h.closed, 1);
  assert.equal(h.vm.getSnapshot().phase, 'ended');
});
test('permission failure leaves a recoverable result without a signaling call', async (t) => {
  const h = harness(t);
  h.media.open = async () => {
    throw Error('Allow microphone and camera access to start the interview.');
  };
  h.vm.choose(target);
  await h.vm.begin('video');
  assert.match(h.vm.getSnapshot().result, /Allow microphone/);
  assert.equal(h.finished.length, 0);
});
test('retry starts the same interview mode after a failed connection', async (t) => {
  const h = harness(t);
  h.vm.choose(target);
  await h.vm.begin('video');
  h.events.connection('failed');
  assert.ok(h.vm.getSnapshot().error);
  h.vm.retryInterview();
  await tick();
  assert.equal(h.opened, 2);
  assert.equal(h.mode, 'video');
  assert.equal(h.vm.getSnapshot().phase, 'outgoing');
  h.vm.hangUp();
  h.vm.retryInterview();
  assert.equal(h.opened, 2);
});

test('accepting on another device closes this prompt without ending that call', (t) => {
  const h = harness(t);
  const call = invitation();
  h.incoming([call]);
  h.changed({ ...call, status: 'accepted', answer: { type: 'answer', sdp: 'answer' } });
  assert.match(h.vm.getSnapshot().result, /another device/);
  assert.equal(h.finished.length, 0);
  h.vm.dismiss();
  h.incoming([call]);
  assert.equal(h.vm.getSnapshot().phase, 'idle');
});
test('busy invitations and remote hangup do not replace an active conversation', async (t) => {
  const h = harness(t);
  h.vm.choose(target);
  await h.vm.begin('voice');
  h.incoming([invitation({ id: 'busy' })]);
  assert.equal(h.finished[0].status, 'busy');
  assert.equal(h.vm.getSnapshot().phase, 'outgoing');
  h.changed({ ...h.vm.getSnapshot().call, status: 'ended' });
  assert.equal(h.closed, 1);
  assert.equal(h.vm.getSnapshot().phase, 'ended');
});
test('ringing, connecting and network disconnect have bounded waits', async (t) => {
  t.mock.timers.enable({ apis: ['setTimeout'] });
  const h = harness(t);
  h.vm.choose(target);
  await h.vm.begin('voice');
  t.mock.timers.tick(61000);
  assert.equal(h.vm.getSnapshot().result, 'No answer');
  h.vm.dismiss();
  h.vm.choose(target);
  await h.vm.begin('voice');
  h.events.connection('connected');
  h.events.connection('disconnected');
  t.mock.timers.tick(5000);
  h.events.connection('connected');
  t.mock.timers.tick(6000);
  assert.equal(h.vm.getSnapshot().phase, 'connected');
  h.events.connection('disconnected');
  t.mock.timers.tick(10000);
  assert.equal(h.vm.getSnapshot().result, 'Connection lost');
});
test('synchronous snapshot failure unsubscribes even before watch returns', async (t) => {
  const h = harness(t);
  let stopped = 0;
  h.repo.watch = (_uid, _id, _next, fail) => {
    fail();
    return () => stopped++;
  };
  h.vm.choose(target);
  await h.vm.begin('voice');
  assert.equal(stopped, 1);
  assert.equal(h.closed, 1);
});
test('signaling error stops camera; queued late ICE cannot affect the next call', async (t) => {
  const h = harness(t);
  h.vm.choose(target);
  await h.vm.begin('video');
  const oldEvents = h.events;
  h.watchFail();
  h.vm.dismiss();
  h.vm.choose(target);
  oldEvents.candidate(candidate);
  assert.equal(h.sent.length, 0);
  assert.equal(h.closed, 1);
});
test('native media transport requests modest video and releases every track and stream exactly once', async () => {
  let options,
    connection,
    peerClosed = 0,
    released = 0,
    stops = 0;
  const audio = { enabled: true, stop: () => stops++ },
    video = { enabled: true, stop: () => stops++, _switchCamera() {} };
  const stream = {
    toURL: () => 'native-stream',
    getTracks: () => [audio, video],
    getAudioTracks: () => [audio],
    getVideoTracks: () => [video],
    release: () => released++,
  };
  class Peer {
    listeners = {};
    connectionState = 'new';
    constructor() {
      connection = this;
    }
    addTrack() {}
    addEventListener(type, next) {
      this.listeners[type] = next;
    }
    async createOffer() {
      return { type: 'offer', sdp: 'offer' };
    }
    async setLocalDescription(d) {
      this.localDescription = d;
    }
    close() {
      peerClosed++;
    }
  }
  const sent = [];
  const events = {
    candidate(value) {
      sent.push(value);
    },
    remote() {},
    connection() {},
  };
  const media = await openPeerMedia(
    {
      mediaDevices: {
        getUserMedia: async (o) => {
          options = o;
          return stream;
        },
      },
      RTCPeerConnection: Peer,
    },
    [],
    'video',
    events,
  );
  assert.equal(options.video.frameRate, 24);
  assert.equal(options.video.width, 640);
  connection.listeners.icecandidate({
    candidate: { toJSON: () => ({ candidate: 'candidate:1', usernameFragment: 'browser-only' }) },
  });
  connection.listeners.icecandidate({ candidate: { toJSON: () => ({ candidate: '' }) } });
  assert.deepEqual(sent, [{ candidate: 'candidate:1', sdpMid: null, sdpMLineIndex: null }]);
  assert.equal((await media.offer()).sdp, 'offer');
  media.mute(true);
  media.camera(false);
  assert.equal(audio.enabled, false);
  assert.equal(video.enabled, false);
  media.close();
  media.close();
  assert.equal(stops, 2);
  assert.equal(released, 1);
  assert.equal(peerClosed, 1);
  connection.listeners.icecandidate({
    candidate: {
      toJSON() {
        throw Error('stale callback');
      },
    },
  });
});
test('voice never requests camera and peer initialization failure releases capture', async () => {
  let stopped = 0,
    request;
  const audio = { stop: () => stopped++ };
  const stream = { getTracks: () => [audio], getAudioTracks: () => [audio] };
  await assert.rejects(
    openPeerMedia(
      {
        mediaDevices: {
          getUserMedia: async (o) => {
            request = o;
            return stream;
          },
        },
        RTCPeerConnection: class {
          constructor() {
            throw Error('native failure');
          }
        },
      },
      [],
      'voice',
      {},
    ),
  );
  assert.equal(request.video, false);
  assert.equal(stopped, 1);
});
