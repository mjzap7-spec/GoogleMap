const { test } = require('node:test');
const assert = require('node:assert/strict');
const Module = require('node:module');

test('Android call reapplies communication routing after connecting and releases it on hangup', async () => {
  const original = Module._load;
  let peer,
    opened = 0,
    refreshed = 0,
    released = 0;
  const audio = { enabled: true, stop() {} };
  const stream = {
    getTracks: () => [audio],
    getAudioTracks: () => [audio],
    getVideoTracks: () => [],
  };
  class Peer {
    listeners = {};
    connectionState = 'new';
    constructor() {
      peer = this;
    }
    addTrack() {}
    addEventListener(name, fn) {
      this.listeners[name] = fn;
    }
    close() {}
  }
  Module._load = function (request, ...args) {
    if (request.endsWith('/interviewPermissions'))
      return { requestInterviewPermissions: async () => {} };
    if (request.endsWith('/interviewAudio'))
      return {
        openInterviewAudio: async () => {
          opened++;
          return () => {
            released++;
          };
        },
        refreshInterviewAudio: async () => {
          refreshed++;
        },
      };
    if (request.endsWith('/callIceServers')) return { callIceServers: async () => [] };
    if (request === 'react-native-webrtc')
      return { RTCPeerConnection: Peer, mediaDevices: { getUserMedia: async () => stream } };
    return original.call(this, request, ...args);
  };
  try {
    const {
      DeviceCallMedia,
    } = require('../.test-build/features/interviews/data/device/DeviceCallMedia.native');
    const states = [];
    const session = await new DeviceCallMedia().open('voice', {
      candidate() {},
      remote() {},
      connection(state) {
        states.push(state);
      },
    });
    assert.equal(opened, 1);
    peer.connectionState = 'connected';
    peer.listeners.connectionstatechange();
    assert.equal(refreshed, 1);
    assert.deepEqual(states, ['connected']);
    session.close();
    assert.equal(released, 1);
    peer.listeners.connectionstatechange();
    assert.equal(refreshed, 1);
  } finally {
    Module._load = original;
  }
});
