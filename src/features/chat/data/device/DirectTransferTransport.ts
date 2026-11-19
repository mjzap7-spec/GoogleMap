import type { DataTransferTransport } from '../../models/directTransfer';
import { openFileChannel, type FileRtcRuntime } from '../webrtc/FileDataChannel';
export class DirectTransferTransport implements DataTransferTransport {
  open: DataTransferTransport['open'] = (options) => {
    if (typeof window === 'undefined' || !window.RTCPeerConnection)
      throw Error('File transfer is unavailable.');
    return openFileChannel(window as unknown as FileRtcRuntime, options);
  };
}
