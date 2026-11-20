import type { DataTransferTransport } from '../../models/directTransfer';
import type { FileRtcRuntime } from '../webrtc/FileDataChannel';
import { openRelayedFileChannel } from '../webrtc/RelayedFileChannel';
import { callIceServers } from '../../../interviews/data/webrtc/callIceServers';
export class DirectTransferTransport implements DataTransferTransport {
  open: DataTransferTransport['open'] = (options) => {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const runtime = require('react-native-webrtc') as FileRtcRuntime;
    return openRelayedFileChannel(runtime, options, callIceServers());
  };
}
