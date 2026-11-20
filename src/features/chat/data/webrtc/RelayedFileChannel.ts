import type { DataTransferSession, DataTransferTransport } from '../../models/directTransfer';
import type { IceServer } from '../../../interviews/data/webrtc/PeerCallMedia';
import { openFileChannel, type FileRtcRuntime } from './FileDataChannel';

/** Uses the same authenticated relay configuration as calls; direct ICE paths remain available. */
export function openRelayedFileChannel(
  runtime: FileRtcRuntime,
  options: Parameters<DataTransferTransport['open']>[0],
  servers: Promise<IceServer[]>,
): DataTransferSession {
  let session: DataTransferSession | undefined,
    closed = false;
  const close = () => {
    closed = true;
    session?.close();
    options.signal.removeEventListener('abort', close);
  };
  options.signal.addEventListener('abort', close, { once: true });
  const directServer = { urls: 'stun:stun.l.google.com:19302' };
  const ready = servers
    .catch(() => {
      if (closed || options.signal.aborted) throw Error('Transfer cancelled');
      console.info('[File transfer] Relay credentials unavailable; trying a direct connection.');
      return [directServer];
    })
    .then((values) => {
      if (closed || options.signal.aborted) throw Error('Transfer cancelled');
      const hasStun = values.some((server) =>
        (Array.isArray(server.urls) ? server.urls : [server.urls]).some((url) =>
          /^stuns?:/.test(url),
        ),
      );
      // Preserve free direct paths even when a configured relay has exhausted its allowance.
      session = openFileChannel(runtime, options, hasStun ? values : [...values, directServer]);
      return session;
    });
  void ready.catch(() => {});
  return {
    offer: async () => (await ready).offer(),
    answer: async (offer) => (await ready).answer(offer),
    applyAnswer: async (answer) => {
      if (!closed) await (await ready).applyAnswer(answer);
    },
    candidate: async (candidate) => {
      if (!closed) await (await ready).candidate(candidate);
    },
    close,
  };
}
