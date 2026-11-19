import type { DataTransferSession, DataTransferTransport } from '../../models/directTransfer';
import { fileDescription } from '../../models/fileSignaling';
import type { CallCandidate, CallDescription } from '../../../interviews/models/interview';

interface Channel {
  label: string;
  readyState: string;
  bufferedAmount: number;
  binaryType: string;
  send(data: string | ArrayBuffer): void;
  close(): void;
  addEventListener(name: string, listener: (event: { data?: unknown }) => void): void;
}
interface Peer {
  localDescription: CallDescription | null;
  connectionState: string;
  createDataChannel(label: string, options: { ordered: boolean }): Channel;
  addEventListener(
    name: string,
    listener: (event: { channel?: Channel; candidate?: { toJSON(): CallCandidate } }) => void,
  ): void;
  createOffer(): Promise<CallDescription>;
  createAnswer(): Promise<CallDescription>;
  setLocalDescription(value: CallDescription): Promise<void>;
  setRemoteDescription(value: CallDescription): Promise<void>;
  addIceCandidate(value: CallCandidate): Promise<void>;
  close(): void;
}
export interface FileRtcRuntime {
  RTCPeerConnection: new (config: { iceServers: { urls: string }[] }) => Peer;
}
const CHUNK = 16 * 1024;
const WINDOW = 256 * 1024;

/** Ordered encrypted data, STUN-only. Acknowledgements bound sender and receiver memory. */
export function openFileChannel(
  runtime: FileRtcRuntime,
  options: Parameters<DataTransferTransport['open']>[0],
): DataTransferSession {
  const peer = new runtime.RTCPeerConnection({
    iceServers: [{ urls: 'stun:stun.l.google.com:19302' }],
  });
  let channel: Channel | undefined;
  let closed = false,
    completed = false,
    sent = 0,
    acknowledged = 0,
    received = 0,
    backlog = 0;
  let lastActivity = Date.now(),
    lastPaint = 0,
    started = false;
  let queue = Promise.resolve();
  const close = () => {
    if (closed) return;
    closed = true;
    clearInterval(watchdog);
    options.signal.removeEventListener('abort', close);
    channel?.close();
    peer.close();
  };
  const fail = (message = 'Direct connection unavailable. Try the same Wi-Fi network.') => {
    if (closed || completed) return;
    close();
    options.fail(message);
  };
  const watchdog = setInterval(() => {
    if (started && !completed && Date.now() - lastActivity > 30000) fail();
  }, 1000);
  options.signal.addEventListener('abort', close, { once: true });
  const progress = (bytes: number) => {
    lastActivity = Date.now();
    if (bytes === options.size || Date.now() - lastPaint >= 200) {
      lastPaint = Date.now();
      options.progress(bytes);
    }
  };
  const sendFile = async () => {
    try {
      while (!closed && sent < options.size) {
        if (sent - acknowledged >= WINDOW || (channel?.bufferedAmount ?? 0) > WINDOW) {
          await new Promise((resolve) => setTimeout(resolve, 10));
          continue;
        }
        const bytes = await options.source!.read(sent, Math.min(CHUNK, options.size - sent));
        if (closed) return;
        if (!bytes.length || bytes.length > CHUNK || sent + bytes.length > options.size)
          throw Error('File changed during transfer.');
        channel!.send(new Uint8Array(bytes).buffer);
        sent += bytes.length;
      }
      if (!closed) channel!.send(JSON.stringify({ end: options.size }));
    } catch {
      fail('Could not transfer the file. Please try again.');
    }
  };
  const attach = (incoming: Channel) => {
    if (closed || channel || incoming.label !== 'private-file-v1') {
      incoming.close();
      return;
    }
    channel = incoming;
    channel.binaryType = 'arraybuffer';
    channel.addEventListener('open', () => {
      lastActivity = Date.now();
      if (options.source) void sendFile();
    });
    channel.addEventListener('close', () => {
      if (!completed) fail('File transfer interrupted. Please send it again.');
    });
    channel.addEventListener('error', () =>
      fail('File transfer interrupted. Please send it again.'),
    );
    channel.addEventListener('message', (event) => {
      if (closed || completed) return;
      const data = event.data;
      if (data instanceof ArrayBuffer) {
        if (
          !options.sink ||
          data.byteLength > CHUNK ||
          !data.byteLength ||
          backlog + data.byteLength > WINDOW * 2
        ) {
          fail();
          return;
        }
        backlog += data.byteLength;
        queue = queue
          .then(async () => {
            if (closed) return;
            if (received + data.byteLength > options.size) throw Error('Too much data');
            await options.sink!.write(new Uint8Array(data));
            if (closed) return;
            received += data.byteLength;
            backlog -= data.byteLength;
            channel!.send(JSON.stringify({ received }));
            progress(received);
          })
          .catch(() => fail('Could not save the received file.'));
      } else if (typeof data === 'string' && data.length <= 128) {
        queue = queue
          .then(() => {
            if (closed) return;
            const message = JSON.parse(data);
            if (
              options.source &&
              Number.isInteger(message.received) &&
              message.received >= acknowledged &&
              message.received <= sent
            ) {
              acknowledged = message.received;
              progress(acknowledged);
            } else if (options.sink && message.end === options.size && received === options.size) {
              channel!.send(JSON.stringify({ done: received }));
              completed = true;
              clearInterval(watchdog);
              options.complete();
            } else if (
              options.source &&
              message.done === options.size &&
              acknowledged === options.size
            ) {
              completed = true;
              options.progress(options.size);
              options.complete();
              close();
            } else throw Error('Invalid transfer frame');
          })
          .catch(() => fail('Invalid file transfer data.'));
      } else fail('Invalid file transfer data.');
    });
  };
  peer.addEventListener('icecandidate', ({ candidate }) => {
    if (!closed && candidate) {
      const value = candidate.toJSON();
      if (value.candidate)
        options.candidate({
          candidate: value.candidate,
          sdpMid: value.sdpMid ?? null,
          sdpMLineIndex: value.sdpMLineIndex ?? null,
        });
    }
  });
  peer.addEventListener('datachannel', ({ channel: value }) => {
    if (value && options.sink) attach(value);
    else value?.close();
  });
  peer.addEventListener('connectionstatechange', () => {
    if (['failed', 'closed'].includes(peer.connectionState)) fail();
    if (peer.connectionState === 'connected') lastActivity = Date.now();
  });
  if (options.source) attach(peer.createDataChannel('private-file-v1', { ordered: true }));
  if (options.signal.aborted) close();
  return {
    async offer() {
      const value = await peer.createOffer();
      await peer.setLocalDescription(value);
      return fileDescription(peer.localDescription, 'offer');
    },
    async answer(offer) {
      started = true;
      lastActivity = Date.now();
      await peer.setRemoteDescription(offer);
      const value = await peer.createAnswer();
      await peer.setLocalDescription(value);
      return fileDescription(peer.localDescription, 'answer');
    },
    async applyAnswer(answer) {
      started = true;
      lastActivity = Date.now();
      if (!closed) await peer.setRemoteDescription(answer);
    },
    async candidate(value) {
      if (!closed) await peer.addIceCandidate(value);
    },
    close,
  };
}
