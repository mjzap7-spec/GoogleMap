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
  const ready = servers.then((values) => {
    if (closed || options.signal.aborted) throw Error('Transfer cancelled');
    const relayOnly = values.some(
      (server) =>
        !!server.username &&
        !!server.credential &&
        (Array.isArray(server.urls) ? server.urls : [server.urls]).some((url) =>
          /^turns?:/.test(url),
        ),
    );
    session = openFileChannel(runtime, options, values, { relayOnly });
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
