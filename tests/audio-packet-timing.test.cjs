const { test } = require('node:test');
const assert = require('node:assert/strict');
const {
  speechPacketTiming,
} = require('../.test-build/features/interviews/data/webrtc/audioPacketTiming');

test('speech packet timing changes only active Opus audio and preserves SDP credentials and video', () => {
  const video = 'm=video 9 UDP/TLS/RTP/SAVPF 96\r\na=rtpmap:96 VP8/90000\r\na=ptime:40\r\n';
  const source = {
    type: 'offer',
    sdp:
      'v=0\r\nm=audio 9 UDP/TLS/RTP/SAVPF 111\r\na=rtpmap:111 opus/48000/2\r\na=ice-ufrag:secret\r\na=fmtp:111 minptime=10;useinbandfec=1\r\na=ptime:20\r\n' +
      video,
  };
  const tuned = speechPacketTiming(source);
  assert.match(tuned.sdp, /a=ptime:10\r\n/);
  assert.ok(tuned.sdp.endsWith(video));
  assert.match(tuned.sdp, /a=ice-ufrag:secret/);
  assert.match(tuned.sdp, /minptime=10;useinbandfec=1/);
  assert.equal(speechPacketTiming(tuned).sdp, tuned.sdp);
  assert.match(source.sdp, /a=ptime:20/);
});

test('answer adds packet timing when absent, retaining LF format and final newline', () => {
  const source = {
    type: 'answer',
    sdp: 'v=0\nm=audio 9 UDP/TLS/RTP/SAVPF 111\na=rtpmap:111 opus/48000/2\n',
  };
  const tuned = speechPacketTiming(source);
  assert.equal(tuned.type, 'answer');
  assert.match(tuned.sdp, /a=ptime:10\n/);
  assert.ok(tuned.sdp.endsWith('\n'));
  assert.ok(!tuned.sdp.includes('\r'));
});

test('non-Opus, rejected audio, and data-only sessions are unchanged', () => {
  for (const sdp of [
    'm=audio 0 UDP/TLS/RTP/SAVPF 111\na=rtpmap:111 opus/48000/2\n',
    'm=audio 9 RTP/AVP 0\na=rtpmap:0 PCMU/8000\n',
    'm=application 9 UDP/DTLS/SCTP webrtc-datachannel\n',
  ]) {
    const source = { type: 'offer', sdp };
    assert.equal(speechPacketTiming(source), source);
  }
});
