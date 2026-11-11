import type { CallMedia } from '../models/interview';
import { openPeerMedia, type RtcRuntime } from './PeerCallMedia';
import { callIceServers } from './callIceServers';

export class DeviceCallMedia implements CallMedia {
  open: CallMedia['open'] = async (mode, events) => {
    let runtime: typeof import('react-native-webrtc');
    try {
      // Keep WebRTC in the native bundle so Accept does not wait for a Metro split bundle.
      // eslint-disable-next-line @typescript-eslint/no-require-imports
      runtime = require('react-native-webrtc');
    } catch {
      throw Error('Rebuild the development app to enable interview calls.');
    }
    return openPeerMedia(runtime as unknown as RtcRuntime, callIceServers(), mode, events);
  };
}
