import type { DataTransferTransport } from '../../models/directTransfer';
import { openFileChannel, type FileRtcRuntime } from '../webrtc/FileDataChannel';
export class DirectTransferTransport implements DataTransferTransport {
  open: DataTransferTransport['open'] = (options) => {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const runtime = require('react-native-webrtc') as FileRtcRuntime;
    return openFileChannel(runtime, options);
  };
}
