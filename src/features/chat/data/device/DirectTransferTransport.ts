import type { DataTransferTransport } from '../../models/directTransfer';
import type { FileRtcRuntime } from '../webrtc/FileDataChannel';
import { openRelayedFileChannel } from '../webrtc/RelayedFileChannel';
import { callIceServers } from '../../../interviews/data/webrtc/callIceServers';
export class DirectTransferTransport implements DataTransferTransport {
  open: DataTransferTransport['open'] = (options) => {
    if (typeof window === 'undefined' || !window.RTCPeerConnection)
      throw Error('File transfer is unavailable.');
    return openRelayedFileChannel(window as unknown as FileRtcRuntime, options, callIceServers());
  };
}
